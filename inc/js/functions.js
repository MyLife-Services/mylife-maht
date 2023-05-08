async function about(ctx){
	ctx.state.title = `About MyLife`
	ctx.state.subtitle = `Learn more about MyLife and your superintelligent future`
	ctx.state.board = ctx.state.member.boardListing	//	array of plain objects by full name
	await ctx.render('about')	//	about
}
async function board(ctx){
	const _bid = ctx.params?.bid??0
	ctx.state.member.toggleResponseAgent(_bid)	//	toggle session agent
	ctx.state.title = `Board of Directors`
	ctx.state.board = ctx.state.member.boardListing	//	array of plain objects by full name
	console.log(ctx.state.member.board)
	await ctx.render('board')	//	board
}
async function chat(ctx){
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