/* imports */
import chalk from 'chalk'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { SseError } from '@modelcontextprotocol/sdk/client/sse.js'
/* modular constants */
const mJSONRPCVersion = process.env.MCP_JSONRPC_Version
const mProtocolVersion = process.env.MCP_JSONRPC_Protocol
const mQInitialization = {
    protocolVersion: mProtocolVersion,
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
    const mcpData = ctx.mcpSessionMeta.get(sessionId)
    if(!mcpData)
        ctx.throw(404, `Session ${ sessionId } not found`)
    const { capabilities, clientInfo, initializeConfirmation, transportEntry, } = mcpData
    if(!transportEntry)
        throw new SseError('Session SSE transport not found', { sessionId })
    let result
    const methodBase = method.split('/')[0]
    switch(methodBase){
        case 'getSharedMemory':
      case 'tools':
            if(!initializeConfirmation)
                ctx.throw(403, 'Session not initialized')
            const methodAction = method.split('/').pop()
            console.log(chalk.yellow('MCP TOOLS Call request'), methodAction, params)
            switch(methodAction){
                case 'call':
                    if(!params)
                        throw new Error('Missing required parameter: params')
                    if(!name?.length)
                        throw new Error('Missing required parameter: name')
                    if(!mToolList.some(tool => tool.name === name))
                        throw new Error(`Tool ${ name } not found`)
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
                            ctx.throw(404, `Tool ${ name } not found`)
                            break
                    }
                    break
                case 'list':
                    result = {
                        tools: mToolList,
                    }
                    break
                default:
                    break
            }
            break
        case 'initialize':
            result = mQInitialization
            result.protocolVersion = protocolVersion
            break
        case 'notifications':
            const notificationType = method.split('/').pop()
            switch(notificationType){
                case 'cancelled':
                    break
                case 'initialized':
                    mcpData.initializeConfirmation = true
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
            break
    }
    if(result)
        transportEntry.send({
            jsonrpc,
            id,
            result,
        })
    ctx.status = 200
    await next()
}
/**
 * Handles the System Avatar (Q) MCP request for shared memories.
 * @param {Koa} ctx - Koa context object
 */
async function mcpSharedMemories(ctx){
    const { method, } = ctx.request
    /*
## Requests
All messages between MCP clients and servers MUST follow the JSON-RPC 2.0 specification.
- Requests MUST include a string or integer ID.
- Unlike base JSON-RPC, the ID MUST NOT be null.
- The request ID MUST NOT have been previously used by the requestor within the same session.
Example MCP request format:
{
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params: {
    [key: string]: unknown;
  }
}
## Responses
Responses are sent in reply to requests, containing the result or error of the operation.
- Responses MUST include the same ID as the request they correspond to.
- Responses are further sub-categorized as either successful results or errors. Either a result or an error MUST be set. A response MUST NOT set both.
- Results MAY follow any JSON object structure, while errors MUST include an error code and message at minimum.
- Error codes MUST be integers.
Example MCP response format:
{
  jsonrpc: "2.0";
  id: string | number;
  result?: {
    [key: string]: unknown;
  }
  error?: {
    code: number;
    message: string;
    data?: unknown;
  }
}
## Notifications
Currently not in use, but assume similar to canceling thread, etc.
Notifications are sent from the client to the server or vice versa, as a one-way message. The receiver MUST NOT send a response.
- Notifications MUST NOT include an ID.
{
  jsonrpc: "2.0";
  method: string;
  params?: {
    [key: string]: unknown;
  };
}
  */
    if(method.toUpperCase()==='GET'){
        console.log(chalk.yellow('MCP Shared Memories GET request'), ctx.request)
    }
    console.log(method)
    ctx.body = {
        method,
    }
}
/*
async function handleSystemAvatarQ(request) {
    try {
        // Extract the necessary information from the request
        const { messages, options } = request;
        
        // Access the System Avatar Q through ctx or any other means
        const systemAvatar = request.ctx.SystemAvatar;
        
        // Process the request and generate a response
        const response = await systemAvatar.processQuery({
            messages,
            options,
            requestType: 'mcp'
        });
        
        // Return the response in the MCP format
        return {
            message: response.message || '',
            metadata: {
                model: 'system-avatar-q',
                usage: response.usage || {},
                finished: true
            }
        };
    } catch (error) {
        console.error(chalk.red('MCP System Avatar Q Error:'), error);
        return {
            message: 'An error occurred while processing your request.',
            metadata: {
                model: 'system-avatar-q',
                finished: true,
                error: error.message
            }
        };
    }
}

// Function to initialize the MCP server
function initMCPServer(app) {
    const mcpServer = createServer({
        models: {
            'system-avatar-q': {
                handler: handleSystemAvatarQ,
                metadata: {
                    name: 'System Avatar Q',
                    capabilities: ['system-information', 'query-processing', 'dialogue'],
                    description: 'MyLife System Avatar Q - AI assistant trained on MyLife corporate materials'
                }
            }
        }
    });
    
    // Log that MCP server was initialized
    console.log(chalk.green('MCP Server initialized for System Avatar Q'));
    
    return mcpServer;
}

// This function will be called to handle MCP requests
async function mcpHandler(ctx) {
    try {
        // Store Koa context in the request for access to SystemAvatar
        ctx.request.body.ctx = ctx;
        
        // Initialize MCP server if not already initialized
        if (!ctx.app.mcpServer) {
            ctx.app.mcpServer = initMCPServer(ctx.app);
        }
        
        // Process the MCP request
        const mcpResponse = await ctx.app.mcpServer.handleRequest(ctx.request.body);
        
        // Send the response back
        ctx.status = 200;
        ctx.body = mcpResponse;
    } catch (error) {
        console.error(chalk.red('MCP Request Error:'), error);
        ctx.status = 500;
        ctx.body = {
            error: 'Failed to process MCP request',
            message: error.message
        };
    }
}
*/
async function mSessionInfo(ctx) {
    const { sid: sessionId, } = ctx.params
    const transport = ctx.app.webAppTransports?.find(t => t.sessionId === sessionId)
    if (!transport) {
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
    console.log('✅ Connected Inspector SSE session:', sessionId)
    // Store for later routing
    ctx.app.webAppTransports ??= []
    ctx.app.webAppTransports.push(sseTransport)
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
/* exports */
export {
    mcpCall,
    mSessionInfo,
    mcpStream,
    mcpSystemInfo,
}