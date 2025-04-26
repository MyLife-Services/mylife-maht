import Koa from 'koa'
import Router from 'koa-router'
import { koaBody } from 'koa-body'
import cors from '@koa/cors'
import http from 'http'
import { setupRoutes } from './routes.js'
import { setupMcpManager } from './mcp/manager.js'
/* assignments: */
type NandaOptions = {
    clientOrigin?: string
    registryApiKey?: string
    registryUrl?: string
}
/* create NandaServer function: */
export function createNandaServer(options: NandaOptions = {}){
    const {
        clientOrigin = 'http://localhost:4000',
        registryApiKey,
        registryUrl = 'https://nanda-registry.com'
    } = options
    const app = new Koa()
    const router = new Router()
    const server = http.createServer(app.callback())
    app.use(cors({ origin: clientOrigin }))
    app.use(koaBody({
        multipart: true,
        formidable: {
            maxFileSize: 200 * 1024 * 1024 // Set max file size to 200MB
        }
    }))
    const mcpManager = setupMcpManager()
    setupRoutes(router, mcpManager)
    app.use(router.routes()).use(router.allowedMethods())
    const start = async ()=>{
        const servers = mcpManager.getAvailableServers()
        console.log(`Loaded ${ servers.length } local servers`)
    }
    return {
        app,
        server,
        mcpManager,
        start
    }
}
