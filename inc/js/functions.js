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
	//	send challenge processing to member: currently session, as state is only for page variable representation
	ctx.body = await ctx.session.MemberSession.challengeAccess(ctx.request.body.passphrase)
}
async function chat(ctx){
	//	best way to turn to any agent? build into ctx? get state.member right
	const _response = await ctx.state.member.processChatRequest(ctx)
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
			ctx.state.subtitle = `Select your membership to continue:`
			await ctx.render('members-select')
			break
		case ctx.state.blocked:	//	should emit to server.js to manage ctx session, not here
			ctx.session.MemberSession
			ctx.session.MemberSession.mbr_id = ctx.state.mid	//	initialize member session with 'new' member id
			ctx.state.subtitle = `Enter passphrase for activation [member ${ ctx.state.mid.split('|')[0] }]:`
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
// exports
export {
	about,
	challenge,
	chat,
	board,
	index,
	members,
	register,
}