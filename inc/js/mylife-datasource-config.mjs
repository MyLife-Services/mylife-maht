/* constants */
const mDatabases = {
	membership: {
		client: null,
		containers: {
			members: {
				id: 'members',
				partitionId: null,
				partitionKey: 'mbr_id',
			},
			registration: {
				id: 'registration',
				partitionId: null,
				partitionKey: 'mbr_id',
			},
			shares: {
				id: 'shares',
				partitionId: null,
				partitionKey: 'shareType',
			},
			system: {
				id: 'system',
				partitionId: null,
				partitionKey: 'mbr_id',
			},
		},
		name: 'membership',
	},
	nanda: {
		client: null,
		containers: {
			registries: {
				id: 'registries',
				partitionId: null,
				partitionKey: 'registry_id',
			},
			registry: {
				id: 'registry',
				partitionId: null,
				partitionKey: 'agent_id',
			},
		},
		name: 'nanda',
	},
}
const mConfigOptions = {
	endpoint: process.env.MYLIFE_DB_ENDPOINT,
	rw_id: process.env.MYLIFE_DB_RW,
	rx_id: process.env.MYLIFE_DB_RX,
	// aadCredentials: new DefaultAzureCredential(),
}
/* exports */
export class Config {
	#databases=mDatabases
	#endpoint=mConfigOptions.endpoint
	#mbr_id
	#rw_id=mConfigOptions.rw_id
	#rx_id=mConfigOptions.rx_id
	constructor(mbr_id){
		this.#mbr_id = mbr_id
		Object.values(this.#databases).forEach(db=>{
			Object.values(db.containers).forEach(container=>{
				if(container.partitionKey === 'mbr_id')
					container.partitionId = mbr_id
			})
		})
	}
	/* getters/setters */
	get databases(){
		return this.#databases
	}
	get endpoint(){
		return this.#endpoint
	}
	get mbr_id(){
		return this.#mbr_id
	}
	get rw_id(){
		return this.#rw_id
	}
	get rx_id(){
		return this.#rx_id
	}
}