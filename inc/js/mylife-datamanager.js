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
		console.log(chalk.bgCyan('database initialized:',chalk.bgCyanBright(`${this.database.id}`)))
		this.container=this.database.container(oConfig.db.container.id)
		console.log(chalk.bgCyan('container initialized:',chalk.bgCyanBright(`${this.container.id}`)))
	}
	//	init function
	async init() {
		//	assign core
		this.#core=await this.container.item(
			this.#coreId,
			this.#partitionId
		)
			.read()
		console.log(chalk.bgBlue('core initialized:',chalk.bgBlueBright(`${this.#core.resource.id}`)))
		return this
	}
	//	getter/setter property functions
	get core(){
		return this.#core?.resource
	}
	//	public functions
	async pushItem(_item) {
		const { resource: doc } = await this.container.items.upsert(_item)
		return doc
	}
	async getItem(_id,_options=this.requestOptions){	//	quick, inexpensive read; otherwise use getItems
		return await this.container
			.item(_id,this.#partitionId)
			.read(_options)
			.then(_item=>{
				return _item.resource
			})
			.catch(_err=>{
				console.log(_err)
				return null
			})
	}
	getPartitionId(){
		return this.#partitionId
	}
	async getItems(_querySpec,_options=this.requestOptions){
		const { resources } = await this.container
			.items
			.query(_querySpec,_options)
			.fetchAll()
		return resources
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
*/
}
//	exports
export default Datamanager