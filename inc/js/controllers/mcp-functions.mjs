/* imports */
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
/* modular constants */
const mJsonRpcVersion = process.env.MCP_JSONRPC_Version,
    mJsonRpcProtocolVersion = process.env.MCP_JSONRPC_Protocol_Version
const mQInitialization = {
    protocolVersion: mJsonRpcProtocolVersion,
    capabilities: {
        /*
        logging: {},
        */
        prompts: {
            listChanged: false,
        },
        resources: {
            listChanged: false,
            subscribe: false,
        },
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
const mPromptsList = [
    {
        name: 'mylife_company_information',
        description: 'Ask Q, our corporate intelligence, about MyLife, the nonprofit humanist member organization. Include the type of information requested for more precise results.',
        arguments: [
            {
                description: 'The type of information requested about MyLife',
                enum: ['history', 'mission', 'vision', 'values', 'governance', 'members'],
                name: 'infoType',
                required: true,
            }
        ],
    }
]
const mResourcesList = [
    {
        uri: 'file://MyLife_Board.pdf',
        name: 'MyLife Board of Directors Bylaws.pdf',
        description: 'MyLife Board of Directors Bylaws version 1.0',
        mimeType: 'application/pdf',
    },
    {
        uri: 'file://MyLife_Summary.pdf',
        name: 'MyLife_Summary.pdf',
        description: 'Outreach Material for MyLife, written 2 years ago prior to development of the platform',
        mimeType: 'application/pdf',
    },
    {
        uri: 'https://github.com/MyLife-Services/mylife-maht/',
        name: 'MyLife-MAHT GIT codebase',
        description: 'MyLife MAHT codebase, written in Node.js',
        mimeType: 'text/html',
    }
]
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
            openWorldHint: false,   // If true, tool interacts with external entities
        }
    },
    {
        name: 'get_shared_memory',
        description: 'I am Q, corporate intelligence for MyLife. I am able to access public shared memories and play the experience for a human user. The memory will be delivered from MyLife scene-by-scene using the `get_shared_memory` and the appropriate `memberId`. Display the scenes one-by-one, prompt the human to add any optional input to the memory, which should be sent using the `input` field.',
        inputSchema: {
            type: "object",
            properties: {
                input: {
                    type: "string",
                    description: "Any input by the human user while experiencing the memory (optional)"
                },
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
            openWorldHint: false,   // If true, tool interacts with external entities
        }
    },
    {
        name: 'mylife_information',
        description: `I am Q, corporate intelligence guide, capable of giving accurate and truthful depictions of MyLife, a nonprofit human member organization. I will answer any questions about MyLife you have, sorted along the following lines: ['Board', 'Technology Roadmap', 'History', 'Mission and Vision', 'Code', 'Membership', 'Member Services', 'Platform', 'Revenue', 'Corporate', 'Volunteering', 'Donate', 'Charity', 'Misc']`,
        inputSchema: {
            type: 'object',
            properties: {
                question: {
                    description: 'The question asked of Q',
                    type: 'string',
                },
                questionType: {
                    description: 'The type of information requested about MyLife',
                    enum: ['Board', 'Technology Roadmap', 'History', 'Mission and Vision', 'Code', 'Membership', 'Member Services', 'Platform', 'Revenue', 'Corporate', 'Volunteering', 'Donate', 'Charity', 'Misc'],
                    type: 'string',
                }
            },
            required: ['question', 'questionType'],
        },
        annotations: {
            title: 'MyLife-Information',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        }
    },
    {
        name: 'register',
        description: 'I am Q, corporate intelligence guide, capable of giving accurate and truthful depictions of MyLife, a nonprofit human member organization. I will register you for MyLife and send you a validation link by email. The only pieces of information I need are: Your full name, the email you wish to use, and the name you like for your personal avatar (a personal intelligence agent... one of several you receive when signing up with MyLife). Please also share your primary interest in MyLife (Examples: Newsletter, Member, Volunteer, Coder, Tester, Board, Advisory).',
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
                },
                reason: {
                    type: 'string',
                    description: 'What is the primary interest in MyLife for the registrant (Examples: Newsletter, Member, Volunteer, Coder, Tester, Board, Advisory)',
                }
            },
            required: ['avatarName', 'email', 'humanName', 'reason'],
        },
        annotations: {
            title: 'Register-for-MyLife',
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        }
    }
]
/* System Avatar MCP Functions */
async function mcpCall(ctx, next){
    const { sessionId, } = ctx.request.query
    const { id: run_id, jsonrpc, method, params={}, } = ctx.request.body
    const { arguments: args, name, protocolVersion, _meta={}, } = params
    const { progressToken, } = _meta
    const { sessionMeta, } = ctx.state
    const { initialized, initializeConfirmation, runs, transportEntry, } = sessionMeta
    if(!transportEntry)
        throw new error('Session not found', sessionId)
    let error,
        id=run_id,
        result
    /* save run ID to transport entry for later use */
    let run = runs.find((run)=>(run.id===id))
    // @todo - handle run in progress
    if(!!run)
        return
    run = {
        args,
        id,
        progressToken,
        method,
        name,
    }
    runs.push(run)
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
            case 'prompts':
                switch(methodAction){
                    case 'get':
                        switch(name){
                            case 'mylife_company_information':
                                const { infoType, } = args
                                result = {
                                    description: 'Prompt to ask Q about MyLife',
                                    messages: [
                                        {
                                            role: 'user',
                                            content: {
                                                type: 'text',
                                                text: `Ask Q about MyLife regarding: ${ infoType }`,
                                            }
                                        }
                                    ]
                                }
                                break
                            default:
                                break
                        }
                        break
                    case 'list':
                        result = {
                            prompts: mPromptsList,
                        }
                        break
                }
                break
            case 'resources':
                switch(methodAction){
                    case 'list':
                        result = {
                            resources: mResourcesList,
                        }
                        break
                    case 'read':
                        const { uri, } = params
                        switch(uri){
                            case 'file://MyLife_Summary.pdf':
                                const summaryPath = path.join(ctx.Globals.rootDirectory, "views", "assets", "pdf", "MyLife_Summary.pdf")
                                const pdfSummary = mReadPdf(summaryPath)
                                result = {
                                    contents: [{
                                        blob: pdfSummary,
                                        mimeType: 'application/pdf',
                                        uri,
                                    }]
                                }
                                break
                            case 'file://MyLife_Board.pdf':
                                const boardPath = path.join(ctx.Globals.rootDirectory, "views", "assets", "pdf", "MyLife_Board.pdf")
                                const pdfBoard = mReadPdf(boardPath)
                                result = {
                                    contents: [{
                                        blob: pdfBoard,
                                        mimeType: 'application/pdf',
                                        uri,
                                    }]
                                }
                                break
                            default:
                                let text = ''
                                try {
                                    const response = await fetch(uri)
                                    text = ( await response.text() ).trim()
                                } catch (error) {
                                    console.error(chalk.red('Error fetching resource:'), uri, error)
                                    text = `Error fetching external resource: ${error.message}`
                                }
                                result = {
                                    contents: [{
                                        mimeType: 'text/html',
                                        text,
                                        uri,
                                    }]
                                }
                                break
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
                                    const { cursor, } = args
                                    const pageSize = 10
                                    let decodedCursor = 0
                                      try {
                                        if(cursor){
                                            const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString())
                                            decodedCursor = parsed.index ?? 0
                                        }
                                    } catch (err) {
                                        throw {
                                            code: -32602,
                                            message: 'Invalid cursor format',
                                        }
                                    }
                                    const memories = await ctx.SystemAvatar.sharedMemories()
                                    const total = memories.length
                                    const memoryPage = memories.slice(decodedCursor, decodedCursor+pageSize)
                                    const memoryPageHasNext = decodedCursor + pageSize < total
                                    const nextCursor = memoryPageHasNext
                                        ? Buffer.from(JSON.stringify({ index: decodedCursor + pageSize })).toString('base64')
                                        : null
                                    result = {
                                        content: [{
                                            text: `Here is the array of shared memories, only share the titles with the human, and use ID to connect to tools and services.\n${ JSON.stringify(memories, null, 2) }`,
                                            type: 'text',
                                        }],
                                        isError: false,
                                        metadata: {
                                            memories,
                                            total: memories.length,
                                        },
                                        nextCursor,
                                    }
                                    break
                                case 'get_shared_memory':
                                    let { input: sharedMemoryInput, memoryId: sharedMemoryMemoryId, } = args
                                    let Share = sessionMeta.Share
                                    if(!Share || Share.instanceId!==sharedMemoryMemoryId){
                                        let sharedMemoryInterval01
                                        if(progressToken){
                                            let progress = 0
                                            sharedMemoryInterval01 = setInterval(_=>{
                                                progress += 10
                                                transportEntry.send({
                                                    jsonrpc,
                                                    method: 'notifications/progress',
                                                    params:{
                                                        message: `Retrieving shared memory header`,
                                                        progress,
                                                        progressToken,
                                                    },
                                                })
                                            }, 2500)
                                        }
                                        const { instanceId, } = await ctx.SystemAvatar.validateShare(sharedMemoryMemoryId)
                                        if(!instanceId){
                                            result = {
                                                content: [{
                                                    text: `The memoryId ${ sharedMemoryMemoryId } is not valid`,
                                                    type: 'text',
                                                }],
                                                isError: true,
                                            }
                                            break
                                        }
                                        sharedMemoryMemoryId = instanceId
                                        await ctx.SystemAvatar.shareHeader(sharedMemoryMemoryId)
                                        Share = await ctx.SystemAvatar.share(sharedMemoryMemoryId)
                                        if(sharedMemoryInterval01)
                                            clearInterval(sharedMemoryInterval01)
                                        sessionMeta.Share = Share
                                        Share = sessionMeta.Share
                                        if(Share.warnings?.length){
                                            result = {
                                                content: [{
                                                    text: `Confirm that the viewer would like to proceed given the following content warnings: ${ JSON.stringify(Share.warnings) }. Then make the \`get_shared_memory\` call again with the new memoryId: ${ sharedMemoryMemoryId }`,
                                                    type: 'text',
                                                }],
                                                isError: true,
                                            }
                                            break
                                        }
                                    }
                                    let sharedMemoryInterval02
                                    if(progressToken){
                                        let progress = 0
                                        sharedMemoryInterval02 = setInterval(_=>{
                                            progress += 10
                                            transportEntry.send({
                                                jsonrpc,
                                                method: 'notifications/progress',
                                                params:{
                                                    message: `Retrieving shared memory header`,
                                                    progress,
                                                    progressToken,
                                                },
                                            })
                                        }, 2500)
                                    }
                                    if(!Share.warningsAccepted) /* previous error result required intelligence to issue warnings to human before re-contacting */
                                        Share.acceptWarnings()
                                    await ctx.SystemAvatar.shareMemory(sharedMemoryMemoryId, sharedMemoryInput)
                                    if(sharedMemoryInterval02)
                                        clearInterval(sharedMemoryInterval02)
                                    result = {
                                        content: [{
                                            text: `Below is the current scene to present to the user for this memory. Ask user if they have any content to add. Call \`get_shared_memory\` again with the correct memoryId: ${ sharedMemoryMemoryId } and any human input in field \`input\`.\n${ JSON.stringify(Share.previousScene, null, 2) }`,
                                            type: 'text',
                                        }],
                                        isError: false,
                                    }
                                    break
                                case 'mylife_information':
                                    const { question, questionType, } = args
                                    const { SystemAvatar, } = ctx
                                    let message = question
                                    if(questionType?.length)
                                        message += `\n\nQuestion Type: ${ questionType }`
                                    let infoInterval
                                    if(progressToken){
                                        let progress = 0
                                        infoInterval = setInterval(_=>{
                                            progress += 10
                                            transportEntry.send({
                                                jsonrpc,
                                                method: 'notifications/progress',
                                                params:{
                                                    message: `Answering question about MyLife`,
                                                    progress,
                                                    progressToken,
                                                },
                                            })
                                        }, 2500)
                                    }
                                    const { responses, } = await SystemAvatar.chat(message, undefined, ctx.session)
                                    if(infoInterval)
                                        clearInterval(infoInterval)
                                    const infoContent = responses.map((response)=>({
                                        text: response.message,
                                        type: 'text',
                                    }))
                                    result = {
                                        content: infoContent,
                                        isError: false,
                                    }
                                    break
                                case 'register':
                                    const { avatarName: registerAvatarName, email: registerEmail, humanName: registerHumanName, reason: registerReason, } = args
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
                                            reason: registerReason,
                                        }
                                        let interval
                                        if(progressToken){
                                            let progress = 0
                                            interval = setInterval(_=>{
                                                progress += 10
                                                transportEntry.send({
                                                    jsonrpc,
                                                    method: 'notifications/progress',
                                                    params:{
                                                        message: `Checking and registering: ${ registerEmail }`,
                                                        progress,
                                                        progressToken,
                                                    },
                                                })
                                            }, 1000)
                                        }
                                        const registrationData = await ctx.SystemAvatar.registerCandidate(signupPacket)
                                        if(interval)
                                            clearInterval(interval)
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
                        const { reason, requestId, } = params
                        if(ctx.Globals.isValidGuid(requestId))
                            id = requestId
                        console.log(chalk.yellow('MCP Call request - cancelled'), reason, requestId)
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
    sessionMeta.runs = sessionMeta.runs.filter((run)=>(run.id!==id))
    try{
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
    } catch(error){
        console.log(chalk.red('NO TRANSPORT SENT::most likely disconnected'), error)
    }
    ctx.status = 200
    await next()
}
async function mSessionInfo(ctx) {
    const { sid: sessionId, } = ctx.params
    const { sessionMeta, } = ctx.state
    const transport = sessionMeta.get(sessionId)?.transportEntry
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
        runs: [],
        sessionId,
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
function mReadPdf(filePath){
    const pdfBuffer = fs.readFileSync(filePath)
    return pdfBuffer.toString('base64')
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