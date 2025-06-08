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
    )
/* load agent cards */
try {
    const files = await fs.readdir(mAgentCardsPath)
    for(const file of files)
        await addFiletoObject(mAgentCards, file, mAgentCardsPath)
    console.log(chalk.blueBright(`Loaded A2A agent cards into memory from ${mAgentCardsPath}`))
} catch(err) {
    console.error(chalk.redBright(`Error loading A2A agent cards: ${err.message}`))
}
/* load contracts */
try {
    const files = await fs.readdir(mContractsPath)
    for(const file of files)
        await addFiletoObject(mContracts, file, mContractsPath)
    console.log(chalk.blueBright(`Loaded A2A contracts into memory from ${mContractsPath}`))
} catch(err) {
    console.error(chalk.redBright(`Error loading A2A contracts: ${err.message}`))
}
/* public functions */
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
    } else {
        const card = agentCard(agentId)
        ctx.set('Content-Type', 'application/json')
        if(!card){
            ctx.status = 404
            ctx.body = { error: `Agent card not found: ${agentId}` }
        } else
            ctx.body = card
    }
}
async function a2aCall(ctx){
    const agentId = resolveAgentId(ctx)
    const { avatar: Agent, } = ctx.state
    ctx.set('Content-Type', 'application/json')
    if(agentId==='q' && !Agent?.isMyLife){
        ctx.status = 403
        ctx.body = {
            error: {
                code: -32601,
                message: 'Incorrect Avatar is being requested from avatar is in use. Please contact technical support.',
                data: { type: 'forbidden' }
            }
        }
        return
    }
    const card = agentCard(agentId)
    const { capability, input, payload={}, } = ctx.request.body
    if(!capability?.length){
        ctx.status = 400
        ctx.body = {
            error: {
                code: -32602,
                message: 'Capability is required in the body: POST `/a2a/:agentId`',
                data: { type: 'missing_parameter' }
            }
        }
        return
    }
    const contract = findContract(capability)
    if(!contract){
        ctx.status = 403
        ctx.body = {
            error: {
                code: -32601,
                message: 'Incorrect Avatar is being requested from avatar is in use. Please contact technical support.',
                data: { type: 'forbidden' }
            }
        }
        return
    } else if(!card?.capabilities?.includes(capability)){
        ctx.status = 403
        ctx.body = {
            error: {
                code: -32601,
                message: `Agent ${ agentId } does not support capability: ${ capability }`,
                data: { type: 'forbidden' }
            }
        }
        return
    }
    console.log(chalk.blueBright(`A2A call to agent: ${ agentId } with capability: ${ capability }`), card)
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
/* exports */
export {
    a2aCard,
    a2aCall,
    a2aContract,
}