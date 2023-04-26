// imports
import { promises as fs } from 'fs'
import EventEmitter from 'events'
import vm from 'vm'
import { Guid } from 'js-guid'	//	Guid.newGuid().toString()
import chalk from 'chalk'
// core class
class Globals extends EventEmitter {
	#excludeProperties = { '$schema': true, '$id': true, '$defs': true, "$comment": true, "name": true }	//	global object keys to exclude from class creations [apparently fastest way in js to lookup items, as they are hash tables]
	#excludeConstructors = { 'id': true }
	#path = './inc/json-schemas'
	#schemas	//	when deployed, check against the current prod schemas
	constructor() {
		super()
	}
	//	initialize
	async init(){
		this.#schemas = await this.#loadSchemas()
		console.log(chalk.yellow('global schema classes created:'),this.schema)
		return this
	}
	//	public utility functions
	extractId(_mbr_id){
		return _mbr_id.split('|')[1]
	}
	extractSysName(_mbr_id){
		return _mbr_id.split('|')[0]
	}
	toString(_obj){
		return Object.entries(_obj).map(([k, v]) => `${k}: ${v}`).join(', ')
	}
	//	getters/setters
	get schema(){	//	proxy for schemas
		return this.schemas
	}
	get schemaList(){	//	proxy for schemas
		return Object.keys(this.#schemas)
	}
	get schemas(){
		return this.#schemas
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
			//	this.#globals = global.Globals //	would have to be infused in the vm context
			console.log('vm ${ _className } class constructed')
		} catch(err) {
			console.log(\`FATAL ERROR CREATING \${obj.being}\`)
			console.log(err)
			throw(err)
		}
	}
	// if id changes are necessary, then use set .id() to trigger the change
	// getters/setters for private vars
	set name(_value) {
		if (typeof _value !== 'string') {
			throw new Error('Invalid type for property name. Expected string.')
		}
		this.#name = _value
	}`
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
		return {...this,..._this,...{ name: this.#name }}
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
	get newGuid(){	//	this.newGuid
		return Guid.newGuid().toString()
	}
	async #loadSchemas(){	//	returns array of schemas
		let _filesArray = await fs.readdir(this.#path)
			.then((_files) => {
				return _files
			})
		_filesArray = _filesArray
			.filter(_filename=>{
				return _filename.split('.')[1]==='json'	//	only JSON files
			})
			.map(async _filename=>{	//	may need to change map since one file could generate x# schemas through $def
				return await fs.readFile(this.#path+'/'+_filename)	//	read the file
					.then(_file=>{
						const _classArray = []
						_file = _file.toString()
						_file = JSON.parse(_file)
						_classArray.push({[ _filename.split('.')[0]]: this.#generateClassFromSchema(_file)})	//	primary file class instance
						if(_file?.$defs){	//	need to generate additional classes from $def
							for (const _schema in _file.$defs) {
								_classArray.push({[ _schema ]: this.#generateClassFromSchema(_file.$defs[_schema])})
							}
						}
						return _classArray	//	array of classes
					})
			})
		_filesArray = await Promise.all(_filesArray)	//	wait for all to resolve
		const _obj = _filesArray.reduce((acc, array) => {
  			return Object.assign(acc, ...array)
		}, {})
		return _obj	//	Object.assign({},_filesArray.flat())	//	merge all objects into one, named by class [lowercase, as in ready for eval instancing]
	}
}
//	exports
export default Globals