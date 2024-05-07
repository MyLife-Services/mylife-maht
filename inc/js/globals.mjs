// imports
import EventEmitter from 'events'
import { Guid } from 'js-guid'	//	usage = Guid.newGuid().toString()
/* constants */
const mAiJsFunctions = {
	storySummary: {
		description: "Generate a STORY summary with keywords and other critical data elements.",
		name: "storySummary",
		parameters: {
			type: "object",
			properties: {
				keywords: {
					description: "Keywords most relevant to STORY.",
					items: {
						description: "Keyword (single word or short phrase) to be used in STORY summary.",
						maxLength: 64,
						type: "string"
					},
					maxItems: 12,
					minItems: 3,
					type: "array"
				},
				phaseOfLife: {
					description: "Phase of life indicated in STORY.",
					enum: [
						"birth",
						"childhood",
						"adolescence",
						"teenage",
						"young-adult",
						"adulthood",
						"middle-age",
						"senior",
						"end-of-life",
						"past-life",
						"unknown",
						"other"
					],
					maxLength: 64,
					type: "string"
				},
				relationships: {
					description: "MyLife Biographer Bot does its best to record individuals (or pets) mentioned in this `story`.",
					type: "array",
					items: {
						description: "A name of relational individual/pet to the `story` content.",
						type: "string"
					},
					maxItems: 24
				},
				summary: {
					description: "Generate a STORY summary from input.",
					maxLength: 20480,
					type: "string"
				},
				title: {
					description: "Generate display Title of the STORY.",
					maxLength: 256,
					type: "string"
				}
			},
			required: [
				"keywords",
				"phaseOfLife",
				"summary",
				"title"
			]
		}
	}
}
const mEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/	//	regex for email validation
const mGuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i	//	regex for GUID validation
// modular classes
class Globals extends EventEmitter {
	constructor() {
		//	essentially this is a coordinating class wrapper that holds all of the sensitive data and functionality; as such, it is a singleton, and should either _be_ the virtual server or instantiated on one at startup
		super()
	}
	/* public functions */
	getGPTJavascriptFunction(name){
		return this.GPTJavascriptFunctions[name]
	}
	getRegExp(str, isGlobal = false) {
		if (typeof str !== 'string' || !str.length)
			throw new Error('Expected a string')
		return new RegExp(str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), isGlobal ? 'g' : '')
	}
	isValidEmail(_email){
		return mEmailRegex.test(_email)
	}
	isValidGuid(_str='') {
		return (typeof _str === 'string' && mGuidRegex.test(_str))
	}
	stripCosmosFields(_obj){
		return Object.fromEntries(Object.entries(_obj).filter(([k, v]) => !k.startsWith('_')))
	}
	sysId(_mbr_id){
		if(!typeof _mbr_id==='string' || !_mbr_id.length || !_mbr_id.includes('|'))
			throw new Error('expected MyLife member id string')
		return _mbr_id.split('|')[1]
	}
	sysName(_mbr_id){
		return _mbr_id.split('|')[0]
	}
	toString(_obj){
		return Object.entries(_obj).map(([k, v]) => `${k}: ${v}`).join(', ')
	}
	//	getters/setters
	get uploadPath(){
		return './.uploads/.tmp/'
	}
	get newGuid(){	//	this.newGuid
		return Guid.newGuid().toString()
	}
	get GPTJavascriptFunctions(){
		return mAiJsFunctions
	}
}
//	exports
export default Globals