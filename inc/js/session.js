import chalk from 'chalk'
class MylifeMemberSession {	//	bean only, no public functions aside from init and constructor
	#Dialog	//	Interactions with system, Maht, Board, etc.
	#fxValidate
	#globals
	#mbr_id
	#Member
	#locked = true	//	locked by default
	name
	constructor(_mbr_id,_globals,_fxValidate,ctx){	//	inject validation function
		this.#mbr_id = _mbr_id
		this.#globals = _globals
		this.#fxValidate = _fxValidate
		ctx.session.id = this.#globals.newGuid
		this.name = `MylifeMemberSession_${ ctx.session.id }`
		console.log('session created', ctx.session)
	}
	async init(_mbr_id=this.#mbr_id){
		if(this.locked){
			console.log(chalk.bgRed('cannot initialize, member locked'))
			return false
		}
		if(this.#Member?.mbr_id !== _mbr_id) {	//	only create if not already created or alternate Member
			this.#Member = await this.#globals.getMember(_mbr_id)
			this.#mbr_id = _mbr_id
			console.log(chalk.bgBlue('created-member:', chalk.bgRedBright(this.#Member.agentName )))
		}
	}
	async challengeAccess(_passphrase){
		if(this.#locked && await this.#fxValidate(this.#mbr_id,_passphrase)){
			//	init member
			this.#locked = false
			await this.init(this.#mbr_id)
			console.log('logged in',this.#mbr_id,this.agent)
		}
		return !this.locked
	}
	get agent(){
		return this.#Member?.agent??false
	}
	get blocked(){
		return this.locked
	}
	set blocked(_passphrase){
		return (this.locked = _passphrase)
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
	get member(){
		return this.#Member
	}
	get subtitle(){
		return this.#Member?.agentName
	}
}
export default MylifeMemberSession