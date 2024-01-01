//	imports
import EventEmitter from 'events'
import OpenAI from 'openai'
import chalk from 'chalk'
//	import { _ } from 'ajv'
//	server-specific imports
import initRouter from './routes.js'
import { _ } from 'ajv'
// config
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
//	define export Classes for Members and MyLife
class Member extends EventEmitter {
	#avatar
	#avatars = []
	#categories = [
		'Abilities',
		'Artifacts',
		'Beliefs',
		'Biography',
		'Challenges',
		'Future',
		'Goals',
		'Health',
		'Identity',
		'Interests',
		'Outlook',
		'Personality',
		'Preferences',
		'Relationships',
		'Sexuality',
		'Updates'
	]	//	base human categories [may separate into biological?ideological] of personal definitions for inc q's (per agent) for infusion
	#factory	//	reference to session factory in all cases except for server/root MyLife/Q
	#personalityKernal
	constructor(_Factory){
		super()
		this.#personalityKernal = openai	//	will be covered in avatars
		this.#factory = _Factory
		/* assign factory/avatar listeners */
		this.attachListeners()
	}
	/**
	 * Initializes Member class instantiation and returns `this`
	 * @async
	 * @public
	 * @returns {Promise} Promise resolves to this Member class instantiation
	 */
	async init(){
		this.#avatars = await this.factory.getAvatars()	//	defaults to `this.core` which factory owns; **note**: getAvatars() normally accepts the object dna
		if(!this.#avatars.length)
			console.log(chalk.red('no avatars found'))	//	create avatar
		const _avatarProperties = {
			...this?.avatars[0]??this.core,
			proxyBeing: this.being,
		}
		this.avatar = await this.factory
			.getAvatar(undefined,_avatarProperties)	//	not pulling from db
		return this
	}
	/**
	 * Attaches listeners to Member class instantiation
	 * @publc must remain public in order to be overridden
	 * @returns {void} returns nothing
	*/
	attachListeners(){
		this.factory.on('avatar-init-end',(_avatar,bytes)=>{
			console.log(chalk.grey(`Member::init::avatar-init-end|memory-size=${bytes}b`))
		})
		this.factory.on('on-contribution-new',(_contribution)=>{
			console.log(chalk.grey(`Member::on-contribution-new`),_contribution.request)
		})
	}
	//	getter/setter functions
	get abilities(){
		return this.core.abilities
	}
	get agent(){
		return this.#avatar
	}
	get agentCategories(){
		return this.agent.categories
	}
	get agentCommand(){
		return this.agent.command_word
	}
	get agentDescription(){	//	agent description (not required)
		if(!this.agent?.description)
			this.avatar.description = `I am ${ this.agentName }, AI-Agent for ${ this.name }`
		return this.agent.description
	}
	get agentName(){
		return this.avatar.names[0]
	}
	get agentProxy(){
		switch(this.form){	//	need switch because I could not overload class function
			case 'organization':
				return this.description
			default:
				return this.bio
		}
	}
	get avatar(){
		return this.#avatar
	}
	set avatar(_Avatar){
		//	oops, hack around how to get dna of avatar class; review options [could block at factory-getter level, most efficient and logical]
		if(!this.factory.isAvatar(_Avatar))
			throw new Error('avatar requires Avatar Class')
		this.#avatar = _Avatar
	}
	get avatars(){
		return this.#avatars
	}
	/**
	 * Gets being type. Members are _only_ human prototypes, and presents as human, even though the current manifestation is a datacore `core` being.
	 * @returns {string} returns 'human'
	*/
	get being(){
		return 'human'
	}
	get beliefs(){
		return this.core.beliefs
	}
	get bio(){
		return this.core.bio
	}
	get categories(){
		return this.agent.categories
	}
	get chat(){
		return this.agent.chat
	}
	get consent(){
		return this.factory.consent	//	**caution**: returns <<PROMISE>>
	}
	set consent(_consent){
		this.factory.consents.unshift(_consent.id)
	}
	/**
	 * Gets Member Contributions, i.e., questions that need posing to Member
	 * @returns {array} returns array of Member Contributions
	 */
	get contributions(){
		return this.#avatar?.contributions
	}
	get core(){
		return this.factory.core
	}
	get dataservice(){
		return this.dataservices
	}
	get dataservices(){
		return this.factory.dataservices
	}
	get description(){
		return this.core.description
	}
	get email(){
		return this.core.email
	}
	get factory(){
		return this.#factory
	}
	get facts(){
		return this.core.facts
	}
	get form(){
		return this.core.form
	}
	get globals(){
		return this.factory.globals
	}
	get hobbies(){
		return this.core.hobbies
	}
	get interests(){
		return this.core.interests
	}
	get id(){
		return this.sysid
	}
	get mbr_id(){
		return this.factory.mbr_id
	}
	get member(){
		return this.core
	}
	get memberName(){
		return this.core.names[0]
	}
	get name(){
		return this.core.name
	}
	get newGuid(){
		return this.globals.newGuid
	}
	get personality(){
		return this.#personalityKernal
	}
	get preferences(){
		return this.core.preferences
	}
	get skills(){
		return this.core.skills
	}
	get sysname(){
		return this.mbr_id.split('|')[0]
	}	
	get sysid(){
		return this.mbr_id.split('|')[1]
	}
	get values(){
		return this.core.values
	}
	//	public functions
	async setAvatar(_avatar){	//	whether new or existing, _avatar is an object
		const _a = this.#avatars
			?.filter(_=>{ return _.id === _avatar.id })[0]
			??null
		if(!_a || !_a.length){	//	if no avatar found, push generated avatar
			_a = await this.factory.pushItem(_avatar)
			this.#avatars.push(_a)
		}
	}
	async testEmitters(){
		//	test emitters with callbacks
		this.emit('testEmitter',_response=>{
			console.log('callback emitters enabled:',_response)
		})
	}
}
class Organization extends Member {	//	form=organization
	#Menu
	#Router
	constructor(_Factory){
		super(_Factory)
	}
	/* public functions */
	async init(){
		return await super.init()
	}
	/**
	 * `Member` Overload
	 * @publc must remain public in order to be overridden
	 * @returns {void} returns nothing
	*/
	attachListeners(){
		// intentionally empty
	}
	/* getters/setters */
	/**
	 * Gets being type. MyLife are _only_ MyLife prototypes, and presents as mylife, even though the current manifestation is a datacore `core` being.
	 * @returns {string} returns 'MyLife'
	*/
	get being(){
		return 'MyLife'
	}
	get description(){
		return this.core.description
	}
	get governance(){
		return this.core.governance
	}
	get membership(){
		return this.core.membership
	}
	get menu(){
		if(!this.#Menu){
			this.#Menu = new (this.factory.schemas.menu)(this).menu
		}
		return this.#Menu
	}
	get mission(){
		return this.core.mission
	}
	get name(){
		return this.core.names[0]
	}
	get philosophy(){
		return this.core.philosophy
	}
	get privacy(){
		return this.core.privacy
	}
	get roadmap(){
		return this.core.roadmap
	}
	get router(){
		if(!this.#Router){
			this.#Router = initRouter(new (this.factory.schemas.menu)(this))
		}
		return this.#Router
	}
	get security(){
		return this.core.security
	}
	get services(){
		return this.core.services
	}
	get values(){
		return this.core.values
	}
	get vision(){
		return this.core.vision
	}
}
class MyLife extends Organization {	//	form=server
	constructor(_Factory){	//	no session presumed to exist
		super(_Factory)
	}
	/* public functions */
	/**
	 * Registers a new candidate to MyLife membership
	 * @public
	 * @param {object} _candidate { 'email': string, 'humanName': string, 'avatarNickname': string }
	 */
	async registerCandidate(_candidate){
		return await this.factory.registerCandidate(_candidate)
	}
	async getMyLifeSession(){
		return await this.factory.getMyLifeSession()
	}
	/* getters/setters */
	/**
	 * Gets MyLife agent role, refers to server entity Maht/MyLife
	 * @returns {object} returns { role: 'system', content: 'I am <||Q||>, AI-Agent for the nonprofit member organization MyLife' }
	*/
	get agentRole(){
		switch(this.being){
			default:	//	core
				const replacedDescription = 'I am <||Q||>, AI-Agent for the nonprofit member organization MyLife'
				return {
						role: "system",
						content: replacedDescription
					}					
		}
	}
	/**
	 * Gets being type. MyLife are _only_ MyLife prototypes, and presents as mylife, even though the current manifestation is a datacore `core` being.
	 * @returns {string} returns 'MyLife'
	*/
	get being(){
		return 'MyLife'
	}
}
/* exports */
export {
	Member,
	Organization,
	MyLife,
}