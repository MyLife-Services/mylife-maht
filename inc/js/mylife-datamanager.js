//	imports
//	import { DefaultAzureCredential } from "@azure/identity"
import { CosmosClient } from '@azure/cosmos'
import Config from './mylife-datasource-config.js'
import chalk from 'chalk'
//	define class
class Datamanager {
	//	specifications
	#core = null
	#coreId
	#partitionId
	//	constructor
	constructor(_root) {
		const oConfig=new Config(_root)
		const oOptions={
			endpoint: oConfig.endpoint,
			key: oConfig.rw_id,
			userAgentSuffix: 'mylife-services',
//			aadCredentials: new DefaultAzureCredential()
		}
		//	define variables
		this.client=new CosmosClient(oOptions)
		this.containerId = oConfig.db.container.id
		this.#partitionId = oConfig.db.container.partitionId
		this.#coreId = oConfig.db.container.coreId
		this.requestOptions = {
			partitionKey: this.#partitionId,
			populateQuotaInfo: true, // set this to true to include quota information in the response headers
		}
		//	assign database and container
		this.database=this.client.database(oConfig.db.id)
		this.container=this.database.container(oConfig.db.container.id)
	}
	//	init function
	async init() {
		//	assign core
		this.#core=await this.container.item(
			this.#coreId,
			this.#partitionId
		)
			.read()
		return this
	}
	//	getter/setter property functions
	get core(){
		return this.#core?.resource
	}
	//	public functions
	async challengeAccess(_mbr_id,_passphrase){
		//	execute store procedure with passphrase and this mbr_id? yes, so won't be charged to user if bad password attempts
		//	in order to obscure passphrase, have db make comparison (could include flag for case insensitivity)
		const challengeOptions = { partitionKey: _mbr_id }
		// Execute the stored procedure
		const { resource: _result } = await this.container
			.scripts
			.storedProcedure('checkMemberPassphrase')
			.execute(_mbr_id,_passphrase,true)	//	first parameter is partition key, second is passphrase, third is case sensitivity
		return _result
	}
	async deleteItem(_id) {}
	async getItem(_id,_options=this.requestOptions){	//	quick, inexpensive read; otherwise use getItems
		const { resource: _item } = await this.container
			.item(_id,this.#partitionId)
			.read(_options)
		return _item
	}
	async getItems(_querySpec,_options=this.requestOptions){
		const { resources } = await this.container
			.items
			.query(_querySpec,_options)
			.fetchAll()
		return resources
	}
	async itemExists(_id,_options=this.requestOptions){
		_options.enableContentResponseOnWrite = false
		const { resource } = await this.container.item(_id).read(_options)
		return !!resource
	}
	async patchItem(_id,_item) {	//	patch or update, depends on whether it finds id or not, will only overwrite fields that are in _item
		//	[Partial Document Update, includes node.js examples](https://learn.microsoft.com/en-us/azure/cosmos-db/partial-document-update)
		const { resource: _update } = await this.container
			.item(_id,this.#partitionId)
			.patch(_item)	//	see below for filter-patch example
		return _update
	}
	async pushItem(_item) {	//	post or insert, depends on whether it finds id or not, will overwrite all existing fields
		const { resource: doc } = await this.container.items.upsert(_item)
		return doc
	}
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
}
//	exports
export default Datamanager