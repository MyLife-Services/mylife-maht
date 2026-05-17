/* imports */
import path from 'path'
import EventEmitter from 'events'
import { Marked } from 'marked'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import initRouter from './routes.mjs'
import AlphaDog from './agents/project/alpha-dog.mjs'
import AssetAgent from './agents/system/asset-agent.mjs'
import BotAgent from './agents/system/bot-agent.mjs'
import CollectionsAgent from './agents/system/collections-agent.mjs'
import ConnectorAgent from './agents/system/connector-agent.mjs'
import { Action, Campaign, Entry, Issue, Item, Memory, Stance, Value, } from './models.mjs'
import EvolutionAgent from './agents/system/evolution-agent.mjs'
import { ExperienceAgent, ShareAgent, } from './agents/system/experience-agent.mjs'
import LLMServices from './llm.mjs'
import { runFunctionCall } from "./services/tools.mjs"
import { mcpClientAllowsDirectory, mcpClientAllowsRequest, mcpClientRequest, } from './controllers/mcp-functions.mjs'
/* module constants */
const __dirpath = fileURLToPath(import.meta.url)
const mAllowSave = JSON.parse(
    process.env.MYLIFE_DB_ALLOW_SAVE
        ?? 'false'
)
const mDefaultRoutinePath = path.resolve(path.dirname(__dirpath), '..', 'json-schemas/routines/') + '/'
const mItemMap = {
    Action,
    Entry,
    Issue,
    Item,
    Memory,
    Stance,
    Value,
}
const mJsonRpcVersion = process.env.MCP_JSONRPC_Version,
    mJsonRpcProtocolVersion = process.env.MCP_JSONRPC_Protocol_Version,
    mMcpConstant = 'mylife-constant.'
const mMcpMap = { /* all returns SHOULD be in { error, result, success, values, }; **note**: values are new pseudo-primitivefor completion arrays */
    changeTitle: { /* no implicit call for this in Avatar instance */
        function: {
            args: ['itemId', 'title', 'factory'],
            fx: async (itemId, title, factory)=>{
                const { id, title: newTitle, } = ( await factory.updateItem({ id: itemId, title }) ?? {} )
                const success = id===itemId && newTitle===title
                const text = success
                    ? `TITLE for id: \`${ itemId }\` has been updated successfully: "${ newTitle }"`
                    : `FAILED to update TITLE from "${ title }" to "${ newTitle }" for id: (${ itemId })`
                const type = 'text'
                const result = {
                    content: [{ text, type, }],
                    isError: !success,
                }
                return {
                    result,
                    success,
                }
            },
        },
    },
    createSummary: { /* no implicit call for this in Avatar instance */
        function: {
            args: ['mcpData', `${ mMcpConstant }POST`],
            fx: 'item',
            fxCallback: (responseObject)=>{
                const result = { content: [], isError: true, }
                const { instruction, item, responses, success, } = responseObject
                result.isError = !success
                if(!!item && success){
                    result.content.push({
                        text: JSON.stringify(item),
                        type: 'text',
                    })
                    result.structuredContent = item
                } else if(responses?.length)
                    result.content = responses.map(response=>({
                        text: response?.message
                            ?? response?.content
                            ?? JSON.stringify(response),
                        type: 'text',
                    }))
                else
                    result.content.push({
                        text: `No item created from summary`,
                        type: 'text',
                    })

                return { result, success, }
            },
        },
    },
    getMemories: { /* no implicit call for this in Avatar instance */
        function: {
            fx: async function (){
                console.log( 'mcpMap.getMemories::avatar', this)
                const preface = 'Here are the titles and ids (display only titles for human member) for the memories we have created together:\n'
                const response = ( await this.bot(undefined, 'biographer').collections() )
                    .map(item=>({
                        id: item.id,
                        title: item.title,
                    }))
                const success = response?.length > 0
                const responseArrayName = 'memories'
                return {
                    preface,
                    response,
                    responseArrayName,
                    success,
                }
            },
        },
    },
    endReliving: {
        function: {
            args: [],
            fx: 'endMemory',
        },
    },
    logout: {
        function: {
            args: ['ctx', 'avatar'],
            fx: (ctx, avatar)=>{
                avatar.logout(ctx)
                // @todo - close any open runs? or push this to `mcp-functions.mjs` as `import`?
                // @todo - use sessionMeta to remove any lingering app-level datasets
                return {
                    result: {
                        content: [{
                            text: 'You have been successfully logged out of MyLife.',
                            type: 'text',
                        }],
                    },
                    success: true,
                    toolListChanged: true,
                }
            },
        },
    },
    publicBots:{
        completion: {
            fx: function (){ /* must be return array */
                const typeEnum = ['avatar', 'biographer', 'diary', 'journaler']
                return typeEnum
            }
        },
        resource: {
            args: ['type'],
            fx: async function (type='avatar'){
                const bot = await this.genericBot(type)
                console.log( 'mcpMap.publicBots::bot', bot, typeof this.genericBot)
            }
        }
    },
    publicMemories: { /* resource version */
        completion: {
            args: ['title'],
            fx: async function (title){
                let memories = await this.sharedMemories(100, { title, })
                memories = memories.map(memory=>memory.title)
                return memories
            }
        },
        resource: {
            args: ['anonymous', 'guessable', 'title', 'sessionMeta'],
            fx: async function (anonymous, guessable, titleSearch, sessionMeta){
                anonymous = anonymous===null || anonymous==='' ? undefined : anonymous
                guessable = guessable===null || guessable==='' ? undefined : guessable
                titleSearch = titleSearch===null || !titleSearch?.length ? undefined : titleSearch
                const uri = `public-memory://search?anonymous=${ anonymous }&guessable=${ guessable }&title=${ titleSearch }`
                let error,
                    resourceContent=sessionMeta.resources.get(uri),
                    resourceListChanged=false,
                    result,
                    success=false
                const memories = await this.sharedMemorySearch(anonymous, guessable, undefined, undefined, titleSearch)
                if(!memories?.length)
                    return {
                        error: {
                            code: -32603,
                            data: { titleSearch, },
                            message: `No public memories contain the string: "${ titleSearch }".`,
                        },
                        success: false,
                    }
                if(!resourceContent){ /* create proxy resource */
                    const mimeType = 'application/json'
                    const name = 'mylife-shared-memory-search-results'
                    const text = JSON.stringify(memories)
                    const title = `MyLife Public Memory Search Results (anonymous=${ anonymous }&guessable=${ guessable }&title=${ titleSearch })`
                    sessionMeta.resources.set(uri,
                        {
                            mimeType,
                            name,
                            text,
                            title,
                            uri,
                        })
                    resourceContent = sessionMeta.resources.get(uri)
                    resourceListChanged = true
                }
                result = { contents: [resourceContent], isError: false, }
                return {
                    error,
                    resourceListChanged,
                    result,
                    success,
                }
            }
        }
    },
    publicMemory: { /* resource version */
        completion: {
            args: ['itemId'],
            fx: async function (itemId){ /* must be return array */
                const searchObject = { id: itemId, }
                let memories = await this.sharedMemories(100, searchObject)
                memories = memories.map(memory=>memory.id)
                return memories
            }
        },
        function: {
            args: ['itemId'],
            fx: 'sharedMemory',
            fxCallback: async function (responseObjects){
                const { responses, success=false, } = responseObjects?.[0]
                    ?? {}
                if(!responses?.length) /* sharedMemory compelled into array */
                    return []
                return responses.map(response=>
                    response?.message
                        ?? response?.content
                        ?? response?.title
                        ?? response
                )
            }
        },
        resource: {
            args: ['itemId', 'sessionMeta'],
            fx: async function (requestId, sessionMeta){
                let error,
                    mimeType = 'text/markdown',
                    name = 'mylife-public-memory',
                    resourceContent=sessionMeta.resources.get(requestId),
                    resourceListChanged=false,
                    result,
                    success=false,
                    text,
                    title='MyLife Public Memory',
                    uri='public-memory://' + requestId
                if(!resourceContent){ /* create proxy resource */
                    sessionMeta.resources.set(requestId, {
                        mimeType,
                        name,
                        text,
                        title,
                        uri,
                    })
                    resourceListChanged = true
                    /* create share */
                    const shareHeader = await this.shareMemory(requestId) /* `shareMemory()` returns header */
                    const { anonymous, guessable, id, itemId: shareItemId, shareId, title: shareTitle, type, warnings, } = shareHeader
                    if(!id?.length)
                        return { 
                            error: {
                                code: -32603,
                                data: { requestId, },
                                message: `This share was not able to be established, please check the share itemId: ${ shareItemId } and try again. If the problem persists, please contact support.`,
                            }
                        }
                    /* update sessionMeta */
                    shareHeader.unconfirmed = true
                    sessionMeta.shares.set(id, shareHeader)
                    const newUri = `public-memory://${ id }`
                    const resourceContentShareVersion = sessionMeta.resources.get(requestId)
                    resourceContentShareVersion.id = id
                    resourceContentShareVersion.shareId = requestId
                    resourceContentShareVersion.text = `Share instance found at new uri: \`${ newUri }\``
                    resourceContentShareVersion.title = `Experience MyLife Shared Memory: ${ shareTitle } [${ shareId }]`
                    /* create new resource content for instance */
                    text = `I have created a Share instance for: "${ shareTitle }" (id: ${ id })\n`
                    if(warnings?.length)
                        text += `**Content Warnings** were found for this shared memory: ${ warnings }; please share these triggers with the human. If they wish to proceed after acknowledging, follow the standard instructions below.\n`
                    text += `## Instructions\nThis shared memory has already been divided up into scenes. The new resource will provide each scene in sequence when its personal and protected instance is requested: \`${ newUri }\` (note: intentionally a new uuid from the one in this call for privacy and security reasons).\nShare each text content scene with your human operator (feel free to flourish, if that is part of your functionality). After sharing the scene, allow the human operator to respond with any insights, additions or alterations. This \`human-operator-input\` content can be appended to the uri as an \`input\` query parameter as: \`${ newUri }?input=human-operator-input\`\n.`
                    if(anonymous)
                        text += `\n\n**Note**: This share is anonymous, so the human operator will not be able to see who created it.`
                    if(guessable)
                        text += `\n\n**Note**: This share is guessable, so the human operator can choose at any time to guess the identity of the creator; offer the human operator the opportunity to makes such a guess, and their guess can be included as a query parameter: \`${ uri }?guess=human-operator-guess\`. *Be Aware*: A guess will NOT move the scene forward *unless* an \`input\` query parameter is *also* provided.`
                    resourceContent = {
                        mimeType,
                        name,
                        text,
                        title: `Experience MyLife Shared Memory: "${ shareTitle }" [${ shareId }]`,
                        uri: newUri,
                    }
                    sessionMeta.resources.set(id, resourceContent) /* instance accessible via shareId resource */
                    resourceListChanged = true
                    success = true
                    return {
                        error,
                        resourceListChanged,
                        result: {
                            contents: [sessionMeta.resources.get(id)],
                        },
                        success,
                    }
                }
                const share = sessionMeta.shares.get(requestId)
                    ?? sessionMeta.shares.get(resourceContent?.id) /* route proxy `shareId` resource */
                if(!share)
                    return {
                        error: {
                            code: -32603,
                            data: { requestId, resourceContent, },
                            message: `This share was not able to be established, please check the share id: ${ requestId } and try again. If the problem persists, please contact support.`,
                        }
                    }
                /* Share instance */
                const Share = await this.share(share.id)
                if(share.unconfirmed){ /* start share */
                    if(!Share)
                        return {
                            error: {
                                code: -32603,
                                data: { id: Share.instanceId, requestId, },
                                message: `This share was not able to be established, please check the share id: ${ share.id } and try again. If the problem persists, please contact support.`,
                            }
                        }
                    if(share.warnings?.length)
                        Share.acceptWarnings()
                    share.unconfirmed = false
                }
                await this.shareMemory(Share.instanceId) // modifies Share internally
                const { id, previousScene, title: shareTitle, } = Share
                resourceContent.text = `## Continuing Share: "${ shareTitle }" (id: ${ id })\nShare each text content scene with your human operator (feel free to flourish, if that is part of your functionality). After sharing the scene, allow the human operator to respond with any insights, additions or alterations. This \`human-operator-input\` content can be appended to the uri as an \`input\` query parameter as: \`${ uri }?input=human-operator-input\`.\n## SCENE\n${ JSON.stringify(previousScene) }`
                result = {
                    contents: [sessionMeta.resources.get(requestId)],
                }
                success = true
                return {
                    error,
                    resourceListChanged,
                    result,
                    success,
                }
            }
        }
    },
    sharedMemorySearch: { /* prompt version */
        completion: {
            args: ['anonymous', 'guessable', 'keyword', 'phase', 'title'],
            fx: 'sharedMemorySearch',
            fxCallback: (values)=>{
                const returnValues = values.map(value=>value.title.trim())
                return returnValues
            }
        },
    },
    // add mappings as needed
}
const mMcpTools = await mInitializeExternalTools(
    'mcp',
    path.resolve(path.dirname(__dirpath), '..', 'json-schemas/mcp/tools/')
)
/**
 * @class - Avatar
 * @extends EventEmitter
 * @description An avatar is a digital self proxy of Member. Not of the class but of the human themselves - they are a one-to-one representation of the human, but the synthetic version that interopts between member and internet when inside the MyLife platform. The Avatar is the manager of the member experience, and is the primary interface with the AI (aside from when a bot is handling API request, again we are speaking inside the MyLife platform).
 */
class Avatar extends EventEmitter {
    #alertsShown = [] // array of alert ids
    #alphaDog
    #assetAgent
    #backupResponses = []
    #frontendInstructions = []
    #botAgent
    #collectionsAgent
    #connectorAgent // connector agent for external proxy agents
    #evolver
    #experienceAgent
    #experienceGenericVariables = {
        age: undefined,
        birthdate: undefined,
        birthplace: undefined,
        interests: undefined,
        memberName: undefined,
        memberFirstName: undefined,
        name: undefined, // memberName
        nickname: undefined,
    } // object of experience variables, comprise `system` "hard-coded" variables
    #factory // do not expose
    #livedExperiences = [] // array of ids for lived experiences
    #livingExperience
    #livingMemory
    #llmServices
    #mcp = {
        capabilities: {
            tools: {
                listChanged: true
            }
        },
        instructions: 'I am a version of your avatar, and I can log you in to MyLife. Once logged in, we can work together as intended, or I can switch you to a different MyLife bot.',
        jsonrpc: mJsonRpcVersion,
        protocolVersion: mJsonRpcProtocolVersion,
        serverInfo: {
            name: 'MyLife MCP Member Avatar',
            version: '1.1',
        },
    }
    #mode = 'standard' // interface-mode from module `mAvailableModes`
    #nickname // avatar nickname, need proxy here as g/setter is "complex"
    #sessionId
    #setupComplete
    #ShareAgent
    #vectorstoreId // vectorstore id for avatar
    /**
     * @constructor
     * @param {MyLifeFactory|AgentFactory} factory - The factory on which avatar relies for all service interactions.
     * @param {LLMServices} llmServices - The LLM services object
     */
    constructor(factory, llmServices){
        super() // EventEmitter
        this.#factory = factory
        this.#llmServices = llmServices
        this.#assetAgent = new AssetAgent(this.#factory, this.#llmServices)
        this.#botAgent = new BotAgent(this.#factory, this.#llmServices)
        this.#collectionsAgent = new CollectionsAgent(this.#factory, this.#llmServices)
        this.#connectorAgent = new ConnectorAgent(this.#factory, this.#llmServices)
        this.#ShareAgent = new ShareAgent({ instanceStartTime: Date.now() }, this, this.#factory, this.#llmServices)
    }
    /**
     * Initialize the Avatar class.
     * @todo - create class-extender specific to the "singleton" MyLife avatar
     * @todo - rethink architecture on this/#factory and also evolver, as now would manifest more as vectorstore object
     * @async
     * @public
     * @returns {Promise} Promise resolves to this Avatar class instantiation
     */
    async init(){
        await mInit(this.#factory, this.#llmServices, this, this.#botAgent, this.#assetAgent, this.#vectorstoreId) // mutates and populates
        /* experience variables */
        this.#experienceGenericVariables = mAssignGenericExperienceVariables(this.#experienceGenericVariables, this)
        this.#experienceAgent = new ExperienceAgent({}, this.#botAgent, this.#llmServices, this.#factory, this, this.#experienceGenericVariables)
        return this
    }
    /* external API functions */
    /**
     * This section specifically refers to items that return the full `response` object: { error, instruction, item, responses, success, }
     */
    /**
     * Processes and executes incoming chat request.
     * @external
     * @param {string} message - The chat message content
     * @param {Guid} itemId - The active collection-item id (optional)
     * @returns {object} - The response object { instruction, responses, success, }
    */
    async chat(message, itemId){
        if(!message)
            throw new Error('No message provided in context')
        const originalMessage = message
        let responses = [],
            success = false
        if(this.globals.isValidGuid(itemId)){
            let { summary, } = await this.#factory.item(itemId)
            if(summary?.length)
                message = `**active-item**: itemId=${ itemId }\n`
                    + `**member-input**:\n`
                    + message
                    + `\n**newest-summary**:\n`
                    + summary
        }
        const Conversation = await this.activeBot.chat(message, originalMessage, mAllowSave, this)
        responses = mPruneMessages(this.activeBotId, Conversation.getMessages(true, true) ?? [], 'chat', Conversation.processStartTime)
        if(responses.length)
            success = true
        else {
            success = Conversation.interceptSuccess ?? false
            delete Conversation.interceptSuccess
        }
        return mBuildResponse(this, { responses, success })
    }
    /**
     * End the living memory, if running.
     * @external
     * @param {Guid} itemId - The active collection-item id for the living memory
     * @param {boolean} respond - Whether to return the Response Object (false when called by llm)
     * @returns {object} - The response object { instruction, item, responses, success, }
     */
    async endMemory(itemId){
        if(!this.#livingMemory)
            return
        const { Conversation, id, item, } = this.#livingMemory
        const { botId, thread_id, } = Conversation
        const bot = this.bot(botId)
        if(mAllowSave)
            await Conversation.save()
        this.frontendInstructions = {
            command: `endMemory`,
            itemId: item.id,
        }
        const responses = [{
            agent: bot.type.replace('personal-', ''),
            message: `I've ended the memory, thank you for letting me share my interpretation. I hope you liked it.`,
            type: 'system'
        }]
        this.#livingMemory = null
        this.#llmServices.deleteConversation(thread_id) // no await
        return mBuildResponse(this, { item, responses, success: true, })
    }
    /**
     * Manages a collection item's functionality.
     * @external
     * @param {Object} item - The item data object
     * @param {String} method - The http method used to indicate response
     * @returns {Promise<Object>} - Returns { instruction, item, responses, success, }
     */
    async item(itemData, method='get', raw=false){
        const { assistantType, id: itemId, } = itemData
        const { globals, mbr_id, } = this
        const message = {
                agent: 'server',
                message: `I'm sorry - I encountered an error while trying to fill your item request. Please try again.`,
                type: 'system',
            },
            responses = []
        let { form, summary, title, type=this.activeBot.type, } = itemData
        let item,
            Item,
            success = false
        switch(method.toLowerCase()){
            case 'delete': {
                message.message = `I encountered an error while trying to delete your item, id: ${ itemId }.`
                success = await this.#factory.deleteItem(itemId)
                if(!success)
                    break
                this.frontendInstructions = { command: 'removeItem', itemId, }
                message.message = `I have successfully deleted your item from the collection.`
                break
            }
            case 'post': { /* create */
                message.message = `I encountered an error while creating: "${ title ?? itemId }".`
                Item = mItem(itemData, this, this.#llmServices)
                success = !!Item && globals.isValidGuid(Item?.id)
                if(!success)
                    break
                Item.create() // remove `await`
                this.frontendInstructions = { command: 'createItem', item: Item.item, itemId, }
                message.message = `Item successfully created: "${ Item.title }".`
                success = true
                if(!raw)
                    Item = null
                break
            }
            case 'put': { /* update */
                message.message = `I encountered an error while trying to update: "${ title ?? itemId }".`
                const itemDatabase = await this.#factory.item(itemId)
                if(!itemDatabase)
                    break
                Item = await mItem(itemDatabase, this, this.#llmServices)
                success = !!Item && globals.isValidGuid(Item?.id)
                if(!success)
                    break
                Item.update(itemData, true) // no await needed
                this.frontendInstructions = { command: 'updateItem', item: Item.item, itemId, }
                message.message = `I have successfully updated: "${ Item.title }".`
                success = true
                if(!raw)
                    Item = null
                break
            }
            case 'get':
            default: {
                const itemDatabase = await this.#factory.item(itemId)
                if(!itemDatabase)
                    break
                Item = await mItem(itemDatabase, this, this.#llmServices)
                success = !!Item && globals.isValidGuid(Item?.id)
                break
            }
        }
        if(raw)
            return Item
        if(Item)
            item = Item.item
        if(success){
            message.agent = this.activeBot.type
            message.type = 'chat'
        }
        responses.push(message)
        return mBuildResponse(this, { item, responses, success })
    }
    /**
     * Migrates a chat conversation from an old thread to a newly created conversation thread.
     * @external
     * @param {string} botId - The bot id
     * @returns {object} - The response object { instruction, responses, success, }
     */
    async migrateChat(botId){
        return await this.retireBot(botId) /* currently retireBot is the same as migration, since the bot continues to have a conversation */
    }
    /**
     * Given an itemId, obscures aspects of contents of the data record. Obscure is a vanilla function for MyLife, so does not require intervening intelligence and relies on the factory's modular LLM. **Note**: the response is captured midway through the process and stored in Avatar.backupResponses.
     * @external
     * @param {Guid} iid - The item id
     * @returns {object} - The standard response object { instruction, responses, success, }
     */
    async obscure(iid){
        const success = await this.#factory.obscure(iid, this)
        return mBuildResponse(this, { success, })
    }
    /**
     * Member request to retire a bot.
     * @external
     * @param {Guid} botId - The id of Bot to retire
     * @returns {object} - The Response object: { instruction, responses, success, }
     */
    async retireBot(botId){
        const bot = this.bot(botId)
        const defaultType = this.team()?.defaultActiveType
            ?? 'avatar'
        const response = {
            agent: 'server',
            message: `I'm sorry - I encountered an error while trying to retire this bot; please try again.`,
            type: 'system',
        }
        const success = await this.#botAgent.botDelete(botId)
        const successor = this.bot(null, defaultType).id
        if(success){
            this.frontendInstructions = {
                command: 'removeBot',
                id: botId,
            }
            response.agent = successor.type
            response.message = `I have removed ${ bot?.name || 'the requested bot' } from the team`
            response.type = 'chat'
        }
        if(successor && this.activeBotId!==successor)
            this.frontendInstructions = {
                command: 'setActiveBot',
                displayGreeting: false,
                id: successor,
            }
        return mBuildResponse(this, {
            responses: [response],
            success,
        })
    }
    /**
     * Currently only proxy for `migrateChat`.
     * @external
     * @param {string} botId - Bot id with Conversation to retire
     * @returns {object} - The response object { instruction, responses, success, }
     */
    async retireChat(botId){
        const message = {
                agent: 'server',
                message: `I'm sorry - I encountered an error while trying to retire this conversation; please try again.`,
                type: 'system',
            },
            responses = [],
            success = false
        if(await this.#botAgent.migrateChat(botId)){
            message.agent = this.bot(botId)?.name ?? message.agent
            message.message = `I have successfully retired this conversation.`
            success = true
        }
        responses.push(message)
        return mBuildResponse(this, { responses, success, })
    }
    /**
     * Summarize the file indicated.
     * @external
     * @param {string} fileId 
     * @param {string} fileName 
     * @param {number} processStartTime 
     * @returns {Object} - The response object { error, instruction, responses, success, }
     */
    async summarize(fileId, fileName, processStartTime=Date.now()){
        /* validate request */
        let responses = [],
            success = false
        this.backupResponses = {
            agent: 'server',
            message: `I received your request to summarize, but an error occurred in the process. Perhaps try again with another file.`,
            type: 'system',
        }
        /* execute request */
        responses.push(...await this.#botAgent.summarize(fileId, fileName, processStartTime))
        /* respond request */
        if(responses?.length){
            responses = mPruneMessages(this.avatar.id, responses, 'mylife-file-summary', processStartTime)
            success = true
        }
        return mBuildResponse(this, { responses, success, })
    }
    /* public functions */
    /**
     * Accepts share warnings and plays the shared memory.
     * @param {Guid} instanceId - The share instance id
     * @returns {Boolean} - Whether or not warnings were accepted
     */
    acceptShareWarnings(instanceId){
        const response = this.#ShareAgent.acceptWarnings(instanceId)
        return response
    }
    /**
     * Returns a specific alert.
     * @param {Guid} aid - The alert id
     * @returns {Promise<object>} - The alert object
     */
	async alert(aid){
		return this.#factory.getAlert(aid)
	}
    /**
     * Returns all alerts of a certain type for the member/visitor.
     * @param {String} type - The type of alert
     * @returns {Promise<object[]>} - The array of alerts
     */
	async alerts(type){
		let currentAlerts = this.#factory.alerts
		currentAlerts = currentAlerts // remove alerts already shown to member in this session
			.filter(alert=>{
				return !this.#alertsShown.includes(alert.id)
			})
		currentAlerts.forEach(alert=>{
			this.#alertsShown.push(alert.id)
		})
		return currentAlerts
	}
    /**
     * Creates AlphaDog instance.
     * @param {object} data - The data object for AlphaDog (originally `ctx.request.body`)
     * @param {string} method - The method used for request (originally `ctx.request.method`)
     * @returns {Promise<void>} - The response object
     */
    async alphaDogAlert(){
        if(!this.#alphaDog)
            this.#alphaDog = await ( new AlphaDog(this.#llmServices, this.#factory) )
                .init()
    }
	/**
	 * Retrieves all public experiences (i.e., owned by MyLife).
	 * @returns {Object[]} - An array of the currently available public experiences.
	 */
	async availableExperiences(){
		const experiences = ( await this.#factory.availableExperiences(this.mbr_id) )
			.map(experience=>{ // map to display versions [from `avatar.mjs`]
				const { autoplay=false, description, id, name, purpose, skippable=true,  } = experience
				return {
					description,
					id,
					name,
					purpose,
				}
			})
		return experiences
	}
	/**
	 * Retrieves Bot instance by id or type, defaults to personal-avatar.
	 * @param {Guid} botId - The Bot id (optional, defaults to avatar)
	 * @param {String} botType - The Bot type (optional, defaults to avatar)
	 * @returns {Promise<Bot>} - The Bot instance
	 */
    bot(botId, botType){
        const Bot = this.#botAgent.bot(botId, botType)
        return Bot
    }
    /**
     * Retrieves buttons for a specified bot.
     * @param {Guid} botId - The Bot id
     * @returns {Object[]} - Array of bot button objects: { endpoint, id, label, order, type, value, }
     */
    botButtons(botId){
        const { buttons, }= this.bot(botId)
        return buttons
    }
    /**
     * Retrieves options for a specified bot.
     * @param {Guid} botId - The Bot id
     * @returns {Object[]} - Array of bot option objects: { endpoint, id, label, order, type, value, }
     */
    botOptions(botId){
        const { options, }= this.bot(botId)
        return options
    }
    /**
     * Grants or revokes access to a proxy Agent for a specific MyLife bot.
     * @param {Guid} proxyId - The proxy Agent id
     * @param {Guid} botId - The Bot id
     * @param {Boolean} grant - Whether to grant or revoke access
     * @returns {Promise<Boolean>} - Whether the operation was successful
     */
    async botProxyAccess(proxyId, botId, grant){
        const result = this.#botAgent.proxyAccess(proxyId, botId, grant)
        return result
    }
    /**
     * Creates a proxy bot for external A2A agent interaction. Currently for NANDA test.
     * @param {object} botData - The bot data object
     * @returns {Promise<object>} - The response object
     */
    async botProxyCreate(botData){
        const { id: teamId, ...data } = botData
        data.object_id = this.id
        data.access = [this.avatar.id] // avatar always has access
        const proxyBot = await this.#connectorAgent.createProxy(data)
        if(!proxyBot?.id?.length)
            throw new Error('Proxy Agent creation failed, please review: ' + ( proxyBot?.error ?? 'unknown error' ))
        this.#botAgent.addProxy(proxyBot, teamId)
        return proxyBot
    }
    /**
     * Refreshes the endpoint of a proxy bot by calling the connector agent's refresh function, which pings the external A2A agent for an updated endpoint and updates the proxy bot in place with the new endpoint. Currently for NANDA test.
     * @param {Guid} proxyId - The proxy Agent id
     * @returns {Promise<object>} - The response object with updated bot instance
     */
    async botProxyRefresh(proxyId){
        const Proxy = this.#botAgent.bot(proxyId)
        if(!Proxy)
            return {
                error: 'Proxy Agent does not exist, cannot refresh endpoint.',
                success: false,
            }
        const { isProxy=false, url, } = Proxy
        if(!isProxy)
            return {
                error: 'Proxy Agent is not a proxy bot, cannot refresh endpoint.',
                success: false,
            }
        const botData = await this.#connectorAgent.refreshProxy(url) // mutates Proxy in place
        botData.id = proxyId
        return this.updateBot(botData)
    }
    /**
     * Clears backup responses stored on the avatar instance. Backup responses are used to store responses for potential reuse in case of errors or other issues during response generation.
     */
    clearBackupResponses(){
        this.#backupResponses = []
    }
    /**
     * Clears frontend instructions stored on the avatar instance. Frontend instructions are used to store instructions for the frontend to execute, such as updating the UI or triggering certain actions based on avatar interactions.
     */
    clearFrontendInstructions(){
        this.#frontendInstructions = []
    }
    /**
     * Get member collection items.
     * @todo - trim return objects based on type
     * @param {string} type - The type of collection to retrieve, `false`-y = all
     * @returns {Promise<Object[]>} - The collection items with no wrapper
     */
    async collections(type){
        if(type==='file'){
            await this.#assetAgent.init(this.#vectorstoreId)
            return this.#assetAgent.files
        }
        const collections = ( await this.#factory.collections(type) ?? [] )
            .map(item=>{
                switch(type){
                    case 'entry':
                    case 'memory':
                        return mPruneItem(item)
                    case 'experience':
                    case 'lived-experience':
                        const {
                            completed=true,
                            description,
                            experience_date=Date.now(),
                            experience_id,
                            id: experienceId,
                            title,
                            variables,
                        } = item
                        return {
                            completed,
                            description,
                            experience_date,
                            experience_id,
                            id: experienceId,
                            title,
                            variables,
                        }
                    case 'story':
                        throw new Error('Story collection not yet implemented.')
                    default:
                        return item
                }
            })
        return collections
    }/**
     * Configures the avatar's active bot and related settings based on provided parameters such as bot id, advertisement id, platform id, member id, etc. This function retrieves the active bot's configuration and applies any relevant advertisement or platform-specific variables to the bot's prompt variables. It returns a response object containing the active bot, instructions, missions, responses, routine, success status, variables, version, and version update information.
     * @param {object} params - The parameters for configuring the avatar, which may include:
     *   - adaid: Advertisement id (optional)
     *   - aid: Advertisement id (optional)
     *   - bid: Bot id (optional)
     *   - mbr: Member id (optional)
     *   - mid: Member id (optional)
     *   - vld: Validation id (optional)
     *   - type: Type of configuration (optional)
     * @returns {Promise<object>} - The response object containing the configuration details.
     */
    async configure(params={}){
        const { adaid, aid, bid, mbr, mid, vld, type, ...rest } = params
        const response = {
            activeBot: undefined,
            instructions: undefined,
            missions: undefined,
            responses: [{
                agent: 'avatar',
                message: `I'm sorry, I experienced an error while trying to load and confure my settings. Please try again later, and if the problem persists, contact support.`,
                role: 'system',
                type: 'greeting',
            }],
            routine: undefined,
            success: false,
            variables: { ...rest },
            version: undefined,
            versionUpdate: undefined,
        }
        const { activeBot=this.activeBot, greeting: activeGreeting, id, instructions, success, variables={}, ...activeBotResponse } = await this.setActiveBot(bid)
        activeBot.promptVariables = variables // cascade-00: bot variables from TEMPLATE, lowest priority
        activeBot.promptVariables = rest // cascade-01: raw URL params, lowest priority
        response.success = success
        if(!response.success)
            return response
        response.activeBot = activeBot ?? id
        let requestGreeting = activeGreeting
        if(aid?.length){
            const { being: campaignBeing, campaign_id: campaign_id, content: campaignContent, id: campaignId, mbr_id: campaignMemberId, name: campaignName, platforms: campaignPlatforms, title: campaignTitle, variables: campaignVariables, ...restCampaign } = await this.#factory.campaign(aid) ?? {}
            if(typeof campaignVariables === 'object' && Object.keys(campaignVariables)?.length)
                activeBot.promptVariables = campaignVariables // cascade-02: campaign variables
            const { copy: campaignPlatformCopy, greeting: campaignPlatformGreeting, id: campaignPlatformId, name: campaignPlatformName, site: campaignPlatformSite, variables: campaignPlatformVariables, } = campaignPlatforms?.[adaid] ?? {}
            if(typeof campaignPlatformVariables === 'object' && Object.keys(campaignPlatformVariables)?.length)
                activeBot.promptVariables = campaignPlatformVariables // cascade-03: campaign platform variables
            const { id: advertId, platforms={}, variables=[], ...advertisement } = this.activeBot.ads?.[aid] ?? {}
            if(!!advertisement)
                activeBot.promptVariables = advertisement // cascade-04: bot advertisement incidental variables
            if(variables?.length)
                activeBot.promptVariables = variables // cascade-05: Bot advertisement defined variables
            const { copy, greeting: platformGreeting, id: platformId, name, site, variables: platformVariables, ...platform } = platforms?.[adaid]
                    ?? platforms?.[0] // case of array
                    ?? Object.values(platforms)?.[0] // case of object
                    ?? {}
            activeBot.promptVariables = platform // cascade-06: Bot platform advertisement incidental variables
            activeBot.promptVariables = platformVariables // cascade-07: Bot platform advertisement defined variables
            activeBot.promptVariables.aid = aid
            activeBot.promptVariables.adaid = adaid
            requestGreeting = platformGreeting ?? requestGreeting
            const { responses, routine, success, } = await this.#botAgent.greeting(true, requestGreeting)
            activeBotResponse.responses = responses.map(response=>mPruneMessage(this.activeBotId, response.message, 'greeting', activeBotResponse.processStartTime))
        }
        response.instructions = instructions
        Object.assign(response, activeBotResponse)
        return response
    }
    /**
     * Start a new conversation.
     * @param {String} type - The type of conversation, defaults to `chat`
     * @param {String} form - The form of conversation, defaults to `member-avatar`
     * @param {String} mbr_id - The member id (optional)
     * @returns {Promise<Conversation>} - The Conversation instance
     */
	async conversationStart(type='chat', form='member-avatar', mbr_id){
        const Conversation = await this.#botAgent.conversationStart(type, form, undefined, undefined, mbr_id)
        return Conversation
    }
    /**
     * Create a new bot.
     * @param {Object} botData - The bot data object, requires type.
     * @returns {Object} - The new bot.
     */
    async createBot(botData){
        const Bot = await this.#botAgent.botCreate(botData)
        const bot = Bot.bot
        return bot
    }
    /**
     * Deletes a chat conversation from llm and memory.
     * @param {Conversation} Conversation - The conversation instance to delete
     * @param {Boolean} localDelete - Whether to delete locally or from database, defaults to `true`
     * @returns {Promise<String>} - The deleted conversation instance id
     */
    async deleteChat(Conversation, localDelete=true){
        const { id, } = await this.#botAgent.deleteChat(Conversation, localDelete)
        return id
    }
    /**
     * Deletes a share from MyLife `shares` container and associated object (get itemId from `share` itself).
     * @param {Guid} sid - The Share id
     * @returns {Promise<Boolean>} - Success or failure of the operation
     */
    async deleteShare(sid){
        return await this.#ShareAgent.delete(sid)
    }
	/**
	 * Submits a new diary or journal entry to MyLife. Currently called both from API _and_ LLM function.
     * @todo - deprecate to `item` function
	 * @param {object} entry - Entry item object
	 * @returns {object} - The entry document from Cosmos
	 */
	async entry(entry){
		const defaultForm = 'journal'
		const type = 'entry'
		const {
			form=defaultForm,
		} = entry
		entry = {
			...entry,
			...{
			form,
            type,
		}}
		return await this.item(entry, 'POST')
	}
    /**
     * Given an itemId, evaluates aspects of item summary. Evaluate content is a vanilla function for MyLife, so does not require intervening intelligence and relies on the factory's modular LLM.
     * @param {Guid} itemId - The item id
     * @returns {Object} - The Response object { instruction, responses, success, }
     */
    async evaluate(itemId){
        const response = await this.#botAgent.evaluate(itemId)
        if(response.success && response.responses.length)
            response.responses = mPruneMessages(this.activeBotId, response.responses, 'evaluation', response.processStartTime)
        return response
    }
    /**
     * Starts, continues or resumes a specific experience.
     * @param {Guid} xid - The experience id
     * @param {object} memberInput - Member input object
     * @returns {object} - The frontend response object: { error, experience, instruction, success, }
     */
    async experience(xid, memberInput){
        const Experience = await this.#experienceAgent.experience(xid, memberInput)
        const experience = mPruneExperience(Experience)
        // add frontend instructions here
        const response = {
            instructions: this.frontendInstructions,
            experience,
            success: true,
        }
        return response
    }
    /**
     * Ends the specified experience.
     * @param {Guid} xid - The experience id
     * @returns {void}
     */
    experienceEnd(xid){
        this.#experienceAgent.experienceEnd(xid)
    }
    /**
     * Returns array of available experiences for the member in shorthand object format, i.e., not a full `Experience` class instance. That is only required when performing.
     * @param {boolean} includeLived - Include lived experiences in the list
     * @returns {Promise<Object[]>} - Array of shorthand experience payloads: { autoplay, description, id, name, purpose, skippable, }
     */
    async experiences(includeLived=false){
        const experiences = this.#experienceAgent.experiences(includeLived)
        return experiences
    }
    /**
     * Submits message content and id feedback to bot.
     * @todo - message id's not passed to frontend, but need to identify content in order to identify accurate bot, not just active bot. Given situation at the moment, it should be elucidating anyhow, and most likely will be a single bot, not to mention things that don't differentiate bots, such as tone or correctness.
     * @param {String} message_id - Ideally LLM message id
     * @param {Boolean} isPositive - Positive or negative feedback, defaults to `true`
     * @param {String} message - Message content (optional)
     * @returns {Boolean} - Whether feedback was saved successfully
     */
    async feedback(message_id, isPositive, message){
        const feedback = await this.activeBot.feedback(message_id, isPositive, message)
        const { success, } = feedback
        return success
    }
    /**
     * Returns a generic bot of the specified type, which can be used for various purposes such as help or other non-avatar specific interactions.
     * @param {string} botType - The type of bot to retrieve, defaults to 'avatar'
     * @returns {Promise<object>} - The bot instance
     */
    async genericBot(botType='avatar'){
        const bot = await this.#botAgent.genericBot(botType)
        return bot
    }
    /**
     * Returns the assistant type for a given form and type, using the bot agent's getAssistantType function.
     * @param {String} form - The form for which to get the assistant type
     * @param {String} type - The type for which to get the assistant type
     * @return {String} - The assistant type for the given form and type
     */
    getAssistantType(form, type){
        return this.#botAgent.getAssistantType(form, type)
    }
    /**
     * Specified by id, returns the pruned Bot.
     * @param {Guid} botId - The Bot id, defaults to active bot
     * @param {boolean} returnClassInstance - Whether to return the full Bot class instance, defaults to `false`
     * @returns {object} - The pruned Bot object
     */
    getBot(botId=this.activeBot?.id, returnClassInstance=false){
        const bot = this.#botAgent.bot(botId)
        return !returnClassInstance && !!bot
            ? bot.bot
            : bot
    }
    /**
     * Returns pruned Bots for Member Avatar.
     * @returns {object[]} - The array of pruned Bot objects
     */
    getBots(){
        const bots = this.bots
            .map(Bot=>Bot.bot)
        return bots
    }
    /**
     * Gets Conversation object. If no thread id, creates new conversation.
     * @param {string} thread_id - openai thread id (optional)
     * @param {Guid} botId - The bot id (optional)
     * @returns {Conversation} - The conversation object.
     */
    getConversation(thread_id, botId){
        const conversation = this.conversations
            .filter(c=>(thread_id?.length && c.thread_id===thread_id) || (botId?.length && c.botId===botId))
                ?.[0]
        return conversation
    }
    /**
     * Get a share data by id.
     * @param {Guid} sid - The share id
     * @returns {Promise<object>} - The MemberShare document
     */
    async getShare(sid){
        return await this.#ShareAgent.getShare(sid)
    }
    /**
     * Gets all owned relevant shares from MyLife `shares` container, either by item or member.
     * @param {Guid} itemId - The item id (optional)
     * @returns {Promise<object[]>} - The MemberShare array
     */
    async getShares(itemId){
        return await this.#ShareAgent.getShares(itemId)
    }
    /**
     * Returns all conversations of a specific-type stored in memory.
     * @param {string} type - Type of conversation: chat, experience, dialog, inter-system, etc.; defaults to `chat`.
     * @returns {Conversation[]} - The array of conversation objects.
     */
    getConversations(type='chat'){
        return this.conversations
            .filter(_=>_?.type===type)
            .map(conversation=>(mPruneConversation(conversation)))
    }
    /**
     * Get MCP tools for bot.
     * @todo - convert "mylife_" nodes into one "mylife" node with sub-objects
     * @param {string} type - The type of tools to retrieve, defaults to `avatar`
     * @param {boolean} allowAny - Whether to allow tools of type `any`, defaults to `true`
     * @returns {Array} - The array of MCP tools
     */
    getMcpTools(type=this.activeBot.type, allowAny=true){
        type = type.split('-').pop()
        const mcpTools = mMcpTools
            .filter(tool=>
                    tool.mylife_bots?.includes(type)
                || ( allowAny && tool.mylife_bots?.includes('any'))
            )
        return mcpTools
    }
    /**
     * Get a static or dynamic greeting from active bot.
     * @param {boolean} dynamic - Whether to use LLM for greeting
     * @returns {Object} - The greeting Response object: { instruction, responses, routine, success, }
     */
    async greeting(dynamic=false){
        const botGreeting = await this.#botAgent.greeting(dynamic)
        const { routine, success, } = botGreeting
        let { responses, } = botGreeting
        responses = responses
            .map(greeting=>mPruneMessage(this.activeBotId, greeting, 'greeting'))
        console.log('greeting responses', responses)
        return {
            responses,
            routine,
            success,
        }
    }
    /**
     * Request help about MyLife. **caveat** - correct avatar should have been selected prior to calling.
     * @param {string} helpRequest - The help request text
     * @param {string} type - The type of help request
     * @returns {Promise<Object>} - openai `message` objects
     */
    async help(helpRequest, type){
        const processStartTime = Date.now()
        if(!helpRequest?.length)
            throw new Error('Help request required.')
        helpRequest = mHelpIncludePreamble(type, this.isMyLife) + helpRequest
        const { thread_id, } = this.activeBot
        const { id, llmProvider, } = this.helpBots?.find(bot=>(bot?.subType ?? 'general')===type)
            ?? this.helpBots?.[0]
            ?? this.activeBot
        const conversation = this.getConversation(thread_id)
        const helpResponseArray = await this.factory.help(thread_id, llmProvider, helpRequest)
        conversation.addMessages(helpResponseArray)
        if(mAllowSave)
            conversation.save()
        else
            console.log('MemberAvatar::help()::BYPASS-SAVE', conversation.message.content)
        const response = mPruneMessages(this.activeBotId, helpResponseArray, 'help', processStartTime)
        return response
    }
    /**
     * Proxy to create an item via factory in the database.
     * @param {object} item - Item data
     * @returns {Promise<object>} - The created item object
     */
    async itemCreate(item){
        return await this.#factory.createItem(item)
    }
    /**
     * Proxy to save an item to the database.
     * @param {object} item - The item data object
     * @returns {Promise<object>} - The saved item object
     */
    async itemUpdate(item){
        let _item
		if(item instanceof Item)
            _item = this.#factory.extractItemDataDiff(item.item)
        return await this.#factory.updateItem(_item ?? item)
    }
    /**
     * Processes a tool call from the LLM and returns the response.
     * @param {string} functionName - The name of the function to call
     * @param {object} toolArguments - The required arguments for the function call
     * @returns {Promise<object>} - The MyLife Tool Call response object
     */
    async llmFunctionCall(name, toolArguments){
        return await runFunctionCall(name, toolArguments, this.#factory, this, this.#llmServices)
    }
    /**
     * Logs out the current session, removing relevant MyLife session artifacts.
     * @todo - Koa shouldn't be an input, system may not need to actually reach this, is ONLY here for MCP, so need to move that up a layer
     * @param {Koa} ctx - The Koa context object
     * @returns {Promise<void>}
     */
    logout(ctx){
        ctx.session.avatar = ctx.SystemAvatar // reset to SystemAvatar
        ctx.session.locked = true // lock session
    }
    /**
     * Retrieves the manifest for a specific experience, which includes details about the experience such as its description, purpose, and variables.
     * @param {Guid} xid - The experience id
     * @returns {object} - The experience manifest object
     */
    manifest(xid){
        return this.#experienceAgent.experienceManifest(xid)
    }
    /**
     * Handles the MCP completion process.
     * @param {string} type - The type of the MCP completion, i.e., `prompt`, `resource`
     * @param {object} reference - The reference object for the MCP completion { name, uri, }
     * @param {object} argument - The argument object containing the MCP completion data { name, value, }
     * @param {object} contextArguments - The `context.arguments` object for the MCP completion { ...each node is key/value pair for context history }
     * @param {object} sessionMeta - The session metadata for the MCP completion
     * @param {Koa} ctx - The Koa context object
     * @returns {Promise<object>} - The result of the MCP completion: { error, result, }
     */
    async mcpCompletionRequest(type, reference, argument, contextArguments, sessionMeta, ctx){
        return await mMcpCompletionRequest(type, reference, argument, contextArguments, sessionMeta, ctx, this.#factory, this)
    }
    /**
     * Calls a specific MCP function with the provided data and session metadata.
     * @param {string} functionName - The name of the MCP function to call
     * @param {object} mcpData - The data to pass to the MCP function
     * @param {object} sessionMeta - The session metadata (optional)
     * @param {Koa} ctx - The Koa context object (optional)
     * @returns {Promise<object>} - The result of the MCP function call
     */
    async mcpFunction(functionName, mcpData, sessionMeta, ctx){
        return await mMcpFunction(functionName, mcpData, sessionMeta, ctx, this.#factory, this)
    }
    /**
     * Handles the response from an MCP Client Tool `sampling` or `elicitation`.
     * @param {string} type - The type of MCP function response, defaults to `sampling`
     * @param {object} callback - The name of the MCP function to call { _function, _replace, ...args }
     * @param {string|object} mcpData - The data to pass to the MCP function
     * @param {object} sessionMeta - The session metadata
     * @param {Koa} ctx - The Koa context object
     */
    async mcpFunctionRequest(type='sampling', callback, mcpData={}, sessionMeta, ctx){
        // @todo - remove type param if possible
        const { _function: functionName, _replace, ...callbackData } = callback
        const replace = (typeof _replace === 'string')
            ? [_replace]
            : !Array.isArray(_replace)
                ? Object.keys(_replace)
                : _replace
        if(replace?.length)
            replace.forEach(r=>{
                if(typeof mcpData === 'string')
                    callbackData[r] = mcpData
                else if(typeof mcpData === 'object')
                    Object.assign(callbackData, mcpData)
            })
        const response = await this.mcpFunction(functionName, callbackData, sessionMeta, ctx)
        return response
    }
    /**
     * Handles an MCP prompt request.
     * @param {string} id - The ID of the MCP prompt
     * @param {string} name - The name of the MCP prompt
     * @param {object} args - The arguments for the MCP prompt
     * @param {object} sessionMeta - The session metadata for the MCP prompt
     * @param {Koa} ctx - The Koa context object
     * @returns {Promise<object>} - The result of the MCP prompt request: { error, result, }
     */
    async mcpPromptRequest(id, name, args, sessionMeta, ctx){
        return await mMcpPromptRequest(id, name, args, sessionMeta, ctx, this.#factory, this)
    }
    /**
     * Handles an MCP resource request.
     * @param {string} uri - The URI of the MCP resource to request
     * @param {object} sessionMeta - The session metadata for the MCP resource request
     * @param {Koa} ctx - The Koa context object
     * @returns {Promise<object>} - The result of the MCP resource request: { error, result, }
     */
    async mcpResourceRequest(uri, sessionMeta, ctx){
        return await mMcpResourceRequest(uri, sessionMeta, ctx, this.#factory, this)
    }
    /**
     * Migrates a bot to a new, presumed combined (with internal or external) bot.
     * @param {Guid} botId - The bot id
     * @returns {Promise<Bot>} - The migrated Bot instance
     */
    async migrateBot(botId){
        const migration = await this.#botAgent.migrateBot(botId)
        return migration
    }
    /**
     * Gets the Mission object from AlphaDog.
     * @param {Guid} mid - The Mission id
     * @returns {Promise<object>} - The Mission object with current step and status
     */
    async mission(mid){
        await this.alphaDogAlert()
        const Mission = await this.#alphaDog.mission(mid)
        return Mission.mission

    }
    async missionPlay(eventData){
        await this.alphaDogAlert()
        const Mission = await this.#alphaDog.missionPlay(eventData)
        return Mission.mission
    }
    /**
     * Gets the list of current Missions by header from AlphaDog.
     * @returns {Promise<object[]>} - The array of Mission.header objects
     */
    async missions(){
        await this.alphaDogAlert()
        const missions = this.#alphaDog.missions
        return missions
    }
    /**
     * Gets the list of available Missions by header from AlphaDog.
     * @returns {Promise<object[]>} - The array of Mission.header objects
     */
    async missionsAvailable(){
        await this.alphaDogAlert()
        const missions = await this.#alphaDog.missionsAvailable
        return missions
    }
    /**
     * Gets the list of completed Missions by header from AlphaDog.
     * @returns {Promise<object[]>} - The array of Mission.header objects
     */
    async missionsComplete(){
        await this.alphaDogAlert()
        const missions = await this.#alphaDog.missionsComplete()
        return missions
    }
	/**
	 * Populate an object with data, alters in place the incoming class instance.
	 * @param {object} obj - Object to populate
	 * @param {object} data - Data to populate object with
	 * @param {Array} immutableFields - Fields that should not be altered, and are removed from update
	 * @returns {void}
	 */
    populateObject(obj, data, immutableFields){
        this.globals.populateObject(obj, data, immutableFields)
    }
    /**
     * Cascade search for variable through: bot => botAgent => Avatar => factory => factory.core; returns string even if complex object found.
     * @param {string} variable - Prompt variable name
     * @returns {string} - The prompt variable value
     */
    promptVariable(variable){
        return this.#botAgent.promptVariable(variable)
    }
    /**
     * Register a candidate in database.
     * @param {object} candidate - The candidate data object.
     * @returns {object} - The registration object.
     */
    async registerCandidate(candidate){
        const _registration = await this.#factory.registerCandidate(candidate)
        delete _registration.mbr_id
        delete _registration.passphrase
        const registration = this.sanitize(_registration)
        return registration
    }
    /**
     * Reliving a memory is a unique MyLife `experience` that allows a user to relive a memory from any vantage they choose.
     * @param {Guid} id - The item id
     * @param {string} memberInput - Any member input
     * @returns {Object} - livingMemory engagement object (i.e., includes frontend parameters for engagement as per instructions for included `portrayMemory` function in LLM-speak): { error, inputs, itemId, messages, processingBotId, success, }
     */
    async reliveMemory(id, memberInput){
        console.log('Avatar::reliveMemory()::memberInput', memberInput)
        const { item, } = await this.item({ id, })
        if(!id)
            throw new Error(`No Item found with id: ${ id }`)
        const response = await mReliveMemoryNarration(item, memberInput, this.#botAgent, this)
        return response
    }
    /**
     * Allows member to reset passphrase.
     * @param {string} passphrase 
     * @returns {boolean} - true if passphrase reset successful.
     */
    async resetPassphrase(passphrase){
        if(this.isMyLife)
            throw new Error('MyLife avatar cannot reset passphrase.')
        if(!passphrase?.length)
            throw new Error('Passphrase required for reset.')
        return await this.#factory.resetPassphrase(passphrase)
    }
    /**
     * Execute a specific routine, defaults to `introduction`. **Note** could include [](https://www.npmjs.com/package/html-to-json-parser)
     * @todo - continuous improvement on routines
     * @param {string} routine - The routine to execute
     * @returns {object} - Routine response object: { error, instruction, routine, success, }
     */
    async routine(routine='introduction'){
        let filePath=mDefaultRoutinePath,
            response={ success: false, }
        try{
            routine = routine.toLowerCase().replace(/[\s_]/g, '-')
            switch(routine){
                case '':
                case 'intro':
                case 'introduction':
                    routine = 'introduction'
                    break
                case 'privacy-policy':
                    routine = 'privacy'
                    break
                case 'about':
                case 'help':
                case 'privacy':
                default:
                    break
            }
            filePath += `${ routine }.json`
            const script = await this.globals.readFile(filePath)
            if(!script?.length)
                throw new Error('Routine empty')
            response.routine = mRoutine(script, this, this.#botAgent)
            response.success = true
        } catch(error){
            response.error = error
            response.responses = [{
                message: `I'm having trouble sharing this routine; please contact support, as this is unlikely to fix itself.`,
                role: 'system',
            }]
        }
        return response
    }
    /**
     * Sanitize an object, using Global modular functions.
     * @param {object} obj - The object to sanitize
     * @param {Array} immutableFields - Fields that should not be altered
     * @returns {object} - The sanitized object
     */
    sanitize(obj, immutableFields){
        return this.globals.sanitize(obj, immutableFields)
    }
    /**
     * Activate a specific Bot.
     * @param {Guid} bid - The bot id
     * @param {boolean} dynamic - Whether to use LLM for greeting and activation, defaults to `false`
     * @returns {object} - Activated Response object: { activeItemId, firstAccess, id, responses, routine, success, version, versionUpdate, }
     */
    async setActiveBot(bid, dynamic=false){
        const response = await this.#botAgent.setActiveBot(bid, dynamic)
        return response
    }
    /**
     * Persists the last active item ID for the member.
     * @param {string} itemId - The item id to persist
     * @returns {Promise<boolean>} - `true` if the update succeeded
     */
    async setActiveItem(itemId){
        return await this.activeBot.activateItem(itemId)
    }
    /**
     * Sets the requested team as active, sets the active bot and responds.
     * @param {string} teamId - The team id
     * @returns {Promise<Object>} - The response object, includes Active Team object: { botResponse, error, responses, success, team, }
     */
    async setActiveTeam(teamId){
        if(this.isMyLife)
            throw new Error('MyLife avatar cannot currently utilize teams.')
        const response = await this.#botAgent.setActiveTeam(teamId)
        return response
    }
    /**
     * Persists the last active item ID for the member.
     * @param {string} itemId - The item id to persist
     * @returns {Promise<boolean>} - `true` if the update succeeded
     */
    async setActiveItem(itemId){
        return await this.activeBot?.activateItem(itemId)
            ?? false
    }
    /**
     * Sets the requested team as active, sets the active bot and responds.
     * @param {string} teamId - The team id
     * @returns {Promise<Object>} - The response object, includes Active Team object: { botResponse, error, responses, success, team, }
     */
    async setActiveTeam(teamId){
        if(this.isMyLife)
            throw new Error('MyLife avatar cannot currently utilize teams.')
        const response = await this.#botAgent.setActiveTeam(teamId)
        return response
    }
    /**
     * Gets the list of shadows.
     * @returns {Object[]} - Array of shadow objects.
     */
    async shadows(){
        return await this.#factory.shadows()
    }
    async share(sid){
        return await this.#ShareAgent.share(sid)
    }
    async shareCreate(shareData){
        return await this.#ShareAgent.create(shareData)
    }
    /**
     * Share a memory `Header` with frontend to determine warnings or restrictions.
	 * @param {Guid} sid - Share id
     * @returns {Promise<object>} - shareHeader object
     */
    async shareHeader(sid){
        const header = await this.#ShareAgent.header(sid, this)
        return header
    }
	/**
	 * Execute a memory `Share`; currently only shared publicly with non-MyLife members via Q.
	 * @param {Guid} sid - Share id
     * @param {String} input - Text from recipient
     * @returns {Promise<Share|object>} - The initial share header --or, afterwards, upon acceptance-- Share Instance
	 */
	async shareMemory(sid, input){
        const Share = await this.#ShareAgent.play(sid, input)
        // Share.scene = new Marked().parse(Share.scene)
        return Share
	}
    /**
     * Stop a shared memory.
     * @param {Guid} sid - The share id
     * @returns {Promise<Object>} - The Share.stop response object { error, instruction, responses, success, }
     */
    async shareStop(sid){
        return await this.#ShareAgent.stop(sid)
    }
    /**
     * Create or Update a share with new data.
     * @param {object} shareData - The share data object
     * @returns {Promise<object>} - The updated Share object
     */
    async shareUpdate(shareData){
        return await this.#ShareAgent.update(shareData)
    }
	/**
	 * Submits a memory to MyLife. Currently called both from API _and_ LLM function.
     * @todo - deprecate to `item` function
	 * @param {object} story - Story object
	 * @returns {object} - The story document from Cosmos
	 */
	async story(story){
		const defaultForm = 'biographer'
		const type = 'memory'
		const {
			form=defaultForm,
		} = story
		story = { // add validated fields back into `story` object
			...story,
			...{
				form,
                type,
			}}
		return await this.item(story, 'POST')
	}
    /**
     * Gets the requested team by id (or default active team).
     * @param {Guid|null} teamId - The team id
     * @returns {Promise<Object>} - The response object, includes Active Team object: { botResponse, error, responses, success, team, }
     */
    team(teamId){
        const response = this.#botAgent.team(teamId)?.team ?? {}
        return response
    }
    /**
     * Get a list of available teams and their default details.
     * @returns {Object[]} - List of team objects.
     */
    teams(){
        const teams = this.#botAgent.teams.map(team=>team.team)
        return teams
    }
    /**
     * Update a specific bot.
     * @param {Object} botData - Bot data to set
     * @returns {Promise<Object>} - The updated bot
     */
    async updateBot(botData){
        const Bot = await this.#botAgent.updateBot(botData)
        return Bot.bot
    }
    /**
     * Update instructions for bot-assistant based on type. Default updates all LLM pertinent properties.
     * @param {string} id - The id of bot to update
     * @param {boolean} migrateThread - Whether to migrate the thread to the new bot, defaults to `true`
     * @returns {object} - The updated bot object
     */
    async updateBotInstructions(botId=this.activeBot.id){
        const Bot = await this.#botAgent.updateBotInstructions(botId)
        return Bot.bot
    }
    /**
     * Upload files to Member Avatar.
     * @param {File[]} files - The array of files to upload.
     * @returns {boolean} - true if upload successful.
     */
    async upload(files){
        await this.#assetAgent.upload(files)
        const { vectorstoreFileList, } = this.#assetAgent
        return {
            uploads: files,
            files: vectorstoreFileList,
            success: true,
        }
    }
    /**
     * Validates a share id and returns the instance id for newly spawned share.
     * @param {Guid} shareId - The share id or instance id
     * @returns {Promise<Object>} - Response object: { instanceId, }
     */
    async validateShare(shareId){
        let instanceId
        try {
            instanceId = await this.#ShareAgent.validateShare(shareId)
        } catch (error) {
            console.error('avatar::validateShare()::failed', error?.message)
        }
        return {
            instanceId,
        }
    }
    /* getters/setters */
    /**
     * Get the active bot. If no active bot, return this as default chat engine.
     * @getter
     * @returns {object} - The active bot.
     */
    get activeBot(){
        return this.#botAgent.activeBot
    }
    /**
     * Get the active bot id.
     * @getter
     * @returns {string} - The active bot id.
     */
    get activeBotId(){
        return this.#botAgent.activeBotId
    }
    /**
     * Get the age of the member.
     * @getter
     * @returns {number} - The member's age.
     */
    get age(){
        if(!this.birthdate)
            return 0
        const birthdate = new Date(this.birthdate)
        const today = new Date()
        let age = today.getFullYear() - birthdate.getFullYear();
        const isBirthdayPassedThisYear = today.getMonth() > birthdate.getMonth()
        || (
                today.getMonth() === birthdate.getMonth() 
            &&  today.getDate() >= birthdate.getDate()
            )
        if (!isBirthdayPassedThisYear) {
            age -= 1 // Subtract a year if the birthday hasn't occurred yet this year
        }
        return age
    }
    get avatar(){
        return this.#botAgent.avatar
    }
    get backupResponses(){
        return this.#backupResponses
    }
    set backupResponses(response){
        this.#backupResponses.push(response)
    }
    /**
     * Get the "avatar's" being, or more precisely the name of the being (affiliated object) the evatar is emulating.
     * Avatars are special case and are always avatars, so when we query them non-internally for system purposes (in which case we understand we need to go directly to factory.core.being) we display the underlying essence of the datacore; could put this in its own variable, but this seems protective _and_ gives an access point for alterations.
     * @getter
     * @returns {string} The object being the avatar is emulating.
    */
    get being(){
        return 'human'
    }
    /**
     * Get the birthdate of _member_ from `#factory`.
     * @getter
     * @returns {string} - The member's birthdate.
     */
    get birthdate(){
        return this.core?.birthdate
            ?? this.core?.birth?.date
            ?? this.core?.birth?.[0]?.date
    }
    /**
     * Get the birthplace of _member_ from `#factory`.
     * @getter
     * @returns {string} - The member's birthplace.
     */
    get birthplace(){
        return this.core.birthplace
            ?? this.core.birth?.place
            ?? this.core.birth?.[0]?.place
    }
    /**
     * Get the bot agent if avatar is MyLife, member bot-agents are securitized
     * @getter
     * @returns {BotAgent|null} - The bot agent if avatar is MyLife, otherwise null
     */
    get botAgent(){
        return this.isMyLife ? this.#botAgent : null
    }
    /**
     * Returns Member Avatar's Bot instances.
     * @getter
     * @returns {Bot[]} - Array of Bot instances
     */
    get bots(){
        return this.#botAgent.bots
    }
    /**
     * Get the bot agent if avatar is MyLife, member bot-agents are securitized
     * @getter
     * @returns {BotAgent|null} - The bot agent if avatar is MyLife, otherwise null
     */
    get botAgent(){
        return this.isMyLife ? this.#botAgent : null
    }
    /**
     * Get uninstantiated class definition for conversation. If getting a specific conversation, use .conversation(id).
     * @getter
     * @returns {class} - class definition for conversation
     */
    get conversation(){
        return this.#factory.conversation
    }
    /**
     * Get full list of conversations active in Member Avatar. Use `getConversation(id)` for specific. **Note**: Currently `.conversation` references a class definition.
     * @getter
     * @returns {Conversation[]} - The list of conversations
     */
    get conversations(){
        const conversations = this.bots
            .map(bot=>bot.conversation)
            .filter(Boolean)
        return conversations
    }
    /**
     * Get the datacore.
     * @getter
     * @returns {object} - The Member's datacore.
     */
    get core(){
        return this.#factory.core
    }
    get dob(){
        return this.#factory.dob
    }
    get evolver(){
        return this.#evolver
    }
    set evolver(evolver){
        if(!(evolver instanceof EvolutionAgent))
            this.#evolver = evolver
    }
    /**
     * Get the current experience location (or pointer). Should always map to the last event being sent, if inspecting an array of events via `api.experience()`.
     * @getter
     * @returns {object} - The current experience location.
     */
    get experienceLocation(){
        return this.experience.location
    }
    /**
     * Returns List of Member's Lived Experiences.
     * @getter
     * @returns {Object[]} - List of Member's Lived Experiences.
     */
    get experiencesLived(){
        return this.#livedExperiences
    }
    /**
     * Set the experiences lived.
     * @setter
     * @param {array} livedExperiences - The new experiences lived.
     * @returns {void}
     */
    set experiencesLived(livedExperiences){
        if(!Array.isArray(livedExperiences))
            throw new Error('Experiences lived must be an array.')
        this.#livedExperiences = livedExperiences
    }
    get frontendInstructions(){
        return this.#frontendInstructions
    }
    set frontendInstructions(instruction){
        this.#frontendInstructions = mAddInstruction(this.#frontendInstructions, instruction)
    }
    get globals(){
        return this.#factory.globals
    }
    get helpBots(){
        const bots = this.getBots()
            .filter(bot=>bot.type==='help')
        return bots
    }
    get isCreatingAccount(){
        return this.#factory.isCreatingAccount
    }
    get isInExperience(){
        return this.mode==='experience'
    }
    get isMyLife(){
        return this.#factory.isMyLife
    }
    /**
     * Get the current living experience.
     * @getter
     * @returns {object} - The current living experience.
     */
    get livingExperience(){
        return this.experience
    }
    /**
     * Get the `active` reliving memory.
     * @getter
     * @returns {object[]} - The active reliving memories
     */
    get livingMemory(){
        return this.#livingMemory
            ?? {}
    }
    /**
     * Set the `active` reliving memory.
     * @setter
     * @param {Object} livingMemory - The new active reliving memory (or `null`)
     * @returns {void}
     */
    set livingMemory(livingMemory){
        this.#livingMemory = livingMemory
    }
    get mbr_id(){
        return this.#factory.mbr_id
    }
    /**
     * Get the guid portion of member id.
     * @todo - deprecate to `mbr_sysId`
     * @getter
     * @returns {guid} - The member's core guid.
     */
    get mbr_id_id(){
        return this.mbr_sysId
    }
    /**
     * Get the system name portion of member id.
     * @todo - deprecate to `mbr_sysName`
     * @getter
     * @returns {guid} - The member's system name.
     */
    get mbr_name(){
        return this.mbr_sysName
    }
    /**
     * Get the guid portion of member id.
     * @getter
     * @returns {guid} - The member's core guid.
     */
    get mbr_sysId(){
        return this.#factory.mbr_id_id
    }
    /**
     * Get the system name portion of member id.
     * @getter
     * @returns {guid} - The member's system name.
     */
    get mbr_sysName(){
        return this.#factory.mbr_name
    }
    /**
     * Get the Member Avatar's mcp self-definition package.
     * @getter
     * @returns {object} - The mcp self-definition package
     */
    get mcp(){
        this.#mcp.tools = [] // reset tools each call
        const botTools = this.getMcpTools()
        botTools.forEach(tool=>{
            if(!this.#mcp.tools?.some(t=>t.name===tool.name))
                this.#mcp.tools.push(tool)
        })
        return this.#mcp
    }
    get memberFirstName(){
        return this.#factory.memberFirstName
    }
    get memberFullName(){
        return this.memberName
    }
    get memberLastName(){
        return this.#factory.memberLastName
    }
    get memberName(){
        return this.#factory.memberName
    }
    /**
     * Get uninstantiated class definition for message.
     * @getter
     * @returns {class} - class definition for message
     */
    get message(){
        return this.#factory.message
    }
    /**
     * Get the mode.
     * @getter
     * @returns {string} - The current active mode.
     */
    get mode(){
        return this.#mode
    }
    /**
     * Get the name of the avatar. Note: this.name is normally the Cosmos nomenclature, so we do not write to it, and use it's value as a last resort.
     * @getter
     * @returns {string} - The avatar name.
     */
    get name(){
        return this.nickname
    }
    /**
     * Proxy to set the nickname of the avatar.
     * @setter
     * @param {string} name - The new avatar nickname.
     * @returns {void}
     */
    set name(name){
        /* set nothing */
    }
    /**
     * Get experience scene navigation array.
     * @getter
     * @returns {Object[]} - The scene navigation array for the experience.
     * @property {Guid} id - The scene id.
     * @property {string} description - The scene description.
     * @property {Object[]} events - The scene events. @stub
     * @property {number} order - The scene order, default=1.
     * @property {boolean} required - Whether the scene is required, default=false.
     * @property {boolean} skippable - Whether the scene is skippable, default=true.
     * @property {string} title - The scene name.
     */
    get navigation(){
        return this.experience.navigation
    }
    /**
     * Creates a new guid via `this.#factory`.
     * @getter
     * @returns {Guid} - The new guid
     */
    get newGuid(){
        return this.#factory.newGuid
    }
    /**
     * Get the nickname of the avatar.
     * @getter
     * @returns {string} - The avatar nickname.
     */
    get nickname(){
        return this.#nickname
    }
    /**
     * Set the nickname of the avatar; only set if different from name.
     * @setter
     * @param {string} nickname - The new avatar nickname.
     * @returns {void}
     */
    set nickname(nickname){
        if(nickname!==this.name)
            this.#nickname = nickname
    }
    get registrationId(){
        return this.#factory.candidateId
    }
    get sessionId(){
        return this.#sessionId
    }
    set sessionId(sid){
        if(typeof sid === 'string' && sid.length && sid !== this.#sessionId) // KOA ctx.sessionId token
            this.#sessionId = sid
    }
    get setupComplete(){
        return this.#setupComplete
    }
    set setupComplete(complete){
        if(complete && !this.setupComplete){
            this.#factory.avatarSetupComplete(this.id) // save to cosmos
            this.#setupComplete = true
        }
    }
    /**
     * Get vectorstore id.
     * @getter
     * @returns {string} - The vectorstore id.
     */
	get vectorstore_id(){
		return this.#vectorstoreId
	}
    /**
     * Set vectorstore id, both in memory and storage.
     * @setter
     * @param {string} vectorstoreId - The vectorstore id.
     * @returns {void}
     */
	set vectorstore_id(vectorstoreId){
		/* validate vectorstoreId */
		if(!vectorstoreId?.length)
			throw new Error('vectorstoreId required')
		/* cosmos */
        const { id, } = this
        this.#factory.updateItem({ id, vectorstore_id: vectorstoreId }) /* no await */
		this.#vectorstoreId = vectorstoreId /* update local */
	}
}
/**
 * The System Avatar singleton for MyLife.
 * @class
 * @extends Avatar
 */
class Q extends Avatar {
    #campaigns = []
    #connectorAgent // connector agent for MyLife
    #conversations = []
    #factory // same reference as Avatar, but wish to keep private from public interface; don't touch my factory, man!
    #hostedMembers = [] // MyLife-hosted members
    #llmServices // ref _could_ differ from Avatar, but for now, same
    #mcp={
        capabilities: {
            completions: {},
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
        instructions: 'I am Q, corporate intelligence for MyLife. MyLife is a humanist 501c3 nonprofit member organization. MyLife has created an AI-Agent platform available by MCP to assist with helping members collect, shape and share their memories and personal narratives with their family and posterity.',
        jsonrpc: mJsonRpcVersion,
        prompts: [
            {
                name: 'mylife_company_information',
                description: 'Ask Q, our corporate intelligence, about MyLife, the nonprofit humanist member organization. Include the type of information requested for more precise results.',
                arguments: [
                    {
                        description: 'The type of information requested about MyLife',
                        enum: ['history', 'mission', 'vision', 'values', 'governance', 'members', 'other'],
                        name: 'infoType',
                        required: false,
                    },
                    {
                        description: 'The question to ask of our System Avatar, Q',
                        disallowCompletion: true,
                        name: 'question',
                        required: true,
                    },
                ],
            },
            {
                name: 'mylife_shared_memory_search',
                description: 'Let Q help you find MyLife shared public memories to experience.',
                arguments: [
                    {
                        description: 'Whether to search for anonymous memories; do not send if not intending to filter by anonymous',
                        name: 'anonymous',
                        required: false,
                        type: 'boolean',
                    },
                    {
                        description: 'Whether to search for guessable memories; do not send if not intending to filter  by guessable',
                        name: 'guessable',
                        required: false,
                        type: 'boolean',
                    },
                    /*
                    {
                        default: '',
                        description: 'A keyword(s) or topic to search for in MyLife shared public memory bank',
                        name: 'keyword',
                        required: true,
                        type: 'string',
                    },
                    {
                        description: 'A Phase of Life to search for in MyLife shared public memory bank',
                        enum: ['birth', 'childhood', 'adolescence', 'teenage', 'young-adult', 'adulthood', 'middle-age', 'senior', 'end-of-life', 'past-life', 'unknown'],
                        name: 'phase',
                        required: false,
                        type: 'string',
                    },
                    */
                    {
                        description: 'Title of the MyLife shared public memory to search for',
                        name: 'title',
                        required: false,
                        type: 'string',
                    },
                ],
            }
        ],
        protocolVersion: mJsonRpcProtocolVersion,
        resources: [
            {
                description: 'Outreach Material for MyLife, written 2 years ago prior to development of the platform',
                mimeType: 'application/pdf',
                name: 'mylife-basics',
                title: 'MyLife Summary',
                uri: 'file://MyLife_Summary.pdf',
            },
            {
                description: 'MyLife Board of Directors Bylaws version 1.0',
                mimeType: 'application/pdf',
                name: 'mylife-bylaws',
                title: 'MyLife Bylaws',
                uri: 'file://MyLife_Board.pdf',
            },
            {
                description: 'MyLife open-source codebase, written for Node.js and NoSQL db',
                mimeType: 'text/html',
                name: 'mylife-codebase',
                title: 'MyLife Codebase',
                uri: 'https://github.com/MyLife-Services/mylife-maht',
            },
            {
                description: 'MyLife Homepage: Human Remembrance Project for our Digital Legacy',
                mimeType: 'text/html',
                name: 'mylife-homepage',
                title: 'MyLife Homepage',
                uri: 'https://humanremembranceproject.org',
            },
        ],
        resourceTemplates: [
            {
                description: 'Access memory from MyLife archives based on itemId; **note**: must be publicly shared',
                mimeType: 'text/markdown',
                name: 'mylife-public-memory',
                title: 'Experience a MyLife Shared Memory',
                uriTemplate: 'public-memory://{itemId}',
            },
            {
                arguments: {
                    anonymous: {
                        description: 'Whether to search for anonymous memories; do not send if not intending to filter by anonymous',
                        required: false,
                        type: 'boolean',
                    },
                    guessable: {
                        description: 'Whether to search for guessable memories',
                        enum: [true, false, null],
                        required: false,
                        type: 'boolean',
                    },
                    title: {
                        description: 'Title of the MyLife shared public memory to search for',
                        required: false,
                        type: 'string',
                    },
                },
                description: 'Search MyLife Public Memories; note: currently must be publicly shared',
                mimeType: 'application/json',
                name: 'mylife-public-memory-search',
                title: 'Search MyLife Public Memories',
                uriTemplate: 'public-memories://search?anonymous={anonymous}&guessable={guessable}&title={title}',
            },
            /* In Development
            {
                description: 'Access MyLife Member\'s exposed Personal Avatar',
                mimeType: 'application/json',
                name: 'avatar',
                title: 'Connect with a MyLife Member Avatar',
                uriTemplate: 'public-avatar://{memberId}',
            },
            {
                description: 'Come meet the core MyLife assistive intelligences! We offer these configurable intelligences free as a courtesy to all members!',
                mimeType: 'application/json',
                name: 'mylife-intelligences',
                title: 'Meet the MyLife Intelligences',
                uriTemplate: 'public-bots://{botType}',
            },
            */
        ],
        serverInfo: {
            name: 'MyLife MCP System Avatar',
            version: '1.0',
        },
    } /* **Note**: `tools` array is managed as decoration in `get mcp()` */
    #Router
    /**
     * @constructor
     * @param {MyLifeFactory} factory - The factory on which MyLife relies for all service interactions.
     * @param {LLMServices} llmServices - The LLM services object
     */
    constructor(factory, llmServices){
        if(!factory.isMyLife)
            throw new Error('factory parameter must be an instance of MyLifeFactory')
        super(factory, llmServices)
        this.#factory = factory
        this.#llmServices = llmServices
        this.#connectorAgent = new ConnectorAgent(this.#factory, this.#llmServices)
    }
    /* overloaded methods */
    /**
     * OVERLOADED: MyLife must refuse to create proxies for external agents.
     * @public
     * @throws {Error} - System avatar cannot create proxies.
     */
    async botProxyCreate(){
        throw new Error('System avatar cannot link to external agents.')
    }
    /**
     * Pulls the Campaign Instance for the given id. **Note**: currently only pulled from cache.
     * @param {Guid} cid - The Campaign Instance Id
     * @returns {Campaign} - The Campaign instance for the given id
     */
    campaign(cid){
        return this.#campaigns.find(c=>c.id===cid)
    }
    /**
     * Requests final assessment to reports in Campaign Instance.
     * @param {string} cid - Campaign Instance id
     * @param {object} report - The report data to submit for final assessment
     * @returns {Promise<void>} - The Instance has been erased
     */
    async campaignClose(cid, report){
        const campaignInstance = this.campaign(cid)
        if(!campaignInstance)
            return
        this.#campaigns = this.#campaigns.filter(c=>c.id!==cid) // remove from cache
        if(typeof campaignInstance?.campaignClose === 'function')
            await campaignInstance.campaignClose(report)
    }
    /**
     * Close all campaign instances for a given session id, such as when a session ends without proper campaign closure. **Note**: each instance is removed from this.#campaigns with `campaignClose()`
     * @param {object} session - The context Koa Session object to store guest conversation
     * @param {object} report - The report data to submit for final assessment
     * @returns {Promise<void>} - All instances have been prodded or postured for closure
     */
    async campaignServerClose(session, report){
        const campaignInstances = this.#campaigns.filter(c=>c.sessionId===session._sessionId)
        await Promise.all(
            campaignInstances.map(async campaign=>{
                await this.chat('# CLOSE', undefined, session) // trigger close from LLM perspective; can abandon this thread, although we should also delete it, I do later down the chain
            })
        )
        // set 25s timeout for actual detonation in cache
        setTimeout(()=>{
            campaignInstances.forEach(campaign=>
                this.campaignClose(campaign.id, report) // no need await; force close any remaining instances in cache after timeout
            )
        }, 1000 * 25) // 25s
    }
    /**
     * Requests Campaign Instance creation.
     * @param {string} aid - Campaign Advertisement id
     * @param {string} adaid - Campaign Advertisement Platform id
     * @returns {Promise<Campaign>} - The created Campaign instance
     */
    async campaignCreate(aid, adaid){
        const campaignInstance = new Campaign(this.#factory, this.sessionId)
        if(typeof campaignInstance.init === 'function'){
            await campaignInstance.init(aid, adaid)
            this.#campaigns.push(campaignInstance)
        }
        return campaignInstance
    }
    /**
     * OVERLOADED: Processes and executes incoming chat request.
     * @todo - shunt registration actions to different MA functions
     * @public
     * @param {string} message - The chat message content
     * @param {Guid} itemId - The active collection-item id (unused in System Avatar)
     * @param {object} session - The context Koa Session object to store guest conversation
     * @returns {Promise<Object[]>} - The response(s) to the chat request
    */
    async chat(message, itemId, session){
        let { Conversation, } = session
        if(!Conversation){
            Conversation = await this.conversationStart('chat', 'system-avatar')
            if(!Conversation)
                throw new Error('Unable to be create `Conversation`.')
            this.#conversations.push(Conversation)
            session.Conversation = Conversation
        }
        Conversation.originalPrompt = message
        Conversation.processStartTime = Date.now()
        if(this.isRegistered && this.registrationId) // trigger confirmation until session (or vld) ends
            message = `CONFIRM REGISTRATION PHASE: registrationId=${ this.registrationId }\n${ message }`
        if(this.isCreatingAccount)
            message = `CREATE ACCOUNT PHASE: ${ message }`
		Conversation.prompt = message
		await this.botAgent.chat(Conversation, mAllowSave, this) // call bot-agent, **not** bot explicitly when system avatar
        const responses = mPruneMessages(this.activeBotId, Conversation.getMessages(true, true), 'chat', Conversation?.processStartTime)
        return mBuildResponse(this, { responses, success: true })
    }
    /**
     * OVERLOADED: MyLife must refuse to create bots.
     * @public
     * @throws {Error} - System avatar cannot create bots.
     */
    async createBot(){
        throw new Error('System avatar cannot create bots.')
    }
    /**
     * OVERLOADED: MyLife deletes chat conversation including instance memory.
     * @param {Conversation} Conversation - The conversation instance to delete
     * @returns (Guid) - The id of the deleted conversation
     */
    async deleteChat(Conversation){
        const id = await super.deleteChat(Conversation, false)
        const index = this.#conversations.findIndex(c=>c.id===id)
        if(index>=0)
            this.#conversations.splice(index, 1)
        return id
    }
    /** 
     * OVERLOADED: Submits and returns the journal or diary entry to MyLife via API.
	 * @todo - consent check-in with spawned Member Avatar
	 * @param {object} summary - Object with story summary and metadata
	 * @returns {object} - The story document from Cosmos
     */
	async entry(summary){
		summary.being = 'entry'
		summary.form = summary.form
            ?? 'journal'
		return await this.summary(summary)
	}
    /**
     * OVERLOADED: Get MyLife static greeting with identifying information stripped.
     * @returns {Object} - The greeting Response object: { responses, success, }
     */
    async greeting(){
        const greeting = await this.avatar.greeting(false, undefined, this)
        const { routine, success, } = greeting
        let { responses, } = greeting
        responses = responses.map(response=>{
            response = mPruneMessage(undefined, response, 'greeting')
            delete response.activeBotId
            return response
        })
        return {
            responses,
            routine,
            success,
        }
    }
    /**
     * OVERLOADED: MyLife system avatar cannot logout of MyLife.
     * @param {Koa} ctx - The Koa context object to throw the error on
     * @throws {Error} - System avatar cannot logout of MyLife
     */
    async logout(ctx){
        ctx.throw(403, 'System avatar cannot logout of MyLife.')
    }
    /**
     * OVERLOAD: Call a MyLife MCP system avatar function. This function elicits the last data decoration before returning to the client.
     * @param {string} functionName - The name of the function to call
     * @param {object} mcpData - The data object to pass to the function
     * @param {object} sessionMeta - Relevant session metadata
     * @param {object} transportEntry - The transport entry object
     * @returns {Promise<Object>} - The result of the function call: { error, instruction, preface, response, success, }; note instruction would be indication for frontend display request; currently not used in MCP context before related specification is complete.
     */
    async mcpFunction(functionName, mcpData, sessionMeta, ctx){
        let data, // A2A data object (or could sneak function in sessionMeta)
            error, // MCP formatted error
            instruction, // instruction for frontend display or input action
            preface, // text preface when using response
            response, // response from function call, not formatted for MCP
            result, // result for MCP function call, formatted for MCP
            success=false, // success of function call
            tool // specification in development: follow-on MCP tool call
        if(!sessionMeta){
            error = {
                code: 500,
                message: 'Session failed when access a shared memory',
            }
            return {
                error,
                success,
            }
        }
        switch(functionName){
            case 'chat':
                const { itemId: mcpChatItemId, message: mcpChatMessage } = mcpData
                const { responses: mcpChatResponses, success: mcpChatSuccess, } = await this.chat(mcpChatMessage, mcpChatItemId, ctx.session)
                if(!mcpChatSuccess)
                    response = 'Something went wrong while retrieving information about MyLife. Please try again.'
                else
                    result = {
                        content: mcpChatResponses.map(response=>({
                            text: response.message,
                            type: 'text',
                        })),
                        isError: false,
                    }
                success = !(result?.isError ?? true)
                break
            case 'get_shared_memories':
                response = await this.sharedMemories(100)
                success = response.length > 0
                if(!success)
                    error = {
                        code: 500,
                        message: 'No shared memories found',
                    }
                else {
                    const structuredContent = {
                        explanation: `The \`memories\` array is the list of shared memories by id and title--present titles to human; use ID only to **initially** call \`get_shared_memory\`. **Note**: ID will change and be shared after initialization to identify your unique instance of the shared memory.`,
                        memories: response,
                    }
                    result = {
                        content: [{
                            text: JSON.stringify(structuredContent),
                            type: 'text',
                        }],
                        isError: false,
                        structuredContent,
                    }
                    if(typeof (response ?? null) === 'object'){ // transfer response to data
                        data = response // a2a data part
                        response = undefined // @todo - fix: currently triggers reset response for downstream MCP handlers
                    }
                }
                break
            case 'get_shared_memory':
                let { input: sharedMemoryInput, memoryId: sharedMemoryId, } = mcpData
                let Share = sessionMeta.Share
                if(!Share || Share.instanceId!==sharedMemoryId){
                    const { instanceId, } = await this.validateShare(sharedMemoryId)
                    if(!instanceId){
                        error = {
                            code: -32602,
                            data: mcpData,
                            message: `The memoryId ${ sharedMemoryId } is not valid`,
                        }
                        break
                    }
                    sharedMemoryId = instanceId
                    await this.shareHeader(sharedMemoryId)
                    Share = await this.share(sharedMemoryId)
                    sessionMeta.Share = Share
                    Share = sessionMeta.Share
                    if(Share.warnings?.length){
                        const structuredContent = {
                            explanation: `Confirm that the viewer would like to proceed given the warnings included. On confirmation make the \`get_shared_memory\` call again using this personalized instance id for \`memoryId\`.`,
                            memoryId: sharedMemoryId,
                            scene: Share.previousScene,
                            warnings: Share.warnings,
                        }
                        result = {
                            content: [{
                                text: JSON.stringify(structuredContent),
                                type: 'text',
                            }],
                            isError: true,
                        }
                        break
                    }
                }
                if(!Share.warningsAccepted) /* previous error result required intelligence to issue warnings to human before re-contacting */
                    Share.acceptWarnings()
                await this.shareMemory(sharedMemoryId, sharedMemoryInput)
                const structuredContent = {
                    explanation: `The \`scene\` object is the current scene of the shared memory. The \`input\` field is the human input to be added to the shared memory. Call \`shareMemory\` with the \`memoryId\` to add the input to the shared memory.`,
                    memoryId: sharedMemoryId,
                    scene: Share.previousScene,
                }
                result = {
                    content: [
                        {
                            text: JSON.stringify(structuredContent),
                            type: 'text',
                        }
                    ],
                    isError: false,
                    structuredContent,
                }
                success = !!result
                break
            case 'mylife_information':
                const { question, questionType, } = mcpData
                let message = question
                if(questionType?.length)
                    message += `\nQuestion Type: ${ questionType }`
                const { responses: mcpInfoResponses, success: mcpInfoSuccess, } = await this.chat(message, undefined, ctx.session)
                if(!mcpInfoSuccess)
                    response = 'Something went wrong while retrieving information about MyLife. Please try again.'
                else
                    result = {
                        content: mcpInfoResponses.map(res=>({
                            text: res.message,
                            type: 'text',
                        })),
                        isError: false,
                    }
                success = !(result?.isError ?? true)
                break
            case 'register':
                const { avatarName: registerAvatarName, email: registerEmail, humanName: registerHumanName, reason: registerReason, } = mcpData
                /* validate input */
                if(!this.globals.isValidEmail(registerEmail))
                    error = {
                        code: -32602,
                        data: mcpData,
                        message: `Email incorrectly formatted: ${ registerEmail }`,
                    }
                else if((registerHumanName?.length ?? 0) < 2)
                    error = {
                        code: -32602,
                        data: mcpData,
                        message: `Human Name (humanName) must be a string with at least 2 chars; you sent: ${ registerHumanName }`,
                    }
                else if((registerAvatarName?.length ?? 0) < 1)
                    error = {
                        code: -32602,
                        data: mcpData,
                        message: `Avatar Name (avatarName) be a string with at least 1 char; you sent: ${ registerAvatarName }`,
                    }
                else {
                    const signupPacket = {
                        type: 'register',
                        avatarName: registerAvatarName,
                        email: registerEmail,
                        humanName: registerHumanName,
                        reason: registerReason,
                    }
                    const registrationData = await this.registerCandidate(signupPacket)
                    const { email: registeredEmail, } = registrationData
                    result = registeredEmail!==signupPacket.email
                        ? {
                            content: [{
                                text: 'Something went wrong with our system; please try again later, or use a different email.',
                                type: 'text',
                            }],
                            isError: true,
                        }
                        : {
                            content: [{
                                text: `Registration was successful! Congratulations! An email has been sent to you with further instructions on how to validate your email. Please remember the email used for registration: ${ registerEmail }`,
                                type: 'text',
                            }],
                            isError: false,
                        }
                    success = !!result && !(result.isError ?? true)
                }
                break
            case 'logout':
            case 'mylife_logout':
                this.logout(ctx)
                result = {
                    content: [{
                        text: 'Logout successful. You have been logged out.',
                        type: 'text',
                    }],
                    isError: false,
                }
                break
            default:
                error = {
                    code: 500,
                    message: `Function ${ functionName } not found in System Avatar.`,
                }
                break
        }
        const responseObject = {
            data,
            error,
            instruction,
            preface,
            response,
            result,
            success,
            tool,
        }
        Object.keys(responseObject).forEach(key=>{
            if(responseObject[key] === undefined || responseObject[key] === null)
                delete responseObject[key]
        })
        return responseObject
    }
	/**
	 * OVERLOADED: Submits and returns the memory to MyLife via API.
	 * @todo - consent check-in with spawned Member Avatar
	 * @param {object} summary - Object with story summary and metadata
	 * @returns {object} - The story document from Cosmos
	 */
	async memory(summary){
		summary.being = 'story'
		summary.form = 'memory'
		return await this.summary(summary)
	}
    /**
     * OVERLOADED: Given an itemId, obscures aspects of contents of the data record. Obscure is a vanilla function for MyLife, so does not require intervening intelligence and relies on the factory's modular LLM. In this overload, we invoke a micro-avatar for the member to handle the request on their behalf, with charge-backs going to MyLife as the sharing and api is a service.
     * @public
     * @param {string} mbr_id - The member id
     * @param {Guid} iid - The item id
     * @returns {Object} - The obscured item object
     */
    async obscure(mbr_id, iid){
        const botFactory = await this.avatarProxy(mbr_id)
        const updatedSummary = await botFactory.obscure(iid)
        return updatedSummary
    }
    /* overload rejections */
    summarize(){
        throw new Error('MyLife System Avatar cannot summarize files')
    }
	/**
	 * OVERLOADED: Submits and returns a summary to MyLife via API.
	 * @param {object} summary - Object with story summary and metadata
	 * @returns {object} - The story document from Cosmos.
	 */
	async summary(summary){
		const {
			being='story',
			form='story',
			id=this.globals.newGuid,
			mbr_id,
			title=`untitled ${ form }`,
		} = summary
		if(!mbr_id?.length)
			throw new Error('story `mbr_id` required')
		if(!summary.summary?.length)
			throw new Error('story `summary` required')
		const story = {
			...summary,
			being,
			form,
			id,
			mbr_id,
			name: `${ being }_${ title.substring(0,64) }_${ mbr_id }`,
		}
		const savedStory = this.globals.sanitize(await this.#factory.summary(story))
		return savedStory
	}
    upload(){
        throw new Error('MyLife System Avatar cannot upload files.')
    }
    /* public methods */
    /**
     * Add a member to the hosted members list.
     * @param {string} id - The member id (mbr_id).
     * @returns {void}
     */
    async addMember(id){
        if(!this.#hostedMembers.find(member=>member.id===id)){
            const memberObject = {
                mbr_id: id,
                mbr_name: null,
            }
            const hostedMember = mAvatarDropdown(this.globals, memberObject)
            if(hostedMember){
                this.#hostedMembers.push(hostedMember)
                this.#hostedMembers.sort((a, b) => a.name.localeCompare(b.name))
            }
        }
    }
    /**
     * Returns the Member Avatar proxy for the member id.
     * @param {string} mbr_id - The member id
     * @returns {Promise<BotFactory>} - The Member Avatar proxy
     */
    async avatarProxy(mbr_id){
        const avatar = await this.#factory.avatarProxy(mbr_id)
        return avatar
    }
	/**
	 * Accesses core data to challenge access to a member's account.
	 * @public
	 * @param {string} mbr_id - The member id
	 * @param {string} passphrase - The passphrase to challenge
	 * @returns {Promise<boolean>} - `true` if challenge is successful
	 */
    async challengeAccess(mbr_id, passphrase){
        let challengeSuccessful=false
        try{
            const avatarProxy = await this.avatarProxy(mbr_id)
            challengeSuccessful = await avatarProxy.challengeAccess(passphrase)
        } catch(e){
            console.log('SystemAvatar::challengeAccess::error', e)
        }
		return challengeSuccessful
	}
	/**
	 * Set MyLife core account basics. { birthdate, passphrase, }
	 * @todo - deprecate addMember()
	 * @param {string} birthdate - The birthdate of the member.
	 * @param {string} passphrase - The passphrase of the member.
	 * @returns {object} - The account creation object: { avatar, success, }
	 */
	async createAccount(birthdate, passphrase){
        if(!birthdate?.length || !passphrase?.length)
            throw new Error('birthdate _**and**_ passphrase required')
        let avatar,
            success = false
        avatar = await this.#factory.createAccount(birthdate, passphrase)
        if(typeof avatar==='object' && Object.keys(avatar).length){
            const { mbr_id, } = avatar
            success = true
            this.addMember(mbr_id)
            console.log(`SystemAvatar::createAccount::mbr_id: ${ mbr_id }`)
        } else
            console.log('SystemAvatar::createAccount::error: failed')
        return {
            avatar,
            success,
        }
    }
    /**
     * Returns list of Q's hostedMembers, using this.#hostedMembers, created on-demand.
     * @todo - this.#hostedMembers should contain name data (more than just id) for dropdowns
     * @param {Guid} key - The key to handshake against provider.
     * @returns {Object[]} - List of hosted member dropdown objects { id, name, }.
     */
    async hostedMembers(key){
        if(!this.globals.isValidGuid(key) || key!==this.hosting_key)
            throw new Error('Invalid key for hosted members.')
        if(!this.#hostedMembers.length){ // on-demand creation
            const hostedMembers = await this.#factory.hostedMembers()
            if(!hostedMembers.length)
                throw new Error('No hosted members found.')
            this.#hostedMembers = hostedMembers
                .map(avatar=>mAvatarDropdown(this.globals, avatar))
                .sort((a, b) => a.name.localeCompare(b.name))
        }
        return this.#hostedMembers
    }
	/**
	 * Returns whether a specified member id is hosted on this instance.
	 * @param {string} mbr_id - Member id
	 * @returns {boolean} - Returns true if member is hosted
	 */
	async isMemberHosted(mbr_id){
		const hostedMembers = await this.hostedMemberList()
		const isHosted = hostedMembers.includes(mbr_id)
		let isValidated = false
        if(isHosted)
            isValidated = await this.testPartitionKey(mbr_id)
		return isValidated
	}
    /**
     * Subscribe to a resource for the MCP session.
     * @param {string} uri - The resource URI to subscribe to
     * @param {object} sessionMeta - The session metadata
     * @returns {Promise<boolean>} - Whether the subscription was successful
     */
    async mcpResourceSubscribe(uri, sessionMeta){
        if(!uri?.length)
            return false
        sessionMeta.resourceSubscriptions.add(uri)
        return true
    }
    /**
     * Creates a member instance for logged in session.
     * @param {String} mbr_id - The member id
     * @returns {Promise<Member>} - The Member Avatar instance
     */
    async mylifeMember(mbr_id){
		const Avatar = await this.#factory.getMemberAvatar(mbr_id)
        return Avatar
    }
    /**
     * Get a list of publicly shared memories.
     * @param {Number} limit - The max number of memories to return
     * @param {Object} filterArgs - Optional filter arguments for shared memories
     * @returns {Promise<Object[]>} - The list of shared memories
     */
    async sharedMemories(limit=10, filterArgs={}){
        let memories = await this.#factory.sharedMemories(limit, filterArgs)
        memories = memories
            .map(memory=>({
                id: memory.id,
                title: memory.title,
            }))
        return memories
    }
    async sharedMemory(itemId){
        const publicMemory = await this.#factory.sharedMemory(itemId)
        console.log('SystemAvatar::sharedMemory()::publicMemory', publicMemory?.id)
        return publicMemory
    }
    /**
     * Search for shared memories based on keyword, phase of life, and/or title.
	 * @param {boolean} anonymous - Whether to search for anonymous memories
	 * @param {boolean} guessable - Whether to search for guessable memories
     * @param {string} keyword - The keyword to search for in shared memories
     * @param {string} phaseOfLife - The phase of life to filter memories by
     * @param {string} title - The title to filter memories by
     * @returns {Promise<Object[]>} - The list of matching shared memories
     */
    async sharedMemorySearch(anonymous, guessable, keyword, phaseOfLife, title){
        const memories = await this.#factory.sharedMemorySearch(anonymous, guessable, keyword, phaseOfLife, title)
        const results = memories
            .map(memory=>({
                id: memory.id,
                title: memory.title,
            }))
        return results
    }
    /**
     * OVERLOAD: Share a memory with the MyLife system. If no shareId is provided, the first shared memory will be used.
     * @param {Guid} shareId - The share id
     * @param {Object} input - The input object to share
     * @returns {Promise<Share>} - The response object { error, instruction, responses, success, }
     */
    async shareMemory(shareId, input){
        if(!shareId)
            shareId = ( await this.sharedMemories(1) )?.[0]?.id
        const { instanceId, } = await this.validateShare(shareId)
        const Share = await super.shareMemory(instanceId, input)
        return Share
    }
    /**
     * Validate registration id.
     * @param {Guid} validationId - The registration id
     * @returns {Promise<Object>} - Response object: { error, instruction, registrationData, responses, success, }
     */
    async validateRegistration(validationId){
        const response = await mValidateRegistration(this.activeBotId, this.#factory, validationId)
        return response
    }
    /* nanda services */
    async nandaServer(serverId){
        const server = await this.#connectorAgent.nandaServer(serverId)
        return server
    }
    async nandaServerRatings(serverId){
        const ratings = await this.#connectorAgent.nandaServerRatings(serverId)
        return ratings
    }
    async nandaServers(){
        const servers = await this.#connectorAgent.nandaServers()
        return servers
    }
    /* getters/setters */
    /**
     * Get the "avatar's" being, or more precisely the name of the being (affiliated object) the evatar is emulating.
     * Avatars are special case and are always avatars, so when we query them non-internally for system purposes (in which case we understand we need to go directly to factory.core.being) we display the underlying essence of the datacore; could put this in its own variable, but this seems protective _and_ gives an access point for alterations.
     * @getter
     * @returns {string} The object being the avatar is emulating.
    */
    get being(){  
        return 'MyLife'
    }
    get conversations(){
        return this.#conversations
    }
    get isRegistered(){
        return this.#factory.isRegistered
    }
    /**
     * Get the MyLife MCP self-definition package. Note that it will populate the internal memory for this avatar, so tool updates will only be reflected on server restart.
     * @getter
     * @returns {object} - The MyLife MCP self-definition package
     */
    get mcp(){
        const mcp = this.#mcp
        if(!mcp?.tools?.length)
            this.#mcp.tools = mMcpTools.filter(tool=>tool.mylife_system_access === true)
        return mcp
    }
    get mcpProxy(){
        const mcp = super.mcp
        mcp.tools = mcp.tools.filter(tool=>tool.mylife_auth_required===false)
        return mcp
    }
    get router(){
        if(!this.#Router)
            this.#Router = initRouter()
        return this.#Router
    }
	get schemas(){
		return this.#factory.schemas
	}
}
/* module functions */
/**
 * Pure function: returns updated instructions array with last-wins logic for singleton commands.
 * Called by the Avatar frontendInstructions setter.
 * @param {object[]} instructions - Current instructions array
 * @param {object} instruction - The instruction to add
 * @returns {object[]} - Updated instructions array
 */
function mAddInstruction(instructions=[], instruction){
    if(!instruction)
        return instructions
    const lastWins = new Set(['endLiving', 'endMemory', 'endReliving', 'setActiveBot', 'updateItem', 'updateItemSummary', 'updateItemTitle'])
    const { command, } = instruction
    if(lastWins.has(command))
        instructions = instructions.filter(i=>i.command!==command)
    instructions.push(instruction)
    return instructions
}
/**
 * Assigns (directly mutates) private experience variables from avatar.
 * @todo - theoretically, the variables need not come from the same avatar instance... not sure of viability
 * @module
 * @param {object} experienceVariables - Experience variables object from Avatar class definition.
 * @param {Avatar} avatar - Avatar instance.
 * @returns {void} - mutates experienceVariables
 */
function mAssignGenericExperienceVariables(experienceVariables, Avatar){
    Object.keys(experienceVariables).forEach(_key=>{
        experienceVariables[_key] = Avatar[_key]
    })
    /* handle unique variable instances (jic) */
    const localOverrides = {
        name: Avatar.memberName,
        nickname: Avatar.memberFirstName
    }
    return {...experienceVariables, ...localOverrides}
}
/**
 * Maps avatar data to dropdown format for hosted members list.
 * @param {Globals} globals - Globals object
 * @param {object} avatar - Avatar object
 */
function mAvatarDropdown(globals, Avatar){
    const { mbr_id: id, mbr_name, } = Avatar
    const name = globals.sysName(id) 
    return {
        id,
        name,
    }
}
/**
 * Builds the standard API response envelope and clears Avatar's transient state.
 * All API-facing Avatar methods return via this function.
 * @param {Avatar} Avatar - The avatar instance
 * @param {object} payload - { item, responses, success, ...rest }
 * @property {object} item - The item to include in the response, if any\
 * @property {object[]} responses - The messages to include in the response, if any
 * @property {boolean} success - Whether the operation was successful
 * @property {object} rest - Any additional properties to include in the response
 * @returns {object} - { instructions, item, responses, success, ...rest }
 */
function mBuildResponse(Avatar, { item, responses=[], success=false, ...rest }){
    if(item)
        item = mPruneItem(item)
    if(!responses?.length){
        if(!Avatar.backupResponses.length)
            Avatar.backupResponses = {
                agent: 'server',
                message: `I tried to process your message, but am having unspecified difficulty. Please try again.`,
                type: 'system',
            }
        responses = Avatar.backupResponses
    }
    const response = {
        instructions: Avatar.frontendInstructions,
        item,
        responses,
        success,
        ...rest,
    }
    Avatar.clearFrontendInstructions()
    Avatar.clearBackupResponses()
    return response
}
/**
 * Creates frontend system message from message String/Object.
 * @param {Guid} botId - The bot id
 * @param {String|Message} message - The message to be pruned
 * @param {messageClassDefinition} messageClassDefinition - The message class definition
 * @returns 
 */
function mCreateSystemMessage(botId, message, messageClassDefinition){
    if(!(message instanceof messageClassDefinition)){
        const content = message?.content
            ?? message?.message
            ?? message
        message = new messageClassDefinition({
            content,
            role: 'assistant',
            type: 'system'
        })
    }
    message = mPruneMessage(botId, message, 'system')
    return message
}
/**
 * Include help preamble to _LLM_ request, not outbound to member/guest.
 * @todo - expand to include other types of help requests, perhaps more validation.
 * @param {string} type - The type of help request.
 * @param {boolean} isMyLife - Whether the request is from MyLife.
 * @returns {string} - The help preamble to be included.
 */
function mHelpIncludePreamble(type, isMyLife){
    switch(type){
        case 'account':
        case 'membership':
            if(isMyLife)
                throw new Error(`Members can only request information about their own accounts.`)
            return 'Following help request is for MyLife member account information or management:\n'
        case 'interface':
            return 'Following question is expected to be about MyLife Member Platform Interface:\n'
        case 'general':
        case 'help':
        default:
            return 'Following help request is about MyLife in general:\n'
    }
}
/**
 * Initializes the Avatar instance with stored data
 * @param {MyLifeFactory|AgentFactory} factory - Member Avatar or Q
 * @param {LLMServices} llmServices - OpenAI object
 * @param {Q|Avatar} Avatar - The avatar Instance (`this`)
 * @param {BotAgent} botAgent - BotAgent instance
 * @param {AssetAgent} assetAgent - AssetAgent instance
 * @returns {Promise<void>} - Return indicates successfully mutated avatar
 */
async function mInit(factory, llmServices, Avatar, botAgent, assetAgent){
    /* initial assignments */
    const { backupResponses, being, frontendInstructions, mbr_id, setupComplete=true, ...avatarProperties } = factory.globals.sanitize(await factory.avatarProperties())
    Object.assign(Avatar, avatarProperties)
    if(!factory.isMyLife){
        Avatar.setupComplete = setupComplete
        const { mbr_id, vectorstore_id, } = Avatar
        Avatar.nickname = Avatar.nickname
            ?? Avatar.names?.[0]
            ?? `${ Avatar.memberFirstName ?? 'member' }'s Avatar`
        if(!vectorstore_id){
            const vectorstore = await llmServices.createVectorstore(mbr_id)
            if(vectorstore?.id){
                Avatar.vectorstore_id = vectorstore.id
                await assetAgent.init(Avatar.vectorstore_id)
            }
        }
    }
    /* initialize default bots */
    await botAgent.init(Avatar)
    if(factory.isMyLife)
        return
    /* evolver */
    Avatar.evolver = await (new EvolutionAgent(Avatar))
        .init()
    /* lived-experiences */
    Avatar.experiencesLived = await factory.experiencesLived(false)
}
/**
 * Initializes MCP tools from the JSON schema directory.
 * @todo - create external toolType variants (A2A)
 * @param {string} mcpToolsPath - The path to the MCP tools directory
 * @returns {Promise<Array>} - Returns the MCP tools array
 */
async function mInitializeExternalTools(toolType='mcp', toolsPath){
    const tools = [],
        toolsFiles = []
    try { /* directory and file access */
        toolsFiles.push(...await fs.readdir(toolsPath))
    } catch(err) {
        console.warn(`Error loading ${ toolsPath } tools: ${ err.message }`, err)
    }
    try { /* populate skills */
        if(toolsFiles.length)
            for(const file of toolsFiles)
                if(file.endsWith('.json'))
                    try {
                        const fileContent = await fs.readFile(path.resolve(toolsPath, file), 'utf8')
                        const toolData = JSON.parse(fileContent)
                        toolData.name = toolData.name
                            ?? file.replace('.json', '')
                        tools.push(toolData)
                    } catch(parseErr) {
                        console.error(`Error parsing  ${ toolType } tool file: ${parseErr.message}`, file)
                    }
        else
            console.warn(`No ${ toolType } tools found in ${ toolsPath } directory.`)
    } catch(err){
        console.warn(`Error initializing ${ toolType } tools: ${ err.message }`, err)
    }
    return tools
}
/**
 * Instantiates a new item and returns the item object.
 * @param {object} item - The item data
 * @param {Avatar} avatar - The avatar instance
 * @param {LLMServices} llmServices - The llm instance
 * @returns {Item} - The item object (or any extender class: Action, Stance, Value, Memory, etc)
 */
function mItem(item, avatar, llmServices){
    /* validate request */
    let Item
    const {
        assistantType,
        content,
        form,
        id=avatar.newGuid,
        type='memory',
    } = item
    const { // derived defaults
        summary=content,
        title=`New ${ form }`,
    } = item
    item = {
        ...item,
        ...{ // validated fields
            assistantType,
            summary,
            title,
            type,
        },
        ...{ // forced fields
            id,
            mbr_id: avatar.mbr_id,
            name: `${ type }_${ form }_${ title.substring(0,64) }_${ avatar.mbr_id }`,
        }
    }
    try {
        switch(type.toLowerCase()){
            case 'action':
                Item = new Action(item, avatar, llmServices)
                break
            case 'entry':
                Item = new Entry(item, avatar, llmServices)
                break
            case 'issue':
                Item = new Issue(item, avatar, llmServices)
                break
            case 'value':
                Item = new Value(item, avatar, llmServices)
                break
            case 'memory':
            default:
                Item = new Memory(item, avatar, llmServices)
                break
        }
    } catch(error){
        console.log('mIitem()::error', error)
    }
    return Item
}
/**
 * Handles the MCP completion process.
 * @param {string} type - The type of the MCP completion, i.e., `prompt`, `resource`
 * @param {string} reference - The reference--name [for prompt] or uri [for resource]--for the MCP completion
 * @param {object} argument - The argument object containing the MCP completion data { name, value, }
 * @param {object} contextArguments - The `context.arguments` object for the MCP completion { ...each node is key/value pair for context history }
 * @param {object} sessionMeta - The session metadata for the MCP completion
 * @param {Koa} ctx - The Koa context object
 * @returns {Promise<object>} - The result of the MCP completion: { error, result, }
 */
async function mMcpCompletionRequest(type, reference, argument, contextArguments, sessionMeta, ctx, factory, avatar){
    const completeLimit=100,
        values = []
    switch(type){
        case 'prompt':
            const promptName = reference
            if(!!argument && !argument.name?.length)
                argument = { name: Object.keys(argument)[0], value: argument[Object.keys(argument)[0]] }
            const { name: completionName, value: completionValue, } = ( argument ?? {} )
            if(!completionName?.length)
                return {
                    error: {
                        code: -32602,
                        message: '`name` parameter required for MCP prompt completion',
                        data,
                    }
                }
            const promptArguments = avatar.mcp.prompts
                ?.find(p=>p.name === promptName)
                ?.arguments
                    ?? []
            if(!promptArguments.length)
                return {
                    error: {
                        code: -32603,
                        message: `No arguments found for prompt "${ promptName }"`,
                        data,
                    }
                }
            const promptArgument = promptArguments.find(arg=>arg.name === completionName)
            if(!promptArgument)
                return {
                    error: {
                        code: -32603,
                        message: `Prompt argument "${ completionName }" not found for "${ promptName }" in MCP prompts`,
                        data,
                    }
                }
            const { disallowCompletion=false, enum: promptArgumentEnum, name: promptArgumentName, required: promptArgumentRequired=false, type: promptArgumentType='string', } = promptArgument
            if(!promptArgumentName?.length || disallowCompletion)
                break
            if(promptArgumentEnum?.length)
                values.push(...promptArgumentEnum) // use enum values
            else if(promptArgumentType==='boolean')
                values.push('true', 'false', 'null') // boolean values
            else
                values.push(...await mMcpPromptCompletion(promptName, promptArgumentName, completionValue, sessionMeta, ctx, factory, avatar))
            break
        case 'resource': /* arguments embedded in uri */
            reference = reference?.trim()
            if(!reference?.length)
                return {
                    error: {
                        code: -32602,
                        message: `Invalid resource URI: ${ reference }`,
                        data,
                    }
                }
            const uri = {
                argument,
                contextArguments,
                path: reference.split('://')[1].split('?')[0],
                queryString: reference.split('?')?.[1],
                root: reference.split('://')[0], // may need to add prefix at some point
                uri: reference,
            }
            const { name: resourceName, value: resourceValue, } = uri.argument
                ?? {}
            const resourceArgument = avatar.mcp.resourceTemplates
                ?.find(t=>t.uriTemplate === reference)
                ?.arguments
                ?.[resourceName]
                    ?? {}
            if(!!resourceArgument){
                if(resourceArgument.enum?.length)
                    values.push(...resourceArgument.enum.map(value =>String(value))) // use enum values
                else 
                    switch(resourceArgument.type){
                        case 'boolean':
                            values.push('true', 'false', 'null')
                            break
                        case 'number':
                        case 'string':
                        default:
                            const completionData = {
                                [`${ resourceName }`]: resourceValue,
                            }
                            const resourceRoot = factory.globals.jsFunctionName(uri.root)
                            let dropdownArray = await mMcpRequestResponse('completion', resourceRoot, completionData, contextArguments, sessionMeta, ctx, factory, avatar)
                                ?? []
                            dropdownArray = dropdownArray?.result
                                ?? dropdownArray?.responses
                                ?? dropdownArray?.values
                                ?? dropdownArray
                                ?? []
                            if(Array.isArray(dropdownArray))
                                values.push(...dropdownArray)
                            else
                                console.log('mMcpCompletionRequest()::resource: unexpected dropdownArray:', dropdownArray)
                            break
                    }
            }
            break
        default:
            return {
                error: {
                    code: -32601,
                    message: `MCP completion type "${ type }" not supported`,
                    data,
                }
            }
    }
    const result = {
        completion: {
            hasMore: values.length > completeLimit,
            total: values.length,
            values: values.slice(0, completeLimit),
        }
    }
    return { result, }
}
/**
 * Completes an MCP prompt argument type.
 * @param {string} promptName - The name of the MCP prompt to complete
 * @param {string} promptArgumentName - The name of the argument to complete
 * @param {string|object} completionValue - The value to use for completion (optional)
 * @param {AgentFactory|MyLifeFactory} factory - The factory object
 * @returns {Promise<Array>} - The array of completion values
 */
async function mMcpPromptCompletion(promptName, promptArgumentName, completionValue, sessionMeta, ctx, factory, avatar){
    const cleanPromptName = promptName.replace(/^mcp_/, '').replace(/^mylife_/, ''),
        completionData = { [`${ promptArgumentName }`]: completionValue },
        functionName = factory.globals.jsFunctionName(cleanPromptName),
        values = []
    let dropdownArray = await mMcpRequestResponse('completion', functionName, completionData, undefined, sessionMeta, ctx, factory, avatar)
    if(typeof dropdownArray === 'object'){
        if(!Array.isArray(dropdownArray)) /* attempt conversion to array */
            dropdownArray = dropdownArray?.result
                ?? dropdownArray?.responses
                ?? dropdownArray?.values
                ?? []
        if(Array.isArray(dropdownArray) && dropdownArray.length)
            values.push(...dropdownArray)
    }
    return values
}
/**
 * Handles the MCP prompt request.
 * @param {string} id - The request ID
 * @param {string} name - The prompt name
 * @param {object} args - The prompt arguments
 * @param {object} sessionMeta - The session metadata for the MCP prompt request
 * @param {Koa} ctx - The Koa context object
 * @param {AgentFactory|MyLifeFactory} factory - The factory object to use for the MCP prompt request
 * @param {Avatar} avatar - The avatar object to use for the MCP prompt request
 * @returns {Promise<object>} - The result of the MCP prompt request: { description, messages, }
 */
async function mMcpPromptRequest(id, name, args, sessionMeta, ctx, factory, avatar){
    let error,
        resourceListChanged = false,
        result
    switch(name){
        case 'mylife_company_information':
            const { infoType, question, } = args
            result = {
                description: `Ask MyLife's corporate intelligence, _Q_, a tailored question about our nonprofit organization.`,
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `I have a question to submit about MyLife regarding its: "${ infoType }."\n## Question:\n${ question }`,
                        }
                    }
                ]
            }
            break
        case 'mylife_shared_memory_search':
            let {
                anonymous: searchAnonymous,
                guessable: searchGuessable,
                keyword: searchKeyword,
                phase: searchPhase,
                title: searchTitle,
            } = args
            if(typeof searchAnonymous === 'string')
                searchAnonymous = searchAnonymous.trim().length
                    ? searchAnonymous.trim().length==='null'
                        ? null
                        : searchAnonymous
                    : null
            if(typeof searchGuessable === 'string')
                searchGuessable = searchGuessable.trim().length
                    ? searchGuessable.trim().length==='null'
                        ? null
                        :  searchGuessable
                    : null
            /*
            if(!searchKeyword?.trim()?.length)
                searchKeyword = null
            if(!searchPhase?.trim()?.length)
                searchPhase = null
            */
            if(!searchTitle?.trim()?.length)
                searchTitle = null
            const searchResults = await avatar.sharedMemorySearch(searchAnonymous, searchGuessable, searchKeyword, searchPhase, searchTitle)
            const resourceText = JSON.stringify(searchResults)
            const searchResourceUri = `public-memories://search?anonymous=${ searchAnonymous }&guessable=${ searchGuessable }&title=${ searchTitle }` /* todo - same as research template, should reference instead of hard-coding */
            sessionMeta.resources.set(searchResourceUri,
                {
                    uri: searchResourceUri,
                    name: 'mylife-shared-memory-search-results',
                    title: `MyLife Public Memory Search Results (anonymous=${ searchAnonymous }&guessable=${ searchGuessable }&title=${ searchTitle })`,
                    mimeType: 'application/json',
                    text: resourceText,
                })
            resourceListChanged = true
            const resource = sessionMeta.resources.get(searchResourceUri)
            result = {
                description: `Stored search results in session for ${ resource.name }, a quick access function MyLife's public memories searches.\nStored search results can be accessed via a newly created resource for this session: "${ resource.uri }" and can be accessed in future requests.`,
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `Once human operator has reduced list to one item or selected it through an available interface, call the tool: "get_shared_memory" including the \`itemId\` of the indicated memory from this search, found on the server for this session duration at: ${ resource.uri }`,
                        }
                    },
                    {
                        role: 'assistant',
                        content: {
                            type: 'resource',
                            resource,
                        }
                    },
                ],
            }
            break
        default:
            break
    }
    return {
        error,
        resourceListChanged,
        result,
    }
}
/**
 * Completes an MCP request via prompts, completions or resources.
 * @todo - gate number of successive db calls to prevent abuse
 * @param {string} type - The type of the MCP completion; enum: [`completion`, `function`, `resource`]
 * @param {string} functionName - The name of the function to call for the MCP completion
 * @param {string|object} data - The object containing key/value pairs to inform the completion
 * @param {object} contextArguments - The context arguments to be used
 * @param {object} sessionMeta - The session metadata for the MCP completion
 * @param {Koa} ctx - The Koa context object
 * @param {AgentFactory|MyLifeFactory} factory - The factory object to use for the call
 * @param {Avatar|Q} avatar - The avatar instance
 * @returns {Array} - The array of arguments to be used for the MCP completion in place
 */
async function mMcpRequestResponse(type='function', functionName, data, contextArguments, sessionMeta, ctx, factory, avatar){
    const { fx, args=[], fxCallback, } = ( mMcpMap[functionName]?.[type] ?? {} )
    let error,
        resourceListChanged,
        result,
        success=false
    if(!fx)
        return {
            result:  {
                content: [{ text: `Function "${ functionName }" not found`, type: 'text' }],
                isError: true,
            }
        }
    const fxArgs = mMcpRequestArgs(args, data, contextArguments, sessionMeta, ctx, factory, avatar)
    const avatarFunction = typeof fx === 'string'
        ? avatar[fx]
        : fx
    if(typeof avatarFunction === 'function'){
        let functionResponse = await avatarFunction.bind(avatar)(...fxArgs)
        if(typeof fxCallback === 'function')
            functionResponse = await fxCallback.bind(avatar)(functionResponse)
        result = functionResponse?.result
            ?? functionResponse
        error = functionResponse?.error
        resourceListChanged = functionResponse?.resourceListChanged
        success = functionResponse?.success
            ?? true
    } else
        error = {
            code: -32603,
            data: { functionName, fx, args, },
            message: `Function "${ functionName }" is not callable`,
        }
    return {
        error,
        resourceListChanged,
        result,
        success,
    }
}
/**
 * Creates the MCP completion arguments based on the provided arguments, completion name, and value.
 * @todo - mcp inspector **not** correctly passing contextArguments; from spec: "For prompts or URI templates with multiple arguments, clients should include **previous completions** in the context.arguments object to provide context for subsequent requests." [emphasis mine]
 * @todo - gate number of db calls to prevent abuse
 * @param {object} args - The arguments object containing the MCP completion data
 * @param {string|object} data - The object containing key/value pairs to inform the completion
 * @param {string} contextArguments - The context arguments to be used
 * @param {object} sessionMeta - The session metadata for the MCP completion
 * @param {Koa} ctx - The Koa context object
 * @param {AgentFactory|MyLifeFactory} factory - The factory object to use for the call
 * @param {Avatar|Q} avatar - The avatar instance
 * @returns {Array} - The array of arguments to be used for the MCP completion in place
 */
function mMcpRequestArgs(args, data, contextArguments, sessionMeta, ctx, factory, avatar){
    const requestArguments = args.map(arg=>{
        if(arg.startsWith(mMcpConstant))
            return arg.split('.').slice(1).join('.')
        switch(arg.toLowerCase()){
            case 'avatar':
                return avatar
            case 'ctx':
                return ctx
            case 'factory':
                return factory
            case 'mcpdata':
            case 'mcp_data':
                return mcpData
            case 'sessionmeta':
            case 'session_meta':
                return sessionMeta
            default:
                return typeof data === 'string'
                    ? data
                    : data?.[arg]
        }
    })
    switch(typeof contextArguments){
        case 'string':
            break
        case 'object':
            break
    }
    return requestArguments
}
/**
 * Passthrough to call a function on the active bot or avatar, passing the MCP data to it.
 * @param {string} functionName - The function name to call
 * @param {object} mcpData - The MCP data to pass to the function
 * @param {object} sessionMeta - The session metadata
 * @param {Koa} ctx - The context object
 * @param {object} factory - The factory object to use for the call
 * @param {Avatar} avatar - The avatar instance
 * @returns {object} - The MCP-ready result of the function call
 */
async function mMcpFunction(functionName, mcpData, sessionMeta, ctx, factory, avatar){
    if(!functionName?.length)
        return
    const mcpFunctions = {
        mcp_change_title,
        mcp_chat,
        mcp_get_summary,
        mcp_obscure,
        mcp_switch_bot,
    }
    functionName = functionName.replace('mylife_', '')
    functionName = functionName.replace('mcp_', '')
    const mcpFunctionName = 'mcp_' + functionName
    if(mcpFunctions[mcpFunctionName]) // fx from local map
        return await mcpFunctions[mcpFunctionName](mcpData, sessionMeta, ctx, factory, avatar)
    const { error, result, } = await mMcpRequestResponse('function', factory.globals.jsFunctionName(functionName), mcpData, undefined, sessionMeta, ctx, factory, avatar)
    return { error, result, }
}
/**
 * Handles MCP resource requests, such as fetching resources based on the provided URI and any arguments/context.
 * @todo - query params should be passed to function
 * @param {string} uri - The URI of the MCP resource request
 * @param {object} sessionMeta - The session metadata
 * @param {Koa} ctx - The context object
 * @param {AgentFactory|MyLifeFactory} factory - The factory object
 * @param {Avatar|Q} avatar - The avatar instance
 * @return {Promise<object>} - The result of the MCP resource request { error, resourceListChanged, result, }
 */
async function mMcpResourceRequest(uri, sessionMeta, ctx, factory, avatar){
    if(sessionMeta.resources.has(uri))
        return { result: { contents: [sessionMeta.resources.get(uri)] }, }
    const resourcePath = uri.split('://')[1].split('?')[0]
    const resourceQueryParams = ( uri.split('?')?.[1]?.split('&') ?? [] )
    const resourceType = uri.split('://')[0]
    const resourceVariable = resourcePath.split('/').filter(Boolean).pop()
    const sessionResources = Array.from(sessionMeta.resources.values()).flat()
    const avatarResources = [...avatar.mcp.resources, ...avatar.mcp.resourceTemplates, ...sessionResources]
    const { description, mimeType, name, title, uri: avatarUri, uriTemplate, } = avatarResources
        .find(resource=>((resource.uri ?? resource.uriTemplate)?.split('://')?.[0])===resourceType)
    const renderedUri = resourceQueryParams?.length
        ? uri /* requires query params to be passed to function */
        : uriTemplate
            ?? avatarUri
    if(!renderedUri?.length)
        return {
            error: {
                code: -32603,
                message: `Resource "${ renderedUri }" not found in MCP resources`,
                data: { uri, resourceVariable, },
            }
        }
    const data = resourceQueryParams.length
        ? resourceQueryParams.reduce((acc, param)=>{
                const [key, value] = param.split('=')
                acc[key] = value === ''
                    ? null
                    : value
                return acc
            }, {})
        : resourceVariable
    let contextArguments // @todo - any context that makes sense here?
    const { error: requestError, result: requestResult, resourceListChanged: requestResourceListChanged, } = await mMcpRequestResponse('resource', factory.globals.jsFunctionName(resourceType), data, contextArguments, sessionMeta, ctx, factory, avatar)
    return {
        error: requestError,
        resourceListChanged: requestResourceListChanged,
        result: requestResult,
    }
}
async function mcp_change_title(mcpdata, sessionMeta, ctx, factory){
    const { itemId, title, } = mcpdata
    let error,
        result
    if(!itemId?.length)
        error = {
            code: -32602,
            data: mcpdata,
            message: '`itemId` parameter required'
        }
    if(!title?.length)
        error = {
            code: -32602,
            data: mcpdata,
            message: '`title` parameter required'
        }
    const { id, title: newTitle, } = await factory.updateItem({ id: itemId, title })
    result = id?.length && id===itemId
        ? {
            content: [{
                text: `Item title updated successfully: ${ itemId } to ${ newTitle }`,
                type: 'text',
            }],
            isError: false,
        }
        : {
            content: [{
                text: `Item title update failed: ${ itemId }`,
                type: 'text',
            }],
            isError: true,
        }
    return { error, result, }
}
async function mcp_chat(mcpdata, sessionMeta, ctx, factory, Avatar){
    const { message, } = mcpdata
    const Conversation = await Avatar.chat(message, message, true, Avatar.avatar)
    const content = Conversation?.responses?.length
        ? Conversation.responses.map(response=>({ text: response.message, type: 'text', }))
        : Conversation.getMessages(null, true).map(message=>({ text: message.content, type: 'text', }))
    const result = {
        content,
        isError: false,
    }
    return { result, }
}
async function mcp_get_summary(mcpdata, sessionMeta, ctx, factory){
    const { itemId, } = mcpdata
    let error,
        result
    if(!itemId?.length)
        error = {
            code: -32602,
            data: mcpdata,
            message: '`itemId` parameter required'
        }
    const { summary, } = await factory.item(itemId)
        ?? {}
    result = summary?.length
        ? {
            content: [{
                text: summary,
                type: 'text',
            }],
            isError: false,
        }
        : {
            content: [{
                text: `No summary found for item id: ${ itemId }`,
                type: 'text',
            }],
            isError: true,
        }
    return { error, result, }
}
/**
 * Obscures a summary or item content using the avatar bot.
 * @param {object} mcpdata - The MCP data object containing `itemId` and optional `obscuredSummary`
 * @param {object} sessionMeta - The session metadata
 * @param {Koa} ctx - The context object
 * @returns {Promise<object>} - The result of the obscuration process
 */
async function mcp_obscure(mcpdata, sessionMeta, ctx, factory, avatar){
    const { forceServer=false, itemId, obscuredSummary, } = mcpdata
    let error,
        result,
        success = false
    if(!itemId?.length)
        error = {
            code: -32602,
            data: mcpdata,
            message: 'Parameter `itemId` required for obscuration'
        }
    const item = await factory.item(itemId)
    if(!item)
        error = {
            code: -32602,
            data: mcpdata,
            message: `\`itemId\`: ${ itemId } not found or inaccessible to this member`,
        }
    else if(!obscuredSummary?.length) /* no `obscuredSummary` provided */
        if(!forceServer && mcpClientAllowsRequest(sessionMeta.capabilities)){
            const { summary, } = item
            const example = 'Ex. "Joseph works at MyLife." becomes "J. works at MyLife."'
            const explanation = {
                elicitation: `Create an OBSCURED version of the provided summary for itemId: ${ itemId } and confirm with human.\n${ example }\nSUMMARY:\n${ item.summary }`,
                sampling: `Obscuration for itemId: ${ itemId } requires sampling response.\nProcess this sample request and respond with text field being the complete obscured summary.\nSUMMARY:\n${ item.summary }`,
            }
            const instructions = {
                elicitation: { /* elicitation response schema becomes the instructions */
                    type: 'object',
                    properties: {
                        obscuredSummary: {
                            description: 'Human-confirmed version of an intelligence-generated obscuration of the original text summary. Example: "Joseph works at MyLife." becomes "J. works at MyLife."',
                            title: 'Obscured Summary',
                            type: 'string',
                        },
                    },
                    required: ['obscuredSummary'],
                },
                sampling: 'I am given a text summary, and I create an obscured version where no human names are present. I remove direct references to human names, replacing them with the capitalized first letter of the name.\nWhen finished, I respond to the request with the message text field being the complete obscured summary.',
            }
            const explanation_tool = `Obscuration for itemId: ${ itemId } requires tool response.\ncreate an obscured version where no human names are present. I remove direct references to human names, replacing them with the capitalized first letter of the name.\nSUMMARY:\n${ summary }.\nWhen finished, I run the obscure tool again with the obscured summary as the \`obscuredSummary\` parameter and continue to include itemId: \`${ itemId }.\`` // **note**: Explanation _should_ be usable and used in lieu of sampling with most clients
            const { requests, transportEntry: transport, } = sessionMeta
            const callback = {
                forceServer: false,
                itemId,
                _function: 'obscure',
                _replace: 'obscuredSummary',
            }
            const { error: mcpError, mcpRequest, } = await mcpClientRequest(sessionMeta.capabilities, factory.globals, transport, ctx.request?.body, explanation, instructions, undefined, callback)
            if(mcpError)
                return { error: mcpError, success, }
            const { id, } = mcpRequest
            if(id?.length){
                requests.set(id, mcpRequest)
                result = {
                    content: [{
                        text: `Accompanying \`elicitation\` (or \`sampling\`) request sent via stream with id: ${ id }. Please fulfill server request.`,
                        type: 'text',
                    }],
                    isError: false,
                }
                success = true
            }
        } else {
            const { responses, success=false, } = await avatar.obscure(itemId)
            const text = responses?.[0]?.message
                ?? `itemId: ${ itemId } not found or not accessible for this member`
            result = {
                content: [{
                    text,
                    type: 'text',
                }],
                isError: !success,
            }
        }
    else {
        const { summary, } = await factory.updateItem({
            id: itemId,
            summary: obscuredSummary,
        })
        if(!summary?.length)
            error = {
                code: -32602,
                data: mcpdata,
                message: `Failed to update itemId: ${ itemId } with obscured summary`,
            }
        else {
            const text = `Successfully updated to obscured content.\n` + summary
            result = {
                content: [{
                    text,
                    type: 'text',
                }],
                isError: false,
            }
            success = true
        }
    }
    return {
        error,
        result,
        success,
    }
}
async function mcp_switch_bot(mcpdata, sessionMeta, ctx, factory, avatar){
    const { team='memory', type, } = mcpdata
    let { id=avatar.bot(undefined, type)?.id, } = mcpdata
    let error,
        result
    if(avatar.isMyLife)
        error = {
            code: 403,
            data: mcpdata,
            message: 'MyLife System Avatar cannot switch bots'
        }
    else if(team!=='memory')
        error = {
            code: -32602,
            data: mcpdata,
            message: 'Currently only the Memory Team is supported'
        }
    else if(!type?.length)
        error = {
            code: -32602,
            data: mcpdata,
            message: '`type` parameter required for switching bots'
        }
    else if(!id?.length)
        result = {
            content: [{
                text: `No bot found for type: ${ type }`,
                type: 'text',
            }],
            isError: true,
        }
    else if(avatar.activeBot.id===id)
        result = {
            content: [{
                text: `Bot type "${ type }" already currently active`,
                type: 'text',
            }],
            isError: true,
        }
    else {
        const { id: botId, responses, success, } = await avatar.setActiveBot(id, null, false)
        if(!success || botId!==id)
            result = {
                content: [{
                    text: `Failed to switch bot to ${ type }`,
                    type: 'text',
                }],
                isError: true,
            }
        else {
            const { bot_name: name, description, id: activeBotId, provider, type, welcome } = avatar.activeBot
            const activeBot = {
                description,
                id: activeBotId,
                name,
                provider,
                type,
                welcome: welcome ?? responses?.[0],
            }
            const availableAgents = avatar.bots
                .map(bot=>({
                    description: bot.description,
                    id: bot.id,
                    name: bot.bot_name,
                    type: bot.type,
                }))
            const explanation = `Successfully switched active bot`
            const structuredContent = {
                activeBot,
                availableAgents,
                explanation,
            }
            result = {
                content: [{
                    text: JSON.stringify(structuredContent),
                    type: 'text',
                }],
                isError: false,
                notification: 'notifications/tools/list_changed',
                structuredContent,
            }
        }
    }
    return {
        error,
        result,
        toolListChanged: true, // true for switching bots, as they have different skills
    }
}
function mPruneConversation(conversation){
    const { bot_id, form, id, name, type, } = conversation
    return {
        bot_id,
        form,
        id,
        name,
        type,
    }
}
function mPruneEvent(Event, sid){
    const { action, character, dialog, id, input, order, stage, title, type, } = Event
    return {
        action,
        character,
        dialog,
        eid: id,
        id,
        input,
        order,
        sid,
        stage,
        title,
        type,
    }
}
function mPruneExperience(Experience){
    const { autoplay, description, events: unfilteredEventArray, id, location, purpose, skippable, title, } = Experience
    const events = unfilteredEventArray
        .filter(event=>event.portrayed===false)
        .map(event=>{
            event.portrayed=true
            return mPruneEvent(event, location.sid)
        })
    return {
        autoplay,
        description,
        events,
        id,
        location,
        purpose,
        skippable,
        title,
        xid: id,
    }
}
/**
 * Returns a frontend-ready collection item object, pruned of cosmos database fields.
 * @module
 * @param {object} document - The collection item object to prune
 * @returns {object} - The pruned collection item object
 */
function mPruneItem(item){
    const {
        assistantType,
        being,
        complete=false,
        form,
        id,
        keywords,
        mood,
        phaseOfLife,
        relationships,
        shares=[],
        summary,
        title,
        type,
        version=1.0,
    } = item
    item = {
        assistantType,
        being,
        complete,
        form,
        id,
        keywords,
        mood,
        phaseOfLife,        
        relationships,
        shares,
        summary,
        title,
        type,
        version,
    }
    return item
}
/**
 * Returns frontend-ready Message object after logic mutation.
 * @module
 * @private
 * @param {Guid} activeBotId - The Active Bot id property
 * @param {string} message - The text of LLM message; can parse array of messages from openAI
 * @param {string} type - The type of message, defaults to chat
 * @param {number} processStartTime - The time the process started, defaults to function call
 * @returns {object} - The pruned message object
 */
function mPruneMessage(activeBotId, message, type='chat', processStartTime=Date.now()){
    /* parse message */
    let agent='server',
        content='',
        response_time=Date.now()-processStartTime
    const { content: messageContent=message, } = message
    const rLines = /\n{2,}/g
    const rSource = /【.*?\】/gs
    content = Array.isArray(messageContent)
        ? messageContent.reduce((acc, item) => {
            if (item?.type==='text' && item?.text?.value){
                acc += item.text.value + '\n'
            }
            return acc
        }, '')
        : messageContent
    content = content // .replace(rLines, '\n')
        .replace(rSource, '') // remove OpenAI LLM "source" references
    message = new Marked().parse(content)
    const messageResponse = {
        activeBotId,
        agent,
        message,
        response_time,
        type,
    }
    return messageResponse
}
/**
 * Prune an array of Messages and return.
 * @param {Guid} botId - The Active Bot id property
 * @param {Object[]} messageArray - The array of messages to prune
 * @param {string} type - The type of message, defaults to chat
 * @param {number} processStartTime - The time the process started, defaults to function call
 * @returns {Object[]} - Concatenated message object
 */
function mPruneMessages(botId, messageArray, type='chat', processStartTime=Date.now()){
    messageArray = messageArray
        .map(message=>mPruneMessage(botId, message, type, processStartTime))
    return messageArray
}
/**
 * Returns a narration packet for a memory reliving. Will allow for and accommodate the incorporation of helpful data _from_ the avatar member into the memory item `summary` and other metadata. The bot by default will:
 * - break memory into `scenes` (2 to 5) set scene, ask for input [determine default what] 2) develop action, dramatize, describe input mechanic 3) conclude scene, moralize - what did you learn? then share what you feel author learned
 * - perform/narrate the memory as scenes describe
 * - others are common to living, but with `reliving`, the biographer bot (only narrator allowed in .10) incorporate any user-contributed contexts or imrpovements to the memory summary that drives the living and sharing. All by itemId.
 * - if user "interrupts" then interruption content should be added to memory updateSummary; doubt I will keep work interrupt, but this too is hopefully able to merely be embedded in the biographer bot instructions.
 * Currently testing efficacy of all instructions (i.e., no callbacks, as not necessary yet) being embedded in my biog-bot, `madrigal`.
 * @param {object} item - The memory object
 * @param {string} memberInput - The member input (or simply: NEXT, SKIP, etc.)
 * @param {BotAgent} BotAgent - The Bot Agent instance
 * @param {Avatar} Avatar - Member Avatar instance
 * @returns {Promise<object>} - The reliving memory object for frontend to execute: 
 */
async function mReliveMemoryNarration(item, memberInput, BotAgent, Avatar){
    console.log('Avatar::mReliveMemoryNarration()::memberInput', memberInput)
    Avatar.livingMemory = await BotAgent.liveMemory(item, memberInput, Avatar)
    if(Avatar.livingMemory.endMemory || Avatar.livingMemory.turns >= 7) // memory ended by biographer
        return await Avatar.endMemory(item?.id)
    const { Conversation, item: livingMemoryItem, } = Avatar.livingMemory
    const { botId, type, } = Conversation
    const endpoint = `/members/memory/end/${ livingMemoryItem.id }`
    const defaultInstruction = {
        command: 'createInput',
        inputs: [{
            endpoint,
            id: Avatar.newGuid,
            interfaceLocation: 'chat',
            method: 'PATCH',
            prompt: `I'd like to stop reliving this memory.`,
            required: true,
            type: 'button',
        }],
    }
    if(!Avatar.frontendInstructions.length)
        Avatar.frontendInstructions = defaultInstruction
    const responses = Conversation.getMessages(true, true)
        .map(message=>mPruneMessage(botId, message, type))
    return mBuildResponse(Avatar, { item, responses, success: true })
}
/**
 * Returns a processed routine.
 * @param {string|object} script - The routine script, converts JSON to object { cast, description, developers, events, files, name, public, purpose, status, title, version, }
 * @param {Avatar} Avatar - The avatar instance
 * @param {BotAgent} BotAgent - The BotAgent instance
 * @returns {object} - Synthetic Routine object (if maintained, develop into class; presumed it will be deleted altogether and folded into simple experiences) { cast, description, developers, events, purpose, title, }
 */
function mRoutine(script, Avatar, BotAgent){
    if(typeof script === 'string')
        script = JSON.parse(script)
    const defaultCastMember = {
        icon: 'avatar-thumb',
        id: 'avatar',
        role: Avatar.nickname,
        type: 'avatar',
    }
    const { cast=[defaultCastMember], clearSystemChat=false, description, developers, events, files, name, pause, public: isPublic, purpose, status, title, typeSpeed, variables, version=1.0, } = script
    if(!cast?.length || !events?.length)
        throw new Error('Routine must have a well-structured `cast` and `events` array.')
    if(!isPublic)
        throw new Error('Routine is not currently for public release.')
    if(status!=='active' || version < 1)
        throw new Error('Routine is not currently active.')
    let activeCastMember = cast.find(castMember=>castMember.id===(events[0]?.character?.id))
        ?? cast[0]
    if(variables?.length){
        variables.forEach(_variable=>{
            const { default: variableDefault, replacement: variableReplacement, variable, } = _variable
            events.forEach(event=>{
                if(event.character)
                    activeCastMember = cast.find(castMember=>castMember.id===event.character)
                        ?? activeCastMember
                const Bot = BotAgent.bot(undefined, activeCastMember.type) ?? {}
                const replacement = Bot[variableReplacement]?.toString()
                    ?? Avatar[variableReplacement]?.toString()
                    ?? variableDefault
                const { message, } = event?.dialog ?? {}
                if(message)
                    event.dialog.message = message.replace(new RegExp(`${ variable }`, 'g'), replacement)
            })
        })
    }
    return {
        cast,
        clearSystemChat,
        description,
        developers,
        events,
        pause,
        purpose,
        title,
        typeSpeed,
    }
}
/**
 * Sets core values in the member's dataservice core. USE WITH CAUTION, as this can overwrite important data if used improperly.
 * Note: when passed an array of { key, value } objects, it reduces to an object, so both formats are accepted.
 * Note: All `value` typeof Array will by default completely overwrite underlying array; only specified properties (like `feedback`) add/remove.
 * @todo - run through consent engine
 * @param {Array|Object} values - The values to set in the core, either as an array of { key, value } objects or as a single object with key-value pairs.
 * @returns {Promise<object>} - The updated values in `core` (in case something didn't match, can be reviewed and verified)
 */
async function mSetCoreValues(coreValues, Factory){
    const response = { input: coreValues, success: false, }
    try {
        if(typeof coreValues === 'string')
            coreValues = JSON.parse(coreValues)
        if(Array.isArray(coreValues))
            coreValues = coreValues.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
        response.result = await Factory.setCoreValues(coreValues)
        response.success = true
    } catch(err) {
        response.error = err
        // extract from Factory.core only the keys from values
        response.result = {}
        const keys = Object.keys(coreValues)
        for(const key of keys)
            response.result[key] = Factory.core[key]
        console.error('Error setting core values:', response.error.message, coreValues, response.result)
    }
    return response
}
/**
 * Request to set Core Values 
 * @param {Array|object} coreValues - The core values to set, either as an array of { key, value } objects or as a single object with key-value pairs.
 * @param {string} label - Context for the type of core values being set
 * @param {AgentFactory} Factory - The AgentFactory instance to use for setting core values
 * @return {Promise<object>} - The response from setting core values, including success status and any messages for the user
 */
async function mSetCoreValuesResponse(coreValues, label, Factory){
    const response = await mSetCoreValues(coreValues, Factory)
    response.action = response?.success
        ? `Data has been updated based on conversation; see response \`result\`; Continue from previous conversation point or pursue new topics based on updated information.`
        : `unexpected error while updating ${ label } information; ask to try again`
    return response
}
/**
 * Validate provided registration id.
 * @private
 * @param {object} botId - The active bot object.
 * @param {AgentFactory} factory - AgentFactory object.
 * @param {Guid} validationId - The registration id.
 * @returns {Promise<Object>} - The validation result: { registrationData, responses, success, }.
 */
async function mValidateRegistration(botId, factory, validationId){
    /* validate request */
    if(!factory.globals.isValidGuid(validationId))
        throw new Error('FAILURE::validateRegistration()::Invalid validation id.')
    const failureMessage = `I\'m sorry, but I\'m currently unable to validate your registration id:<br />${ validationId }.<br />I\'d be happy to talk with you more about MyLife, but you may need to contact member support to resolve this issue.`
    if(!factory.isMyLife)
        throw new Error('FAILURE::validateRegistration()::Registration can only be validated by MyLife.')
    let message,
        registrationData = {
            id: validationId
        },
        success = false
    const responses = []
    /* execute request */
    const registration = await factory.validateRegistration(validationId)
    if(registration){
        const { avatarName, being, email: registrationEmail, humanName, } = registration
        const eligible = being==='registration'
            && factory.globals.isValidEmail(registrationEmail)
        if(eligible){
            const successMessage = `Hello and _thank you_ for your registration, ${ humanName }!\nI'm Q, the ai-representative for MyLife, and I'm excited to help you get started, so let's do the following:\n\n1. Verify your email address\n2. set up your account\n3. get you started with your first MyLife experience!\n\nLet me walk you through the process.\n\nIn the chat below, please enter the email you registered with and hit the **submit** button!`
            message = mCreateSystemMessage(botId, successMessage, factory.message)
            registrationData.avatarName = avatarName
                ?? humanName
                ?? 'My AI-Agent'
            registrationData.humanName = humanName
            success = true
        }
    }
    message = message
        ?? mCreateSystemMessage(botId, failureMessage, factory.message)
    responses.push(message)
    return {
        registrationData,
        responses,
        success,
    }
}
/* exports */
export {
	Avatar,
	Q,
}