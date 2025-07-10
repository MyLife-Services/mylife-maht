/* imports */
//	import { DefaultAzureCredential } from "@azure/identity"
import { CosmosClient } from '@azure/cosmos'
import Config from './mylife-datasource-config.mjs'
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
	async init(){
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
        const { resources: members } = await this.#containers['members']
            .items
            .query(querySpec, { enableCrossPartitionQuery: true })
            .fetchAll()
		if(!members?.length)
			throw new Error('No hosted members found')
		return members
	}
    /**
     * Looks up a member by their email and external id.
     * @todo - generalize, currently customized for google case
     * @param {string} provider - The OAuth provider (e.g. "google")
     * @param {string} email - The email address of the member
     * @param {string} sub - The external id of the member
     * @returns {Promise<string>} - The member id if found, otherwise null
     */
    async memberLookup(provider, email, sub){
		const query = {
			query: "SELECT * FROM c WHERE c.being = 'core' AND (c.email = @email OR c.sub = @sub)",
			parameters: [
				{ name: "@email", value: email },
				{ name: "@sub", value: sub }
			]
		}
		const { resources: members } = await this.#containers['members']
            .items
            .query(query, { enableCrossPartitionQuery: true })
            .fetchAll()
		if(!members.length) /* unknown member */
			return
		if(members.length > 1) /* hyper-members */
			return console.warn('Datamanager::memberLookup()::**multiple members found** for email/sub', email, sub, members.map(m=>m.mbr_id))
		const { id, mbr_id, sub: memberSub } = members[0]
		if(!mbr_id?.length)
			return
		console.log('Datamanager::memberLookup()::found member', mbr_id, id, sub, memberSub)
		if(!memberSub?.length || memberSub !== sub)
			await this.patchItem(id, { op: 'add', path: '/sub', value: sub }, this.containerDefault, mbr_id)
		return mbr_id
    }
	/**
	 * Patches or updates an item in a container.
	 * @param {Guid} id - The item id to patch or update
	 * @param {object|Array} item - The item node (or nodes) to update { op: 'add', path, value, }
	 * @param {string} container_id - The container id
	 * @param {string} partitionId - The partition id
	 * @returns {Promise<object>} - The updated document JSON item
	 */
	async patchItem(id, item, container_id=this.containerDefault, partitionId=this.#partitionId){ // patch or update, depends on whether it finds id or not, will only overwrite fields that are in _item
		// [Partial Document Update, includes node.js examples](https://learn.microsoft.com/en-us/azure/cosmos-db/partial-document-update)
		if(!Array.isArray(item))
			item = [item]
		try{
			const { resource: update, } = await this.#containers[container_id]
				.item(id, partitionId)
				.patch(item) //	see below for filter-patch example
			return update
		} catch (error){
			console.log('Datamanager::patchItem::error', error, item, id, container_id, partitionId)
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