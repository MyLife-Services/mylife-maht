// server/src/mcp/types.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema: any;
  credentialRequirements?: CredentialRequirement[];
  serverId?: string;  
  rating?: number; 
}

export interface CredentialRequirement {
  id: string;
  name: string;
  description?: string;
  acquisition?: {
    url?: string;
    instructions?: string;
  };
}

export interface ToolCredentialInfo {
  toolName: string;
  serverName: string;
  serverId: string;
  credentials: CredentialRequirement[];
}

export interface ToolCall {
  name: string;
  arguments: any;
}

export interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
}

export interface McpManager {
  discoverTools: (sessionId: string) => Promise<ToolInfo[]>;
  executeToolCall: (
    sessionId: string,
    toolName: string,
    args: any
  ) => Promise<any>;
  registerServer: (serverConfig: ServerConfig) => Promise<void>;
  getAvailableServers: () => ServerConfig[];
  getToolsWithCredentialRequirements: (sessionId: string) => ToolCredentialInfo[];
  setToolCredentials: (
    sessionId: string, 
    toolName: string, 
    serverId: string, 
    credentials: Record<string, string>
  ) => Promise<boolean>;
  cleanup: () => Promise<void>;
  getSessionManager: () => any;
  fetchRegistryServers: () => Promise<ServerConfig[]>;
}

export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  rating?: number;
}