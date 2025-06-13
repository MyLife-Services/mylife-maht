/* imports */
import chalk from 'chalk'
import fs from 'fs/promises'
import path from 'path'
import { challenge, } from './functions.mjs'
/* constants */
const mA2AProviders = [
    {
        description: 'The NANDA metaprotocol supports A2A providers for MyLife',
        id: 'nanda',
        name: 'NANDA',
        priority: 1,
        transport: {
            type: 'http',
            method: 'POST',
            endpoint: 'https://nanda-agent.org/a2a/',
            auth: {
                scheme: 'bearer',
                token: process.env.MYLIFE_NANDA_SHARED_TOKEN ?? null,
                scope: 'interests.read'
            }
        }
    },
    {
        id: 'mylife',
        name: 'MyLife',
        priority: 2,
        proxies: ['q', 'internal'],
        transport: {
            type: 'internal',
            endpoint: 'https://mylife.services/a2a/'
        }
    }
]
const mAgentCards = {},
    mAgentCardsPath = path.join(
        process.cwd(),
        'inc',
        'json-schemas',
        'a2a',
        'cards'
    ),
    mContracts = {},
    mContractsPath = path.join(
        process.cwd(),
        'inc',
        'json-schemas',
        'a2a',
        'contracts'
    ),
    mHandlers = { /* A2A handlers, represent piping between avatars and performed services/capabilities */
        getMyLifeInfo: async (ctx, params)=>{
            const { avatar: Avatar, } = ctx.state
            if(!Avatar?.isMyLife)
                return sendError(ctx, 403, -32601, 'Incorrect Avatar is being requested from avatar is in use. Please contact technical support.', { type: 'forbidden' })
            let question = ''
            if(params?.questionType)
                question += 'CATEGORY: ' + params.questionType + '\n'
            if(params?.question)
                question += 'QUESTION: ' + params.question + '\n'
            if(!question?.length)
                return sendError(ctx, 400, -32602, 'Invalid request: question is required', { type: 'invalid_request' })
            const { error, responses, success, } = await Avatar.chat(question, undefined, ctx)
            const parts = []
            if(success && responses?.length)
                for(const response of responses){
                    const { message, response_time, } = response
                    if(message?.length)
                        parts.push({
                            kind: 'text',
                            metadata: { response_time, },
                            text: message,
                        })
                }
            else
                parts.push({
                    kind: 'text',
                    metadata: error,
                    text: 'Failed to get MyLife info: ' + (error?.message || 'Unknown error'),
                })
            return parts
        },
        getPublicMemory: 'get_shared_memory',
        getPublicMemories: "get_shared_memories",
        registerForMyLifeMembership: "register",
    }
/* load agent cards */
try {
    const files = await fs.readdir(mAgentCardsPath)
    for(const file of files)
        await addFiletoObject(mAgentCards, file, mAgentCardsPath)
    console.log(chalk.blueBright(`Loaded A2A agent cards into memory from ${mAgentCardsPath}`))
} catch(err) {
    console.error(chalk.redBright(`Error loading A2A agent cards: ${err.message}`))
}
/* load data contracts (when available) */
/*
try {
    const files = await fs.readdir(mContractsPath)
    for(const file of files)
        await addFiletoObject(mContracts, file, mContractsPath)
    console.log(chalk.blueBright(`Loaded A2A contracts into memory from ${mContractsPath}`))
} catch(err) {
    console.error(chalk.redBright(`Error loading A2A contracts: ${err.message}`))
}
*/
/* public functions */
async function a2aCall(ctx){
    const agentId = resolveAgentId(ctx)
    const { avatar: Agent, } = ctx.state
    ctx.set('Content-Type', 'application/json')
    if(agentId==='q' && !Agent?.isMyLife)
        return sendError(ctx, 403, -32601, 'Incorrect Avatar is being requested from avatar is in use. Please contact technical support.', { type: 'forbidden' })
    const card = agentCard(agentId)
    const { kind, messageId, metadata={}, parts, role, } = ctx.request.body
    if(kind!=='message')
        return sendError(ctx, 400, -32602, 'Invalid request body: expected kind to be "message"', { type: 'invalid_request' })
    if(!messageId?.length)
        return sendError(ctx, 400, -32602, 'Message ID is required in the body for tracking: POST `/a2a/:agentId`', { type: 'missing_parameter' })
    if(!parts?.length)
        return sendError(ctx, 400, -32602, 'Message parts are required in the body for tracking: POST `/a2a/:agentId`', { type: 'missing_parameter' })
    if(role!=='user')
        return sendError(ctx, 400, -32602, 'Invalid request body: expected role to be "user"', { type: 'invalid_request' })
    const { parameters, skill, skillId, } = extractSkill(card, parts)
    if(!skillId?.length) // @todo - should there be more helpful defaults and hints from internal intelligence? A pointer to a primer on how to use the agent's a2a capabilities?
        return sendError(ctx, 400, -32602, 'Invalid request body. Specifications: Agent Requests via A2A Message **MUST** contain a DataPart that specifies the skill (id) being requested and any associated parameters; example: `{ "id": "getMyLifeInfo", "parameters": { "question": "who\'s on board?", "questionType": "board" } }`.', { type: 'invalid_request' })
    try {
        historyLogItem(ctx, messageId, {
            skill: { parameters, skill, skillId, },
        })
        const parts = await a2aHandler(ctx, parameters, skillId),
            role = 'agent'
        if(ctx.body?.error)
            return historyLogItem(ctx, messageId, {
                error: ctx.body.error,
            })
        if(!parts?.length){
            sendError(ctx, 400, -32602, 'MCP message parts failed to convert to A2A', { type: 'invalid_response' })
            return historyLogItem(ctx, messageId, {
                error: ctx.body.error,
            })
        }
        metadata.agentId = agentId
        metadata.agentName = card?.name
        metadata.agentDescription = card?.description
        metadata.iconUrl = card?.iconUrl
        ctx.status = 200
        ctx.body = {
            kind,
            messageId,
            metadata,
            parts,
            role,
            skill,
        }
        historyLogItem(ctx, messageId, {
            response: ctx.body,
        })
    } catch (err) {
        ctx.status = 500
        ctx.body = {
            error: {
                code: -32603,
                message: 'Internal server error during capability execution',
                data: {
                    detail: err.message,
                    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
                }
            }
        }
    }
}
/**
 * Serves the agent card for a given agent id/name.
 * @param {Koa} ctx - Koa context
 * @returns {Promise<void>} - The agent card or an error response in `ctx.body`
 */
async function a2aCard(ctx){
    const agentId = resolveAgentId(ctx)
    if(!agentId?.length){
        ctx.status = 400
        ctx.body = {
            error: {
                code: -32602,
                message: 'Agent ID is required in the path: GET `/a2a/:agentId`',
                data: { type: 'missing_parameter' }
            }
        }
        return
    }
    const card = agentCard(agentId)
    /* ensure URLs absolute */
    if(card?.documentationUrl && !card.documentationUrl.startsWith('http'))
        card.documentationUrl = makeUrlAbsolute(card.documentationUrl)
    if(card?.iconUrl && !card.iconUrl.startsWith('http'))
        card.iconUrl = makeUrlAbsolute(card.iconUrl)
    if(card?.endpoints?.invoke && !card.endpoints.invoke.startsWith('http'))
        card.endpoints.invoke = makeUrlAbsolute(card.endpoints.invoke)
    if(card?.endpoints?.describe && !card.endpoints.describe.startsWith('http'))
        card.endpoints.describe = makeUrlAbsolute(card.endpoints.describe)
    if(card?.endpoints?.static){ /* NANDA */
        const endpoints = card.endpoints.static
        for(let i=0; i<endpoints.length; i++)
            if(endpoints[i]?.length && !endpoints[i].startsWith('http'))
                endpoints[i] = makeUrlAbsolute(endpoints[i])
    }
    if(card?.endpoints?.adaptive_resolver?.url && !card.endpoints.adaptive_resolver.url.startsWith('http'))
        card.endpoints.adaptive_resolver.url = makeUrlAbsolute(card.endpoints.adaptive_resolver.url)
    if(card?.url && !card.url.startsWith('http'))
        card.url = makeUrlAbsolute(card.url)
    card.provider.url = process.env.MYLIFE_ORIGIN
        ?? 'https://humanremembranceproject.org'
    ctx.set('Content-Type', 'application/json')
    if(!card){
        ctx.status = 404
        ctx.body = { error: `Agent card not found: ${agentId}` }
    } else
        ctx.body = card
}
/**
 * Validates and serves the A2A contract by id.
 * @param {Koa} ctx - Koa context
 * @returns {Promise<object>} - The A2A contract object
 */
async function a2aContract(ctx){
    const { contractId, } = ctx.params
    ctx.set('Content-Type', 'application/json')
    if(!contractId?.length){
        ctx.status = 400
        ctx.body = {
            error: {
                code: -32602,
                message: 'Contract ID is required in the path: GET `/contracts/:contractId`',
                data: {
                    type: 'missing_parameter'
                }
            }
        }
        return
    }
    const contract = findContract(contractId)
    if(!contract){
        ctx.status = 404
        ctx.body = {
            error: {
                code: -32601,
                message: `Contract: ${ contractId } NOT FOUND`,
                data: {
                    type: 'not_found',
                }
            }
        }
    } else {
        delete contract.preferredProviders
        contract.id = contractId
        ctx.status = 200
        ctx.body = contract
    }
}
/* private functions */
async function a2aHandler(ctx, params, skillId){
    const handler = mHandlers[skillId]
    if(!handler)
        return sendError(ctx, 501, -32601, `Handler not implemented for capability: ${skillId}`, { type: 'not_implemented' })
    const { avatar: Avatar, } = ctx.state
    if(!Avatar?.isMyLife)
        return sendError(ctx, 403, -32601, 'Incorrect Avatar is being requested from avatar is in use. Please contact technical support.', { type: 'forbidden' })
    const { sessionMeta={}, } = ctx.session
    try {   
        const response = (typeof handler === 'string')
            ? await Avatar.mcpFunction(handler, params, sessionMeta, ctx)
            : await handler(ctx, params)
        const parts = Array.isArray(response)
            ? response // already in A2A format
            : convertMCPToA2A(ctx, response)
        return parts
    } catch (err) {
        console.error(chalk.redBright(`A2A::${skillId} failed`), err)
    }
}
/**
 * Adds a JSON file's content to a provided object.
 * @param {*} obj - The target object
 * @param {*} fileName - The name of the file
 * @param {*} dir - The directory containing the file
 * @returns {Promise<void>}
 */
async function addFiletoObject(obj, fileName, dir){
    if(!fileName.endsWith('.json'))
        return
    const key = fileName.slice(0, -5) // no quicker methods in path
    if(!key?.length)
        return // skip empty keys
    const fullPath = path.join(dir, fileName)
    const _content = await fs.readFile(fullPath, 'utf-8')
    const contract = JSON.parse(_content)
    obj[key] = contract
}
/**
 * Retrieves the agent card from file by ID.
 * @param {string} agentId - The ID of the agent
 * @returns {object|null} - The agent card object or null if not found
 */
function agentCard(agentId){
    const agentCard = mAgentCards[agentId]
    return agentCard
}
/**
 * Converts MCP data to A2A data.
 * @param {Koa} ctx - Koa context
 * @param {object} mcpData - The MCP data to convert
 * @returns {object[]} - The converted A2A data
 */
function convertMCPToA2A(ctx, mcpData){
    const { data, error, instruction, kind, preface, response, result, success, tool, } = mcpData
    if(!!error || result?.isError)
        return sendError(ctx, 500, -32603, (error?.message ?? result?.content?.[0]?.text ?? 'Error locating error message in MCP data'), { type: 'internal_error' })
    let a2aParts = []
    const contents = result?.content
        ?? []
    if(response?.length)
        contents.push(...response)
    if(contents?.length)
        a2aParts = contents.reduce((acc, item)=>{
            if(!!item){
                let part
                switch(typeof item){
                    case 'string':
                        try { /* JSON string */
                            const data = JSON.parse(item)
                            if(data){
                                part = {
                                    kind: 'data',
                                    data: data,
                                }
                            }
                            break
                        } catch(err) { /* all other strings */
                            part = {
                                kind: 'text',
                                metadata: {
                                    responseType: 'string',
                                },
                                text: item,
                            }
                        }
                        break
                    case 'object':
                        if(Array.isArray(item)) // @todo - unclear if reachable, if so, with response being set to data array as in `getSharedMemories()`
                            break
                        // available `content.type` enum: ['audio', 'image', 'resource', 'text']
                        // [ref](https://modelcontextprotocol.io/specification/2025-03-26/server/tools#tool-result)
                        switch(item.type){
                            case 'audio':
                            case 'image':
                                // @todo - handle these types, especially if they are files
                                console.log(chalk.redBright(`a2a-functions.mjs::convertMCPToA2A()::Unsupported content type: ${item.type}`))
                                break
                            case 'resource':
                                // @todo - ascertain what the `resource` type does
                                console.log(chalk.redBright(`a2a-functions.mjs::convertMCPToA2A()::Resource support unclear.`))
                                break
                            case 'text':
                                part = {
                                    kind: 'text',
                                    text: item.text,
                                }
                                break
                            default:
                                // no type assigned, presume data object
                                part = {
                                    kind: 'data',
                                    data: item,
                                }
                        }
                        break
                    }
                if(part)
                    acc.push(part)
            }
            return acc
        }, [])
    /* direct data handoff from MCP */
    if(
            !!data
        &&  typeof data === 'object'
        &&  (
                    (Array.isArray(data) && data.length)
                ||  (!Array.isArray(data) && Object.keys(data).length)
            )
    )
        a2aParts.push({
            kind: 'data',
            data: data,
        })
    return a2aParts
}
/**
 * Extracts the parameters from a skill and data part.
 * @param {object} skill - The skill object
 * @param {object} dataPart - The data part object
 * @returns {object} - The extracted parameters
 */
function extractParameters(skill, dataPart){
    let params = dataPart?.parameters
        ?? dataPart?.params
        ?? dataPart?.args
        ?? dataPart?.arguments
        ?? dataPart?.data
        ?? dataPart,
        specifiedParams = {}
    if(!params || typeof params !== 'object')
        return specifiedParams
    if(Array.isArray(params))
        params = reduceDataArray(params)
    if(skill?.inputs?.length && Array.isArray(skill.inputs))
        specifiedParams = Object.entries(params)
            .reduce((acc, [key, value]) => {
                if(skill.inputs.some(input => input.id?.toLowerCase() === key.toLowerCase()))
                    acc[key] = value
                return acc
            }, {})
    return specifiedParams
}
/**
 * Extracts the skill and parameters from the a2a message parts.
 * @param {Object} card - The agent card object
 * @param {Object[]} parts - The parts of the a2a message
 * @returns {Object} - An object containing the extracted skill and parameters
 */
function extractSkill(card, parts=[]){
    let parameters,
        skill,
        skillId
    if(parts?.length){
        let dataParts = parts.filter(part=>part.kind === 'data')
            .map(part=>part.data)
        if(!dataParts?.length)
            dataParts = parts.filter(part=>part.kind === 'text')
                .map(part=>{
                    try {
                        const match = part.text?.match(/^{.*}$/s)
                        if(match?.length)
                            return JSON.parse(match[0])
                    } catch (error) {}
                    return {}
                })
        for(const dataPart of dataParts){
            if(!dataPart || typeof dataPart!=='object')
                continue // skip invalid data parts
            if(Array.isArray(dataPart))
                dataPart = reduceDataArray(dataPart)
            if(!Object.keys(dataPart).length)
                continue // skip empty data parts
            skillId = dataPart?.id
                ?? dataPart?.skill
                ?? dataPart?.skillid
                ?? dataPart?.skillId
                ?? dataPart?.skill_id
                ?? dataPart?.skill_Id
                ?? dataPart?.name
                ?? dataPart?.capability
            if(skillId?.length){
                skill = card.skills?.find(s=>s.id === skillId || s.name === skillId)
                if(!!skill){
                    parameters = extractParameters(skill, dataPart)
                    break // found the skill, cleaned params, no need to continue
                }
            }
        }
    }
    return {
        parameters,
        skill,
        skillId,
    }
}
/**
 * Retrieves the A2A contract by id/name.
 * @param {string} contractId - The name of the contract to retrieve
 * @returns {object|null} - The A2A contract object or null if not found
 */
function findContract(contractId){
    const contract = mContracts[contractId]
    return contract
        ?? null
}
/**
 * Logs a history item for a specific message ID.
 * @param {Koa} ctx - The Koa context
 * @param {string} messageId - The ID of the message
 * @param {object} data - The data to log
 * @returns {void}
 */
function historyLogItem(ctx, messageId, data){
    if(!ctx.session?.sessionMeta)
            ctx.session.sessionMeta = {}
    const { sessionMeta, }= ctx.session
    if(!sessionMeta?.history || !(sessionMeta.history instanceof Map))
        sessionMeta.history = new Map([
            [messageId, { request: ctx.request.body }]
        ])
    let historyItem = sessionMeta.history.get(messageId)
    historyItem = {
        ...historyItem,
        ...data,
    }
    sessionMeta.history.set(messageId, historyItem)
}
/**
 * Makes a URL absolute by prepending the origin if it does not start with 'http'.
 * @param {string} url - The URL to make absolute
 * @returns {string} - The absolute URL
 */
function makeUrlAbsolute(url){
    if(url?.length && !url.startsWith('http')){
        const origin = process.env.MYLIFE_ORIGIN
            ?? 'https://humanremembranceproject.org'
        if(!origin.endsWith('/') && !url.startsWith('/'))
            url = origin + '/' + url
        else if(origin.endsWith('/') && url.startsWith('/'))
            url = origin + url.slice(1) // remove leading slash
        else
            url = origin + url
    }
    return url
}
/**
 * Reduces an array of data parts into a single object.
 * @param {Array} dataArray - An array of data parts to reduce
 * @returns {object} - The reduced data object
 */
function reduceDataArray(dataArray){
    const data = dataArray.reduce((acc, part)=>{
        if(part && typeof part === 'object')
            if(part.key?.length && part.value !== undefined)
                acc[part.key] = part.value
            else if(Object.keys(part).length)
                Object.assign(acc, part)
        return acc
    }, {})
   return data
}
/**
 * Resolves the agent ID.
 * @private
 * @param {Koa} ctx - Koa context
 * @returns {string} - The resolved agent ID
 */
function resolveAgentId(ctx){
    let { agentId, } = ctx.params
    if(!agentId){
        agentId = ctx.state.avatar?.isMyLife
            ? 'q'
            : ctx.state.avatar?.id
    }
    return agentId
}
/**
 * Sends an error response in the Koa context.
 * @param {Koa} ctx - Koa context
 * @param {number} status - HTTP status code
 * @param {number} code - Error code
 * @param {string} message - Error message
 * @param {object} [data] - Additional error data
 * @returns {void}
 */
function sendError(ctx, status, code, message, data){
    ctx.status = status
    ctx.body = {
        error: {
            code: code,
            message: message,
            data: data
        }
    }
}
/* exports */
export {
    a2aCall,
    a2aCard,
    a2aContract,
}