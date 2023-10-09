// imports
import fs from 'fs'
import EventEmitter from 'events'
import vm from 'vm'
import { Guid } from 'js-guid'	//	Guid.newGuid().toString()
import chalk from 'chalk'
import Dataservices from './mylife-data-service.js'
import { Agent, Member, MyLife } from './core.js'
import Menu from './menu.js'
import MylifeMemberSession from './session.js'
import Router from './routes.js'
import { _ } from 'ajv'
//	variables
const _excludeProperties = { '$schema': true, '$id': true, '$defs': true, "$comment": true, "name": true }	//	global object keys to exclude from class creations [hash tables fastest way to lookup items]
//	Factory singleton class
//	understands the construction of the schemas and their build implementation
//	could introduce factory pattern to instantiate the schemas
class Factory extends EventEmitter {
	#excludeProperties = _excludeProperties
	//	#excludeConstructors = { 'id': true }
	#path = './inc/json-schemas'
	#schemas	//	when deployed, check against the current prod schemas
	constructor() {
		super()	//	needed for EventEmitter
		this.#schemas = { ...this.#loadSchemas(), ...{ agent: Agent, dataservices: Dataservices, menu: Menu, member: Member, router: Router,server: MyLife, session: MylifeMemberSession } }
		console.log(chalk.yellow('global-schema-classes-created:'),this.#schemas)
	}
	//	public functions
	//	getters/setters
	get #Agent(){	//	call for class version
		return this.#schemas.agent
	}
	get agent(){
		return async (_agent,_member)=>{
			return await new (this.#Agent)(_agent,_member)
		}
	}
	get #Board(){	//	call for class version
		return this.#schemas.board
	}
	get board(){
		return async (_board)=>{
			return await new (this.#Board)(_board)
		}
	}
	get #Dataservices(){
		return this.#schemas.dataservices
	}
	get dataservices(){
		return async (_mbr_id)=>{	//	menu requires an agent
			return await new (this.#Dataservices)(_mbr_id)
		}
	}
	get Member(){	//	call for class version
		return this.#schemas.member
	}
	get #Menu(){
		return this.#schemas.menu
	}
	get menu(){
		return async (_mbr_id)=>{	//	menu requires an agent
			return await new (this.#Menu)().init(_mbr_id)
		}
	}
	get newGuid(){	//	this.newGuid
		return Guid.newGuid().toString()
	}
	get schemaList(){	//	array description of this.#schemas object
		return Object.keys(this.#schemas)
	}
	get #Router(){
		return this.#schemas.router
	}
	get router(){
		return async (_agent)=>{
			return await new (this.#Router)(_agent)
		}
	}
	get #Server(){
		return this.#schemas.server
	}
	get server(){
		return async (_mbr_id,_Factory)=>{
			return await (new (this.#Server)(	//	send dataservice and factory
				await new (this.#schemas.dataservices)(_mbr_id).init(),
				_Factory,
			))
		}
	}
	get #Session(){
		return this.#schemas.session
	}
	get session(){
		return async (_mbr_id,_Factory,_fxValidate,ctx)=>{
			return await new (this.#Session)(_mbr_id,_Factory,_fxValidate,ctx)
		}
	}
	//	private functions
	#assignClassPropertyValues(_propertyDefinition,_schema){	//	need schema in case of $def
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
	#compileClass(_className, classCode) {
		// Create a global vm context and run the class code in it
		const context = vm.createContext({
			exports: {},
			console: console,
			import: async _module => await import(_module),
//			utils: utils,
//			sharedData: sharedData,
//			customModule: customModule,
//			eventEmitter: EventEmitter,
		})
		vm.runInContext(classCode, context)
		// Return the compiled class
		return context.exports[_className]
	}
	#generateClassCode(_className,_properties,_schema){
		//	delete known excluded _properties in source
		for(const _prop in _properties){
			if(_prop in this.#excludeProperties){ delete _properties[_prop] }
		}
		// Generate class
		let classCode = `
// Code will run in vm and pass back class
class ${_className} {
	// private properties
	#excludeConstructors = ${ '['+Object.keys(this.#excludeProperties).map(key => "'" + key + "'").join(',')+']' }
	#globals
	#name
`
		for (const _prop in _properties) {	//	assign default values as animated from schema
			const _value = this.#assignClassPropertyValues(_properties[_prop],_schema)
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
			console.log('vm class: ${ _className } constructed')
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
	#generateClassFromSchema(_schema) {
		//	get core class
		const _className = _schema.name
		const _properties = _schema.properties
		const _classCode = this.#generateClassCode(_className,_properties,_schema)
		//	compile class and return
		return this.#compileClass(_className,_classCode)
	}
	#loadSchemas() {
		const _filesArray = fs.readdirSync(this.#path)
			.filter(_filename => _filename.split('.')[1] === 'json')
			.map(_filename => {
				const _file = fs.readFileSync(this.#path + '/' + _filename, 'utf8')
				const _classArray = []
				const _fileData = JSON.parse(_file)
				_classArray.push({ [_filename.split('.')[0]]: this.#generateClassFromSchema(_fileData) })
			if (_fileData?.$defs) {
				for (const _schema in _fileData.$defs) {
					_classArray.push({ [_schema]: this.#generateClassFromSchema(_fileData.$defs[_schema]) })
				}
			}
			return _classArray
		})

		const _obj = _filesArray.reduce((acc, array) => {
			return Object.assign(acc, ...array)
		}, {})

		return _obj
	}
}
function assignProperties(_source,_destination,_exclusions=_){	//	assigns database values to class properties
		Object.entries(_source)	//	array of arrays
			.filter((_prop)=>{	//	filter out excluded properties
				const _charExlusions = ['_','@','$','%','!','*',' ']
				return !(
						(_prop[0] in _exclusions)
					||	!(_charExlusions.indexOf(_prop[0].charAt()))
				)
				})
			.forEach(_prop=>{	//	map property to this-scope
				//	console.log(chalk.yellow('assigning property:'),_prop[0])
				_destination[_prop[0]] = _prop[1]	//	assign property at root of _destination
			})
	}
//	exports
export {
	assignProperties,
	Factory,
} 