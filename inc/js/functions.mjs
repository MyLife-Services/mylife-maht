//	imports
import fs from 'fs'
import oAIAssetAssistant from './agents/system/asset-assistant.mjs'
import { _ } from 'ajv'
//	pseudo-constructor
//	need to process any session actions at a layer higher than this, preferably session emitter to all objects?
async function about(ctx){
	ctx.state.member = ctx.MyLife.member
	ctx.state.agent = ctx.state.member.agent
	ctx.state.title = `About MyLife`
	ctx.state.subtitle = `Learn more about MyLife and your superintelligent future`
	await ctx.render('about')	//	about
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
async function challenge(ctx){
	ctx.body = await ctx.session.MemberSession.challengeAccess(ctx.request.body.passphrase)
}
async function chat(ctx){
	//	best way to turn to any agent? build into ctx? get state.member(/agent?) right
	const _response = await ctx.state.avatar.chatRequest(ctx)
	ctx.body = { 'answer': _response }
}
async function index(ctx){
	ctx.state.title = `Meet ${ ctx.state.member.agentName }`
	ctx.state.subtitle = `${ctx.state.member.agentDescription}`
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
async function register(ctx){
	ctx.state.title = `Register`
	ctx.state.subtitle = `Register for MyLife`
	ctx.state.registerEmail = ctx.state.agent.email
	await ctx.render('register')	//	register
}
async function signup(ctx) {
    const { email, first_name, avatar_name } = ctx.request.body
	const _signupPackage = {
		'email': email,
		'first_name': first_name,
		'avatar_name': avatar_name,
	}
    // Basic Email Regex for validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	//	validate session signup
	if (ctx.session.signup) {
		ctx.status = 400 // Bad Request
		ctx.body = {
			..._signupPackage,
			success: false,
			message: 'session user already signed up',
		}
		return
	}
	//	validate package
	if (Object.values(_signupPackage).some(value => !value)) {
		const _missingFields = Object.entries(_signupPackage)
			.filter(([key, value]) => !value)
			.map(([key]) => key) // Extract just the key
			.join(', ');
		ctx.status = 400 // Bad Request
		ctx.body = {
			..._signupPackage,
			success: false, 
			message: `Missing required field(s): ${_missingFields}`,
		}
		return
	}
    // Validate email
    if (!emailRegex.test(email)) {
        ctx.status = 400 // Bad Request
        ctx.body = {
			..._signupPackage,
			success: false, 
			message: 'Invalid email',
		}
        return
    }
    // Validate first name and avatar name
    if (!first_name || first_name.length < 3 || first_name.length > 64 ||
        !avatar_name || avatar_name.length < 3 || avatar_name.length > 64) {
        ctx.status = 400 // Bad Request
        ctx.body = {
			..._signupPackage,
			success: false,
			message: 'First name and avatar name must be between 3 and 64 characters',
		}
        return
    }
    // save to `registration` container of Cosmos expressly for signup data
	console.log(await ctx.MyLife.registerCandidate({
		..._signupPackage,
		id: ctx.MyLife.newGuid,
	}))
	// TODO: create account and avatar
    // If all validations pass and signup is successful
	ctx.session.signup = true
    ctx.status = 200 // OK
    ctx.body = {
		..._signupPackage,
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
// exports
export {
	about,
	avatarListing,
	challenge,
	chat,
	index,
	members,
	register,
	signup,
	upload,
	_upload,
}