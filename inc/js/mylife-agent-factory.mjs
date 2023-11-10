//	imports
import { promises as fs } from 'fs'
import EventEmitter from 'events'
import vm from 'vm'
import chalk from 'chalk'
import { Guid } from 'js-guid'	//	usage = Guid.newGuid().toString()
import Globals from './globals.mjs'
import Dataservices from './mylife-data-service.js'
import { Member, MyLife } from './core.mjs'
import Menu from './menu.js'
import MylifeMemberSession from './session.js'
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
// modular variables
let oServer
// modular classes
class AgentFactory extends Globals{
	#dataservices
	constructor(){
		super()
		this.#dataservices = oDataservices
	}
	//	public functions
	async init(){
		oServer = await new MyLife(oDataservices,this).init()
		return this
	}
	async getMyLifeMember(_mbr_id){
		const _r =  await new (schemas.member)(await new (schemas.dataservices)(_mbr_id).init(),this)
			.init()
		return _r
	}
	async getMyLifeSession(_challengeFunction){
		//	default is session based around default dataservices [Maht entertains guests]
		return await new (schemas.session)(dataservicesId,this,_challengeFunction).init()
	}
	//	getters/setters
	get dataservices(){
		return this.#dataservices
	}
	get organization(){
		return organization
	}
	get organization(){
		return oServer
	}
	get schemas(){
		return schemas
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
		for(const _class in this.schema){
			switch (_class) {
				case 'agent':
					this.schema[_class].prototype.testPrototype = _=>{ return 'agent' }
					break
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