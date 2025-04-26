import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
interface CredentialRequirement {
    id: string;
    name: string;
    description?: string;
    acquisition?: {
        url?: string;
        instructions?: string;
    };
}
interface SharedToolInfo {
    name: string;
    description?: string;
    inputSchema: any;
    credentialRequirements?: CredentialRequirement[];
    serverId?: string;
    serverName?: string;
}
interface ToolInfo {
    serverId: string;
    serverName: string;
    client: Client;
    tool: Tool;
    credentialRequirements?: CredentialRequirement[];
    rating?: number;
}
export declare class ToolRegistry {
    private tools;
    registerTools(serverId: string, serverName: string, rating: number, client: Client, tools: Tool[]): void;
    getToolInfo(toolName: string): ToolInfo | undefined;
    getAllTools(): SharedToolInfo[];
    getToolsByServerId(serverId: string): SharedToolInfo[];
    getToolsWithCredentialRequirements(): {
        toolName: string;
        serverName: string;
        serverId: string;
        credentials: CredentialRequirement[];
    }[];
    removeToolsByServerId(serverId: string): void;
}
export {};
