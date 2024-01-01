import { EventEmitter } from 'events'
import chalk from 'chalk'
class MylifeMemberSession extends EventEmitter {
	#consents = []	//	consents are stored in the session
	#contributions = []	//	intended to hold all relevant contribution questions for session
	#conversation
	#factory
	#locked = true	//	locked by default
	#mbr_id = false
	#Member
	#thread
	name
	constructor(_factory){
		super()
		this.#factory = _factory
		this.#mbr_id = this.isMyLife ? this.factory.mbr_id : false
		mAssignFactoryListeners(this.#factory)
		console.log(
			chalk.bgGray('MylifeMemberSession:constructor(_factory):generic-mbr_id::end'),
			chalk.bgYellowBright(this.factory.mbr_id),
		)
	}
	async init(_mbr_id=this.mbr_id){
		if(!this.conversation){
			this.#conversation = await mCreateConversation(this)
			this.#thread = this.conversation.thread
		}
		if(this.locked){
			if(this.#Member?.mbr_id??_mbr_id !== _mbr_id)
				console.log(chalk.bgRed('cannot initialize, member locked'))
		}
		// unlocked session, initialize fidelity member session
		if(this.mbr_id && this.mbr_id !== _mbr_id) {
			this.#mbr_id = _mbr_id
			mAssignFactoryListeners(this.#factory)
			await this.#factory.init(this.mbr_id)	//	needs only init([newid]) to reset
			this.#conversation = await mCreateConversation(this)
			this.#thread = this.conversation.thread
			this.#Member = await this.factory.getMyLifeMember()
			//	update conversation info (name)
			this.name = mAssignName(this.#mbr_id, this.#thread.id)
			this.emit('onInit-member-initialize', this.#Member.memberName)
			console.log(
				chalk.bgBlue('created-member:'),
				chalk.bgRedBright(this.#Member.memberName)
			)
		}
		return this
	}
	//	consent functionality
	async requestConsent(ctx){
		//	validate request; switch true may be required
		if(!mValidCtxObject(ctx)) return false	//	invalid ctx object, consent request fails
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
			if(!this.challenge_id) return false	//	this.challenge_id imposed by :mid from route
			if(!this.factory.challengeAccess(_passphrase)) return false	//	invalid passphrase, no access [converted in this build to local factory as it now has access to global datamanager to which it can pass the challenge request]
			//	init member
			this.#locked = false
			this.emit('member-unlocked', this.challenge_id)
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
	get contributions(){
		return this.#contributions
	}
	get conversation(){
		return this.#conversation
	}
	get core(){
		return this.factory.core
	}
	get factory(){
		return this.#factory
	}
	get globals(){
		return this.factory.globals
	}
	get isInitialized(){
		return ( this.mbr_id!==false )
	}
	get isMyLife(){
		return this.factory.isMyLife
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
}
function mAssignFactoryListeners(_session){
	if(_session.isMyLife) // all sessions _begin_ as MyLife
		_session.factory.on('member-unlocked',_mbr_id=>{
			console.log(
				chalk.grey('session::constructor::member-unlocked_trigger'),
				chalk.bgGray(_mbr_id)
			)
		})
	else // all _"end"_ as member
		_session.factory.on('avatar-activated',_avatar=>{
			console.log(
				chalk.grey('session::constructor::avatar-activated_trigger'),
				chalk.bgGray(_avatar.id)
			)
		})
}
function mAssignName(_mbr_id, _threadId){
	return `MylifeMemberSession_${_mbr_id}_${_threadId}`
}
async function mCreateConversation(_session){	//	thread can be acted on by any avatar/agent, ergo stored here in session
	const _conversation = await new (_session.factory.conversation)({
		mbr_id: _session.mbr_id,
		parent_id: _session.mbr_id_id,
		thread: await _session.factory.getThread(),
	}, _session.factory)
	_conversation.name = mAssignName(_session.mbr_id, _conversation.threadId)
	//	print to CosmosDB
	if(process.env?.MYLIFE_DB_ALLOW_SAVE??false)
		_session.factory.dataservices.pushItem(_conversation.inspect(true))
	return _conversation
}
function mValidCtxObject(_ctx){
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