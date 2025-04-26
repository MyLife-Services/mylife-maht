import Koa from 'koa';
import http from 'http';
type NandaOptions = {
    clientOrigin?: string;
    registryApiKey?: string;
    registryUrl?: string;
};
export declare function createNandaServer(options?: NandaOptions): {
    app: Koa<Koa.DefaultState, Koa.DefaultContext>;
    server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    mcpManager: import("./mcp/manager.js").McpManager;
    start: () => Promise<void>;
};
export {};
