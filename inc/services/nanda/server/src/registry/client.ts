interface RegistryServerResponse {
  id: string
  name: string
  url: string
  description: string
  types: string[]
  tags: string[]
  verified: boolean
  rating: number
  uptime: number
  logo_url: string
}

export interface RegistryServer {
  id: string
  name: string
  url: string
  description?: string
  types?: string[]
  tags?: string[]
  verified?: boolean
  rating?: number
}

const globalRateLimitState = {
  isRateLimited: false,
  rateLimitResetTime: 0,
  rateLimitBackoff: 5 * 60 * 1000,
  consecutiveErrors: 0
}

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, initialDelayMs = 1000): Promise<T> {
  if (globalRateLimitState.isRateLimited && Date.now() < globalRateLimitState.rateLimitResetTime) {
    throw new Error(`Rate limited until ${new Date(globalRateLimitState.rateLimitResetTime).toISOString()}`)
  }

  let currentDelay = initialDelayMs
  let lastError: any

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.warn(`Retrying (${attempt}/${retries})...`)
      }
      return await fn()
    } catch (error: any) {
      lastError = error
      const status = error?.status || 0

      if (status === 429) {
        globalRateLimitState.isRateLimited = true
        globalRateLimitState.consecutiveErrors++
        const retryAfter = Math.min(globalRateLimitState.rateLimitBackoff * 2 ** (globalRateLimitState.consecutiveErrors - 1), 60 * 60 * 1000)
        globalRateLimitState.rateLimitResetTime = Date.now() + retryAfter
        await new Promise(resolve => setTimeout(resolve, currentDelay))
        currentDelay *= 2
      } else if (status >= 500) {
        await new Promise(resolve => setTimeout(resolve, currentDelay))
        currentDelay *= 2
      } else {
        throw error
      }
    }
  }

  throw lastError
}

export class RegistryClient {
  private baseUrl: string
  private apiKey?: string

  constructor(baseUrl = 'https://nanda-registry.com', apiKey?: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  async getPopularServers(limit = 50): Promise<RegistryServer[]> {
    return this.request(`/api/v1/discovery/popular/?limit=${limit}`)
  }

  async getAllServers(limit = 100): Promise<RegistryServer[]> {
    return this.request(`/api/v1/servers/?limit=${limit}`)
  }

  async searchServers(query: string, options: { limit?: number, page?: number, tags?: string, type?: string, verified?: boolean } = {}): Promise<RegistryServer[]> {
    const params = new URLSearchParams()
    params.set('q', query)
    if (options.limit) params.set('limit', String(options.limit))
    if (options.page) params.set('page', String(options.page))
    if (options.tags) params.set('tags', options.tags)
    if (options.type) params.set('type', options.type)
    if (typeof options.verified === 'boolean') params.set('verified', options.verified ? 'true' : 'false')

    return this.request(`/api/v1/discovery/search/?${params.toString()}`)
  }

  async getServers(query?: string, options: any = {}): Promise<RegistryServer[]> {
    if (query) {
      const results = await this.searchServers(query, options)
      if (results.length > 0) return results
    }
    const all = await this.getAllServers(options.limit)
    if (all.length > 0) return all
    return this.getPopularServers(options.limit)
  }

  async getServerDetails(serverId: string): Promise<any> {
    return this.request(`/api/v1/servers/${serverId}/`)
  }

  private async request(endpoint: string): Promise<RegistryServer[]> {
    const headers: Record<string, string> = {}
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const fetchRequest = async () => {
      const response = await fetch(`${this.baseUrl}${endpoint}`, { headers })

      if (!response.ok) {
        const error = new Error(`Request failed with status ${response.status}`)
        ;(error as any).status = response.status
        throw error
      }

      const data = await response.json()
      return this.processServerResponse(data)
    }

    return retryWithBackoff(fetchRequest, 3, 1000)
  }

  private processServerResponse(data: any): RegistryServer[] {
    if (!data) {
      console.warn('Empty response')
      return []
    }

    const rawList = data?.data ?? data

    if (!Array.isArray(rawList)) {
      console.warn('Unexpected response:', JSON.stringify(data).slice(0, 300))
      return []
    }

    return rawList
      .filter(server => server && server.id && server.name && server.url)
      .map(server => {
        let url = server.url
        if (url.endsWith('/')) url = url.slice(0, -1)
        if (!url.endsWith('/sse')) url += '/sse'

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
      })
  }
}
