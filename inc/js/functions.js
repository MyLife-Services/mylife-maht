async function about(ctx){
	ctx.session.member = ctx.MyLife
	ctx.state.member = ctx.session.member
	ctx.state.agent = ctx.state.member.agent
	ctx.state.title = `About MyLife`
	ctx.state.subtitle = `Learn more about MyLife and your superintelligent future`
	await ctx.render('about')	//	about
}
async function board(ctx){
	ctx.session.member = ctx.MyLife.boardMembers[ctx.params.bid]
	ctx.state.member = ctx.session.member
	ctx.state.agent = ctx.state.member.agent
	ctx.state.title = `Board of Directors`
	await ctx.render('board')	//	board
}
async function chat(ctx){
	//	move chat processing to member's agent
	const _response = await ctx.state.member.processChatRequest(ctx)
	ctx.body = { 'answer': _response }
}
async function index(ctx){
	ctx.state.title = `Meet ${ ctx.state.member.agentName }`
	ctx.state.subtitle = `${ctx.state.member.agentDescription}`
	await ctx.render('index')
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
	chat,
	board,
	index,
	register,
}