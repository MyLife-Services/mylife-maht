//	imports
import Datamanager from "./mylife-datamanager.js"
class Dataservices{	//	convert to extension of Datamanager
	//	pseudo-constructor
	#Datamanager
	#mbr_id
	//	constructor
	constructor(_mbr_id){
		this.#mbr_id = _mbr_id
		//	NOTE: init() required, as population is async
		//	agent and chat required
	}
	//	init function
	async init(){
		this.#Datamanager=await new Datamanager(this.#mbr_id)
			.init()	//	init datamanager
		return this
	}
	//	getters/setters
	get core(){
		return this.datamanager.core
	}
	get datamanager(){
		return this.#Datamanager
	}
	get mbr_id(){
		return this.#mbr_id
	}
	//	public functions
	async getAgent(){
		return (await this.getAgents())[0]
	}
	async getAgents(){
		return await this.#Datamanager.getItems({
			query: "select * from members u where u.being=@type",
			parameters: [
				{
					name: "@type",
					value: 'agent'
				}
			]
		})
	}
	getBio(){
		return this.getCore().bio
	}
	async getChat(){
		//	const _chat = await this.getChats()	//	cannot render in return await alone
		return (await this.getChats())[0]
	}
	async getChats(){
		return await this.datamanager.getItems({
			query: "select u.id,u.mbr_id,u.parent_id,u.chatExchanges from members u where u.being=@being",
			parameters: [
				{
					name: "@being",
					value: 'chat'
				},
				{
					name: "@id",
					value: this.core.id
				}
			]
		})
	}
	async getItem(_id){
		return await this.datamanager.getItem(_id)
	}
	async getQuestions(){
		return await this.#Datamanager.getItems({
			query: "select u.id,u.mbr_id from members u where u.being=@type and u.mbr_id=@id",
			parameters: [
				{
					name: "@type",
					value: 'question'
				},
				{
					name: "@id",
					value: this.#mbr_id
				}
			]
		})
	}
	async pushItem(_data){
		return await this.datamanager.pushItem(_data)
	}
}
//	exports
export default Dataservices