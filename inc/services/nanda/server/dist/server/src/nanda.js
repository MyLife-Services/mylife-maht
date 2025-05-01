/* imports */
import Koa from 'koa';
import Router from 'koa-router';
import { koaBody } from 'koa-body';
import cors from '@koa/cors';
import { setupRoutes } from './routes.js';
import { setupMcpManager } from './mcp/manager.js';
/* exports */
export function createNandaRouter(options = {}) {
    const { clientOrigin = 'http://localhost:4000', prefix = '/nanda-registry', registryApiKey, registryUrl = 'https://nanda-registry.com' } = options;
    const app = new Koa();
    const router = new Router({ prefix, });
    app.use(cors({ origin: clientOrigin, }));
    app.use(koaBody({
        multipart: true,
        formidable: { maxFileSize: 200 * 1024 * 1024 }
    }));
    const mcpManager = setupMcpManager();
    setupRoutes(router, mcpManager);
    app.use(router.routes());
    app.use(router.allowedMethods());
    const start = async () => {
        const servers = mcpManager.getAvailableServers();
        console.log(`Loaded ${servers.length} local servers`);
    };
    return {
        mcpManager,
        router,
        start
    };
}
