import { EventEmitter } from 'events'
import chalk from 'chalk'
class MylifeMemberSession extends EventEmitter {
	#consents = []	//	consents are stored in the session
	#contributions = []	//	'useful' (i.e., ran through whatever gauntlet of procedural logic is required and worthwhile to vet a submission) contributions from avatars/assistants are posted and stored in the session (perhaps through an emitter?), so that they can be checked and applied to instantiating avatar
	#conversation
	#factory
	#locked = true	//	locked by default
	#mbr_id
	#Member
	#thread
	name
	constructor(_factory){
		super()
		this.#factory = _factory
		this.#mbr_id = this.factory.mbr_id
		this.factory.on('avatar-activated',_avatar=>{
			console.log(chalk.grey('session::constructor::avatar-activated_trigger'),chalk.bgGray(_avatar.id))
		})
	}
	async init(_mbr_id=this.mbr_id){
		if(!this.#thread) await this.#createThread()
		if(this.locked){
			if(this.#Member?.mbr_id??_mbr_id !== _mbr_id)
				console.log(chalk.bgRed('cannot initialize, member locked'))
		}
		if(this.mbr_id !== _mbr_id) {	//	only create if not already created or alternate Member
			this.emit('onInit-member-initialize')
			this.#mbr_id = _mbr_id
			await this.#factory.init(this.mbr_id)	//	needs only init([newid]) to reset
			await this.#createThread()
			this.#Member = await this.factory.getMyLifeMember()
			//	update conversation info (name)
			console.log(chalk.bgBlue('created-member:', chalk.bgRedBright(this.#Member.memberName )))
		}
		return this
	}
	//	consent functionality
	async requestConsent(ctx){
		//	validate request; switch true may be required
		if(!validCtxObject(ctx)) return false	//	invalid ctx object, consent request fails
		//	check-01: url ends in valid guid /:_id
		const _object_id = ctx.request.header?.referer?.split('/').pop()
		//	not guid, not consent request, no blocking
		if(!this.globals.isValidGUID(_object_id)) return true
		console.log('session.requestConsent()', 'mbr_id', this.mbr_id)
		//	ultimately, applying a disposable agent of intelligence to consent request might be the answer
		let _consent = this.consents
			.filter(_=>{ return _.id==_object_id })
			.pop()
		if(!_consent){
			//	create and notify session
			_consent = await this.factory.getConsent({
				id: _object_id,
				mbr_id: this.mbr_id,
				being: 'consent',
				context: `This consent object was created by MyLife Session [${this.mbr_id}] to manage access to asset [${_object_id}] of owner [${this.mbr_id}].`,
				purpose: `To manage requested access to the underlying avatar or object according to the wills and expressions of the member identified by their mbr_id: ${this.mbr_id}.`,
			})
			this.consents.unshift(_consent)
		}
		return _consent.allow(_request)	//	might benefit from putting consent into openai assistant metadata with suggestion to adhere when creating content
		if(!ctx.request.body) return	//	nothing to do
		//	based on incoming request, parse out consent id and request
		return this.factory.requestConsent(_consent_id,_request)
		
		if(!this?.ctx?.session?.MemberSession?.consents) return	//	pre-natal instance of MyLife?
		//	otherwise, should be able to construe
		_consent = (_consent_id)
			?	{}	//	retrieve from Cosmos
			:	new (this.schemas.consent)(_request, this)	//	generate new consent
		console.log('_consent', _consent)
		//	manipulate session through ctx (although won't exist in initial test case)
		await (this.ctx.session.MemberSession.consents = _consent)	//	will add consent to session list
		return _consent
	}
	async challengeAccess(_passphrase){
		if(this.locked){
			if(!this.challenge_id) return false	//	no challenge, no access
			if(!this.factory.challengeAccess(_passphrase)) return false	//	invalid passphrase, no access [converted in this build to local factory as it now has access to global datamanager to which it can pass the challenge request]
			//	init member
			this.#locked = false
			await this.init(this.challenge_id)
		}
		return !this.locked
	}
	get consent(){
		return this.factory.consent	//	**caution**: returns <<PROMISE>>
	}
	set consent(_consent){
		this.#consents.unshift(_consent)
	}
	get consents(){
		return this.#consents
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
		return this.#conversation.thread
	}
	get threadId(){
		return this.thread.id
	}
	//	private functions
	#assignName(){
		return `MylifeMemberSession_${this.mbr_id}_${this.threadId}`
	}
	async #createThread(){	//	thread can be acted on by any avatar/agent, ergo stored here in session
		this.#conversation = await new (this.factory.conversation)({
			mbr_id: this.mbr_id,
			parent_id: this.mbr_id_id,
			thread: await this.factory.getThread(),
		}, this.factory)
		this.name = this.#assignName()
		this.#conversation.name = this.name
		//	print to CosmosDB
//		if(this.bAllowSave)
			this.factory.dataservices.pushItem(this.conversation.inspect(true))
	}
}
function validCtxObject(_ctx){
	//	validate ctx object
	return	(
			_ctx
		&&	typeof _ctx === 'object'
		&&	'request' in _ctx 
		&&	'response' in _ctx
		&&	'session' in _ctx
		&&	'state' in _ctx
	)
}
export default MylifeMemberSession