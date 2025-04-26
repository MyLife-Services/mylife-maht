import Router from 'koa-router'
import Anthropic from '@anthropic-ai/sdk'
import { McpManager } from './mcp/manager.js'
import { RegistryClient } from './registry/client.js'

// Helper: sanitize input schemas
function sanitizeInputSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema
  const sanitizedSchema = { ...schema }
  delete sanitizedSchema.oneOf
  delete sanitizedSchema.allOf
  delete sanitizedSchema.anyOf
  if (Object.keys(sanitizedSchema).length === 0) {
    return { type: "object", properties: {}, description: schema.description || "Input for this tool" }
  }
  return sanitizedSchema
}

// Ratings cache
const ratingsCache = new Map<string, { data: { average: number, count: number, score: number }, timestamp: number }>()
const RATINGS_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
const ratingApiState = { isRateLimited: false, rateLimitResetTime: 0, rateLimitBackoff: 5 * 60 * 1000, consecutiveErrors: 0 }

async function getWeightedRatingScore(serverId: string) {
  const now = Date.now()
  if (ratingApiState.isRateLimited && now < ratingApiState.rateLimitResetTime) {
    const cached = ratingsCache.get(serverId)
    return cached?.data || { average: 0, count: 0, score: 0 }
  }

  const cached = ratingsCache.get(serverId)
  if (cached && (now - cached.timestamp) < RATINGS_CACHE_TTL) return cached.data

  try {
    const res = await fetch(`https://nanda-registry.com/api/v1/servers/${serverId}/ratings`)
    if (!res.ok) throw new Error(`Failed to fetch ratings: ${res.status}`)

    const data = await res.json()
    const ratings = data?.data || []
    const count = ratings.length
    const total = ratings.reduce((sum: number, r: any) => sum + r.rating, 0)
    const average = count > 0 ? total / count : 0
    const score = average * count
    const result = { average, count, score }

    ratingsCache.set(serverId, { data: result, timestamp: now })
    ratingApiState.isRateLimited = false
    return result
  } catch (error: any) {
    console.error(`Error fetching ratings for server ${serverId}:`, error)

    // Handle 429 rate limit manually
    if (error.message?.includes('429')) {
      ratingApiState.isRateLimited = true
      ratingApiState.consecutiveErrors++
      const backoffTime = Math.min(ratingApiState.rateLimitBackoff * (2 ** (ratingApiState.consecutiveErrors - 1)), 60 * 60 * 1000)
      ratingApiState.rateLimitResetTime = now + backoffTime
    }

    return ratingsCache.get(serverId)?.data || { average: 0, count: 0, score: 0 }
  }
}

// MAIN
export function setupRoutes(router: Router, mcpManager: McpManager): void {

  const ensureSession = (sessionId: string) => {
    if (!sessionId) return mcpManager.getSessionManager().createSession()
    mcpManager.getSessionManager().getOrCreateSession(sessionId)
    return sessionId
  }

  router.get("/api/healthcheck", ctx => {
    ctx.body = { status: "ok" }
  })

  router.post("/api/session", ctx => {
    const sessionManager = mcpManager.getSessionManager()
    if (!sessionManager) {
      ctx.status = 500
      ctx.body = { error: "Session manager not available" }
      return
    }
    const sessionId = sessionManager.createSession()
    ctx.body = { sessionId }
  })

  router.post("/api/settings/apikey", ctx => {
    const { apiKey } = ctx.request.body
    if (!apiKey) {
      ctx.status = 400
      ctx.body = { error: "API key is required" }
      return
    }
    ctx.body = { success: true }
  })

  router.post("/api/chat/completions", async ctx => {
    const { messages, tools = true, auto_proceed = true } = ctx.request.body
    const apiKey = ctx.headers["x-api-key"] as string
    const rawSessionId = (ctx.headers["x-session-id"] as string) || ""
    const sessionId = ensureSession(rawSessionId)

    if (!apiKey) {
      ctx.status = 401
      ctx.body = { error: "API key is required" }
      return
    }

    const anthropic = new Anthropic({ apiKey })
    let availableTools: any[] = []

    if (tools) {
      try {
        const discoveredTools = await mcpManager.discoverTools(sessionId)
        availableTools = discoveredTools.map((tool) => ({
          name: tool.name,
          description: `${tool.description || ""} (Rated ${tool.rating?.toFixed(1) || "0"}/5)`,
          input_schema: sanitizeInputSchema(tool.inputSchema),
          score: tool.rating || 0
        })).sort((a, b) => (b.score || 0) - (a.score || 0))
          .map(({ score, ...tool }) => tool)
      } catch (error) {
        console.error("Error discovering tools:", error)
      }
    }

    messages.unshift({
      role: "user",
      content: [{ type: "text", text: "Consider tool ratings when suggesting." }]
    })

    try {
      const completion = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        messages,
        tools: availableTools.length ? availableTools : undefined,
      })

      let serverUsed = null
      const toolUses = completion.content.filter((c) => c.type === "tool_use")
      let finalMessages = [...messages]
      const intermediateResponses = []

      if (toolUses.length > 0 && auto_proceed) {
        for (const toolUse of toolUses) {
          try {
            const result = await mcpManager.executeToolCall(sessionId, toolUse.name, toolUse.input)
            serverUsed = result.serverInfo || serverUsed
            finalMessages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: result.content }] })
          } catch (error) {
            console.error(`Tool execution error:`, error)
          }
        }
      }

      ctx.body = {
        ...completion,
        serverInfo: serverUsed,
        toolsUsed: toolUses.length > 0
      }
    } catch (error) {
      console.error("Error creating completion:", error)
      ctx.status = 500
      ctx.body = { error: error.message || "An error occurred during chat completion" }
    }
  })

  router.get("/api/tools", async ctx => {
    const sessionId = ensureSession((ctx.headers["x-session-id"] as string) || "")
    const tools = await mcpManager.discoverTools(sessionId)
    ctx.body = { tools }
  })

  router.post("/api/tools/execute", async ctx => {
    const { toolName, args } = ctx.request.body
    const sessionId = ensureSession((ctx.headers["x-session-id"] as string) || "")
    if (!toolName) {
      ctx.status = 400
      ctx.body = { error: "Tool name is required" }
      return
    }

    const result = await mcpManager.executeToolCall(sessionId, toolName, args || {})

    // Emit Socket.IO event
    if (ctx.io) {
      ctx.io.emit('tool_executed', { toolName, result })
    }

    ctx.body = result
  })

  router.get("/api/tools/credentials", async ctx => {
    const sessionId = ensureSession((ctx.headers["x-session-id"] as string) || "")
    const tools = mcpManager.getToolsWithCredentialRequirements(sessionId)
    ctx.body = { tools }
  })

  router.post("/api/tools/credentials", async ctx => {
    const { toolName, serverId, credentials } = ctx.request.body
    const sessionId = ensureSession((ctx.headers["x-session-id"] as string) || "")
    if (!toolName || !serverId || !credentials) {
      ctx.status = 400
      ctx.body = { error: "Missing required fields." }
      return
    }
    const success = await mcpManager.setToolCredentials(sessionId, toolName, serverId, credentials)
    ctx.body = { success }
  })

  router.post("/api/servers", async ctx => {
    const { id, name, url, description, types, tags, verified, rating = 0 } = ctx.request.body
    if (!id || !name || !url) {
      ctx.status = 400
      ctx.body = { error: "Missing required server fields" }
      return
    }
    const ratingInfo = await getWeightedRatingScore(id)
    const serverConfig = { id, name, url, description, types, tags, verified, rating: ratingInfo.average || rating }
    const success = await mcpManager.registerServer(serverConfig)
    ctx.body = { success }
  })

  router.get("/api/servers", ctx => {
    ctx.body = { servers: mcpManager.getAvailableServers() }
  })

  router.post("/api/registry/refresh", async ctx => {
    const registryClient = new RegistryClient()
    const servers = await registryClient.getPopularServers()
    ctx.body = { success: true, servers }
  })

  router.get("/api/registry/search", async ctx => {
    const query = ctx.query.q as string
    if (!query) {
      ctx.status = 400
      ctx.body = { error: "Search query required" }
      return
    }
    const registryClient = new RegistryClient()
    const servers = await registryClient.searchServers(query)
    ctx.body = { success: true, servers }
  })
}
