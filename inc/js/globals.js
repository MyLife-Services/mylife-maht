// imports
import { promises as fs } from 'fs'
import EventEmitter from 'events'
import vm from 'vm'
import { Guid } from 'js-guid'	//	Guid.newGuid().toString()
// core class
class Globals extends EventEmitter {
	#excludeProperties = { 'try': true, 'catch': true }	//	global object keys to exclude from class creations [apparently fastest way in js to lookup items, as they are hash tables]
	#path = './inc/json-schemas'
	#schemas	//	when deployed, check against the current prod schemas
	constructor() {
		super()
	}
	//	public functions
	async init(){
		this.#schemas = await this.#loadSchemas()
		return this
	}
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
								return `'${new Guid().toString()}'`
							case 'email':
							case 'uri':
							default:
								return "''"
						}
					case undefined:
					default:
						return null
				}
		}
	}
	#compileClass(_className,_class){
		// Create a new context and run the class code in it
        const context = vm.createContext({ exports: {} })
        vm.runInContext(`exports.${_className} = ${_class}`, context)
		//	compile class
        return context.exports[_className]
	}
	#generateClassCode(_className,_properties,_schema){
		//	generate class
		let classCode = `class ${_className} {\n`
		//	assign properties
		for (const _prop in _properties) {	//	assign default values
			const _value = this.#assignClassPropertyValues(_properties[_prop],_schema)
			classCode += `    #${_prop}${(_value)?'='+_value:''}\n`
		}
		//	generate constructor
		classCode += '  constructor(obj={}) {\n'	//	could also supply some defaults
		for (const _prop in _properties) {
			classCode += `    this.#${_prop} = (obj?.${_prop})?obj.${_prop}:this.#${_prop}\n`
		}
		classCode += '  }\n'
		// Generate getters and setters
		for (const _prop in _properties) {
			//	validate
			if(_prop in this.#excludeProperties){
				continue
			}
			const _type = _properties[_prop].type
			// Generate getter
			classCode += `get ${_prop}() {\n	return this.#${_prop}\n	}\n`
			// Generate setter with type validation
			classCode += `	set ${_prop}(_value) {\n`
			classCode += `		if (typeof _value !== '${_type}') {\n`
			classCode += `		throw new Error('Invalid type for property ${_prop}. Expected ${_type}.')\n`
			classCode += '	}\n'
			classCode += `	this.#${_prop} = _value\n	}\n`
		}
		classCode += '}\n'	//	close class
		return classCode
	}
	#generateClassFromSchema(_schema) {
		//	get core class
		const _className = _schema.name
		const _properties = _schema.properties
		const _class = this.#generateClassCode(_className,_properties,_schema)
		//	compile class and return
		return this.#compileClass(_className,_class)
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