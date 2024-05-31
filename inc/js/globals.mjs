// imports
import EventEmitter from 'events'
import { Guid } from 'js-guid'	//	usage = Guid.newGuid().toString()
/* constants */
const mAiJsFunctions = {
	entrySummary: {
		description: 'Generate a JOURNAL ENTRY `entry` summary with keywords and other critical data elements.',
		name: 'entrySummary',
		parameters: {
			type: 'object',
			properties: {
				content: {
					description: 'concatenated raw text content of member input for JOURNAL ENTRY.',
				},
				keywords: {
					description: 'Keywords most relevant to JOURNAL ENTRY.',
					items: {
						description: 'Keyword (single word or short phrase) to be used in JOURNAL ENTRY summary.',
						maxLength: 64,
						type: 'string'
					},
					maxItems: 12,
					minItems: 3,
					type: 'array'
				},
				mood: {
					description: 'Record member mood for day (or entry) in brief as ascertained from content of JOURNAL ENTRY.',
					maxLength: 256,
					type: 'string'
				},
				relationships: {
					description: 'Record individuals (or pets) mentioned in this `entry`.',
					type: 'array',
					items: {
						description: 'A name of relational individual/pet to the `entry` content.',
						type: 'string'
					},
					maxItems: 24
				},
				summary: {
					description: 'Generate a JOURNAL ENTRY summary from input.',
					maxLength: 20480,
					type: 'string'
				},
				title: {
					description: 'Generate display Title of the JOURNAL ENTRY.',
					maxLength: 256,
					type: 'string'
				}
			},
			required: [
				'content',
				'keywords',
				'summary',
				'title'
			]
		}
	},
	storySummary: {
		description: 'Generate a STORY summary with keywords and other critical data elements.',
		name: 'storySummary',
		parameters: {
			type: 'object',
			properties: {
				keywords: {
					description: 'Keywords most relevant to STORY.',
					items: {
						description: 'Keyword (single word or short phrase) to be used in STORY summary.',
						maxLength: 64,
						type: 'string'
					},
					maxItems: 12,
					minItems: 3,
					type: 'array'
				},
				phaseOfLife: {
					description: 'Phase of life indicated in STORY.',
					enum: [
						'birth',
						'childhood',
						'adolescence',
						'teenage',
						'young-adult',
						'adulthood',
						'middle-age',
						'senior',
						'end-of-life',
						'past-life',
						'unknown',
						'other'
					],
					maxLength: 64,
					type: 'string'
				},
				relationships: {
					description: 'MyLife Biographer Bot does its best to record individuals (or pets) mentioned in this `story`.',
					type: 'array',
					items: {
						description: 'A name of relational individual/pet to the `story` content.',
						type: 'string'
					},
					maxItems: 24
				},
				summary: {
					description: 'Generate a STORY summary from input.',
					maxLength: 20480,
					type: 'string'
				},
				title: {
					description: 'Generate display Title of the STORY.',
					maxLength: 256,
					type: 'string'
				}
			},
			required: [
				'keywords',
				'phaseOfLife',
				'summary',
				'title'
			]
		}
	},
}
const mEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/	//	regex for email validation
const mGuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i	//	regex for GUID validation
const mOpenAIBotModel = process.env.OPENAI_MODEL_CORE_BOT
	?? 'gpt-4o' // current MyLife OpenAI model for system on-demand and custom bots (personal-avatar may be different)
// module classes
class Globals extends EventEmitter {
	constructor() {
		//	essentially this is a coordinating class wrapper that holds all of the sensitive data and functionality; as such, it is a singleton, and should either _be_ the virtual server or instantiated on one at startup
		super()
	}
	/* public functions */
	/**
	 * Clears a const array with nod to garbage collection.
	 * @param {Array} a - the array to clear.
	 * @returns {void}
	 */
	clearArray(a){
		if(!Array.isArray(a))
			throw new TypeError('Expected an array to clear')
		for(let i = 0; i < a.length; i++){
			a[i] = null
		}
		a.length = 0
	}
	createDocumentName(mbr_id, id, type){
		if(!mbr_id || !id || !type)
			throw new Error('createDocumentName() expects `mbr_id`, `id`, and `type`')
		return `${ type.substring(0,32) }_${mbr_id}_${id}`
	}
	/**
	 * Create a member id from a system name and id: sysName|sysId.
	 * @param {string} sysName - System name to create the member id from.
	 * @param {Guid} sysId - System id to create the member id from, `Guid` required.
	 * @returns {string} - The member id created from the system name and id.
	 */
	createMbr_id(sysName, sysId){
		if(!sysName?.length || !isValidGuid(sysId))
			throw new Error('createMbr_id() expects params: sysName{string}, id{Guid}')
		const delimiter = '|' // currently used to separate system name and id in mbr_id
		const mbr_id = sysName
			.substring(0,64)
			.replace(/\s/g, '_').toLowerCase()
			+ delimiter
			+ sysId
		return mbr_id
	}
	/**
	 * Get a GPT File Search Tool structure.
	 * @param {string} vectorstoreId - the vector store id to search.
	 * @returns {object} - { file_search: { vector_store_ids: [vectorstoreId] } } - the GPT File Search Tool structure.
	 */
	getGPTFileSearchToolStructure(vectorstoreId){
		return {
			tools: [{ type: 'file_search' }],
			tool_resources: {
				file_search: {
					vector_store_ids: vectorstoreId ? [vectorstoreId] : []
				}
			},
		}
	}
	/**
	 * Get a GPT Javascript function by name.
	 * @param {string} name - the name of the function to retrieve.
	 * @returns {object} - {type: 'function', function, } - the function object.
	 */
	getGPTJavascriptFunction(name){
		if(!name?.length)
			throw new Error('getGPTJavascriptFunction() expects a function name as parameter')
		return {
			type: 'function',
			function: this.GPTJavascriptFunctions[name]
		}
	}
	getRegExp(text, isGlobal=false) {
		if (typeof text !== 'string' || !text.length)
			throw new Error('Expected a string')
		return new RegExp(text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), isGlobal ? 'g' : '')
	}
	isValidEmail(email){
		return typeof email === 'string' && mEmailRegex.test(email)
	}
	isValidGuid(text) {
		return typeof text === 'string' && mGuidRegex.test(text)
	}
	stripCosmosFields(object){
		return Object.fromEntries(Object.entries(object).filter(([k, v]) => !k.startsWith('_')))
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
	get currentOpenAIBotModel(){
		return mOpenAIBotModel
	}
	get GPTJavascriptFunctions(){
		return mAiJsFunctions
	}
	get newGuid(){	//	this.newGuid
		return Guid.newGuid().toString()
	}
	get uploadPath(){
		return './.uploads/.tmp/'
	}
}
//	exports
export default Globals