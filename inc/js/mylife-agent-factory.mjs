//	imports
import OpenAI from 'openai'
import { Marked } from 'marked'
import { promises as fs } from 'fs'
import EventEmitter from 'events'
import vm from 'vm'
import { Guid } from 'js-guid'	//	usage = Guid.newGuid().toString()
import Globals from './globals.mjs'
import Dataservices from './mylife-data-service.js'
import { Member, MyLife } from './core.mjs'
import Menu from './menu.js'
import MylifeMemberSession from './session.js'
import { _ } from 'ajv'
// modular constants
// global object keys to exclude from class creations [apparently fastest way in js to lookup items, as they are hash tables]
const excludeProperties = { '$schema': true, '$id': true, '$defs': true, "$comment": true, "name": true }
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
const schemas = {
	...await loadSchemas(),
	dataservices: Dataservices,
	menu: Menu,
	member: Member,
	server: MyLife,
	session: MylifeMemberSession
}
const _Globals = new Globals()
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
// config: add functionality to known prototypes
configureSchemaPrototypes()
// modular variables
let oServer
// modular classes
class AgentFactory extends EventEmitter{
	#dataservices
	#mbr_id
	constructor(_mbr_id=dataservicesId){
		super()
		//	if incoming member id is not same as id on oDataservices, then ass new class-private dataservice
		this.#mbr_id = _mbr_id
	}
	//	public functions
	async init(){
		this.#dataservices = 
			(this.mbr_id!==oDataservices.mbr_id)
			?	await new Dataservices(dataservicesId).init()
			:	oDataservices
		if(!oServer) oServer = await new MyLife(this).init()
		return this
	}
	async getAvatar(_agent_id){
		//	get avatar template for metadata from cosmos
		const _avatarProperties = await this.dataservices.getAgent(this.globals.extractId(this.mbr_id))
		//	activate (created inside if necessary) avatar
		const _avatar = new (this.schemas.avatar)(_avatarProperties)
		//	assign function activateAssistant() to this new class
		if(!_avatar.assistant) await _avatar.getAssistant(this.dataservices)
		const _ = {
			id: 'thread_WU0OZOSQheyfQrfnwwuaTBTY',
			object: 'thread',
			created_at: 1700337778,
			metadata: {}
		  }
		_avatar.thread = _	//	temp config to avoid external ping
//		if(!_avatar.thread) await _avatar.getThread()	//	also populates internal property: `thread`
		return _avatar
	}
	async getMyLifeMember(_mbr_id){
		const _r =  await new (schemas.member)(await new (schemas.dataservices)(_mbr_id).init(),this)
			.init()
		return _r
	}
	async getMyLifeSession(_challengeFunction){
		//	default is session based around default dataservices [Maht entertains guests]
		return await new (schemas.session)(dataservicesId,_Globals,_challengeFunction).init()
	}
	//	getters/setters
	get core(){
		const _excludeProperties = { '_none':true }
		console.log('dataservices', this.#dataservices)
		let _core = Object.entries(this.#dataservices.core)	//	array of arrays
			.filter((_prop)=>{	//	filter out excluded properties
				const _charExlusions = ['_','@','$','%','!','*',' ']
				return !(
						(_prop[0] in _excludeProperties)
					||	!(_charExlusions.indexOf(_prop[0].charAt()))
				)
				})
			.map(_prop=>{	//	map to object
				return { [_prop[0]]:_prop[1] }
			})
		_core = Object.assign({},..._core)	//	merge to single object
		
		return _core
	}
	get dataservices(){
		return this.#dataservices
	}
	get _factory(){
		return this
	}
	get factory(){	//	get self
		return JSON.toString(this)
	}
	get file(){
		return schemas.file
	}
	get globals(){
		return _Globals
	}
	get mbr_id(){
		return this.#mbr_id
	}
	get organization(){
		return organization
	}
	get organization(){
		return oServer
	}
	get schema(){	//	proxy for schemas
		return this.schemas
	}
	get schemaList(){	//	proxy for schemas
		return Object.keys(this.schemas)
	}
	get schemas(){
		return schemas
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
	function compileClass(_className, classCode) {
		// Create a global vm context and run the class code in it
		vm.runInContext(classCode, vmClassGenerator)
		// Return the compiled class
		return vmClassGenerator.exports[_className]
	}
	async function configureSchemaPrototypes(){	//	add functionality to known prototypes
		for(const _class in schemas){
			switch (_class) {
				case 'agent':
					schemas[_class].prototype.testPrototype = _=>{ return 'agent' }
					break
				case 'avatar':
					//	based on avatar.type, could assign different prototypes
					Object.assign(schemas[_class].prototype, {
						async cancelRun(_run_id){	//	returns openai run object
							return await openai.beta.threads.runs.cancel(
								this.thread.id,
								_run_id
							)
						},
						async chatRequest(_ctx){
							//	now consolidated in architecture for openai assistants
							//	assign files and metadata, optional
							//	create message
							const _message = await this.setMessage({content: _ctx.request.body.message})
							//	create local message model and add to this.messages
							this.messages.unshift(
								new (schemas.message)(_message)
							)
							//	run thread
							await this.run()
							//	get message data from thread
							const _responses = (await this.getMessages())
								.filter(
									_msg=>{ return _msg.run_id==this.runs[0].id }
								)
							this.messages.unshift(..._responses)	//	post each response to this.messages
							//	update cosmos
							//	build out
							//	return response
							return _responses
								.map(_msg=>{
									return new Marked().parse(this.getMessageContent(_msg))
								})
								.join('\n')
						},
						async checkStatus(_thread_id,_run_id,_callInterval){
							//	should be able to remove params aside from _callInterval, as they are properties of this
							const _run = await openai.beta.threads.runs.retrieve(
								_thread_id,
								_run_id
							)
							switch(_run.status){
								//	https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
								case 'completed':
									if(!this?.runs[0]?.id === _run_id) this.runs.unshift(_run)	//	add
									else this.runs[0] = _run	//	update
									return true
								case 'failed':
								case 'cancelled':
								case 'expired':
									return false
								case 'queued':
								case 'requires_action':
								case 'in_progress':
								case 'cancelling':
								default:
									console.log(`...${_run.status}:${_thread_id}...`)
									break
							}
						},
						async completeRun(_run_id){
							return new Promise((resolve, reject) => {
								const checkInterval = setInterval(async () => {
									try {
										const status = await this.checkStatus(this.thread.id, _run_id)
										if (status) {
											clearInterval(checkInterval)
											resolve('Run completed')
										}
									} catch (error) {
										clearInterval(checkInterval)
										reject(error)
									}
								}, 700)
								// Set a timeout to resolve the promise after 12 seconds
								setTimeout(() => {
									clearInterval(checkInterval)
									resolve('Run completed (timeout)')
								}, 12000)
							})
						},
						async getAssistant(_dataservice){	//	openai `assistant` object
							if(!this.openai_assistant_id) {
								const _core = {
									name: this?.names[0]??this.name,
									model: process.env.OPENAI_MODEL_CORE,
									description: this.description,
									instructions: this.purpose,
									metadata: {
										...Object.entries(this.categories)
											.filter(([key, value]) => this[value.replace(' ', '_').toLowerCase()]?.length)
											.slice(0, 16)
											.reduce((obj, [key, value]) => ({
												...obj,
												[value]: this[value.replace(' ', '_').toLowerCase()],
											}), {})
									},
									file_ids: [],	//	no files at birth, can be added later
									tools: [],	//	only need tools if files
								}
								this.assistant = await openai.beta.assistants.create(_core)
								this.openai_assistant_id = this.assistant.id
								//	save id to cosmos
								_dataservice.patch(this.id, { openai_assistant_id: this.openai_assistant_id })
							}
							else this.assistant = await openai.beta.assistants.retrieve(this.openai_assistant_id)
						},
						async getMessage(_msg_id){	//	returns openai `message` object
							if(!this.thread) await this.getThread()
							return this.messages.data.filter(_msg=>{ return _msg.id==_msg_id })
						},
						getMessageContent(_msg){
							//	flatten content array
							return _msg.content
								.map(
									_content=>{ 
										switch(_content.type){
											case 'image_file':
												//	build-out
												return
											case 'text':
											default:
												return _content.text.value
											}
										}
								)
								.join('\n')
						},
						async getMessages(){
							if(!this.thread) await this.getThread()
							this.messages = ( await openai.beta.threads.messages.list(
								this.thread.id
							) )	//	extra parens to resolve promise
								.data
							return this.messages
						},
						async getRun(_run_id){	//	returns openai `run` object
							return this.runs.filter(_run=>{ return _run.id==_run_id })
						},
						async getRuns(){	//	runs are also descending
							if(!this.thread) await this.getThread()
							if(!this.runs){
								this.runs = await openai.beta.threads.runs.list(this.thread.id)
								//	need to winnow to mapped array?
							}
						},
						async getRunStep(_run_id,_step_id){
							//	pull from known runs
							return this.runs
								.filter(_run=>{ return _run.id==_run_id })
								.steps
									.filter(_step=>{ return _step.id==_step_id })
						},
						async getRunSteps(_run_id){
							//	always get dynamically
							const _run = this.runs.filter(_run=>{ return _run.id==_run_id })
							_run.steps = await openai.beta.threads.runs.steps.list(this.thread.id, _run.id)
						},
						async getThread(){
							if(!this.thread) this.thread = await openai.beta.threads.create()
							return this.thread
						},
						async run(){
							const _run = await this.startRun()
							if(!_run) throw new Error('Run failed to start')
							this.runs = this?.runs??[]	//	once begun, ought complete even if failed
							this.runs.unshift(_run)
							// ping status
							await this.completeRun(_run.id)
						},
						async setMessage(_message){	//	add or update message; returns openai `message` object
							if(!this.thread) await this.getThread()
							return (!_message.id)
								?	await openai.beta.threads.messages.create(	//	add
									this.thread.id,
									{
										role: "user",
										content: _message.content
									}
								)
								:	await openai.beta.threads.messages.update(	//	update
										this.thread.id,
										_message.id,
										{
											role: "user",
											content: _message.content
										}
									)
						},
						async startRun(){	//	returns openai `run` object
							if(!this.thread || !this.messages.length) return
							return await openai.beta.threads.runs.create(
								this.thread.id,
								{ assistant_id: this.openai_assistant_id }
							)
						}
					})
					break
				case 'message':
					Object.defineProperty(
						schemas[_class].prototype,
						'_content',
						{
							get: function() {
								switch (this.type) {
									case 'chat':
										switch (this.system) {
											case 'openai-assistant':
												return this.content[0].text.value
											default:
												break
										}
									default:
										return 'no content derived'
								}
							}
						})
				case 'core':
				default:	//	core
					break
			}
		}
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
#globals
#name
`
	for (const _prop in _properties) {	//	assign default values as animated from schema
		const _value = assignClassPropertyValues(_properties[_prop],_schema)
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
				eval(\`this.\${_key}=obj[_key]\`)	//	implicit getters/setters
			}
		}
		console.log('vm ${ _className } class constructed')
	} catch(err) {
		console.log(\`FATAL ERROR CREATING \${obj.being}\`)
		console.log(err)
		throw(err)
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
	this.#${_prop} = _value
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
	const _properties = _schema.properties
	const _classCode = generateClassCode(_className,_properties,_schema)
	//	compile class and return
	return compileClass(_className,_classCode)
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
		console.log(err,schemasArray)
	}
}
//	exports
export default AgentFactory