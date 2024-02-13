/**
 * @fileOverview This file contains the Dataservices class, which manages data interactions for the MyLife platform.
 * It includes functionality for handling avatars, chats, items, and other core elements of the platform's data.
 * @version 1.0.0
 */
//	imports
import { _ } from "ajv"
import Datamanager from "./mylife-datamanager.mjs"
import PgvectorManager from "./mylife-pgvector-datamanager.mjs"
import { Guid } from "js-guid"
/**
 * The Dataservices class.
 * This class provides methods to interact with the data layers of the MyLife platform, predominantly the Azure Cosmos and PostgreSQL database.
 * Any new Dataservices class is instantiated with a member id, which is used to identify the member in the database, and retrieve the core data for that member.
 */
class Dataservices {
    /**
     * Represents the core functionality of the data service. This property
     * objectifies core data to make it more manageable and structured,
     * as opposed to presenting raw output.
     * @private
     */
    #core
    /**
     * Manages various data-related operations. It could be responsible for
     * handling data transactions, CRUD operations, etc., depending on its implementation.
     * @private
     */
    #Datamanager
    /**
     * Identifies a specific partition or segment of the data storage
     * that this instance of Dataservices interacts with. Useful for multi-tenant
     * architectures or when data is sharded.
     * @private
     */
    #partitionId
    /**
     * Manages interactions with Pgvector, which might be used for
     * efficient vector operations in a Postgres database. This could include
     * functionalities like similarity search, nearest neighbor search, etc.
     * @private
     */
    #PgvectorManager
    /**
     * A default SQL SELECT statement or part of it used to fetch
     * user-related data. It defines the columns to be retrieved in most
     * database queries within this service.
     * @private
     */
    #rootSelect = ['being', 'id', 'mbr_id', 'object_id', ]
    /**
     * Constructor for Dataservices class.
     * @param {string} _mbr_id - Member ID to partition data.
     */
	constructor(_mbr_id){
		this.#partitionId = _mbr_id
		this.#PgvectorManager = new PgvectorManager()
	}
    /**
     * Initializes the Datamanager instance and sets up core data.
     * @async
	 * @public
     * @returns {Dataservices} The instance of Dataservices.
     */
	async init(){
		this.#Datamanager = new Datamanager(this.#partitionId)
		await this.#Datamanager.init()	//	init datamanager
		const _excludeProperties = { '_none':true }	//	populate if exclusions are required
		const _core = Object.entries(this.datamanager.core)	//	array of arrays
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
		this.#core = Object.assign({},..._core)	//	init core
		return this
	}
	//	getters/setters
	get core(){
		return this.#core
	}
	get datamanager(){
		return this.#Datamanager
	}
	get embedder(){
		return this.#PgvectorManager
	}
	get globals(){
		return this.datamanager.globals
	}
	get id(){
		return this.partitionId.split('|')[1]
	}
	get isMyLife(){
		return this.mbr_id===process.env?.MYLIFE_SERVER_MBR_ID??false
	}
	get mbr_id(){
		return this.partitionId
	}
	get partitionId(){
		return this.#partitionId
	}
	//	public functions
	/**
	 * Get a bot specified by id or type.
	 * @public
	 * @param {string} _bot_id - The bot id.
	 * @param {string} _bot_type - The bot type.
	 * @param {string} _mbr_id - The member id.
	 * @returns {object} - The bot or `undefined` if no bot found.
	 */
	async bot(_bot_id, _bot_type='personal-avatar', _mbr_id=this.mbr_id){
		if(_bot_id){
			return await this.getItem(_bot_id)
		} else {
			const _bots = await this.bots(_bot_type)
			return _bots?.[0]
		}
	}
	/**
	 * Gets all bots of a given type for a given member.
	 * @param {string} _bot_type - The bot type.
	 * @param {string} _mbr_id - The member id.
	 * @returns {array} - The bots or empty array if no bots found.
	 */
	async bots(_bot_type, _mbr_id=this.mbr_id){
		if(_bot_type){
			return await this.getItems(
				'bot',
				['bot_id'],
				[{ name: '@bot_type', value: _bot_type }],
				undefined,
				_mbr_id,
			)
		} else {
			return await this.getItems('bot')
		}
	}
	/**
	 * Retrieves a specific bot instruction by its ID.
	 * @param {string} _type - The type of bot instruction.
	 * @returns {array} - An array of bot instruction or `undefined` if no bot instruction found.
	 */
	async botInstructions(_type){
		if(_type?.length) _type = [{ name: '@type', value: _type }]
		return await this.getItems(
			'bot-instructions',
			undefined,
			_type,
			'system'
		)
	}
    /**
     * Challenges access using a member ID and passphrase.
     * @async
	 * @public
     * @param {string} _mbr_id - The member ID.
     * @param {string} _passphrase - The passphrase for access.
     * @returns {Promise<Object>} The result of the access challenge.
     */
	async challengeAccess(_mbr_id,_passphrase){	//	if possible (async) injected into session object
		//	ask global data service (stored proc) for passphrase
		return await this.datamanager.challengeAccess(_mbr_id, _passphrase)
	}
	async datacore(_mbr_id){
		return await this.getItem(_mbr_id)
	}
	async findRegistrationIdByEmail(_email){
		/* pull record for email, returning id or new guid */
		const _ = await this.getItems(
			'registration',
			undefined,
			[{ name: '@email',
				value: _email,
			}],
			'registration',
		)
		return _?.[0]?.id??Guid.newGuid().toString() // needed to separate out, was failing
	}
	/**
	 * Retrieves a specific alert by its ID. _Currently placehoder_.
	 * @async
	 * @public
	 * @param {string} _alert_id - The unique identifier for the alert.
	 * @returns {Promise<Object>} The alert corresponding to the provided ID.
	 */
	async getAlert(_alert_id){
		return await this.getItem(_alert_id, 'system')
	}
	/**
	 * Retrieves all system alerts. _Currently only works with system alerts, but intends to be expanded, refactor_.
	 * This method is typically used to get all alert entities under a specific object.
	 * @async
	 * @public
	 * @param {string} _object_id - The parent object ID to search for associated alerts.
	 * @returns {Promise<Array>} An array of alerts associated with the given parent ID.
	 */
	async getAlerts(){	
		const _paramsArray = [
			{ name: '@being', value: 'alert' },
			{ name: '@currentDate', value: new Date().toISOString() }
		]
		const _query = `SELECT * FROM c WHERE c.being = @being AND @currentDate >= c.timestampRange['start'] AND @currentDate <= c.timestampRange['end']`

		return await this.datamanager.getItems(
			{ query: _query, parameters: _paramsArray },
			'system',
		)
	}
	async getAvatar(){
		const _avatars = await this.getAvatars()
		return _avatars
	}
	/**
	 * Get all Member Avatars, but given 1-to-1 relationship, only returns first.
	 * @returns {object} - The avatar document or `undefined` if no avatar found.
	 */
	async getAvatars(){
		const _avatars = await this.getItems('avatar')
		return _avatars?.[0]
	}
	/**
	 * Retrieves the first chat associated with a given parent ID.
	 * If multiple chats are associated with the parent ID, only the first one is returned.
	 * @async
	 * @public
	 * @param {string} [parent_id=this.id] - The parent ID for which to retrieve the chat. Defaults to the current instance ID.
	 * @returns {Promise<Object>} The first chat object associated with the given parent ID.
	 */
	async getChat(parent_id = this.id) {
		const _response = await this.getChats(parent_id)
		return _response[0] // Extract the first chat from the response
	}
	/**
	 * Retrieves all chat conversations associated with a given parent ID.
	 * If no chats exist, it creates a new chat conversation.
	 * @async
	 * @public
	 * @param {string} parent_id - The parent ID for which to retrieve or create chats.
	 * @returns {Promise<Array>} An array of chat conversations associated with the given parent ID.
	 */
	async getChats(parent_id) {
		let _chats = await this.getItems(
			'conversation',
			undefined,
			[{ name: '@parent_id', value: parent_id }],
		)
		if (!_chats.length) {
			_chats = await this.pushItem({
				mbr_id: this.mbr_id,
				parent_id: parent_id,
				being: 'conversation',
				exchanges: [],
				name: `conversation_${this.mbr_id}`,
			})
		}
		return _chats
	}
	/**
	 * Retrieves all seed contribution questions associated with being & category.
	 * @async
	 * @public
	 * @param {string} _being - The type of underlying datacore.
	 * @param {string} _category - The category of seed questions to retrieve.
	 * @returns {Promise<Object>} The item corresponding to the provided ID.
	 */
	async getContributionQuestions(_being, _category, _maxNumber=3){
		return (await this.getItems(
			_being,
			['questions'],
			[{ name: '@category', value: _category }],
			'contribution_responses',
		))
			.map(_ => (_.questions))
			.reduce((acc, val) => acc.concat(val), [])
			.sort(() => Math.random() - Math.random())
			.slice(0, _maxNumber)
	}
	/**
	 * Retrieves a specific item by its ID.
	 * @async
	 * @public
	 * @param {string} _id - The unique identifier for the item.
	 * @param {string} _container_id - The container to use, overriding default: `Members`.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<Object>} The item corresponding to the provided ID.
	 */
	async getItem(_id, _container_id, _mbr_id=this.mbr_id) {
		if(!_id) return
		try{
			return await this.datamanager.getItem(
				_id,
				_container_id,
				{ partitionKey: _mbr_id, populateQuotaInfo: false, },
			)
		}
		catch(_error){
			console.log('mylife-data-service::getItem() error')
			console.log(_error, _id, _container_id,)
			return
		}
	}
	/**
	 * Retrieves first item based on specified parameters.
	 * @async
	 * @public
	 * @param {string} _being 
	 * @param {string} _field - Field name to match.
	 * @param {string} _value - Value to match.
	 * @param {string} _container_id - The container name to use, overriding default.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<object>} An object (initial of arrau) matching the query parameters.
	 */
	async getItemByField(_being, _field, _value, _container_id, _mbr_id=this.mbr_id){
		const _item =  await this.getItemByFields(
			_being,
			[{ name: `@${_field}`, value: _value }],
			_container_id,
			_mbr_id,
		)
		return _item
	}
	/**
	 * Retrieves first item based on specified parameters.
	 * @async
	 * @public
	 * @param {string} _being 
	 * @param {array} _fields - Array of name/value pairs to select, format: [{name: `@${_field}`, value: _value}],
	 * @param {string} _container_id - The container name to use, overriding default.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<object>} An object (initial of arrau) matching the query parameters.
	 */
	async getItemByFields(_being, _fields, _container_id, _mbr_id=this.mbr_id){
		const _items =  await this.getItemsByFields(
			_being,
			_fields,
			_container_id,
			_mbr_id,
		)
		return _items?.[0]
	}
	/**
	 * Retrieves items based on specified parameters.
	 * @async
	 * @public
	 * @param {string} _being - The type of items to retrieve.
	 * @param {array} [_selects=[]] - Fields to select; if empty, selects all fields.
	 * @param {Array<Object>} [_paramsArray=[]] - Additional query parameters.
	 * @param {string} _container_id - The container name to use, overriding default.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<Array>} An array of items matching the query parameters.
	 */
	async getItems(_being, _selects=[], _paramsArray=[], _container_id, _mbr_id=this.mbr_id) {	//	_params is array of objects { name: '${varName}' }
		// @todo: incorporate date range functionality into this.getItems()
		const _prefix = 'u'
		_paramsArray.unshift({ name: '@being', value: _being })	//	add primary parameter to array at beginning
		const _selectFields = (_selects.length)
			?	[...this.#rootSelect, ..._selects].map(_=>(`${_prefix}.`+_)).join(',')
			:	'*'
		let _query = `select ${_selectFields} from ${_prefix}`	//	@being is required
		_paramsArray	//	iterate through parameters
			.forEach(_param=>{	//	param is an object of name, value pairs
				_query += (_param.name==='@being')
					?	` where ${_prefix}.${_param.name.split('@')[1]}=${_param.name}`	//	only manages string so far
					:	` and ${_prefix}.${_param.name.split('@')[1]}=${_param.name}`	//	only manages string so far
		})
		try{
			return await this.datamanager.getItems(
				{ query: _query, parameters: _paramsArray },
				_container_id,
				{
					partitionKey: _mbr_id,
					populateQuotaInfo: false, // set this to true to include quota information in the response headers
				},
			)
		}
		catch(_error){
			console.log('mylife-data-service::getItems() error')
			console.log(_error, _being, _query, _paramsArray, _container_id,)
		}
	}
	/**
	 * Retrieve items based on specified parameters.
	 * @async
	 * @public
	 * @param {string} _being 
	 * @param {array} _fields - Array of name/value pairs to select, format: [{name: `@${_field}`, value: _value}],
	 * @param {string} _container_id - The container name to use, overriding default.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<Array>} An array of items matching the query parameters.
	 */
	async getItemsByFields(_being, _fields, _container_id, _mbr_id=this.mbr_id){
		const _items =  await this.getItems(
			_being, 
			undefined,
			_fields, 
			_container_id,
			_mbr_id,
		)
		return _items
	}
	/**
	 * Retrieves local records based on a query.
	 * @async
	 * @param {string} _question - The query to retrieve records.
	 * @returns {Promise<Array>} An array of local records matching the query.
	 */
	async getLocalRecords(_question){
		return await this.embedder.getLocalRecords(_question)
	}
	/**
	 * Gets library from database.
	 * @async
	 * @public
	 * @param {string} _library_id - The unique identifier for the library.
	 * @param {string} _object_id - The unique identifier for the underlying avatar.
	 * @param {string} _type - The type of the library.
	 * @param {string} _form - The form of the library.
	 * @returns {Array} - array of library items added to member's library.
	 */
	async library(_library_id, _object_id, _type, _form){
		return ( await this.getItem(_library_id) )
			?? ( await this.getItemByFields(
				'library',
				[
					{ name: '@object_id', value: _object_id },
					{ name: '@type', value: _type },
					{ name: '@form', value: _form },
				].filter(_=>_?.value!==undefined),
				undefined,
				this.mbr_id,
			) )
	}
	/**
	 * Patches an item by its ID with the provided data.
	 * @async
	 * @param {string} _id - The unique identifier for the item to be patched.
	 * @param {Object} _data - The data to patch the item with.
	 * @param {string} [_path='/'] - The path for patching, defaults to root.
	 * @returns {Promise<Object>} The result of the patch operation.
	 */
	async patch(_id, _data, _path = '/') {
		// @todo: limit to 10 patch operations
		// _data is an object of key/value pairs to be transformed into patch operations
		const patchOperations = Object.keys(_data)
			// Filtering out keys that should not be included in the patch
			.filter(_key => !['id', 'being', 'mbr_id'].includes(_key))
			.map(_key => {
				return { op: 'add', path: _path + _key, value: _data[_key] }
			})
		// Performing the patch operation
		return await this.patchItem(_id, patchOperations)
	}
	/**
	 * Patches an item with the given data. The path for each patch operation is embedded in the data.
	 * @async
	 * @param {string} _id - The unique identifier for the item to be patched.
	 * @param {Array<Object>} _data - The data for patching, including the path and operation.
	 * @returns {Promise<Object>} The result of the patch operation.
	 */
	async patchItem(_id, _data){ // path Embedded in _data
		return await this.datamanager.patchItem(_id ,_data)
	}
    /**
     * Pushes a new item to the data manager
     * @async
	 * @public
     * @param {Object} _data - The data to be pushed
     * @returns {Promise<Object>} The result of the push operation
     */
	async pushItem(_data){
		return await this.datamanager.pushItem(_data)
	}
	/**
	 * Registers a new candidate to MyLife membership after finding record (or contriving Guid) in db
	 * @public
	 * @param {object} _candidate { 'email': string, 'humanName': string, 'avatarNickname': string }
	 */
	async registerCandidate(_candidate){
		_candidate.mbr_id = this.#partitionId
		_candidate.id = await this.findRegistrationIdByEmail(_candidate.email)
		_candidate.being = 'registration'
		_candidate.name = `${_candidate.email.split('@')[0]}-${_candidate.email.split('@')[1]}_${_candidate.id}`
		return await this.datamanager.registerCandidate(_candidate)
	}
	async setBot(_bot){
		const _originalBot = await this.bot(_bot.id)
		if(_originalBot){ // update
			const _changed = Object.keys(_bot)
				.filter(key => !key.startsWith('_') && _bot[key] !== _originalBot[key])
				.reduce((obj, key) => {
					obj[key] = _bot[key]
					return obj
				}, {})
			if (Object.keys(_changed).length > 0) {
				this.patch(_bot.id, _changed)
			}
		} else { // add
			this.pushItem(_bot)
		}
		return _bot
	}
	/**
	 * Submits a story to MyLife. Currently via API, but could be also work internally.
	 * @param {object} _story - Story object { assistantType, being, form, id, mbr_id, name, summary }.
	 * @returns {object} - The story document from Cosmos.
	 */
	async story(_story){
		if(!this.isMyLife) return
		return await this.datamanager.pushItem(_story)
	}
	/**
	 * Tests partition key for member
	 * @public
	 * @param {string} _mbr_id member id
	 * @returns {boolean} returns true if partition key is valid
	 */
	async testPartitionKey(_mbr_id){
		if(!this.isMyLife) return false
		return await this.datamanager.testPartitionKey(_mbr_id)
	}
}
//	exports
export default Dataservices