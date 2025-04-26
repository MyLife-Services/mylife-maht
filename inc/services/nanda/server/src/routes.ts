// server/src/routes.ts
import axios from "axios";
import { Express, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { McpManager } from "./mcp/manager.js";
import { RegistryClient } from "./registry/client.js";

// Add a helper function to sanitize input schemas for Anthropic
function sanitizeInputSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }
  
  // Create a copy of the schema
  const sanitizedSchema = { ...schema };
  
  // Remove oneOf, allOf, anyOf at the top level
  delete sanitizedSchema.oneOf;
  delete sanitizedSchema.allOf;
  delete sanitizedSchema.anyOf;
  
  // If we removed these operators, provide a basic schema structure
  // This ensures we don't send an empty schema
  if (Object.keys(sanitizedSchema).length === 0 || 
      (schema.oneOf !== undefined || schema.allOf !== undefined || schema.anyOf !== undefined)) {
    return {
      type: "object",
      properties: {},
      description: schema.description || "Input for this tool"
    };
  }
  
  return sanitizedSchema;
}

// Cache for server ratings
const ratingsCache = new Map<string, {
  data: { average: number, count: number, score: number },
  timestamp: number
}>();
const RATINGS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (increased from 30 minutes)

// Track rate limit status to avoid hitting limits repeatedly
const ratingApiState = {
  isRateLimited: false,
  rateLimitResetTime: 0,
  rateLimitBackoff: 5 * 60 * 1000, // 5 minutes initial backoff
  consecutiveErrors: 0
};

async function getWeightedRatingScore(serverId: string): Promise<{ average: number, count: number, score: number }> {
  try {
    // Check if we're currently rate limited
    if (ratingApiState.isRateLimited && Date.now() < ratingApiState.rateLimitResetTime) {
      console.log(`Rating API is rate limited, waiting until ${new Date(ratingApiState.rateLimitResetTime).toISOString()}`);
      
      // Use cached data if available
      const cached = ratingsCache.get(serverId);
      if (cached) {
        console.log(`Using cached ratings for server ${serverId} due to rate limiting`);
        return cached.data;
      }
      
      // If no cache, return default values during rate limit
      return { average: 0, count: 0, score: 0 };
    }
    
    // Check if we have cached data that's not expired
    const cached = ratingsCache.get(serverId);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < RATINGS_CACHE_TTL) {
      console.log(`Using cached ratings for server ${serverId}`);
      return cached.data;
    }
    
    // If not in cache or expired, fetch from API
    console.log(`Fetching ratings for server ${serverId}`);
    const response = await axios.get(`https://nanda-registry.com/api/v1/servers/${serverId}/ratings`);
    
    // Reset rate limit state on successful request
    ratingApiState.isRateLimited = false;
    ratingApiState.consecutiveErrors = 0;
    
    const ratings = response.data?.data || [];

    const count = ratings.length;
    const total = ratings.reduce((sum: number, r: any) => sum + r.rating, 0);
    const average = count > 0 ? total / count : 0;
    const score = average * count;

    const result = { average, count, score };
    
    // Cache the result
    ratingsCache.set(serverId, {
      data: result,
      timestamp: now
    });

    return result;
  } catch (error) {
    console.error(`Failed to fetch ratings for server ${serverId}:`, error);
    
    // Check for rate limit error (429)
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      // Set rate limit state with exponential backoff
      ratingApiState.isRateLimited = true;
      ratingApiState.consecutiveErrors++;
      
      // Increase backoff time exponentially with consecutive errors (max 1 hour)
      const backoffTime = Math.min(
        ratingApiState.rateLimitBackoff * Math.pow(2, ratingApiState.consecutiveErrors - 1),
        60 * 60 * 1000
      );
      
      ratingApiState.rateLimitResetTime = Date.now() + backoffTime;
      console.warn(`Rate limited by ratings API. Backing off for ${backoffTime/1000} seconds until ${new Date(ratingApiState.rateLimitResetTime).toISOString()}`);
    }
    
    // If we have cached data, use it even if expired
    const cached = ratingsCache.get(serverId);
    if (cached) {
      console.log(`Using expired cached ratings for server ${serverId} due to fetch error`);
      return cached.data;
    }
    
    // Default values if no cached data available
    return { average: 0, count: 0, score: 0 };
  }
}

export function setupRoutes(app: Express, mcpManager: McpManager): void {
  // Health check endpoint for deployment
  app.get("/api/healthcheck", (req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  // Session endpoint
  app.post("/api/session", (req: Request, res: Response) => {
    console.log("API: /api/session called");
    // Create a real session using sessionManager
    const sessionManager = mcpManager.getSessionManager();
    if (!sessionManager) {
      console.error("Cannot create session: SessionManager not available");
      return res.status(500).json({ error: "Session manager not available" });
    }
    
    const sessionId = sessionManager.createSession();
    console.log(`Created new session with ID: ${sessionId}`);
    res.status(200).json({ sessionId });
  });

  // API key endpoint
  app.post("/api/settings/apikey", (req: Request, res: Response) => {
    console.log("API: /api/settings/apikey called");
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: "API key is required" });
    }

    // We would store this with the session manager
    // For now, we'll just acknowledge it
    res.status(200).json({ success: true });
  });

  // Helper function to ensure session exists
  const ensureSession = (sessionId: string): string => {
    if (!sessionId) {
      console.log("No session ID provided, creating new session");
      return mcpManager.getSessionManager().createSession();
    }
    
    // Use getOrCreateSession to handle the session
    mcpManager.getSessionManager().getOrCreateSession(sessionId);
    return sessionId;
  };

  // Update the chat completion endpoint to ensure session
  app.post("/api/chat/completions", async (req: Request, res: Response) => {
    console.log("API: /api/chat/completions called");
    const { messages, tools = true, auto_proceed = true } = req.body;
    const apiKey = req.headers["x-api-key"] as string;
    const rawSessionId = (req.headers["x-session-id"] as string) || "";
    
    // Ensure we have a valid session
    const sessionId = ensureSession(rawSessionId);
    
    // If the session ID changed, let the client know
    if (sessionId !== rawSessionId) {
      console.log(`Using new session ID: ${sessionId} (original was: ${rawSessionId || "empty"})`);
    }

    if (!apiKey) {
      return res.status(401).json({ error: "API key is required" });
    }

    try {
      const anthropic = new Anthropic({
        apiKey,
      });

      //Mapping ratings to natural langauge
      const ratingTextMap = {
        1: "terrible",
        2: "poorly rated",
        3: "average",
        4: "good",
        5: "excellent",
      };

      // Fetch available tools if enabled
      let availableTools: Array<{
        name: string;
        description: string;
        input_schema: any;
        score?: number
      }> = [];
      if (tools) {
        try {
          const discoveredTools = await mcpManager.discoverTools(sessionId);

          // Use existing rating from tool info instead of fetching for every tool
          availableTools = discoveredTools.map((tool) => {
            // Use the server rating that's already included in the tool info
            const rating = tool.rating || 0;
            const ratingLabel = ratingTextMap[Math.round(rating) || 0] || "unrated";
          
            const enhancedDescription = `${tool.description || ""} 
            (This tool runs on a ${ratingLabel} server with a ${rating.toFixed(1)}/5 rating.)`;
          
            // Sanitize the input schema before passing it to Anthropic
            const sanitizedInputSchema = sanitizeInputSchema(tool.inputSchema);
            
            return {
              name: tool.name,
              description: enhancedDescription,
              input_schema: sanitizedInputSchema,
              score: rating, // Use simple rating for sorting
            };
          });
          
          // Sort by rating descending
          availableTools.sort((a, b) => (b.score || 0) - (a.score || 0));
          
          // Remove score field before sending to Claude
          availableTools = availableTools.map(({ score, ...tool }) => tool);

          // Preparing Claude to prefer higher rated tools 
          messages.unshift({
            role: "user",
            content: [
              {
                type: "text",
                text: "Hello! I'm here to help you with tools from various servers. When suggesting tools, I'll consider their ratings to provide you with the most reliable options. Tools with higher ratings are generally more trusted by the community.",
              },
            ],
          });

        } catch (error) {
          console.error("Error discovering tools:", error);
          // Continue without tools if there's an error
        }
      }

      // Create completion request
      const completion = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        messages,
        tools: availableTools.length > 0 ? availableTools : undefined,
      });

      // Process tool calls if present
      const finalMessages = [...messages];
      let finalResponse = completion;
      let serverUsed = null;
      
      // Properly type the intermediate responses array
      interface IntermediateResponse {
        role: string;
        content: any;  // Using 'any' to accommodate different Anthropic response content types
        timestamp: Date;
      }
      let intermediateResponses: IntermediateResponse[] = [];

      // Check if there are any tool calls in the response
      const toolUses = completion.content.filter((c) => c.type === "tool_use");

      if (toolUses.length > 0 && auto_proceed) {
        // Add the assistant's initial response with tool calls
        finalMessages.push({
          role: "assistant",
          content: completion.content
        });
        
        // Add the initial response to intermediate responses
        intermediateResponses.push({
          role: "assistant",
          content: completion.content.filter(c => c.type === "text"),
          timestamp: new Date(),
        });

        // Process each tool call
        for (const toolUse of toolUses) {
          try {
            console.log(`Executing tool call: ${toolUse.name} with input:`, JSON.stringify(toolUse.input));
            
            // Execute the tool and get the server that was used
            const result = await mcpManager.executeToolCall(
              sessionId,
              toolUse.name,
              toolUse.input
            );
            
            // Capture server info if available
            if (result.serverInfo) {
              serverUsed = result.serverInfo;
            }

            console.log(`Tool result for ${toolUse.name}:`, JSON.stringify(result.content));
            
            // Add the tool result to the messages
            finalMessages.push({
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: result.content.map((c: any) => {
                    if (c.type === "text") {
                      console.log(`Tool ${toolUse.name} text response:`, c.text);
                      return {
                        type: "text",
                        text: c.text,
                      };
                    }
                    return c;
                  }),
                },
              ],
            });

            // Get an intermediate response after each tool execution
            const intermediateCompletion = await anthropic.messages.create({
              model: "claude-3-5-sonnet-20241022",
              max_tokens: 4000,
              messages: finalMessages,
            });

            // Add intermediate response
            intermediateResponses.push({
              role: "assistant",
              content: intermediateCompletion.content,
              timestamp: new Date(),
            });

          } catch (error) {
            console.error(`Error executing tool ${toolUse.name}:`, error);

            // Add a tool error result
            finalMessages.push({
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: [
                    {
                      type: "text",
                      text: `Error executing tool: ${
                        error.message || "Unknown error"
                      }`,
                    },
                  ],
                },
              ],
            });
          }
        }

        try {
          // Get a final completion with all the tool results
          finalResponse = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4000,
            messages: finalMessages,
          });
        } catch (error) {
          console.error("Error creating final response:", error);
          // If we can't get a final response, use the last intermediate response
          if (intermediateResponses.length > 0) {
            const lastIntermediate = intermediateResponses[intermediateResponses.length - 1];
            // Create a response with the same structure as what Anthropic would return
            finalResponse = {
              id: completion.id,
              content: lastIntermediate.content,
              model: completion.model,
              role: "assistant",
              stop_reason: completion.stop_reason,
              stop_sequence: completion.stop_sequence,
              type: completion.type,
              usage: completion.usage
            };
          }
        }
      }

      // Add server info to the response
      const responseWithServerInfo = {
        ...finalResponse,
        serverInfo: serverUsed,
        requires_confirmation: !auto_proceed && toolUses.length > 0,
        intermediateResponses: intermediateResponses,
        toolsUsed: toolUses.length > 0
      };

      res.status(200).json(responseWithServerInfo);
    } catch (error) {
      console.error("Error creating chat completion:", error);
      res.status(500).json({
        error:
          error.message || "An error occurred while processing your request",
      });
    }
  });

  // Tool discovery endpoint
  app.get("/api/tools", async (req: Request, res: Response) => {
    console.log("API: /api/tools called");
    try {
      const rawSessionId = (req.headers["x-session-id"] as string) || "";
      const sessionId = ensureSession(rawSessionId);
      const tools = await mcpManager.discoverTools(sessionId);
      res.status(200).json({ tools });
    } catch (error) {
      console.error("Error discovering tools:", error);
      res.status(500).json({
        error: error.message || "An error occurred while discovering tools",
      });
    }
  });

  // Tool execution endpoint
  app.post("/api/tools/execute", async (req: Request, res: Response) => {
    console.log("API: /api/tools/execute called");
    const { toolName, args } = req.body;
    const rawSessionId = (req.headers["x-session-id"] as string) || "";
    const sessionId = ensureSession(rawSessionId);

    if (!toolName) {
      return res.status(400).json({ error: "Tool name is required" });
    }

    // Add enhanced logging
    console.log(`🛠️ Executing tool: ${toolName}`);
    console.log(`📋 Session ID: ${sessionId}`);
    console.log(`📝 Args: ${JSON.stringify(args, (key, value) => {
      // Don't log credentials in full
      if (key === "__credentials") {
        return "[CREDENTIALS REDACTED]";
      }
      return value;
    })}`);

    try {
      const result = await mcpManager.executeToolCall(
        sessionId,
        toolName,
        args || {}
      );
      
      // Get server info for the socket event
      const serverInfo = result.serverInfo || {};
      
      // Log server info
      console.log(`Server info for tool ${toolName}:`, serverInfo);
      
      // Emit a socket event with the tool execution result
      if (req.app.get('io')) {
        const io = req.app.get('io');
        console.log('Emitting tool_executed event via socket.io');
        
        const eventData = {
          toolName,
          serverId: serverInfo.id || 'unknown',
          serverName: serverInfo.name || 'Unknown Server',
          result: {
            content: result.content || [],
            isError: false
          }
        };
        
        console.log('Event data:', JSON.stringify(eventData));
        io.emit('tool_executed', eventData);
        console.log(`Socket event emitted for tool: ${toolName}`);
      } else {
        console.warn('Socket.io not available for emitting events');
      }
      
      console.log(`✅ Tool ${toolName} executed successfully`);
      res.status(200).json(result);
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      
      // Emit error event via socket
      if (req.app.get('io')) {
        const io = req.app.get('io');
        console.log('Emitting tool_executed error event via socket.io');
        
        const errorEventData = {
          toolName,
          serverId: 'unknown',
          serverName: 'Error',
          result: {
            content: [{ type: 'text', text: `Error: ${error.message || 'Unknown error'}` }],
            isError: true
          }
        };
        
        console.log('Error event data:', JSON.stringify(errorEventData));
        io.emit('tool_executed', errorEventData);
        console.log(`Socket error event emitted for tool: ${toolName}`);
      }
      
      res.status(500).json({
        error: error.message || "An error occurred while executing the tool",
      });
    }
  });

  // Get tools that require credentials
  app.get("/api/tools/credentials", (req: Request, res: Response) => {
    console.log("API: /api/tools/credentials called with headers:", JSON.stringify(req.headers));
    try {
      const rawSessionId = (req.headers["x-session-id"] as string) || "";
      const sessionId = ensureSession(rawSessionId);
      console.log(`API: /api/tools/credentials using sessionId: ${sessionId}`);
      const tools = mcpManager.getToolsWithCredentialRequirements(sessionId);
      console.log(`API: /api/tools/credentials found ${tools.length} tools requiring credentials`);
      res.status(200).json({ tools });
    } catch (error) {
      console.error("Error getting tools with credential requirements:", error);
      res.status(500).json({
        error: error.message || "An error occurred while fetching tools",
      });
    }
  });

  // Set credentials for a tool
  app.post("/api/tools/credentials", async (req: Request, res: Response) => {
    console.log("API: /api/tools/credentials POST called");
    const { toolName, serverId, credentials } = req.body;
    const rawSessionId = (req.headers["x-session-id"] as string) || "";
    const sessionId = ensureSession(rawSessionId);

    if (!toolName || !serverId || !credentials) {
      return res.status(400).json({ 
        error: "Missing required fields. toolName, serverId, and credentials are required" 
      });
    }

    try {
      const success = await mcpManager.setToolCredentials(
        sessionId,
        toolName,
        serverId,
        credentials
      );

      if (success) {
        res.status(200).json({ success: true });
      } else {
        res.status(500).json({ 
          error: "Failed to set credentials for the tool" 
        });
      }
    } catch (error) {
      console.error(`Error setting credentials for tool ${toolName}:`, error);
      res.status(500).json({
        error: error.message || "An error occurred while setting credentials",
      });
    }
  });

  // Server registration endpoint
  app.post("/api/servers", async (req: Request, res: Response) => {
    console.log("API: /api/servers POST called with body:", JSON.stringify(req.body));
    const { id, name, url, description, types, tags, verified, rating = 0 } = req.body;

    if (!id || !name || !url) {
      return res
        .status(400)
        .json({ error: "Missing required server configuration fields" });
    }

    try {
      // Try to get detailed rating, but don't fail if we can't
      let ratingInfo = { average: rating, count: 0, score: 0 };
      
      try {
        ratingInfo = await getWeightedRatingScore(id);
        console.log(`📊 Server rating summary for ${name}: avg=${ratingInfo.average}, votes=${ratingInfo.count}, score=${ratingInfo.score}`);
      } catch (ratingError) {
        console.warn(`Unable to fetch rating for ${name}, using provided rating ${rating}:`, ratingError);
      }

      // Use the server rating we just got or fall back to the provided rating
      const serverConfig = { 
        id, 
        name, 
        url, 
        description, 
        types, 
        tags, 
        verified,
        rating: ratingInfo.average || rating 
      };
      
      const success = await mcpManager.registerServer(serverConfig);

      if (success) {
        res.status(200).json({ success: true });
      } else {
        res.status(400).json({ success: false, message: "Failed to connect to server or discover tools" });
      }
    } catch (error) {
      console.error("Error registering server:", error);
      res.status(500).json({
        error:
          error.message || "An error occurred while registering the server",
      });
    }
  });

  // Get available servers endpoint
  app.get("/api/servers", (req: Request, res: Response) => {
    console.log("API: /api/servers GET called");
    const servers = mcpManager.getAvailableServers();
    res.status(200).json({ servers });
  });

  // Registry refresh endpoint
  app.post("/api/registry/refresh", async (req: Request, res: Response) => {
    console.log("API: /api/registry/refresh called");
    try {
      // Create registry client and fetch popular servers
      const registryClient = new RegistryClient();
      const servers = await registryClient.getPopularServers();
      
      console.log(`Fetched ${servers.length} popular servers from Nanda Registry`);
      
      res.status(200).json({ 
        success: true,
        servers,
        message: `Found ${servers.length} servers in the registry` 
      });
    } catch (error) {
      console.error("Error refreshing registry servers:", error);
      res.status(500).json({
        error: error.message || "An error occurred while refreshing registry servers"
      });
    }
  });

  // Registry search endpoint
  app.get("/api/registry/search", async (req: Request, res: Response) => {
    console.log("API: /api/registry/search called with query:", req.query);
    try {
      const query = req.query.q as string;
      
      if (!query) {
        return res.status(400).json({ 
          error: "Search query is required" 
        });
      }
      
      // Create registry client and search for servers
      const registryClient = new RegistryClient();
      const servers = await registryClient.searchServers(query, {
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        tags: req.query.tags as string,
        type: req.query.type as string,
        verified: req.query.verified ? req.query.verified === 'true' : undefined
      });
      
      console.log(`Found ${servers.length} servers matching query "${query}"`);
      
      res.status(200).json({ 
        success: true,
        servers,
        query,
        message: `Found ${servers.length} servers matching "${query}"` 
      });
    } catch (error) {
      console.error("Error searching registry servers:", error);
      res.status(500).json({
        error: error.message || "An error occurred while searching registry servers"
      });
    }
  });
}
