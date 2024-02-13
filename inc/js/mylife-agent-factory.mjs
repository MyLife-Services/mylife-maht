//	imports
import OpenAI from 'openai'
import { promises as fs } from 'fs'
import EventEmitter from 'events'
import vm from 'vm'
import util from 'util'
import { Guid } from 'js-guid'	//	usage = Guid.newGuid().toString()
import Dataservices from './mylife-data-service.js'
import { Member, MyLife } from './core.mjs'
import {
	extendClass_avatar,
	extendClass_consent,
	extendClass_contribution,
    extendClass_conversation,
    extendClass_file,
	extendClass_message,
} from './factory-class-extenders/class-extenders.mjs'	//	do not remove, although they are not directly referenced, they are called by eval in mConfigureSchemaPrototypes()
import Menu from './menu.mjs'
import MylifeMemberSession from './session.mjs'
import chalk from 'chalk'
import { _ } from 'ajv'
/* modular constants */
// global object keys to exclude from class creations [apparently fastest way in js to lookup items, as they are hash tables]
const mBotInstructions = {}
const mPartitionId = process.env.MYLIFE_SERVER_MBR_ID
const mDataservices = await new Dataservices(mPartitionId).init()
const mDefaultBotType = 'personal-avatar'
const mExtensionFunctions = {
    extendClass_avatar: extendClass_avatar,
	extendClass_consent: extendClass_consent,
	extendClass_contribution: extendClass_contribution,
	extendClass_conversation: extendClass_conversation,
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
const mNewGuid = ()=>Guid.newGuid().toString()
const mOpenAI = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_API_CHAT_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
const mPath = './inc/json-schemas'
const vmClassGenerator = vm.createContext({
	exports: {},
	console: console,
	import: async _module => await import(_module),
//	utils: utils,
//	sharedData: sharedData,
//	customModule: customModule,
//	eventEmitter: EventEmitter,
})
/* dependent constants */
const _alerts = {
	system: await mDataservices.getAlerts(), // not sure if we need other types in global modular, but feasibly historical alerts could be stored here, etc.
}
const schemas = {
	...await loadSchemas(),
	dataservices: Dataservices,
	menu: Menu,
	member: Member,
	session: MylifeMemberSession
}
mConfigureSchemaPrototypes()
mPopulateBotInstructions()
/* logging/reporting */
console.log(chalk.bgRedBright('<-----AgentFactory module loaded----->'))
console.log(chalk.greenBright('schema-class-constructs'))
console.log(schemas)
/* modular classes */
class BotFactory extends EventEmitter{
	// micro-hydration version of factory for use _by_ the MyLife server
	#dataservices
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
	 * Initialization routine required for all bot instances.
	 * @param {Guid} _mbr_id 
	 * @returns {AgentFactory} this
	 */
	async init(){
		this.#dataservices = new Dataservices(this.mbr_id)
		await this.#dataservices.init()
		this.core.avatar_id = this.core?.avatar_id ?? (await this.dataservices.getAvatar()).id
		return this
	}
	/**
	 * Get a bot, either by id (when known) or bot-type (default=mDefaultBotType). If bot id is not found, then it cascades to the first entity of bot-type it finds, and if none found, and rules allow [in instances where there may be a violation of allowability], a new bot is created.
	 * If caller is `MyLife` then bot is found or created and then activated via a micro-hydration.
	 * @todo - determine if spotlight-bot is required for any animation, or a micro-hydrated bot is sufficient.
	 * @public
	 * @param {string} _bot_id - The bot id.
	 * @param {string} _bot_type - The bot type.
	 * @returns {object} - The bot.
	 */
	async bot(_bot_id, _bot_type=mDefaultBotType, _mbr_id){
		if(this.isMyLife){ // MyLife server has no bots of its own, system agents perhaps (file, connector, etc) but no bots yet, so this is a micro-hydration
			console.log(chalk.yellowBright('locating member bot...'), _bot_type, _mbr_id, _bot_id)
			if(!_mbr_id)
				throw new Error('mbr_id required for BotFactory hydration')
			const _botFactory = new BotFactory(_mbr_id)
			await _botFactory.init()
			_botFactory.bot = await _botFactory.bot(_bot_id, _bot_type, _mbr_id)
			if(!_botFactory?.bot){ // create bot on member behalf
				console.log(chalk.magenta(`bot hydration-create::${_bot_type}`))
				// do not need intelligence behind this object yet, for that, spotlight is a mini-avatar
				_botFactory.bot = await _botFactory.setBot({ type: _bot_type })
			}
			// rather than just a bot in this event, return micro-hydrated bot (mini-avatar ultimately)
			return _botFactory
		}
		return ( await this.dataservices.getItem(_bot_id) )
			?? ( await this.dataservices.getItemByField(
					'bot',
					'type',
					_bot_type,
					undefined,
					_mbr_id
				) )
			?? ( await this.bots(undefined,_bot_type)?.[0] )
	}
	/**
	 * Returns bot instruction set.
	 * @public
	 * @param {string} _type
	 */
	botInstructions(_type){
		if(!_type) throw new Error('bot type required')
		if(!mBotInstructions[_type]){
			if(!_instructionSet) throw new Error(`no bot instructions found for ${_type}`)
			mBotInstructions[_type] = _instructionSet
		}
		return mBotInstructions[_type]
	}
	/**
	 * Gets a member's bots.
	 * @public
	 * @param {string} _object_id - The _object_id guid of avatar.
	 * @param {string} _bot_type - The bot type.
	 * @returns {array} - The member's hydrated bots.
	 */
	async bots(_object_id, _bot_type){
		// @todo: develop bot class and implement instance
		const _params = _object_id?.length
			? [{ name: '@object_id', value:_object_id }]
			: _bot_type?.length
				? [{ name: '@bot_type', value:_bot_type }]
				: undefined
		const _bots = await this.dataservices.getItems(
			'bot',
			undefined,
			_params,
		)
		return _bots
	}
	async createBot(_bot={ type: mDefaultBotType }){
		_bot.id = this.newGuid
		return mCreateBot(this, _bot)
	}
	/**
	 * Gets, creates or updates Library in Cosmos.
	 * @todo - institute bot for library mechanics.
	 * @public
	 * @param {Object} _library - The library object, including items to be added to/updated in member's library.
	 * @returns {object} - The library.
	 */
	async library(_library){
		const _updatedLibrary = await mLibrary(this, _library)
		// test the type/form of Library
		switch(_updatedLibrary.type){
			case 'story':
				if(_updatedLibrary.form==='biographer'){
					// inflate and update library with stories
					const _stories = ( await this.stories(_updatedLibrary.form) )
						.filter(_story=>!this.globals.isValidGuid(_story?.library_id))
						.map(_story=>{
							_story.id = _story.id??this.newGuid
							_story.author = _story.author??this.mbr_name
							_story.title = _story.title??_story.id
							return mInflateLibraryItem(_story, _updatedLibrary.id, this.mbr_id)
						})
					_updatedLibrary.items = [
						..._updatedLibrary.items,
						..._stories,
					]
					/* update stories (no await) */
					_stories.forEach(_story=>this.dataservices.patch(
						_story.id,
						{ library_id: _updatedLibrary.id },
					))
					/* update library (no await) */
					this.dataservices.patch(
						_updatedLibrary.id,
						{ items: _updatedLibrary.items },
					)
				}
				break
			default:
				break
		}
		return _updatedLibrary
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
	get core(){
		return this.dataservices.core
	}
	get dataservices(){
		return this.#dataservices
	}
	get factory(){	//	get self
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
}
class AgentFactory extends BotFactory{
	#exposedSchemas = getExposedSchemas(['avatar','agent','consent','consent_log','relationship'])	//	run-once 'caching' for schemas exposed to the public, args are array of key-removals; ex: `avatar` is not an open class once extended by server
	constructor(_mbr_id){
		super(_mbr_id, false)
	}
	/* public functions */
	/**
	 * Initialization routine required for all AgentFactory instances save MyLife server.
	 * @returns {AgentFactory} this
	 */
	async init(){
		if(mIsMyLife(_mbr_id))
			throw new Error('MyLife server AgentFactory cannot be initialized, as it references modular dataservices on constructor().')
		await super.init()
		return this
	}
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
		const _alert = _alerts.system.find(alert => alert.id === _alert_id)
		return _alert ? _alert : await mDataservices.getAlert(_alert_id)
	}
	/**
	 * Returns all alerts of a given type, currently only _system_ alerts are available. Refreshes by definition from the database.
	 * @param {string} _type 
	 * @returns {array} array of current alerts
	 */
	async getAlerts(_type){
		const _systemAlerts = await this.dataservices.getAlerts()
		_alerts.system = _systemAlerts
		return this.alerts
	}
	/**
	 * Constructs and returns an Avatar instance.
	 * @returns {Avatar} - The Avatar instance.
	 */
	async getAvatar(){
		// get avatar from dataservices
		let _avatarProperties = await this.dataservices.getAvatar()
		_avatarProperties = {..._avatarProperties??this.core, proxyBeing: this.isMyLife ? 'MyLife' : 'human' }
		const _avatar = await new (schemas.avatar)(_avatarProperties,this).init()
		return _avatar
	}
	async getMyLife(){	//	get server instance
		//	ensure that factory mbr_id = dataservices mbr_id
		if(this.mbr_id!==mPartitionId)
			throw new Error('unauthorized request')
		return await new (schemas.server)(this).init()
	}
	async getMyLifeMember(){
		const _r =  await new (schemas.member)(this)
			.init()
		return _r
	}
	async getMyLifeSession(){
		// default is session based around default dataservices [Maht entertains guests]
		// **note**: conseuquences from this is that I must be careful to not abuse the modular space for sessions, and regard those as _untouchable_
		return await new (schemas.session)(
			( new AgentFactory(mPartitionId) ) // no need to init currently as only pertains to non-server adjustments
			// I assume this is where the duplication is coming but no idea why
		).init()
	}
	async getConsent(_consent){
		//	consent is a special case, does not exist in database, is dynamically generated each time with sole purpose of granting access--stored for and in session, however, and attempted access there first... id of Consent should be same as id of object being _request_ so lookup will be straight-forward
		//	@todo: not stored in cosmos (as of yet, might be different container), so id can be redundant
		return new (schemas.consent)(_consent, this)
	}
	async getContributionQuestions(_being, _category){
		return await mDataservices.getContributionQuestions(_being, _category)
	}
	isAvatar(_avatar){	//	when unavailable from general schemas
		return (_avatar instanceof schemas.avatar)
	}
	isConsent(_consent){	//	when unavailable from general schemas
		return (_consent instanceof schemas.consent)
	}
	isSession(_session){	//	when unavailable from general schemas
		return (_session instanceof schemas.session)
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
	 * @param {object} _candidate { 'email': string, 'humanName': string, 'avatarNickname': string }
	 */
	async registerCandidate(_candidate){
		return await this.dataservices.registerCandidate(_candidate)
	}
	/**
	 * Submits a story to MyLife. Currently via API, but could be also work internally.
	 * @param {object} _story - Story object { assistantType, being, form, id, mbr_id, name, summary }.
	 * @returns {object} - The story document from Cosmos.
	 */
	async story(_story){
		return await this.dataservices.story(_story)
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
		return _alerts.system
	}
	get contribution(){
		return this.schemas.contribution
	}
	get conversation(){
		return this.schemas.conversation
	}
	get file(){
		return this.schemas.file
	}
	get message(){
		return this.schemas.message
	}
	get MyLife(){	//	**caution**: returns <<PROMISE>>
		return this.getMyLife()
	}
	get organization(){
		return this.schemas.organization
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
	get server(){
		return this.schemas.server
	}
	get urlEmbeddingServer(){
		return process.env.MYLIFE_EMBEDDING_SERVER_URL+':'+process.env.MYLIFE_EMBEDDING_SERVER_PORT
	}
}
// private modular functions
function assignClassPropertyValues(_propertyDefinition,_schema){	//	need schema in case of $def
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
function mBytes(_object){
	return util.inspect(_object).length
}
function compileClass(_className, classCode) {
	// Create a global vm context and run the class code in it
	vm.runInContext(classCode, vmClassGenerator)
	// Return the compiled class
	return vmClassGenerator.exports[_className]
}
async function mConfigureSchemaPrototypes(){	//	add required functionality as decorated extension class
	for(const _className in schemas){
		//	global injections; maintained _outside_ of eval class
		Object.assign(
			schemas[_className].prototype,
			{ sanitizeValue: sanitizeValue },
		)
		schemas[_className] = extendClass(schemas[_className])
	}
}
/**
 * Creates bot and returns associated `bot` object.
 * @modular
 * @private
 * @param {BotFactory} _factory - BotFactory object
 * @param {object} _bot - Bot object, must include `type` property.
 * @returns {object} - Bot object
*/
function mCreateBot(_factory, _bot){
	// create gpt
	const _description = _bot.description??`I am a ${_bot.type} bot for ${_factory.memberName}`
	const _instructions = _bot.instructions??mCreateBotInstructions(_factory, _bot.type)
	const _botName = _bot.bot_name??_bot.name??_bot.type
	const _cosmosName = _bot.name??`bot_${_bot.type}_${_factory.avatarId}`
	if(!_factory?.avatarId) throw new Error('avatar id required to create bot')
	const _botData = {
		being: 'bot',
		bot_name: _botName,
		description: _description,
		instructions: _instructions,
		model: process.env.OPENAI_MODEL_CORE_BOT,
		name: _cosmosName,
		object_id: _factory.avatarId,
		provider: 'openai',
		purpose: _description,
		type: _bot.type,
	}
	return _botData
}
/**
 * Returns MyLife-version of bot instructions.
 * @modular
 * @private
 * @param {BotFactory} _factory - Factory object
 * @param {object} _bot - Bot object
 * @returns {string} - flattened string of instructions
 */
function mCreateBotInstructions(_factory, _type=mDefaultBotType){
    let _botInstructionSet = _factory.botInstructions(_type) // no need to wait, should be updated or refresh server
    _botInstructionSet = _botInstructionSet?.instructions
    if(!_botInstructionSet) throw new Error(`bot instructions not found for type: ${_type}`)
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
        const _placeholderRegExp = _factory.globals.getRegExp(_replacement.name, true)
        const _replacementText = eval(`_factory?.${_replacement.replacement}`)
            ?? eval(`_bot?.${_replacement.replacement}`)
            ?? _replacement?.default
            ?? '`unknown-value`'
        _botInstructions = _botInstructions.replace(_placeholderRegExp, () => _replacementText)
    })
    /* apply references */
    _botInstructionSet.references = _botInstructionSet?.references??[]
    _botInstructionSet.references.forEach(_reference=>{
        const _referenceText = _reference.insert
        const _replacementText = eval(`_factory?.${_reference.value}`)
            ?? eval(`_bot?.${_reference.value}`)
            ?? _reference.default
            ?? '`unknown-value`'
        switch(_reference.method??'replace'){
            case 'append-hard':
                console.log('append-hard::_botInstructions', _referenceText, _replacementText)
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
function extendClass(_class) {
	const _className = _class.name.toLowerCase()
	if (typeof mExtensionFunctions?.[`extendClass_${_className}`]==='function'){
		console.log(`Extension function found for ${_className}`)
		//	add extension decorations
		const _references = { openai: mOpenAI }
		_class = mExtensionFunctions[`extendClass_${_className}`](_class,_references)
	}
	return _class
}
function generateClassCode(_className,_properties,_schema){
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
		const _value = sanitizeValue(assignClassPropertyValues(_properties[_prop],_schema))
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
get ${_prop}() {
	return this.#${_prop}
}
set ${_prop}(_value) {	// setter with type validation
	if (typeof _value !== '${_type}') {
		if(!('${_type}'==='array' && Array.isArray(_value))){
			throw new Error('Invalid type for property ${_prop}: expected ${_type}')
		}
	}
	if( this?.#${_prop} ) this.#${_prop} = _value
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
function generateClassFromSchema(_schema) {
	//	get core class
	const _className = _schema.name
	const _properties = _schema.properties	//	wouldn't need sanitization, as refers to keys
	const _classCode = generateClassCode(_className,_properties,_schema)
	//	compile class and return
	return compileClass(_className,_classCode)
}
function getExposedSchemas(_factoryBlockedSchemas){
	const _systemBlockedSchemas = ['dataservices','session']
	return Object.keys(schemas)
		.filter(key => !_systemBlockedSchemas.includes(key) && !_factoryBlockedSchemas.includes(key))
		.reduce((obj, key) => {
			obj[key] = schemas[key]
			return obj
		}, {})
}
/**
 * Inflates library item with required values and structure. Object structure expected from API, librayItemItem in JSON.
 * root\inc\json-schemas\bots\library-bot.json
 * @param {object} _item - Library item (API) object. { author: string, enjoymentLevel: number, format: string, insights: string, personalImpact: string, title: string, whenRead: string }
 * @param {string} _library_id - Library id
 * @param {string} _mbr_id - Member id
 * @returns 
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
 * @param {BotFactory} _factory - BotFactory object
 * @param {object} _library - Library object
 * @returns {object} - Library object
 */
async function mLibrary(_factory, _library){
	// @todo: micro-avatar for representation of bot(s)
	// @todo: Bot class with extension for things like handling libraries
	// @todo: bot-extenders so that I can get this functionality into that object context
	/* constants */
	const { assistantType, form='collection', id, items: _libraryItems=[], mbr_id, type } = _library
	const _avatar_id = _factory.avatarId
	// add/get correct library; default to core (object_id=avatar_id && type)
	/* parse and cast _libraryItems */
	let _libraryCosmos = await _factory.dataservices.library(id, _avatar_id, type, form)
	// @dodo: currently only book/story library items are supported
	if(!_libraryCosmos){ // create when undefined
		// @todo: microbot should have a method for these
		const _library_id = _factory.newGuid
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
		_factory.dataservices.pushItem(_libraryCosmos) // push to Cosmos
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
					id: _storedLibraryItems[matchIndex].id??_factory.newGuid, // if for some reason object hasn't id
					object_id: _library_id,
					type: _item.type??'book',
				}
			} else {
				_storedLibraryItems.push({ // If no match is found, add the item to the library
					..._item,
					id: _item.id??_factory.newGuid, // Ensure each item has a unique ID
					mbr_id: _factory.mbr_id,
					object_id: _library_id,
					type: _item.type??'book',
				})
			}
		})
		// save library to Cosmos @todo: microbot should have a method for this
		_libraryCosmos.items = _storedLibraryItems
		_factory.dataservices.patch(_library_id, {items: _libraryCosmos.items})
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
async function loadSchemas() {
	try{
		let _filesArray = await (fs.readdir(mPath))
		_filesArray = _filesArray.filter(_filename => _filename.split('.')[1] === 'json')
		const schemasArray = await Promise.all(
			_filesArray.map(
				async _filename => {
					const _file = await fs.readFile(`${mPath}/${_filename}`, 'utf8')
					const _fileContent = JSON.parse(_file)
					const _classArray = [{ [_filename.split('.')[0]]: generateClassFromSchema(_fileContent) }]
					if (_fileContent.$defs) {
						for (const _schema in _fileContent.$defs) {
							_classArray.push({ [_schema]: generateClassFromSchema(_fileContent.$defs[_schema]) })
						}
					}
					return _classArray
				}
			)
		)
		return schemasArray.reduce((acc, array) => Object.assign(acc, ...array), {})
	} catch(err){
		console.log(err)
		if(schemasArray) console.log(schemasArray)
	}
}
async function mPopulateBotInstructions(){
	const _botInstructionSets = await mDataservices.botInstructions()
	_botInstructionSets.forEach(_instructionSet=>{
		mBotInstructions[_instructionSet.type] = _instructionSet
	})
}
function sanitizeValue(_value) {
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