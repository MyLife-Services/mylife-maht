/* imports */
import oAIAssetAssistant from './agents/system/asset-assistant.mjs'
import { _ } from 'ajv'
/* module export functions */
async function about(ctx){
	ctx.state.title = `About MyLife`
	await ctx.render('about')	//	about
}
async function alerts(ctx){
	// @todo: put into ctx the _type_ of alert to return, system use dataservices, member use personal
	if(ctx.params?.aid){ // specific system alert
		ctx.body = await ctx.state.MemberSession.alert(ctx.params.aid)
	} else { // all system alerts
		ctx.body = await ctx.state.MemberSession.alerts(ctx.request.body)
	}
}
async function api_register(ctx){
	const _registrationData = ctx.request.body
	const {
		registrationInterests,
		contact={}, // as to not elicit error destructuring
		personalInterests,
		additionalInfo
	} = _registrationData
	const {
		avatarName,
		humanName,
		humanDateOfBirth,
		email,
		city,
		state,
		country,
	} = contact
	if (!humanName?.length || !email?.length){
        ctx.status = 400 // Bad Request
        ctx.body = {
            success: false,
            message: 'Missing required contact information: humanName and/or email are required.',
        }
        return
    }
	// Email validation
    if (!ctx.Globals.isValidEmail(contact.email)) {
        ctx.status = 400 // Bad Request
        ctx.body = {
            success: false,
            message: 'Invalid email format.',
        }
        return
    }
	// throttle requests?
	// write to cosmos db
	_registrationData.email = email // required at root for select
	const _ = ctx.MyLife.registerCandidate(_registrationData)
	const { mbr_id, ..._return } = _registrationData // abstract out the mbr_id
	ctx.status = 200
    ctx.body = {
        success: true,
        message: 'Registration completed successfully.',
		data: _return,
    }
	return
}
async function avatarListing(ctx){
	ctx.state.title = `Avatars for ${ ctx.state.member.memberName }`
	ctx.state.avatars = ctx.state.member.avatars
		.map(
			_avatar => ({
				id: _avatar.id,
				categories: _avatar.categories,
				description: _avatar.description,
				name: _avatar?.nickname??_avatar?.names?.[0]??_avatar.name,
				purpose: _avatar.purpose,
			})
		)
	await ctx.render('avatars')	//	avatars
}
function category(ctx){ // sets category for avatar
	ctx.state.category = ctx.request.body
	ctx.state.avatar.setActiveCategory(ctx.state.category)
	ctx.body = ctx.state.avatar.category
}
async function challenge(ctx){
	ctx.body = await ctx.session.MemberSession.challengeAccess(ctx.request.body.passphrase)
}
async function chat(ctx){
	ctx.state.chatMessage = ctx.request.body
	ctx.state.thread = ctx.state.MemberSession.thread
	const _message = ctx.request?.body?.message??false /* body has all the nodes sent by fe */
	if(!_message) ctx.throw(400, `invalid message: missing \`message\``) // currently only accepts single contributions via post with :cid
	if(!_message?.length) ctx.throw(400, `empty message content`)
	const _response = await ctx.state.avatar.chatRequest(ctx)
	ctx.body = _response // return message_member_chat
}
/**
 * Manage delivery and receipt of contributions(s)
 * @async
 * @public
 * @api no associated view
 * @param {object} ctx Koa Context object
 */
async function contributions(ctx){
	ctx.body = await (
		(ctx.method ==='GET')
		?	mGetContributions(ctx)
		:	mSetContributions(ctx)
	)
}
async function index(ctx){
	ctx.state.title = `${ctx.state.member.agentDescription}`
	await ctx.render('index')
}
async function members(ctx){
	ctx.state.mid = ctx.params?.mid??false	//	member id
	ctx.state.title = `Your MyLife Digital Home`
	switch (true) {
		case !ctx.state.mid && ctx.state.locked:
			//	listing comes from state.hostedMembers
			ctx.state.hostedMembers = ctx.hostedMembers
				.sort(
					(a, b) => a.localeCompare(b)
				)
				.map(
					_mbr_id => ({ 'id': _mbr_id, 'name': ctx.Globals.extractSysName(_mbr_id) })
				)
			ctx.state.subtitle = `Select your membership to continue:`
			await ctx.render('members-select')
			break
		case ctx.state.locked:
			ctx.session.MemberSession.challenge_id = ctx.state.mid
			ctx.state.subtitle = `Enter passphrase for activation [member ${ ctx.Globals.extractSysName(ctx.state.mid) }]:`
			await ctx.render('members-challenge')
			break
		default:
			ctx.state.subtitle = `Welcome Agent ${ctx.state.member.agentName}`
			await ctx.render('members')
			break
	}
}
async function privacyPolicy(ctx){
	ctx.state.title = `MyLife Privacy Policy`
	ctx.state.subtitle = `Effective Date: 2024-01-01`
	await ctx.render('privacy-policy')	//	privacy-policy
}
async function signup(ctx) {
    const { email, humanName, avatarNickname } = ctx.request.body
	const _signupPackage = {
		'email': email,
		'humanName': humanName,
		'avatarNickname': avatarNickname,
	}
	//	validate session signup
	if (ctx.session.signup)
		ctx.throw(400, 'Invalid input', { 
			success: false,
			message: `session user already signed up`,
			..._signupPackage 
		})
	//	validate package
	if (Object.values(_signupPackage).some(value => !value)) {
		const _missingFields = Object.entries(_signupPackage)
			.filter(([key, value]) => !value)
			.map(([key]) => key) // Extract just the key
			.join(',')
		ctx.throw(400, 'Invalid input', { 
			success: false,
			message: `Missing required field(s): ${_missingFields}`,
			..._signupPackage 
		})
	}
    // Validate email
    if (!ctx.Globals.isValidEmail(email))
		ctx.throw(400, 'Invalid input', { 
			success: false,
			message: 'Invalid input: emailInput',
			..._signupPackage 
		})
    // Validate first name and avatar name
    if (!humanName || humanName.length < 3 || humanName.length > 64 ||
        !avatarNickname || avatarNickname.length < 3 || avatarNickname.length > 64)
		ctx.throw(400, 'Invalid input', { 
			success: false,
			message: 'Invalid input: First name and avatar name must be between 3 and 64 characters: humanNameInput,avatarNicknameInput',
			..._signupPackage 
		})
    // save to `registration` container of Cosmos expressly for signup data
	_signupPackage.id = ctx.MyLife.newGuid
	await ctx.MyLife.registerCandidate(_signupPackage)
	// TODO: create account and avatar
    // If all validations pass and signup is successful
	ctx.session.signup = true
	const { mbr_id, ..._return } = _signupPackage // abstract out the mbr_id
    ctx.status = 200 // OK
    ctx.body = {
		..._return,
        success: true,
        message: 'Signup successful',
    }
}
async function _upload(ctx){	//	post file via post
	//	revive or create nascent AI-Asset Assistant, that will be used to process the file from validation => storage
	//	ultimately, this may want to move up in the chain, but perhaps not, considering the need to process binary file content
	const _oAIAssetAssistant = await new oAIAssetAssistant(ctx).init()
	ctx.body = _oAIAssetAssistant
}
async function upload(ctx){	//	upload display widget/for list and/or action(s)
	ctx.state.title = `Upload`
	ctx.state.subtitle = `Upload your files to <em>MyLife</em>`
	await ctx.render('upload')	//	upload
}
/* module private functions */
function mGetContributions(ctx){
	ctx.state.cid = ctx.params?.cid??false	//	contribution id
	const statusOrder = ['new', 'prepared', 'requested', 'submitted', 'pending', 'accepted', 'rejected']
	ctx.state.status = ctx.query?.status??'prepared'	//	default state for execution
	return ctx.state.contributions
		.filter(_contribution => (ctx.state.cid && _contribution.id === ctx.state.cid) || !ctx.state.cid)
		.map(_contribution => (_contribution.memberView))
		.sort((a, b) => {
			// Get the index of the status for each contribution
			const indexA = statusOrder.indexOf(a.status)
			const indexB = statusOrder.indexOf(b.status)
			// Sort based on the index
			return indexA - indexB
		})
}
/**
 * Manage receipt and setting of contributions(s).
 * @async
 * @modular
 * @param {object} ctx Koa Context object 
 */
function mSetContributions(ctx){
	if(!ctx.params?.cid)
		ctx.throw(400, `missing contribution id`) // currently only accepts single contributions via post with :cid
	ctx.state.cid = ctx.params.cid
	const _contribution = ctx.request.body?.contribution??false
	console.log('test', ctx.state.cid, _contribution)
	if(!_contribution)
		ctx.throw(400, `missing contribution data`)
	ctx.state.avatar.contribution = ctx.request.body.contribution
	return ctx.state.avatar.contributions
		.filter(_contribution => (_contribution.id === ctx.state.cid))
		.map(_contribution => (_contribution.memberView))
}
/* exports */
export {
	about,
	alerts,
	api_register,
	avatarListing,
	category,
	challenge,
	chat,
	contributions,
	index,
	members,
	privacyPolicy,
	signup,
	upload,
	_upload,
}