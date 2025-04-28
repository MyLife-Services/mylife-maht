/* imports */
import Router from 'koa-router'
import { setupRoutes } from './routes.js'
import { setupMcpManager } from './mcp/manager.js'
/* exports */
export function createNandaRouter() {
  const router = new Router()
  const mcpManager = setupMcpManager()
  setupRoutes(router, mcpManager)
  const start = async ()=>{
    const servers = mcpManager.getAvailableServers()
    console.log(`Loaded ${ servers.length } local servers`)
  }
  return {
    router,
    mcpManager,
    start
  }
}
