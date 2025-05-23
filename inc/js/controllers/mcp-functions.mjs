/* imports */
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { challenge, } from './functions.mjs'
/* modular constants */
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
    if(!initializeConfirmation)
        return mcpInitializationChecks(ctx)
    /* batch request */
    const mcpRequests = Array.isArray(mcp)
        ? mcp
        : [mcp]
    for(const mcpRequest of mcpRequests){
        mMcpCall(ctx, mcpRequest, Avatar, sessionMeta, session, Globals, requestType)
            .catch(err => {
                console.log(chalk.red('MCP Call request - unhandled error'), err)
                const { id, jsonrpc } = mcpRequest
                const error = {
                    code: 500,
                    message: err.message
                        ?? 'Unhandled MCP Error',
                    data: err.stack
                        ?? err,
                }
                mcpSendResponse(transportEntry, jsonrpc, error, id, null)
            })
    }
    ctx.status = 200
}
async function mSessionInfo(ctx){
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
async function mcpStream(ctx){
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
        sessionIdKoa: ctx.sessionId,
        transportEntry: sseTransport,
    })
    console.log('✅ Connected Inspector SSE session:', sessionId)
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
async function mMcpCall(ctx, mcp, Avatar, sessionMeta, Globals, requestType){
    let error,
        result
    const { runs, sessionId, transportEntry, } = sessionMeta
    const { id, jsonrpc, method, params={}, } = mcp
    const { arguments: args, name, _meta, } = params
    const { progressToken, } = _meta
    /* identify run */
    let run = runs.find((run)=>(run.id===id))
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
    /* progress definition */
    let progress=0,
        progressInterval,
        progressIntervalDuration=6 * 1000
    if(progressToken){
        progressInterval = setInterval(_=>{
            progress += 10
            transportEntry.send({
                jsonrpc,
                method: 'notifications/progress',
                params:{
                    message: `MyLife is continuing to process your request`,
                    progress,
                    progressToken,
                },
            })
        }, progressIntervalDuration)
    }
    const methodBase = method.split('/')[0]
    const methodAction = method.split('/').pop()
    switch(methodBase){
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
                            const boardPath = path.join(Globals.rootDirectory, "views", "assets", "pdf", "MyLife_Board.pdf")
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
                        result = await mcpLogin(ctx, transportEntry, args, jsonrpc)
                        break
                    }
                    let metadata,
                        nextCursor,
                        response,
                        text='',
                        total
                    const { error: mcpError, preface, response: mcpResponse, result: mcpResult, success=false, suffix, tool: mcpTool, } = await Avatar.mcpFunction(name, args, sessionMeta, transportEntry)
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
    if(progressInterval)
        clearInterval(progressInterval)
    sessionMeta.runs = runs.filter((run)=>(run.id!==id))
    mcpSendResponse(transportEntry, jsonrpc, error, id, result)
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
function mcpInitializationChecks(ctx){
    let error,
        result
    const { avatar: Avatar, mcp, requestType, sessionMeta, } = ctx.state
    const { initialized, initializeConfirmation, transportEntry, } = sessionMeta
    const { id, jsonrpc, method, params: {
            capabilities,
            clientInfo,
            protocolVersion,
        } = {}
    } = mcp
    console.log('MCP Initialization Checks', requestType)
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
    else if(Array.isArray(mcp))
        error = {
            code: 403,
            data: {
                mcpCall: mcp,
            },
            message: 'Session not initialized, cannot accept batch requests',
        }
    else if(!transportEntry)
        error = {
            code: 403,
            data: {
                mcpCall: mcp,
            },
            message: 'Session not initialized, cannot accept requests',
        }
    else if(!initialized){
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
        else
            sessionMeta.initializeConfirmation = true
    }
    mcpSendResponse(transportEntry, jsonrpc, error, id, result)
    ctx.status = 200
}
async function mcpLogin(ctx, transportEntry, args, jsonrpc){
    const { mbr_id: memberId, passphrase: memberPassphrase, } = args
    try {
        await challenge(ctx, memberId, memberPassphrase)
    } catch(e) {
        console.log(chalk.red('mylife_login::ERROR'), args, ctx.body, e)
        ctx.body = false
    }
    const { avatar: Avatar, } = ctx.state
    const loginSuccess = ctx.body===true && !Avatar.isMyLife
    ctx.body = null
    if(!loginSuccess)
        return {
            content: [{
                text: `Unfortunately, the MyLife login failed with your credentials { mbr_id=${ memberId }, passphrase=${ memberPassphrase },}. Please try again.`,
                type: 'text',
            }],
            isError: true,
        }
    const result = {
        content: [{
            text: `Welcome back, ${ Avatar.memberName }!\n It's me, ${ Avatar.name }.\nYou're now logged in to MyLife.`,
            type: 'text',
        }],
        isError: false,
    }
    const notification = 'notifications/tools/list_changed'
    mcpSendNotification(transportEntry, jsonrpc, notification)
    return result
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
    if(!error && !result)
        return
    if(!transportEntry)
        error = {
            code: 403,
            data: {
                error,
                id,
                result,
            },
            message: 'No SSE transport found',
        }
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
    mSessionInfo,
    mcpStream,
    mcpSystemInfo,
}