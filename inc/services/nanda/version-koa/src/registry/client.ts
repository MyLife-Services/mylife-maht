import { ServerConfig } from "../mcp/types.js"

interface RegistryConfig {
  url: string;
  apiKey?: string;
}

interface RegistryServerResponse {
  id: string;
  name: string;
  url: string;
  description: string;
  types: string[];
  tags: string[];
  verified: boolean;
  rating: number;
  uptime: number;
  logo_url: string;
}

export interface RegistryServer {
  id: string;
  name: string;
  url: string;
  description?: string;
  types?: string[];
  tags?: string[];
  verified?: boolean;
  rating?: number;
}

const globalRateLimitState = {
  isRateLimited: false,
  rateLimitResetTime: 0,
  rateLimitBackoff: 5 * 60 * 1000,
  consecutiveErrors: 0
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelayMs = 1000
): Promise<T> {
  if (globalRateLimitState.isRateLimited && Date.now() < globalRateLimitState.rateLimitResetTime) {
    console.warn(`Registry API rate limited. Retry after ${new Date(globalRateLimitState.rateLimitResetTime).toISOString()}`)
    throw new Error(`Rate limited until ${new Date(globalRateLimitState.rateLimitResetTime).toISOString()}`)
  }

  let currentDelay = initialDelayMs
  let lastError: any

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) console.log(`Retry attempt ${attempt}/${retries} after ${currentDelay}ms delay...`)
      const result = await fn()
      globalRateLimitState.consecutiveErrors = 0
      return result
    } catch (error: any) {
      lastError = error

      if (error.status === 429) {
        globalRateLimitState.isRateLimited = true
        globalRateLimitState.consecutiveErrors++

        const retryAfter = error.retryAfter
          ? error.retryAfter * 1000
          : Math.min(globalRateLimitState.rateLimitBackoff * (2 ** (globalRateLimitState.consecutiveErrors - 1)), 60 * 60 * 1000)

        globalRateLimitState.rateLimitResetTime = Date.now() + retryAfter
        console.warn(`Rate limited. Backing off ${retryAfter / 1000}s until ${new Date(globalRateLimitState.rateLimitResetTime).toISOString()}`)

        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, currentDelay))
          currentDelay *= 2
          continue
        }
      } else if (error.status && error.status >= 500) {
        if (attempt < retries) {
          console.warn(`Server error ${error.status}. Retrying...`)
          await new Promise(resolve => setTimeout(resolve, currentDelay))
          currentDelay *= 2
          continue
        }
      }

      throw lastError
    }
  }

  throw lastError
}

export class RegistryClient {
  private baseUrl: string
  private apiKey?: string

  constructor(baseUrl: string = 'https://nanda-registry.com', apiKey?: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  private async fetchJson(url: string, params?: Record<string, any>): Promise<any> {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    const headers: Record<string, string> = this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}

    const res = await fetch(`${url}${query}`, { headers })

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '0')
      const error = new Error('Rate Limited') as any
      error.status = 429
      error.retryAfter = retryAfter
      throw error
    }

    if (!res.ok) {
      const error = new Error(`HTTP ${res.status}`) as any
      error.status = res.status
      throw error
    }

    return res.json()
  }

  async getPopularServers(limit: number = 50): Promise<RegistryServer[]> {
    console.log(`Fetching popular servers with limit ${limit}`)
    const fetchPopular = () => this.fetchJson(`${this.baseUrl}/api/v1/discovery/popular/`, { limit })
    const data = await retryWithBackoff(fetchPopular, 3, 1000)
    return this.processServerResponse(data)
  }

  async getAllServers(limit: number = 100): Promise<RegistryServer[]> {
    console.log("Fetching all servers")
    const fetchAll = () => this.fetchJson(`${this.baseUrl}/api/v1/servers/`, { limit })
    const data = await retryWithBackoff(fetchAll, 3, 1000)
    return this.processServerResponse(data?.data || [])
  }

  async searchServers(query: string, options: {
    limit?: number,
    page?: number,
    tags?: string,
    type?: string,
    verified?: boolean
  } = {}): Promise<RegistryServer[]> {
    console.log(`Searching registry for "${query}"`, options)
    const params = {
      q: query,
      limit: options.limit || 50,
      page: options.page || 1,
      tags: options.tags,
      type: options.type,
      verified: options.verified
    }
    const data = await this.fetchJson(`${this.baseUrl}/api/v1/discovery/search/`, params)
    return this.processServerResponse(data)
  }

  async getServers(query?: string, options: any = {}): Promise<RegistryServer[]> {
    if (query) {
      const results = await this.searchServers(query, options)
      if (results.length) return results
    }

    const all = await this.getAllServers(options.limit)
    if (all.length) return all

    return this.getPopularServers(options.limit)
  }

  private processServerResponse(data: any): RegistryServer[] {
    if (!data) return []
    const servers = Array.isArray(data) ? data : data.data || []
    return servers
      .filter((s: any) => s && s.id && s.name && s.url)
      .map(this.formatServerData)
  }

  private formatServerData(server: any): RegistryServer {
    let url = server.url?.endsWith('/') ? server.url.slice(0, -1) : server.url
    if (url && !url.endsWith('/sse')) url += '/sse'
    return {
      id: server.id,
      name: server.name,
      url,
      description: server.description,
      types: server.types,
      tags: server.tags,
      verified: server.verified,
      rating: server.rating
    }
  }

  async getServerDetails(serverId: string): Promise<any> {
    try {
      return await this.fetchJson(`${this.baseUrl}/api/v1/servers/${serverId}/`)
    } catch (error) {
      console.error(`Error fetching server details for ${serverId}:`, error)
      return null
    }
  }
}
