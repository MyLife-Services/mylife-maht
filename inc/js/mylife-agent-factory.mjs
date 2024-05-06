/* imports */
import { promises as fs } from 'fs'
import EventEmitter from 'events'
import vm from 'vm'
import util from 'util'
import { Guid } from 'js-guid'	//	usage = Guid.newGuid().toString()
import Avatar from './mylife-avatar.mjs'
import Dataservices from './mylife-data-service.js'
import { Member, MyLife } from './core.mjs'
import {
	extendClass_consent,
	extendClass_contribution,
    extendClass_conversation,
	extendClass_experience,
    extendClass_file,
	extendClass_message,
} from './factory-class-extenders/class-extenders.mjs'	//	do not remove, although they are not directly referenced, they are called by eval in mConfigureSchemaPrototypes()
import LLMServices from './mylife-llm-services.mjs'
import Menu from './menu.mjs'
import MylifeMemberSession from './session.mjs'
import chalk from 'chalk'
/* modular constants */
// global object keys to exclude from class creations [apparently fastest way in js to lookup items, as they are hash tables]
const { MYLIFE_SERVER_MBR_ID: mPartitionId, } = process.env
const mBotInstructions = {}
const mDataservices = await new Dataservices(mPartitionId).init()
const mDefaultBotType = 'personal-avatar'
const mExtensionFunctions = {
	extendClass_consent: extendClass_consent,
	extendClass_contribution: extendClass_contribution,
	extendClass_conversation: extendClass_conversation,
	extendClass_experience: extendClass_experience,
	extendClass_file: extendClass_file,
	extendClass_message: extendClass_message,
}
const mExcludeProperties = {
	$schema: true,
	$id: true,
	$defs: true,
	$comment: true,
	definitions: true,
	name: true
}
const mLLMServices = new LLMServices()
const mNewGuid = ()=>Guid.newGuid().toString()
const mPath = './inc/json-schemas'
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
const mAlerts = {
	system: await mDataservices.getAlerts(), // not sure if we need other types in global modular, but feasibly historical alerts could be stored here, etc.
}
// @todo: capitalize hard-codings as per actual schema classes
const mSchemas = {
	...await mLoadSchemas(),
	dataservices: Dataservices,
	menu: Menu,
	member: Member,
	session: MylifeMemberSession
}
const mSystemActor = await mDataservices.bot(undefined, 'actor', undefined)
/* modular construction functions */
mConfigureSchemaPrototypes()
mPopulateBotInstructions()
/* logging/reporting */
console.log(chalk.bgRedBright('<-----AgentFactory module loaded----->'))
console.log(chalk.greenBright('schema-class-constructs'))
console.log(mSchemas)
/* modular classes */
class BotFactory extends EventEmitter{
	// micro-hydration version of factory for use _by_ the MyLife server
	#dataservices
	#llmServices = mLLMServices
	#mbr_id
	constructor(_mbr_id, _directHydration=true){
		super()
		this.#mbr_id = _mbr_id
		if(mIsMyLife(_mbr_id) && _directHydration)
			throw new Error('MyLife server cannot be accessed as a BotFactory alone')
		else if(mIsMyLife(this.mbr_id))
			this.#dataservices = mDataservices
		else if(_directHydration)
			console.log(chalk.blueBright('BotFactory class instance for hydration request'), chalk.bgRed(this.mbr_id))
	}
	/* public functions */
	/**
	 * Initialization routine required for all bot instances. Note: MyLife cannot be constructed as a botFactory, so should never be called as such.
	 * @param {Guid} _mbr_id 
	 * @returns {AgentFactory} this
	 */
	async init(_mbr_id=this.mbr_id){
		this.#mbr_id = _mbr_id
		this.#dataservices = new Dataservices(this.mbr_id)
		await this.#dataservices.init()
		this.core.avatar_id = this.core.avatar_id
			?? (await this.dataservices.getAvatar()).id
		return this
	}
	/**
	 * Get a bot, either by id (when known) or bot-type (default=mDefaultBotType). If bot id is not found, then it cascades to the first entity of bot-type it finds, and if none found, and rules allow [in instances where there may be a violation of allowability], a new bot is created.
	 * If caller is `MyLife` then bot is found or created and then activated via a micro-hydration.
	 * @todo - determine if spotlight-bot is required for any animation, or a micro-hydrated bot is sufficient.
	 * @public
	 * @param {string} _bot_id - The bot id.
	 * @param {string} type - The bot type.
	 * @returns {object} - The bot.
	 */
	async bot(_bot_id, type=mDefaultBotType, _mbr_id){
		if(this.isMyLife){ // MyLife server has no bots of its own, system agents perhaps (file, connector, etc) but no bots yet, so this is a micro-hydration
			if(!_mbr_id)
				throw new Error('mbr_id required for BotFactory hydration')
			const _botFactory = new BotFactory(_mbr_id)
			await _botFactory.init()
			_botFactory.bot = await _botFactory.bot(_bot_id, type, _mbr_id)
			if(!_botFactory?.bot){ // create bot on member behalf
				console.log(chalk.magenta(`bot hydration-create::${type}`))
				// do not need intelligence behind this object yet, for that, spotlight is a mini-avatar
				_botFactory.bot = await _botFactory.setBot({ type: type })
			}
			// rather than just a bot in this event, return micro-hydrated bot (mini-avatar ultimately)
			return _botFactory
		}
		return ( await this.dataservices.getItem(_bot_id) )
			?? ( await this.dataservices.getItemByField(
					'bot',
					'type',
					type,
					undefined,
					_mbr_id
				) )
			?? ( await this.bots(undefined,type)?.[0] )
	}
	/**
	 * Returns bot instruction set.
	 * @public
	 * @param {string} type - The bot type.
	 * @returns {object} - The bot instructions.
	 */
	botInstructions(botType){
		if(!botType)
			throw new Error('bot type required')
		console.log(chalk.magenta(`botInstructions::${botType}`), mBotInstructions)
		if(!mBotInstructions[botType]){
			if(!botInstructions)
				throw new Error(`no bot instructions found for ${ botType }`)
			mBotInstructions[botType] = botInstructions
		}
		return mBotInstructions[botType]
	}
	/**
	 * Gets a member's bots.
	 * @todo - develop bot class and implement hydrated instance
	 * @public
	 * @param {string} object_id - The object_id guid of avatar.
	 * @param {string} botType - The bot type.
	 * @returns {array} - The member's hydrated bots.
	 */
	async bots(object_id, botType){
		const _params = object_id?.length
			? [{ name: '@object_id', value:object_id }]
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
     * Get member collection items.
     * @param {string} type - The type of collection to retrieve, `false`-y = all.
     * @returns {array} - The collection items with no wrapper.
     */
	async collections(type){
		return await this.dataservices.collections(type)
	}
	async createBot(bot={ type: mDefaultBotType }){
		bot.id = this.newGuid
		const _bot = await mCreateBot(this.#llmServices, this, bot, this.avatarId)
		return _bot
	}
    /**
     * Delete an item from member container.
     * @param {Guid} id - The id of the item to delete.
     * @returns {boolean} - true if item deleted successfully.
     */
	async deleteItem(id){
        if(this.isMyLife)
            throw new Error('MyLife avatar cannot delete items.')
		return await this.dataservices.deleteItem(id)
	}
	/**
	 * Gets array of member `experiences` from database. When placed here, it allows for a bot to be spawned who has access to this information, which would make sense for a mini-avatar whose aim is to report what experiences a member has endured.
	 * @public
	 * @returns {Promise<array>} - Array of shorthand experience objects.
	 * @property {string<Guid>} id - The experience id.
	 * 
	 */
	async experiences(includeLived=false){
		// check consents for test-experiences [stub]
		let testExperiences = []
		// currently only system experiences exist
		let experiences = await mDataservices.getItems(
			'experience',
			undefined,
			[{ name: '@status', value: 'active' }],
			'system',
			) ?? []
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
	 * @param {guid} _experience_id - The experience id in Cosmos.
	 * @returns {Promise<object>} - The experience.
	 */
	async getExperience(_experience_id){
		if(!_experience_id) 
			throw new Error('factory.experience: experience id required')
		// @todo remove restriction (?) for all experiences to be stored under MyLife `mbr_id`
		return await mDataservices.getItem(_experience_id, 'system')
	}
	/**
	 * Gets, creates or updates Library in Cosmos.
	 * @todo - institute bot for library mechanics.
	 * @public
	 * @param {Object} _library - The library object, including items to be added to/updated in member's library.
	 * @returns {object} - The library.
	 */
	async library(_library){
		const updatedLibrary = await mLibrary(this, _library)
		// test the type/form of Library
		switch(updatedLibrary.type){
			case 'story':
				if(updatedLibrary.form==='biographer'){
					// inflate and update library with stories
					const stories = ( await this.stories(updatedLibrary.form) )
						.filter(story=>!this.globals.isValidGuid(story?.library_id))
						.map(story=>{
							story.id = story.id ?? this.newGuid
							story.author = story.author ?? this.mbr_name
							story.title = story.title ?? story.id
							return mInflateLibraryItem(story, updatedLibrary.id, this.mbr_id)
						})
					updatedLibrary.items = [
						...updatedLibrary.items,
						...stories,
					]
					/* update stories (no await) */
					stories.forEach(story=>this.dataservices.patch(
						story.id,
						{ library_id: updatedLibrary.id },
					))
					/* update library (no await) */
					this.dataservices.patch(
						updatedLibrary.id,
						{ items: updatedLibrary.items },
					)
				}
				break
			default:
				break
		}
		return updatedLibrary
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
	 * Adds or updates a bot.
	 * @public
	 * @param {object} _bot - bot data.
	 * @returns {object} - The Cosmos bot.
	 */
	async setBot(_bot={ type: mDefaultBotType }){
		if(!_bot?.id?.length)
			_bot = await this.createBot(_bot)
		return await this.dataservices.setBot(_bot)
	}
	/**
	 * Gets a collection of stories of a certain format.
	 * @todo - currently disconnected from a library, but no decisive mechanic for incorporating library shell.
	 * @param {*} _form 
	 * @returns 
	 */
	async stories(_form){
		return await this.dataservices.getItemsByFields(
			'story',
			[{ name: '@form', value: _form }],
		)
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
		return this.dataservices.core
	}
	get dataservices(){
		return this.#dataservices
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
		return this.dataservices.globals
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
	}
	get mbr_id_id(){
		return this.globals.sysId(this.mbr_id)
	}
	get mbr_name(){
		return this.globals.sysName(this.mbr_id)
	}
	get memberName(){
		return this.dataservices.core.names?.[0]??this.mbr_name
	}
	get newGuid(){
		return mNewGuid()
	}
	/**
	 * @todo - determine hydration method, timing and requirements for `actor`(s); they remain currently unhydrated, only need `bot_id`
	 * @returns {object} - The system actor bot data.
	 */
	get systemActor(){
		return mSystemActor
	}
}
class AgentFactory extends BotFactory{
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
			throw new Error('MyLife server AgentFactory cannot be initialized, as it references modular dataservices on constructor().')
		await super.init(mbr_id)
		if(this.core.openaiapikey)
			this.#llmServices = new LLMServices(this.core.openaiapikey, this.core.openaiorgkey)
		return this
	}
	/**
	 * Retrieves avatar properties from Member factory dataservices, or inherits the core data from Member class.
	 * @returns {object} - Avatar properties.
	 */
	async avatarProperties(){
		return ( await this.dataservices.getAvatar() )
			?? mAvatarProperties(this.core)
	}
	/**
	 * Accesses MyLife Dataservices to challenge access to a member's account.
	 * @param {string} _mbr_id 
	 * @param {string} _passphrase 
	 * @returns {object} - Returns passphrase document if access is granted.
	 */
	async challengeAccess(_mbr_id, _passphrase){
		return await mDataservices.challengeAccess(_mbr_id, _passphrase)
	}
	async datacore(_mbr_id){
		const _core = await mDataservices.getItems(
			'core',
			undefined,
			undefined,
			undefined,
			_mbr_id,
		)
		return _core?.[0]??{}
	}
	async getAlert(_alert_id){
		const _alert = mAlerts.system.find(alert => alert.id === _alert_id)
		return _alert ? _alert : await mDataservices.getAlert(_alert_id)
	}
	/**
	 * Returns all alerts of a given type, currently only _system_ alerts are available. Refreshes by definition from the database.
	 * @param {string} _type 
	 * @returns {array} array of current alerts
	 */
	async getAlerts(_type){
		const _systemAlerts = await this.dataservices.getAlerts()
		mAlerts.system = _systemAlerts
		return this.alerts
	}
	/**
	 * Constructs and returns an Avatar instance.
	 * @returns {Avatar} - The Avatar instance.
	 */
	async getAvatar(){
		const avatar = await ( new Avatar(this, this.#llmServices) )
			.init()
		return avatar
	}
	async getMyLifeMember(){
		const _r =  await ( new (mSchemas.member)(this) )
			.init()
		return _r
	}
	async getMyLifeSession(){
		// default is session based around default dataservices [Maht entertains guests]
		// **note**: conseuquences from this is that I must be careful to not abuse the modular space for sessions, and regard those as _untouchable_
		return await new (mSchemas.session)(
			( new AgentFactory(mPartitionId) ) // no need to init currently as only pertains to non-server adjustments
			// I assume this is where the duplication is coming but no idea why
		).init()
	}
	async getConsent(_consent){
		//	consent is a special case, does not exist in database, is dynamically generated each time with sole purpose of granting access--stored for and in session, however, and attempted access there first... id of Consent should be same as id of object being _request_ so lookup will be straight-forward
		//	@todo: not stored in cosmos (as of yet, might be different container), so id can be redundant
		return new (mSchemas.consent)(_consent, this)
	}
	async getContributionQuestions(_being, _category){
		return await mDataservices.getContributionQuestions(_being, _category)
	}
	isAvatar(_avatar){	//	when unavailable from general schemas
		return (_avatar instanceof mSchemas.avatar)
	}
	isConsent(_consent){	//	when unavailable from general schemas
		return (_consent instanceof mSchemas.consent)
	}
	isSession(_session){	//	when unavailable from general schemas
		return (_session instanceof mSchemas.session)
	}
	/**
	 * Adds or updates a library with items outlined in request `library.items` array. Note: currently the override for `botFactory` function .library which returns a library item from the database.
	 * @todo: finalize mechanic for overrides
	 * @param {Object} _library - The library object, including items to be added to member's library.
	 * @returns {Object} - The complete library object from Cosmos.
	 */
	async library(_library){
		/* hydrate library micro-bot */
		const { bot_id, mbr_id } = _library
		const _microBot = await this.libraryBot(bot_id, mbr_id)
		return await _microBot.library(_library)
	}
	async libraryBot(_bot_id, _mbr_id){
		return await this.bot(_bot_id, 'library', _mbr_id)
	}
	/**
	 * Registers a new candidate to MyLife membership
	 * @public
	 * @param {object} candidate { 'email': string, 'humanName': string, 'avatarNickname': string }
	 */
	async registerCandidate(candidate){
		return await this.dataservices.registerCandidate(candidate)
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
	 * Submits a story to MyLife. Currently via API, but could be also work internally.
	 * @param {object} story - Story object.
	 * @returns {object} - The story document from Cosmos.
	 */
	async story(story){
		if(!story.summary?.length)
			throw new Error('story summary required')
		const id = this.newGuid
		const title = story.title ?? 'New Memory Entry'
		const finalStory = {
			...story,
			...{
			assistantType: story.assistantType ?? 'biographer-bot',
			being: story.being ?? 'story',
			form: story.form ?? 'biographer',
			id,
			keywords: story.keywords ?? ['memory', 'biographer', 'entry'],
			mbr_id: this.mbr_id,
			name: story.name ?? title ?? `story_${ this.mbr_id }_${ id }`,
			phaseOfLife: story.phaseOfLife ?? 'unknown',
			summary: story.summary,
			title,
		}}
		return await this.dataservices.story(finalStory)
	}
	/**
	 * Tests partition key for member
	 * @public
	 * @param {string} _mbr_id member id
	 * @returns {boolean} returns true if partition key is valid
	 */
	async testPartitionKey(_mbr_id){
		if(!this.isMyLife) return false
		return await mDataservices.testPartitionKey(_mbr_id)
	}
	//	getters/setters
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
		return this.schemas.Conversation
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
		return this.schemas.Message
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
// private modular functions
/**
 * Initializes openAI assistant and returns associated `assistant` object.
 * @modular
 * @param {LLMServices} llmServices - OpenAI object
 * @param {object} bot - bot creation instructions.
 * @returns {object} - [OpenAI assistant object](https://platform.openai.com/docs/api-reference/assistants/object)
 */
async function mAI_openai(llmServices, bot){
    const { bot_name, description, model, name, instructions, tools=[], } = bot
    const assistant = {
        description,
        model,
        name: bot_name ?? name, // take friendly name before Cosmos
        instructions,
		tools,
    }
    return await llmServices.createBot(assistant)
}
function assignClassPropertyValues(_propertyDefinition){
	switch (true) {
		case _propertyDefinition?.const!==undefined:	//	constants
			return `'${_propertyDefinition.const}'`
		case _propertyDefinition?.default!==undefined:	//	defaults: bypass logic
			if(Array.isArray(_propertyDefinition.default)){
				return '[]'
			}
			return `'${_propertyDefinition.default}'`
		default:
			//	presumption: _propertyDefinition.type is not array [though can be]
			switch (_propertyDefinition?.type) {
				case 'array':
					return '[]'
				case 'boolean':
					return false
				case 'integer':
				case 'number':
					return 0
				case 'string':
					switch (_propertyDefinition?.format) {
						case 'date':
						case 'date-time':
							return `'${new Date().toDateString()}'`
						case 'uuid':
							return `'${Guid.newGuid().toString()}'`
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
 * Creates new avatar property data package to be consumed by Avatar class `constructor`. Defines critical avatar fields as: ["being", "id", "mbr_id", "name", "names", "nickname", "proxyBeing", "type"].
 * @modular
 * @param {object} _core - Datacore object
 * @returns {object} - Avatar property data package
 */
function mAvatarProperties(_core){
	const {
		mbr_id,
		names=['default-name-error'],
		..._avatarProperties
	} = _core
	[
		"assistant",
		"being",
		"bots",
		"command_word",
		"contributions",
		"conversations",
		"id",
		"mbr_id",
		"messages",
		"metadata",
		"name",
		"names",
		"object_id",
		"proxyBeing",
		"type"
	].forEach(_prop=>{
		delete _avatarProperties[_prop]
	})
	return {
		..._avatarProperties,
		being: 'avatar',
		id: mNewGuid(),
		mbr_id: mbr_id,
		name: `avatar_${mbr_id}`,
		names: names,
		nickname: _avatarProperties.nickname??names[0],
		proxyBeing: mIsMyLife(mbr_id) ? 'MyLife' : 'human',
		type: 'openai_assistant',
	}
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
	for(const _className in mSchemas){
		//	global injections; maintained _outside_ of eval class
		Object.assign(
			mSchemas[_className].prototype,
			{ mSanitizeSchemaValue: mSanitizeSchemaValue },
		)
		mSchemas[_className] = mExtendClass(mSchemas[_className])
	}
}
/**
 * Creates bot and returns associated `bot` object.
 * @modular
 * @private
 * @param {LLMServices} llm - OpenAI object
 * @param {AgentFactory} factory - Agent Factory object
 * @param {object} bot - Bot object
 * @param {string} avatarId - Avatar id
 * @returns {string} - Bot assistant id in openAI
*/
async function mCreateBotLLM(llm, bot){
    const llmResponse = await mAI_openai(llm, bot)
    return llmResponse.id
}
/**
 * Creates bot and returns associated `bot` object.
 * @modular
 * @async
 * @private
 * @param {LLMServices} llm - LLMServices Object contains methods for interacting with OpenAI
 * @param {BotFactory} factory - BotFactory object
 * @param {object} bot - Bot object, must include `type` property.
 * @returns {object} - Bot object
*/
async function mCreateBot(llm, factory, bot){
	const { bot_name, description: botDescription, instructions: botInstructions, name: botDbName, type, } = bot
	const { avatarId, } = factory
	const botName = bot_name
		?? botDbName
		?? type
	const description = botDescription
		?? `I am a ${ type } bot for ${ factory.memberName }`
	const instructions = botInstructions
		?? mCreateBotInstructions(factory, bot)
	const name = botDbName
		?? `bot_${ type }_${ avatarId }`
	const tools = mGetAIFunctions(type, factory.globals)
	if(!avatarId)
		throw new Error('avatar id required to create bot')
	const botData = {
		being: 'bot',
		bot_name: botName,
		description,
		instructions,
		model: process.env.OPENAI_MODEL_CORE_BOT,
		name,
		object_id: avatarId,
		provider: 'openai',
		purpose: description,
		tools,
		type,
	}
	botData.bot_id = await mCreateBotLLM(llm, botData) // create after as require model
	return botData
}
/**
 * Returns MyLife-version of bot instructions.
 * @modular
 * @private
 * @param {BotFactory} factory - Factory object
 * @param {object} _bot - Bot object
 * @returns {string} - flattened string of instructions
 */
function mCreateBotInstructions(factory, _bot){
	if(!_bot)
		throw new Error('bot object required')
	const _type = _bot.type ?? mDefaultBotType
    let _botInstructionSet = factory.botInstructions(_type) // no need to wait, should be updated or refresh server
    _botInstructionSet = _botInstructionSet?.instructions
    if(!_botInstructionSet)
		throw new Error(`bot instructions not found for type: ${_type}`)
    /* compile instructions */
    let _botInstructions = ''
    switch(_type){
        case 'personal-avatar':
            _botInstructions +=
                  _botInstructionSet.preamble
                + _botInstructionSet.general
            break
        case 'personal-biographer':
            _botInstructions +=
                  _botInstructionSet.preamble
                + _botInstructionSet.purpose
                + _botInstructionSet.prefix
                + _botInstructionSet.general
            break
        default: // avatar
            _botInstructions += _botInstructionSet.general
            break
    }
    /* apply replacements */
    _botInstructionSet.replacements = _botInstructionSet?.replacements??[]
    _botInstructionSet.replacements.forEach(_replacement=>{
        const _placeholderRegExp = factory.globals.getRegExp(_replacement.name, true)
        const _replacementText = eval(`factory?.${_replacement.replacement}`)
            ?? eval(`_bot?.${_replacement.replacement}`)
            ?? _replacement?.default
            ?? '`unknown-value`'
        _botInstructions = _botInstructions.replace(_placeholderRegExp, () => _replacementText)
    })
    /* apply references */
    _botInstructionSet.references = _botInstructionSet?.references??[]
    _botInstructionSet.references.forEach(_reference=>{
        const _referenceText = _reference.insert
        const _replacementText = eval(`factory?.${_reference.value}`)
            ?? eval(`_bot?.${_reference.value}`)
            ?? _reference.default
            ?? '`unknown-value`'
        switch(_reference.method??'replace'){
            case 'append-hard':
                const _indexHard = _botInstructions.indexOf(_referenceText)
                if (_indexHard !== -1) {
                _botInstructions =
                    _botInstructions.slice(0, _indexHard + _referenceText.length)
                    + '\n'
                    + _replacementText
                    + _botInstructions.slice(_indexHard + _referenceText.length)
                }
                break
            case 'append-soft':
                const _indexSoft = _botInstructions.indexOf(_referenceText);
                if (_indexSoft !== -1) {
                _botInstructions =
                      _botInstructions.slice(0, _indexSoft + _referenceText.length)
                    + ' '
                    + _replacementText
                    + _botInstructions.slice(_indexSoft + _referenceText.length)
                }
                break
            case 'replace':
            default:
                _botInstructions = _botInstructions.replace(_referenceText, _replacementText)
                break
        }
    })
    return _botInstructions
}
function mExposedSchemas(factoryBlockedSchemas){
	const _systemBlockedSchemas = ['dataservices','session']
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
function mExtendClass(_class) {
	const _className = _class.name.toLowerCase()
	if (typeof mExtensionFunctions?.[`extendClass_${_className}`]==='function'){
		console.log(`Extension function found for ${_className}`)
		//	add extension decorations
		const _references = { openai: mLLMServices }
		_class = mExtensionFunctions[`extendClass_${_className}`](_class, _references)
	}
	return _class
}
/**
 * Ingests components of the JSON schema and generates text for class code.
 * @param {string} _className - Sanitized class name
 * @param {object} _properties - Sanitized properties of class
 * @returns {string} - Returns class code in text format for rendering into node js object
 */
function mGenerateClassCode(_className, _properties){
	//	delete known excluded _properties in source
	for(const _prop in _properties){
		if(_prop in mExcludeProperties){ delete _properties[_prop] }
	}
	// Generate class
	let classCode = `
// Code will run in vm and pass back class
class ${_className} {
// private properties
#excludeConstructors = ${ '['+Object.keys(mExcludeProperties).map(key => "'" + key + "'").join(',')+']' }
#name
`
	for (const _prop in _properties) {	//	assign default values as animated from schema
		const _value = mSanitizeSchemaValue(assignClassPropertyValues(_properties[_prop]))
		//	this is the value in error that needs sanitizing
		classCode += `	#${(_value)?`${_prop} = ${_value}`:_prop}\n`
	}
	classCode += `
// class constructor
constructor(obj){
	try{
		for(const _key in obj){
			//	exclude known private properties and db properties beginning with '_'
			if(this.#excludeConstructors.filter(_prop=>{ return (_prop==_key || _key.charAt(0)=='_')}).length) { continue }
			try{
				eval(\`this.\#\${_key}=obj[_key]\`)
			} catch(err){
				eval(\`this.\${_key}=obj[_key]\`)
				console.log(\`could not privatize \${_key}, public node created\`)
			}
		}
		console.log('vm ${ _className } class constructed')
	} catch(err) {
		console.log(\`FATAL ERROR CREATING \${obj.being}\`, err)
		rethrow
	}
}
// if id changes are necessary, then use set .id() to trigger the change
// getters/setters for private vars`
	for (const _prop in _properties) {
		const _type = _properties[_prop].type
		// generate getters/setters
		classCode += `
get ${_prop}(){
	return this.#${_prop}
}
set ${_prop}(_value) {	// setter with type validation
	if(typeof _value !== '${_type}' && '${_type}' !== 'undefined'){
		if(!('${_type}'==='array' && Array.isArray(_value))){
			throw new Error('Invalid type for property ${_prop}: expected ${_type}')
		}
	}
	if(this?.#${_prop}) this.#${_prop} = _value
	else this.${_prop} = _value
}`
	}
	//	functions
	//	inspect: returns a object representation of available private properties
	classCode += `	// public functions
inspect(_all=false){
	let _this = (_all)?{`
	for (const _prop in _properties) {
		classCode += `			${_prop}: this.#${_prop},\n`
	}
	classCode += `		}:{}
	return {...this,..._this}
}
}
exports.${_className} = ${_className}`
	return classCode
}
function mGenerateClassFromSchema(_schema) {
	const { name, properties } = _schema
	const _classCode = mGenerateClassCode(name, properties)
	const _class = mCompileClass(name, _classCode)
	return _class
}
/**
 * Retrieves any functions that need to be attached to ai.
 * @param {string} type - Type of bot.
 * @param {object} globals - Global functions for bot.
 * @returns {array} - Array of AI functions for bot type.
 */
function mGetAIFunctions(type, globals){
	const functions = []
	switch(type){
		case 'personal-biographer':
			const biographerTools = ['storySummary']
			biographerTools.forEach(toolName=>{
				const jsToolDescription = {
					type: 'function',
					function: globals.getGPTJavascriptFunction(toolName),
				}
				functions.push(jsToolDescription)
			})
			break
		default:
			break
	}
	return functions
}
/**
 * Inflates library item with required values and structure. Object structure expected from API, librayItemItem in JSON.
 * root\inc\json-schemas\bots\library-bot.json
 * @param {object} _item - Library item (API) object. { author: string, enjoymentLevel: number, format: string, insights: string, personalImpact: string, title: string, whenRead: string }
 * @param {string} _library_id - Library id
 * @param {string} _mbr_id - Member id
 * @returns {object} - Library-item object. { assistantType: string, author_match: array, being: string, date: string, format: string, id: string, item: object, library_id: string, object_id: string, title_match: string
 */
function mInflateLibraryItem(_item, _library_id, _mbr_id){
	const _id = _item.id??mNewGuid()
	return {
		assistantType: _item.assistantType??'mylife-library',
		author_match: (_item.author??'unknown-author')
			.trim()
			.toLowerCase()
			.split(' '),
		being: 'library-item',
		date: _item.date??new Date().toISOString(),
		format: _item.format??_item.form??_item.type??'book',
		id: _id,
		item: {..._item, id: _id },
		library_id: _library_id,
		object_id: _library_id,
		title_match: (_item.title??'untitled')
			.trim()
			.toLowerCase(),
	}
}
/**
 * Hydrates library and returns library object.
 * @modular
 * @private
 * @param {BotFactory} factory - BotFactory object
 * @param {object} _library - Library object
 * @returns {object} - Library object
 */
async function mLibrary(factory, _library){
	// @todo: micro-avatar for representation of bot(s)
	// @todo: Bot class with extension for things like handling libraries
	// @todo: bot-extenders so that I can get this functionality into that object context
	/* constants */
	const { assistantType, form='collection', id, items: _libraryItems=[], mbr_id, type } = _library
	const _avatar_id = factory.avatarId
	// add/get correct library; default to core (object_id=avatar_id && type)
	/* parse and cast _libraryItems */
	let _libraryCosmos = await factory.dataservices.library(id, _avatar_id, type, form)
	// @dodo: currently only book/story library items are supported
	if(!_libraryCosmos){ // create when undefined
		// @todo: microbot should have a method for these
		const _library_id = factory.newGuid
		_libraryCosmos = {
			being: `library`,
			form: form,
			id: _library_id,
			items: _libraryItems.map(_item=>mInflateLibraryItem(_item, _library_id, mbr_id)),
			mbr_id: mbr_id,
			name: ['library',type,form,_avatar_id].join('_'),
			object_id: _avatar_id,
			type: type,
		}
		factory.dataservices.pushItem(_libraryCosmos) // push to Cosmos
	} else {
		// @todo: manage multiple libraries
		const { id: _library_id, items: _storedLibraryItems } = _libraryCosmos
		_libraryItems.forEach(_item => {
			_item = mInflateLibraryItem(_item,_library_id, mbr_id)
			const matchIndex = _storedLibraryItems.findIndex(storedItem => { // Find the index of the item in the stored library items that matches the criteria
				if(storedItem.id===_item.id || storedItem.title_match===_item.title_match)
				return true
			const storedAuthorWords = storedItem.author_match
			const incomingAuthorWords = _item.author_match
			const authorMatches = (() => {
				if (storedAuthorWords.length === 1 || incomingAuthorWords.length === 1) { // If either author array has a length of 1, check for any matching word
					return storedAuthorWords.some(word => incomingAuthorWords.includes(word))
				} else { // If both have 2+ lengths, ensure at least 2 items match
					const matches = storedAuthorWords.filter(word => incomingAuthorWords.includes(word))
					return matches.length >= 2
					}
				})()
				if (authorMatches && matchIndex !== -1) { // Mutate the author to the one with more details if needed
					if (incomingAuthorWords.length > storedAuthorWords.length) {
						_storedLibraryItems[matchIndex].author_match = incomingAuthorWords // Update to more detailed author
					}
				}
				return authorMatches
			})
			if (matchIndex!== -1) { // If a match is found, update the entry
				_storedLibraryItems[matchIndex] = {
					..._storedLibraryItems[matchIndex],  // Keep existing properties
					..._item,  // Overwrite and add new properties from _item
					id: _storedLibraryItems[matchIndex].id
						?? factory.newGuid, // if for some reason object hasn't id
					object_id: _library_id,
					type: _item.type
						?? 'book',
				}
			} else {
				_storedLibraryItems.push({ // If no match is found, add the item to the library
					..._item,
					id: _item.id??factory.newGuid, // Ensure each item has a unique ID
					mbr_id: factory.mbr_id,
					object_id: _library_id,
					type: _item.type??'book',
				})
			}
		})
		// save library to Cosmos @todo: microbot should have a method for this
		_libraryCosmos.items = _storedLibraryItems
		factory.dataservices.patch(_library_id, {items: _libraryCosmos.items})
	}
	return _libraryCosmos
}
/**
 * Returns whether or not the factory is the MyLife server, as various functions are not available to the server and some _only_ to the server.
 * @param {string} _mbr_id 
 * @returns {boolean} true if factory is MyLife server
 */
function mIsMyLife(_mbr_id){
	return _mbr_id===mPartitionId
}
async function mLoadSchemas(){
	try{
		let _filesArray = await (fs.readdir(mPath))
		_filesArray = _filesArray.filter(_filename => _filename.split('.')[1] === 'json')
		const _schemasArray = (await Promise.all(
			_filesArray.map(
				async _filename => {
					const _file = await fs.readFile(`${mPath}/${_filename}`, 'utf8')
					const _fileContent = JSON.parse(_file)
					let _classArray = mSanitizeSchema(_fileContent)
					// generate classes from schema array
					_classArray = _classArray.map(_class => {
						const _classObject = mGenerateClassFromSchema(_class)
						return _classObject
					})
					return _classArray
				}
			)
		))
			.flat()
		const _schemasObject =  _schemasArray.reduce((_schema, _class) => {
			_schema[_class.name] = _class
			return _schema
		}, {})
		return _schemasObject
	} catch(err){
		console.log(err)
	}
}
async function mPopulateBotInstructions(){
	const _botInstructionSets = await mDataservices.botInstructions()
	_botInstructionSets.forEach(_instructionSet=>{
		mBotInstructions[_instructionSet.type] = _instructionSet
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
			const { name: _name, properties: _properties } = _class
			mSanitizeSchemaReferences(_properties, mutatedKeys)
			// recursively loop `properties` for key `$ref`
			Object.keys(_properties)
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
 * @modular
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
function mSanitizeSchemaReferences(_properties, _mutatedKeysObject){
	Object.keys(_properties)
		.forEach(_key=>{
			if(_key==='$ref'){
				// mutate $ref key
				const _classReferenceName = _properties['$ref'].split('/').pop()
				const _sanitizedKey = _mutatedKeysObject[_classReferenceName]
					?? _mutatedKeysObject[_classReferenceName.toLowerCase()]
				if(_sanitizedKey){
					// set $ref to sanitized key, as that will be the actual Class Name inside MyLife. **note**: remove all '/$defs/' as there is no nesting inside `schemas`
					_properties['$ref'] = _sanitizedKey
				}
			} else if(typeof _properties[_key] === 'object'){
				mSanitizeSchemaReferences( _properties[_key], _mutatedKeysObject )
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
/* final constructs relying on class and functions */
// server build: injects default factory into _server_ **MyLife** instance
const _MyLife = await new MyLife(
	new AgentFactory(mPartitionId)
)
	.init()
/* exports */
export default _MyLife