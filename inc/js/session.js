import AgentFactory from './mylife-agent-factory.mjs'
import chalk from 'chalk'
class MylifeMemberSession {	//	bean only, no public functions aside from init and constructor
	#conversation
	#factory
	#fxValidate
	#locked = true	//	locked by default
	#mbr_id
	#Member
	#thread
	name
	constructor(ctx,_fxValidate){
		this.#factory = ctx.AgentFactory
		this.#fxValidate = _fxValidate	//	_fxValidate is an injected function to use the most current mechanic to validate the member
		this.#mbr_id = this.factory.mbr_id
	}
	async init(_mbr_id=this.mbr_id){
		if(!this.#thread) await this.#createThread()
		if(this.locked){
			if(this.#Member?.mbr_id??_mbr_id !== _mbr_id)
				console.log(chalk.bgRed('cannot initialize, member locked'))
		}
		if(this.mbr_id !== _mbr_id) {	//	only create if not already created or alternate Member
			this.#mbr_id = _mbr_id
			console.log('update-agent-factory')
			await this.#factory.init(this.mbr_id)	//	needs only init([newid]) to reset
			await this.#createThread()
			this.#Member = await this.factory.getMyLifeMember()
			//	update conversation info (name)
			console.log(chalk.bgBlue('created-member:', chalk.bgRedBright(this.#Member.memberName )))
		}
		return this
	}
	async challengeAccess(_passphrase){
		if(this.#locked && this.challenge_id && await this.#fxValidate(this.challenge_id,_passphrase)){
			//	init member
			this.#locked = false
			await this.init(this.challenge_id)
		}
		return !this.locked
	}
	get blocked(){
		return this.locked
	}
	set blocked(_passphrase){
		return (this.locked = _passphrase)
	}
	get conversation(){
		return this.#conversation
	}
	get factory(){
		return this.#factory
	}
	get globals(){
		return this.factory.globals
	}
	get locked(){
		return this.#locked
	}
	get mbr_id(){
		return this.#mbr_id
	}
	set mbr_id(_mbr_id){
		this.#mbr_id = _mbr_id
		return this.mbr_id
	}
	get mbr_id_id(){
		return this.globals.extractId( this.mbr_id )
	}
	get member(){
		return this.#Member
	}
	get subtitle(){
		return this.#Member?.agentName
	}
	get thread(){
		return this.#thread
	}
	get threadId(){
		return this.thread.id
	}
	set thread(_thread){
		this.#thread = _thread
		return this.thread
	}
	//	private functions
	#assignName(){
		return `MylifeMemberSession_${this.mbr_id}_${this.threadId}`
	}
	async #createThread(){
		this.#thread = await this.factory.getThread()	//	make sure to generate a thread for each session, which should remain intact _through_ login _until_ logout
		this.#conversation = new (this.factory.conversation)({
			mbr_id: this.mbr_id,
			parent_id: this.mbr_id_id,
			thread_id: this.thread.id,
		}, this.factory)
		this.name = this.#assignName()
		this.#conversation.name = this.name
		//	print to CosmosDB - no need to await as I already have id
		this.factory.dataservices.pushItem(this.conversation.inspect(true))
	}
}
export default MylifeMemberSession