/* imports */
import oAIAssetAssistant from './agents/system/asset-assistant.mjs'
import {
	upload as apiUpload,
} from './api-functions.mjs'
/* module export functions */
async function about(ctx){
	ctx.state.title = `About MyLife`
	await ctx.render('about')	//	about
}
/**
 * Activate a bot for the member
 * @module
 * @public
 * @api no associated view
 * @param {object} ctx Koa Context object
 * @returns {object} Koa Context object
 */
function activateBot(ctx){
	const { avatar, } = ctx.state
	avatar.activeBotId = ctx.params.bid
	ctx.body = { activeBotId: avatar.activeBotId }
}
async function alerts(ctx){
	// @todo: put into ctx the _type_ of alert to return, system use dataservices, member use personal
	if(ctx.params?.aid){ // specific system alert
		ctx.body = await ctx.state.MemberSession.alert(ctx.params.aid)
	} else { // all system alerts
		ctx.body = await ctx.state.MemberSession.alerts(ctx.request.body)
	}
}
async function bots(ctx){
	const bot = ctx.request.body
	const { avatar } = ctx.state
	switch(ctx.method){
		case 'POST': // create new bot
			ctx.body = await avatar.setBot(bot)
			break
		case 'PUT': // update bot
			if(ctx.params.bid!==bot.id)
				throw new Error('invalid bot data')
			ctx.body = await avatar.setBot(bot)
			break
		case 'GET':
		default:
			if(ctx.params?.bid?.length){ // specific bot
				ctx.body = await avatar.bot(ctx.params.bid)
			} else {
				ctx.body = {
					activeBotId: avatar.activeBotId,
					bots: await avatar.bots,
					mbr_id: avatar.mbr_id,
				}
			}
			break
	}
}
function category(ctx){ // sets category for avatar
	ctx.state.category = ctx.request.body
	const { avatar, } = ctx.state
	avatar.setActiveCategory(ctx.state.category)
	ctx.body = avatar.category
}
/**
 * Challenge the member session with a passphrase.
 * @module
 * @public
 * @async
 * @api - No associated view
 * @param {Koa} ctx - Koa Context object
 * @returns {object} Koa Context object
 * @property {object} ctx.body - The result of the challenge.
 */
async function challenge(ctx){
	if(!ctx.params.mid?.length)
		ctx.throw(400, `requires member id`)
	ctx.body = await ctx.session.MemberSession.challengeAccess(ctx.request.body.passphrase)
}
async function chat(ctx){
	const { botId, message, role, threadId, } = ctx.request.body
		?? {} /* body nodes sent by fe */
	if(!message?.length)
			ctx.throw(400, 'missing `message` content')
	const { avatar, } = ctx.state
	const response = await avatar.chatRequest(botId, threadId, message, )
	ctx.body = response
}
async function collections(ctx){
	const { avatar, } = ctx.state
	ctx.body = await avatar.collections(ctx.params.type)
}
/**
 * Manage delivery and receipt of contributions(s).
 * @async
 * @public
 * @api no associated view
 * @param {object} ctx Koa Context object
 */
async function contributions(ctx){
	ctx.body = await (
		(ctx.method==='GET')
		?	mGetContributions(ctx)
		:	mSetContributions(ctx)
	)
}
async function createBot(ctx){
	const { team, type, } = ctx.request.body
	const { avatar, } = ctx.state
	const bot = { type, } // `type` only requirement to create a known, MyLife-typed bot
	ctx.body = await avatar.createBot(bot)
}
/**
 * Delete an item from collection via the member's avatar.
 * @async
 * @public

* @param {object} ctx - Koa Context object
 * @returns {boolean} - Under `ctx.body`, status of deletion.
 */
async function deleteItem(ctx){
	const { iid, } = ctx.params
	const { avatar, } = ctx.state
	if(!iid?.length)
		ctx.throw(400, `missing item id`)
	ctx.body = await avatar.deleteItem(iid)
}
async function greetings(ctx){
	const { dyn: dynamic, vld: validate, } = ctx.request.query
	const { avatar, } = ctx.state
	let response = { success: false, messages: [], }
	switch(true){
		case validate:
			if(!avatar.isMyLife)
				response = {
					...response,
					error: new Error('Only MyLife may validate greetings'),
					messages: ['Only MyLife may validate greetings'],
				}
			else // @stub - validate registration request
				response.messages.push(...await avatar.validateRegistration(validate))
			break
		default:
			response.messages.push(...await avatar.getGreeting(dynamic))
			break
	}
	response.success = response.messages.length > 0
	ctx.body = response
}
/**
 * Request help about MyLife.
 * @param {Koa} ctx - Koa Context object, body={ request: string|required, mbr_id, type: string, }.
 * @returns {object} - Help response message object.
 */
async function help(ctx){
	const { helpRequest, type=`general`, } = ctx.request?.body
	if(!helpRequest?.length)
		ctx.throw(400, `missing help request text`)
	const { avatar } = ctx.state
	const _avatar = type==='membership' ? avatar : ctx.MyLife.avatar
	ctx.body = await _avatar.help(helpRequest, type)
}
/**
 * Index page for the application.
 * @async
 * @public
 * @param {object} ctx - Koa Context object
 */
async function index(ctx){
	await ctx.render('index')
}
/**
 * Set or get the avatar interface mode for the member.
 * @module
 * @public
 * @api - No associated view
 * @param {object} ctx - Koa Context object
 * @returns {object} - Koa Context object
 * @property {string} ctx.body - The interface mode for the member.
 */
function interfaceMode(ctx){
	const { avatar, } = ctx.state
	if(ctx.method==='POST' && ctx.request.body.mode){
		avatar.mode = ctx.request.body.mode
	}
	ctx.body = avatar.mode
	return
}
async function login(ctx){
	if(!ctx.params.mid?.length) ctx.throw(400, `missing member id`) // currently only accepts single contributions via post with :cid
	ctx.state.mid = decodeURIComponent(ctx.params.mid)
	ctx.session.MemberSession.challenge_id = ctx.state.mid
	ctx.state.title = ''
	ctx.state.subtitle = `Enter passphrase for activation [member ${ ctx.Globals.sysName(ctx.params.mid) }]:`
	await ctx.render('members-challenge')
}
async function logout(ctx){
	ctx.session = null
	ctx.redirect('/')
}
async function loginSelect(ctx){
	ctx.state.title = ''
	//	listing comes from state.hostedMembers
	// @todo: should obscure and hash ids in session.mjs
	// @todo: set and read long-cookies for seamless login
	ctx.state.hostedMembers = ctx.hostedMembers
		.sort(
			(a, b) => a.localeCompare(b)
		)
		.map(
			_mbr_id => ({ 'id': _mbr_id, 'name': ctx.Globals.sysName(_mbr_id) })
		)
	ctx.state.subtitle = `Select your personal Avatar to continue:`
	await ctx.render('members-select')
}
async function members(ctx){ // members home
	ctx.state.subtitle = `Welcome Agent ${ctx.state.member.agentName}`
	await ctx.render('members')
}
async function passphraseReset(ctx){
	const { avatar, } = ctx.state
	if(avatar?.isMyLife ?? true)
		ctx.throw(400, `cannot reset system passphrase`)
	const { passphrase } = ctx.request.body
	if(!passphrase?.length)
		ctx.throw(400, `passphrase required for reset`)
	ctx.body = await avatar.resetPassphrase(passphrase)
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
/**
 * Proxy for uploading files to the API.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - The result of the upload as `ctx.body`.
 */
async function upload(ctx){
	const { avatar, } = ctx.state
	if(avatar.isMyLife)
		throw new Error('Only logged in members may upload files')
	ctx.session.APIMemberKey = avatar.mbr_id
	ctx.session.isAPIValidated = true
	await apiUpload(ctx)
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
 * @module
 * @param {object} ctx Koa Context object 
 */
function mSetContributions(ctx){
	const { avatar, } = ctx.state
	if(!ctx.params?.cid)
		ctx.throw(400, `missing contribution id`) // currently only accepts single contributions via post with :cid
	ctx.state.cid = ctx.params.cid
	const _contribution = ctx.request.body?.contribution??false
	if(!_contribution)
		ctx.throw(400, `missing contribution data`)
	avatar.contribution = ctx.request.body.contribution
	return avatar.contributions
		.filter(_contribution => (_contribution.id === ctx.state.cid))
		.map(_contribution => (_contribution.memberView))
}
/* exports */
export {
	about,
	activateBot,
	alerts,
	bots,
	category,
	challenge,
	chat,
	collections,
	contributions,
	createBot,
	deleteItem,
	help,
	greetings,
	index,
	interfaceMode,
	login,
	logout,
	loginSelect,
	members,
	passphraseReset,
	privacyPolicy,
	signup,
	upload,
}