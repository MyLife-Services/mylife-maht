/**
 * @fileOverview This file contains the Dataservices class, which manages data interactions for the MyLife platform.
 * It includes functionality for handling avatars, chats, items, and other core elements of the platform's data.
 * @version 1.0.0
 */
//	imports
import { _ } from "ajv"
import Datamanager from "./mylife-datamanager.js"
import PgvectorManager from "./mylife-pgvector-datamanager.js"
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
    #rootSelect = ['id', 'mbr_id', 'parent_id', 'being']
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
	get id(){
		return this.partitionId.split('|')[1]
	}
	get mbr_id(){
		return this.partitionId
	}
	get partitionId(){
		return this.#partitionId
	}
	//	public functions
    /**
     * Proxy to add an avatar to the MyLife Cosmos database.
     * @async
	 * @public
     * @param {Object} _avatar - The avatar to add.
     */
	async addAvatar(_avatar){
		return await this.pushItem(_avatar)
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
		return await this.datamanager.challengeAccess(_mbr_id,_passphrase)
	}
	/**
	 * Retrieves a specific avatar by its ID.
	 * @async
	 * @public
	 * @param {string} _avatar_id - The unique identifier for the avatar.
	 * @returns {Promise<Object>} The avatar corresponding to the provided ID.
	 */
	async getAvatar(_avatar_id) {
		return await this.getItems('avatar', undefined, [{ name: '@id', value: _avatar_id }])
	}
	/**
	 * Retrieves all avatars associated with a given parent ID.
	 * This method is typically used to get all avatar entities under a specific object.
	 * @async
	 * @public
	 * @param {string} _object_id - The parent object ID to search for associated avatars.
	 * @returns {Promise<Array>} An array of avatars associated with the given parent ID.
	 */
	async getAvatars(_object_id) {
		return await this.getItems('avatar', undefined, [{ name: '@object_id', value: _object_id }])
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
		let _chats = await this.getItems('conversation', ['exchanges'], [{ name: '@parent_id', value: parent_id }])
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
			'contribution_responses'
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
	 * @returns {Promise<Object>} The item corresponding to the provided ID.
	 */
	async getItem(_id) {
		return await this.datamanager.getItem(_id)
	}
	/**
	 * Retrieves items based on specified parameters.
	 * @async
	 * @public
	 * @param {string} _being - The type of items to retrieve.
	 * @param {array} [_selects=[]] - Fields to select; if empty, selects all fields.
	 * @param {Array<Object>} [_paramsArray=[]] - Additional query parameters.
	 * @returns {Promise<Array>} An array of items matching the query parameters.
	 */
	async getItems(_being, _selects=[], _paramsArray=[], _container='members') {	//	_params is array of objects { name: '${varName}' }
		const _prefix = 'u'
		_paramsArray.unshift({ name: '@being', value: _being })	//	add primary parameter to array at beginning
		const _selectFields = (_selects.length)
			?	[...this.#rootSelect, ..._selects].map(_=>(`${_prefix}.`+_)).join(',')
			:	'*'
		let _query = `select ${_selectFields} from ${_container} ${_prefix}`	//	@being is required
		_paramsArray	//	iterate through parameters
			.forEach(_param=>{	//	param is an object of name, value pairs
				_query += (_param.name==='@being')
					?	` where ${_prefix}.${_param.name.split('@')[1]}=${_param.name}`	//	only manages string so far
					:	` and ${_prefix}.${_param.name.split('@')[1]}=${_param.name}`	//	only manages string so far
		})
		return await this.datamanager.getItems(
			{ query: _query, parameters: _paramsArray },
			_container,
		)
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
	 * Patches an item by its ID with the provided data.
	 * @async
	 * @param {string} _id - The unique identifier for the item to be patched.
	 * @param {Object} _data - The data to patch the item with.
	 * @param {string} [_path='/'] - The path for patching, defaults to root.
	 * @returns {Promise<Object>} The result of the patch operation.
	 */
	async patch(_id,_data,_path='/'){	//	_data is just object of key/value pairs so must be transformed (add/update only)
		_data = Object.keys(_data)
			.map(_key=>{
				return { op: 'add', path: _path+_key, value: _data[_key] }
			})
		return await this.patchItem(_id,_data)
	}
	/**
	 * Patches an array within an item by inserting data at a specified index.
	 * @async
	 * @param {string} _id - The unique identifier for the item to be patched.
	 * @param {string} _node - The node within the item where data is to be inserted.
	 * @param {Array<Object>} _data - The data to be inserted.
	 * @param {number} [_index=0] - The index at which to insert the data.
	 * @returns {Promise<Object>} The result of the patch operation.
	 */
	async patchArrayItems(_id,_node,_data,_index=0){	//	_data is array of objects to be inserted into _node at _index
		//	create patch object that can insert _data into _node at _index
		const __data = _data
			.map(
				(_item,_index)=>{
					return { op: 'add', path: `/${_node}/${_index}`, value: { message: _item.text, role: _item.role } }
				}
			)
		return await this.patchItem(_id,__data)
	}
	/**
	 * Patches an item with the given data. The path for each patch operation is embedded in the data.
	 * @async
	 * @param {string} _id - The unique identifier for the item to be patched.
	 * @param {Array<Object>} _data - The data for patching, including the path and operation.
	 * @returns {Promise<Object>} The result of the patch operation.
	 */
	async patchItem(_id,_data){ // path Embedded in _data
		return await this.datamanager.patchItem(_id,_data)
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
	 * Registers a new candidate to MyLife membership
	 * @public
	 * @param {object} _candidate { 'email': string, 'humanName': string, 'avatarNickname': string }
	 */
	async registerCandidate(_candidate){
		return await this.datamanager.registerCandidate(_candidate)
	}
}
//	exports
export default Dataservices