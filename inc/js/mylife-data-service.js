//	imports
import Datamanager from "./mylife-datamanager.js"
class Dataservices{
	//	pseudo-constructor
	Datamanager = new Datamanager()
	#mbr_id
	//	constructor
	constructor(){
		this.#mbr_id=this.getMemberId()
	}
	//	getters/setters
	get memberId(){
		return this.#mbr_id
	}
	//	public functions
	async init(){
		await this.Datamanager.init()
		return this
	}
	async commit(_data={}){
		return _data
	}
	async getItem(_id){
		return await this.Datamanager.getItem(_id)
	}
	//	public getters by BEING category
	getBio(){
		return this.getCore().bio
	}
	getCore(){
		return this.Datamanager.getCore()
	}
	getMemberId(){
		return this.Datamanager.getPartitionId()
	}
	async getMemberPrimaryChat(){
		return await this.Datamanager.find({
			query: "SELECT u.id,u.mbr_id,u.chatExchanges FROM members u WHERE u.being=@being AND u.mbr_id=@mbr_id",
			parameters: [
				{
					name: "@being",
					value: 'chat'
				},
				{
					name: "@mbr_id",
					value: this.#mbr_id
				}
			]
		})
	}
	async getQuestions(){
		return await this.Datamanager.find({
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
	async commitRequest(_data={}){
		return _data
	}
}
//	exports
export default Dataservices