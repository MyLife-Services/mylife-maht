/* imports */
import { promises as fs } from 'fs'
import EventEmitter from 'events'
import vm from 'vm'
import util from 'util'
import { Guid } from 'js-guid'	//	usage = Guid.newGuid().toString()
import { Avatar, Q, } from './mylife-avatar.mjs'
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
/* module constants */
const { MYLIFE_SERVER_MBR_ID: mPartitionId, } = process.env
const mDataservices = await new Dataservices(mPartitionId).init()
const mBotInstructions = {}
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
const mMyLifeTeams = [
	{
		active: true,
		allowCustom: true,
		allowedTypes: ['artworks', 'editor', 'idea', 'library', 'marketing'],
		defaultTypes: ['artworks', 'idea', 'library',],
		description: 'The Creative Team is dedicated to help you experience productive creativity sessions.',
		id: '84aa50ca-fb64-43d8-b140-31d2373f3cd2',
		name: 'creative',
		title: 'Creative',
	},
	{
		active: false,
		allowCustom: false,
		allowedTypes: ['fitness', 'health', 'insurance', 'medical', 'prescriptions', 'yoga', 'nutrition',],
		defaultTypes: ['fitness', 'health', 'medical',],
		description: 'The Health Team is dedicated to help you manage your health and wellness.',
		id: '238da931-4c25-4868-928f-5ad1087a990b',
		name: 'health',
		title: 'Health',
	},
	{
		active: true,
		allowCustom: true,
		allowedTypes: ['diary', 'journaler', 'library', 'personal-biographer',],
		defaultTypes: ['personal-biographer', 'library',],
		description: 'The Memoir Team is dedicated to help you document your life stories, experiences, thoughts, and feelings.',
		id: 'a261651e-51b3-44ec-a081-a8283b70369d',
		name: 'memoir',
		title: 'Memoir',
	},
	{
		active: false,
		allowCustom: true,
		allowedTypes: ['personal-assistant', 'idea', 'note', 'resume', 'scheduler', 'task',],
		defaultTypes: ['personal-assistant', 'resume', 'scheduler',],
		description: 'The Professional Team is dedicated to your professional success.',
		id: '5b7c4109-4985-4d98-b59b-e2c821c3ea28',
		name: 'professional',
		title: 'Professional',
	},
	{
		active: false,
		allowCustom: true,
		allowedTypes: ['connection', 'experience', 'social', 'relationship',],
		defaultTypes: ['connection', 'relationship',],
		description: 'The Social Team is dedicated to help you connect with others.',
		id: 'e8b1f6d0-8a3b-4f9b-9e6a-4e3c5b7e3e9f',
		name: 'social',
		title: 'Social',
	},
	{
		active: false,
		allowCustom: true,
		allowedTypes: ['library', 'note', 'poem', 'quote', 'religion',],
		defaultTypes: ['library', 'quote', 'religion',],
		description: 'The Spirituality Team is dedicated to help you creatively explore your spiritual side.',
		id: 'bea7bb4a-a339-4026-ad1c-75f604dc3349',
		name: 'sprituality',
		title: 'Spirituality',
	},
	{
		active: true,
		allowCustom: true,
		allowedTypes: ['data-ownership', 'investment', 'library', 'ubi',],
		defaultTypes: ['library', 'ubi'],
		description: 'The Universal Basic Income (UBI) Team is dedicated to helping you tailor your MyLife revenue streams based upon consensual access to your personal MyLife data.',
		id: '8a4d7340-ac62-40f1-8c77-f17c68797925',
		name: 'ubi',
		title: 'UBI',
	}
]
const mNewGuid = ()=>Guid.newGuid().toString()
const mPath = './inc/json-schemas'
const mReservedJSCharacters = [' ', '-', '!', '@', '#', '%', '^', '&', '*', '(', ')', '+', '=', '{', '}', '[', ']', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '.', '?', '/', '~', '`']
const mReservedJSWords = ['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'enum', 'await', 'implements', 'package', 'protected', 'interface', 'private', 'public', 'null', 'true', 'false', 'let', 'static']
const mShadows = [
	{
		being: 'shadow',
		categories: ['world events'],
		form: 'story',
		id: 'e3701fa2-7cc8-4a47-bcda-a5b52d3d2e2f',
		name: 'shadow_e3701fa2-7cc8-4a47-bcda-a5b52d3d2e2f',
		proxy: '/shadow',
		text: `What was happening in the world at the time?`,
		type: 'agent',
	},
	{
		being: 'shadow',
		categories: ['personal', 'residence'],
		form: 'story',
		id: '0087b3ec-956e-436a-9272-eceed5e97ad0',
		name: 'shadow_0087b3ec-956e-436a-9272-eceed5e97ad0',
		proxy: '/shadow',
		text: `At the time, I was living at...`,
		type: 'member',
	},
	{
		being: 'shadow',
		categories: ['relations',],
		form: 'story',
		id: '0aac1ca3-a9d2-4587-ad9f-3e85e5391f44',
		name: 'shadow_0aac1ca3-a9d2-4587-ad9f-3e85e5391f44',
		proxy: '/shadow',
		text: `Some people involved were...`,
		type: 'member',
	},
	{
		being: 'shadow',
		categories: ['reflection', 'personal'],
		form: 'story',
		id: '040850c1-9991-46be-b962-8cf4ad9cfb24',
		name: 'shadow_040850c1-9991-46be-b962-8cf4ad9cfb24',
		proxy: '/shadow',
		text: `In hindsight, I wish I had...`,
		type: 'member',
	},
	{
		being: 'shadow',
		categories: ['personal', 'thoughts'],
		form: 'story',
		id: '447b70e7-a443-4165-becf-fbd74265a618',
		name: 'shadow_447b70e7-a443-4165-becf-fbd74265a618',
		proxy: '/shadow',
		text: `I remember thinking...`,
		type: 'member',
	},
	{
		being: 'shadow',
		categories: ['observational', 'objectivity', 'reflection'],
		form: 'story',
		id: '3bfebafb-7e44-4236-86c3-938e2f42fdd7',
		name: 'shadow_e3701fa2-7cc8-4a47-bcda-a5b52d3d2e2f',
		proxy: '/shadow',
		text: `What would a normal person have done in this situation?`,
		type: 'agent',
	},
] // **note**: members use shadows to help them add content to the summaries of their experiences, whereas agents return the requested content
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
const mActorGeneric = await mDataservices.bot(undefined, 'actor')
const mActorQ = await mDataservices.bot(undefined, 'personal-avatar') // little-Q!
const mAlerts = {
	system: await mDataservices.getAlerts(), // not sure if we need other types in global module, but feasibly historical alerts could be stored here, etc.
}
// @todo: capitalize hard-codings as per actual schema classes
const mSchemas = {
	...await mLoadSchemas(),
	dataservices: Dataservices,
	menu: Menu,
	member: Member,
	session: MylifeMemberSession
}
/* module construction functions */
mConfigureSchemaPrototypes()
mPopulateBotInstructions()
/* logging/reporting */
console.log(chalk.bgRedBright('<-----AgentFactory module loaded----->'))
console.log(chalk.greenBright('schema-class-constructs'))
console.log(mSchemas)
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
		else if(directHydration)
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
			?? (await this.dataservices.getAvatar())?.id
			?? (await this.getAvatar())?.id
		return this
	}
	/**
	 * Get a bot, either by id (when known) or bot-type (default=mDefaultBotType). If bot id is not found, then it cascades to the first entity of bot-type it finds, and if none found, and rules allow [in instances where there may be a violation of allowability], a new bot is created.
	 * If caller is `MyLife` then bot is found or created and then activated via a micro-hydration.
	 * @todo - determine if spotlight-bot is required for any animation, or a micro-hydrated bot is sufficient.
	 * @public
	 * @param {string} id - The bot id.
	 * @param {string} type - The bot type.
	 * @param {string} mbr_id - The member id.
	 * @returns {object} - The bot.
	 */
	async bot(id, type=mDefaultBotType, mbr_id){
		if(this.isMyLife){ // MyLife server has no bots of its own, system agents perhaps (file, connector, etc) but no bots yet, so this is a micro-hydration
			if(!mbr_id)
				throw new Error('mbr_id required for BotFactory hydration')
			const botFactory = new BotFactory(mbr_id)
			await botFactory.init()
			botFactory.bot = await botFactory.bot(id, type, mbr_id)
			if(!botFactory?.bot) // create bot on member behalf
				botFactory.bot = await botFactory.createBot({ type: type })
			return botFactory
		}
		return ( await this.dataservices.getItem(id) )
			?? ( await this.dataservices.getItemByField(
					'bot',
					'type',
					type,
					undefined,
					mbr_id
				) )
			?? ( await this.bots(undefined,type)?.[0] )
	}
	/**
	 * Returns bot instruction set.
	 * @public
	 * @param {string} type - The bot type.
	 * @returns {object} - The bot instructions.
	 */
	botInstructions(type='personal-avatar'){
		return mBotInstructions[type]
	}
	/**
	 * Returns bot instructions version.
	 * @param {string} type - The bot type.
	 * @returns {number} - The bot instructions version.
	 */
	botInstructionsVersion(type){
		return mBotInstructions[type]?.version
			?? 1.0
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
	async createBot(assistantData={ type: mDefaultBotType }){
		const bot = await mCreateBot(this.#llmServices, this, assistantData)
		if(!bot)
			throw new Error('bot creation failed')
		return bot
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
	 * Proxy for modular mHelp() function.
	 * @public
     * @param {string} thread_id - The thread id.
     * @param {string} bot_id - The bot id.
     * @param {string} helpRequest - The help request string.
	 * @param {Avatar} avatar - The avatar instance.
	 * @returns {Promise<Object>} - openai `message` objects.
	 */
	async help(thread_id, bot_id, helpRequest, avatar){
		return await mHelp(thread_id, bot_id, helpRequest, this, avatar)
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
							const { mbr_name, newGuid } = this
							const { author=mbr_name, id=newGuid, title=mbr_name, } = story
							story = {
								...story,
								author,
								id,
								title,
							}
							return mInflateLibraryItem(story, updatedLibrary.id, mbr_id)
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
	 * Gets the list of shadows.
	 * @param {Guid} itemId - The itemId (or type?) to filter shadow return.
	 * @returns {object[]} - The shadows.
	 */
	async shadows(itemId){
		return mShadows
	}
	/**
	 * Gets a collection of stories of a certain format.
	 * @todo - currently disconnected from a library, but no decisive mechanic for incorporating library shell.
	 * @param {string} form - The form of the stories to retrieve.
	 * @returns {object[]} - The stories.
	 */
	async stories(form){
		return await this.dataservices.getItemsByFields(
			'story',
			[{ name: '@form', value: form }],
		)
	}
	/**
	 * Gets a MyLife Team by id.
	 * @param {Guid} teamId - The Team id.
	 * @returns {object} - The Team.
	 */
	team(teamId){
		return mMyLifeTeams
			.find(team=>team.id===teamId)
	}
	/**
	 * Retrieves list of MyLife Teams.
	 * @returns {object[]} - The array of MyLife Teams.
	 */
	teams(){
		return mMyLifeTeams.filter(team=>team.active ?? false)
	}
	/**
	 * Adds or updates a bot data in MyLife database. Note that when creating, pre-fill id.
	 * @public
	 * @param {object} bot - The bot data.
	 * @param {object} options - Function options: `{ instructions: boolean, model: boolean, tools: boolean }`. Meant to express whether or not these elements should be refreshed. Useful during updates.
	 * @returns {object} - The Cosmos bot.
	 */
	async updateBot(bot, options){
		return await mUpdateBot(this, this.#llmServices, bot, options)
	}
	/* getters/setters */
	/**
	 * Returns the system actor bot data.
	 * @getter
	 * @returns {object} - The system actor bot data.
	 */
	get actorGeneric(){
		return mActorGeneric
	}
	/**
	 * Returns MyLife _Q_ actor bot data.
	 * @getter
	 * @returns {object} - Q actor bot data.
	 */
	get actorQ(){
		return mActorQ
	}
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
	get memberFirstName(){
		return this.memberName
			?.split(' ')[0]
	}
	get memberName(){
		return this.core.names?.[0]
			?? this.mbr_name
	}
	get newGuid(){
		return mNewGuid()
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
	 * Retrieves all public experiences (i.e., owned by MyLife).
	 * @returns {Object[]} - An array of the currently available public experiences.
	 */
	async availableExperiences(){
		return await mDataservices.availableExperiences()
	}
	/**
	 * Retrieves or creates avatar properties from Member factory dataservices, or inherits the core data from Member class.
	 * @returns {object} - Avatar properties.
	 */
	async avatarProperties(){
		return ( await this.dataservices.getAvatar() )
	}
	/**
	 * Accesses MyLife Dataservices to challenge access to a member's account.
	 * @param {string} mbr_id 
	 * @param {string} passphrase 
	 * @returns {object} - Returns passphrase document if access is granted.
	 */
	async challengeAccess(mbr_id, passphrase){
		return await mDataservices.challengeAccess(mbr_id, passphrase)
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
	async datacore(mbr_id){
		const core = await mDataservices.getItems(
			'core',
			undefined,
			undefined,
			undefined,
			mbr_id,
		)
		return core?.[0]??{}
	}
    /**
     * Delete an item from member container.
     * @param {Guid} id - The id of the item to delete.
     * @returns {boolean} - true if item deleted successfully.
     */
	async deleteItem(id){
		return await this.dataservices.deleteItem(id)
	}
	/**
	 * Retrieves a collection item by Id.
	 * @param {Guid} id - The id of the collection item to retrieve.
	 * @returns {object} - The item.
	 */
	async item(id){
		return await this.dataservices.getItem(id)
	}
	async entry(entry){
		const {
			assistantType='journaler',
			being='entry',
			form='journal',
			keywords=[],
			summary,
			thread_id,
			title='New Journal Entry',
		} = entry
		if(!summary?.length)
			throw new Error('entry summary required')
		const { mbr_id, newGuid: id, } = this
		const name = `entry_${ title.substring(0,64) }_${ mbr_id }_${ id }`
		/* assign default keywords */
		if(!keywords.includes('memory'))
			keywords.push('memory')
		if(!keywords.includes('biographer'))
			keywords.push('biographer')
		const completeEntry = {
			...entry,
			...{
			assistantType,
			being,
			form,
			id,
			keywords,
			mbr_id,
			name,
			summary,
			thread_id,
			title,
		}}
		return await this.dataservices.entry(completeEntry)
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
	 * @returns {Avatar} - The Avatar instance.
	 */
	async getAvatar(){
		const avatar = await ( new Avatar(this, this.#llmServices) )
			.init()
		return avatar
	}
	/**
	 * Generates via personal intelligence, nature of consent/protection around itemId or botId.
	 * @todo - build out consent structure
	 * @param {Guid} id - The id of the item to generate consent for.
	 * @param {Guid} requesting_mbr_id - The id of the member requesting consent.
	 * @returns {object} - The consent object, with parameters or natural language guidelines.
	 */
	async getConsent(id, requesting_mbr_id){
		//	consent is a special case, does not exist in database, is dynamically generated each time with sole purpose of granting access--stored for and in session, however, and attempted access there first... id of Consent should be same as id of object being _request_ so lookup will be straight-forward
		return new (mSchemas.consent)(consent, this)
	}
	/**
	 * Creates the member instance.
	 * @returns {Member} - The member instance.
	 */
	async getMyLifeMember(){
		const member =  await ( new (mSchemas.member)(this) )
			.init()
		return member
	}
	/**
	 * Creates the session instance.
	 * @todo - review this code and architecture.
	 * @returns {Session} - The Session instance.
	 */
	async getMyLifeSession(){
		// default is session based around default dataservices [Maht entertains guests]
		// **note**: consequences from this is that I must be careful to not abuse the module space for sessions, and regard those as _untouchable_
		return await new (mSchemas.session)(
			( new AgentFactory(mPartitionId) ) // no need to init (?)
		).init()
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
	async libraryBot(id){
		return await this.bot(id, 'library')
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
		const { 
			assistantType='biographer-bot',
			being='story',
			form='biographer',
			keywords=[],
			phaseOfLife='unknown',
			summary,
			thread_id,
			title='New Memory Entry',
		} = story
		if(!summary?.length)
			throw new Error('story summary required')
		const { mbr_id, newGuid: id, } = this
		const name = `story_${ title.substring(0,64) }_${ mbr_id }_${ id }`
		/* assign default keywords */
		if(!keywords.includes('memory'))
			keywords.push('memory')
		if(!keywords.includes('biographer'))
			keywords.push('biographer')
		const validatedStory = {
			...story,
			...{
				assistantType,
				being,
				form,
				id,
				keywords,
				mbr_id,
				name,
				phaseOfLife,
				summary,
				thread_id,
				title,
			}}
		return await this.dataservices.story(validatedStory)
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
	 * @param {object} item - The item to update.
	 * @returns {Promise<object>} - The updated item.
	 */
	async updateItem(item){
		const { id, ..._item } = item
		const response = await this.dataservices.patch(id, _item)
		return response
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
	get vectorstoreId(){
		return this.core.vectorstoreId
	}
	set vectorstoreId(vectorstoreId){
		/* validate vectorstoreId */
		if(!vectorstoreId?.length)
			throw new Error('vectorstoreId required')
		this.dataservices.patch(this.core.id, { vectorstoreId, }) /* no await */
		this.core.vectorstoreId = vectorstoreId /* update local */
	}
}
class MyLifeFactory extends AgentFactory {
	#accountCreation
	#dataservices = mDataservices
	#llmServices = mLLMServices
	#registrationData
	constructor(){
		super(mPartitionId)
	} // no init() for MyLife server
	/* public functions */
	/**
	 * Compares registration email against supplied email to confirm `true`. **Note**: does not care if user enters an improper email, it will only fail the encounter, as email structure _is_ confirmed upon initial data write.
	 * @param {string} email - The supplied email to confirm registration.
	 * @param {Guid} registrationId - The registration id.
	 * @returns {boolean} - `true` if registration confirmed.
	 */
	confirmRegistration(email, registrationId){
		if(!this.#registrationData)
			return false
		const { email: registrationEmail, id, } = this.#registrationData
		const confirmed = id===registrationId
			&& typeof email==='string'
			&& typeof registrationEmail==='string' // humor me, as it error-proofs next condition
			&& registrationEmail.toLowerCase()===email.toLowerCase()
		this.#registrationData.confirmed = confirmed
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
			memberAccount,
			success = false
		/* create account core */
		try {
			if(!this.isMyLife) // @stub
				throw new Error('MyLife server required for this request')
			if(!birthdate?.length || !passphrase?.length)
				throw new Error('birthdate _**and**_ passphrase required')
			const { avatarName: _avatarName, email, humanName, id, interests, } = this.#registrationData
			let { updates='', } = this.#registrationData
			if(!id)
				throw new Error('registration not confirmed, cannot accept request')
			if(!humanName)
				throw new Error('member personal name required to create account')
			const avatarId = this.newGuid
			avatarName = _avatarName ?? `${ humanName }-AI`
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
			memberAccount = await this.dataservices.addCore(core)
			this.#registrationData = null
			success = memberAccount.success
			console.log(`MyLife Member Core created for mbr: ${ mbr_id }`, memberAccount)
		} catch(error) { console.log(chalk.blueBright('createAccount()::createCore()::error'), chalk.bgRed(error)) }
		/* create avatar */
		if(success){
			try{
				const { avatar, success: _success, } = await this.dataservices.addAvatar(memberAccount?.core) ?? {}
				const { mbr_id, } = avatar
				success = _success
				console.log(`MyLife Member Avatar created for mbr: ${ mbr_id }`) // then and only then
			} catch(error) { 
				success = false // may have been truthed by _previous_ success
				console.log(chalk.blueBright('createAccount()::createAvatar()::error'), chalk.bgRed(error))
			}
		}
		return success
	}
	createItem(){
		throw new Error('MyLife server cannot create items')
	}
	deleteItem(){
		throw new Error('MyLife server cannot delete items')
	}
	/**
	 * Retrieves member's Avatar data and creates singleton instance.
	 * @returns {Avatar} - The Avatar instance.
	 */
	async getAvatar(){
		const avatar = await ( new Q(this, this.#llmServices) )
			.init()
		return avatar
	}
	/**
	 * Returns Array of hosted members based on validation requirements.
	 * @param {Array} validations - Array of validation strings to filter membership.
	 * @returns {Promise<Array>} - Array of string ids, one for each hosted member.
	 */
	async hostedMembers(validations){
		return await this.#dataservices.hostedMembers(validations)
	}
	/**
	 * Registers a new candidate to MyLife membership
	 * @public
	 * @param {object} candidate { 'avatarName': string, 'email': string, 'humanName': string, }
	 * @returns {object} - The registration document from Cosmos.
	 */
	async registerCandidate(candidate){
		return await this.#dataservices.registerCandidate(candidate)
	}
	updateItem(){
		throw new Error('MyLife server cannot update items')
	}
    /**
     * Validate registration id.
     * @param {Guid} validationId - The registration id.
     * @returns {Promise<object>} - Registration data from system datacore.
     */
	async validateRegistration(registrationId){
		if(!registrationId?.length)
			throw new Error('registration id required')
		let registration,
			success = false
		try{
			registration = await this.dataservices.validateRegistration(registrationId)
			const { id, } = registration
			if(id===registrationId){
				success = true
				this.#registrationData = registration
				setTimeout(timeout=>{ // Set a timeout to clear the data after 5 minutes (300000 milliseconds)
					this.#registrationData = null
				}, 5 * 60 * 1000)
			}
		} catch(error){
			this.#registrationData = null
			console.log(chalk.blueBright(`validateRegistration(${ registrationId })::error`))
		}
		return this.#registrationData
	}
	/* getters/setters */
    /**
     * Test whether avatar session is creating an account.
     * @getter
     * @returns {boolean} - Avatar is in `accountCreation` mode (true) or not (false).
     */
    get isCreatingAccount(){
        return this.#registrationData?.confirmed===true
    }
    /**
     * Test whether factory is currently `validating` a session.
     * @getter
     * @returns {boolean} - Avatar is in `registering` mode (true) or not (false).
     */
    get isValidating(){
		return this.#registrationData?.validated===true && !this.#registrationData?.confirmed
    }
	get registrationData(){
		return this.#registrationData
	}
	get registrationId(){
		return this.#registrationData?.id
	}
}
// private module functions
/**
 * Initializes openAI assistant and returns associated `assistant` object.
 * @module
 * @param {LLMServices} llmServices - OpenAI object
 * @param {object} bot - The assistand data object
 * @returns {object} - [OpenAI assistant object](https://platform.openai.com/docs/api-reference/assistants/object)
 */
async function mAI_openai(llmServices, bot){
    const { bot_name, type, } = bot
	bot.name = bot_name
		?? `My ${ type }`
    return await llmServices.createBot(bot)
}
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
 * @module
 * @private
 * @param {LLMServices} llm - OpenAI object
 * @param {AgentFactory} factory - Agent Factory object
 * @param {object} assistantData - Bot object
 * @param {string} avatarId - Avatar id
 * @returns {string} - Bot assistant id in openAI
*/
async function mCreateBotLLM(llm, assistantData){
    const llmResponse = await mAI_openai(llm, assistantData)
    return llmResponse.id
}
/**
 * Creates bot and returns associated `bot` object.
 * @todo - assistantData.name = botDbName should not be required, push logic to `llm-services`
 * @module
 * @async
 * @private
 * @param {LLMServices} llm - LLMServices Object contains methods for interacting with OpenAI
 * @param {BotFactory} factory - BotFactory object
 * @param {object} bot - Bot object, must include `type` property.
 * @returns {object} - Bot object
*/
async function mCreateBot(llm, factory, bot){
	/* initial deconstructions */
	const { bot_name: botName, description: botDescription, name: botDbName, type, } = bot
	const { avatarId, } = factory
	/* validation */
	if(!avatarId)
		throw new Error('avatar id required to create bot')
	/* constants */
	const bot_name = botName
		?? `My ${ type }`
	const description = botDescription
		?? `I am a ${ type } for ${ factory.memberName }`
	const { instructions, version, } = mCreateBotInstructions(factory, bot)
	const model = process.env.OPENAI_MODEL_CORE_BOT
		?? process.env.OPENAI_MODEL_CORE_AVATAR
		?? 'gpt-4o'
	const name = botDbName
		?? `bot_${ type }_${ avatarId }`
	const { tools, tool_resources, } = mGetAIFunctions(type, factory.globals, factory.vectorstoreId)
	const id = factory.newGuid
	const assistantData = {
		being: 'bot',
		bot_name,
		description,
		id,
		instructions,
		metadata: { externalId: id, },
		model,
		name,
		object_id: avatarId,
		provider: 'openai',
		purpose: description,
		tools,
		tool_resources,
		type,
		version,
	}
	/* create in LLM */
	const botId = await mCreateBotLLM(llm, assistantData) // create after as require model
	if(!botId)
		throw new Error('bot creation failed')
	/* create in MyLife datastore */
	assistantData.bot_id = botId
	const assistant = await factory.dataservices.createBot(assistantData)
	console.log(chalk.green(`bot created::${ type }`), assistant)
	return assistant
}
/**
 * Returns MyLife-version of bot instructions.
 * @module
 * @private
 * @param {BotFactory} factory - Factory object
 * @param {object} bot - Bot object
 * @returns {object} - minor 
 */
function mCreateBotInstructions(factory, bot){
	if(typeof bot!=='object' || !bot.type?.length)
		throw new Error('bot object required, and  requires `type` property')
	const { type=mDefaultBotType, } = bot
    let { instructions, version, } = factory.botInstructions(type)
    if(!instructions) // @stub - custom must have instruction loophole
		throw new Error(`bot instructions not found for type: ${ type }`)
    let { general, purpose, preamble, prefix, references=[], replacements=[], } = instructions
    /* compile instructions */
    switch(type){
		case 'diary':
		case 'journaler':
            instructions = purpose
				+ prefix
                + general
			break
        case 'personal-avatar':
            instructions = preamble
                + general
            break
        case 'personal-biographer':
            instructions = preamble
                + purpose
                + prefix
                + general
            break
        default:
            instructions = general
            break
    }
    /* apply replacements */
    replacements.forEach(replacement=>{
        const placeholderRegExp = factory.globals.getRegExp(replacement.name, true)
        const replacementText = eval(`bot?.${replacement.replacement}`)
			?? eval(`factory?.${replacement.replacement}`)
            ?? eval(`factory.core?.${replacement.replacement}`)
            ?? replacement?.default
            ?? '`unknown-value`'
        instructions = instructions.replace(placeholderRegExp, _=>replacementText)
    })
    /* apply references */
    references.forEach(_reference=>{
        const _referenceText = _reference.insert
        const replacementText = eval(`factory?.${_reference.value}`)
            ?? eval(`bot?.${_reference.value}`)
            ?? _reference.default
            ?? '`unknown-value`'
        switch(_reference.method??'replace'){
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
    return { instructions, version, }
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
function mGenerateClassFromSchema(_schema) {
	const { name, properties } = _schema
	const _classCode = mGenerateClassCode(name, properties)
	const _class = mCompileClass(name, _classCode)
	return _class
}
/**
 * Retrieves any functions that need to be attached to the specific bot-type.
 * @todo - move to llmServices
 * @param {string} type - Type of bot.
 * @param {object} globals - Global functions for bot.
 * @param {string} vectorstoreId - Vectorstore id.
 * @returns {object} - OpenAi-ready object for functions { tools, tool_resources, }.
 */
function mGetAIFunctions(type, globals, vectorstoreId){
	let includeSearch=false,
		tool_resources,
		tools = []
	switch(type){
		case 'diary':
		case 'journaler':
			tools.push(globals.getGPTJavascriptFunction('entrySummary'))
			includeSearch = true
			break
		case 'personal-assistant':
		case 'personal-avatar':
			includeSearch = true
			break
		case 'personal-biographer':
			tools.push(
				globals.getGPTJavascriptFunction('storySummary'),
				globals.getGPTJavascriptFunction('getSummary'),
				globals.getGPTJavascriptFunction('updateSummary')
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
 * Take help request about MyLife and consults appropriate engine for response.
 * @requires mLLMServices - equivalent of default MyLife dataservices/factory
 * @param {string} thread_id - The thread id.
 * @param {string} bot_id - The bot id.
 * @param {string} helpRequest - The help request string.
 * @param {AgentFactory} factory - The AgentFactory object; **note**: ensure prior that it is generic Q-conversation.
 * @param {Avatar} avatar - The avatar instance.
 * @returns {Promise<Object>} - openai `message` objects.
 */
async function mHelp(thread_id, bot_id, helpRequest, factory, avatar){
	const response = await mLLMServices.help(thread_id, bot_id, helpRequest, factory, avatar)
	return response
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
 * @module
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
	const instructionSets = await mDataservices.botInstructions()
	instructionSets
		.forEach(instructionSet=>{
			const { type, } = instructionSet
			mBotInstructions[type] = instructionSet
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
 * Updates bot in Cosmos, and if necessary, in LLM.
 * @param {AgentFactory} factory - Factory object
 * @param {LLMServices} llm - LLMServices object
 * @param {object} bot - Bot object, winnow via mBot in `mylife-avatar.mjs` to only updated fields
 * @param {object} options - Options object: { instructions: boolean, model: boolean, tools: boolean }
 * @returns 
 */
async function mUpdateBot(factory, llm, bot, options={}){
	/* constants */
	const {
		id, // no modifications; see below
		instructions: removeInstructions,
		tools: removeTools,
		tool_resources: removeResources,
		type, // no modifications
		...botData // extract member-driven bot data
	} = bot
	const {
		instructions: updateInstructions=false,
		model: updateModel=false,
		tools: updateTools=false,
	} = options
	if(!factory.globals.isValidGuid(id))
		throw new Error('bot `id` required in bot argument: `{ id: guid }`')
	if(updateInstructions){
		const { instructions, version=1.0, } = mCreateBotInstructions(factory, bot)
		botData.instructions = instructions
		botData.version = version /* omitted from llm, but appears on updateBot */
	}
	if(updateTools){
		const { tools, tool_resources, } = mGetAIFunctions(type, factory.globals, factory.vectorstoreId)
		botData.tools = tools
		botData.tool_resources = tool_resources
	}
	if(updateModel)
		botData.model = factory.globals.currentOpenAIBotModel
	botData.id = id // validated
	/* LLM updates */
	const { bot_id, bot_name: name, instructions, metadata, tools, } = botData
	if(bot_id?.length && (instructions || metadata || name || tools)){
		botData.model = factory.globals.currentOpenAIBotModel // not dynamic
		await llm.updateBot(botData)
		const updatedLLMFields = Object.keys(botData)
			.filter(key=>key!=='id' && key!=='bot_id') // strip mechanicals
		console.log(chalk.green('mUpdateBot()::update in LLM'), bot_id, id, updatedLLMFields)
	}
	const updatedBot = await factory.dataservices.updateBot(botData)
	return updatedBot
}
/* final constructs relying on class and functions */
// server build: injects default factory into _server_ **MyLife** instance
const _MyLife = await new MyLife(
	new MyLifeFactory()
)
	.init()
/* exports */
export default _MyLife