/* imports */
import chalk from 'chalk'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
/* modular constants */
const mJsonRpcVersion = process.env.MCP_JSONRPC_Version,
    mJsonRpcProtocolVersion = process.env.MCP_JSONRPC_Protocol_Version
const mQInitialization = {
    protocolVersion: mJsonRpcProtocolVersion,
    capabilities: {
        /*
        logging: {},
        prompts: {},
        resources: {},
        */
        tools: {
            listChanged: true
        }
    },
    serverInfo: {
        name: 'MyLife MCP',
        version: '1.0',
    },
    instructions: 'I am Q, corporate intelligence for MyLife. MyLife is a humanist 501c3 nonprofit member organization. MyLife has created an AI-Agent platform available by MCP to assist with helping members collect, shape and share their memories and personal narratives with their family and posterity.',
}
const mToolList = [
    {
        name: 'get_shared_memories',
        description: 'I get a random list (max 10) of MyLife public memories { id, title, } that can be experienced.',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        },
        annotations: {        // Optional hints about tool behavior
            title: 'Shared-Memory',      // Human-readable title for the tool
            readOnlyHint: true,    // If true, the tool does not modify its environment
            destructiveHint: false, // If true, the tool may perform destructive updates
            idempotentHint: true,  // If true, repeated calls with same args have no additional effect
            openWorldHint: false   // If true, tool interacts with external entities
        }
    },
    {
        name: 'get_shared_memory',
        description: 'Gets a specific shared memory',
        inputSchema: {
            type: "object",
            properties: { 
                memoryId: {
                    type: "string",
                    description: "The ID of the memory to be retrieved"
                }
            },
            required: ['memoryId']
        },
        annotations: {        // Optional hints about tool behavior
            title: 'Shared-Memory',      // Human-readable title for the tool
            readOnlyHint: true,    // If true, the tool does not modify its environment
            destructiveHint: false, // If true, the tool may perform destructive updates
            idempotentHint: true,  // If true, repeated calls with same args have no additional effect
            openWorldHint: false   // If true, tool interacts with external entities
        }
    }
]
/* System Avatar MCP Functions */
async function mcpCall(ctx, next){
    const { sessionId, } = ctx.request.query
    const { id, jsonrpc, method, params={}, } = ctx.request.body
    const { arguments: args, name, protocolVersion, _meta={}, } = params
    const { progressToken, } = _meta
    const sessionMeta = ctx.mcpSessionMeta.get(sessionId)
    const { initialized, initializeConfirmation, transportEntry, } = sessionMeta
    if(!transportEntry)
        throw new error('Session not found', sessionId)
    let error,
        result
    if(!initialized){
        if(method!=='initialize'){
            error = {
                code: 403,
                data: {
                    arguments: args,
                    id,
                    method,
                    sessionId,
                },
                message: 'Session not initialized\n1. use `method=initialize` to finalize handshake;\n2. use `method=notifications/initialized` to confirm initialization',
            }
        } else {
            mTestMcpProtocols(jsonrpc, protocolVersion)
            result = mQInitialization
            result.protocolVersion = protocolVersion /* under-report for compatibility */
            const { capabilities, clientInfo, } = params
            sessionMeta.capabilities = capabilities
            sessionMeta.clientInfo = clientInfo
            sessionMeta.initialized = true
        }
    } else if (!initializeConfirmation){
        if(method!=='notifications/initialized'){
            error = {
                code: 403,
                data: {
                    arguments: args,
                    id,
                    method,
                    sessionId,
                },
                message: 'Session initialization handshake failed\n1. use `method=notifications/initialized` to confirm initialization handshake',
            }
        } else
            sessionMeta.initializeConfirmation = true
    } else {
        const methodBase = method.split('/')[0]
        switch(methodBase){
            case 'tools':
                const methodAction = method.split('/').pop()
                switch(methodAction){
                    case 'call':
                        if(!params)
                            error = {
                                code: 500,
                                data: {
                                    arguments: args,
                                    id,
                                    method,
                                    name,
                                    params,
                                    sessionId,
                                },
                                message: 'params are required for tool call',
                            }
                        else if(!mToolList.some(tool => tool.name === name))
                            error = {
                                code: 500,
                                data: {
                                    arguments: args,
                                    id,
                                    method,
                                    name,
                                    params,
                                    sessionId,
                                },
                                message: `Tool: ${ name } is not currently registered or supported by this server`,
                            }
                        else
                            switch(name){
                                case 'get_shared_memories':
                                    const memories = await ctx.SystemAvatar.sharedMemories()
                                    result = {
                                        content: memories.map(memory=>({
                                            text: JSON.stringify(memory, null, 2),
                                            type: 'text',
                                        })),
                                        isError: false,
                                    }
                                    break
                                case 'get_shared_memory':
                                    const memory = await ctx.SystemAvatar.sharedMemory(args?.memoryId)
                                    console.log(chalk.yellow('get_shared_memory'), memory)
                                    result = {
                                        content: [{
                                            text: JSON.stringify(memory, null, 2),
                                            type: 'text',
                                        }],
                                        isError: false,
                                    }
                                    break
                                default:
                                    result = {
                                        content: [{
                                            text: `Unfortunately, the MyLife tool "${ name }" is unhandled currently.`,
                                            type: 'text',
                                        }],
                                        isError: true,
                                    }
                                    break
                            }
                        break
                    case 'list':
                        result = {
                            tools: mToolList,
                        }
                        break
                    default:
                        error = {
                            code: 500,
                            data: {
                                arguments: args,
                                id,
                                method,
                                sessionId,
                            },
                            message: `MCP Call request\nmethodAction = ${ methodAction }\nUnknown or unhandled method\nPlease try again in all lowercase and without spaces`,
                        }
                        break
                }
                break
            case 'initialize':
                /* intentionally empty as it is required to cascade through for authentication */
                break
            case 'notifications':
                const notificationType = method.split('/').pop()
                switch(notificationType){
                    case 'cancelled':
                        break
                    case 'initialized':
                        /* intentionally empty as it is required to cascade through for authentication */
                        break
                    default:
                        break
                }
                break
            case 'ping':
                result = {}
                break
            default:
                console.log(chalk.red('MCP Call request - unhandled method'), method)
                error = {
                    code: 500,
                    data: {
                        arguments: args,
                        id,
                        method,
                        sessionId,
                    },
                    message: 'MCP Call request: unknown or unhandled method; please try again in all lowercase and without spaces',
                }
                break
        }
    }
    if(result)
        transportEntry.send({
            jsonrpc,
            id,
            result,
        })
    if(error)
        transportEntry.send({
            jsonrpc,
            id,
            error,
        })
    ctx.status = 200
    await next()
}
async function mSessionInfo(ctx) {
    const { sid: sessionId, } = ctx.params
    const transport = ctx.mcpSessionMeta.get(sessionId)?.transportEntry
    if(!transport){
        ctx.status = 404
        ctx.body = { error: 'Session not found', sessionId }
        return
    }
    ctx.body = {
        sessionId: transport.sessionId,
        type: transport.constructor.name,
        messageUrl: `/message?sessionId=${transport.sessionId}`,
        createdAt: transport.createdAt || '(unknown)',
        info: 'Active session details',
    }
}
/**
 * Handles the System Avatar (Q) MCP request for streaming.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<void>}
 */
async function mcpStream(ctx) {
    ctx.respond = false
    const sseTransport = new SSEServerTransport('/api/v2/mcp/system-avatar/message', ctx.res)
    await sseTransport.start() // sends endpoint event
    const { sessionId, } = sseTransport
    ctx.mcpSessionMeta.set(sessionId, {
        created: Date.now(),
        initialized: false,
        initializeConfirmation: false,
        transportEntry: sseTransport,
    })
    console.log('✅ Connected Inspector SSE session:', sessionId)
}
/**
 * Returns system information adhering to MCP protocol requirements.
 * @param {Koa} ctx - Koa context object
 */
async function mcpSystemInfo(ctx) {
    console.log(chalk.yellow('MCP System Info request'))
    ctx.status = 200
    ctx.body = {
        model: 'mylife-system-avatar',
        version: '1.0.0',
        capabilities: [
            'chat',
            'tools'
        ],
        metadata: {
            vendor: 'MyLife',
            description: 'MyLife System Avatar - AI assistant trained on MyLife materials',
            max_tokens: 8192
        }
    }
}
function mTestMcpProtocols(jsonrpc, protocolVersion){
    if(!jsonrpc || parseFloat(jsonrpc) > parseFloat(mJsonRpcVersion))
        throw new Error('Bad Request - Invalid or Incompatible JSON-RPC version')
    if(!protocolVersion)
        throw new Error('Bad Request - Missing protocolVersion')
    if(mJsonRpcProtocolVersion && new Date(protocolVersion) > new Date(mJsonRpcProtocolVersion))
        throw new Error('Bad Request - Incompatible protocol version (too new)')
}
/* exports */
export {
    mcpCall,
    mSessionInfo,
    mcpStream,
    mcpSystemInfo,
}