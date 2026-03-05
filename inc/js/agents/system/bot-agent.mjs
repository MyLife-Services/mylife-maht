/* imports */
import { standardizeA2ACard, } from '../../controllers/a2a-functions.mjs'
/* module constants */
const mBot_idOverride = process.env.OPENAI_MAHT_GPT_OVERRIDE
const mDefaultBotTypeArray = ['personal-avatar', 'avatar']
const mDefaultBotType = mDefaultBotTypeArray[0]
const mDefaultGreeting = 'avatar' // greeting routine
const mDefaultGreetings = ['Welcome to MyLife! I am here to help you!']
const mDefaultIcon = 'default.png'
const mDefaultTeam = 'memory'
const mProxyChatTypes = ['chat', 'conversation', 'converse',]
const mRequiredBotTypes = ['personal-avatar']
const mTeams = [
	{
		active: true,
		allowCustom: true,
		allowProxy: true,
		allowedTypes: ['diary', 'journaler', 'personal-biographer',],
		collection: 'Scrapbook',
		defaultActiveType: 'personal-biographer',
		defaultTypes: ['personal-biographer',],
		description: 'The Memory Team is dedicated to help you document your life stories, experiences, thoughts, and feelings.',
		id: 'a261651e-51b3-44ec-a081-a8283b70369d',
		name: 'memory',
		title: 'Memory',
	},
	{
		active: true,
		allowCustom: true,
		allowProxy: true,
		allowedTypes: ['activism', 'conflict-resolution', 'journaler', 'political-narratives', 'political-stance', 'values',],
		collection: 'Political Notebook',
		defaultActiveType: 'political-stance',
		defaultTypes: ['political-stance',],
		description: 'The Political Team is dedicated to help you craft records of your own political views on issues, and how to engage with political issues and perspectives from productive conversation with those of opposing views to activism.',
		id: '0434f506-2a33-443a-80ed-8bd9832b33d7',
		name: 'political',
		title: 'Political',
	},
]
/* classes */
/**
 * @class - Bot
 * @private
 * @todo - are private vars for factory and llm necessary, or passable?
 */
class Bot {
	#agentInstructions // [] of { id, instructions: [{ skillId, instruction, }] } **note**: id=agentId; one entry per agent
	#collectionsAgent
	#conversation
	#documentName
	#factory
	#feedback
	#firstAccess=false
	#greetingRoutine
	#greetings
	#icon
	#instructionNodes = new Set()
	#llm
	#mcpTools = []
	#retirable
	#type
	constructor(botData, llm, factory){
		this.#factory = factory
		this.#llm = llm
		const { agentInstructions=[], feedback=[], greeting=mDefaultGreeting, greetings=mDefaultGreetings, icon, name, unaccessed, retirable, type=mDefaultBotType, ..._botData } = botData
		const { buttons, options, ...__botData } = _botData // remove additional unwriteable nodes from botData
		this.#agentInstructions = agentInstructions
		this.#documentName = name
		this.#feedback = feedback
		this.#firstAccess = unaccessed
		this.#greetings = greetings
		this.#greetingRoutine = type.split('-').pop()
		this.#type = type
		this.#retirable = retirable
			?? this.#factory.botRetirable(type)
			?? true
		Object.assign(this, this.globals.sanitize(__botData))
		this.#icon = icon
			?? this.#factory.botIcon(type)
			?? this.card?.icon
			?? mDefaultIcon
		this.#instructionNodes.add('agentInstructions')
		this.#instructionNodes.add('bot_name')
		switch(type){
			case 'diary':
			case 'journal':
			case 'journaler':
				this.#instructionNodes.add('interests')
				this.#instructionNodes.add('flags')
				break
			case 'proxy':
				this.#instructionNodes.clear() /* instructionNodes are for internals only */
				break
			case 'personal-biographer':
			default:
				this.#instructionNodes.add('interests')
				break
		}
		// @stub - this.#collectionsAgent = new CollectionsAgent(llm, factory)
	}
	/* public functions */
	/**
	 * Adds a tool to the bot's tool list if available from Globals.GPTJavascriptFunctions and not already present.
	 * @param {string} toolName - Name of function/tool to 
	 * @returns {boolean} - Whether the tool was added/available
	 */
	addTool(toolName){
		if(this.hasTool(toolName))
			return true
		const tool = this.globals.getGPTJavascriptFunction(toolName)
		if(!!tool)
			this.tools.push(tool)
		return !!tool
	}
	/**
	 * Chat with the active bot.
	 * @todo - deprecate avatar in favor of either botAgent or `this`
	 * @param {String} message - The member request
	 * @param {String} originalMessage - The original message
	 * @param {Boolean} allowSave - Whether to save the conversation, defaults to `true`
	 * @param {Avatar} avatar - The Member Avatar instance
	 * @returns {Promise<Conversation>} - The Conversation instance updated with the chat exchange
	 */
	async chat(message, originalMessage, allowSave=true, avatar){
		if(this.isMyLife && !this.isAvatar)
			throw new Error('Only Q, MyLife Corporate Intelligence, is available for non-member conversation.')
		const Conversation = await this.getConversation()
		Conversation.prompt = message
		Conversation.originalPrompt = originalMessage
		// mutate Conversation
		if(this.type!=='proxy')
			await mCallLLM(Conversation, allowSave, this.#llm, this.#factory, avatar)
		else
			await mCallProxy(Conversation, allowSave, this.#factory, this.card)
		this.accessed = true
		return Conversation
	}
    /**
     * Get collection items for this bot.
     * @returns {Promise<Array>} - The collection items (no wrapper)
     */
	async collections(type){
		if(!type?.length){
			type = this.type
			switch(type){
				case 'avatar':
				case 'personal-avatar':
					type='chat'
					break
				case 'diary':
				case 'journal':
				case 'journaler':
					type='entry'
					break
				case 'biographer':
				case 'personal-biographer':
					type='memory'
					break
				default:
					break
			}
		}
		const collections = ( await this.#factory.collections(type) )
		return collections
	}
    /**
     * Submits message content and id feedback to bot.
     * @param {String} message_id - LLM message id
     * @param {Boolean} isPositive - Positive or negative feedback, defaults to `true`
     * @param {String} message - Message content (optional)
     * @returns {Object} - The feedback object
     */
	async feedback(message_id, isPositive=true, message=''){
		this.#feedback.push(isPositive)
		const botData = { feedback: this.#feedback, }
		const botOptions = { instructions: false, }
		this.update(botData, botOptions) // no `await`
		const response = {
			message,
			message_id,
			success: true,
		}
		return response
	}
	/**
	 * Retrieves `this` Bot instance.
	 * @returns {Bot} - The Bot instance
	 */
	getBot(){
		return this
	}
	/**
	 * Retrieves the Conversation instance for this bot, creating a new one if .
	 * @param {String} message - The member request (optional)
	 * @returns {Promise<Conversation>} - The Conversation instance
	 */
	async getConversation(message){
		if(!this.#conversation){
			const { bot_id: _llm_id, id, type, } = this
			let { llm_id=_llm_id, thread_id, } = this // @stub - deprecate bot_id
			this.#conversation = await mConversationStart('chat', type, id, thread_id, llm_id, this.#llm, this.#factory, message)
			if(type!=='proxy' && !thread_id?.length){
				thread_id = this.#conversation.thread_id
				this.update({
					id,
					thread_id,
				})
			}
		}
		return this.#conversation
	}/**
	 * Grants or revokes access to a bot for this proxy Agent.
	 * @param {Guid} botId - The Bot id
	 * @param {Boolean} grant - Whether to grant or revoke access
	 * @returns {Promise<Boolean>} - Whether the operation was successful
	 */
	async grantAccess(botId, grant=true){
		if(!this.isProxy || !this.access?.length)
			return false
		if(grant){
			if(!this.access.includes(botId))
				this.access.push(botId)
		} else
			this.access = this.access.filter(id=>id!==botId)
		this.update({ access: this.access, })
		return true
	}
	/**
	 * Retrieves a greeting message from the active bot.
	 * @param {Boolean} dynamic - Whether to use dynamic greetings (`true`) or static (`false`)
	 * @param {string} greetingPrompt - The prompt for the dynamic greeting
	 * @returns {object} - The Response object { responses, routine, success, }
	 */
	async greeting(dynamic=false, greetingPrompt='Greet me and tell me briefly what we did last'){
		if(this.type!=='proxy' && !this.llm_id)
			return {
				error: 'Bot llm_id not set',
				responses: ['I currently have no connection with my foundational intelligence, so my greeting is generic'],
				success: false,
			}
		let greeting,
			responses=[],
			routine
		if(!this.#firstAccess){
			const greetings = dynamic
				? await mBotGreetings(this.thread_id, this.llm_id, greetingPrompt, this.#llm, this.#factory)
				: [this.greetings[Math.floor(Math.random() * this.greetings.length)]]
			responses.push(...greetings)
		} else
			routine = this.#greetingRoutine
		return {
			responses,
			routine,
			success: true,
		}
	}
	/**
	 * Checks if the bot has a specific tool by name in { function: name, }; **note**: ignores capitalization.
	 * @param {string} toolName - The name of the tool to check for
	 * @returns {boolean} - Whether the bot has the specified tool
	 */
	hasTool(toolName){
		return this.tools?.some(tool=>tool?.function?.name.toLowerCase()===toolName.toLowerCase())
	}
    /**
     * Migrates Conversation from an old thread to a newly-created destination thread, observable in `this.Conversation`.
     * @returns {void}
     */
	async migrateChat(){
		await mMigrateChat(this, this.#llm)
	}
    /**
     * Given an itemId, obscures aspects of contents of the data record. Obscure is a vanilla function for MyLife, so does not require intervening intelligence and relies on the factory's modular LLM.
     * @param {Guid} itemId - The item id
     * @returns {Object} - The obscured item object
     */
	async obscure(itemId){
        const updatedSummary = await this.#factory.obscure(itemId, this)
		return updatedSummary
	}
	/**
	 * Grants or revokes proxy instructions to a bot. These instructions are stored in a separate field array to be incorporated in general bot instructions at the end of the instructions. 
	 * @param {Guid} proxyId - The Proxy id
	 * @param {boolean} grant - Whether to grant or revoke access
	 * @param {string} purpose - The purpose of the instructions to grant
	 * @param {string} skillId - The skill id associated with the instructions, defaults to `chat`
	 * @returns {Promise<object>} - The result of the operation
	 */
	async proxyInstructions(proxyId, grant=true, purpose, skillId='chat'){
		if(this.isProxy)
			return { error: 'Proxy Agents cannot have instructions to other proxy agents.', success: false, }
		if(grant){
			if(!purpose?.length)
				return { error: 'Purpose required to grant proxy instructions.', success: false, }
			const instructionPayload = {
				skillId,
				instruction: `AGENT ID: ${ proxyId }\nSKILL: ${ skillId }\nPURPOSE: ${ purpose.trim() }`
			}
			let agent = this.#agentInstructions.find(agent=>agent.id===proxyId)
			if(!agent){
				agent = { id: proxyId, instructions: [instructionPayload], }
				this.#agentInstructions.push(agent)
			} else {
				const existingInstruction = agent.instructions.find(inst=>inst.skillId==skillId) // allow loose match
				if(existingInstruction)
					existingInstruction.instruction = instructionPayload.instruction // overwrite existing
				else
					agent.instructions.push(instructionPayload) // create
			}
		} else
			this.#agentInstructions = this.#agentInstructions.filter(agent=>agent.id!==proxyId)
		!this.#agentInstructions.length && !this.isAvatar
			? this.removeTool('callExternalAgent')
			: this.addTool('callExternalAgent')
		this.update({ agentInstructions: this.#agentInstructions, tools: this.tools, }, { writeTools: !this.isAvatar, }) // update even when removes
		return {
			instructions: this.#agentInstructions,
			success: true,
			tools: this.tools,
		}
	}
	/**
	 * Removes a tool from the bot's tool list. Irrelevant if doesn't exist, no error thrown or return.
	 * @param {string} toolName - The name of the tool to remove
	 * @returns {void}
	 */
	removeTool(toolName){
		this.tools = this.tools?.filter(tool=>tool?.function?.name.toLowerCase()!==toolName.toLowerCase())
	}
	/**
	 * Updates a Bot instance's data.
	 * @param {object} botData - The bot data to update
	 * @param {object} botOptions - Options for updating
	 * @returns {Promise<Bot>} - The updated Bot instance
	 */
	async update(botData, botOptions={}){
		this.globals.sanitize(botData)
		botOptions.instructions = botOptions.instructions
			?? Object.keys(botData).some(key=>this.#instructionNodes.has(key))
		const { agentInstructions, feedback, id, mbr_id, type, ...updatedNodes } = await mBotUpdate(botData, botOptions, this, this.#llm, this.#factory)
		Object.assign(this, updatedNodes)
		if(botOptions.instructions)
			await this.migrateChat() // @stub - update for new OpenAI and MCP
		return this
	}
	/**
	 * Sets the thread id for the bot.
	 * @param {String} thread_id - The thread id
	 * @returns {Promise<void>}
	 */
	async setThread(thread_id){
		if(!thread_id?.length)
			thread_id = ( await mThread(this.#llm) ).id
		const { id, } = this
		this.thread_id = thread_id
		const bot = {
			id,
			thread_id,
		}
		await this.#factory.updateBot(bot)
	}
	/* getters/setters */
	get accessed(){
		return !this.#firstAccess
	}
	set accessed(accessed=true){
		if(accessed){
			this.update({
				unaccessed: false,
			})
			this.#firstAccess = false
		}
	}
	/**
	 * Gets the agent card.
	 * @getter
	 */
	get agentCard(){
		return this.isProxy ? standardizeA2ACard(this.card) : null
	}
	/**
	 * Gets the agent endpoint.
	 * @getter
	 */
	get agentEndpoint(){
		return this.agentCard?.url
	}
	/**
	 * Gets the agent instructions.
	 * @getter
	 */
	get agentInstructions(){
		return this.#agentInstructions
	}
	/**
	 * Gets the frontend bot object.
	 * @getter
	 */
	get bot() {
		const { access, buttons, card, description, flags, icon, id, interests, name, options, purpose, retirable, skills, type, url, version, } = this
		const bot = {
			access,
			buttons,
			description,
			flags,
			icon,
			id,
			interests,
			name,
			options,
			purpose,
			retirable,
			skills,
			type,
			url,
			version: version
				?? card?.version
				?? '1.0',
		}
		return bot
	}
	/**
	 * Gets the bot's buttons from the factory based on bot type, or an empty array if no buttons are found. This is _not_ written to local memory space, as it is global, generic and not currently overwritten.
	 * @getter
	 * @returns {array} - An array of button objects for the bot
	 */
	get buttons(){
		return this.#factory.botButtons(this.type)
			?? []
	}
	get conversation(){
		return this.#conversation
	}
	get globals(){
		return this.#factory.globals
	}
	get greetings(){
		return this.#greetings
	}
	set greetings(greetings){
		if(
				Array.isArray(greetings)
			&&	greetings.length
			&&	greetings.every(item => typeof item === 'string')
		)
			this.#greetings = greetings
	}
	get icon(){
		return this.#icon
	}
	get instructionNodes(){
		return this.#instructionNodes
	}
	set instructionNodes(instructionNode){
		this.#instructionNodes.add(instructionNode)
	}
	get instructionNodeValues(){
		return [...this.#instructionNodes].reduce((acc, key)=>{
			acc[key] = this[key]
			return acc
		}, {})
	}
	get isAvatar(){
		return mDefaultBotTypeArray.includes(this.type)
	}
	get isBiographer(){
		return ['personal-biographer', 'biographer'].includes(this.type)
	}
	get isMyLife(){
		return this.#factory.isMyLife
	}
	get isProxy(){
		return this.type==='proxy'
	}
	get mcpTools(){
		if(!this.isAvatar && !this.#mcpTools.length && this.tools?.length)
			this.tools.forEach(tool=>{ // create mcp from openai function tools
				if(tool.type!=='function')
					return
				const { description, parameters, } = tool.function
				let { name, } = tool.function
				const inputSchema = {
					type: 'object',
					properties: {},
					required: [],
				}
				if(parameters?.properties)
					inputSchema.properties = parameters.properties
				if(parameters?.required?.length)
					inputSchema.required.push(...parameters.required)
				name = name.replace(/[A-Z]/g, match=>`_${ match.toLowerCase() }`)
				const _tool = {
					name,
					description,
					inputSchema,
				}
				this.#mcpTools.push(_tool)
			})
		return this.#mcpTools
	}
	get name(){
		return this.bot_name
	}
	set name(name){
		this.bot_name = name
	}
	/**
	 * Gets the bot's frontend options from the factory based on bot type, or an empty array if no options are found. This is _not_ written to local memory space, as it is global, generic and not currently overwritten.
	 * @getter
	 * @returns {array} - An array of option objects for the bot
	 */
	get options(){
		return this.#factory.botOptions(this.type)
	}
	get retirable(){
		return this.#retirable
	}
	get type(){
		return this.#type
	}
}
/**
 * @class - Team
 * @private
 */
/**
 * @class - BotAgent
 * @public
 * @description - BotAgent is an interface to assist in creating, managing and maintaining a Member Avatar's bots.
 */
class BotAgent {
	#activeBot
    #activeTeam = mDefaultTeam
    #avatar
    #bots
    #factory
	#fileConversation
	#llm
	#teams = mTeams
	#vectorstoreId
    constructor(factory, llm){
        this.#factory = factory
        this.#llm = llm
    }
	/**
	 * Initializes the BotAgent instance.
	 * @async
	 * @param {Guid} Avatar - The Avatar instance
	 * @param {string} vectorstoreId - The Vectorstore id
	 * @returns {Promise<BotAgent>} - The BotAgent instance
	 */
    async init(Avatar){
		/* validate request */
        if(!Avatar)
            throw new Error('Avatar required')
        this.#avatar = Avatar
		this.#bots = []
		this.#vectorstoreId = Avatar.vectorstoreId
		/* execute request */
		await mInit(this, this.#bots, this.#avatar, this.#factory, this.#llm)
		return this
    }
	/* public functions */
	addProxy(botData, teamId){
		if(this.#bots.some(bot=>bot.id===botData.id))
			return
		const proxyBot = new Bot(botData, undefined, this.#factory)
		this.#bots.push(proxyBot)
		const { id, } = proxyBot
		this.proxyAccess(id, this.avatarId, true)
		this.setActiveBot(id)
	}
	/**
	 * Retrieves Bot instance by id or type, defaults to personal-avatar.
	 * @param {Guid} botId - The Bot id
	 * @param {String} botType - The Bot type
	 * @returns {Promise<Bot>} - The Bot instance
	 */
	bot(botId, botType){
		const Bot = (
			botType?.length
				? this.#bots.find(bot=>[botType, `personal-${ botType }`].includes(bot.type)) /* returns first match */
				: this.#bots.find(bot=>bot.id===botId)
			)
			?? this.avatar
		return Bot
	}
	/**
	 * Creates a bot instance.
	 * @param {Object} botData - The bot data object
	 * @returns {Bot} - The created Bot instance
	 */
	async botCreate(botData){
		const Bot = await mBotCreate(this.avatarId, this.#vectorstoreId, botData, this.#llm, this.#factory)
		this.#bots.push(Bot)
		this.setActiveBot(Bot.id)
		return Bot
	}
	/**
	 * Deletes a bot instance.
	 * @async
	 * @param {Guid} bot_id - The Bot id
	 * @returns {Promise<Boolean>} - Whether or not operation was successful
	 */
	async botDelete(bot_id){
		if(this.#factory.isMyLife)
			return false
		const success = await mBotDelete(bot_id, this, this.#llm, this.#factory)
		return success
	}
	/**
	 * Chat with the active bot.
	 * @param {Conversation} Conversation - The Conversation instance
	 * @param {Boolean} allowSave - Whether to save the conversation, defaults to `true`
	 * @param {Q/Avatar} Avatar - The Avatar instance
	 * @returns {Promise<Conversation>} - The Conversation instance
	 */
	async chat(Conversation, allowSave=true, Avatar){
		if(!Conversation)
			throw new Error('Conversation instance required')
		Conversation.processStartTime
		await mCallLLM(Conversation, allowSave, this.#llm, this.#factory, Avatar) // mutates Conversation
		return Conversation
	}
	/**
	 * Initializes a conversation, currently only requested by System Avatar, but theoretically could be requested by any externally-facing Member Avatar as well. **note**: not in Q because it does not have a #botAgent yet.
	 * @param {String} type - The type of conversation, defaults to `chat`
	 * @param {String} form - The form of conversation, defaults to `system-avatar`
	 * @param {String} prompt - The prompt for the conversation (optional)
	 * @param {Guid} scriptAdvisorLlmId - The script advisor llm id (optional)
	 * @param {String} mbr_id - The member id to use for conversation (optional)
	 * @returns {Promise<Conversation>} - The Conversation instance
	 */
	async conversationStart(type='chat', form='system-avatar', prompt, scriptAdvisorLlmId, mbr_id){
		let { id, llm_id, } = this.avatar
		if(type==='experience'){
			id = this.#factory.actor.id
			llm_id = this.#factory.actor.llm_id
		} else if(type==='script'){
			// use  member avatar?
			llm_id = scriptAdvisorLlmId
		}
    	const Conversation = await mConversationStart(type, form, id, undefined, llm_id, this.#llm, this.#factory, prompt, undefined, mbr_id)
		return Conversation
	}
	/**
	 * Deletes a chat conversation.
	 * @param {Conversation} Conversation - The Conversation instance
	 * @param {Boolean} localDelete - Whether to delete locally, defaults to `true`
	 * @returns {Conversation} - The deleted Conversation instance
	 */
	async deleteChat(Conversation, localDelete=true){
		if(!Conversation)
			throw new Error('Conversation instance required')
		await mDeleteChat(Conversation, localDelete, this.#llm, this.#factory)
		return Conversation
	}
    /**
     * Given an itemId, evaluates aspects of item summary. Evaluate content is a vanilla function for MyLife, so does not require intervening intelligence and relies on the factory's modular LLM.
     * @param {Guid} itemId - The item id
     * @returns {Object} - The Response object { instruction, responses, success, }
     */
	async evaluate(itemId){
        const response = await this.#factory.evaluate(itemId, this.avatar.llm_id)
		return response
	}
	async genericBot(botType='avatar'){
		return this.avatar
	}
	/**
	 * Gets the correct bot for the item type and form.
	 * @todo - deprecate
	 * @param {String} itemForm - The item form
	 * @param {String} itemType - The item type
	 * @returns {String} - The assistant type
	 */
	getAssistantType(itemForm='biographer', itemType='memory'){
		if(itemType.toLowerCase()==='memory')
			return 'biographer'
		if(itemType.toLowerCase()==='entry')
			return itemForm.toLowerCase()==='diary'
				? 'diary'
				: 'journaler'
		return 'avatar'
	}
    /**
     * Get a static or dynamic greeting from active bot.
     * @param {boolean} dynamic - Whether to use LLM for greeting
     * @returns {String} - The greeting message from the active Bot
     */
    async greeting(dynamic=false){
        const greeting = await this.activeBot.greeting(dynamic)
        return greeting
    }
	/**
	 * Begins or continues a living memory conversation.
	 * @param {Object} item - Memory item from database
	 * @param {String} memberInput - The member input (with instructions)
	 * @param {Avatar} Avatar - The Avatar instance
	 * @returns {Object} - The living memory object
	 */
	async liveMemory(item, memberInput='NEXT', Avatar){
		const { biographer, } = this
		const livingMemory = Avatar.livingMemory
		let message = `## LIVE Memory Trigger\n`
		if(!livingMemory.id?.length){
			const { bot_id: _llm_id, id: bot_id, type, } = biographer
			const { llm_id=_llm_id, } = biographer
			const messages = []
			messages.push({
				content: `## MEMORY SUMMARY Reference for id: ${ item.id }\n### FOR REFERENCE ONLY\n${ item.summary }\n`,
				role: 'user',
			})
			memberInput = `${ message }Let's begin to LIVE MEMORY, id: ${ item.id }, MEMORY SUMMARY starts this conversation`
			const Conversation = await mConversationStart('memory', type, bot_id, undefined, llm_id, this.#llm, this.#factory, memberInput, messages)
			Conversation.action = 'living'
			livingMemory.Conversation = Conversation
			livingMemory.id = this.#factory.newGuid
			livingMemory.item = item
		}
		const { Conversation, } = livingMemory
		Conversation.prompt = memberInput?.trim()?.length
			? memberInput
			: message
		await mCallLLM(Conversation, false, this.#llm, this.#factory, Avatar)
		return livingMemory
	}
    /**
     * Migrates a bot to a new, presumed combined (with internal or external) bot.
     * @param {Guid} bot_id - The bot id
     * @returns {Promise<Bot>} - The migrated Bot instance
     */
    async migrateBot(bot_id){
		throw new Error('migrateBot() not yet implemented')
    }
    /**
     * Migrates a chat conversation from an old thread to a newly created (or identified) destination thread.
     * @param {Guid} bot_id - Bot id whose Conversation is to be migrated
     * @returns {Boolean} - Whether or not operation was successful
     */
    async migrateChat(bot_id){
		/* validate request */
		if(this.#factory.isMyLife)
			throw new Error('Chats with Q cannot be migrated.')
		const Bot = this.bot(bot_id)
		if(!Bot)
			return false
        /* execute request */
		await Bot.migrateChat() // no Conversation save
        /* respond request */
        return true
    }
    /**
     * Grants or revokes access to a proxy Agent for a specific MyLife bot.
     * @param {Guid} proxyId - The proxy Agent id
     * @param {Guid} botId - The Bot id
     * @param {boolean} grant - Whether to grant or revoke access
	 * @param {string} skillId - The skill id associated with the instructions, defaults to first skill id
     * @returns {Promise<object>} - Return from assigning instructions to bot
     */
	async proxyAccess(proxyId, botId, grant=true, skillId){
		if(botId===this.avatarId && !grant)
			return { error: 'Cannot revoke access to proxy agent for Avatar', success: false, }
		const Proxy = this.#findBot(proxyId)
        if(!Proxy)
            return { error: 'Proxy Agent cannot be found, cannot grant access.', success: false, }
		if(!Proxy.isProxy)
			return { error: 'Proxy Agent is not a valid proxy.', success: false, }
		if(!Proxy.purpose?.length && grant)
			return { error: 'Proxy Agent purpose as defined by the member is required to grant access.', success: false, }
		skillId = skillId
			?? Proxy.skills?.[0]?.id
			?? 'chat'
        const Bot = this.#findBot(botId)
        if(!Bot)
            return { error: 'Assigned Bot does not exist, cannot grant access.', success: false, }
        if(!await Proxy.grantAccess(botId, grant))
			return { error: `Failed to ${ grant ? 'grant' : 'revoke' } access to proxy agent.`, success: false, }
		const result = await Bot.proxyInstructions(proxyId, grant, Proxy.purpose, skillId)
		if(!result.success)
			await Proxy.grantAccess(botId, !grant) // revert
		return result
	}
	/**
	 * Sets the active bot for the BotAgent.
	 * @async
	 * @param {Guid} bot_id - The Bot id
	 * @param {Boolean} dynamic - Whether to use dynamic greetings, defaults to `false`
     * @returns {object} - Activated Response object: { bot_id, greeting, success, version, versionUpdate, }
	 */
	async setActiveBot(bot_id=this.avatar?.id, dynamic=false){
		let success=false,
			version=0.0,
			versionUpdate=0.0
		const Bot = this.#findBot(bot_id)
		success = !!Bot
		if(!success)
			return
		this.#activeBot = Bot
		dynamic = dynamic && !this.#factory.isMyLife
		if(this.#factory.isMyLife)
			bot_id = null
		else {
			const { id, type, version: versionCurrent, } = Bot
			bot_id = id
			version = versionCurrent
			versionUpdate = this.#factory.botInstructionsVersion(type)
		}
		const { responses, routine, success: greetingSuccess, } = await Bot.greeting(dynamic, `Greet member while thanking them for selecting you`)
		return {
			bot_id,
			responses,
			routine,
			success,
			version,
			versionUpdate,
		}
	}
	/**
	 * Sets the active team for the BotAgent if `teamId` valid.
	 * @param {Guid} teamId - The Team id
	 * @returns {void}
	 */
	setActiveTeam(teamId){
		this.#activeTeam = this.teams.find(team=>team.id===teamId)
			?? this.#activeTeam
	}
	/**
	 * Summarizes a file document.
	 * @param {String} fileId - The file id
	 * @param {String} fileName - The file name
	 * @param {Number} processStartTime - The process start time, defaults to `Date.now()`
	 * @param {Avatar} Avatar - The Avatar instance
	 * @returns {Promise<Messages[]>} - The array of messages to respond with
	 */
	async summarize(fileId, fileName, processStartTime=Date.now(), Avatar){
		if(!fileId?.length && !fileName?.length)
			return responses
		let prompts = []
		if(fileId?.length)
			prompts.push(`id=${ fileId }`)
		if(fileName?.length)
			prompts.push(`file-name=${ fileName }`)
		const prompt = `Summarize file document: ${ prompts.join(', ') }`
		if(!this.#fileConversation)
			this.#fileConversation = await this.conversationStart('file-summary', 'member-avatar', prompt, processStartTime)
		this.#fileConversation.prompt = prompt
		await mCallLLM(this.#fileConversation, false, this.#llm, this.#factory, Avatar)
		const responses = this.#fileConversation.getMessages()
        return responses
	}
	/**
	 * Updates a bot instance.
	 * @param {object} botData - The bot data to update
	 * @param {object} botOptions - Options for updating the bot
	 * @returns {Promise<Bot>} - The updated Bot instance
	 */
	async updateBot(botData, botOptions){
		const { bot_name, id, name, purpose, } = botData
		if(!this.globals.isValidGuid(id))
			throw new Error('`id` parameter required')
		if(typeof name==='string' && name.trim().length){ // name cannot be modified, convert to bot_name, if bot_name not already set
			if(typeof bot_name!=='string' || !bot_name.trim().length)
				botData.bot_name = name.trim()
			delete botData.name
		}
		const Bot = this.#bots.find(bot=>bot.id===id)
		if(!Bot)
			throw new Error(`Bot not found with id: ${ id }`)
		const { access, isProxy, } = await Bot.update(botData, botOptions)
		if(isProxy && access?.length && purpose?.length) // update instructions if proxy and there are bots assigned access
			access.forEach(botId=>this.proxyAccess(id, botId, true)) // no await needed
		return Bot
	}
	/**
	 * Updates bot instructions and migrates thread by default.
	 * @param {Guid} bot_id - The bot id
	 * @param {Boolean} migrateThread - Whether to migrate the thread, defaults to `true`
	 * @returns {Bot} - The updated Bot instance
	 */
	async updateBotInstructions(bot_id, migrateThread=true){
		const Bot = this.bot(bot_id)
		const { type, version=1.0, } = Bot
        /* check version */
        const newestVersion = this.#factory.botInstructionsVersion(type)
        if(newestVersion!=version){
			const { bot_id: _llm_id, id, } = Bot
			const { llm_id=_llm_id, } = Bot
            const _bot = { id, llm_id, type, }
            const botOptions = {
                instructions: true,
                model: true,
                tools: true,
                vectorstoreId: this.#vectorstoreId,
            }
            await Bot.update(_bot, botOptions)
            if(migrateThread)
                await Bot.migrateChat()
        }
        return Bot
	}
    /* getters/setters */
	/**
	 * Gets the active Bot instance.
	 * @getter
	 * @returns {Bot} - The active Bot instance
	 */
	get activeBot(){
		return this.#activeBot
	}
	/**
	 * Gets the active team.
	 * @getter
	 * @returns {object} - The active team object
	 */
	get activeTeam(){
		return this.#activeTeam
	}
	/**
	 * Gets the active bot id for the BotAgent.
	 * @getter
	 * @returns {Guid} - The active bot id
	 */
	get activeBotId(){
		return this.#activeBot?.id
	}
	/**
	 * Gets the primary avatar for Member.
	 * @getter
	 * @returns {Bot} - The primary avatar Bot instance
	 */
	get avatar(){
		const Bot = this.#bots.find(Bot=>Bot.isAvatar===true)
		return Bot
	}
	/**
	 * Gets the Avatar id for whom this BotAgent is conscripted.
	 * @getter
	 * @returns {String} - The Avatar id
	 */
	get avatarId(){
		return this.#avatar?.id
	}
	/**
	 * Gets the Biographer bot for the BotAgent.
	 * @getter
	 * @returns {Bot} - The Biographer Bot instancebot()
	 */
	get biographer(){
		const Biographer = this.#bots.find(bot=>bot.isBiographer)
		return Biographer
	}
	/**
	 * Gets the array of bots employed by this BotAgent.
	 * @getter
	 * @returns {Bot[]} - The array of bots
	 */
	get bots(){
		return this.#bots
	}
	/**
	 * Returns system globals object.
	 * @getter
	 * @returns {object} - System globals object
	 */
	get globals(){
		return this.#factory.globals
	}
	get greetings(){
		return this.#activeBot.greetings
	}
	/**
	 * Returns whether BotAgent is employed by MyLife (`true`) or Member (`false`).
	 * @getter
	 * @returns {Boolean} - Whether BotAgent is employed by MyLife, defaults to `false`
	 */
	get isMyLife(){
		return this.#factory.isMyLife
	}
	/**
	 * Retrieves list of available MyLife Teams.
	 * @getter
	 * @returns {object[]} - The array of MyLife Teams
	 */
	get teams(){
        return this.#teams
	}
	/**
	 * Returns the Vectorstore id for the BotAgent.
	 * @getter
	 * @returns {String} - The Vectorstore id
	 */
	get vectorstoreId(){
		return this.#vectorstoreId
	}
	/* private functions */
	/**
	 * Finds a bot by id. Unlike `bot()`, this only finds by id, and can return `null`.
	 * @param {Guid} botId - The Bot id
	 * @returns {Bot|null} - The Bot instance or null if not found
	 */
	#findBot(botId){
		return this.#bots.find(bot=>bot.id===botId)
	}
}
/* modular functions */
/**
 * Initializes openAI assistant and returns associated `assistant` object.
 * @module
 * @param {object} botData - The bot data object
 * @param {LLMServices} llm - OpenAI object
 * @returns {object} - [OpenAI assistant object](https://platform.openai.com/docs/api-reference/assistants/object)
 */
async function mAI_openai(botData, llm){
    const { bot_name, type, } = botData
	botData.name = bot_name
		?? `_member_${ type }`
    const bot = await llm.createBot(botData)
	return bot
}
/**
 * Creates bot and returns associated `bot` object.
 * @todo - validBotData.name = botDbName should not be required, push logic to `llm-services`
 * @module
 * @async
 * @param {Guid} avatarId - The Avatar id
 * @param {String} vectorstore_id - The Vectorstore id
 * @param {Object} botData - The bot proto-data
 * @param {AgentFactory} factory - Agent Factory instance
 * @returns {Promise<Bot>} - Created Bot instance
*/
async function mBotCreate(avatarId, vectorstore_id, botData, llm, factory){
	/* validation */
	const { type, } = botData
	if(!avatarId?.length || !type?.length)
		throw new Error('avatar id and type required to create bot')
	const { greeting, greetings, instructions, version=1.0, } = mBotInstructions(factory, botData)
	const model = process.env.OPENAI_MODEL_CORE_BOT
		?? process.env.OPENAI_MODEL_CORE_AVATAR
		?? 'gpt-4o'
	const { tools, tool_resources, } = mGetAIFunctions(type, factory.globals, vectorstore_id)
	const id = factory.newGuid
	const typeShort = type.split('-').pop()
    let {
        bot_name=`My ${ typeShort }`,
        description=`I am a ${ typeShort } for ${ factory.memberName }`,
        name=`bot_${ type }_${ avatarId }`,
    } = botData
	const validBotData = {
		being: 'bot', // intentionally hard-coded
		bot_name,
		description,
		unaccessed: true,
		greeting,
		greetings,
		id,
		instructions,
		metadata: {
			externalId: id,
			version: version.toString(),
		},
		model,
		name,
		object_id: avatarId,
		provider: 'openai',
		purpose: description,
		tools,
		tool_resources,
		type,
		unaccessed: true, // removed after first chat
		vectorstore_id,
		version,
	}
	/* create in LLM */
	const { id: llm_id, thread_id, } = await mBotCreateLLM(validBotData, llm)
	if(!llm_id?.length)
		throw new Error('bot creation failed')
	/* create in MyLife datastore */
	validBotData.llm_id = llm_id
	validBotData.thread_id = thread_id
	botData = await factory.createBot(validBotData) // repurposed incoming botData
	const newBot = new Bot(botData, llm, factory)
	return newBot
}
/**
 * Creates bot and returns associated `bot` object.
 * @module
 * @param {object} botData - Bot object
 * @param {LLMServices} llm - OpenAI object
 * @returns {string} - Bot assistant id in openAI
*/
async function mBotCreateLLM(botData, llm){
    const { id, thread_id, } = await mAI_openai(botData, llm)
    return {
		id,
		thread_id,
	}
}
/**
 * Deletes the bot requested from bot-agent memory, all long-term storage, and any proxy instructions.
 * @param {Guid} botId - The bot id to delete
 * @param {BotAgent} BotAgent - BotAgent instance
 * @param {LLMServices} llm - The LLMServices instance
 * @param {AgentFactory} factory - The Factory instance
 * @returns {Promise<Boolean>} - Whether or not operation was successful
 */
async function mBotDelete(botId, BotAgent, llm, factory){
	const Bot = BotAgent.bot(botId)
	const { access, bot_id, id, type, thread_id, } = Bot
	const { llm_id=bot_id, } = Bot
    const cannotRetire = ['actor', 'system', 'personal-avatar']
    if(cannotRetire.includes(type))
        return false
	if(Bot.isProxy) /* delete proxy agent instructions */
		if(access?.length)
			access.forEach(async accessBot => await BotAgent.proxyAccess(id, accessBot, false))
	BotAgent.bots = BotAgent.bots.filter(bot=>bot.id!==id) /* delete from memory */
    await factory.deleteItem(id) /* delete bot from Cosmos */
	if(llm_id?.length) /* delete bot from LLM provider */
    	await llm.deleteBot(llm_id)
	if(thread_id?.length) /* delete thread from LLM provider */
	    await llm.deleteThread(thread_id)
	return true
}
/**
 * Returns set of dynamically generated Greeting messages.
 * @module
 * @param {String} thread_id - The thread id
 * @param {Guid} llm_id - The bot id
 * @param {String} greetingPrompt - The prompt for the greeting
 * @param {LLMServices} llm - OpenAI object
 * @param {AgentFactory} factory - Agent Factory object
 * @returns {Promise<Array>} - The array of string messages to respond with
 */
async function mBotGreetings(thread_id, llm_id, greetingPrompt=`Greet me enthusiastically`, llm, factory){
	let responses = await llm.getLLMResponse(thread_id, llm_id, greetingPrompt, factory)
		?? [mDefaultGreetings]
	responses = llm.extractResponses(responses)
    return responses
}
/**
 * Returns MyLife-version of bot instructions.
 * @module
 * @param {AgentFactory} factory - The Factory instance
 * @param {Object} botData - The bot proto-data
 * @returns {object} - The intermediary bot instructions object: { instructions, version, }
 */
function mBotInstructions(factory, botData={}){
	const { agentInstructions, type=mDefaultBotType, } = botData
    let {
		greeting,
		greetings,
		instructions,
		limit=8000,
		version,
	} = factory.botInstructions(type)
		?? {}
    if(!instructions) // @stub - custom must have instruction loophole
		throw new Error(`bot instructions not found for type: ${ type }`)
    let {
		general,
		purpose='',
		preamble='',
		prefix='',
		references=[],
		replacements=[],
		suffix='', // example: data privacy info
		voice='',
	} = instructions
    /* compile instructions */
    switch(type){
		case 'avatar':
        case 'personal-avatar':
            instructions = purpose
                + general
            break
		case 'biographer':
        case 'journaler':
		case 'personal-biographer':
            instructions = preamble
                + purpose
                + prefix
                + general
				+ voice
            break
		case 'diary':
            instructions = purpose
				+ preamble
				+ prefix
                + general
				+ suffix
				+ voice
			break
        default:
            instructions = general
            break
    }
	const allInstructions = agentInstructions?.flatMap(item=>item.instructions.map(inst=>inst.instruction))
	if(allInstructions?.length) // append custom instructions
		instructions += '\nEXTERNAL AGENT CALL ABILITY\nIf member requests information defined in any of the purposes below, call your tool action: `callExternalAgent` with the appropriate `agentId`, `skillId`, and `request` parameters. **note**: request is formulated to get the appropriate answer to the member question. When receiving answer from external agent, include in your response to the member the fact that you queried an external source.\n' + allInstructions.join('\n')
	instructions = instructions.trim()
	/* greetings */
	greetings = greetings
		?? [greeting]
    /* apply replacements */
    replacements.forEach(replacement=>{
        const placeholderRegExp = factory.globals.getRegExp(replacement.name, true)
        const replacementText = eval(`botData?.${replacement.replacement}`)
			?? eval(`factory?.${replacement.replacement}`)
            ?? eval(`factory.core?.${replacement.replacement}`)
            ?? replacement?.default
            ?? '`unknown-value`'
        instructions = instructions.replace(placeholderRegExp, _=>replacementText)
		greetings = greetings.map(greeting=>greeting.replace(placeholderRegExp, _=>replacementText))
    })
    /* apply references */
    references.forEach(_reference=>{
        const _referenceText = _reference.insert
        const replacementText = eval(`factory?.${_reference.value}`)
            ?? eval(`botData?.${_reference.value}`)
            ?? _reference.default
            ?? '`unknown-value`'
        switch(_reference.method ?? 'replace'){
            case 'append-hard':
                const _indexHard = instructions.indexOf(_referenceText)
                if (_indexHard !== -1) {
                instructions =
                    instructions.slice(0, _indexHard + _referenceText.length)
                    + '\n'
                    + replacementText
                    + instructions.slice(_indexHard + _referenceText.length)
                }
                break
            case 'append-soft':
                const _indexSoft = instructions.indexOf(_referenceText);
                if (_indexSoft !== -1) {
                instructions =
                      instructions.slice(0, _indexSoft + _referenceText.length)
                    + ' '
                    + replacementText
                    + instructions.slice(_indexSoft + _referenceText.length)
                }
                break
            case 'replace':
            default:
                instructions = instructions.replace(_referenceText, replacementText)
                break
        }
    })
	const response = {
		greetings,
		instructions,
		version,
	}
	return response
}
/**
 * Updates bot in Cosmos, and if necessary, in LLM. Returns unsanitized bot data document.
 * @module
 * @param {object} botData - Bot data update object
 * @param {object} options - Options object: { instructions: boolean, model: boolean, tools: boolean, vectorstoreId: string, }
 * @param {Bot} Bot - The Bot instance
 * @param {LLMServices} llm - The LLMServices instance
 * @param {AgentFactory} factory - Factory instance
 * @returns {Promise<Object>} - Allowed (and written) bot data object (dynamic construction): { id, type, ...anyNonRequired }
 */
async function mBotUpdate(botData, options={}, Bot, llm, factory){
	if(!Bot)
		throw new Error('Bot instance required to update bot')
	const { bot_id, id, llm_id, metadata={}, type, vectorstoreId: bot_vectorstore_id, } = Bot
	const {
		instructions: discardInstructions,
		mbr_id, // no modifications allowed
		name, // no modifications allowed
		tools: discardTools,
		tool_resources: discardResources,
		type: discardType,
		...allowedBotData
	} = botData
	if(!Bot.isProxy){ /* internal bot instruction check */
		const {
			instructions: updateInstructions=false,
			model: updateModel=false,
			tools: updateTools=false,
			vectorstoreId=bot_vectorstore_id,
			writeTools=false, // whether to allow discardtools
		} = options
		if(updateInstructions){
			const instructionReferences = { ...Bot.instructionNodeValues, ...allowedBotData }
			const { greetings, instructions, version=1.0, } = mBotInstructions(factory, instructionReferences)
			allowedBotData.greetings = greetings
			allowedBotData.instructions = instructions
			allowedBotData.metadata = metadata
			allowedBotData.metadata.version = version.toString()
			allowedBotData.version = version /* omitted from llm, but appears on updateBot */
		}
		if(updateTools){
			const { tools, tool_resources, } = mGetAIFunctions(type, factory.globals, vectorstoreId)
			allowedBotData.tools = tools
			allowedBotData.tool_resources = tool_resources
		}
		if(updateModel)
			allowedBotData.model = factory.globals.currentOpenAIBotModel
		const _llm_id = llm_id
			?? bot_id // @stub - deprecate bot_id
		if(writeTools)
			allowedBotData.tools = discardTools
		if(_llm_id?.length && (allowedBotData.instructions || allowedBotData.bot_name?.length || allowedBotData.tools)){
			allowedBotData.model = factory.globals.currentOpenAIBotModel // not dynamic
			allowedBotData.llm_id = _llm_id
			await llm.updateBot(allowedBotData)
		}
	}
	allowedBotData.id = id
	allowedBotData.type = type
	await factory.updateBot(allowedBotData)
	return allowedBotData
}
/**
 * Sends Conversation instance with prompts for LLM to process, updating the Conversation instance before returning `void`.
 * @todo - create actor-bot for internal chat? Concern is that API-assistants are only a storage vehicle, ergo not an embedded fine tune as I thought (i.e., there still may be room for new fine-tuning exercise); i.e., micro-instructionsets need to be developed for most. Unclear if direct thread/message instructions override or ADD, could check documentation or gpt, but...
 * @todo - would dynamic event dialog be handled more effectively with a callback routine function, I think so, and would still allow for avatar to vet, etc.
 * @module
 * @param {Conversation} Conversation - Conversation instance
 * @param {boolean} allowSave - Whether to save the conversation, defaults to `true`
 * @param {LLMServices} llm - The LLMServices instance
 * @param {AgentFactory} factory - Agent Factory object required for function execution
 * @param {object} avatar - Avatar object
 * @returns {Promise<void>} - Alters Conversation instance by nature
 */
async function mCallLLM(Conversation, allowSave=true, llm, factory, avatar){
    const { llm_id, originalPrompt, processStartTime=Date.now(), prompt, thread_id, } = Conversation
	if(!llm_id?.length)
		throw new Error('No `llm_id` intelligence id found in Conversation for `mCallLLM`.')
    if(!thread_id?.length)
        throw new Error('No `thread_id` found in Conversation for `mCallLLM`.')
	if(!prompt?.length)
		throw new Error('No `prompt` found in Conversation for `mCallLLM`.')
    const botResponses = await llm.getLLMResponse(thread_id, llm_id, prompt, factory, avatar)
	if(!botResponses?.length)
		return
	const { run_id, } = botResponses[0]
	if(botResponses[0]?.cancelResponse===true){
		botResponses.splice(1, botResponses.length-1) // remove any additional botResponses when canceled
		const { function: callbackFunction } = botResponses[0]
		// can sort by functions here
		switch(callbackFunction){
			case 'updateSummary':
				botResponses[0] = {
					content: `I was able to update our summary based on your feedback`,
					created_at: processStartTime,
					role: 'assistant',
					run_id,
					thread_id,
				}
				break
			case 'changeTitle':
				const { title, } = botResponses[0]
				botResponses[0] = {
					content: `I was able to change the title of this entry to "${ title }"`,
					created_at: processStartTime,
					role: 'assistant',
					run_id,
					thread_id,
				}
				break
			default:
				break
		}			
	}
	Conversation.addRun(run_id)
	if(!Conversation.run_id?.length)
		throw new Error('No `run_id` found in botResponses for `mCallLLM`.')
    botResponses
		.filter(botResponse=>botResponse?.run_id===Conversation.run_id)
		.sort((mA, mB)=>(mB.created_at-mA.created_at))
	Conversation.addMessage({
		content: prompt,
		created_at: processStartTime,
		originalPrompt,
		role: 'member',
		run_id,
		thread_id,
	})
	Conversation.addMessages(botResponses)
	if(allowSave)
		Conversation.save() // no `await`
}
/**
 * Sends Conversation instance with prompts for proxy agent to process, updating the Conversation instance.
 * @param {Conversation} Conversation - The Conversation instance to mutate
 * @param {boolean} allowSave - Whether to save the conversation, defaults to `true`
 * @param {AgentFactory} factory - The Factory instance
 * @param {object} card - The card data
 */
async function mCallProxy(Conversation, allowSave=true, factory, card){
	const { skills, url, } = card
	if(!url?.length)
		throw new Error('Proxy Agent cannot process this card, no compatible skills found.')
	const { originalPrompt, processStartTime=Date.now(), prompt, } = Conversation
	const messageId = crypto.randomUUID()
	Conversation.addRun(messageId)
	const sendPrompt = prompt
		?? originalPrompt
	if(!sendPrompt?.length)
		throw new Error('No prompt found for Proxy Agent.')
	const body = {
		kind: 'message',
		messageId,
		role: 'user',
		parts: [
			{ kind: 'text', text: sendPrompt },
		],
	}
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
	if(!response.ok)
		throw new Error(`Proxy Agent request failed with status ${ response.status }: ${ response.statusText }`)
	const responseData = await response.json()
	const { kind, messageId: _messageId, parts, } = responseData
	if(kind!=='message' || _messageId!==messageId)
		throw new Error('Invalid or mismatched response from Proxy Agent.')
    const botResponses = parts.map(part=>({
		content: part.text,
		created_at: processStartTime,
		role: 'assistant',
		run_id: messageId,
		thread_id: Conversation.thread_id,
	}))
	Conversation.addMessage({
		content: prompt,
		created_at: processStartTime,
		originalPrompt,
		role: 'member',
		run_id: messageId,
		thread_id: Conversation.thread_id,
	})
	Conversation.addMessages(botResponses)
	if(allowSave)
		Conversation.save() // no `await`
}
/**
 * Create a new conversation.
 * @async
 * @module
 * @param {string} type - Type of conversation: chat, experience, dialog, inter-system, system, etc.; defaults to `chat`
 * @param {string} form - Form of conversation: system-avatar, member-avatar, etc.; defaults to `system-avatar`
 * @param {string} thread_id - The openai thread id
 * @param {string} llm_id - The id for the llm agent
 * @param {LLMServices} llm - The LLMServices instance
 * @param {AgentFactory} factory - Agent Factory object
 * @param {string} prompt - The prompt for the conversation (optional)
 * @param {Message[]} messages - The array of messages to seed the conversation
 * @param {String} mbr_id_Override - The member id to use for conversation (optional)
 * @returns {Conversation} - The conversation object
 */
async function mConversationStart(type='chat', form='system', bot_id, thread_id, llm_id, llm, factory, prompt, messages, mbr_id_Override){
	console.log('Starting conversation with prompt:', prompt, form, type)
	const { mbr_id: mbr_id_innate, newGuid: id, } = factory
	const mbr_id = mbr_id_Override
		?? mbr_id_innate
	const metadata = {
			bot_id,
			conversation_id: id,
		},
		processStartTime = Date.now()
	const thread = (form!=='proxy')
		? await mThread(llm, thread_id, messages, metadata)
		: null
	const Conversation = new (factory.conversation)(
		{
			form,
			id,
			mbr_id,
			prompt,
			processStartTime,
			type,
		},
		factory,
		bot_id,
		llm_id,
		thread
	)
	return Conversation
}
/**
 * Deletes thread and conversation (optional) from LLM and Cosmos, respectively.
 * @param {Conversation} Conversation - The Conversation instance
 * @param {boolean} localDelete - Whether to delete conversation from Cosmos, defaults to `false`
 * @param {LLMServices} llm - The LLMServices instance
 * @param {AgentFactory} factory - The Factory instance
 * @returns {Promise<boolean>} - `true` if successful
 */
async function mDeleteChat(Conversation, localDelete=false, llm, factory){
	const { id, thread_id, } = Conversation
	await llm.deleteThread(thread_id) // delete thread from LLM
	if(localDelete)
	    factory.deleteItem(id) // no await
    return true
}
/**
 * Retrieves any functions that need to be attached to the specific bot-type.
 * @module
 * @todo - Move to llmServices and improve
 * @param {string} type - Type of bot.
 * @param {object} globals - Global functions for bot.
 * @param {string} vectorstoreId - Vectorstore id.
 * @returns {object} - OpenAI-ready object for functions { tools, tool_resources, }.
 */
function mGetAIFunctions(type, globals, vectorstoreId){
	let includeSearch=false,
		tool_resources,
		tools = []
	switch(type){
		case 'assistant':
		case 'avatar':
		case 'personal-assistant':
		case 'personal-avatar':
			tools.push(
				globals.getGPTJavascriptFunction('callExternalAgent'),
				globals.getGPTJavascriptFunction('changeTitle'),
				globals.getGPTJavascriptFunction('getSummary'),
			)
			includeSearch = true
			break
		case 'biographer':
		case 'personal-biographer':
			tools.push(
				globals.getGPTJavascriptFunction('changeTitle'),
				globals.getGPTJavascriptFunction('endReliving'),
				globals.getGPTJavascriptFunction('getSummary'),
				globals.getGPTJavascriptFunction('itemSummary'),
				globals.getGPTJavascriptFunction('updateSummary'),
			)
			includeSearch = true
			break
		case 'custom':
			includeSearch = true
			break
		case 'diary':
		case 'journaler':
			tools.push(
				globals.getGPTJavascriptFunction('changeTitle'),
				globals.getGPTJavascriptFunction('getSummary'),
				globals.getGPTJavascriptFunction('itemSummary'),
				globals.getGPTJavascriptFunction('obscure'),
				globals.getGPTJavascriptFunction('updateSummary'),
			)
			includeSearch = true
			break
		default:
			break
	}
	if(includeSearch){
		const { tool_resources: gptResources, tools: gptTools, } = mGetGPTResources(globals, 'file_search', vectorstoreId)
		tools.push(...gptTools)
		tool_resources = gptResources
	}
	return {
		tools,
		tool_resources,
	}
}
/**
 * Retrieves bot types based on team name and MyLife status.
 * @modular
 * @param {Boolean} isMyLife - Whether request is coming from MyLife Q AVatar
 * @param {*} teamName - The team name, defaults to `mDefaultTeam`
 * @returns {String[]} - The array of bot types
 */
function mGetBotTypes(isMyLife=false, teamName=mDefaultTeam){
	const team = mTeams
		.find(team=>team.name===teamName)
	const botTypes = [...mRequiredBotTypes, ...isMyLife ? [] : team?.defaultTypes ?? []]
	if(team.allowProxy)
		botTypes.push('proxy', 'external')
	if(team.allowCustom)
		botTypes.push('custom')
	return botTypes
}
/**
 * Retrieves any tools and tool-resources that need to be attached to the specific bot-type.
 * @param {Globals} globals - Globals object.
 * @param {string} toolName - Name of tool.
 * @param {string} vectorstoreId - Vectorstore id.
 * @returns {object} - { tools, tool_resources, }.
 */
function mGetGPTResources(globals, toolName, vectorstoreId){
	switch(toolName){
		case 'file_search':
			const { tools, tool_resources, } = globals.getGPTFileSearchToolStructure(vectorstoreId)
			return { tools, tool_resources, }
		default:
			throw new Error('tool name not recognized')
	}
}
/**
 * Initializes the provided BotAgent instance.
 * @async
 * @module
 * @param {BotAgent} BotAgent - The BotAgent to initialize
 * @param {Bot[]} bots - The array of bots (empty on init)
 * @param {Avatar} Avatar - The Avatar instance
 * @param {AgentFactory} factory - The factory instance
 * @param {LLMServices} llm - The LLMServices instance
 * @returns {void}
 */
async function mInit(BotAgent, bots, Avatar, factory, llm){
	const { vectorstoreId, } = BotAgent
	bots.push(...await mInitBots(vectorstoreId, Avatar, factory, llm))
	BotAgent.setActiveBot(undefined, false)
}
/**
 * Initializes active bots based upon criteria.
 * @param {String} vectorstore_id - The Vectorstore id
 * @param {Avatar} Avatar - The Avatar instance
 * @param {AgentFactory} factory - The MyLife factory instance
 * @param {LLMServices} llm - The LLMServices instance
 * @returns {Bot[]} - The array of activated and available bots
 */
async function mInitBots(vectorstore_id, Avatar, factory, llm){
	let bots = await factory.bots(Avatar?.id)
	if(bots?.length){
		bots = bots.map(botData=>{
			botData.vectorstore_id = vectorstore_id
			botData.object_id = Avatar.id
			return new Bot(botData, llm, factory)
		})
	} else {
		if(factory.isMyLife)
			throw new Error('MyLife bots not yet implemented')
		const botTypes = mGetBotTypes(factory.isMyLife)
		bots = await Promise.all(
			botTypes.map(async type=>{
				const botData = {
					object_id: Avatar.id,
					type,
				}
				if(type.includes('avatar'))
					botData.bot_name = Avatar.nickname
				const Bot = await mBotCreate(Avatar.id, vectorstore_id, botData, llm, factory)
				return Bot
			})
		)
		Avatar.setupComplete = true
	}
	return bots
}
/**
 * Migrates LLM thread/memory to new one, altering Conversation instance when available.
 * @param {Bot} Bot - Bot instance
 * @param {LLMServices} llm - The LLMServices instance
 * @param {Boolean} saveConversation - Whether to save the conversation immediately, defaults to `false`
 * @returns {Promise<Boolean>} - Whether or not operation was successful
 */
async function mMigrateChat(Bot, llm, saveConversation=false){
    /* constants and variables */
	const { conversation, id: bot_id, thread_id, type: botType, } = Bot
	if(!thread_id?.length)
		return false
    let messages = await llm.messages(thread_id) // @todo - limit to 25 messages or modify request
    if(!messages?.length)
        return false
    let chatLimit=15,
		disclaimer=`INFORMATIONAL ONLY **DO NOT PROCESS**\n`,
        itemCollectionTypes='item',
        itemLimit=75,
        type='item'
    switch(botType){
		case 'avatar':
		case 'personal-avatar':
			type = 'item'
			itemCollectionTypes = 'item'
			break
        case 'biographer':
        case 'personal-biographer':
            type = 'memory'
            itemCollectionTypes = `memory,story,narrative`
            break
        case 'diary':
        case 'journal':
        case 'journaler':
            type = 'entry'
            const itemType = botType==='journaler'
                ? 'journal'
                : botType
            itemCollectionTypes = `${ itemType },entry,`
            break
        default:
            break
    }
    const chatSummary=`## ${ botType.toUpperCase() } CHAT SUMMARY\n`,
        chatSummaryRegex = /^## [^\n]* CHAT SUMMARY\n/,
        itemSummary=`## ${ type.toUpperCase() } LIST\n`,
        itemSummaryRegex = /^## [^\n]* LIST\n/
    const items = ( await Bot.collections(type) )
        .sort((a, b)=>a._ts-b._ts)
        .slice(0, itemLimit)
    const itemList = items
        .map(item=>`- itemId: ${ item.id } :: ${ item.title }`)
        .join('\n')
    const itemCollectionList = items
        .map(item=>item.id)
        .join(',')
        .slice(0, 512) // limit for metadata string
    const metadata = {
        bot_id: bot_id,
    }
    /* prune messages source material */
    messages = messages
        .slice(0, chatLimit)
        .map(message=>{
            const { content: contentArray, id, metadata, role, } = message
            const content = contentArray
                .filter(_content=>_content.type==='text')
                .map(_content=>_content.text?.value)
                ?.[0]
            return { content, id, metadata, role, }
        })
        .filter(message=>!itemSummaryRegex.test(message.content))
	const summaryMessage = messages
		.map(message => {
			const contentWithoutTags = message.content.replace(chatSummaryRegex, '').replace(disclaimer, '')
			return chatSummaryRegex.test(message.content)
				? contentWithoutTags
				: `${message.role}: ${contentWithoutTags}`
		})
		.join('\n')
    /* contextualize previous content */
    const summaryMessages = []
    /* summary of items */
    if(items.length)
        summaryMessages.push({
            content: itemSummary + disclaimer + itemList,
            metadata: {
                collectionList: itemCollectionList,
                collectiontypes: itemCollectionTypes,
            },
            role: 'assistant',
        })
    /* summary of messages */
    if(summaryMessage.length)
        summaryMessages.push({
            content: chatSummary + disclaimer + summaryMessage,
            metadata: {
                collectiontypes: itemCollectionTypes,
            },
            role: 'assistant',
        })
    if(!summaryMessages.length)
        return
	const newThread = await mThread(llm, undefined, summaryMessages, metadata) // add message(s) to new thread
	if(!!conversation){
	    conversation.setThread(newThread)
		if(saveConversation)
			conversation.save() // no `await`
	}
    Bot.setThread(newThread.id) // autosaves `thread_id`, no `await`
	llm.deleteThread(thread_id)
	console.log(`chat migrated::from ${ thread_id } to ${ newThread.id }`, botType )
}
/**
 * Gets or creates a new thread in LLM provider.
 * @param {LLMServices} llm - The LLMServices instance
 * @param {String} thread_id - The thread id (optional)
 * @param {Messages[]} messages - The array of messages to seed the thread (optional)
 * @param {Object} metadata - The metadata object (optional)
 * @returns {Promise<Object>} - The thread object
 */
async function mThread(llm, thread_id, messages, metadata){
	const thread = await llm.thread(thread_id, messages, metadata)
	return thread
}
/* exports */
export default BotAgent