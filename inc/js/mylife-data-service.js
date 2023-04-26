//	imports
import Datamanager from "./mylife-datamanager.js"
class Dataservices{	//	convert to extension of Datamanager
	//	pseudo-constructor
	#Datamanager
	#mbr_id
	#rootSelect = 'u.id, u.mbr_id, u.parent_id, u.being'
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
	async getAgent(_parent_id){	//	get specificed (or default) agent; one per parent_id, most recent only
		const _agentsArray = (await this.getAgents())
			.filter(_agent=>{
				return _agent.parent_id === _parent_id
			})
		if(!_agentsArray.length){
			//	create agent
			_agentsArray.push(await this.pushItem({
				being: 'agent',
				description: `I am the AI-Agent for this member`,	//	should ultimately inherit from core agent
				mbr_id: this.mbr_id,
				name: `agent_${ _parent_id }_${ this.mbr_id }`,
				names: ['AI-Agent', 'Agent', 'AI'],
				parent_id: _parent_id,
			}))
		}
		return _agentsArray[0]	//	or isolate dimension earlier
	}
	async getAgents(){
		return await this.getItems('agent','*')
	}
	async getBoard(){
		return (await this.getBoards())[0]
	}
	async getBoards(){
		//	board -> mbr_id but with board.id as "parent_id", if not exists, then create]
		return await this.getItems('board',this.#rootSelect + ', u.members')
	}
	getBio(){
		return this.getCore().bio
	}
	async getChat(){
		return (await this.getChats())[0]
	}
	async getChats(){
		return await this.getItems('chat',this.#rootSelect + ', u.chatExchanges')
	}
	async getItem(_id){
		return await this.datamanager.getItem(_id)
	}
	async getItems(_being,_selects=this.#rootSelect){	//	if any prop missing in db, is just not returned
		return await this.datamanager.getItems({
			query: `select ${_selects} from members u where u.being=@type`,
			parameters: [
				{
					name: "@type",
					value: _being
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