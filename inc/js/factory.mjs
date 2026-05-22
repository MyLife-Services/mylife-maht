/* imports */
import chalk from 'chalk'
import EventEmitter from 'events'
import nodemailer from 'nodemailer'
import util from 'util'
import vm from 'vm'
import { Avatar, Q, } from './avatar.mjs'
import Dataservices from './dataservices.mjs'
import Globals from './globals.mjs'
import LLMServices from './llm.mjs'
import Menu from './menu.mjs'
import { Conversation, Message } from './models.mjs'
/* module constants */
const {
	MAHT_EMAIL,
	MAHT_EMAIL_PASSWORD,
	MYLIFE_SERVER_MBR_ID: mPartitionId,
} = process.env
const mBotInstructions = {}
const mDefaultBotType = 'personal-avatar'
const mDisallowedCoreKeys = ['avatar_id', 'mbr_id', 'id', 'being'] // keys that cannot be reset in `.core`
const mExcludeProperties = {
	$schema: true,
	$id: true,
	$defs: true,
	$comment: true,
	definitions: true,
	name: true
}
const mGlobals = new Globals()
const mLLMServices = new LLMServices()
const mMailer = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: MAHT_EMAIL,        // e.g., maht@humanremembranceproject.org
        pass: MAHT_EMAIL_PASSWORD,   // App-specific password or OAuth token
    }
})
const mReservedJSCharacters = [' ', '-', '!', '@', '#', '%', '^', '&', '*', '(', ')', '+', '=', '{', '}', '[', ']', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '.', '?', '/', '~', '`']
const mReservedJSWords = ['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'enum', 'await', 'implements', 'package', 'protected', 'interface', 'private', 'public', 'null', 'true', 'false', 'let', 'static']
const vmClassGenerator = vm.createContext({
	exports: {},
	console: console,
	import: async _module => await import(_module),
//	utils: utils,
//	sharedData: sharedData,
//	customModule: customModule,
//	eventEmitter: EventEmitter,
})
/* dependent constants and functions */
// MyLife Datamanager
const mDataservices = await new Dataservices(mPartitionId, mGlobals).init()
// MyLife constructs
const mAlerts = {
	system: await mDataservices.getAlerts(), // not sure if we need other types in global module, but feasibly historical alerts could be stored here, etc.
}
// @todo: capitalize hard-codings as per actual schema classes
const mSchemas = {
	...await mBuildSchemas(),
	dataservices: Dataservices,
	menu: Menu,
}
/* module construction functions */
mConfigureSchemaPrototypes()
await mPopulateBotInstructions() // populates mBotInstructions
/* modular infrastructure bots */
const mGeneralFunctioneer = mBotInstructions['general-functioneer']
/* logging/reporting */
console.log(chalk.bgRedBright('<-----AgentFactory module loaded----->'))
/* module classes */
class BotFactory extends EventEmitter{
	// micro-hydration version of factory for use _by_ the MyLife server
	#dataservices
	#llmServices = mLLMServices
	#mbr_id
	constructor(mbr_id, directHydration=true){
		super()
		this.#mbr_id = mbr_id
		if(mIsMyLife(mbr_id) && directHydration)
			throw new Error('MyLife server cannot be accessed as a BotFactory alone')
		else if(mIsMyLife(this.mbr_id))
			this.#dataservices = mDataservices
	}
	/* public functions */
	/**
	 * Initialization routine required for all bot instances. Note: MyLife cannot be constructed as a botFactory, so should never be called as such.
	 * @param {Guid} _mbr_id 
	 * @returns {AgentFactory} this
	 */
	async init(_mbr_id=this.mbr_id){
		this.#mbr_id = _mbr_id
		this.#dataservices = new Dataservices(this.mbr_id, mGlobals)
		await this.#dataservices.init()
		this.core.avatar_id = this.core.avatar_id
			?? (await this.dataservices.getAvatar())?.id
			?? (await this.getAvatar())?.id
		return this
	}
	/**
	 * Get a bot, either by id (when known) or bot-type (default=mDefaultBotType). If bot id is not found, then it cascades to the first entity of bot-type it finds.
	 * If caller is `MyLife` then bot is found or created and then activated via a micro-hydration.
	 * @todo - determine if spotlight-bot is required for any animation, or a micro-hydrated bot is sufficient.
	 * @public
	 * @param {string} id - The bot id
	 * @param {string} type - The bot type
	 * @param {string} mbr_id - The member id
	 * @param {string} proxyUrl - The external agent card URL (if applicable)
	 * @returns {object} - The bot data
	 */
	async bot(id, type=mDefaultBotType, mbr_id, proxyUrl){
		if(id?.length && !this.globals.isValidGuid(id)){
			const bot = await this.dataservices.bot(id, type)
			if(!!bot && bot?.id?.length)
				return bot
		}
		return await this.dataservices.getItemByField(
			'bot',
			proxyUrl?.length ? 'url' : 'type',
			proxyUrl?.length ? proxyUrl : type,
			undefined,
			mbr_id
		)
	}
	/**
	 * Gets a member's bots, or specific bot types.
	 * @todo - develop bot class and implement hydrated instance
	 * @public
	 * @param {string} avatarId - The Avatarm id
	 * @param {string} botType - The bot type (optional)
	 * @returns {Object[]} - Array of bots
	 */
	async bots(avatarId, botType){
		const _params = avatarId?.length
			? [{ name: '@object_id', value: avatarId }]
			: botType?.length
				? [{ name: '@bot_type', value: botType }]
				: undefined
		const bots = await this.dataservices.getItems(
			'bot',
			undefined,
			_params,
		)
		return bots
	}
	/**
	 * Returns bot buttons for a given bot type, if they exist in the bot instructions.
	 * @public
	 * @param {string} type - The bot type
	 * @return {object[]} - The bot buttons
	 */
	botButtons(type){
		return this.botTemplate(type)?.buttons ?? []
	}
	/**
	 * Returns bot icon URL for a given bot type, if it exists in the bot instructions.
	 * @param {string} type - The bot type
	 * @returns {string} - The bot icon URL
	 */
	botIcon(type){
		return this.botTemplate(type)?.icon
	}
	/**
	 * Returns bot instructions fully personalized.
	 * @public
	 * @param {string} type - The bot type
	 * @returns {string} - The bot instructions
	 */
	botInstructions(type){
		const { instructions, } = this.botTemplate(type) ?? {}
		return mBuildBotInstructions(instructions)
	}
	/**
	 * Returns bot item forms, which are the various content forms that a bot can utilize for output, such as memory, chat, entry, stance, etc. If not specified in the bot instructions, defaults to an empty array.
	 * @param {string} type - The bot type
	 * @returns {Array} - The bot item forms by string
	 */
	botItemForms(type){
		return this.botTemplate(type)?.itemForms ?? []
	}
	/**
	 * Returns bot LLM provider properties, which are the properties of the LLM that the bot utilizes, such as provider, model, and prompt. If not specified in the bot instructions, defaults to an empty object.
	 * @param {string} type - The bot type
	 * @param {string} provider - Chosen LLM provider (optional)
	 * @return {object|null} - The LLM properties (for specific provider): { id, model, provider, type, variables, version, }
	 */
	botLLMProvider(type, provider){
		const { defaultProvider, providers, variables, } = this.botTemplate(type)?.llmProviders ?? {}
		let providerConfig = null
		provider = provider ?? defaultProvider
		providerConfig = providers?.find(p=>p.provider===provider) ?? providers?.[0]
		if(providerConfig && variables)
			providerConfig = { ...providerConfig, variables, }
		return providerConfig
	}
	/**
	 * Returns bot options, which are a distilled version of the bot instructions meant to be more easily parsed by a bot instance and used for decision-making and prompting.
	 * @public
	 * @param {string} type - The bot type
	 * @return {object[]} - The bot options
	 */
	botOptions(type){
		return this.botTemplate(type)?.options ?? []
	}
	/**
	 * Returns bot retirability, which indicates whether the bot can be retired by the member or not. If not specified in the bot instructions, defaults to `true`.
	 * @param {string} type - The bot type
	 * @returns {boolean} - The bot retirability
	 */
	botRetirable(type){
		return this.botTemplate(type)?.retirable ?? false
	}
	/**
	 * Returns bot shadows for a given bot type, if they exist in the bot instructions.
	 * @public
	 * @param {string} type - The bot type
	 * @returns {object[]} - The bot shadows
	 */
	botShadows(type){
		return this.botTemplate(type)?.shadows ?? []
	}
	/**
	 * Returns bot complete build Template.
	 * @public
	 * @param {string} type - The bot type
	 * @returns {object[]} - The bot shadows
	 */
	botTemplate(type=mDefaultBotType){
		return mBotInstructions[type] ?? {}
	}
	/**
	 * Returns bot toolset, either as a direct array or a completed JSON version of tool specifics from JSON-SCHEMA files.
	 * @public
	 * @param {string} type - The bot type
	 * @param {boolean} expanded - Whether to return full tool instructions or not; defaults to `true`
	 * @return {object[]} - The bot tools, either as an array of tool names or an array of tool instruction objects depending on `expanded` parameter
	 */
	botTools(type, expanded=true){
		const toolSet = mBotInstructions[type]?.tools ?? []
		if(!expanded)
			return toolSet
		const tools = toolSet
			.map(toolName=>this.tools[toolName])
			.filter(Boolean)
		return tools
	}
	/**
	 * Returns bot instructions version.
	 * @param {string} type - The bot type.
	 * @returns {number} - The bot instructions version.
	 */
	botVersion(type){
		return this.botTemplate(type)?.version ?? 1.0
	}
	/**
	 * Accesses Dataservices to challenge access to a member's account.
	 * @param {string} passphrase - The passphrase to challenge
	 * @param {boolean} caseInsensitive - Whether requestor suggests to ignore case in passphrase, defaults to `false`
	 * @returns {Promise<boolean>} - `true` if challenge successful
	 */
	async challengeAccess(passphrase, caseInsensitive){
		caseInsensitive = this.core.caseInsensitive
			?? caseInsensitive
		const challengeSuccessful = await mDataservices.challengeAccess(this.mbr_id, passphrase, caseInsensitive)
		return challengeSuccessful
	}
	/**
	 * Uses proxy of Member Avatar to manage alteration for a given share. **Note:** currently leveraging MyLife General Functioneer, but could be migrated to Personal Avatar instructions after testing.
	 * @param {Share} Share - The Share instance
	 * @param {Avatar} avatar - The Avatar instance to use for cleaning the share
	 * @returns {Share} - The cleaned Share instance
	 */
	async cleanShare(Share, Avatar){
		let prompt = '# CLEAN\n## Variables:\n'
		const { anonymous, guessable, itemId, pov=1, restrictions, } = Share
		const { name, names, } = this.core
		const memberName = this.memberName
		const item = await this.item(itemId)
		const { phaseOfLife, summary, } = item
		let response,
			shareData = {
				phaseOfLife,
			}
		if(!anonymous || guessable)
			shareData.variables = { 'memberName': memberName }
		if(anonymous)
			prompt += `- anonymous=true\n- memberName=${ memberName }\n`
		prompt += `- pov=${ pov }\n- summary: ${ summary }`
		response = await this.#llmServices.getLLMResponse(undefined, mGetProvider(mGeneralFunctioneer?.llmProviders), prompt, this, Avatar) // response = { preparedSummary, success, warnings, }
		if(Array.isArray(response))
			response = response[0] // flatten
		shareData = {
			...shareData,
			...response,
		}
		return shareData
	}
    /**
     * Get member collection items.
     * @param {String} type - The type of collection to retrieve, `false`-y = all
     * @returns {Promise<Array>} - The collection items (no wrapper)
     */
	async collections(type){
		return await this.dataservices.collections(type)
	}
	/**
	 * Creates a bot in the database.
	 * @param {object} botData - The bot data
	 * @returns {object} - The created bot document
	 */
	async createBot(botData){
		const bot = await this.#dataservices.createBot(botData)
		return bot
	}
    /**
     * Given an itemId, evaluates aspects of item summary. Evaluate content is a vanilla function for MyLife, so does not require intervening intelligence and relies on the factory's modular LLM.
     * @param {Guid} itemId - The item id
	 * @param {object} llmProvider - The llm properties for the agent: { *id, model, provider, *type, variables, version, }
     * @returns {object} - The Response object { instruction, responses, success, }
     */
	async evaluate(itemId, llmProvider, Avatar){
		const { id, summary, } = await this.item(itemId) ?? {}
		if(!id || !summary?.length){
			Avatar.backupResponses = {
				agent: Avatar.activeBot.type,
				message: `I was unable to evaluate the item: ${ !id ? 'item not found' : 'summary missing' }`,
				type: 'system',
			}
			return {
				instruction: null,
				responses: [Avatar.backupResponses],
				success: false,
			}
		}
		const evaluation = await mEvaluateItem(summary, llmProvider, this, Avatar)
		return evaluation
	}
	/**
	 * Gets array of member `experiences` from database. When placed here, it allows for a bot to be spawned who has access to this information, which would make sense for a mini-avatar whose aim is to report what experiences a member has endured.
	 * @public
	 * @returns {Promise<array>} - Array of shorthand experience objects
	 * @property {string<Guid>} id - The experience id
	 */
	async experiences(includeLived=false){
		// check consents for test-experiences [stub]
		let testExperiences = []
		let experiences = await mDataservices.getItems(
			'experience',
			undefined,
			[{ name: '@status', value: 'active' }],
			'system',
		)
			?? []
		if(!includeLived){
			const livedExperiences = await this.experiencesLived() ?? []
			experiences = experiences.filter( // filter out `lived-experience.id`)
				experience=>!livedExperiences.find(
					livedExperience=>livedExperience.experience_id===experience.id
				)
			)
		}
		return experiences
	}
	/**
	 * Returns array of member `lived-experiences` from database.
	 * @returns {Promise<array>} - Array of lived experience objects.
	 */
	async experiencesLived(){
		const experienceFields = [
			'experience_date',
			'experience_id',
			'title',
			'variables', 
		]
		const livedExperiences = await this.dataservices.getItems(
			'lived-experience',
			experienceFields, // default includes being, id, mbr_id, object_id
		)
		return livedExperiences
	}
	/**
	 * Gets a specified `experience` from database.
	 * @public
	 * @param {guid} xid - The experience id in Cosmos
	 * @returns {Promise<object>} - The experience data object
	 */
	async getExperience(xid){
		if(!xid) 
			throw new Error('factory.experience: experience id required')
		// @todo remove restriction (?) for all experiences to be stored under MyLife `mbr_id`
		return await mDataservices.getItem(xid, 'system')
	}
	/**
	 * Retrieves a share object and its associated item from the database.
	 * @param {Guid} sid - The share id
	 * @param {String} mbr_id - The member id
	 * @returns {object} - The share object from database with Item in-built
	 */
	async getShare(sid, mbr_id=this.mbr_id, type){
		if(!this.globals.isValidGuid(sid))
			return
		const share = await mDataservices.share(sid, type) // pull from system database
		if(!this.isMyLife && share?.mbr_id!==mbr_id)
			throw new Error('Share does not belong to member')
		return share
	}
    /**
     * Gets all owned relevant shares from MyLife `shares` container, either by item or member.
     * @param {Guid} itemId - The item id (optional)
     * @returns {Promise<object[]>} - The MemberShare array
     */
    async getShares(itemId){
		const fields = [{ name: '@mbr_id', value: this.mbr_id, }]
		if(this.globals.isValidGuid(itemId))
			fields.push({ name: '@itemId', value: itemId })
		const shares = await mDataservices.getItemsByFields('share', fields, 'shares', 'item') // **note**: partition key is `shareType`
		return shares
	}
	/**
	 * Retrieves a collection item by Id.
	 * @param {Guid} id - The id of the collection item to retrieve.
	 * @returns {object} - The item.
	 */
	async item(id){
		return await this.dataservices.getItem(id)
	}
	/**
	 * Proxy for modular mHelp() function.
	 * @public
     * @param {string} conversation_id - The conversation id.
 	 * @param {object} llmProvider - The Help Bot's LLM provider
     * @param {string} helpRequest - The help request string.
	 * @param {Avatar} avatar - The avatar instance.
	 * @returns {Promise<Object>} - openai `message` objects.
	 */
	async help(conversation_id, llmProvider, helpRequest, avatar){
		return await mHelp(conversation_id, llmProvider, helpRequest, this, avatar)
	}
    /**
     * Given an itemId, obscures aspects of contents of the data record. Consults modular LLM with isolated request and saves outcome to database.
     * @param {Guid} itemId - Id of the item to obscure
	 * @param {Avatar} Avatar - The avatar instance to use for obscuring
     * @returns {boolean} - Whether obscuring was successful or not
     */
	async obscure(itemId, Avatar){
		const { id, summary, relationships, } = await this.item(itemId)
			?? {}
		if(!id || !summary?.length){
			Avatar.backupResponses = {
				agent: Avatar.activeBot.type,
				message: `I was unable to obscure the item: ${ !id ? 'item not found' : 'summary missing' }`,
				type: 'system',
			}
			return false
		}
		const prompt = `# OBSCURE`
		const provider = { ...mGetProvider(mGeneralFunctioneer?.llmProviders), variables: { id, summary, }, }
		await mLLMServices.getLLMResponse(undefined, provider, prompt, this, Avatar)
		return true
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
        return await this.dataservices.resetPassphrase(passphrase)
    }
	/**
	 * Gets a collection of stories of a certain format.
	 * @param {string} form - The form of the stories to retrieve
	 * @returns {object[]} - The stories
	 */
	async stories(form){
		return await this.dataservices.getItemsByFields(
			'story',
			[{ name: '@form', value: form }],
		)
	}
	/**
	 * Gets list of teams (active only or all).
	 * @param {boolean} active - Whether to return only active teams
	 * @returns {Promise<object[]>} - The teams.
	 */
	async teams(active=true, form){
		const filterArray = []
		if(active)
			filterArray.push({ name: '@active', value: true })
		if(form)
			filterArray.push({ name: '@form', value: form })
		return await mDataservices.getItemsByFields(
			'team',
			filterArray,
			'system'
		)
	}
	/**
	 * Updates bot data in the database.
	 * @param {object} botData - The bot data to update
	 * @returns {Promise<object>} - the bot document from the database
	 */
	async updateBot(botData){
		const bot = await this.#dataservices.updateBot(botData)
		return bot
	}
	/* getters/setters */
	get avatarId(){
		return this.core?.avatar_id
	}
	/**
	 * Returns member's dataservice core. USE WITH CAUTION!
	 * @todo - determine if this can be hidden from public access
	 * @getter
	 * @returns {object} - The Experience class definition.
	 */
	get core(){
		const core = this.globals.sanitize(this.dataservices.core)
		return core
	}
	get dataservices(){
		return this.#dataservices
	}
	get dob(){
		let birthdate = this.core.birth[0].date
		if(birthdate?.length)
			birthdate = new Date(birthdate).toISOString().split('T')[0]
		return birthdate
	}
	/**
	 * Returns experience class definition.
	 */
	get experience(){
		return this.schemas.Experience
	}
	/**
	 * Returns the factory itself.
	 * @todo - deprecate?
	 */
	get factory(){
		return this
	}
	get globals(){
		return mGlobals
	}
	/**
	 * Returns the full tool registry, keyed by tool function name.
	 * @returns {object}
	 */
	get tools(){
		return mGlobals.botTools
	}
	/**
	 * Returns whether or not the factory is the MyLife server, as various functions are not available to the server and some _only_ to the server.
	 * @returns {boolean}
	*/
	get isMyLife(){
		return mIsMyLife(this.mbr_id)
	}
		/**
	 * Returns the ExperieceLived class definition.
	 * @returns {object} - The ExperienceLived class definition.
	 */
	get livedExperience(){
		return this.schemas.ExperienceLived
	}
	get mbr_id(){
		return this.#mbr_id
			?? this.core.mbr_id
	}
	get mbr_id_id(){
		return this.globals.sysId(this.mbr_id)
	}
	get mbr_name(){
		return this.globals.sysName(this.mbr_id)
	}
	get memberFirstName(){
		return this.memberName?.split(' ')?.[0]
			?? ''
	}
	get memberLastName(){
		const nameParts = this.memberName?.split(' ') ?? []
		return nameParts.length>1
			? nameParts[nameParts.length - 1]
			: ''
	}
	get memberName(){
		return this.core.names?.[0]
			?? this.mbr_name
	}
	get newGuid(){
		return mDataservices.newGuid
	}
}
class AgentFactory extends BotFactory {
	#exposedSchemas = mExposedSchemas(['avatar','agent','consent','consent_log','relationship'])	//	run-once 'caching' for schemas exposed to the public, args are array of key-removals; ex: `avatar` is not an open class once extended by server
	#llmServices = mLLMServices
	constructor(mbr_id){
		super(mbr_id, false)
	}
	/* public functions */
	/**
	 * Initialization routine required for all AgentFactory instances save MyLife server.
	 * @param {string} mbr_id - Member id.
	 * @returns {AgentFactory} this
	 */
	async init(mbr_id){
		if(mIsMyLife(mbr_id))
			throw new Error('MyLife server AgentFactory cannot be initialized, as it references module dataservices on constructor().')
		await super.init(mbr_id)
		if(this.core.openaiapikey)
			this.#llmServices = new LLMServices(this.core.openaiapikey, this.core.openaiorgkey)
		return this
	}
	/**
	 * Retrieves all available missions for the member.
	 * @returns {String[]} - An array of the currently available missions by guid id
	 */
	async availableMissions(){
		const missions = await mDataservices.availableMissions()
		return missions
	}
	/**
	 * Retrieves all public experiences (i.e., owned by MyLife).
	 * @returns {Object[]} - An array of the currently available public experiences
	 */
	async availableExperiences(){
		// @todo - add member-owned experiences
		return await mDataservices.availableExperiences()
	}
	/**
	 * Retrieves or creates avatar properties from Member factory dataservices, or inherits the core data from Member class.
	 * @returns {object} - Avatar properties.
	 */
	async avatarProperties(){
		return ( await this.dataservices.getAvatar() )
	}
	async avatarSetupComplete(avatarId){
		await this.dataservices.patch(avatarId, { setupComplete: true })
	}
	/**
	 * Compacts messages by sending them to the LLM with a prompt to return a condensed version that maintains all important information. This is useful for reducing token usage while preserving key details in conversations.
	 * @param {string} messages - string-flattened array of messages to compact
	 * @returns {string} - The compacted message summary
	 */
	async compactMessages(messages){
		const systemInstruction = `I am a summarizer of chat histories. Given a chat message history, I produce a comprehensive summary that preserves all important **member provided facts and other information**, including any GUIDs and associated titles for items. The user in this history is MyLife member ${ this.memberName }, and I am the assistant.`
		const userContent = `## Summarize this history:\n${ messages }`
		const model = mGetProvider(mGeneralFunctioneer?.llmProviders)?.model ?? 'gpt-4.1-nano'
		const { annotations=[], content, } = await mLLMServices.chatCompletion(systemInstruction, userContent, model)
		if(annotations?.length)
			content += `\n## Annotations:\n${ annotations.map(a=>a.url_citation?.title + ': ' + a.url_citation?.url).join('\n') }`
		return content
	}
	/**
	 * Creates a new collection item in the member's container.
	 * @param {object} item - The item to create.
	 * @returns {object} - The created item.
	 */
	async createItem(item){
		const response = await this.dataservices.pushItem(item)
		return response
	}
	/**
	 * Creates a new `Share` in the `share` container.
	 * @param {object} shareData - The share object data
	 * @returns {Promise<object>} - The created share object
	 */
	async createShare(shareData){
		const {
			anonymous=true,
			being='share',
			conclusion,
			guessable=false,
			id=this.newGuid,
			itemId,
			mbr_id=this.mbr_id,
			pov=1,
			scope='public',
			shareType='memory',
			title='untitled memory',
			ttl=2592000, // 30 days
			voice,
		} = shareData
		// @todo - throw exceptions for missing required data
		const name = `share_${ title.substring(0, 64) }_${ id }`
		const item = await this.item(itemId)
		if(!item)
			throw new Error('item not found')
		shareData = {
			anonymous,
			being,
			conclusion,
			guessable,
			id,
			itemId,
			mbr_id,
			name,
			pov,
			scope,
			shareType,
			title,
			ttl,
			voice,
		}
		const share = await mDataservices.pushItem(shareData, 'shares')
		const shares = item.shares ?? []
		shares.push(share.id)
		this.dataservices.patch(itemId, { shares, }) // no await
		return share
	}
    /**
     * Delete an item from member container.
     * @param {Guid} id - The id of the item to delete.
     * @returns {boolean} - `true` if item deleted successfully.
     */
	async deleteItem(id){
		return await this.dataservices.deleteItem(id)
	}
    /**
     * Deletes a share from MyLife `shares` container and associated object (get itemId from `share` itself).
     * @param {Guid} shareId - The Share id
	 * @param {Guid} itemId - The Item id
     * @returns {Promise<Boolean>} - Success or failure of the operation
     */
	async deleteShare(shareId, itemId){
		const { shares=[], } = await this.dataservices.getItem(itemId)
		if(shares.some(share=>share===shareId)){
			const data = { shares: shares.filter(share=>share!==shareId) }
			this.dataservices.patch(itemId, data) // delete share in `shares`; no await
		}
		mDataservices.deleteItem(shareId, 'shares', 'memory') // delete share in `shares`; no await
		return true
	}
	async getAlert(_alert_id){
		const _alert = mAlerts.system.find(alert => alert.id === _alert_id)
		return _alert ? _alert : await mDataservices.getAlert(_alert_id)
	}
	/**
	 * Returns all alerts of a given type, currently only _system_ alerts are available. Refreshes by definition from the database.
	 * @param {string} type 
	 * @returns {array} array of current alerts
	 */
	async getAlerts(type){
		const _systemAlerts = await this.dataservices.getAlerts()
		mAlerts.system = _systemAlerts
		return this.alerts
	}
	/**
	 * Retrieves member's Avatar data and creates singleton instance.
	 * @param {AgentFactory} Factory - The AgentFactory instance; optional, defaults to MyLife
	 * @returns {Avatar} - The Avatar instance.
	 */
	async getAvatar(Factory=this){
		const _Avatar = await ( new Avatar(Factory, this.#llmServices) ) // @todo - make non-generic LLM
			.init()
		return _Avatar
	}
	/**
	 * Generates via personal intelligence, nature of consent/protection around itemId or Bot id. Consent is a special case, does not exist in database, is dynamically generated each time with sole purpose of granting access; id of Consent should be same as id of object being _request_ so lookup will be straight-forward.
	 * @todo - build out consent structure
	 * @param {Guid} id - The id of the item to generate consent for.
	 * @param {Guid} requesting_mbr_id - The id of the member requesting consent.
	 * @returns {object} - The consent object, with parameters or natural language guidelines.
	 */
	async getConsent(id, requesting_mbr_id){
		return new (mSchemas.consent)(consent, this)
	}
	/**
	 * Creates the member instance.
	 * @param {String} mbr_id - The member id
	 * @returns {Promise<Avatar>} - The Member Avatar instance
	 */
	async getMemberAvatar(mbr_id){
		const Factory = await ( new AgentFactory(mbr_id) ).init()
		const Avatar =  await this.getAvatar(Factory)
		return Avatar
	}
	isAvatar(_avatar){	//	when unavailable from general schemas
		return (_avatar instanceof mSchemas.avatar)
	}
	isConsent(_consent){	//	when unavailable from general schemas
		return (_consent instanceof mSchemas.consent)
	}
	/**
	 * Retrieves a mission by id. If not found, it will create a new mission from the template.
	 * @param {Guid} missionId - The mission id
	 * @returns {Promise<object>} - The mission object
	 */
	async mission(missionId){
		let mission = await this.dataservices.getItem(missionId)
		if(!mission){
			mission = await mDataservices.getItem(missionId, 'system')
			console.log('Factory::mission()::template:', missionId)
			if(!mission)
				throw new Error(`Mission template not found: ${ missionId }`)
			mission.completed = false
			mission.completedDate = null
			mission.currentStep = 0
			mission.mbr_id = this.mbr_id
			mission.template = false // remove template flag
			mission = await this.dataservices.pushItem(mission) // push to member container with extra defaults
		}
		return mission
	}
	/**
	 * Retrieves and hydrates all missions for the member.
	 * @returns {Promise<object[]>} - The missions array
	 */
	async missions(){
		const missions = await this.dataservices.getItems('mission')
		return missions
	}
	/**
	 * Saves a completed lived experience to MyLife.
	 * @param {Object} experience - The Lived Experience Object to save.
	 * @returns 
	 */
	async saveExperience(experience){
		/* validate structure */
		if(!experience?.id?.length)
			throw new Error('experience id invalid')
		if(!experience?.location?.completed)
			throw new Error('experience not completed')
		/* clean experience */
		const { cast: _cast, events, id, title, variables, } = experience
		const cast = _cast.map(({ id, role }) => ({ id, role }))
		const _experience = {
			being: 'lived-experience',
			events: events
				.filter(event=>event?.dialog?.dialog?.length || event.character?.characterId?.length)
				.map(event=>{
					const { character: _character, dialog, id, input, } = event
					const character = cast.find(_cast=>_cast.id===_character?.characterId)
					if(_character?.role?.length)
						character.role = _character.role
					return {
						character: character?.role,
						dialog: dialog?.dialog,
						id,
						// input, // currently am not storing memberInput event correctly 
					}
				}),
			experience_date: Date.now(),
			experience_id: experience.id,
			id: this.newGuid,
			mbr_id: this.mbr_id,
			name: (`lived-experience_${ title }_${ id }`).substring(0, 256),
			title,
			variables,
		}
		const savedExperience = await this.dataservices.saveExperience(_experience)
		return savedExperience
	}
	/**
	 * Sets core values in the member's dataservice core. USE WITH CAUTION, as this can overwrite important data if used improperly.
	 * Note: when passed an array of { key, value } objects, it reduces to an object, so both formats are accepted.
	 * Note: All `value` typeof Array will by default completely overwrite underlying array; only specified properties (like `feedback`) add/remove.
	 * @todo - run through consent engine
	 * @param {Array|Object} values - The values to set in the core, either as an array of { key, value } objects or as a single object with key-value pairs.
	 * @returns {Promise<object>} - The updated values in `core`
	 */
	async setCoreValues(values){
		if(Array.isArray(values))
			values = values.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
		for(const key of mDisallowedCoreKeys)
			delete values[key]
		const response = await this.dataservices.patch(this.core.id, values)
		const updatedValues = {}
		for(const key of Object.keys(values)){
			this.dataservices.core[key] = response[key] ?? null
			updatedValues[key] = this.dataservices.core[key]
		}
		return updatedValues
	}
	/**
	 * Tests partition key for member
	 * @public
	 * @param {string} mbr_id member id
	 * @returns {boolean}  - `true` if partition key is active, `false` otherwise.
	 */
	async testPartitionKey(mbr_id){
		if(!this.isMyLife)
			return false
		return await mDataservices.testPartitionKey(mbr_id)
	}
	/**
	 * Updates a collection item.
	 * @param {object} item - The item to update
	 * @returns {Promise<object>} - The updated item
	 */
	async updateItem(item){
		if(!this.globals.isValidGuid(item?.id))
			return
		const response = await this.dataservices.patch(item.id, item)
		return response
	}
	/**
	 * Updates a share in the `shares` container
	 * @param {object} shareData - The share data to update
	 * @returns {Promise<object>} - The updated share object
	 */
	async updateShare(shareData){
		const { anonymous, conclusion, guessable, id, pov, restrictions, scope, title, voice, } = shareData
		const share = await this.getShare(id)
		const data = {
			anonymous,
			conclusion,
			guessable,
			pov,
			restrictions,
			scope,
			title,
			voice,
		}
		Object.keys(data).forEach(key => {
			if(share?.[key]===data[key]) {
				delete data[key]
			}
		})
		const updatedShare = await mDataservices.patch(id, data, 'shares', 'memory')
		return updatedShare
	}
	/* getters/setters */
	get alerts(){ // currently only returns system alerts
		return mAlerts.system
	}
	/**
	 * Returns the ExperienceCastMember class definition.
	 * @returns {object} - ExperienceCastMember class definition.
	 */
	get castMember(){
		return this.schemas.ExperienceCastMember
	}
	get contribution(){
		return this.schemas.Contribution
	}
	get conversation(){
		return Conversation
	}
	/**
	 * Returns the ExperienceEvent class definition.
	 * @returns {object} - ExperienceEvent class definition.
	 */
	get experienceEvent(){
		return this.schemas.ExperienceEvent
	}
	get file(){
		return this.schemas.File
	}
	get message(){
		return Message
	}
	get organization(){
		return this.schemas.Organization
	}
	get schema(){	//	proxy for schemas
		return this.schemas
	}
	get schemaList(){	//	proxy for schemas
		return Object.keys(this.schemas)
	}
	get schemas(){
		return this.#exposedSchemas
	}
	get urlEmbeddingServer(){
		return process.env.MYLIFE_EMBEDDING_SERVER_URL+':'+process.env.MYLIFE_EMBEDDING_SERVER_PORT
	}
}
class MyLifeFactory extends AgentFactory {
	#candidate
	#dataservices = mDataservices
	#llmServices = mLLMServices
	#registrant
	constructor(){
		super(mPartitionId)
	} // no init() for MyLife server
	/* public functions */
	/**
	 * MyLife factory is able to hydrate a BotFactory instance of a Member Avatar.
	 * @public
	 * @param {string} mbr_id - The member id
	 * @returns {object} - The hydrated bot instance
	 */
	async avatarProxy(mbr_id){
		const Bot = await new BotFactory(mbr_id)
			.init()
		return Bot
	}
	/**
	 * OVERLOAD: Retrieves a system-dimensioned bot by id or type
	 * @overload
	 * @param {Guid} id - The bot id to retrieve
	 * @param {string} type - The bot Type
	 * @returns {Promise<object|null>} - The bot data
	 */
	async bot(id, type){
		return await mDataservices.bot(id, type, 'system')
	}
	/**
	 * Retrieves a specific campaign by its advertisement id.
	 * @param {Guid} aid - Advertisement id
	 * @returns {Object} - The campaign document object
	 */
	async campaign(aid){
		const campaign = await mDataservices.campaign(aid)
		return campaign
	}
	async campaignInstanceCreate(Campaign){
		const campaign = await mDataservices.campaignInstanceCreate(Campaign.core)
		return campaign
	}
	async campaignInstanceSave(Campaign){
		const { campaign_id, core, id, } = Campaign
		const obj = await mExtractItemDataDiff(core, this, 'campaigns', campaign_id)
		const campaign = await mDataservices.campaignInstanceSave(obj)
		return id
	}
	/**
	 * Compares registration email against supplied email to confirm `true`. **Note**: does not care if user enters an improper email, it will only fail the encounter, as email structure _is_ confirmed upon initial data write.
	 * @param {string} email - The supplied email to confirm registration.
	 * @param {Guid} registrationId - The registration id.
	 * @returns {boolean} - `true` if registration confirmed.
	 */
	confirmRegistration(email, registrationId){
		if(!this.#candidate)
			return false
		const { email: registrationEmail, id, } = this.#candidate
		const confirmed = id===registrationId
			&& typeof email==='string'
			&& typeof registrationEmail==='string' // humor me, as it error-proofs next condition
			&& registrationEmail.toLowerCase()===email.toLowerCase()
		this.#candidate = confirmed
		return confirmed
	}
	/**
	 * Set MyLife core account basics. { birthdate, passphrase, }
	 * @todo - move to mylife agent factory
	 * @param {string} birthdate - The birthdate of the member.
	 * @param {string} passphrase - The passphrase of the member.
	 * @returns {boolean} - `true` if successful
	 */
	async createAccount(birthdate, passphrase){
		/* get registration data */
		let avatarName,
			memberAccount = {}
		/* create account core */
		try {
			const { avatarName: _avatarName, email, humanName, id, interests, } = this.#candidate
			let { updates='', } = this.#candidate
			if(!id)
				throw new Error('candidate not confirmed, cannot accept request')
			if(!humanName)
				throw new Error('member personal name required to create account')
			const avatarId = this.newGuid
			avatarName = _avatarName
				?? `${ humanName }-AI`
			const badges = []
			birthdate = new Date(birthdate).toISOString()
			if(!birthdate?.length)
				throw new Error('birthdate format could not be parsed')
			const birth = [{ // current 20240523 format
				date: birthdate,
			}]
			const mbr_id = this.globals.createMbr_id(avatarName ?? humanName, id)
			if(await this.testPartitionKey(mbr_id))
				throw new Error('mbr_id already exists')
			const names = [humanName] // currently array of flat strings
			updates = (updates.length ? ' ' : '')
				+ `${ humanName } joined MyLife on ${ new Date().toDateString() }`
			const validations = ['registration',] // list of passed validation routines
			const core = {
				avatarId,
				badges,
				birth,
				email,
				id,
				interests,
				mbr_id,
				names,
				passphrase,
				updates,
				validations,
			}
			memberAccount = await this.dataservices.addCore(core) ?? {}
			this.#candidate = null
		} catch(error) {
			console.log(chalk.blueBright('Factory::createAccount()::account core error'), chalk.bgRed(error))
		}
		/* create avatar */
		if(Object.keys(memberAccount)?.length){
			try{
				const avatarData = await this.dataservices.addAvatar(memberAccount?.core)
				return avatarData
			} catch(error) { 
				console.log(chalk.blueBright('Factory::createAccount()::create Avatar error'), chalk.bgRed(error))
			}
		}
	}
	createItem(){
		throw new Error('MyLife server cannot create items')
	}
	/**
	 * 
	 * @param {string} mbr_id - The member id
	 * @returns {object} - The member's core data
	 */
	async datacore(mbr_id){
		const core = ( await mDataservices.getItems('core', undefined, undefined, undefined, mbr_id) )
			?.[0]
		return core
	}
	deleteItem(){
		throw new Error('MyLife server cannot delete items')
	}
	async extractItemDataDiff(obj){
		return await mExtractItemDataDiff(obj, this)
	}
	/**
	 * Returns Array of hosted members based on validation requirements.
	 * @param {Array} validations - Array of validation strings to filter membership
	 * @returns {Promise<Array>} - Array of string ids, one for each hosted member
	 */
	async hostedMembers(validations){
		return await this.#dataservices.hostedMembers(validations)
	}
	/**
	 * Registers a new MyLife registrant. This represents the intial contact with the MyLife system by a human candidate. The registration process is a three-step process. The first step is to 1) register the candidate; 2) validate the registration; and 3) creating a new Member account from their inputs.
	 * @public
	 * @param {object} candidate { 'avatarName': string, 'email': string, 'humanName': string, }
	 * @returns {object} - The registrant's document from Cosmos
	 */
	async registerCandidate(candidate){
		const { avatarName, email, humanName, type, reason, } = candidate
		const being = 'registration'
		let registration = await this.#dataservices.findRegistrationByEmail(email)
		if(!!registration){
			const patches = {
				avatarName,
				humanName,
				name: `${ avatarName ?? humanName }-${ registration.id }`,
				reason: reason?.length ? reason : registration.reason,
				type: type ?? registration.type ?? 'Newsletter',
			}
			registration = await this.#dataservices.patch(registration.id, patches, 'registration')
			// @todo - re-send email to candidate?
		} else {
			candidate = {
				...candidate,
				being,
				mbr_id: this.mbr_id,
				name: `${ avatarName }-${ email }-${ humanName}`,
				reason,
				type,
			}
			registration = await this.#dataservices.pushItem(candidate, 'registration')
			const { id, } = registration
			await mMailer.sendMail({
				from: `"MyLife Corporate Intelligence, Q" <${ process.env.MAHT_EMAIL }>`,
				to: email,
				subject: '✅ Welcome to MyLife! Validate your email, please',
				html: `<p>Hello ${ humanName },</p>
					<p>Thank you for registering for MyLife, the nonprofit humanist member organization dedicated to helping you tell your personal narratives for posterity. To confirm your registration, please visit:</p>
					<p><a href="https://humanremembranceproject.org/?vld=${ id }">Click here to validate your email</a></p>`
			})
			.then(info=>{
				console.log(chalk.green(`📧 Test email sent to ${ email }! Message ID:`), info.messageId)
			})
			.catch(error=>{
				console.error(chalk.red('❌ Failed to send test email:'), error)
			})
		}
		this.#registrant = registration
		return this.#registrant
	}
    /**
     * Get a list of publicly shared memories.
     * @param {Number} limit - The max number of memories to return
     * @param {Object} filterArgs - Optional filter arguments for shared memories
     * @returns {Promise<Object[]>} - The list of shared memories
     */
    async sharedMemories(limit=10, filterArgs={}, shuffle=true){
		limit = limit <= 0 /* test limits */
			? 1
			: (limit>1000)
				? 1000
				: limit
		const fields = [{ name: '@scope', value: 'public', }]
		const { anonymous, guessable, id, title, } = filterArgs
		if(typeof guessable === 'boolean')
			fields.push({ name: '@guessable', value: guessable, })
		if(typeof anonymous === 'boolean')
			fields.push({ name: '@anonymous', value: anonymous, })
		if(id?.length)
			fields.push({ name: '@id', type: 'contains', value: id, })
		if(title?.length)
			fields.push({ name: '@title', type: 'contains', value: title, })
		const memories = await this.dataservices.getItemsByFields(
			'share',
			fields,
			'shares',
			'memory',
		)
		const shuffled = shuffle ? [...memories].sort(() => 0.5 - Math.random()) : memories
		const response = shuffled.slice(0, limit)
		return response
	}
	async sharedMemory(sid){
		const memory = sid?.length
			? await this.dataservices.getItem(sid, 'shares', 'memory')
			: (await this.sharedMemories(1))?.[0]
		return memory
	}
    /**
     * Search for shared memories based on keyword, phase of life, and/or title.
	 * @todo - implement keyword, phaseOfLife, and title dynamic search
	 * @param {boolean} anonymous - Whether to search for anonymous memories
	 * @param {boolean} guessable - Whether to search for guessable memories
     * @param {string} keyword - The keyword to search for in shared memories
     * @param {string} phaseOfLife - The phase of life to filter memories by
     * @param {string} title - The title to filter memories by
     * @returns {Promise<Object[]>} - The list of matching shared memories
     */
    async sharedMemorySearch(anonymous, guessable, keyword, phaseOfLife, title){
		const being='share',
			fields = [{ name: '@scope', value: 'public', }]
		if(typeof anonymous === 'boolean')
			fields.push({ name: '@anonymous', value: anonymous, })
		if(typeof guessable === 'boolean')
			fields.push({ name: '@guessable', value: guessable, })
		/* not yet implemented on `write` (i.e., not in db record yet, could filter on current results)
		if(keyword?.length)
			fields.push({ name: '@summary', value: keyword, })
		if(phaseOfLife?.length)
			fields.push({ name: '@phaseOfLife', value: phaseOfLife, })
		*/
		if(title?.length)
			fields.push({ name: '@title', type: 'contains', value: title, })
        const memories = await mDataservices.getItemsByFields(being, fields, 'shares', 'memory') // shareType is key column
        return memories
    }
	updateItem(){
		console.log(chalk.blueBright('MyLifeFactory::updateItem()::error'), chalk.bgRed('updateItem Request, but MyLife server cannot update items'))
	}
    /**
     * Validate registration id.
     * @param {Guid} registrationId - The registration id
     * @returns {Promise<object>} - Registration data from system datacore
     */
	async validateRegistration(registrationId){
		if(!registrationId?.length)
			throw new Error('registration id required')
		let registration,
			success = false
		try{
			registration = await this.dataservices.validateRegistration(registrationId)
			if(!!registration){
				success = true
				this.#candidate = registration
				this.#registrant = null
				setTimeout(timeout=>{ // Set a timeout to clear the data after 5 minutes (300000 milliseconds)
					this.#candidate = null
				}, 5 * 60 * 1000)
			}
		} catch(error){
			this.#candidate = null
			this.#registrant = null
			console.log(chalk.blueBright(`validateRegistration(${ registrationId })::error`), error.message)
		}
		return this.#candidate
	}
	/* getters/setters */
    /**
     * Test whether avatar is creating an account.
     * @getter
     * @returns {boolean} - Avatar is in `accountCreation` mode (true) or not (false).
     */
    get isCreatingAccount(){
        return this.#candidate?.mbr_id?.length
    }
	get isRegistered(){
		return this.#registrant?.id?.length
	}
    /**
     * Test whether factory is currently `validating` a session.
     * @getter
     * @returns {boolean} - Avatar is in `registering` mode (true) or not (false).
     */
    get isValidated(){
		return this.#candidate?.id?.length
    }
	get candidate(){
		return this.#candidate
	}
	get candidateId(){
		return this.#candidate?.id
	}
}
// private module functions
function assignClassPropertyValues(propertyDefinition){
	switch (true) {
		case propertyDefinition?.const!==undefined:	//	constants
			return `'${propertyDefinition.const}'`
		case propertyDefinition?.default!==undefined:	//	defaults: bypass logic
			if(Array.isArray(propertyDefinition.default)){
				return '[]'
			}
			return `'${ propertyDefinition.default }'`
		default:
			//	presumption: propertyDefinition.type is not array [though can be]
			switch (propertyDefinition?.type) {
				case 'array':
					return '[]'
				case 'boolean':
					return false
				case 'integer':
				case 'number':
					return 0
				case 'string':
					switch (propertyDefinition?.format) {
						case 'date':
						case 'date-time':
							return `'${ new Date().toDateString() }'`
						case 'uuid':
							return `'${ mDataservices.newGuid }'`
						case 'email':
						case 'uri':
						default:
							return null
					}
				case undefined:
				default:
					return null
			}
	}
}
/**
 * Builds bot instructions from a template or general instructions. If a build template is provided, it will concatenate the specified sections of the instructions. If no build template is provided, it will use the general instructions.
 * @param {object} instructions - The instructions object containing buildTemplate and general instructions
 * @returns {string} - The concatenated instructions string
 */
function mBuildBotInstructions(instructions){
	const { buildTemplate=['general'], } = instructions
	instructions = buildTemplate
		.map(section=>instructions[section])
		.filter(Boolean)
		.join('')
		.trim()
	return instructions
}
function mBytes(_object){
	return util.inspect(_object).length
}
function mCompileClass(_className, _classCode){
	vm.runInContext(_classCode, vmClassGenerator) // Create a global vm context and run the class code in it
	const _class = vmClassGenerator.exports[_className] // Return the compiled class
	return _class // Return the compiled class
}
async function mConfigureSchemaPrototypes(){ //	add required functionality as decorated extension class
	for(const _className in mSchemas){ // global injections; maintained _outside_ of eval class
		Object.assign(
			mSchemas[_className].prototype,
			{ mSanitizeSchemaValue: mSanitizeSchemaValue },
		)
	}
}
/**
 * Evaluates a summary using an LLM and returns recommendations for improvement.
 * @param {string} summary - The summary to evaluate
 * @param {object} llmProvider - The LLM provider to use for evaluation
 * @param {AgentFactory} Factory - The Factory instance to use for evaluation
 * @param {Avatar} Avatar - The Avatar instance to use for evaluation
 * @returns {object} - The evaluation result, including success status and responses
 */
async function mEvaluateItem(summary, llmProvider=mGetProvider(mGeneralFunctioneer?.llmProviders), Factory, Avatar){
	let evaluation = {
		responses: [],
		success: false,
	}
    const prompt = `Evaluate the included summary for clarity, dramatics, aesthetics, and completeness. Give top 2 recommendations to improve the summary. Do not repeat summary in response.\nSUMMARY:\n${summary}`
    let responses = await mLLMServices.getLLMResponse(undefined, llmProvider, prompt, Factory, Avatar)
	responses = mLLMServices.extractResponses(responses)
	evaluation.success = responses.length
	if(evaluation.success)
		evaluation.responses = responses
	else
		evaluation.responses.push({
			message: 'I apologize, something went wrong while trying to evaluate your summary. Please try again.',
			role: 'system',
			success: false,
		})
	return evaluation
}
function mExposedSchemas(factoryBlockedSchemas){
	const _systemBlockedSchemas = ['dataservices']
	return Object.keys(mSchemas)
		.filter(key => !_systemBlockedSchemas.includes(key) && !factoryBlockedSchemas.includes(key))
		.reduce((obj, key) => {
			obj[key] = mSchemas[key]
			return obj
		}, {})
}
/**
 * Ingests schema and returns an array of class definitions based upon any number of recursive `$defs`
 * @param {object} _schema - Schema for class and sub-`$defs`
 * @returns {array} - Returns array of unsanitized class definitions
 */
function mExtractClassesFromSchema(_schema){
	const _classes = []
	function _extractClasses(__schema){
		const { $defs={}, ...rootSchema } = __schema
		_classes.push(rootSchema)
		Object.keys($defs)
			.forEach(_key=>{
				_classes.push($defs[_key])
				if ($defs[_key].$defs) {
					_extractClasses($defs[_key])
				}
			})
	}
	_extractClasses(_schema)
	return _classes
}
/**
 * Ingests components of the JSON schema and generates text for class code.
 * @param {string} _className - Sanitized class name
 * @param {object} properties - Sanitized properties of class
 * @returns {string} - Returns class code in text format for rendering into node js object
 */
function mGenerateClassCode(_className, properties){
	//	delete known excluded properties in source
	for(const prop in properties){
		if(prop in mExcludeProperties){ delete properties[prop] }
	}
	// Generate class
	let classCode = `
// Code will run in vm and pass back class
class ${_className} {
// private properties
#excludeConstructors = ${ '['+Object.keys(mExcludeProperties).map(key => "'" + key + "'").join(',')+']' }
#name
`
	for (const prop in properties) {	//	assign default values as animated from schema
		const _value = mSanitizeSchemaValue(assignClassPropertyValues(properties[prop]))
		//	this is the value in error that needs sanitizing
		classCode += `	#${(_value)?`${prop} = ${_value}`:prop}\n`
	}
	classCode += `
// class constructor
constructor(obj){
	try{
		for(const _key in obj){
			//	exclude known private properties and db properties beginning with '_'
			if(this.#excludeConstructors.filter(_=>{ return (_==_key || _key.charAt(0)=='_')}).length) { continue }
			try{
				eval(\`this.\#\${_key}=obj[_key]\`)
			} catch(err){
				eval(\`this.\${_key}=obj[_key]\`)
			}
		}
		console.log('vm ${ _className } class constructed')
	} catch(err) {
		console.log(\`FATAL ERROR CREATING \${obj.being}\`, err)
	}
}
// if id changes are necessary, then use set .id() to trigger the change
// getters/setters for private vars`
	for (const prop in properties) {
		const type = properties[prop].type
		// generate getters/setters
		classCode += `
get ${ prop }(){
	return this.#${ prop }
}
set ${ prop }(_value) {	// setter with type validation
	if(typeof _value !== '${ type }' && '${ type }' !== 'undefined'){
		if(!('${ type }'==='array' && Array.isArray(_value))){
			throw new Error('Invalid type for property ${ prop }: expected ${ type }')
		}
	}
	if(this?.#${ prop }) this.#${ prop } = _value
	else this.${ prop } = _value
}`
	}
	//	functions
	//	inspect: returns a object representation of available private properties
	classCode += `	// public functions
inspect(_all=false){
	let _this = (_all)?{`
	for (const prop in properties) {
		classCode += `			${ prop }: this.#${ prop },\n`
	}
	classCode += `		}:{}
	return {...this,..._this}
}
}
exports.${_className} = ${_className}`
	return classCode
}
/**
 * Creates item data diff object for updateItem calls, comparing current item data with saved item data and returning only the fields that have changed.
 * @param {object} item - Item data already extracted from class
 * @param {Factory} factory - The factory instance, used to retrieve saved item data for comparison
 * @returns 
 */
async function mExtractItemDataDiff(item, factory, containerId, partitionId){
    const updatedItem = {
        id: item.id,
    }
	if(partitionId?.length && containerId?.length){ // update `item` with appropriate system keys
		const partitionKeys = await factory.dataservices.partitionKeys(containerId)
		for(const partitionKey of partitionKeys)
			if(partitionKey!=='mbr_id' && partitionKey!=='id')
				updatedItem[partitionKey] = item?.[partitionKey] ?? partitionId
	}
    const savedItem = await factory.item(updatedItem.id, containerId, partitionId)
     for(const key of Object.keys(item)){
        const newValue = item[key]
        if(key==='id' || (savedItem?.[key] && newValue===savedItem[key]))
            continue
        updatedItem[key] = newValue
    }
    updatedItem._etag = savedItem?._etag
    return updatedItem
}
function mGenerateClassFromSchema(_schema) {
	const { name, properties } = _schema
	const _classCode = mGenerateClassCode(name, properties)
	const _class = mCompileClass(name, _classCode)
	return _class
}
/**
 * Retrieves the specified LLM provider from the list of available providers.
 * @param {object} llmProviders - llmProviders object
 * @param {string} providerName - specific provider name (optional); defaults to `providers.defaultProvider` ?? 'openai'
 * @returns {object|null} - The specified LLM provider
 */
function mGetProvider(llmProviders, providerName=llmProviders?.defaultProvider ?? 'openai'){
	const { providers=[], } = llmProviders ?? {}
	const provider = providers.find(p =>p.provider===providerName)
	return provider ?? null
}
/**
 * Take help request about MyLife and consults appropriate engine for response.
 * @requires mLLMServices - equivalent of default MyLife dataservices/factory
 * @param {string} conversation_id - The provider's conversation id
 * @param {object} llmProvider - The Help Bot's LLM provider
 * @param {string} helpRequest - The help request string
 * @param {AgentFactory} Factory - The AgentFactory object; **note**: ensure prior that it is generic Q-conversation
 * @param {Avatar} Avatar - The avatar instance
 * @returns {Promise<Object>} - openai `message` objects
 */
async function mHelp(conversation_id, llmProvider, helpRequest, Factory, Avatar){
	const response = await mLLMServices.getLLMResponse(conversation_id, llmProvider, helpRequest, Factory, Avatar)
	return response
}
/**
 * Returns whether or not the factory is the MyLife server, as various functions are not available to the server and some _only_ to the server.
 * @param {string} _mbr_id 
 * @returns {boolean} true if factory is MyLife server
 */
function mIsMyLife(_mbr_id){
	return _mbr_id===mPartitionId
}
/**
 * Builds the schemas object by loading raw JSON from globals and processing each through the sanitize/generate pipeline.
 * @returns {Promise<object>} - Object keyed by class name, value is the generated class
 */
async function mBuildSchemas(){
	const rawSchemas = await mGlobals.schemas
	const classArray = rawSchemas
		.flatMap(schema=>{
			try { return mSanitizeSchema(schema) }
			catch(_){ return [] }
		})
		.map(cls => mGenerateClassFromSchema(cls))
	const schemas = classArray
		.reduce((obj, cls) => {
			obj[cls.name] = cls
			return obj
		}, {})
	return schemas
}
/**
 * Populates the `mBotInstructions` object with instruction sets retrieved from the dataservices. Each instruction set is categorized by its `type` property, allowing for organized access to different types of bot instructions.
 * @requires mDataservices
 * @returns {Promise<void>} - Resolves when the bot instructions have been populated in modular space
 */
async function mPopulateBotInstructions(){
	const botTemplates = await mDataservices.botInstructions()
	botTemplates
		.forEach(template=>{
			const { type, } = template
			mBotInstructions[type] = template
		})
}
/**
 * Ingests a text (or JSON-parsed) schema and returns an array of sanitized schema.
 * @param {object} _schema 
 * @returns {Array} - Array of sanitized schemas
 */
function mSanitizeSchema(_schema){
	if(!_schema) throw new Error('schema required')
	if(typeof _schema === 'string') _schema = JSON.parse(_schema)
	if(!(_schema?.name && _schema?.properties)) throw new Error('schema content required')
	// convert class name and $defs keys to camelCase where space or dash is found; also affect $ref values in parent
	const _classes = mSanitizeSchemaClasses(_schema) // will mutate properties && _sanitizedKeysObject
	return _classes
}
/**
 * Ingests a schema, mends improper variable names and fixes `$refs`, `$defs` and `required` and returns array of classes based on `$defs`.
 * @param {object} _schema - Validated schema with properties to mutate.
 * @returns {array} - Array of sanitized class definitions, one for each `$def`.
 */
function mSanitizeSchemaClasses(_schema){
	const _sanitizedKeysObject = {} // reference collection for $ref keys
	const _classes = mExtractClassesFromSchema(_schema) // container for list of sanitized class definitions to return
	const mutatedKeys = {}
	_classes.map(_class=>mSanitizeSchemaKeys(_class, mutatedKeys))
	if(Object.keys(mutatedKeys).length){
		_classes.forEach(_class=>{
			const { name: _name, properties: properties } = _class
			mSanitizeSchemaReferences(properties, mutatedKeys)
			// recursively loop `properties` for key `$ref`
			Object.keys(properties)
				.forEach(_key=>mSanitizeSchemaReferences(_key, mutatedKeys))

		})
	}
	return _classes
}
/**
 * Sanitizes a key to be used as a class property name.
 * @param {string} _key - Key to sanitize
 * @returns {string} - Sanitized key
 */
function mSanitizeSchemaKey(_key){
    // Create a regular expression pattern to match any of the special characters
    const pattern = new RegExp(`[${mReservedJSCharacters.map(char => `\\${char}`).join('')}]`, 'g')
    // Split the key into segments by the special characters and then convert segments into camelCase
    const segments = _key.split(pattern)
    let sanitizedKey = segments.map((segment, index) => 
        index === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1)
    ).join('')
	if(mReservedJSWords.includes(sanitizedKey)) sanitizedKey+='_key'
    return sanitizedKey
}
/**
 * Ingests a class definition and sanitizes its keys.
 * @module
 * @param {object} _class - Class definition to sanitize.
 * @param {object} _mutatedKeysObject - Object to hold mutated sanitized keys.
 * @returns {void} - Internally mutates parameter references.
 */
function mSanitizeSchemaKeys(_class, _mutatedKeysObject){
	const { name, properties, required} = _class
	const _sanitizedClassName = mSanitizeSchemaKey(name)
	if(_sanitizedClassName!==name){
		_mutatedKeysObject[name.toLowerCase()] = _sanitizedClassName
		_class.name = _sanitizedClassName
	}
	Object.keys(properties).forEach(_key=>{
		const _sanitizedKey = mSanitizeSchemaKey(_key)
		if(_sanitizedKey!==_key){
			properties[_sanitizedKey] = properties[_key]
			if(required.includes(_key)){ // _required_ is an array of strings
				required[required.indexOf(_key)] = _sanitizedKey
			}
			delete properties[_key]
		}
	})
}
function mSanitizeSchemaReferences(properties, _mutatedKeysObject){
	Object.keys(properties)
		.forEach(_key=>{
			if(_key==='$ref'){
				// mutate $ref key
				const _classReferenceName = properties['$ref'].split('/').pop()
				const _sanitizedKey = _mutatedKeysObject[_classReferenceName]
					?? _mutatedKeysObject[_classReferenceName.toLowerCase()]
				if(_sanitizedKey){
					// set $ref to sanitized key, as that will be the actual Class Name inside MyLife. **note**: remove all '/$defs/' as there is no nesting inside `schemas`
					properties['$ref'] = _sanitizedKey
				}
			} else if(typeof properties[_key] === 'object'){
				mSanitizeSchemaReferences( properties[_key], _mutatedKeysObject )
			}
	})
}
function mSanitizeSchemaValue(_value) {
    if (typeof _value !== 'string') return _value

    let startsWithQuote = _value.startsWith("'") || _value.startsWith('"') || _value.startsWith('`')
    let endsWithQuote = _value.endsWith("'") || _value.endsWith('"') || _value.endsWith('`')
    let wasTrimmed = startsWithQuote && endsWithQuote && _value[0] === _value[_value.length - 1]

    let trimmedStr = wasTrimmed ? _value.substring(1, _value.length - 1) : _value
    trimmedStr = trimmedStr.replace(/(?<!\\)[`\\$'"]/g, "\\$&")

    return wasTrimmed ? _value[0] + trimmedStr + _value[0] : trimmedStr
}
/**
 * Decouples team from modular reference.
 * @param {object} team - Team object from modular codespace
 * @returns {object} - Returns sanitized team object
 */
function mTeam(team){
    const {
        allowCustom,
        allowedBotTypes,
		allowedItemTypes,
        defaultTypes,
        description,
        id,
        name,
        title,
    } = team
    return {
        allowCustom,
        allowedBotTypes: [...allowedBotTypes],
		allowedItemTypes: [...allowedItemTypes],
        defaultTypes: [...defaultTypes],
        description,
        id,
        name,
        title,
    }
}
// server build: injects default factory into _server_ **MyLife** instance
const SystemAvatar = await new Q(
	new MyLifeFactory(), mLLMServices
)
	.init()
/* exports */
export default SystemAvatar