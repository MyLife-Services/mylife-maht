//	imports
import OpenAI from 'openai'
import { promises as fs } from 'fs'
import EventEmitter from 'events'
import vm from 'vm'
import util from 'util'
import { Guid } from 'js-guid'	//	usage = Guid.newGuid().toString()
import Globals from './globals.mjs'
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
import Menu from './menu.js'
import MylifeMemberSession from './session.js'
import chalk from 'chalk'
import { _ } from 'ajv'
// modular constants
// global object keys to exclude from class creations [apparently fastest way in js to lookup items, as they are hash tables]
const excludeProperties = {
	$schema: true,
	$id: true,
	$defs: true,
	$comment: true,
	definitions: true,
	name: true
}
const path = './inc/json-schemas'
const vmClassGenerator = vm.createContext({
	exports: {},
	console: console,
	import: async _module => await import(_module),
//	utils: utils,
//	sharedData: sharedData,
//	customModule: customModule,
//	eventEmitter: EventEmitter,
})
const dataservicesId = process.env.MYLIFE_SERVER_MBR_ID
const oDataservices = await new Dataservices(dataservicesId).init()
// Object of registered extension functions
const oExtensionFunctions = {
    extendClass_avatar: extendClass_avatar,
	extendClass_consent: extendClass_consent,
	extendClass_contribution: extendClass_contribution,
	extendClass_conversation: extendClass_conversation,
	extendClass_file: extendClass_file,
	extendClass_message: extendClass_message,
}
const schemas = {
	...await loadSchemas(),
	dataservices: Dataservices,
	menu: Menu,
	member: Member,
	session: MylifeMemberSession
}
const _Globals = new Globals()
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_API_CHAT_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
// config: add functionality to known prototypes
configureSchemaPrototypes()
//	logging/reporting
console.log(chalk.bgRedBright('<-----AgentFactory module loaded----->'))
console.log(chalk.greenBright('schema-class-constructs'))
console.log(schemas)
// modular classes
class AgentFactory extends EventEmitter{
	#dataservices
	#exposedSchemas = getExposedSchemas(['avatar','agent','consent','consent_log','relationship'])	//	run-once 'caching' for schemas exposed to the public, args are array of key-removals; ex: `avatar` is not an open class once extended by server
	#mbr_id
	constructor(_mbr_id){
		super()
		this.#mbr_id = _mbr_id
		if(this.mbr_id===dataservicesId)
			this.#dataservices = oDataservices
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
		if(this.mbr_id!==dataservicesId){
			this.#dataservices = await new Dataservices(this.mbr_id)
				.init()
		}
		return this
	}
	async challengeAccess(_passphrase){
		//	always look to server to challenge Access; this may remove need to bind
		return await oDataservices.challengeAccess(this.mbr_id,_passphrase)
	}
	/**
	 * Gets factory to product appropriate avatar
	 * @param {Guid} _avatar_id 
	 * @param {object} _avatarProperties 
	 * @returns 
	 */
	async getAvatar(_avatar_id, _avatarProperties,){	//	either send list of properties (pre-retrieved for example from core `this.#avatars`) of known avatar or original object properties that are going to be initially infused into the generated agent; for example, I am a book, and user/gpt have determined that a book (new dynamic object, unknown to schemas) should have a super-intelligence - _that_ book core is sent in _avatarProperties and will imprinted into the initial avatar version of object
		//	factory determines whether to create or retrieve
		if(!_avatar_id && !_avatarProperties)
			throw new Error('no avatar id or properties')
		_avatarProperties = (_avatar_id)
			?	await this.dataservices.getAvatar(_avatar_id)	//	retrieve properties from Cosmos
			:	(_avatarProperties?.id && _avatarProperties?.being==='avatar')
				?	_avatarProperties	//	already an avatar
				:	await this.#addAvatar( this.core )//_avatarProperties)	//	add avatar to Cosmos
		//	enact, instantiate and activate avatar, all under **factory** purview
		const _Avatar = new (schemas.avatar)(_avatarProperties, this)
		/* assign listeners */
		_Avatar.on('on-contribution-new',_contribution=>{
			this.emit('on-contribution-new',_contribution)
		})
		_Avatar.on('avatar-init-end',_avatar=>{
			this.emit('avatar-init-end',_avatar,mBytes(_avatar))
		})
		await _Avatar.init()
		return _Avatar
	}
	async getAvatars(_object_id=this.mbr_id_id){
		const _avatars = await this.dataservices.getAvatars(_object_id)	//	returns array of _unclassed_, _uninstantiated_ js objects reflecting the core data _of_ a MyLife avatar; perhaps sometimes that inner reflection is all that is needed, such as what is stored as the active avatar inside the requestor
		return _avatars
	}
	async getMyLife(){	//	get server instance
		//	ensure that factory mbr_id = dataservices mbr_id
		if(this.mbr_id!==dataservicesId)
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
			( new AgentFactory(dataservicesId) ) // no need to init currently as only pertains to non-server adjustments
			// I assume this is where the duplication is coming but no idea why
		).init()
	}
	async getConsent(_consent){
		//	consent is a special case, does not exist in database, is dynamically generated each time with sole purpose of granting access--stored for and in session, however, and attempted access there first... id of Consent should be same as id of object being _request_ so lookup will be straight-forward
		//	not stored in cosmos (as of yet, might be different container), so id can be redundant
		console.log('factory.getConsent():108', _consent)
		console.log('factory.getConsent():109', 'mbr_id', this.mbr_id)
		
		return new (schemas.consent)(_consent, this)
	}
	async getContributionQuestions(_being, _category){
		return await oDataservices.getContributionQuestions(_being, _category)
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
	//	getters/setters
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
		return _Globals
	}
	/**
	 * Returns whether or not the factory is the MyLife server, as various functions are not available to the server and some _only_ to the server.
	 * @returns {boolean}
	*/
	get isMyLife(){
		return this.mbr_id===dataservicesId
	}
	get mbr_id(){
		return this.#mbr_id
	}
	get mbr_id_id(){
		return this.globals.extractId(this.mbr_id)
	}
	get mbr_name(){
		return this.globals.extractSysName(this.mbr_id)
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
	//	private functions
	async #addAvatar(_avatarProperties){	//	adds avatar to Cosmos _only_ does not animate or assign animation (unless somehow specified in properties)
		//	validate required avatarProperties
		if(!_avatarProperties.mbr_id)
			throw new Error('requires mbr_id as member reference')
		const _avatar_objectId = _avatarProperties?.object_id??_avatarProperties?.parent_id??_avatarProperties?.id
		if(!_avatar_objectId)
			throw new Error('requires object_id as avatar data reference')
		if(!_avatarProperties?.names??_avatarProperties?.name)
			throw new Error('name or names required to construct avatar')
		if(!_avatarProperties?.categories?.length)
			throw new Error('malformed object--no data categories')
		//	set defaults
		const _avatar_being = _avatarProperties?.being === 'core' ? 'human' : (_avatarProperties?.being ?? 'unknownObject')
		const _avatar_categories = _avatarProperties.categories
			.map(category => category.replace(/ /g, '_'))
		const _avatar_name = _avatarProperties?.names[0]??_avatarProperties?.name??_avatar_being
		//	contribute context awareness properties to avatarProperties
		const __avatarProperties = {
			being: 'avatar',
			categories: _avatar_categories,
			context: `This avatar assistant was generated by the MyLife Member Services Platform for Member: ${ this.mbr_id } to assist with the herein metadata-identified purpose using initial categories: ${ JSON.stringify(_avatar_categories) }`,
			id: this.globals.newGuid,
			mbr_id: _avatarProperties.mbr_id,
			metadata: {},
			names: [..._avatarProperties?.names??[_avatar_name]],
			object_being: _avatar_being,
			object_id: _avatar_objectId,
			purpose: `I am ${_avatar_name}, a MyLife avatar superintelligence created to comprehensively understand, faithfully represent and intelligently evolve the dataset for my underlying object type: ${_avatarProperties?.being??'unknownObject'}, whose core data was initially represented inside me.`,
		}
		//	assign categories to metadata [10x(/16) maximum]
		//	TODO: ensure we don't have underscore/space problems
		const _categories = _avatar_categories
			.reduce((acc, _category) => {
				acc[_category] = _avatarProperties?.[_category]
					?? _avatarProperties?.[_category.replace(/_/g, ' ')]
					?? '';
				return acc
			}, {})
		//	assign local and systenm defaults to metadata [6x(/16) maximum]
		__avatarProperties.metadata={
			...__avatarProperties.metadata,
			..._categories,
			purpose: __avatarProperties.purpose,
			context: __avatarProperties.context,
			categories: __avatarProperties.categories.join(','),
			updates: ''
		}
		const _avatar = new (schemas.avatar)(__avatarProperties)
		_avatar.metadata.description = _avatar.description
		//	TODO: remove requirement for name to be generated later
		_avatar.name = `avatar_${_avatar_being}_${_avatar_name.split('_')[0]}`
		//	add avatar to database
		return await this.dataservices.addAvatar(_avatar.avatar)
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
	if (typeof oExtensionFunctions?.[`extendClass_${_className}`]==='function'){
		console.log(`Extension function found for ${_className}`)
		//	add extension decorations
		const _references = { openai: openai }
		_class = oExtensionFunctions[`extendClass_${_className}`](_class,_references)
	}
	return _class
}
function generateClassCode(_className,_properties,_schema){
	//	delete known excluded _properties in source
	for(const _prop in _properties){
		if(_prop in excludeProperties){ delete _properties[_prop] }
	}
	// Generate class
	let classCode = `
// Code will run in vm and pass back class
class ${_className} {
// private properties
#excludeConstructors = ${ '['+Object.keys(excludeProperties).map(key => "'" + key + "'").join(',')+']' }
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
		let _filesArray = await (fs.readdir(path))
		_filesArray = _filesArray.filter(_filename => _filename.split('.')[1] === 'json')
		const schemasArray = await Promise.all(
			_filesArray.map(
				async _filename => {
					const _file = await fs.readFile(`${path}/${_filename}`, 'utf8')
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
	new AgentFactory(dataservicesId)
)
	.init()
/* exports */
export default _MyLife