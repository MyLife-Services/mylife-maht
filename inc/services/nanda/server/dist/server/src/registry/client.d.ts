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
    getPopularServers(limit?: number): Promise<RegistryServer[]>;
    getAllServers(limit?: number): Promise<RegistryServer[]>;
    searchServers(query: string, options?: {
        limit?: number;
        page?: number;
        tags?: string;
        type?: string;
        verified?: boolean;
    }): Promise<RegistryServer[]>;
    getServers(query?: string, options?: any): Promise<RegistryServer[]>;
    getServerDetails(serverId: string): Promise<any>;
    private request;
    private processServerResponse;
}
