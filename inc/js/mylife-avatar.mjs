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
import { Entry, Memory, } from './mylife-models.mjs'
import EvolutionAgent from './agents/system/evolution-agent.mjs'
import { ExperienceAgent, ShareAgent, } from './agents/system/experience-agent.mjs'
import LLMServices from './mylife-llm-services.mjs'
import { mcpClientAllowsDirectory, mcpClientAllowsRequest, mcpClientRequest, } from './controllers/mcp-functions.mjs'
/* module constants */
const __dirpath = fileURLToPath(import.meta.url)
const mAllowSave = JSON.parse(
    process.env.MYLIFE_DB_ALLOW_SAVE
        ?? 'false'
)
const mDefaultRoutinePath = path.resolve(path.dirname(__dirpath), '..', 'json-schemas/routines/') + '/'
const mJsonRpcVersion = process.env.MCP_JSONRPC_Version,
    mJsonRpcProtocolVersion = process.env.MCP_JSONRPC_Protocol_Version,
    mMcpConstant = 'mylife-constant.'
const mMcpMap = {
    changeTitle: { /* no implicit call for this in Avatar instance */
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
    createSummary: { /* no implicit call for this in Avatar instance */
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
        }
    },
    getMemories: { /* no implicit call for this in Avatar instance */
        args: ['avatar'],
        fx: async (avatar)=>{
            const preface = 'Here are the titles and ids (display only titles for human member) for the memories we have created together:\n'
            const response = ( await avatar.bot(undefined, 'biographer').collections() )
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
    endReliving: {
        args: [],
        fx: 'endMemory',
    },
    logout: {
        args: ['ctx', 'avatar'],
        fx: (ctx, avatar)=>{
            avatar.logout(ctx)
            // @todo - close any open runs? or push this to `mcp-functions.mjs` as `import`?
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
    sharedMemorySearch: {
        args: ['anonymous', 'guessable', 'keyword', 'phase', 'title'],
        fx: 'sharedMemorySearch',
        fxCallback: (values)=>{
            const returnValues = values.map(value=>value.title.trim())
            return returnValues
        }
    }
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
 * @todo - deprecate `factory` getter
 */
class Avatar extends EventEmitter {
    #alertsShown = [] // array of alert ids
    #alphaDog
    #assetAgent
    #botAgent
    #collectionsAgent
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
     * @async
     * @public
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
			.map(experience=>{ // map to display versions [from `mylife-avatar.mjs`]
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
	 * @param {Guid} bot_id - The Bot id (optional, defaults to avatar)
	 * @param {String} botType - The Bot type (optional, defaults to avatar)
	 * @returns {Promise<Bot>} - The Bot instance
	 */
    bot(bot_id, botType){
        const Bot = this.#botAgent.bot(bot_id, botType)
        return Bot
    }
    /**
     * Processes and executes incoming chat request.
     * @public
     * @param {string} message - The chat message content
     * @param {Guid} itemId - The active collection-item id (optional)
     * @returns {object} - The response object { instruction, responses, success, }
    */
    async chat(message, itemId){
        /* validate request */
        if(!message)
            throw new Error('No message provided in context')
        const originalMessage = message
        let responses = [],
            success = false
        this.backupResponse = {
            message: `I got your message, but I'm having trouble processing it. Please try again.`,
            type: 'system',
        }
        /* execute request */
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
        // no active run_id in Conversation, so make sure to include it
        responses = mPruneMessages(this.activeBotId, Conversation.getMessages(true, Conversation.run_id) ?? [], 'chat', Conversation.processStartTime)
        const { actionCallback, frontendInstruction, } = this
        if(!responses.length)
            responses.push(this.backupResponse)
        else
            success = true
        if(actionCallback?.length){
            switch(actionCallback){
                case 'changeTitle':
                    const { title: changeTitleTitle, } = frontendInstruction
                    if(!changeTitleTitle?.length)
                        throw new Error('No title provided')
                    const changeTitleData = {
                        id: itemId,
                        title: changeTitleTitle
                    }
                    const changeTitleItem = await this.itemUpdate(changeTitleData)
                    if(changeTitleItem.id===itemId){
                        this.frontendInstruction.command = 'updateItemTitle'
                        responses = [{
                            message: `I was able to change our title to "${ changeTitleTitle }".`,
                            type: 'system',
                        }]
                        success = true
                    } else
                        responses = [{
                            message: `I encountered an error while trying to change our title to "${ changeTitleTitle }".`,
                            type: 'system',
                        }]
                    break
                case 'updateItem':
                case 'updateItemSummary':
                case 'updateSummary':
                    const { summary: updateSummarySummary, } = frontendInstruction.item
                    const updateSummaryData = {
                        id: itemId,
                        summary: updateSummarySummary,
                    }
                    const updateSummaryItem = await this.itemUpdate(updateSummaryData)
                    if(updateSummaryItem.id===itemId){
                        this.frontendInstruction.command = 'updateItem'
                        responses = [this.backupResponse
                            ?? {
                                message: `I was able to update our summary with this info.`,
                                type: 'system',
                            }]
                        success = true
                    }
                    break
                default:
                    break
            }
        }
        const response = {
            instruction: this.frontendInstruction,
            responses,
            success,
        }
        /* respond request */
        delete this.actionCallback
        delete this.backupResponse
        delete this.frontendInstruction
        return response
    }
    /**
     * Chat with an open agent, bypassing specific or active bot.
     * @param {Conversation} Conversation - The conversation instance
     * @returns {Promise<Object>} - Response object: { instruction, responses, success, }
     * @note - Conversation instance is altered in place
     */
    async chatAgentBypass(Conversation){
        if(!this.isMyLife)
            throw new Error('Agent bypass only available for MyLife avatar.')
		await this.#botAgent.chat(Conversation, mAllowSave, this)
        const responses = mPruneMessages(this.activeBotId, Conversation.getMessages(), 'chat', Conversation?.processStartTime)
        /* respond request */
        const response = {
            instruction: this.frontendInstruction,
            responses,
            success: true,
        }
        delete this.frontendInstruction
        delete this.backupResponse
        return response
    }
    /**
     * Get member collection items.
     * @todo - trim return objects based on type
     * @param {string} type - The type of collection to retrieve, `false`-y = all.
     * @returns {array} - The collection items with no wrapper.
     */
    async collections(type){
        if(type==='file'){
            await this.#assetAgent.init(this.#vectorstoreId)
            return this.#assetAgent.files
        }
        const collections = ( await this.#factory.collections(type) )
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
     * @async
     * @public
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
     * End the living memory, if running.
     * @async
     * @public
     * @todo - save conversation fragments
     * @returns {object} - The response object { instruction, responses, success, }
     */
    async endMemory(){
        if(!this.#livingMemory)
            return
        const { Conversation, id, item, } = this.#livingMemory
        const { bot_id, } = Conversation
        if(mAllowSave)
            await Conversation.save()
        const instruction = {
            command: `endMemory`,
            itemId: item.id,
        }
        const responses = [mCreateSystemMessage(bot_id, `I've ended the memory, thank you for letting me share my interpretation. I hope you liked it.`, this.#factory.message)]
        const response = {
            instruction,
            responses,
            success: true,
        }
        this.#livingMemory = null
        return response
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
     * @public
     * @param {Guid} xid - The experience id
     * @param {object} memberInput - Member input object
     * @returns {object} - The frontend response object: { error, experience, instruction, success, }
     */
    async experience(xid, memberInput){
        const Experience = await this.#experienceAgent.experience(xid, memberInput)
        const experience = mPruneExperience(Experience)
        // add frontend instructions here
        const response = {
            instructions: this.frontendInstruction,
            experience,
            success: true,
        }
        return response
    }
    /**
     * Ends the specified experience.
     * @public
     * @param {Guid} xid - The experience id
     * @returns {void}
     */
    experienceEnd(xid){
        this.#experienceAgent.experienceEnd(xid)
    }
    /**
     * Returns array of available experiences for the member in shorthand object format, i.e., not a full `Experience` class instance. That is only required when performing.
     * @public
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
     * Specified by id, returns the pruned Bot.
     * @param {Guid} id - The Bot id
     * @returns {object} - The pruned Bot object
     */
    getBot(bot_id){
        const bot = this.#botAgent.bot(bot_id)?.bot
        return bot
    }
    /**
     * Returns pruned Bots for Member Avatar.
     * @returns 
     */
    getBots(){
        const bots = this.bots
            .map(Bot=>Bot.bot)
        return bots
    }
    /**
     * Gets Conversation object. If no thread id, creates new conversation.
     * @param {string} thread_id - openai thread id (optional)
     * @param {Guid} bot_id - The bot id (optional)
     * @returns {Conversation} - The conversation object.
     */
    getConversation(thread_id, bot_id){
        const conversation = this.conversations
            .filter(c=>(thread_id?.length && c.thread_id===thread_id) || (bot_id?.length && c.bot_id===bot_id))
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
        return {
            responses,
            routine,
            success,
        }
    }
    /**
     * Request help about MyLife. **caveat** - correct avatar should have been selected prior to calling.
     * @param {string} helpRequest - The help request text.
     * @param {string} type - The type of help request.
     * @returns {Promise<Object>} - openai `message` objects.
     */
    async help(helpRequest, type){
        const processStartTime = Date.now()
        if(!helpRequest?.length)
            throw new Error('Help request required.')
        // @stub - force-type into enum?
        helpRequest = mHelpIncludePreamble(type, this.isMyLife) + helpRequest
        const { thread_id, } = this.activeBot
        const { bot_id, } = this.helpBots?.find(bot=>(bot?.subType ?? bot?.sub_type ?? bot?.subtype)===type)
            ?? this.helpBots?.[0]
            ?? this.activeBot
        const conversation = this.getConversation(thread_id)
        const helpResponseArray = await this.factory.help(thread_id, bot_id, helpRequest)
        conversation.addMessages(helpResponseArray)
        if(mAllowSave)
            conversation.save()
        else
            console.log('MemberAvatar::help()::BYPASS-SAVE', conversation.message.content)
        const response = mPruneMessages(this.activeBotId, helpResponseArray, 'help', processStartTime)
        return response
    }
    /**
     * Manages a collection item's functionality.
     * @todo - assistantType fix, whether to include on frontend or omit as is now form from LLM
     * @param {Object} item - The item data object
     * @param {String} method - The http method used to indicate response
     * @returns {Promise<Object>} - Returns { instruction, item, responses, success, }
     */
    async item(item, method='get'){
        const { globals, mbr_id, } = this
        const response = { item, success: false, }
        const instruction={},
            message={
                agent: 'server',
                message: `I encountered an error while trying to process your request; please try again.`,
                type: 'system',
            }
        const { assistantType, id: itemId, llm_id=this.activeBot.llm_id, } = item
        let { form, summary, title, type=this.activeBot.type, } = item
        let itemDatabase,
            Item,
            success = false
        if(itemId)
            itemDatabase = await this.#factory.item(itemId)
        if(itemId && !globals.isValidGuid(itemId))
            throw new Error(`Invalid item id: ${ itemId }`)
        switch(method.toLowerCase()){
            case 'delete':
                success = await this.#factory.deleteItem(itemId)
                message.message = success
                    ? `I have successfully deleted your item.`
                    : `I encountered an error while trying to delete your item, id: ${ itemId }.`
                instruction.command = success
                    ? 'removeItem'
                    : 'error'
                instruction.itemId = itemId
                break
            case 'post': /* create */
                /* validate request */
                item.assistantType = assistantType
                    ?? this.#botAgent.getAssistantType(form, type)
                item.llm_id = llm_id
                /* execute request */
                Item = mItem(item, this, this.#llmServices)
                /* return response */
                if(!!Item){
                    Item.create() // remove `await`
                    instruction.command = 'createItem'
                    instruction.item = mPruneItem(Item.item)
                    message.message = `Item successfully created: "${ response.item.title }".`
                    response.item = instruction.item
                    success = true
                } else {
                    instruction.command = 'error'
                    message.message = `I encountered an error while creating: "${ title }".`
                }
                break
            case 'put': /* update */
                if(!itemDatabase)
                    break
                Item = await mItem(itemDatabase, this, this.#llmServices)
                if(!!Item){
                    Item.update(item, true)
                    instruction.command = 'updateItem'
                    instruction.item = mPruneItem(Item.item)
                    message.message = `I have successfully updated: "${ Item.title }".`
                    response.item = instruction.item
                    success = true
                } else
                    message.message = `I encountered an error while trying to update: "${ title }".`
                break
            default:
                if(!itemDatabase)
                    break
                Item = await mItem(itemDatabase, this, this.#llmServices)
                if(!!Item){
                    response.item = mPruneItem(Item.item)
                    success = true
                }
                break
        }
        this.frontendInstruction = instruction // LLM-return safe
        response.instruction = instruction // direct-access
        response.responses = [message]
        response.success = success
        return response
    }
    async itemCreate(item){
        return await this.#factory.createItem(item)
    }
    /**
     * Proxy to save an item to the database.
     * @param {object} item - The item data object
     * @returns {Promise<object>} - The saved item object
     */
    async itemUpdate(item){
        return await this.#factory.updateItem(item)
    }
    /**
     * Logs out the current session, removing relevant MyLife session artifacts.
     * @param {Koa} ctx - The Koa context object
     * @returns {Promise<void>}
     */
    logout(ctx){
        ctx.session.avatar = ctx.SystemAvatar // reset to SystemAvatar
        ctx.session.locked = true // lock session
    }
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
    async mcpCompletion(type, reference, argument, contextArguments, sessionMeta, ctx){
        return await mMcpCompletion(type, reference, argument, contextArguments, sessionMeta, ctx, this.#factory, this)
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
    async mcpFunctionResponse(type='sampling', callback, mcpData={}, sessionMeta, ctx){
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
     * Migrates a bot to a new, presumed combined (with internal or external) bot.
     * @param {Guid} bot_id - The bot id
     * @returns {Promise<Bot>} - The migrated Bot instance
     */
    async migrateBot(bot_id){
        const migration = await this.#botAgent.migrateBot(bot_id)
        return migration
    }
    /**
     * Migrates a chat conversation from an old thread to a newly created (or identified) destination thread.
     * @param {string} thread_id - Conversation thread id in OpenAI
     * @returns {Conversation} - The migrated conversation object
     */
    async migrateChat(bot_id){
        const success = await this.#botAgent.migrateChat(bot_id)
        const response = {
            responses: [success
                ? {
                    agent: 'server',
                    message: `I have successfully migrated this conversation to a new thread.`,
                    type: 'chat',
                }
                : {
                    agent: 'server',
                    message: `I'm sorry - I encountered an error while trying to migrate this conversation; please try again.`,
                    type: 'chat',
                }
            ],
            success,
        }
        return response
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
     * Given an itemId, obscures aspects of contents of the data record. Obscure is a vanilla function for MyLife, so does not require intervening intelligence and relies on the factory's modular LLM.
     * @param {Guid} iid - The item id
     * @returns {Object} - The obscured item object
     */
    async obscure(iid){
        const updatedSummary = await this.activeBot.obscure(iid)
        this.frontendInstruction = {
            command: 'updateItemSummary',
            itemId: iid,
            summary: updatedSummary,
        }
        return {
            instruction: this.frontendInstruction,
            responses: [{
                agent: 'server',
                message: `I have successfully obscured your content.`,
            }],
            success: true,
        }
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
     * Member request to retire a bot.
     * @param {Guid} bot_id - The id of Bot to retire
     * @returns {object} - The Response object: { instruction, responses, success, }
     */
    async retireBot(bot_id){
        const success = await this.#botAgent.botDelete(bot_id)
        const response = {
            instruction: {
                command: success
                    ? 'removeBot'
                    : 'error',
                id: bot_id,
            },
            responses: [success
                ? {
                    agent: 'server',
                    message: `I have removed this bot from the team.`,
                    type: 'chat',
                }
                : {
                    agent: 'server',
                    message: `I'm sorry - I encountered an error while trying to retire this bot; please try again.`,
                    type: 'system',
                }
            ],
            success,
        }
        if(!success)
            instruction.error = 'I encountered an error while trying to retire this bot; please try again.'
        return response
    }
    /**
     * Currently only proxy for `migrateChat`.f
     * @param {string} bot_id - Bot id with Conversation to retire
     * @returns {object} - The response object { instruction, responses, success, }
     */
    async retireChat(bot_id){
        const success = await this.#botAgent.migrateChat(bot_id)
        /* respond request */
        const response = success
            ? { /* @todo - add frontend instructions to remove migrateChat button */
                instruction: null,
                responses: [{
                    agent: 'server',
                    message: `I have successfully retired this conversation.`,
                    type: 'chat',
                }],
                success: true,
            }
            : {
                instruction: null,
                responses: [{
                    agent: 'server',
                    message: `I'm sorry - I encountered an error while trying to retire this conversation; please try again.`,
                    type: 'chat',
                }],
                success: false,
            }
        return response
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
     * @param {Guid} bot_id - The bot id
     * @returns {object} - Activated Response object: { bot_id, greeting, success, version, versionUpdate, }
     */
    async setActiveBot(bot_id){
        const dynamic = false
        const response = await this.#botAgent.setActiveBot(bot_id, dynamic)
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
     * @returns {Promise<Share>} - The Share response object { error, instruction, responses, success, warnings, }
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
     * Summarize the file indicated.
     * @param {string} fileId 
     * @param {string} fileName 
     * @param {number} processStartTime 
     * @returns {Object} - The response object { error, instruction, responses, success, }
     */
    async summarize(fileId, fileName, processStartTime=Date.now()){
        /* validate request */
        let responses = [],
            success = false
        this.backupResponse = {
            message: `I received your request to summarize, but an error occurred in the process. Perhaps try again with another file.`,
            type: 'system',
        }
        /* execute request */
        responses.push(...await this.#botAgent.summarize(fileId, fileName, processStartTime))
        /* respond request */
        if(!responses?.length)
            responses.push(this.backupResponse)
        else {
            responses = mPruneMessages(this.avatar.id, responses, 'mylife-file-summary', processStartTime)
            success = true
        }
        return {
            responses,
            success,
        }
    }
    /**
     * Get a specified team, its details and _instanced_ bots, by id for the member.
     * @param {string} teamId - The team id
     * @returns {object} - Team object
     */
    team(teamId){
        this.#botAgent.setActiveTeam(teamId)
        const team = this.#botAgent.activeTeam
        return team
    }
    /**
     * Get a list of available teams and their default details.
     * @returns {Object[]} - List of team objects.
     */
    teams(){
        const teams = this.#botAgent.teams
        return teams
    }
    /**
     * Update a specific bot.
     * @async
     * @param {Object} botData - Bot data to set
     * @returns {Promise<Object>} - The updated bot
     */
    async updateBot(botData){
        const Bot = await this.#botAgent.updateBot(botData)
        return Bot.bot
    }
    /**
     * Update instructions for bot-assistant based on type. Default updates all LLM pertinent properties.
     * @async
     * @param {string} id - The id of bot to update
     * @param {boolean} migrateThread - Whether to migrate the thread to the new bot, defaults to `true`
     * @returns {object} - The updated bot object
     */
    async updateBotInstructions(bot_id=this.activeBot.id){
        const Bot = await this.#botAgent.updateBotInstructions(bot_id)
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
    /**
     * Get the personal avatar bot.
     * @getter
     * @returns {object} - The personal avatar bot
     */
    get avatar(){
        return this.#botAgent.avatar
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
     * Returns Member Avatar's Bot instances.
     * @getter
     * @returns {Bot[]} - Array of Bot instances
     */
    get bots(){
        return this.#botAgent.bots
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
    /**
     * Globals shortcut.
     * @getter
     * @returns {object} - The globals.
     */
    get globals(){
        return this.#factory.globals
    }
    /**
     * Get the help bots, primarily MyLife avatar, though presume there are a number of custom self-help bots that would be capable of referencing preferences, internal searches, etc.
     * @getter
     * @returns {array} - The help bots.
     */
    get helpBots(){
        const bots = this.getBots()
            .filter(bot=>bot.type==='help')
        return bots
    }
    /**
     * Test whether avatar session is creating an account.
     * @getter
     * @returns {boolean} - Avatar is in `accountCreation` mode (true) or not (false).
     */
    get isCreatingAccount(){
        return this.#factory.isCreatingAccount
    }
    /**
     * Test whether avatar is in an `experience`.
     * @getter
     * @returns {boolean} - Avatar is in `experience` (true) or not (false).
     */
    get isInExperience(){
        return this.mode==='experience'
    }
    /**
     * Whether or not the avatar is the MyLife avatar.
     * @getter
     * @returns {boolean} - true if the avatar is the MyLife avatar. 
     */
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
    /**
     * Get the member id.
     * @getter
     * @returns {string} - The member's id.
     */
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
    /**
     * Gets first name of member from `#factory`.
     * @getter
     * @returns {guid} - The member's core guid.
     */
    get memberFirstName(){
        return this.#factory.memberFirstName
    }
    /**
     * Gets full name of member from `#factory`.
     * @getter
     * @returns {guid} - The member's core guid.
     */
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
                        enum: ['history', 'mission', 'vision', 'values', 'governance', 'members'],
                        name: 'infoType',
                        required: true,
                    }
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
        ],
        serverInfo: {
            name: 'MyLife MCP System Avatar',
            version: '1.0',
        },
    } /* **Note**: `tools` array is managed as decoration in `get mcp()` */
    #Menu
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
        const response = await this.chatAgentBypass(Conversation)
        return response
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
        const greeting = await this.avatar.greeting(false)
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
    /**
     * OVERLOADED: Q refuses to execute.
     * @public
     * @throws {Error} - MyLife avatar cannot upload files.
     */
    async setActiveBot(){
        throw new Error('MyLife System Avatars cannot be externally set')
    }
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
     * @returns {Promise<Object[]>} - The list of shared memories
     */
    async sharedMemories(limit=10){
        let memories = await this.#factory.sharedMemories(limit)
        memories = memories
            .map(memory=>({
                id: memory.id,
                title: memory.title,
            }))
        return memories
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
	get menu(){
		if(!this.#Menu){
			this.#Menu = new (this.schemas.menu)(this).menu
		}
		return this.#Menu
	}
    get router(){
        if(!this.#Router)
            this.#Router = initRouter(new (this.schemas.menu)(this))
        return this.#Router
    }
	get schemas(){
		return this.#factory.schemas
	}
}
/* module functions */
/**
 * Assigns (directly mutates) private experience variables from avatar.
 * @todo - theoretically, the variables need not come from the same avatar instance... not sure of viability
 * @module
 * @param {object} experienceVariables - Experience variables object from Avatar class definition.
 * @param {Avatar} avatar - Avatar instance.
 * @returns {void} - mutates experienceVariables
 */
function mAssignGenericExperienceVariables(experienceVariables, avatar){
    Object.keys(experienceVariables).forEach(_key=>{
        experienceVariables[_key] = avatar[_key]
    })
    /* handle unique variable instances (jic) */
    const localOverrides = {
        name: avatar.memberName,
        nickname: avatar.memberFirstName
    }
    return {...experienceVariables, ...localOverrides}
}
/**
 * 
 * @param {Globals} globals - Globals object.
 * @param {object} avatar - Avatar object.
 */
function mAvatarDropdown(globals, avatar){
    const { mbr_id: id, mbr_name, } = avatar
    const name = globals.sysName(id) 
    return {
        id,
        name,
    }
}
/**
 * Creates cast and returns associated `cast` object.
 * @todo - move as much functionality for actor into `init()` as makes sense
 * @todo - any trouble retrieving a known actor should be understudied by... Q? or personal-avatar? yes, personal avatar for now
 * @todo - implement `creator` version of actor
 * @todo - include variables for names of roles/actors
 * @module
 * @param {AgentFactory} factory - Agent Factory object
 * @param {array} cast - Array of cast objects
 * @returns {Promise<array>} - Array of ExperienceCastMember instances
 */
async function mCast(factory, cast){
    cast = await Promise.all(cast.map(async castMember=>{
        const actor = new (factory.castMember)(castMember)
        const { type, } = castMember
        switch(type.toLowerCase()){
            case 'actor': // system actor
            case 'system':
                actor.bot = await factory.actorGeneric
                actor.bot_id = actor.bot.id
                break
            case 'mylife': // Q
            case 'q':
                actor.bot = await factory.actorQ
                actor.bot_id = actor.bot.id
                break
            case 'bot': // identified member-specific bot
            case 'member':
            case 'member-bot':
            default:
                actor.bot = await factory.bot() // should be new-member safe, but check
                actor.bot_id = actor.bot.id
                break
        }
        return actor
    }))
    return cast
}
/**
 * Creates frontend system message from message String/Object.
 * @param {Guid} bot_id - The bot id
 * @param {String|Message} message - The message to be pruned
 * @param {messageClassDefinition} messageClassDefinition - The message class definition
 * @returns 
 */
function mCreateSystemMessage(bot_id, message, messageClassDefinition){
    if(!(message instanceof messageClassDefinition)){
        const content = message?.content
            ?? message?.message
            ?? message
        message = new messageClassDefinition({
            being: 'message',
            content,
            role: 'assistant',
            type: 'system'
        })
    }
    message = mPruneMessage(bot_id, message, 'system')
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
    const { being, mbr_id, setupComplete=true, ...avatarProperties } = factory.globals.sanitize(await factory.avatarProperties())
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
 * @returns {Entry|Memory} - The item object
 */
function mItem(item, avatar, llmServices){
    /* validate request */
    let Item
    const {
        assistantType,
        content,
        form,
        id=avatar.newGuid,
        llm_id=avatar?.activeBot?.llm_id,
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
            llm_id,
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
        switch(type){
            case 'entry':
                Item = new Entry(item, avatar, llmServices)
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
async function mMcpCompletion(type, reference, argument, contextArguments, sessionMeta, ctx, factory, avatar){
    const completeLimit=100,
        data = { argument, contextArguments, reference, },
        values = []
    switch(type){
        case 'prompt':
            const promptName = reference
            const { name: completionName, value: completionValue, } = argument
                ?? {}
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
            const { enum: promptArgumentEnum, name: promptArgumentName, required: promptArgumentRequired, type: promptArgumentType='string', } = promptArgument
            if(!promptArgumentName?.length)
                return {
                    error: {
                        code: -32603,
                        message: `Prompt argument "${ completionName }" not found for "${ promptName }" in MCP prompts`,
                        data,
                    }
                }
            switch(promptArgumentType){
                case 'boolean':
                    values.push('true', 'false', 'null')
                    break
                case 'number':
                case 'string':
                default:
                    if(promptArgumentEnum?.length)
                        values.push(...promptArgumentEnum) // use enum values if available
                    else {
                        const cleanPromptName = promptName
                            .replace(/^mcp_/, '')
                            .replace(/^mylife_/, '')
                        const functionName = ( cleanPromptName?.split('_')?.length ?? [] ) > 1
                            ? factory.globals.jsFunctionName(cleanPromptName)
                            : cleanPromptName
                        const { args=[], fx, fxCallback, } = mMcpMap[functionName]
                            ?? {}
                        if(!fx)
                            return {
                                error: {
                                    code: -32602,
                                    message: `Function "${ functionName }" not found in MCP map`,
                                    data,
                                }
                            }
                        const activeArgs = args.map(arg=>{
                            // @todo - mcp inspector **not** correctly passing contextArguments; from spec: "For prompts or URI templates with multiple arguments, clients should include **previous completions** in the context.arguments object to provide context for subsequent requests." [emphasis mine]
                            return arg===promptArgumentName
                                ? completionValue
                                : ( contextArguments?.[arg] ?? null ) /* multiple-context level */
                        })
                        let completeValues = []
                        if(typeof fx === 'string')
                            completeValues.push(...await avatar[fx](...activeArgs))
                        else if(typeof fx === 'function')
                            completeValues.push(...await fx(...activeArgs))
                        if(fxCallback)
                            completeValues = await fxCallback(completeValues)
                        values.push(...completeValues)
                    }
                    break
            }
            break
        case 'resource': /* resource need not support arguments, embed in uri */
            const uri = reference
            const { values: resourceValues=[], } = sessionMeta?.completions?.get(uri)
            values.push(...resourceValues)
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
    const jsFunctionName = mJsFunctionName(functionName)
    const { fx, args=[], fxCallback, } = ( mMcpMap[jsFunctionName] ?? {} )
    const fxArgs = args.map(arg=>{
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
                return mcpData[arg]
        }
    })
    const avatarFunction = typeof fx === 'string'
        ? avatar[fx]
        : fx // fx is already a function
    if(typeof avatarFunction === 'function'){
        const functionResponse = await avatarFunction.bind(avatar)(...fxArgs)
        return typeof fxCallback === 'function'
            ? fxCallback(functionResponse)
            : functionResponse
    } else
        return {
            result: {
                content: [{ text: `Function "${ functionName }" not available`, type: 'text' }],
                isError: true
            },
            success: false,
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
async function mcp_chat(mcpdata, sessionMeta, ctx, factory, avatar){
    const { message, } = mcpdata
    const Conversation = await avatar.chat(message, message, true, avatar.avatar)
    const content = Conversation?.responses?.length
        ? Conversation.responses.map(response=>({ text: response.message, type: 'text', }))
        : Conversation.getMessages().map(message=>({ text: message.content, type: 'text', }))
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
        const { bot_id, responses, success, } = await avatar.setActiveBot(id, false)
        if(!success || bot_id!==id)
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
 * @param {Guid} bot_id - The Active Bot id property
 * @param {Object[]} messageArray - The array of messages to prune
 * @param {string} type - The type of message, defaults to chat
 * @param {number} processStartTime - The time the process started, defaults to function call
 * @returns {Object[]} - Concatenated message object
 */
function mPruneMessages(bot_id, messageArray, type='chat', processStartTime=Date.now()){
    messageArray = messageArray
        .map(message=>mPruneMessage(bot_id, message, type, processStartTime))
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
    Avatar.livingMemory = await BotAgent.liveMemory(item, memberInput, Avatar)
    let response
    if(!Avatar.actionCallback?.length){
        const { Conversation, item: livingMemoryItem, } = Avatar.livingMemory
        const { bot_id, type, } = Conversation
        const endpoint = `/members/memory/end/${ livingMemoryItem.id }`
        const defaultInstruction = {
            command: 'createInput',
            inputs: [{
                endpoint,
                id: Avatar.newGuid,
                interfaceLocation: 'chat', // enum: ['avatar', 'team', 'chat', 'bot', 'experience', 'system', 'admin'], defaults to chat
                method: 'PATCH',
                prompt: `I'd like to stop reliving this memory.`,
                required: true,
                type: 'button',
            }],
        }
        const instruction = Avatar.frontendInstruction?.command?.length
            ? Avatar.frontendInstruction
            : defaultInstruction
        const responses = Conversation.getMessages()
            .map(message=>mPruneMessage(bot_id, message, type))
        response = {
            instruction,
            item: mPruneItem(item),
            responses,
            success: true,
        }
    } else
        response = await Avatar.endMemory()
    delete Avatar.actionCallback
    delete Avatar.backupResponse
    delete Avatar.frontendInstruction
    return response
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
    const { cast=[defaultCastMember], description, developers, events, files, name, pause, public: isPublic, purpose, status, title, typeSpeed, variables, version=1.0, } = script
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
 * Validate provided registration id.
 * @private
 * @param {object} bot_id - The active bot object.
 * @param {AgentFactory} factory - AgentFactory object.
 * @param {Guid} validationId - The registration id.
 * @returns {Promise<Object>} - The validation result: { registrationData, responses, success, }.
 */
async function mValidateRegistration(bot_id, factory, validationId){
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
            message = mCreateSystemMessage(bot_id, successMessage, factory.message)
            registrationData.avatarName = avatarName
                ?? humanName
                ?? 'My AI-Agent'
            registrationData.humanName = humanName
            success = true
        }
    }
    message = message
        ?? mCreateSystemMessage(bot_id, failureMessage, factory.message)
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