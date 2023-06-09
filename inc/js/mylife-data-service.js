//	imports
import Datamanager from "./mylife-datamanager.js"
class Dataservices{	//	convert to extension of Datamanager
	//	pseudo-constructor
	#Datamanager
	#partitionId
	#rootSelect = 'u.id, u.mbr_id, u.parent_id, u.being'
	//	constructor
	constructor(_mbr_id){
		this.#partitionId = _mbr_id
		//	NOTE: init() required, as population is async
		//	agent and chat required
	}
	//	init function
	async init(){
		this.#Datamanager=await new Datamanager(this.#partitionId)
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
	get id(){
		return this.partitionId.split('|')[1]
	}
	get mbr_id(){
		return this.partitionId
	}
	get partitionId(){
		return this.#partitionId
	}
	//	public functions
	async challengeAccess(_mbr_id,_passphrase){	//	if possible (async) injected into session object
		//	ask global data service (stored proc) for passphrase
		return await this.datamanager.challengeAccess(_mbr_id,_passphrase)
	}
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
		return await this.getItems('board','u.members')
	}
	getBio(){
		return this.getCore().bio
	}
	async getChat(parent_id=this.id){
		const _response = await this.getChats(parent_id)
		return _response[0]	//	separate out [0] dimension here as it cannot be embedded in await
	}
	async getChats(parent_id){
		let _chats = await this.getItems('conversation','u.exchanges',[{ name: '@parent_id', value: parent_id }])
		if(!_chats.length) _chats = await this.pushItem({	//	create chat
//	id: global.Globals.newGuid,
			mbr_id: this.mbr_id,
			parent_id: parent_id,
			being: 'conversation',
			exchanges: [],
			name: `conversation_${ this.mbr_id }`,
		})
		return _chats
	}
	async getItem(_id){
		return await this.datamanager.getItem(_id)
	}
	async getItems(_being,_selects='*',_paramsArray=[]){	//	_params is array of objects { name: '${varName}' }
		_paramsArray.unshift({ name: '@being', value: _being })	//	add primary parameter to array at beginning
		if(_selects!='*') _selects = this.#rootSelect+', '+_selects
		let _query = `select ${_selects} from members u`	//	@being is required
		_paramsArray	//	iterate through parameters
			.forEach(_param=>{	//	param is an object of name, value pairs
				_query += (_param.name==='@being')
					?	` where u.${_param.name.split('@')[1]}=${_param.name}`	//	only manages string so far
					:	` and u.${_param.name.split('@')[1]}=${_param.name}`	//	only manages string so far
		})
		return await this.datamanager.getItems({
			query: _query,
			parameters: _paramsArray
		})
	}
	async patchItem(_id,_dataArray){
		return await this.datamanager.patchItem(_id,_dataArray)
	}
	async pushItem(_data){
		return await this.datamanager.pushItem(_data)
	}
}
//	exports
export default Dataservices