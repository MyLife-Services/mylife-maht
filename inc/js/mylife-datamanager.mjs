/* imports */
//	import { DefaultAzureCredential } from "@azure/identity"
import { CosmosClient } from '@azure/cosmos'
import chalk from 'chalk'
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
		console.log(chalk.yellowBright('database, container, core initialized:',chalk.bgYellowBright(`${this.#containers['members'].id} :: ${this.database.id} :: ${this.#core.resource.id}`) ))
		return this
	}
	/* public functions */
	async challengeAccess(mbr_id, passphrase){
		//	in order to obscure passphrase, have db make comparison (could include flag for case insensitivity)
		// Execute the stored procedure
		const { resource: result } = await this.#containers['members']
			.scripts
			.storedProcedure('checkMemberPassphrase')
			.execute(mbr_id, passphrase, true)	//	first parameter is partition key, second is passphrase, third is case sensitivity
		return result
	}
	/**
	 * Deletes a specific item from container.
	 * @param {guid} id - The item id to delete. 
	 * @param {string} containerId - The container to use, defaults to `this.containerDefault`.
	 * @param {object} options - The request options, defaults to `this.requestOptions`.
	 * @returns {object} The document JSON item retrieved.
	 */
	async deleteItem(id, containerId=this.containerDefault, options=this.requestOptions){
		const { resource } = await this.#containers[containerId]
			.item(id, this.#partitionId)
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
		const { resource: retrievedItem } = await this.#containers[containerId]
			.item(id, this.#partitionId)
			.read(options)
		return retrievedItem
	}
	async getItems(_querySpec, containerId=this.containerDefault, _options=this.requestOptions ){
		const { resources } = await this.#containers[containerId]
			.items
			.query(_querySpec, _options)
			.fetchAll()
		return resources
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
	async patchItem(_id, _item, _container_id=this.containerDefault){	//	patch or update, depends on whether it finds id or not, will only overwrite fields that are in _item
		//	[Partial Document Update, includes node.js examples](https://learn.microsoft.com/en-us/azure/cosmos-db/partial-document-update)
		if(!Array.isArray(_item)) _item = [_item]
		const { resource: _update } = await this.#containers[_container_id]
			.item(_id, this.#partitionId)
			.patch(_item)	//	see below for filter-patch example
		return _update
	}
	async pushItem(_item, _container_id=this.containerDefault){
		_item.id = _item?.id??this.globals.newGuid
		_item.mbr_id = _item?.mbr_id??this.#partitionId
		const { resource: doc } = await this.#containers[_container_id]
			.items
			.upsert(_item)
		return doc
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