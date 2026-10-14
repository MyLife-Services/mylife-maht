// imports
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import EventEmitter from 'events'
/* constants */
const mAgentCards = await mParseFunctions('/a2a/cards')
const mBotTools = await mParseFunctions()
const mEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const mForbiddenCosmosFields = ['$', '_', ' ', '@', '#',]
const mForbiddenValues = [undefined, null, NaN]
const mGuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i	//	regex for GUID validation
const mMCPTools = await mParseFunctions('/mcp/tools')
const mOpenAIBotModel = process.env.OPENAI_MODEL_CORE_BOT ?? 'gpt-4.1-mini'
const mSchemas = await mLoadSchemas()
const mUrlRegex = /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)(:[0-9]{1,5})?(\/\S*)?$/
console.log('<-----Globals module loaded----->')
/**
 * Globals class holds all of the sensitive data and functionality. It exists as a singleton.
 * @class
 * @extends EventEmitter
 */
class Globals extends EventEmitter {
	constructor() {
		super()
	}
	/* public functions */
	/**
	 * Get an agent card by agent ID.
	 * @param {string} agentId - The ID of the agent
	 * @returns {object|null} - The agent card object or null if not found
	 */
	agentCard(agentId){
		return mAgentCards[agentId]
	}
	/**
	 * Get a GPT Javascript function by name.
	 * @param {string} name - the name of the function to retrieve
	 * @returns {object} - {type: 'function', function, } - the function object
	 */
	botTool(name){
		let response
		const tool = this.botTools?.[name]
		if(tool)
			response = { type: 'function', function: tool, }
		return response
	}
	/**
	 * Chunk an array into smaller arrays and returns as an Array.
	 * @param {Array} array - Array to chunk
	 * @param {number} size - Size of chunks
	 * @returns {Array} - Array of chunked arrays
	 */
	chunkArray(array, size) {
		const result = []
		for(let i = 0; i < array.length; i += size){
			result.push(array.slice(i, i + size))
		}
		return result
	}
	/**
	 * Clears a const array with nod to garbage collection.
	 * @param {Array} a - the array to clear
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
		if(!sysName?.length || !this.isValidGuid(sysId))
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
	getRegExp(text, isGlobal=false) {
		if (typeof text !== 'string' || !text.length)
			throw new Error('Expected a string')
		return new RegExp(text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), isGlobal ? 'g' : '')
	}
	isValidEmail(email){
		return typeof email === 'string' && mEmailRegex.test(email)
	}
	isValidGuid(text){
		return typeof text === 'string' && mGuidRegex.test(text)
	}
	isValidUrl(url){
		if(typeof url==='string' && !/^https?:\/\//i.test(url))
			url = 'http://' + url
		return typeof url==='string' && mUrlRegex.test(url)
	}
	isValidVersion(version) {
		const regex = /^\d+\.\d+\.\d+$/
		return typeof version === 'string' && regex.test(version)
	}
	/**
	 * Converts a snake_case function name to camelCase.
	 * @param {string} functionName - The snake_case function name
	 * @returns {string} - The camelCase function name
	 */
	jsFunctionName(functionName){
		return functionName
			.replace(/_(\w)/g, (_, letter)=>letter.toUpperCase())
			.replace(/-(\w)/g, (_, letter)=>letter.toUpperCase())
			.replace(/^\w/, c=>c.toLowerCase()) // ensure first character is lowercase
	}
	/**
	 * Populate an object with data, alters in place the incoming class instance.
	 * @param {object} obj - Object to populate
	 * @param {object} data - Data to populate object with
	 * @param {Array} immutableFields - Fields that should not be altered, and are removed from update
	 * @returns {void}
	 */
	populateObject(obj, data, immutableFields){
		if(!obj || typeof obj!=='object')
			throw new Error('Parameter requires an object')
		if(!data || typeof data!=='object')
			throw new Error('Parameter requires an object')
		data = this.sanitize(data, immutableFields)
		Object.keys(data)
			.forEach(key=>{
				const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), key)
				if(descriptor && (typeof descriptor.get==='function' || typeof obj[key]==='function'))
					return // Skip functions and getters
				obj[key]=data[key]
			})
	}
	/**
	 * Reads a text file and returns its content.
	 * @param {string} filePath - The path to the text file
	 * @returns {Promise<string|null>} - The content of the text file or null if an error occurs
	 */
	async readFile(filePath){
		const file = await fs.readFile(filePath, 'utf-8')
		return file
	}
	/**
	 * Reads a PDF file and returns its content as a base64-encoded string.
	 * @param {string} filePath - The path to the PDF file
	 * @returns {Promise<string|null>} - The base64-encoded PDF content or null if an error occurs
	 */
	async readPdf(filePath){
		try{
			let pdfBuffer
			pdfBuffer = await fs.readFile(filePath)
			pdfBuffer = pdfBuffer.toString('base64')
			return pdfBuffer
		} catch(err){
			console.error('Error reading PDF file:', err)
			return null
		}
	}
	/**
	 * Sanitize an object by removing forbidden Cosmos fields and undefined/null values.
	 * @param {object} obj - Object variables to sanitize
	 * @param {Array} immutableFields - Fields that should not be altered, and are removed from update
	 * @returns {object} - Sanitized data object
	 */
	sanitize(obj, immutableFields=[]){
		if(!obj || typeof obj!=='object')
			return {}
		const sanitizedData = Object.fromEntries(
			Object.entries(obj)
				.filter(([key, value])=>
					!mForbiddenCosmosFields.some(char => key.startsWith(char)) &&
					!immutableFields.includes(key) &&
					!mForbiddenValues.includes(value)
				)
		)
		return sanitizedData
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
	/*	getters/setters */
	get agentCards(){
		return mAgentCards
	}
	get botTools(){
		return mBotTools
	}
	get currentOpenAIBotModel(){
		return mOpenAIBotModel
	}
	get mcpTools(){
		return mMCPTools
	}
	get newGuid(){
		return crypto.randomUUID()
	}
	get schemas(){
		return mSchemas
	}
	get uploadPath(){
		return './.uploads/.tmp/'
	}
}
/* modular functions */
/**
 * Reads all JSON files from the json-schemas root directory and returns them as an array of parsed objects.
 * Skips subdirectories and non-JSON files.
 * @returns {Promise<object[]>} - Array of parsed JSON schema objects
 */
async function mLoadSchemas(){
	const __filename = fileURLToPath(import.meta.url)
	const __dirname = path.dirname(__filename)
	const schemasPath = path.join(__dirname, '..', 'json-schemas')
	const files = await fs.readdir(schemasPath)
	const schemas = []
	for(const file of files){
		const filePath = path.join(schemasPath, file)
		const stat = await fs.lstat(filePath)
		if(!stat.isFile() || path.extname(file) !== '.json')
			continue
		const data = await fs.readFile(filePath, 'utf8')
		schemas.push(JSON.parse(data))
	}
	return schemas
}
/**
 * Reads all JSON files from a specified json-schemas subdirectory and returns them as an object with file names as keys and parsed objects as values.
 * @param {string} route - the subdirectory of json-schemas to read from, defaults to '/functions'
 * @returns {Promise<object>} - Object with file names (without extension) as keys and parsed JSON objects as values
 */
async function mParseFunctions(route='/functions'){
	const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
	const jsonFolder = 'json-schemas' + route
	const jsonFolderPath = path.join(__dirname, '..', jsonFolder)
	const jsonObjects = {}
	const files = await fs.readdir(jsonFolderPath)
	for(const file of files){
		const filePath = path.join(jsonFolderPath, file)
		const stat = await fs.lstat(filePath)
		if(!stat.isFile() || path.extname(file) !== '.json')
			continue
		const data = await fs.readFile(filePath, 'utf8')
		const jsonObject = JSON.parse(data)
		const key = path.basename(file, path.extname(file)) ?? undefined
		if(!key)
			continue
		jsonObjects[key] = jsonObject
	}
	return jsonObjects
}
//	exports
export default Globals