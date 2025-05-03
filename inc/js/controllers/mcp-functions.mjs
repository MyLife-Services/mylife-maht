/* imports */
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { challenge, } from './functions.mjs'
/* modular constants */
const mJsonRpcVersion = process.env.MCP_JSONRPC_Version,
    mJsonRpcProtocolVersion = process.env.MCP_JSONRPC_Protocol_Version
/* public functions */
async function mcpCallMember(ctx){
    let { error, result, } = mcpInitializationChecks(ctx, 'member')
    const { avatar: Avatar, mcp, sessionMeta, } = ctx.state
    const { initialized, initializeConfirmation, runs, transportEntry, } = sessionMeta
    const { args, jsonrpc, method, name, params, progressToken, protocolVersion, run_id, _meta, } = mcp
    if(!(error ?? result)){
        if(Avatar.isMyLife){} // not logged in
        const methodBase = method.split('/')[0]
        const methodAction = method.split('/').pop()
        switch(methodBase){
            case 'initialize': /* intentionally empty as it is required to cascade through for authentication */
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
                                case 'mylife_get_memories':
                                    console.log(chalk.yellow('MCP Call request - get_memories'), method, name)
                                    break
                                case 'mylife_login':
                                    const { mbr_id: memberId, passphrase: memberPassphrase, } = args
                                    await challenge(ctx, memberId, memberPassphrase)
                                    const { avatar: Avatar, } = ctx.state
                                    const loginSuccess = ctx.body===true && !Avatar.isMyLife
                                    ctx.body = null
                                    if(!loginSuccess){
                                        result = {
                                            content: [{
                                                text: `Unfortunately, the MyLife login failed with your credentials { mbr_id=${ memberId }, passphrase=${ memberPassphrase },}. Please try again.`,
                                                type: 'text',
                                            }],
                                            isError: true,
                                        }
                                        break
                                    }
                                    result = {
                                        content: [{
                                            text: `Welcome back, ${ Avatar.memberName }!\n It's me, ${ Avatar.name }.\nYou're now logged in to MyLife.`,
                                            type: 'text',
                                        }],
                                        isError: false,
                                    }
                                    const notification = 'notifications/tools/list_changed'
                                    mcpSendNotification(transportEntry, jsonrpc, notification)
                                    break
                                default:
                                    console.log(chalk.red('MCP Call request - unhandled method'), method, name)
                                    result = {
                                        content: [{
                                            text: `Unfortunately, the MyLife Member Avatar tool "${ name }" is unhandled currently.`,
                                            type: 'text',
                                        }],
                                        isError: true,
                                    }
                                    break
                            }
                        break
                    case 'list':
                        result = {
                            tools: Avatar.isMyLife ? Avatar.mcpGuestTools : Avatar.mcp.tools,
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
            case 'prompts':
            case 'resources':
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
    sessionMeta.runs = sessionMeta.runs.filter((run)=>(run.id!==run_id))
    mcpSendResponse(transportEntry, jsonrpc, error, run_id, result)
    ctx.status = 200
}
/* System Avatar MCP Functions */
async function mcpCallSystem(ctx){
    let { error, result, } = mcpInitializationChecks(ctx)
    const { avatar: Avatar, mcp, sessionMeta, } = ctx.state
    const { initialized, initializeConfirmation, runs, transportEntry, } = sessionMeta
    const { args, jsonrpc, method, name, progressToken, protocolVersion, params, run_id, _meta, } = mcp
    if(!(error ?? result)){
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
                            prompts: Avatar.mcp.prompts,
                        }
                        break
                }
                break
            case 'resources':
                switch(methodAction){
                    case 'list':
                        result = {
                            resources: Avatar.mcp.resources,
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
                                        ?? {}
                                    const pageSize = 10
                                    let decodedCursor = 0
                                    try {
                                        if(cursor){
                                            const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString())
                                            decodedCursor = parsed.index
                                                ?? 0
                                        }
                                    } catch (err) {
                                        throw {
                                            code: -32602,
                                            message: 'Invalid cursor format',
                                        }
                                    }
                                    const memories = await Avatar.sharedMemories()
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
                                        const { instanceId, } = await Avatar.validateShare(sharedMemoryMemoryId)
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
                                        await Avatar.shareHeader(sharedMemoryMemoryId)
                                        Share = await Avatar.share(sharedMemoryMemoryId)
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
                                    await Avatar.shareMemory(sharedMemoryMemoryId, sharedMemoryInput)
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
                                        const registrationData = await Avatar.registerCandidate(signupPacket)
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
                            tools: Avatar.mcp.tools,
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
            case 'initialize': /* intentionally empty as it is required to cascade through for authentication */
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
    sessionMeta.runs = sessionMeta.runs.filter((run)=>(run.id!==run_id))
    mcpSendResponse(transportEntry, jsonrpc, error, run_id, result)
    ctx.status = 200
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
    const url = ctx.request.url.split('/')
    if(url[url.length - 1].toLowerCase()==='sse')
        url.pop()
    url.push('message')
    const sseTransport = new SSEServerTransport(url.join('/'), ctx.res)
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
/* private functions */
function mcpInitializationChecks(ctx, requestType='system'){
    const { avatar: Avatar, mcp, sessionMeta, } = ctx.state
    const { args, capabilities, clientInfo, jsonrpc, method, name, progressToken, protocolVersion, run_id, sessionId, _meta, } = mcp
    const { initialized, initializeConfirmation, runs, transportEntry, } = sessionMeta
    if(!transportEntry)
        throw new error('Session not found', sessionId)
    let error,
        id=run_id,
        result
    let run = runs.find((run)=>(run.id===id))
    // @todo - handle run in progress
    if(!!run)
        throw new error('Run in progress', run_id)
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
            result = requestType!=='system' && Avatar.isMyLife ? Avatar.mcpProxy : Avatar.mcp
            result.protocolVersion = protocolVersion /* under-report for compatibility */
            sessionMeta.capabilities = capabilities
            sessionMeta.clientInfo = clientInfo
            sessionMeta.initialized = true
        }
    } else if(!initializeConfirmation){
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
    }
    return {
        error,
        result,
    }
}
function mReadPdf(filePath){
    const pdfBuffer = fs.readFileSync(filePath)
    return pdfBuffer.toString('base64')
}
function mcpSendNotification(transportEntry, jsonrpc, method){
    console.log(chalk.yellow('MCP Send Notification'), method)
    try{
        if(method.split('/')[0]!=='notifications')
            throw new Error('Invalid notification method')
        transportEntry.send({
            jsonrpc,
            method,
        })
    } catch(error){
        console.log(chalk.red('NO TRANSPORT NOTIFICATION SENT::most likely disconnected'), error)
    }
}
function mcpSendResponse(transportEntry, jsonrpc, error, id, result){
    try{
        if(error)
            transportEntry.send({
                jsonrpc,
                id,
                error,
            })
        if(result)
            transportEntry.send({
                jsonrpc,
                id,
                result,
            })
    } catch(error){
        console.log(chalk.red('NO TRANSPORT SENT::most likely disconnected'), error)
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
    mcpCallMember,
    mcpCallSystem,
    mSessionInfo,
    mcpStream,
    mcpSystemInfo,
}