/**
 * @fileOverview This file contains the Dataservices class, which manages data interactions for the MyLife platform.
 * It includes functionality for handling avatars, chats, items, and other core elements of the platform's data.
 * @version 1.0.0
 */
//	imports
import Datamanager from "./mylife-datamanager.mjs"
import PgvectorManager from "./mylife-pgvector-datamanager.mjs"
/**
 * The Dataservices class.
 * This class provides methods to interact with the data layers of the MyLife platform, predominantly the Azure Cosmos and PostgreSQL database.
 * Any new Dataservices class is instantiated with a member id, which is used to identify the member in the database, and retrieve the core data for that member.
 */
class Dataservices {
	/**
	 * Identifies currently available selection sub-types (i.e., `being`=@var) for the data service.
	 * @private
	 */
	#collectionTypes = ['chat', 'conversation', 'entry', 'experience', 'file', 'library', 'story']
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
		return this.mbr_id===process.env.MYLIFE_SERVER_MBR_ID ?? false
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
	 * @param {string} type - The bot type.
	 * @param {string} mbr_id - The member id.
	 * @returns {array} - The bots or empty array if no bots found.
	 */
	async bots(type, mbr_id=this.mbr_id){
		if(type){
			return await this.getItems(
				'bot',
				undefined,
				[{ name: '@type', value: type }],
				undefined,
				mbr_id,
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
	/**
	 * Proxy to retrieve stored conversations.
	 * @returns {array} - The collection of conversations.
	 */
	async collectionConversations(){
		return await this.getItems('chat')
	}
	/**
	 * Proxy to retrieve journal entry items.
	 * @returns {array} - The journal entry items.
	 */
	async collectionEntries(){
		return await this.getItems('entry')
	}
	/**
	 * Proxy to retrieve lived experiences.
	 * @returns {array} - The lived experiences.
	 */
	async collectionExperiences(){
		return await this.getItems('experience')
	}
	/**
	 * Proxy to retrieve files.
	 * @returns {array} - The member's files.
	 */
	async collectionFiles(){
		return await this.getItems('file')
	}
	/**
	 * Proxy to retrieve library items.
	 * @param {string} form - The form of the library items (such as: personal, album,).
	 * @returns {array} - The library items.
	 */
	async collectionLibraries(form){
		return await this.getItems('library')
	}
	/**
	 * Proxy to retrieve biographical story items.
	 * @returns {array} - The biographical story items.
	 */
	async collectionStories(){
		return await this.getItems('story')
	}
    /**
     * Get member collection items.
	 * @public
	 * @async
     * @param {string} type - The type of collection to retrieve, `false`-y = all.
     * @returns {array} - The collection items with no wrapper.
     */
	async collections(type){
		if(type?.length && this.#collectionTypes.includes(type))
			return await this.getItems(type)
		else
			return Promise.all([
				this.collectionConversations(),
				this.collectionEntries(),
				this.collectionExperiences(),
				this.collectionFiles(),
				this.collectionStories(),
			])
				.then(([conversations, entries, experiences, stories])=>[
					...conversations,
					...entries,
					...experiences,
					...stories,
				])
				.catch(err=>{
					console.log('mylife-data-service::collections() error', err)
					return []
				})
	}
	async datacore(_mbr_id){
		return await this.getItem(_mbr_id)
	}
    /**
     * Delete an item from member container.
     * @async
     * @public
     * @param {Guid} id - The id of the item to delete.
     * @returns {boolean} - true if item deleted successfully.
     */
	async deleteItem(id){
		return await this.datamanager.deleteItem(id)
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
		const paramsArray = [
			{ name: '@being', value: 'alert' },
			{ name: '@currentDate', value: new Date().toISOString() }
		]
		const query = `SELECT * FROM c WHERE c.being = @being AND @currentDate >= c.timestampRange['start'] AND @currentDate <= c.timestampRange['end']`

		return await this.datamanager.getItems(
			{ query: query, parameters: paramsArray },
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
	 * @param {string} being - The type of underlying datacore.
	 * @param {string} _category - The category of seed questions to retrieve.
	 * @returns {Promise<Object>} The item corresponding to the provided ID.
	 */
	async getContributionQuestions(being, _category, _maxNumber=3){
		return (await this.getItems(
			being,
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
	 * @param {string} container_id - The container to use, overriding default: `Members`.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<Object>} The item corresponding to the provided ID.
	 */
	async getItem(_id, container_id, _mbr_id=this.mbr_id) {
		if(!_id) return
		try{
			return await this.datamanager.getItem(
				_id,
				container_id,
				{ partitionKey: _mbr_id, populateQuotaInfo: false, },
			)
		}
		catch(_error){
			console.log('mylife-data-service::getItem() error')
			console.log(_error, _id, container_id,)
			return
		}
	}
	/**
	 * Retrieves first item based on specified parameters.
	 * @async
	 * @public
	 * @param {string} being 
	 * @param {string} _field - Field name to match.
	 * @param {string} _value - Value to match.
	 * @param {string} container_id - The container name to use, overriding default.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<object>} An object (initial of arrau) matching the query parameters.
	 */
	async getItemByField(being, _field, _value, container_id, _mbr_id=this.mbr_id){
		const _item =  await this.getItemByFields(
			being,
			[{ name: `@${_field}`, value: _value }],
			container_id,
			_mbr_id,
		)
		return _item
	}
	/**
	 * Retrieves first item based on specified parameters.
	 * @async
	 * @public
	 * @param {string} being 
	 * @param {array} _fields - Array of name/value pairs to select, format: [{name: `@${_field}`, value: _value}],
	 * @param {string} container_id - The container name to use, overriding default.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<object>} An object (initial of arrau) matching the query parameters.
	 */
	async getItemByFields(being, _fields, container_id, _mbr_id=this.mbr_id){
		const _items =  await this.getItemsByFields(
			being,
			_fields,
			container_id,
			_mbr_id,
		)
		return _items?.[0]
	}
	/**
	 * Retrieves items based on specified parameters.
	 * @async
	 * @public
	 * @param {string} being - The type of items to retrieve.
	 * @param {array} [selects=[]] - Fields to select; if empty, selects all fields.
	 * @param {Array<Object>} [paramsArray=[]] - Additional query parameters.
	 * @param {string} container_id - The container name to use, overriding default.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<Array>} An array of items matching the query parameters.
	 */
	async getItems(being, selects=[], paramsArray=[], container_id, _mbr_id=this.mbr_id) {	//	paramsArray is array of objects { name: '${varName}' }
		// @todo: incorporate date range functionality into this.getItems()
		const _prefix = 'u'
		paramsArray.unshift({ name: '@being', value: being })	//	add primary parameter to array at beginning
		const _selectFields = (selects.length)
			?	[...new Set([...this.#rootSelect, ...selects])].map(field=>(`${_prefix}.`+field)).join(',')
			:	'*'
		let query = `select ${_selectFields} from ${_prefix}`	//	@being is required
		paramsArray	//	iterate through parameters
			.forEach(param=>{	//	param is an object of name, value pairs
				query += (param.name==='@being')
					?	` where ${_prefix}.${param.name.split('@')[1]}=${param.name}`	//	only manages string so far
					:	` and ${_prefix}.${param.name.split('@')[1]}=${param.name}`	//	only manages string so far
		})
		try{
			return await this.datamanager.getItems(
				{ query: query, parameters: paramsArray },
				container_id,
				{
					partitionKey: _mbr_id,
					populateQuotaInfo: false, // set this to true to include quota information in the response headers
				},
			)
		}
		catch(_error){
			console.log('mylife-data-service::getItems() error')
			console.log(_error, being, query, paramsArray, container_id,)
		}
	}
	/**
	 * Retrieve items based on specified parameters.
	 * @async
	 * @public
	 * @param {string} being - The type of items to retrieve.
	 * @param {array} _fields - Array of name/value pairs to select, format: [{name: `@${_field}`, value: _value}],
	 * @param {string} container_id - The container name to use, overriding default.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<Array>} An array of items matching the query parameters.
	 */
	async getItemsByFields(being, _fields, container_id, _mbr_id=this.mbr_id){
		const _items =  await this.getItems(
			being, 
			undefined,
			_fields, 
			container_id,
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
	 * @param {string} id - The unique identifier for the item to be patched.
	 * @param {Object} data - The data to patch the item with; object of key/value pairs to be transformed into patch operations.
	 * @param {string} [path='/'] - The path for patching, defaults to root.
	 * @returns {Promise<Object>} The result of the patch operation.
	 */
	async patch(id, data, path = '/') {
		const patchOperations = Object.keys(data)
			.filter(key => !['id', 'being', 'mbr_id'].includes(key)) // keys which must not be included in patch
			.map(key => {
				return { op: 'add', path: path + key, value: data[key] }
			})
		// Split operations into batches of 10 per Cosmos DB limitations
		const patchBatches = []
		while(patchOperations.length){
			patchBatches.push(patchOperations.splice(0, 10))
		}
		// Perform the patch operation(s) for each batch
		let endResult
		for(const batch of patchBatches){
			endResult = await this.patchItem(id, batch)
		}
		return endResult
	}
	/**
	 * Patches an item with the given data. The path for each patch operation is embedded in the data.
	 * @async
	 * @param {string} _id - The unique identifier for the item to be patched.
	 * @param {Array<Object>} data - The data for patching, including the path and operation.
	 * @returns {Promise<Object>} The result of the patch operation.
	 */
	async patchItem(_id, data){ // path Embedded in data
		return await this.datamanager.patchItem(_id , data)
	}
    /**
     * Pushes a new item to the data manager
     * @async
	 * @public
     * @param {Object} data - The data to be pushed
     * @returns {Promise<Object>} The result of the push operation
     */
	async pushItem(data){
		return await this.datamanager.pushItem(data)
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
    /**
     * Allows member to reset passphrase.
     * @param {string} passphrase 
     * @returns {boolean} - true if passphrase reset successful.
     */
    async resetPassphrase(passphrase){
        if(this.isMyLife)
            throw new Error('MyLife avatar cannot reset passphrase.')
        if(!passphrase?.length)
            throw new Error('Passphrase required for reset.')
        try{
			const response = await this.datamanager.patchItem(this.core.id, [{ op: 'add', path: '/passphrase', value: passphrase }])
			return response?.passphrase===passphrase
		} catch(err){
			console.log('mylife-data-service::resetPassphrase() error', err)
			return false
		}
    }
	/**
	 * Sets a bot in the database. Performs logic to reduce the bot to the minimum required data, as Mongo/Cosmos has a limitation of 10 patch items in one batch array.
	 * @param {object} bot - The bot object to set.
	 * @returns {object} - The bot object.
	 */
	async setBot(bot){
		const originalBot = await this.bot(bot.id)
		if(originalBot){ // update
			const dataUpdates = Object.keys(bot)
				.filter(key => !key.startsWith('_') && bot[key] !== originalBot[key])
				.reduce((obj, key) => {
					obj[key] = bot[key]
					return obj
				}, {})
			if(Object.keys(dataUpdates).length > 0){
				bot = this.patch(bot.id, dataUpdates)
			}
		} else { // add
			bot = this.pushItem(bot)
		}
		return bot
	}
	/**
	 * Submits a story to MyLife. Currently via API, but could be also work internally.
	 * @param {object} story - Story object.
	 * @returns {object} - The story document from Cosmos.
	 */
	async story(story){
		const storyItem = await this.datamanager.pushItem(story)
		return storyItem
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
/* exports */
export default Dataservices