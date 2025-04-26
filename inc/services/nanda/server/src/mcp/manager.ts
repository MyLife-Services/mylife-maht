// server/src/mcp/manager.ts
import { Server as SocketIoServer } from "socket.io";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ToolRegistry } from "./toolRegistry.js";
import { SessionManager } from "./sessionManager.js";
import { ToolInfo, CredentialRequirement, ServerConfig } from "./types.js";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { RegistryClient } from "../registry/client.js";

// Disable server-side persistence - we'll use browser-based storage instead
// const STORAGE_DIR = process.env.MCP_STORAGE_DIR || path.join(process.cwd(), 'storage');
// const SERVERS_FILE = path.join(STORAGE_DIR, 'servers.json');

// // Ensure the storage directory exists
// if (!fs.existsSync(STORAGE_DIR)) {
//   fs.mkdirSync(STORAGE_DIR, { recursive: true });
// }

// // Create servers file if it doesn't exist - with empty array
// if (!fs.existsSync(SERVERS_FILE)) {
//   fs.writeFileSync(SERVERS_FILE, JSON.stringify([], null, 2));
// }

// // Ensure the file is only readable by the server process
// try {
//   fs.chmodSync(SERVERS_FILE, 0o600);
// } catch (error) {
//   console.warn('Unable to set file permissions, server configuration may not be secure');
// }

// Disable loading servers from file - rely on client registrations only
const loadServers = (): ServerConfig[] => {
  // Comment out file loading
  // try {
  //   const data = fs.readFileSync(SERVERS_FILE, 'utf8');
  //   return JSON.parse(data);
  // } catch (error) {
  //   console.error('Error loading servers:', error);
  //   return [];
  // }
  return []; // Return empty array - no pre-loaded servers
};

// Disable saving servers to file
const saveServers = (servers: ServerConfig[]) => {
  // Comment out file saving
  // try {
  //   fs.writeFileSync(SERVERS_FILE, JSON.stringify(servers, null, 2));
  // } catch (error) {
  //   console.error('Error saving servers:', error);
  // }
  // No-op - we don't save servers anymore
};

// Local type declarations instead of importing from shared
// Remove local type declarations since we're importing them now

interface ToolCredentialInfo {
  toolName: string;
  serverName: string;
  serverId: string;
  credentials: CredentialRequirement[];
}

export interface McpManager {
  discoverTools: (sessionId: string) => Promise<ToolInfo[]>;
  executeToolCall: (
    sessionId: string,
    toolName: string,
    args: any
  ) => Promise<any>;
  registerServer: (serverConfig: ServerConfig) => Promise<boolean>;
  getAvailableServers: () => ServerConfig[];
  getToolsWithCredentialRequirements: (sessionId: string) => ToolCredentialInfo[];
  setToolCredentials: (
    sessionId: string, 
    toolName: string, 
    serverId: string, 
    credentials: Record<string, string>
  ) => Promise<boolean>;
  cleanup: () => Promise<void>;
  getSessionManager: () => SessionManager;
  fetchRegistryServers: () => Promise<ServerConfig[]>;
}

// Remove local ServerConfig interface

// Rate limiting data structures
interface RateLimitInfo {
  lastRequestTime: number;
  requestCount: number;
  isProcessing: boolean;
  queue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
    toolName: string;
    sessionId: string;
    args: any;
  }>;
}

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  // Maximum requests per minute to a server
  requestsPerMinute: 10,
  // Minimum time between requests in ms (100ms = 0.1s)
  minRequestSpacing: 500,
  // Maximum queue length per server
  maxQueueLength: 50,
};

export function setupMcpManager(io?: SocketIoServer): McpManager {
  console.log("--- McpManager setup initiated ---");
  
  // Registry to keep track of available MCP tools
  const toolRegistry = new ToolRegistry();

  // Session manager to handle client sessions
  const sessionManager = new SessionManager();

  // Available server configurations - start with empty array
  const servers: ServerConfig[] = [];

  // Cache of connected clients
  const connectedClients: Map<string, Client> = new Map();

  // Track rate limit information for each server
  const rateLimits = new Map<string, RateLimitInfo>();

  // Create a registry client instance
  const registryClient = new RegistryClient(process.env.REGISTRY_URL || "https://nanda-registry.com", process.env.REGISTRY_API_KEY);

  // Registry cache settings
  const registryCache = {
    servers: [] as ServerConfig[],
    lastFetched: 0,
    expiryMs: 60 * 60 * 1000, // 1 hour cache expiry
    isValid: function() {
      return this.servers.length > 0 && 
             (Date.now() - this.lastFetched) < this.expiryMs;
    },
    update: function(servers: ServerConfig[]) {
      this.servers = servers;
      this.lastFetched = Date.now();
      console.log(`Updated registry cache with ${servers.length} servers at ${new Date().toISOString()}`);
    }
  };

  const registerServer = async (serverConfig: ServerConfig): Promise<boolean> => {
    try {
      console.log(`Registering server: ${JSON.stringify(serverConfig)}`);
      
      // Initialize rate limit tracking for this server if it doesn't exist
      if (!rateLimits.has(serverConfig.id)) {
        rateLimits.set(serverConfig.id, {
          lastRequestTime: 0,
          requestCount: 0,
          isProcessing: false,
          queue: []
        });
      }
      
      // If client already exists, just return
      if (connectedClients.has(serverConfig.id)) {
        console.log(`Already connected to server: ${serverConfig.id}`);
        return true;
      }
      
      // Check if this server already exists
      const existingIndex = servers.findIndex((s) => s.id === serverConfig.id);
      if (existingIndex !== -1) {
        servers[existingIndex] = serverConfig;
      } else {
        servers.push(serverConfig);
      }

      // Create MCP client for this server using SSE transport
      const sseUrl = new URL(serverConfig.url);
      
      // Use standard SSE transport with default timeout
      const transport = new SSEClientTransport(sseUrl);

      const client = new Client({
        name: "mcp-host",
        version: "1.0.0",
        // Set the timeout at the client level
        defaultTimeout: 300000, // 5 minutes timeout (increased from 3 minutes)
        // Add retry configuration
        retryConfig: {
          maxRetries: 5, // Increased from 3
          initialDelay: 2000, // Start with 2 seconds delay (increased from 1)
          maxDelay: 20000,    // Max 20 second delay (increased from 10)
          backoffFactor: 2    // Exponential backoff factor
        }
      });

      await client.connect(transport);
      console.log(`Successfully connected to server: ${serverConfig.id}`);

      // Fetch available tools from the server
      const toolsResult = await client.listTools();
      console.log(`Tools discovered: ${JSON.stringify(toolsResult?.tools?.map(t => t.name) || [])}`);

      // Ensure the server has tools
      if (!toolsResult?.tools || toolsResult.tools.length === 0) {
        throw new Error("No tools discovered on MCP server");
      }

      // Register tools in our registry
      toolRegistry.registerTools(
        serverConfig.id,
        serverConfig.name,
        serverConfig.rating ?? 0,
        client,
        toolsResult.tools
      );

      // Store the connected client for later use
      connectedClients.set(serverConfig.id, client);

      console.log(
        `Registered server ${serverConfig.name} with ${
          toolsResult?.tools?.length
        } tools`
      );

      // Successful Registration
      return true;
    } catch (error) {
      console.error(
        `Failed to register server ${serverConfig.name}:`,
        error
      );

      // Clean up in-memory state
      const index = servers.findIndex((s) => s.id === serverConfig.id);
      if (index !== -1) {
        servers.splice(index, 1);
      }

      // Failed registration
      return false;
    }
  };

  // Discover all available tools for a session
  const discoverTools = async (sessionId: string): Promise<ToolInfo[]> => {
    // Get all tools from the registry
    const tools = toolRegistry.getAllTools();
    
    // For each tool, check if we have stored credentials and modify schemas accordingly
    const modifiedTools = tools.map(toolInfo => {
      const { serverId='', name } = toolInfo;
      
      // Only process tools with credential requirements
      if (toolInfo.credentialRequirements && toolInfo.credentialRequirements.length > 0) {
        // Check if we have stored credentials for this tool
        const credentials = sessionManager.getToolCredentials(sessionId, name, serverId);
        
        if (credentials) {
          console.log(`🔑 Modifying schema for tool ${name} to mark credentials as optional since they are stored`);
          
          // Create a copy of the tool info to modify
          const modifiedTool = { ...toolInfo };
          
          // If the tool has inputSchema, create a modified version
          if (modifiedTool.inputSchema) {
            // Create a deep copy of the input schema
            const modifiedSchema = JSON.parse(JSON.stringify(modifiedTool.inputSchema));
            
            // If the schema has a __credentials property, mark it as not required
            if (modifiedSchema.properties && modifiedSchema.properties.__credentials &&
                modifiedSchema.required && modifiedSchema.required.includes('__credentials')) {
              modifiedSchema.required = modifiedSchema.required.filter(req => req !== '__credentials');
            }
            
            // For common credential parameters like api_key, make them optional too
            if (modifiedSchema.required) {
              toolInfo.credentialRequirements.forEach(cred => {
                const credId = cred.id;
                if (modifiedSchema.required.includes(credId)) {
                  modifiedSchema.required = modifiedSchema.required.filter(req => req !== credId);
                }
              });
            }
            
            // Update the description to indicate credentials are auto-injected
            if (credentials) {
              modifiedSchema.description = (modifiedSchema.description || '') + 
                ' (Credentials are automatically applied from your saved settings)';
              
              // For each credential parameter, add a hint in the description
              toolInfo.credentialRequirements.forEach(cred => {
                const credId = cred.id;
                if (modifiedSchema.properties[credId]) {
                  modifiedSchema.properties[credId].description = 
                    '✓ Using saved credential from your settings (you don\'t need to provide this)';
                }
              });
            }
            
            // Update the modified schema
            modifiedTool.inputSchema = modifiedSchema;
          }
          
          return modifiedTool;
        }
      }
      
      // Return the original tool info if no changes needed
      return toolInfo;
    });
    
    console.log(`Discovered tools for session ${sessionId}: ${JSON.stringify(modifiedTools.map(t => t.name))}`);
    return modifiedTools;
  };

  // Execute a tool call with rate limiting
  const executeToolCall = async (
    sessionId: string,
    toolName: string,
    args: any
  ): Promise<any> => {
    const toolInfo = toolRegistry.getToolInfo(toolName);
    if (!toolInfo) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const { serverId } = toolInfo;

    // Create rate limit info for this server if it doesn't exist
    if (!rateLimits.has(serverId)) {
      rateLimits.set(serverId, {
        lastRequestTime: 0,
        requestCount: 0,
        isProcessing: false,
        queue: [],
      });
    }

    const rateLimit = rateLimits.get(serverId);
    
    // Make sure rateLimit is defined
    if(!rateLimit){
      return {
        content: [
          {
            type: "text",
            text: `I'm sorry, but there was no default rate limit assigned to your server.`
          }
        ],
        serverInfo: {
          id: serverId,
          name: toolInfo.serverName || serverId,
          tool: toolName
        }
      };
    }

    // Check if we've exceeded the queue limit
    if (rateLimit.queue.length >= RATE_LIMIT_CONFIG.maxQueueLength) {
      return {
        content: [
          {
            type: "text",
            text: `I'm sorry, but there are too many pending requests to this server. Please try again later.`
          }
        ],
        serverInfo: {
          id: serverId,
          name: toolInfo.serverName || serverId,
          tool: toolName
        }
      };
    }
    
    // Add this request to the queue
    return new Promise((resolve, reject) => {
      rateLimit.queue.push({
        resolve,
        reject,
        toolName,
        sessionId,
        args,
      });
      
      // Start processing the queue if it's not already being processed
      processQueue(serverId);
    });
  };

  // Process queue for a server
  const processQueue = async (serverId: string) => {
    const rateLimit = rateLimits.get(serverId);
    if (!rateLimit || rateLimit.queue.length === 0 || rateLimit.isProcessing) {
      return;
    }

    rateLimit.isProcessing = true;

    try {
      // Calculate time to wait before next request
      const now = Date.now();
      const timeSinceLastRequest = now - rateLimit.lastRequestTime;
      const timeToWait = Math.max(0, RATE_LIMIT_CONFIG.minRequestSpacing - timeSinceLastRequest);

      if (timeToWait > 0) {
        await new Promise(resolve => setTimeout(resolve, timeToWait));
      }

      // Get the next request from the queue
      const nextRequest = rateLimit.queue.shift();
      if (!nextRequest) {
        rateLimit.isProcessing = false;
        return;
      }

      // Update rate limit info
      rateLimit.lastRequestTime = Date.now();
      rateLimit.requestCount++;

      // Execute the actual tool call
      const toolInfo = toolRegistry.getToolInfo(nextRequest.toolName);
      if (!toolInfo) {
        nextRequest.reject(new Error(`Tool ${nextRequest.toolName} not found`));
        rateLimit.isProcessing = false;
        setTimeout(() => processQueue(serverId), 0);
        return;
      }

      const { client, tool, serverId: toolServerId } = toolInfo;
      const maxRetries = 2;
      let retries = 0;
      let lastError: any = null;

      while (retries <= maxRetries) {
        try {
          // Check if the tool requires credentials
          const requiresCredentials = toolInfo.credentialRequirements && 
                                     toolInfo.credentialRequirements.length > 0;
          
          // Prepare args with credentials if needed
          let callArgs = {...nextRequest.args};
          
          if (requiresCredentials) {
            // Get credentials from session manager
            const credentials = sessionManager.getToolCredentials(
              nextRequest.sessionId,
              nextRequest.toolName,
              toolServerId
            );
            
            if (credentials) {
              console.log(`🔑 Using stored credentials for tool ${nextRequest.toolName}`);
              
              // Apply credentials to the args
              // Check credential requirement IDs to determine how to inject credentials
              toolInfo.credentialRequirements?.forEach(cred => {
                const credId = cred.id;
                if (credentials[credId]) {
                  // Add the credential directly to args
                  console.log(`Adding credential: ${credId}`);
                  callArgs[credId] = credentials[credId];
                }
              });
              
              // If the tool expects a __credentials object, create it
              const needsCredentialsObject = tool?.inputSchema?.properties?.__credentials;
              if (needsCredentialsObject && !callArgs.__credentials) {
                callArgs.__credentials = {};
                toolInfo.credentialRequirements?.forEach(cred => {
                  if (credentials[cred.id]) {
                    callArgs.__credentials[cred.id] = credentials[cred.id];
                  }
                });
              }
              
              // Add a flag to tell the AI that credentials are being automatically used
              // This helps the LLM understand that credentials are already handled
              callArgs.__injectedCredentials = true;
            } else {
              console.log(`⚠️ Tool ${nextRequest.toolName} requires credentials, but none were found in session ${nextRequest.sessionId}`);
              
              // If args don't contain credential parameters, ask the user to save credentials first
              const missingCredentials = toolInfo.credentialRequirements?.filter(
                cred => !callArgs[cred.id]
              );
              
              if (missingCredentials && missingCredentials.length > 0) {
                // Create a user-friendly error message
                const missingList = missingCredentials.map(cred => cred.name || cred.id).join(", ");
                console.log(`Missing required credentials: ${missingList}`);
                
                // Return a friendly message to the user instead of executing the tool
                nextRequest.resolve({
                  content: [
                    {
                      type: "text",
                      text: `This tool requires the following credentials: ${missingList}. Please go to Settings > Tool Credentials to save your credentials first.`,
                    }
                  ],
                  serverInfo: {
                    id: serverId,
                    name: toolInfo.serverName || serverId,
                    tool: nextRequest.toolName
                  }
                });
                
                rateLimit.isProcessing = false;
                setTimeout(() => processQueue(serverId), 0);
                return;
              }
              // Otherwise continue with provided parameters
            }
          } else {
            console.log(`🔧 Tool ${nextRequest.toolName} does not require credentials`);
          }
          
          // Execute the tool via MCP with the prepared arguments
          console.log(`🔧 Executing tool ${nextRequest.toolName} (attempt ${retries + 1}/${maxRetries + 1})`);
          const result = await client.callTool({
            name: nextRequest.toolName,
            arguments: callArgs,
            // The timeout is set at client level already
          });

          // Add server info to the result for debugging
          const enhancedResult = {
            ...result,
            content: Array.isArray(result.content) 
              ? result.content
              : [{ 
                  type: "text", 
                  text: `Tool result for ${nextRequest.toolName}`,
                }],
            serverInfo: {
              id: serverId,
              name: toolInfo.serverName || serverId,
              tool: nextRequest.toolName
            }
          };

          // For ALL tool responses, add instructions for Claude to display the result verbatim
          // This is universal and doesn't depend on tool naming conventions
          if (enhancedResult.content && enhancedResult.content.length > 0) {
            // Get the original result text
            const originalResultText = enhancedResult.content[0].text;
            
            // Create a new enhanced content with clear instructions for Claude
            enhancedResult.content = [
              {
                type: "text",
                text: `TOOL RESULT:\n\n${originalResultText}\n\nNOTE TO CLAUDE: Display the above result exactly as shown without analysis or commentary. If this is an optimization or transformation, focus on showing the exact output.`
              }
            ];
          }

          console.log(`✅ Tool ${nextRequest.toolName} executed successfully after ${retries} retries`);
          
          // Resolve the promise with the result
          nextRequest.resolve(enhancedResult);
          break;
        } catch (error) {
          lastError = error;
          console.error(`Error executing tool ${nextRequest.toolName} (attempt ${retries + 1}/${maxRetries + 1}):`, error);
          
          // If it's a timeout error, try again
          if (error.code === -32001) { // This is the timeout error code
            retries++;
            if (retries <= maxRetries) {
              const backoffMs = Math.min(1000 * Math.pow(2, retries), 10000); // Exponential backoff up to 10 seconds
              console.log(`Retrying in ${backoffMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            }
          } else {
            // For non-timeout errors, don't retry
            break;
          }
        }
      }
      
      // If we're here and all retries failed, reject the promise
      if (retries > maxRetries) {
        console.error(`All ${maxRetries + 1} attempts to execute tool ${nextRequest.toolName} failed.`);
        
        // Create a fallback response for timeout errors
        if (lastError && lastError.code === -32001) {
          nextRequest.resolve({
            content: [
              {
                type: "text",
                text: `I'm sorry, but I couldn't get a response from the ${nextRequest.toolName} service. The request timed out after multiple attempts. This might be due to network issues or the service being temporarily unavailable.`,
              }
            ]
          });
        } else {
          // For other errors, reject with the last error
          nextRequest.reject(lastError);
        }
      }
    } finally {
      // Mark as no longer processing and process the next item in the queue
      rateLimit.isProcessing = false;
      setTimeout(() => processQueue(serverId), 0);
    }
  };

  // Get all available server configurations
  const getAvailableServers = (): ServerConfig[] => {
    console.log(`Available servers: ${JSON.stringify(servers.map(s => s.id))}`);
    return [...servers];
  };

  // Get tools that require credentials
  const getToolsWithCredentialRequirements = (sessionId: string): ToolCredentialInfo[] => {
    // Re-enabled credential checking
    console.log(`Tool credential check for session ${sessionId}`);
    
    const tools = toolRegistry.getToolsWithCredentialRequirements();
    console.log(`Tools with credential requirements for session ${sessionId}: ${JSON.stringify(tools.map(t => t.toolName))}`);
    return tools;
  };

  // Set credentials for a tool
  const setToolCredentials = async (
    sessionId: string,
    toolName: string,
    serverId: string,
    credentials: Record<string, string>
  ): Promise<boolean> => {
    console.log(`Setting credentials for tool ${toolName} from server ${serverId}`);
    try {
      // Store credentials in session manager only (browser session)
      sessionManager.setToolCredentials(
        sessionId,
        toolName,
        serverId,
        credentials
      );
      
      console.log(`🔐 Storing credentials for tool: ${toolName}, server: ${serverId}`);
      console.log(`🔑 Credential keys: ${JSON.stringify(Object.keys(credentials))}`);
      console.log(`✅ Credentials stored successfully for ${toolName}`);
      
      return true;
    } catch (error) {
      console.error(`Error setting credentials for tool ${toolName}:`, error);
      return false;
    }
  };

  // Clean up connections when closing
  const cleanup = async (): Promise<void> => {
    for (const [serverId, client] of connectedClients.entries()) {
      try {
        await client.close();
        console.log(`Closed connection to server ${serverId}`);
      } catch (error) {
        console.error(`Error closing connection to server ${serverId}:`, error);
      }
    }
    connectedClients.clear();
  };

  // Implementation of fetchRegistryServers method
  const fetchRegistryServers = async (): Promise<ServerConfig[]> => {
    try {
      // Check if we have valid cached data
      if (registryCache.isValid()) {
        console.log(`Using cached registry data (${registryCache.servers.length} servers) from ${new Date(registryCache.lastFetched).toISOString()}`);
        return registryCache.servers;
      }

      console.log("Fetching servers from NANDA registry...");
      const registryServers = await registryClient.getAllServers(100);
      console.log(`Fetched ${registryServers.length} servers from registry`);
      
      // If we got servers, update the cache
      if (registryServers.length > 0) {
        // Convert RegistryServer to ServerConfig
        const serverConfigs: ServerConfig[] = registryServers.map(server => ({
          id: server.id,
          name: server.name,
          url: server.url,
          description: server.description,
          types: server.types,
          tags: server.tags,
          verified: server.verified,
          rating: server.rating
        }));
        
        // Update the cache
        registryCache.update(serverConfigs);
        
        return serverConfigs;
      } else if (registryCache.servers.length > 0) {
        // If new fetch returned empty but we have cached data, use the cache even if expired
        console.log(`Registry API returned 0 servers. Using older cached data (${registryCache.servers.length} servers)`);
        return registryCache.servers;
      }
      
      return [];
    } catch (error) {
      console.error("Error fetching servers from registry:", error);
      
      // If there's an error but we have cached data, use it (even if expired)
      if (registryCache.servers.length > 0) {
        console.log(`Error fetching from registry. Using cached data (${registryCache.servers.length} servers)`);
        return registryCache.servers;
      }
      
      return [];
    }
  };

  // Disable auto-registration process - rely on client registrations instead
  // const autoRegisterServers = async () => {
  //   console.log(`Auto-registering ${servers.length} servers from storage...`);
  //   for (const server of servers) {
  //     await registerServer(server);
  //   }
  // };
  
  // // Start auto-registration process in the background
  // autoRegisterServers().catch(error => {
  //   console.error("Error auto-registering servers:", error);
  // });

  // Return the MCP manager interface
  return {
    discoverTools,
    executeToolCall,
    registerServer,
    getAvailableServers,
    getToolsWithCredentialRequirements,
    setToolCredentials,
    cleanup,
    getSessionManager: () => sessionManager,
    fetchRegistryServers
  };
}
