import { SessionManager } from "./sessionManager.js";
import { ToolInfo, CredentialRequirement, ServerConfig } from "./types.js";
interface ToolCredentialInfo {
    toolName: string;
    serverName: string;
    serverId: string;
    credentials: CredentialRequirement[];
}
export interface McpManager {
    discoverTools: (sessionId: string) => Promise<ToolInfo[]>;
    executeToolCall: (sessionId: string, toolName: string, args: any) => Promise<any>;
    registerServer: (serverConfig: ServerConfig) => Promise<boolean>;
    getAvailableServers: () => ServerConfig[];
    getToolsWithCredentialRequirements: (sessionId: string) => ToolCredentialInfo[];
    setToolCredentials: (sessionId: string, toolName: string, serverId: string, credentials: Record<string, string>) => Promise<boolean>;
    cleanup: () => Promise<void>;
    getSessionManager: () => SessionManager;
    fetchRegistryServers: () => Promise<ServerConfig[]>;
}
export declare function setupMcpManager(): McpManager;
export {};
