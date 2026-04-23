/* imports */
//	import { DefaultAzureCredential } from "@azure/identity"
import { CosmosClient } from '@azure/cosmos'
import Config from './datasource-config.mjs'
import Globals from './globals.mjs'
/* module constants */
const mGlobals = new Globals()
//	define class
class Datamanager {
	#containers
	#core = null
	#coreId
	#partitionId
	//	constructor
	constructor(_mbr_id) {
		const _config = new Config(_mbr_id)
		const _options = {
			endpoint: _config.endpoint,
			key: _config.rw_id,
			userAgentSuffix: 'mylife-services',
			//	aadCredentials: new DefaultAzureCredential()
		}
		const _client = new CosmosClient(_options)
		this.database = _client.database(_config.members.id)
		this.#partitionId = _config.members.container.partitionId
		this.#coreId = _config.members.container?.coreId ?? this.#partitionId.split('|')[1]
		this.#containers = {
			members: this.database.container(_config.members.container.id),
			registration: this.database.container(_config.registration.container.id),
			shares: this.database.container(_config.shares.container.id),
			system: this.database.container(_config.system.container.id),
		}
		this.requestOptions = {
			partitionKey: this.#partitionId,
			populateQuotaInfo: false, // set this to true to include quota information in the response headers
		}
	}
	/* initialize */
	async init() {
		//	assign core
		this.#core = await this.#containers['members']
			.item(
				this.#coreId,
				this.#partitionId
			)
			.read()
		return this
	}
	/* public functions */
	/**
	 * Runs challenge Access routine for login and authentications
	 * @param {string} mbr_id - The member id to challenge
	 * @param {string} passphrase - The passphrase to resolve challenge
	 * @param {boolean} caseInsensitive - Whether to ignore case in passphrase, defaults to `false`
	 * @returns {Promise<boolean>} - `true` if challenge is successful
	 */
	async challengeAccess(mbr_id, passphrase, caseInsensitive=false){
		const { resource: result } = await this.#containers['members']
			.scripts
			.storedProcedure('checkMemberPassphrase')
			.execute(mbr_id, passphrase, caseInsensitive)
		return result
	}
	/**
	 * Deletes a specific item from container.
	 * @param {guid} id - The item id to delete.
	 * @param {string} containerId - The container to use, defaults to `this.containerDefault`
	 * @param {object} options - The request options, defaults to `this.requestOptions`
	 * @returns {Boolean} - Whether operation was successful and item was deleted, i.e., has no resource
	 */
	async deleteItem(id, containerId=this.containerDefault, partitionId=this.#partitionId){
		const { resource } = await this.#containers[containerId]
			.item(id, partitionId)
			.delete()
		return !resource
	}
	/**
	 * Retreives specific item from container.
	 * @param {guid} id - The item id to retrieve. 
	 * @param {string} containerId - The container to use, defaults to `this.containerDefault`.
	 * @param {object} options - The request options, defaults to `this.requestOptions`.
	 * @returns {object} The document JSON item retrieved.
	 */
	async getItem(id, containerId=this.containerDefault, options=this.requestOptions){	//	quick, inexpensive read; otherwise use getItems
		const partitionKey = options?.partitionKey
			?? this.#partitionId
		const { resource: retrievedItem } = await this.#containers[containerId]
			.item(id, partitionKey)
			.read(options)
		return retrievedItem
	}
	async getItems(_querySpec, containerId=this.containerDefault, _options=this.requestOptions){
		try{
			const { resources: items, } = await this.#containers[containerId]
				.items
				.query(_querySpec, _options)
				.fetchAll()
			return items
		} catch(error){
			console.log('Datamanager::getItems()::error', error)
			return []
		}
	}
	/**
	 * Returns Array of hosted members based on validation requirements.
	 * @param {Array} validations - Array of validation strings to filter membership.
	 * @returns {Promise<Array>} - Array of string ids, one for each hosted member.
	 */
	async hostedMembers(validations=['registration']){
		let sql = 'select c.mbr_id, c.openaiapikey, c.validations'
        + ' from root c'
        + ` where c.being='core'`
        + ` and c.form='human'`
		if(validations.length){
			sql += ` and is_array(c.validations) and array_length(c.validations) > 0`
			const validationChecks = validations
				.map(validation=>`array_contains(c.validations, '${validation}')`)
				.join(' and ')
			sql += ` and (${validationChecks})`
		}
        const querySpec = {
            query: sql,
            parameters: []
        }
        const { resources: documents } = await this.#containers['members']
            .items
            .query(querySpec, { enableCrossPartitionQuery: true })
            .fetchAll()
		if(!documents?.length)
			throw new Error('No hosted members found')
		return documents
	}
	/**
	 * Patches an item with the given data. The path for each patch operation is embedded in the data.
	 * @async
	 * @param {string} id - The unique identifier for the item to be patched
	 * @param {Array<Object>} item - The data for patching, including the path and operation
	 * @param {string} containerId - The container to use, overriding default
	 * @param {string} partitionId - The partition ID to use, overriding default
	 * @param {string} etag - The ETag value for concurrency control, optional but recommended to prevent conflicts
	 * @returns {Promise<Object>} The result of the patch operation.
	 */
	async patchItem(id, item, containerId=this.containerDefault, partitionId=this.#partitionId, etag){ // patch or update, depends on whether it finds id or not, will only overwrite fields that are in _item
		// [Partial Document Update, includes node.js examples](https://learn.microsoft.com/en-us/azure/cosmos-db/partial-document-update)
		if(!Array.isArray(item))
			item = [item]
		const options = {}
		if(etag)
			options.accessCondition = {
				type: "IfMatch",
				condition: etag
			}
		try{
			const { resource: update, } = await this.#containers[containerId]
				.item(id, partitionId)
				.patch(item, options) //	see below for filter-patch example
			return update
		} catch (error){
			// **note**: error code 412 indicates ETag mismatch
			console.log('Datamanager::patchItem::error', error, item, id, containerId, partitionId, etag)
			return {}
		}
	}
	/**
	 * Pushes an item into a container.
	 * @param {object} item - The item to push into the container.
	 * @param {String} containerId - The container to push the item into, defaults to `this.containerDefault`.
	 * @returns {Promise<object>} - The document JSON item pushed.
	 */
	async pushItem(item, containerId=this.containerDefault){
		/* validate item */
		const { being, id, mbr_id, } = item
		if(!being?.length)
			throw new Error('property `being` is required')
		if(!id?.length)
			item.id = this.globals.newGuid
		if(!mbr_id?.length)
			item.mbr_id = this.#partitionId
		const { resource: doc } = await this.#containers[containerId]
			.items
			.upsert(item)
		return doc
	}
	/**
	 * Retrieves a share object and its associated item from the database.
	 * @param {Guid} sid - The share id
	 * @returns {object} - The share object from database with Item in-built
	 */
	async share(sid){
		const { resource: shareItem } = await this.#containers['shares']
			.item(sid, 'memory')
			.read()
		return shareItem
	}
	/**
	 * Registers a new candidate to MyLife membership
	 * @public
	 * @param {object} _candidate { 'avatarName': string, 'email': string, 'humanName': string, }
	 */
	async registerCandidate(_candidate){
		const { resource: doc } = await this.#containers['registration']
			.items
			.upsert(_candidate)
		return doc
	}
	/**
	 * Checks if provided mbr_id is an active partition key.
	 * @param {string} mbr_id - The member id, also container name, to test.
	 * @returns {boolean} - `true` if partition key is active, `false` otherwise.
	 */
	async testPartitionKey(mbr_id){
		const { resource: result } = await this.#containers['members']
			.scripts
			.storedProcedure('testPartitionKey')
			.execute(mbr_id)
		return result
	}
	/* getters/setters */
	/**
	 * Returns container default for MyLife data.
	*/
	get containerDefault(){
		return 'members'
	}
	/**
	 * Returns datacore.
	*/
	get core(){
		return this.#core?.resource
	}
	get globals(){
		return mGlobals
	}
	get mbr_id(){
		return this.core.mbr_id
			?? this.#partitionId
	}
}
//	exports
export default Datamanager
/*
COLLECTION PATCH:
Body itself is the array of operations, second parameter is options, for configuration and filter?
const filter = 'FROM products p WHERE p.used = false'

const operations =
[
    { op: 'replace', path: '/price', value: 100.00 }
];

const { resource: updated } = await container
    .item(
        'e379aea5-63f5-4623-9a9b-4cd9b33b91d5', 
        'road-bikes'
    )
    .patch(
        body = operations,
        options = filter
    );
*/