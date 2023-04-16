// imports
import { promises as fs } from 'fs'
import EventEmitter from 'events'
import vm from 'vm'
import { Guid } from 'js-guid'	//	Guid.newGuid().toString()
// core class
class Globals extends EventEmitter {
	#path = './inc/json-schemas'
	#schemas
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
	get schemas(){
		return this.#schemas
	}
	//	private functions
	#assignSchemaPropertyValue(_propertyDefinition,_schema){	//	need schema in case of $def
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
						return []
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
								return ''
						}
					case undefined:
					default:
						return null
				}
		}
	}
	#generateClassFromSchema(_schema,_filename) {
		//	get core class
		const className = _schema.name
		const _properties = _schema.properties
		//	generate class
		let classCode = `class ${className} {\n`
		//	assign properties
		for (const _prop in _properties) {	//	assign default values
			const _value = this.#assignSchemaPropertyValue(_properties[_prop],_schema)
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
			const type = _properties[_prop].type
			// Generate getter
			classCode += `\n  get ${_prop}() {\n    return this.#${_prop}\n  }\n`
			// Generate setter with type validation
			classCode += `\n  set ${_prop}(_value) {\n`
			classCode += `    if (typeof _value !== '${type}') {\n`
			classCode += `      throw new Error('Invalid type for property ${_prop}. Expected ${type}.')\n`
			classCode += '    }\n'
			classCode += `    this.#${_prop} = _value\n  }\n`
		}
		
		classCode += '}\n'
        // Create a new context and run the class code in it
        const context = vm.createContext({ exports: {} })
        vm.runInContext(`exports.${className} = ${classCode}`, context)
		//	compile class
        const _generatedClass = context.exports[className]
		return { [_filename]: new _generatedClass() }
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
						_file = _file.toString()
						_file = JSON.parse(_file)
						return this.#generateClassFromSchema(_file,_filename.split('.')[0])	//	array
					})
			})
		_filesArray = await Promise.all(_filesArray)	//	wait for all to resolve
		return Object.assign({}, ..._filesArray)
	}
}
//	exports
export default Globals