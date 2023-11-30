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
async function board(ctx){
	ctx.session.bid = ctx.params?.bid??0	//	set board member id for session info to use
	ctx.state.title = `Board of Directors`
	await ctx.render('board')	//	board
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
		case !ctx.state.mid:
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
	challenge,
	chat,
	board,
	index,
	members,
	register,
	upload,
	_upload,
}