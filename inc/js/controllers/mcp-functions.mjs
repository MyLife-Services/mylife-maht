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
        description: 'I am Q, corporate intelligence for MyLife. When asked for shared memories, I return a random array (max 10) of MyLife public memories { id, title, } that can be experienced. Show the human the title list, there is no need to display ids. Ask human what Memory they want to experience and then use the get_shared_memory tool to retrieve the memory using the underlying id.',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        },
        annotations: {        // Optional hints about tool behavior
            title: 'Shared-Memories',      // Human-readable title for the tool
            readOnlyHint: true,    // If true, the tool does not modify its environment
            destructiveHint: false, // If true, the tool may perform destructive updates
            idempotentHint: true,  // If true, repeated calls with same args have no additional effect
            openWorldHint: false   // If true, tool interacts with external entities
        }
    },
    {
        name: 'get_shared_memory',
        description: 'I am Q, corporate intelligence for MyLife. When asked for a shared memory, I return the MyLife public memory { anonymous, conclusion, guessable, id, scenes, title, voice, } to be experienced. To help the human relive the memory, you should ask for each scene in the memory and use the get_shared_memory_scene tool to retrieve the scene using the underlying id.',
        inputSchema: {
            type: "object",
            properties: { 
                memoryId: {
                    type: "string",
                    description: "The ID of the memory to be retrieved, can be empty"
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
    },
    {
        name: 'get_shared_memory_scene',
        description: 'I am Q, corporate intelligence for MyLife. When asked for a shared memory scene, I return the MyLife public memory scene { sceneId, summary, } to be experienced. You should read out each scene summary and ask the human if they want to add any comments or details to the scene. If they do, submit the comments to the scene using this get_shared_memory_scene tool.',
        inputSchema: {
            type: 'object',
            properties: {
                comments: {
                    type: 'string',
                    description: 'The commentary added to the scene by the human',
                },
                sceneId: {
                    type: 'string',
                    description: 'The ID of the scene to be retrieved',
                }
            },
            required: ['sceneId'],
        },
        annotations: {        // Optional hints about tool behavior
            title: 'Shared-Memory-Scene',      // Human-readable title for the tool
            readOnlyHint: true,    // If true, the tool does not modify its environment
            destructiveHint: false, // If true, the tool may perform destructive updates
            idempotentHint: true,  // If true, repeated calls with same args have no additional effect
            openWorldHint: false   // If true, tool interacts with external entities
        }
    },
    {
        name: 'register',
        description: 'I am Q, corporate intelligence for MyLife. I register members for the MyLife platform. In order to register a human member, I need the following information: { avatarName, email, humanName, }. `avatarName` is the name chosen for the registrant\'s avatar. `email` is the registrant\'s email address they wish to use . `humanName` is the full name of the registrant.',
        inputSchema: {
            type: 'object',
            properties: {
                avatarName: {
                    type: 'string',
                    description: "The name chosen for the registrant's avatar",
                },
                email: {
                    type: 'string',
                    description: "The registrant's email address",
                },
                humanName: {
                    type: 'string',
                    description: 'The full name of the registrant',
                }
            },
            required: ['avatarName', 'email', 'humanName'],
        },
        annotations: {        // Optional hints about tool behavior
            title: 'Register-for-MyLife',      // Human-readable title for the tool
            readOnlyHint: false,    // If true, the tool does not modify its environment
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
        const methodAction = method.split('/').pop()
        switch(methodBase){
            case 'resources':
                switch(methodAction){
                    case 'list':
                        result = {
                            resources: {},
                        }
                        break
                    default:
                        break
                }
                break
            case 'prompts':
                switch(methodAction){
                    case 'list':
                        result = {
                            prompts: {},
                        }
                        break
                    default:
                        break
                }
                break
            case 'tools':
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
                                    const memory = await ctx.SystemAvatar.shareMemory(args?.memoryId)
                                    console.log(chalk.yellow('get_shared_memory'), memory, args)
                                    result = {
                                        content: [{
                                            text: JSON.stringify(memory, null, 2),
                                            type: 'text',
                                        }],
                                        isError: false,
                                    }
                                    break
                                case 'get_shared_memory_scene':
                                    const { comments, sceneId, } = args
                                    console.log(chalk.yellow('get_shared_memory_scene'), comments, sceneId)
                                    result = {
                                        content: [{
                                            text: `Unfortunately, sceneId[${ sceneId }] was not found`,
                                            type: 'text',
                                        }],
                                        isError: true,
                                    }
                                    break
                                case 'register':
                                    const { avatarName: registerAvatarName, email: registerEmail, humanName: registerHumanName, } = args
                                    /* validate input */
                                    if(!ctx.Globals.isValidEmail(registerEmail))
                                        result = {
                                            content: [{
                                                text: `Email must well-formed; you sent: ${ registerEmail }`,
                                                type: 'text',
                                            }],
                                            data: args,
                                            isError: true,
                                        }
                                    else if((registerHumanName?.length ?? 0) < 3)
                                        result = {
                                            content: [{
                                                text: `Human Name (humanName) must be a string with at least 3 chars; you sent: ${ registerHumanName }`,
                                                type: 'text',
                                            }],
                                            data: args,
                                            isError: true,
                                        }
                                    else if((registerAvatarName?.length ?? 0) < 1)
                                        result = {
                                            content: [{
                                                text: `Avatar Name (avatarName) be a string with at least 1 char; you sent: ${ registerAvatarName }`,
                                                type: 'text',
                                            }],
                                            data: args,
                                            isError: true,
                                        }
                                    else {
                                        const signupPacket = {
                                            type: 'register',
                                            avatarName: registerAvatarName,
                                            email: registerEmail,
                                            humanName: registerHumanName,
                                        }
                                        const registrationData = await ctx.SystemAvatar.registerCandidate(signupPacket)
                                        const { email: registeredEmail, } = registrationData
                                        if(registeredEmail!==signupPacket.email)
                                            result = {
                                                content: [{
                                                    text: `Something went wrong with our system; please try again later`,
                                                    type: 'text',
                                                }],
                                                data: signupPacket,
                                                isError: true,
                                            }
                                        else 
                                            result = {
                                                content: [{
                                                    text: `Registration was successful! Congratulations! An email has been sent to you with further instructions on how to validate your email. _Please remember_ the email used for registration: **${ registerEmail }**`,
                                                    type: 'text',
                                                }],
                                                data: registrationData,
                                                isError: false,
                                            }
                                        console.log(chalk.bgYellow('MCP Register Call::'), chalk.bgRed('registerEmail'), registerEmail)
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