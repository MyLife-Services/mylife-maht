class MylifeMemberSession {	//	bean only, no public functions aside from init and constructor
	#mbr_id = process.env.MYLIFE_HOSTED_MBR_ID[0]
	#Member
	#locked = true	//	locked by default
	name
	constructor(_mbr_id){
		this.#mbr_id = _mbr_id
		this.name = 'MylifeMemberSession'
	}
	async init(_mbr_id=this.#mbr_id){
		if(this.locked){
			console.log(chalk.bgRed(' cannot initialize, member locked'))
			return false
		}
		if(this.#Member?.mbr_id !== _mbr_id) {	//	only create if not already created or alternate Member
			this.#Member = await new Member(
					await new Dataservices(_mbr_id)
						.init()
				)
					.init()
			this.#mbr_id = _mbr_id
			console.log(chalk.bgBlue('created-member:', chalk.bgRedBright(this.#Member.agentName )))
		}
	}
	get agent(){
		return this.#Member?.agent??false
	}
	get locked(){
		return this.#locked
	}
	set locked(_passphrase){
		console.log('_passphrase',_passphrase)
		this.#locked = !(_passphrase === this.passphrase)
		return this.locked
	}
	get member(){
		return this.#Member
	}
	get subtitle(){
		return this.#Member?.agentName
	}
}
export default MylifeMemberSession