/**
 * @fileOverview This file contains the Dataservices class, which manages data interactions for the MyLife platform.
 * It includes functionality for handling avatars, chats, items, and other core elements of the platform's data.
 * @version 1.0.0
 */
//	imports
import Datamanager from "./datamanager.mjs"
/**
 * Array fields in this set are treated as append-only variants: use `op: 'add'` with the `/-` path suffix so each element is pushed atomically without overwriting concurrent writes.
 * Arrays not in this set are replaced wholesale rather than appended to.
 * Examples of append-only arrays: `feedback`, `validations`.
 */
const mAddOnlyArrayFields = new Set([
    'feedback',
	'messages',
	'validations',
])
/**
 * The Dataservices class.
 * This class provides methods to interact with the data layers of the MyLife platform, predominantly the Azure Cosmos and PostgreSQL database.
 * Any new Dataservices class is instantiated with a member id, which is used to identify the member in the database, and retrieve the core data for that member.
 */
class Dataservices {
    /**
     * Represents the core information about the member.
     * @private
     */
    #core
    /**
     * Manager for data-related operations based on long-term storage types; currently Cosmos NoSQL.
     * @private
     */
    #Datamanager
    /**
     * Shared global utilities injected at construction time (validation, document helpers, etc.).
     * @private
     */
    #Globals
    /**
     * Identifies a specific partition or segment of the data storage
     * that this instance of Dataservices interacts with. Useful for multi-tenant
     * architectures or when data is sharded.
     * @private
     */
    #partitionId
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
     * @param {Globals} Globals - Shared global utilities instance.
     */
	constructor(_mbr_id, Globals){
		this.#partitionId = _mbr_id
		this.#Globals = Globals
		this.#Datamanager = new Datamanager(this.#partitionId)
	}
    /**
     * Initializes the Datamanager instance and sets up core data.
     * @async
	 * @public
     * @returns {Dataservices} The instance of Dataservices.
     */
	async init(){
		await this.#Datamanager.init()
		const _excludeProperties = { '_none': true, }	//	populate if exclusions are required
		const core = Object.entries(this.#Datamanager.core)	//	array of arrays
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
		if(!core)
			throw new Error('Dataservices::init()::No core data found for member', this.#partitionId)
		this.#core = Object.assign({}, ...core)	//	init core
		return this
	}
	//	getters/setters
	get core(){
		return this.#core
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
	 * Upon MyLife account creation, generates `core` and saves to database.
	 * @param {object} core - Data object containing member's initial core data from which avatar object will be derived
	 * @returns {object} - The saved avatar data object
	 */
	async addAvatar(core){
		if(!this.isMyLife)
			throw new Error('MyLife avatar required for addAvatar()', this.mbr_id)
		return await this.pushItem(mAvatarProperties(core, this.#Globals))
	}
	/**
	 * Upon MyLife account creation, generates `core` and saves to database.
	 * @param {object} core - Data object containing member's initial core data
	 * @returns {object} - The core object
	 */
	async addCore(core){
		const { id, mbr_id, } = core
		if(!id?.length || !mbr_id?.length)
			throw new Error('`core` must be a pre-formed object with id and mbr_id')
		const extantCore = await this.getItem(id, undefined, mbr_id)
		if(extantCore){
			return { core: extantCore, success: false, } // no alterations, failure
		}
		core = { // enforce core data structure
			...core,
			being: 'core',
			id,
			form: 'human',
			name: this.#Globals.createDocumentName(mbr_id, id, 'core'),
			mbr_id,
		}
		core = await this.pushItem(core)
		return { core, success: true, }
	}
	/**
	 * Retrieves all available missions for the system avatar. Members are handled by their own avatar.
	 * @returns {String[]} - An array of the currently available missions by guid id
	 */
	async availableMissions(mbr_id=this.mbr_id){
		const scope = []
		scope
			.push({
				name: '@scope',
				value: 'public',
			})
		const missions = await this.getItems('mission', undefined, scope, 'system', mbr_id)
		return missions
	}
	/**
	 * Retrieves all public experiences (i.e., owned by MyLife).
	 * @public
	 * @async
	 * @returns {Object[]} - An array of the currently available public experiences.
	 */
	async availableExperiences(){
		return await this.getItemsByFields(
			'experience',
			[{ name: '@public', value: true }],
			'system',
		)
	}
	/**
	 * Get a bot specified by id or type.
	 * @public
	 * @param {string} id - The bot id.
	 * @param {string} type - The bot type.
	 * @returns {object} - The bot or `undefined` if no bot found.
	 */
	async bot(id, type='personal-avatar'){
		if(id){
			return await this.getItem(id)
		} else {
			const bots = await this.bots(type)
			return bots[0]
		}
	}
	/**
	 * Gets all bots of a given type for a given member.
	 * @param {string} type - The bot type
	 * @param {string} mbr_id - The member id
	 * @returns {Object[]} - The bots or empty array if no bots found
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
	 * @param {string} _type - The type of bot instruction
	 * @returns {Object[]} - An array of bot instruction or `undefined` if no bot instruction found
	 */
	async botInstructions(_type){
		if(_type?.length) 
			_type = [{ name: '@type', value: _type }]
		return await this.getItems(
			'bot-instructions',
			undefined,
			_type,
			'system'
		)
	}
    /**
     * Challenges access to a member ID via passphrase, running against a stored procedure in the database.
     * @async
	 * @public
     * @param {string} mbr_id - The member ID
     * @param {string} passphrase - The passphrase for access
	 * @param {boolean} caseInsensitive - Whether to ignore case in passphrase, defaults to `false
	 * @returns {Promise<boolean>} - `true` if challenge is successful
     */
	async challengeAccess(mbr_id, passphrase, caseInsensitive){
		return await this.#Datamanager.challengeAccess(mbr_id, passphrase, caseInsensitive)
	}
	/**
	 * Proxy to retrieve stored actions.
	 * @returns {Object[]} - The collection of actions
	 */
	async collectionActions(){
		return await this.getItems('action')
	}
	async collectionAssistantType(type){

	}
	/**
	 * Proxy to retrieve stored conversations.
	 * @returns {Object[]} - The collection of conversations
	 */
	async collectionConversations(){
		return await this.getItems('chat')
	}
	/**
	 * Proxy to retrieve journal entry items.
	 * @returns {Object[]} - The journal entry items
	 */
	async collectionEntries(){
		return await this.getItemsByFields(
			'story',
			[{ name: '@type', value: 'entry' }],
		)
	}
	/**
	 * Proxy to retrieve lived experiences.
	 * @returns {Object[]} - The lived experiences
	 */
	async collectionLivedExperiences(){
		return await this.getItems('lived-experience')
	}
	/**
	 * Proxy to retrieve files.
	 * @returns {Object[]} - The member's files
	 */
	async collectionFiles(){
		return await this.getItems('file')
	}
	/**
	 * Proxy to retrieve biographical items.
	 * @returns {Object[]} - The biographical items
	 */
	async collectionMemories(){
		return await this.getItemsByFields(
			'story',
			[{ name: '@type', value: 'memory' }],
		)
	}
	/**
	 * Proxy to retrieve stances.
	 * @returns {Object[]} - The stances
	 */
	async collectionIssues(){
		return await this.getItemsByFields(
			'stance',
			[{ name: '@type', value: 'issue' }],
		)
	}
	/**
	 * Proxy to retrieve values.
	 * @returns {Object[]} - The values
	 */
	async collectionValues(){
		return await this.getItemsByFields(
			'stance',
			[{ name: '@type', value: 'value' }],
		)
	}
	/**
	 * Proxy to retrieve all story items.
	 * @returns {Object[]} - The story items
	 */
	async collectionStories(){
		return await this.getItems('story')
	}
    /**
     * Get member collection items.
	 * @todo - only roughed in by hand atm
	 * @public
	 * @async
     * @param {string} type - The type of collection to retrieve, `false`-y = all
     * @returns {Object[]} - The collection items with no wrapper
     */
	async collections(type){
		switch(type){
			case 'all':
				return await Promise.all([
					this.collectionConversations(),
					this.collectionEntries(),
					this.collectionLivedExperiences(),
					this.collectionFiles(),
					this.collectionMemories(),
					this.collectionIssues(),
					this.collectionValues(),
				])
					.then(([conversations, entries, experiences, files, memories, issues, values])=>[
						...conversations,
						...entries,
						...experiences,
						...files,
						...memories,
						...issues,
						...values,
					])
					.catch(err=>{
						console.log('Dataservices::collections()::error', err)
						return []
					})
			case 'action':
				return await this.collectionActions()
			case 'chat':
			case 'conversation':
				return await this.collectionConversations()
			case 'entry':
				return await this.collectionEntries()
			case 'experience':
				return await this.collectionLivedExperiences()
			case 'file':
				return await this.collectionFiles()
			case 'issue':
			case 'issues':
			case 'stance':
				return await this.collectionIssues()
			case 'item':
				return []
			case 'memory':
				return await this.collectionMemories()
			case 'value':
			case 'values':
				return await this.collectionValues()
			case 'story':
				return await this.collectionStories()
			default: // try to return based on assistantType
				return this.collectionAssistantType(type)

		}
	}
	/**
	 * Creates a new bot in the database.
	 * @param {object} bot - The bot object to create
	 * @returns {object} - The bot object
	 */
	async createBot(bot){
		/* validation */
		const { id, type, } = bot
		if(!type?.length)
			throw new Error('ERROR::createBot::Bot `type` required.')
		if(!this.#Globals.isValidGuid(id))
			bot.id = this.newGuid
		bot.being = 'bot'
		/* create bot */
		return await this.pushItem(bot)
	}
    /**
     * Delete an item from member container.
     * @async
     * @public
	 * @param {Guid} id - The id of the item to delete
	 * @param {string} containerId - The container to use, overriding default
	 * @param {string} partitionId - The member id (or other) to use, overriding default
     * @returns {boolean} - true if item deleted successfully
     */
	async deleteItem(id, containerId, partitionId=this.mbr_id){
		if(!id?.length)
			return false
		const success = await this.#Datamanager.deleteItem(id, containerId, partitionId)
		return success
	}
	async findRegistrationByEmail(_email){
		const registered = await this.getItems(
			'registration',
			undefined,
			[{ name: '@email',
				value: _email,
			}],
			'registration',
		)
		if(registered?.length > 1){
			// @todo - handle multiple registrations
		}
		return registered?.[0]
	}
	/**
	 * Retrieves a specific alert by its ID. _Currently placehoder_.
	 * @async
	 * @public
	 * @param {string} _alert_id - The unique identifier for the alert
	 * @returns {Promise<Object>} The alert corresponding to the provided ID
	 */
	async getAlert(_alert_id){
		return await this.getItem(_alert_id, 'system')
	}
	/**
	 * Retrieves all system alerts. _Currently only works with system alerts, but intends to be expanded, refactor_.
	 * This method is typically used to get all alert entities under a specific object.
	 * @async
	 * @public
	 * @param {string} _object_id - The parent object ID to search for associated alerts
	 * @returns {Promise<Array>} An array of alerts associated with the given parent ID
	 */
	async getAlerts(){	
		const paramsArray = [
			{ name: '@being', value: 'alert' },
			{ name: '@currentDate', value: new Date().toISOString() }
		]
		const query = `SELECT * FROM c WHERE c.being = @being AND @currentDate >= c.timestampRange['start'] AND @currentDate <= c.timestampRange['end']`
		return await this.#Datamanager.getItems(
			{ query: query, parameters: paramsArray },
			'system',
		)
	}
	/**
	 * Returns the avatar associated with the member.
	 * @returns {object} - The avatar document or `undefined` if no avatar found.
	 */
	async getAvatar(){
		const avatar = await this.getAvatars()
		return avatar
	}
	/**
	 * Get all Member Avatars, but given 1-to-1 relationship, only returns first.
	 * @returns {object} - The avatar document or `undefined` if no avatar found.
	 */
	async getAvatars(){
		const avatar = await this.getItems('avatar')
		return avatar?.[0] // force reduction to single avatar
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
	 * Retrieves a specific item by its ID.
	 * @async
	 * @public
	 * @param {string} id - The unique identifier for the item.
	 * @param {string} container_id - The container to use, overriding default: `Members`.
	 * @param {string} mbr_id - The member id to use, overriding default.
	 * @returns {Promise<Object>} The item corresponding to the provided ID.
	 */
	async getItem(id, container_id, mbr_id=this.mbr_id) {
		if(!id)
			return null
		try{
			return await this.#Datamanager.getItem(
				id,
				container_id,
				{ partitionKey: mbr_id, populateQuotaInfo: false, },
			)
		}
		catch(error){
			console.log('Dataservices::getItem()::error', error, id, mbr_id, container_id,)
			return null
		}
	}
	/**
	 * Retrieves first item based on specified parameters.
	 * @async
	 * @public
	 * @param {string} being 
	 * @param {string} field - Field name to match.
	 * @param {string} value - Value to match.
	 * @param {string} container_id - The container name to use, overriding default.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<object>} An object (initial of arrau) matching the query parameters.
	 */
	async getItemByField(being, field, value, container_id, _mbr_id=this.mbr_id){
		const _item =  await this.getItemByFields(
			being,
			[{ name: `@${field}`, value: value }],
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
	 * @param {array} fields - Array of name/value pairs to select, format: [{name: `@${field}`, value: value}],
	 * @param {string} container_id - The container name to use, overriding default.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<object>} An object (initial of arrau) matching the query parameters.
	 */
	async getItemByFields(being, fields, container_id, _mbr_id=this.mbr_id){
		const _items =  await this.getItemsByFields(
			being,
			fields,
			container_id,
			_mbr_id,
		)
		return _items?.[0]
	}
	/**
	 * Retrieves items based on specified parameters.
	 * @async
	 * @public
	 * @param {string} being - The type of items to retrieve (almost always required; currently optional for collection retrieval by Assistant Type, as could have several different beings)
	 * @param {array} [selects=[]] - Fields to select; if empty, selects all fields.
	 * @param {Array<Object>} [paramsArray=[]] - Additional query parameters.
	 * @param {string} container_id - The container name to use, overriding default.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<Array>} An array of items matching the query parameters.
	 */
	async getItems(being, selects=[], paramsArray=[], container_id, _mbr_id=this.mbr_id) {	//	paramsArray is array of objects { name: '${varName}' }
		// @todo: incorporate date range functionality into this.getItems()
		const prefix = 'u'
		if(being?.length)
			paramsArray.unshift({ name: '@being', value: being, })
		const _selectFields = (selects.length)
			?	[...new Set([...this.#rootSelect, ...selects])].map(field=>(`${prefix}.`+field)).join(',')
			:	'*'
		let query = `select ${ _selectFields } from ${ prefix }`
		paramsArray /* iterate array of parameters */
			.forEach((param, index)=>{
				const { name, type, value=null,  } = param
				let dbName = name
				if(!dbName?.length || ( dbName.length===1 && dbName==='@' ))
					return
				if(!dbName.startsWith('@'))
					dbName = '@' + dbName
				query += ` ${ index === 0 ? 'where' : 'and' } `
				const appendValue = type==='contains'
					? `contains(lower(${ prefix }.${ dbName.slice(1) }), lower(${ dbName }))`
					: `${ prefix }.${ dbName.slice(1) }=${ dbName }`
				query += appendValue
		})
		try {
			const items = await this.#Datamanager.getItems(
				{ query: query, parameters: paramsArray, },
				container_id,
				{
					partitionKey: _mbr_id,
					populateQuotaInfo: false, // set this to true to include quota information in the response headers
				},
			)
			return items
		} catch(_error) {
			console.log('Dataservices::getItems()::error', _error, being, query, paramsArray, container_id)
		}
	}
	/**
	 * Retrieve items based on specified parameters.
	 * @async
	 * @public
	 * @param {string} being - The type of items to retrieve.
	 * @param {array} fields - Array of name/value pairs to select, format: [{name: `@${field}`, value: value}],
	 * @param {string} container_id - The container name to use, overriding default.
	 * @param {string} _mbr_id - The member id to use, overriding default.
	 * @returns {Promise<Array>} An array of items matching the query parameters.
	 */
	async getItemsByFields(being, fields, container_id, _mbr_id=this.mbr_id){
		const _items =  await this.getItems(
			being,
			undefined,
			fields,
			container_id,
			_mbr_id,
		)
		return _items
	}
	/**
	 * Returns Array of hosted members based on validation requirements.
	 * @param {Array} validations - Array of validation strings to filter membership.
	 * @returns {Promise<Array>} - Array of string ids, one for each hosted member.
	 */
	async hostedMembers(validations){
		return await this.#Datamanager.hostedMembers(validations)
	}
	/**
	 * Patches an item by its ID with the provided data.
	 * @async
	 * @param {string} id - The unique identifier for the item to be patched
	 * @param {Object} data - The data to patch the item with; object of key/value pairs to be transformed into patch operations
	 * @param {string} containerId - The container to use, overriding default
	 * @param {string} partitionId - The partition ID to use, overriding default
	 * @param {string} rootPath - The path for patching, defaults to '/'
	 * @returns {Promise<Object>} The result of the patch operation
	 */
	async patch(id, data, containerId, partitionId, rootPath = '/'){
		const patchOperations = []
		id = id
			?? data.id
		if(!id?.length)
			throw new Error('Dataservices::patch()::id required for patch operation.')
		const etag = data._etag
		delete data._etag
		for(const key of Object.keys(data)){
			if(['being', 'id', 'mbr_id'].includes(key))
				continue
			const value = data[key]
			const path = rootPath + key
			if(Array.isArray(value)){
				if(mAddOnlyArrayFields.has(key)) /* Append-only arrays (e.g. feedback): additive */
					for(const element of value) 
						patchOperations.push({ op: 'add', path: path + '/-', value: element, })
				else /* Canonical-state arrays: replace the whole field in one op */
					patchOperations.push({ op: 'set', path, value, })
			} else
				patchOperations.push({ op: 'add', path, value, })
		}
		const patchBatches = [] // Split operations into batches of 10 per Cosmos DB limitations
		while(patchOperations.length){
			patchBatches.push(patchOperations.splice(0, 10))
		}
		let endResult
		for(const batch of patchBatches){ // Perform the patch operation(s) for each batch
			endResult = await this.patchItem(id, batch, containerId, partitionId ?? data?.mbr_id, etag)
		}
		return endResult
	}
	/**
	 * Patches an item with the given data. The path for each patch operation is embedded in the data.
	 * @async
	 * @param {string} id - The unique identifier for the item to be patched
	 * @param {Array<Object>} data - The data for patching, including the path and operation
	 * @param {string} containerId - The container to use, overriding default
	 * @param {string} partitionId - The partition ID to use, overriding default
	 * @param {string} etag - The ETag value for concurrency control, optional but recommended to prevent conflicts
	 * @returns {Promise<Object>} The result of the patch operation.
	 */
	async patchItem(id, data, containerId, partitionId, etag){
		return await this.#Datamanager.patchItem(id, data, containerId, partitionId, etag)
	}
    /**
     * Pushes a new item to the data manager.
     * @async
	 * @public
     * @param {Object} data - The data to be pushed
	 * @param {String} container_id - The container to push into
     * @returns {Promise<Object>} The result of the push operation
     */
	async pushItem(data, containerId){
		return await this.#Datamanager.pushItem(data, containerId)
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
			const response = await this.patchItem(this.core.id, [{ op: 'add', path: '/passphrase', value: passphrase }])
			return response?.passphrase===passphrase
		} catch(err){
			console.log('Dataservices::resetPassphrase()::error', err)
			return false
		}
    }
	async saveExperience(experience){
		const savedExperience = await this.pushItem(experience)
		return savedExperience
	}
	/**
	 * Retrieves a share object and its associated item from the database.
	 * @param {Guid} sid - The share id
	 * @param {string} type - The share type
	 * @returns {object} - The share object from database with Item in-built
	 */
	async share(sid, type){
		const shared = await this.#Datamanager.share(sid, type)
		return shared
	}
	/**
	 * Tests partition key for member
	 * @public
	 * @param {string} mbr_id member id
	 * @returns {boolean} - `true` if partition key is active, `false` otherwise.
	 */
	async testPartitionKey(mbr_id){
		if(!this.isMyLife)
			return false
		return await this.#Datamanager.testPartitionKey(mbr_id)
	}
	/**
	 * Sets a bot in the database.
	 * @param {object} botData - The bot data to update
	 * @returns {object} - The bot document
	 */
	async updateBot(botData){
		const { id, type: discardType='avatar', ...updateBotData } = botData
		if(!Object.keys(updateBotData).length)
			return botData
		if(updateBotData.bot_name?.length)
			updateBotData.name = `bot_${ discardType }_${ updateBotData.bot_name }_${ id }`
		botData = await this.patch(id, updateBotData)
		return botData
	}
	/**
	 * Returns the registration record by Id.
	 * @param {string} candidateId - Guid for registration record in system container.
	 * @returns {object} - The registration document, if exists.
	 */
	async validateRegistration(candidateId){
		const { mbr_id, } = this
		const candidate = await this.getItem(candidateId, 'registration', mbr_id)
		if(!candidate)
			throw new Error(`Registration not found: ${ candidateId }`)
		const { avatarName, id, } = candidate
		if(id?.length){
			candidate.mbr_id = this.#Globals.createMbr_id(avatarName, id) // overwrites MyLife mbr_id
			const exists = await this.testPartitionKey(candidate.mbr_id)
			if(exists)
				throw new Error('Registrant already a member!')
			candidate.validated = true
		}
		return candidate
	}
	/* getters/setters */
	get newGuid(){
		return this.#Globals.newGuid
	}
}
/* modular functions */
/**
 * Creates new avatar property data package to be consumed by Avatar class `constructor`. Defines critical avatar fields as: ["being", "id", "mbr_id", "name", "names", "nickname", "proxyBeing", "type"].
 * @module
 * @param {object} core - Datacore object, required properties below:
 * @property {Guid} avatarId - Avatar id
 * @property {Guid} id - Member core id
 * @property {string} mbr_id - Member id
 * @param {object} Globals - Globals object
 * @returns {object} - Avatar property data package
 */
function mAvatarProperties(core, Globals){
	const {
		avatarId: id,
		avatarName,
		id: coreId,
		mbr_id,
		names=['default-name-error'],
		...avatarProperties
	} = core
	const being = 'avatar'
	const nickname = avatarName
		?? Globals.sysName(mbr_id)
	const name = `avatar_${ nickname }_${ id }`
	const object_id = id
	const parent_id = object_id
	const proxyBeing = 'human'
	const stripProperties = [
		'assistant',
		'assistant_id',
		'avatarId',
		'avatarName',
		'birth',
		'bot_id',
		'bots',
		'command_word',
		'conversations',
		"email",
		'form',
		'format',
		'messages',
		'metadata',
		'names',
		'passphrase',
		'thread',
		'thread_id',
		'validation',
		'validations',
	]
	const type = 'openai_gpt'
	stripProperties.forEach(prop=>{
		delete avatarProperties[prop]
	})
	return {
		...avatarProperties,
		being,
		id,
		mbr_id,
		name,
		names,
		nickname,
		object_id,
		parent_id,
		proxyBeing,
		setupComplete: false,
		type,
	}
}
/* exports */
export default Dataservices