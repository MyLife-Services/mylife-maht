type NandaOptions = {
    clientOrigin?: string;
    prefix?: string;
    registryApiKey?: string;
    registryUrl?: string;
};
export declare function createNandaRouter(options?: NandaOptions): {
    mcpManager: import("./mcp/manager.js").McpManager;
    router: any;
    start: () => Promise<void>;
};
export {};
