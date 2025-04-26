import http from "http";
declare const app: import("express-serve-static-core").Express;
declare const server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
declare const mcpManager: import("./mcp/manager.js").McpManager;
export { app, mcpManager, server, };
