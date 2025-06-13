/* imports */
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { challenge, } from './functions.mjs'
/* constants */
const mJsonRpcVersion = process.env.MCP_JSONRPC_Version,
    mJsonRpcProtocolVersion = process.env.MCP_JSONRPC_Protocol_Version,
    mPageSize = process.env.MCP_PAGE_SIZE
        ?? 100
/* public functions */
/**
 * Primary handler for an MCP request.
 * @param {Koa} ctx - Koa context object
 */
async function mcpCall(ctx){
    const { Globals, session, state: {
            avatar: Avatar, mcp, requestType, sessionMeta,
        } = {}
    } = ctx
    const { initializeConfirmation, transportEntry, } = sessionMeta
        ?? {}
    /* 2025-03-26 mcp batch request */
    const mcpRequests = Array.isArray(mcp)
        ? mcp
        : [mcp]
    for(const mcpRequest of mcpRequests){
        try {
            await mMcpCall(ctx, mcpRequest, Avatar, sessionMeta, requestType)
        } catch (err) {
            console.log(chalk.red('mcpCall()::error'), err)
            const { id, jsonrpc } = mcpRequest
            const error = {
                code: 500,
                message: err.message ?? 'Unhandled MCP Error',
                data: err.stack ?? err,
            }
            if(!!transportEntry)
                await mcpSendResponse(ctx, transportEntry, jsonrpc, error, id, undefined)
        }
    }
    /* close transport */
    if(transportEntry && transportEntry instanceof StreamableHTTPServerTransport){
        /* 2025-03-26 protocol POST stream */
        // no transportEntry.close(), shuts down stream, .end() in call is sufficient
    } else if(transportEntry && transportEntry instanceof SSEServerTransport){
        /* 2024-11-04 protocol SSE stream */
    } else {
        /* 2025-03-26 protocol POST singleton */
        ctx.set('Content-Type', 'application/json')
        ctx.body = {
            jsonrpc: mJsonRpcVersion,
            id: mcp?.id,
            result: {},
        }
    }
}
/**
 * Ends an MCP session.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<void>} - Status 204
 */
async function mcpSessionEnd(ctx){
    const sessionId = ctx.get('Mcp-Session-Id')
    if(sessionId?.length && ctx.mcpSessionMeta.has(sessionId))
        ctx.mcpSessionMeta.delete(sessionId)
    ctx.status = 204
}
async function mcpSessionInfo(ctx){
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
 * Creates a new MCP session metadata object.
 * @param {Guid} sessionId - Unique session identifier
 * @param {string} sessionIdKoa - Koa session identifier
 * @param {object} transportEntry - Transport entry for the session (deprecated in MCP specification)
 * @returns {object} - The MCP session metadata object
 */
function mcpSessionMeta(sessionId, sessionIdKoa, transportEntry){
    return sessionId?.length && sessionIdKoa?.length
    ? {
        created: Date.now(),
        initialized: false,
        initializeConfirmation: false,
        runs: [],
        sessionId,
        sessionIdKoa,
        transportEntry,
    }
    : {}
}
/**
 * Handles the System Avatar (Q) MCP request for streaming. Sets session metadata and starts the Stream (Streamable HTTP, SSE) transport.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<void>}
 */
async function mcpStream(ctx){
    // @todo - decouple transferEntry in sessionMeta, since new model can have both
    if(!ctx.request.headers['accept']?.includes('text/event-stream'))
        return
    ctx.respond = false // disable Koa's default response handling
    switch(ctx.request.method){
        case 'POST': /* 2025-03-26 protocol POST stream */
            const streamableSessionId = ctx.Globals.newGuid
            const streamableTransport = new StreamableHTTPServerTransport({
                sessionIdGenerator: ()=>streamableSessionId,
            })
            ctx.mcpSessionMeta.set(streamableSessionId, mcpSessionMeta(streamableSessionId, ctx.sessionId, streamableTransport))
            const sessionMeta = ctx.mcpSessionMeta.get(streamableSessionId)
            ctx.state.sessionMeta = sessionMeta
            await streamableTransport.start()
            console.log(chalk.bgRed('mcpStream()::✅ Connected Streamable HTTP session'), streamableSessionId)
            return
        case 'GET': /* 2024-11-05 protocol SSE stream */
            if(ctx.request.url.split('/').pop()!=='sse')
                return
            const url = ctx.request.url.split('/')
            if(url[url.length - 1].toLowerCase()==='sse')
                url.pop()
            url.push('message')
            const sseTransport = new SSEServerTransport(url.join('/'), ctx.res)
            await sseTransport.start() // sends endpoint event
            const { sessionId: sseSessionId, } = sseTransport
            ctx.mcpSessionMeta.set(sseSessionId, mcpSessionMeta(sseSessionId, ctx.sessionId, sseTransport))
            console.log(chalk.bgRed('mcpStream()::✅ Connected SSE session'), sseSessionId)
            return
        default:
            ctx.throw(400, 'Bad Request - Unsupported method for MCP stream')
    }
}
/**
 * Returns system information adhering to MCP protocol requirements.
 * @param {Koa} ctx - Koa context object
 */
async function mcpSystemInfo(ctx){
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
/**
 * 
 * @param {Koa} ctx - Koa context object
 * @param {object} mcp - MCP request object
 * @param {Avatar} Avatar - Avatar instance
 * @param {object} sessionMeta - Session metadata object
 * @param {string} requestType - Type of request (enum: ['system', 'member'])
 */
async function mMcpCall(ctx, mcp, Avatar, sessionMeta={}, requestType){
    let error,
        result,
        run,
        toolListChanged = false
    const { Globals, } = ctx
    const { capabilities, clientInfo, initializeConfirmation, protocolVersion, runs, sessionId, transportEntry, } = sessionMeta
    const { id, jsonrpc, method, params={}, } = mcp
    const { arguments: args, name, _meta, } = params ?? {}
    const { progressToken, } = _meta ?? {}
    /* identify run */
    run = runs.find((run)=>(run.id===id))
    if(!!run) // @todo - handle run in progress
        throw new error('Run in progress', id)
    run = {
        args,
        id,
        progressToken,
        method,
        name,
        _meta,
    }
    runs.push(run)
    if(!initializeConfirmation){
        if(transportEntry instanceof StreamableHTTPServerTransport){
            const { error, result, } = await mcpInitializationChecks(ctx)
            await transportEntry.handleRequest(ctx.req, ctx.res, ctx.request.body)
            await mcpSendResponse(ctx, transportEntry, jsonrpc, error, id, result)
        } else if(transportEntry instanceof SSEServerTransport){
            const { error, result, } = await mcpInitializationChecks(ctx)
            await mcpSendResponse(ctx, transportEntry, jsonrpc, error, id, result)
        }
        return
    } else if(!!transportEntry && transportEntry instanceof StreamableHTTPServerTransport)
            await transportEntry.handleRequest(ctx.req, ctx.res, ctx.request.body)
    /* progress definition */
    let progress=0,
        progressInterval,
        progressIntervalDuration=6 * 1000,
        progressParams = {
            message: 'MyLife is processing your request',
            progressToken,
            progress,
        }
    if(progressToken && !!transportEntry){
        progressInterval = setInterval(async _=>{
            const notification = 'notifications/progress'
            progressParams.progress += 10
            mcpSendNotification(transportEntry, jsonrpc, notification, progressParams)
            if(progressParams.progress >= 200)
                clearInterval(progressInterval)
        }, progressIntervalDuration)
    }
    const methodBase = method.split('/')[0]
    const methodAction = method.split('/')?.[1]
        ?? methodBase
    const methodPluck = method.split('/').pop()
    switch(methodBase){
        case 'completion':
            switch(methodAction){
                case 'complete':
                default:
                    error = {
                        code: -32602,
                        data: { id, name, },
                        message: `Completions not yet supported, please review available methods via \`tools/list\``,
                    }
            }
            break
        case 'prompts':
            switch(methodAction){
                case 'get':
                    if(!Avatar.isMyLife)
                        break
                    switch(name){
                        case 'mylife_company_information':
                            const { infoType, } = args
                            result = {
                                description: `Ask MyLife's corporate intelligence, _Q_, about our nonprofit organization.`,
                                messages: [
                                    {
                                        role: 'user',
                                        content: {
                                            type: 'text',
                                            text: `Ask Q about MyLife regarding: ${ infoType }`,
                                        }
                                    },
                                    {
                                        role: 'user',
                                        content: {
                                            type: 'text',
                                            text: `When was MyLife founded?`,
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
                    if(!Avatar.isMyLife)
                        break
                    result = {
                        prompts: Avatar.mcp.prompts,
                    }
                    break
            }
            if(!result)
                error = {
                    code: -32602,
                    data: { id, name, },
                    message: `MCP Prompt Call yielded no result, please review available prompts via \`prompts/list\`; Currently only our System Avatar _Q_ supports this functionality`,
                }
            break
        case 'resources':
            switch(methodAction){
                case 'list':
                    if(!Avatar.isMyLife)
                        break
                    result = {
                        resources: Avatar.mcp.resources,
                    }
                    break
                case 'read':
                    if(!Avatar.isMyLife)
                        break
                    const { uri, } = params
                    switch(uri){
                        case 'file://MyLife_Summary.pdf':
                            const summaryPath = path.join(Globals.rootDirectory, "views", "assets", "pdf", "MyLife_Summary.pdf")
                            const pdfSummary = Globals.readPdf(summaryPath)
                            result = {
                                contents: [{
                                    blob: pdfSummary,
                                    mimeType: 'application/pdf',
                                    uri,
                                }]
                            }
                            break
                        case 'file://MyLife_Board.pdf':
                            const boardPath = path.join(Globals.rootDirectory, "views", "assets", "pdf", "MyLife_Board.pdf")
                            const pdfBoard = Globals.readPdf(boardPath)
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
                case 'templates':
                    if(methodPluck==='list')
                        result = {
                            resourceTemplates: [
                                {
                                    uriTemplate: 'bio://{memberId}',
                                    name: 'Board Member Biography',
                                    description: 'Access bios MyLife board members',
                                    mimeType: 'text/markdown',
                                },
                                {
                                    uriTemplate: 'memory://{itemId}',
                                    name: 'Memories',
                                    description: 'Access memory from MyLife archives based on itemId; note: currently must be publicly shared',
                                    mimeType: 'application/json',
                                },
                                {
                                    uriTemplate: 'avatar://{memberId}',
                                    name: 'Avatar Resource',
                                    description: 'Access MyLife Member\'s exposed Personal Avatar',
                                    mimeType: 'text/markdown',
                                },
                            ],
                        }
                    break
                default:
                    break
            }
            if(!result)
                error = {
                    code: -32602,
                    data: { id, name, },
                    message: `MCP Resources not found, please review available prompts via \`resources/list\`; Currently only our System Avatar _Q_ supports this functionality`,
                }
            break
        case 'tools':
            switch(methodAction){
                case 'call':
                    if(!params){ // following MCP specification
                        error = {
                            code: 500,
                            data: run,
                            message: 'Parameters (`params`) are required for tool call',
                        }
                        break
                    }
                    if(requestType!=='system' && name==='mylife_login'){
                        const { result: loginResult, toolListChanged: mcpLoginToolListChanged=false, } = await mcpLogin(ctx, transportEntry, args, jsonrpc, id)
                        toolListChanged = mcpLoginToolListChanged
                        if(loginResult)
                            result = loginResult
                        else
                            error = {
                                code: 500,
                                data: { id, name, },
                                message: `MCP Login failed, please review available tools via \`tools/list\``,
                            }
                        break
                    }
                    let metadata,
                        nextCursor,
                        response,
                        text='',
                        total
                    const { error: mcpError, preface, response: mcpResponse, result: mcpResult, success=false, suffix, tool: mcpTool, toolListChanged: mcpToolListChanged=false, } = await Avatar.mcpFunction(name, args, sessionMeta, ctx)
                    toolListChanged = mcpToolListChanged
                    if(mcpError)
                        error = mcpError
                    else {
                        /* formed MCP `result` returned from sub-function */
                        if(mcpResult){
                            result = mcpResult
                            break
                        }
                        /* tool response requires assessment and compilation */
                        if(Array.isArray(mcpResponse) && (args?.cursor || mcpResponse.length > mPageSize)){
                            const { mcpArray, nextCursor: mcpNextCursor, } = mcpCursor(mcpResponse, args?.cursor)
                            total = mcpResponse.length
                            metadata = { total, }
                            response = mcpArray
                            nextCursor = mcpNextCursor
                        }
                        else
                            response = mcpResponse
                        if(preface?.length)
                            text += preface + (
                                preface.endsWith('\n')
                                    ? ''
                                    : '\n'
                            )
                        text += JSON.stringify(response)
                        if(suffix?.length)
                            text += '\n' + suffix
                        result = {
                            content: [{
                                text,
                                type: 'text',
                            }],
                            isError: !success,
                            metadata,
                            nextCursor,
                        }
                    }
                    break
                case 'list':
                    result = {
                        tools: Avatar.isMyLife && requestType!=='system'
                            ? Avatar.mcpProxy.tools
                            : Avatar.mcp.tools,
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
                    if(Globals.isValidGuid(requestId))
                        id = requestId
                    console.log(chalk.yellow('mMcpCall()::cancelled'), reason, requestId)
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
    if(progressInterval)
        clearInterval(progressInterval)
    sessionMeta.runs = runs.filter((run)=>(run.id!==id))
    await mcpSendResponse(ctx, transportEntry, jsonrpc, error, id, result)
    if(toolListChanged)
        mcpSendNotification(transportEntry, jsonrpc, 'notifications/tools/changed')    
}
/**
 * Paginate an array using a base64 encoded cursor.
 * @param {Array} array - array to be paginated
 * @param {string} base64Cursor - base64 encoded cursor string
 * @param {number} pageSize - number of items per page
 * @returns {Object} - paginated array and next cursor string
 */
function mcpCursor(array, base64Cursor, pageSize=mPageSize){
    if(!Array.isArray(array))
        return { mcpArray: array, }
    let startIndex=0
    if(base64Cursor){
        try {
            const { index, version, } = JSON.parse(Buffer.from(base64Cursor, 'base64').toString())
            startIndex = index
                ?? 0
        } catch (err) {/* use default `startIndex=0` */}
    }
    const endIndex = startIndex + pageSize
    const mcpArray = array.slice(startIndex, endIndex)
    const hasMore = endIndex < array.length
    const nextCursor = hasMore
        ? Buffer.from(JSON.stringify({ index: endIndex, version: 1 })).toString('base64')
        : null
    return {
        mcpArray,
        nextCursor,
    }
}
/**
 * Perform MCP initialization checks. Sets session metadata and returns result or error.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object>} - MCP Initialization result or generic error
 */
async function mcpInitializationChecks(ctx){
    let error,
        result,
        sessionMeta = ctx.state.sessionMeta
    const { avatar: Avatar, mcp, requestType, } = ctx.state
    const { initialized, initializeConfirmation, transportEntry, } = sessionMeta
    const { id, jsonrpc, method, params: {
            capabilities,
            clientInfo,
            protocolVersion,
        } = {},
    } = mcp ?? ctx.request.body
    if(requestType==='system' && !Avatar.isMyLife)
        error = {
            code: 500,
            data: {
                isSystemAvatar: Avatar.isMyLife,
                mcpCall: mcp,
                requestType,
            },
            message: 'Avatar incorrectly configured, please contact support',
        }
    if(!initialized){
        if(method!=='initialize')
            error = {
                code: 403,
                data: {
                    mcpCall: mcp,
                },
                message: 'Session not initialized\n1. use `method=initialize` to finalize handshake;\n2. use `method=notifications/initialized` to confirm initialization',
            }
        else {
            mcpTestProtocol(jsonrpc, protocolVersion)
            result = Avatar.isMyLife && requestType!=='system'
                ? Avatar.mcpProxy
                : Avatar.mcp
            result.protocolVersion = protocolVersion /* under-report for compatibility */
            sessionMeta.capabilities = capabilities
            sessionMeta.clientInfo = clientInfo
            sessionMeta.initialized = true
            sessionMeta.protocolVersion = result.protocolVersion
        }
    } else if(!initializeConfirmation){
        if(method!=='notifications/initialized')
            error = {
                code: 403,
                data: {
                    mcpCall: mcp,
                },
                message: 'Session initialization handshake failed\n1. use `method=notifications/initialized` to confirm initialization handshake',
            }
        else {
            // @todo - disentangle sessionMeta and session
            sessionMeta.initializeConfirmation = true
        }
    }
    return {
        error,
        result,
    }
}
async function mcpLogin(ctx, transportEntry, args, jsonrpc, id){
    const { mbr_id: memberId, passphrase: memberPassphrase, } = args
    let result
    try {
        await challenge(ctx, memberId, memberPassphrase)
        ctx.body = null
        const { avatar: Avatar, } = ctx.state
        result = {
            content: [{
                text: `Welcome back, ${ Avatar.memberName }!\n It's me, ${ Avatar.name }.\nYou're now logged in to MyLife.`,
                type: 'text',
            }],
            isError: false,
        }
        if(Avatar.isMyLife){ /* fail */
            result.isError = true
            result.content = [{
                text: `Unfortunately, the MyLife login failed with your credentials { mbr_id=${ memberId }, passphrase=${ memberPassphrase },}. Please try again.`,
                type: 'text',
            }]
        }
    } catch(e) {
        console.log(chalk.red('mylife_login::ERROR'), args, ctx.body, e)
    }
    return {
        result,
        toolListChanged: true,
    }
}
/**
 * 
 * @param {SSEServerTransport|StreamableHTTPServerTransport} transportEntry - transport entry for the session
 * @param {string} jsonrpc - JSON-RPC version
 * @param {string} method - MCP method to call
 * @param {object} params - Parameters for the MCP method (optional)
 * @param {string|number} id - Unique identifier for the request
 * @returns 
 */
async function mcpSendNotification(transportEntry, jsonrpc, method, params, id) {
    if(!transportEntry){
        console.warn(chalk.red('❌ Invalid transport'))
        return
    }
    if(method.split('/')[0]!=='notifications'){
        console.warn(chalk.red('❌ Invalid method for notification, must start with "notifications/"'))
        return
    }
    const message = {
        jsonrpc,
        method,
        params,
    }
    try {
        if(transportEntry instanceof SSEServerTransport){
            transportEntry.send(message)
            console.log(chalk.green('✅ Notification successful via send()'))
        } else if(transportEntry instanceof StreamableHTTPServerTransport){
            id = id ?? params?.progressToken
            const streamId = transportEntry._requestToStreamMapping.get(id)
                ?? '_GET_stream'
            const stream = transportEntry._streamMapping.get(streamId)
            if(stream?.writable){
                stream.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`)
                console.warn(chalk.green(`✅ Notification successful via stream.write(): ${ streamId }`))
            }
        }
    } catch (err) {
        console.warn(chalk.red('⚠️ Stream failed for notification'))
    }
}
async function mcpSendResponse(ctx, transportEntry, jsonrpc, error, id, result){
    if(!transportEntry)
        return
    if(!error && !result){
        if(!transportEntry)
            ctx.status = 204
        return
    }
    try {
        if(transportEntry instanceof SSEServerTransport)
            ctx.status = 200 // needed for SSE, irrelevant for Streamable HTTP
        await transportEntry.send({
            jsonrpc,
            id,
            ...(result ? { result } : { error }),
        })
    } catch(err) {
        console.log(chalk.red('NO TRANSPORT AVAILABLE::disconnected'), err)
    }
}
function mcpTestProtocol(jsonrpc, protocolVersion){
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
    mcpSessionEnd,
    mcpSessionInfo,
    mcpStream,
    mcpSystemInfo,
}