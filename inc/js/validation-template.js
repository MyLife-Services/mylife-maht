import Ajv from 'ajv'	//	https://ajv.js.org/options.html
const ajv = new Ajv({
	allErrors: true,
	verbose: true,
	coerceTypes: true,
	removeAdditional: 'failing',
})
class JSONValidator {
	constructor(schema) {
		this.schema = schema
		this.validate = ajv.compile(schema)
	}
	validate(data) {
		return this.validate(data)
	}
}
//	exports
export default JSONValidator