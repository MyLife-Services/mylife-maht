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
export declare class RegistryClient {
    private baseUrl;
    private apiKey?;
    constructor(baseUrl?: string, apiKey?: string);
    /**
     * Get popular servers from the registry
     */
    getPopularServers(limit?: number): Promise<RegistryServer[]>;
    getAllServers(limit?: number): Promise<RegistryServer[]>;
    /**
     * Search for servers in the registry
     */
    searchServers(query: string, options?: {
        limit?: number;
        page?: number;
        tags?: string;
        type?: string;
        verified?: boolean;
    }): Promise<RegistryServer[]>;
    getServers(query?: string, options?: any): Promise<RegistryServer[]>;
    /**
     * Process and format server response from registry
     */
    private processServerResponse;
    /**
     * Format server data consistently
     */
    private formatServerData;
    /**
     * Fetches details for a specific server
     */
    getServerDetails(serverId: string): Promise<any>;
}
