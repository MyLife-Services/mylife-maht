// server/src/registry/client.ts
import axios from "axios";
import { ServerConfig } from "../mcp/types.js";

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

// Interface for server configurations
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

// Global rate limit state
const globalRateLimitState = {
  isRateLimited: false,
  rateLimitResetTime: 0,
  rateLimitBackoff: 5 * 60 * 1000, // 5 minutes initial backoff
  consecutiveErrors: 0
};

// Helper function to implement retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelayMs = 1000
): Promise<T> {
  // Check if we're globally rate limited
  if (globalRateLimitState.isRateLimited && Date.now() < globalRateLimitState.rateLimitResetTime) {
    console.warn(`NANDA Registry API is currently rate limited. Waiting until ${new Date(globalRateLimitState.rateLimitResetTime).toISOString()}`);
    throw new Error(`Rate limited by NANDA Registry API until ${new Date(globalRateLimitState.rateLimitResetTime).toISOString()}`);
  }

  let currentDelay = initialDelayMs;
  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // If not the first attempt, log the retry
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${retries} after ${currentDelay}ms delay...`);
      }
      
      const result = await fn();
      
      // Reset consecutive errors on success
      if (globalRateLimitState.consecutiveErrors > 0) {
        globalRateLimitState.consecutiveErrors = 0;
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // If this is a rate limit error (429)
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        // Set global rate limit with exponential backoff
        globalRateLimitState.isRateLimited = true;
        globalRateLimitState.consecutiveErrors++;
        
        // Get retry-after header or use exponential backoff
        let retryAfter = 0;
        if (error.response.headers['retry-after']) {
          retryAfter = parseInt(error.response.headers['retry-after']) * 1000;
        } else {
          // Increase backoff time exponentially with consecutive errors (max 1 hour)
          retryAfter = Math.min(
            globalRateLimitState.rateLimitBackoff * Math.pow(2, globalRateLimitState.consecutiveErrors - 1),
            60 * 60 * 1000
          );
        }
        
        globalRateLimitState.rateLimitResetTime = Date.now() + retryAfter;
        console.warn(`Rate limited by NANDA Registry API. Backing off for ${retryAfter/1000} seconds until ${new Date(globalRateLimitState.rateLimitResetTime).toISOString()}`);
        
        // If we have retries left
        if (attempt < retries) {
          // Wait for the current delay
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          
          // Exponential backoff - double the delay for next attempt
          currentDelay *= 2;
          
          continue;
        }
      }
      // If this is a server error (5xx)
      else if (axios.isAxiosError(error) && error.response?.status && error.response.status >= 500) {
        // If we have retries left
        if (attempt < retries) {
          console.warn(`Request failed with status ${error.response.status}, retrying...`);
          
          // Wait for the current delay
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          
          // Exponential backoff - double the delay for next attempt
          currentDelay *= 2;
          
          continue;
        }
      }
      
      // If we're out of retries or it's not a retryable error, throw
      throw lastError;
    }
  }
  
  // This should never happen, but TypeScript wants a return value
  throw lastError;
}

export class RegistryClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = 'https://nanda-registry.com', apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Get popular servers from the registry
   */
  async getPopularServers(limit: number = 50): Promise<RegistryServer[]> {
    try {
      console.log(`Fetching popular servers from registry with limit ${limit}`);
      
      const fetchPopular = async () => {
        const response = await axios.get(`${this.baseUrl}/api/v1/discovery/popular/`, {
          params: { limit },
          headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}
        });
        return response.data;
      };
      
      // Use retry with backoff
      const data = await retryWithBackoff(fetchPopular, 3, 1000);
      
      console.log(`Registry returned data structure:`, Object.keys(data));
      return this.processServerResponse(data);
    } catch (error) {
      console.error('Error fetching popular servers from registry:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response status:', error.response?.status);
        console.error('Response headers:', error.response?.headers);
        if (error.response?.data) {
          console.error('Response data:', JSON.stringify(error.response.data).substring(0, 500));
        }
      }
      return [];
    }
  }

  async getAllServers(limit: number = 100): Promise<RegistryServer[]> {
    try {
      console.log("📡 Fetching all servers from /api/v1/servers/");
  
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }
      
      const fetchServers = async () => {
        const response = await axios.get(`${this.baseUrl}/api/v1/servers/`, {
          headers,
          params: { limit },
        });
        return response;
      };
      
      // Use retry with backoff
      const response = await retryWithBackoff(fetchServers, 3, 1000);
  
      const servers = response.data?.data || [];
      console.log(`/servers/ returned ${servers.length} servers`);
      return this.processServerResponse(servers);
    } catch (error) {
      console.error("Error fetching from /servers/ endpoint, falling back to /popular:", error);
      return [];
    }
  }

  /**
   * Search for servers in the registry
   */
  async searchServers(query: string, options: {
    limit?: number,
    page?: number,
    tags?: string,
    type?: string,
    verified?: boolean
  } = {}): Promise<RegistryServer[]> {
    try {
      console.log(`Searching registry for "${query}" with options:`, options);
      const response = await axios.get(`${this.baseUrl}/api/v1/discovery/search/`, {
        params: {
          q: query,
          limit: options.limit || 50,
          page: options.page || 1,
          tags: options.tags,
          type: options.type,
          verified: options.verified
        },
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}
      });
      
      console.log(`Registry search returned data structure:`, Object.keys(response.data));
      return this.processServerResponse(response.data);
    } catch (error) {
      console.error('Error searching servers in registry:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response status:', error.response?.status);
        console.error('Response headers:', error.response?.headers);
        if (error.response?.data) {
          console.error('Response data:', JSON.stringify(error.response.data).substring(0, 500));
        }
      }
      return [];
    }
  }


  //alyssa 
  async getServers(query?: string, options: any = {}): Promise<RegistryServer[]> {
    if (query) {
      const results = await this.searchServers(query, options);
      if (results.length > 0) {
        return results;
      }
    }
  
    // Try full /servers endpoint first
    const all = await this.getAllServers(options.limit);
    if (all.length > 0) return all;
  
    // Fall back to /popular if needed
    return this.getPopularServers(options.limit);
  }

  /**
   * Process and format server response from registry
   */
  private processServerResponse(data: any): RegistryServer[] {
    console.log("Processing server response");
    
    // Check if data is empty
    if (!data) {
      console.warn('Empty response from registry');
      return [];
    }
    
    // Check if the response has a data property (actual response format)
    if (data.data && Array.isArray(data.data)) {
      console.log(`Found ${data.data.length} servers in data property`);
      return data.data
        .filter(server => server && server.id && server.name && server.url)
        .map(this.formatServerData);
    }
    
    // Check for pagination structure in search results
    if (data.pagination && data.data && Array.isArray(data.data)) {
      console.log(`Found ${data.data.length} servers in paginated data`);
      return data.data
        .filter(server => server && server.id && server.name && server.url)
        .map(this.formatServerData);
    }
    
    // Check if the response is already an array
    if (Array.isArray(data)) {
      console.log(`Found ${data.length} servers in direct array`);
      return data
        .filter(server => server && server.id && server.name && server.url)
        .map(this.formatServerData);
    }
    
    // If we can't identify the structure, log and return empty array
    console.warn('Unknown response format from registry:', JSON.stringify(data).substring(0, 200));
    return [];
  }
  
  /**
   * Format server data consistently
   */
  private formatServerData = (server: any): RegistryServer => {
    let url = server.url;
    
    // Clean URL (remove trailing slashes)
    if (url && url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    
    // Ensure the URL has /sse suffix for MCP compatibility
    if (url && !url.endsWith('/sse')) {
      url = `${url}/sse`;
    }
    
    return {
      id: server.id,
      name: server.name,
      url,
      description: server.description,
      types: server.types,
      tags: server.tags,
      verified: server.verified,
      rating: server.rating
    };
  }

  /**
   * Fetches details for a specific server
   */
  async getServerDetails(serverId: string): Promise<any> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const response = await axios.get(
        `${this.baseUrl}/api/v1/servers/${serverId}/`,
        {
          headers,
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Error fetching server details for ${serverId}:`, error);
      return null;
    }
  }
}
