/* imports */
//	import { DefaultAzureCredential } from "@azure/identity"
import { CosmosClient } from '@azure/cosmos'
import chalk from 'chalk'
import { _ } from 'ajv'
import Config from './mylife-datasource-config.mjs'
import Globals from './globals.mjs'
/* modular constants */
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
		this.#coreId = _config.members.container?.coreId??this.#partitionId.split('|')[1]
		this.#containers = {
			contribution_responses: this.database.container(_config.contributions.container.id),
			members: this.database.container(_config.members.container.id),
			registration: this.database.container(_config.registration.container.id),
			system: this.database.container(_config.system.container.id),
		}
		this.requestOptions = {
			partitionKey: this.#partitionId,
			populateQuotaInfo: false, // set this to true to include quota information in the response headers
		}
	}
	//	init function
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
	//	getter/setter property functions
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
	//	public functions
	async challengeAccess(_mbr_id, _passphrase){
		//	in order to obscure passphrase, have db make comparison (could include flag for case insensitivity)
		// Execute the stored procedure
		const { resource: _result } = await this.#containers['members']
			.scripts
			.storedProcedure('checkMemberPassphrase')
			.execute(_mbr_id, _passphrase, true)	//	first parameter is partition key, second is passphrase, third is case sensitivity
		return _result
	}
	async deleteItem(_id) {}
	/**
	 * Retreives specific item from container.
	 * @param {guid} _id 
	 * @param {object} _options 
	 * @param {string} _container_id Container to use.
	 * @returns 
	 */
	async getItem(_id, _container_id=this.containerDefault, _options=this.requestOptions){	//	quick, inexpensive read; otherwise use getItems
		const { resource: _item } = await this.#containers[_container_id]
			.item(_id,this.#partitionId)
			.read(_options)
		return _item
	}
	async getItems(_querySpec, _container_id=this.containerDefault, _options=this.requestOptions ){
		const { resources } = await this.#containers[_container_id]
			.items
			.query(_querySpec, _options)
			.fetchAll()
		return resources
	}
	async patchItem(_id, _item, _container_id=this.containerDefault){	//	patch or update, depends on whether it finds id or not, will only overwrite fields that are in _item
		//	[Partial Document Update, includes node.js examples](https://learn.microsoft.com/en-us/azure/cosmos-db/partial-document-update)
		if(!Array.isArray(_item)) _item = [_item]
		const { resource: _update } = await this.#containers[_container_id]
			.item(_id,this.#partitionId)
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
	 * @param {object} _candidate { 'email': string, 'humanName': string, 'avatarNickname': string }
	 */
	async registerCandidate(_candidate){
		const { resource: doc } = await this.#containers['registration']
			.items
			.upsert(_candidate)
		return doc
	}
	async testPartitionKey(_mbr_id){
		const { resource: _result } = await this.#containers['members']
			.scripts
			.storedProcedure('testPartitionKey')
			.execute(_mbr_id)	//	first parameter is partition key, second is passphrase, third is case sensitivity
		return _result
	}
	/* getters/setters */
	get globals(){
		return mGlobals
	}
}
//	exports
export default Datamanager
/*
	async addItem(item) {
		debug('Adding an item to the database')
		item.date = Date.now()
		item.completed = false
		const { resource: doc } = await this.container.items.create(item)
		return doc
	}

	async updateItem(itemId) {
		debug('Update an item in the database')
		const doc = await this.getItem(itemId)
		doc.completed = true

		const { resource: replaced } = await this.container
		.item(itemId, this.partitionKey)
		.replace(doc)
		return replaced
	}
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