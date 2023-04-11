//	imports
import Datamanager from "./mylife-datamanager.js"
class Dataservices{
	constructor(){
		this.Datamanager=new Datamanager()
		this.mbr_id=this.getMemberId()
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
					value: this.mbr_id
				}
			]
		})
	}
}
//	exports
export default Dataservices