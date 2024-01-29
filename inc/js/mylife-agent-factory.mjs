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
} from './factory-class-extenders/class-extenders.mjs'	//	do not remove, although they are not directly referenced, they are called by eval in configureSchemaPrototypes()
import Menu from './menu.mjs'
import MylifeMemberSession from './session.mjs'
import chalk from 'chalk'
import { _ } from 'ajv'
/* modular constants */
// global object keys to exclude from class creations [apparently fastest way in js to lookup items, as they are hash tables]
const mBotInstructions = {}
const mPartitionId = process.env.MYLIFE_SERVER_MBR_ID
const mDataservices = await new Dataservices(mPartitionId).init()
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
configureSchemaPrototypes()
/* logging/reporting */
console.log(chalk.bgRedBright('<-----AgentFactory module loaded----->'))
console.log(chalk.greenBright('schema-class-constructs'))
console.log(schemas)
/* modular classes */
class AgentFactory extends EventEmitter{
	#dataservices
	#exposedSchemas = getExposedSchemas(['avatar','agent','consent','consent_log','relationship'])	//	run-once 'caching' for schemas exposed to the public, args are array of key-removals; ex: `avatar` is not an open class once extended by server
	#mbr_id
	constructor(_mbr_id){
		super()
		this.#mbr_id = _mbr_id
		if(this.mbr_id===mPartitionId)
			this.#dataservices = mDataservices
		else
			console.log(chalk.blueBright('AgentFactory class constructed:'),chalk.bgBlueBright(this.mbr_id))
	}
	/* public functions */
	/**
	 * Initialization routine required for all AgentFactory instances save MyLife server
	 * @param {Guid} _mbr_id 
	 * @returns {AgentFactory} this
	 */
	async init(_mbr_id){
		if(!_mbr_id) // ergo, MyLife does not must not call init()
			throw new Error('no mbr_id on Factory creation init')
		this.#mbr_id = _mbr_id
		if(this.mbr_id!==mPartitionId){
			this.#dataservices = await new Dataservices(this.mbr_id)
				.init()
		}
		return this
	}
	/**
	 * Get a bot.
	 * @public
	 * @param {string} _bot_id - The bot id.
	 * @returns {object} - The bot.
	 */
	async bot(_bot_id){
		return await this.dataservices.getItem(_bot_id)
	}
	/**
	 * Returns bot instruction set.
	 * @modular
	 * @public
	 * @param {AgentFactory} _factory 
	 * @param {string} _type
	 */
	async botInstructions(_type){
		if(!_type) throw new Error('bot type required')
		if(!mBotInstructions[_type]){
			const _instructionSet = await mDataservices.botInstructions(_type)
			if(!_instructionSet?.length) throw new Error(`no bot instructions found for ${_type}`)
			mBotInstructions[_type] = _instructionSet[0]
		}
		return mBotInstructions[_type]
	}
	/**
	 * Gets a member's bots.
	 * @public
	 * @param {string} _object_id - The _object_id guid of avatar.
	 * @returns {array} - The member's hydrated bots.
	 */
	async bots(_object_id){
		// @todo: develop bot class and implement instance
		const _bots = await this.dataservices.getItems(
			'bot',
			undefined,
			_object_id?.length ? [{ name: '@object_id', value:_object_id }] : undefined,
		)
		return _bots
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
	 * @returns {Avatar} - The avatar.
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
	 * Registers a new candidate to MyLife membership
	 * @public
	 * @param {object} _candidate { 'email': string, 'humanName': string, 'avatarNickname': string }
	 */
	async registerCandidate(_candidate){
		return await this.dataservices.registerCandidate(_candidate)
	}
	/**
	 * Adds or updates a bot.
	 * @public
	 * @param {object} _bot - bot data.
	 */
	async setBot(_bot){
		return await this.dataservices.setBot(_bot)
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
	 * Submits a timeline to MyLife. Currently via API, but could be also work internally.
	 * @param {object} _timeline - Timeline object { assistantType, being, id, mbr_id, name, timeline }.
	 * @returns {object} - The timeline document from Cosmos.
	 */
	async timeline(_timeline){
		return await this.dataservices.timeline(_timeline)
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
	get core(){
		return this.dataservices.core
	}
	get dataservices(){
		return this.#dataservices
	}
	get factory(){	//	get self
		return this
	}
	get file(){
		return this.schemas.file
	}
	get globals(){
		return this.dataservices.globals
	}
	/**
	 * Returns whether or not the factory is the MyLife server, as various functions are not available to the server and some _only_ to the server.
	 * @returns {boolean}
	*/
	get isMyLife(){
		return this.mbr_id===mPartitionId
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
	get message(){
		return this.schemas.message
	}
	get MyLife(){	//	**caution**: returns <<PROMISE>>
		return this.getMyLife()
	}
	get newGuid(){
		return this.globals.newGuid
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
async function configureSchemaPrototypes(){	//	add required functionality as decorated extension class
	for(const _className in schemas){
		//	global injections; maintained _outside_ of eval class
		Object.assign(
			schemas[_className].prototype,
			{ sanitizeValue: sanitizeValue },
		)
		schemas[_className] = extendClass(schemas[_className])
	}
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