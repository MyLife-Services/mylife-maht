/* imports */
import {
	upload as apiUpload,
} from './api-functions.mjs'
/* module export functions */
/**
 * Renders the about page for the application. Visitors see the rendered page, members see the page as responses from their DigitalSelf.
 * @param {Koa} ctx - Koa Context object
 * @returns {object|void} - Renders page in place (visitor) or Koa Context object (member)
 */
async function about(ctx){
	if(ctx.state.locked){
		ctx.state.title = `About MyLife`
		await ctx.render('about')
	} else {
		const { DigitalSelf, } = ctx.state
		const response = await DigitalSelf.routine('about')
		ctx.body = response
	}
}
/**
 * Get alerts (or specific alert) for the member/visitor.
 * @param {Koa} ctx - Koa Context object
 * @returns {Object[]} - The array of alerts
 */
async function alerts(ctx){
	const { aid, } = ctx.params
	const { DigitalSelf, } = ctx.state
	if(aid)
		ctx.body = await DigitalSelf.alert(aid)
	else
		ctx.body = await DigitalSelf.alerts()
}
/**
 * Challenge the member session with a passphrase.
 * @public
 * @async
 * @param {Koa} ctx - Koa Context object
 * @param {string} memberId - The member id to challenge
 * @param {string} memberPassphrase - The passphrase to challenge with
 * @returns {boolean} - Whether or not the challenge was successful
 */
async function challenge(ctx, memberId, memberPassphrase){
	const { passphrase=memberPassphrase, } = ctx.request.body
	if(!passphrase?.length)
		ctx.throw(400, `challenge request requires passphrase`)
	const { mid=memberId, } = ctx.params
	if(!mid?.length)
		ctx.throw(400, `challenge request requires member id`)
	if(!ctx.state.locked)
		return true
	const { DigitalSelf, } = ctx.state
	const challengeSuccessful = await DigitalSelf.challengeAccess(mid, passphrase)
	if(challengeSuccessful){
		const { Conversation, } = ctx.session
		ctx.session.locked = false
		ctx.session.DigitalSelf = await DigitalSelf.mylifeMember(mid)
		ctx.state.DigitalSelf = ctx.session.DigitalSelf
		if(Conversation)
			await DigitalSelf.deleteChat(Conversation)
	}
	ctx.body = !ctx.session.locked
}
async function collections(ctx){
	const { type, } = ctx.params
	const { DigitalSelf, } = ctx.state
	ctx.body = await DigitalSelf.collections(type)
}
/**
 * Given an itemId, evaluates aspects of contents of the data record.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - The evaluation ersponse
 */
async function evaluate(ctx){
	const { iid, } = ctx.params
	const { DigitalSelf, } = ctx.state
	ctx.body = await DigitalSelf.evaluate(iid)
}
/**
 * Save feedback from the member.
 * @param {Koa} ctx - Koa Context object
 * @returns {Boolean} - Whether or not the feedback was saved
 */
async function feedback(ctx){
	const { mid: message_id, } = ctx.params
	const { DigitalSelf, } = ctx.state
	const { isPositive=true, message, } = ctx.request.body
	ctx.body = await DigitalSelf.feedback(message_id, isPositive, message)
}
/**
 * Get greetings for active situation.
 * @public
 * @async
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - Greetings response message object: { responses, success, }
 */
async function greetings(ctx){
	const { vld: validateId, } = ctx.query
	let { dyn: dynamic, } = ctx.query
	if(typeof dynamic==='string')
		dynamic = JSON.parse(dynamic)
	const { DigitalSelf, } = ctx.state
	const response = validateId?.length && DigitalSelf.isMyLife
		? await DigitalSelf.validateRegistration(validateId)
		: await DigitalSelf.greeting(dynamic)
	ctx.body = response
}
/**
 * Request help about MyLife.
 * @public
 * @async
 * @param {Koa} ctx - Koa Context object, body={ request: string|required, mbr_id, type: string, }.
 * @returns {object} - Help response message object.
 */
async function help(ctx){
	const { helpRequest, type=`general`, } = ctx.request?.body
	if(!helpRequest?.length)
		ctx.throw(400, `missing help request text`)
	const { DigitalSelf } = ctx.state
	const _avatar = type==='membership' ? DigitalSelf : ctx.SystemAvatar.avatar
	ctx.body = await _avatar.help(helpRequest, type)
}
/**
 * Index page for the application.
 * @public
 * @async
 * @param {object} ctx - Koa Context object
 */
async function index(ctx){
	if(!ctx.state?.locked ?? true)
		ctx.redirect(`/members`) // Redirect to /members if authorized
	await ctx.render('index')
}
async function item(ctx){
	const { iid: id, } = ctx.params
	const { DigitalSelf, } = ctx.state
	const { method, } = ctx.request
	const item = ctx.request.body // always `{}` by default
	if(!item?.id && id?.length)
		item.id = id
	ctx.body = await DigitalSelf.item(item, method, false)
}
/**
 * Logout the member from the system.
 * @param {Koa} ctx - Koa Context object
 * @returns {void} - Redirects to the home page
 */
async function logout(ctx){
	const { DigitalSelf, locked, } = ctx.state
	await DigitalSelf.logout(ctx)
	ctx.redirect('/')
}
/**
 * Returns a member list for selection.
 * @todo: should obscure and hash ids in session.mjs
 * @todo: set and read long-cookies for seamless login
 * @param {Koa} ctx - Koa Context object
 * @returns {Object[]} - List of hosted members available for login.
 */
async function loginSelect(ctx){
	const { DigitalSelf, } = ctx.state
	ctx.body = await DigitalSelf.hostedMembers(process.env.MYLIFE_HOSTING_KEY)
}
async function members(ctx){ // members home
	await ctx.render('members')
}
/**
 * Given an itemId, obscures aspects of contents of the data record.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - The item obscured
 */
async function obscure(ctx){
	const { iid, } = ctx.params
	const { DigitalSelf, } = ctx.state
	ctx.body = await DigitalSelf.obscure(iid)
}
/**
 * Reset the passphrase for the member's DigitalSelf.
 * @param {Koa} ctx - Koa Context object
 * @returns {boolean} - Whether or not passpharase successfully reset
 */
async function passphraseReset(ctx){
	const { DigitalSelf, } = ctx.state
	if(DigitalSelf?.isMyLife ?? true)
		ctx.throw(400, `cannot reset system passphrase`)
	const { passphrase } = ctx.request.body
	if(!passphrase?.length)
		ctx.throw(400, `passphrase required for reset`)
	ctx.body = await DigitalSelf.resetPassphrase(passphrase)
}
/**
 * Display the privacy policy page - ensure it can work in member view.
 * @param {Koa} ctx - Koa Context object
 */
async function privacyPolicy(ctx){
	if(ctx.state.locked){
		ctx.state.title = `MyLife Privacy Policy`
		await ctx.render('privacy-policy')
	} else {
		const { DigitalSelf, } = ctx.state
		const response = await DigitalSelf.routine('privacy')
		ctx.body = response
	}
}
async function signup(ctx) {
    const { avatarName, email, humanName, type='newsletter', } = ctx.request.body
	const signupPacket = {
		avatarName,
		email,
		humanName: humanName.substring(0, 64),
		type,
	}
	let success = false
	if(ctx.session.signup)
		ctx.throw(400, 'Invalid input', { 
			success,
			message: `session user already signed up`,
			payload: signupPacket,
		})
    if(!ctx.Globals.isValidEmail(email))
		ctx.throw(400, 'Invalid input', { 
			success,
			message: 'Invalid input: email',
			payload: signupPacket,
		})
    if(!humanName || humanName.length < 3)
		ctx.throw(400, 'Invalid input', { 
			success,
			message: 'Invalid input: First name must be between 3 and 64 characters: humanNameInput',
			payload: signupPacket,
		})
	if(( avatarName?.length < 3 ?? true ) && type==='register')
		ctx.throw(400, 'Invalid input', {
			success,
			message: 'Invalid input: DigitalSelf name must be between 3 and 64 characters: avatarNameInput',
			payload: signupPacket,
		})
	signupPacket.id = ctx.SystemAvatar.newGuid
	const registrationData = await ctx.SystemAvatar.registerCandidate(signupPacket)
	console.log('signupPacket:', signupPacket, registrationData)
	ctx.session.signup = true
	success = true
	const { mbr_id, ..._registrationData } = signupPacket // do not display theoretical memberId
    ctx.status = 200 // OK
    ctx.body = {
		message: 'Signup successful',
		payload: _registrationData,
        success,
    }
}
async function summarize(ctx){
	const { DigitalSelf, } = ctx.state
	const { fileId, fileName, } = ctx.request.body
	ctx.body = await DigitalSelf.summarize(fileId, fileName)
}
/**
 * Proxy for uploading files to the API.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - The result of the upload as `ctx.body`.
 */
async function upload(ctx){
	const { DigitalSelf, } = ctx.state
	if(DigitalSelf.isMyLife)
		throw new Error('Only logged in members may upload files')
	ctx.session.APIMemberKey = DigitalSelf.mbr_id
	ctx.session.isAPIValidated = true
	await apiUpload(ctx)
}
/* exports */
export {
	about,
	alerts,
	challenge,
	collections,
	evaluate,
	feedback,
	greetings,
	help,
	index,
	item,
	logout,
	loginSelect,
	members,
	obscure,
	passphraseReset,
	privacyPolicy,
	signup,
	summarize,
	upload,
}