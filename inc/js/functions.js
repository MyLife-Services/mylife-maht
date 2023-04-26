async function about(ctx){
	await ctx.render('about', {	//	about
		title: 'About MyLife',
		subtitle: 'Learn more about MyLife and your superintelligent future',
		board: global.Maht.boardListing,	//	array of plain objects by full name
	})
}
async function board(ctx){
	//	parent id SHOULD be '2f5e98b7-4065-4378-8e34-1a9a41c42ab9'
	const _bid = ctx.params?.bid??0
	if(	ctx.session?.Member.agent.id !== await global.Maht.boardMembers[_bid].agent.id ){	//	check session agent against global
		ctx.session.Member = global.Maht.boardMembers[_bid]	//	set session agent to global
		console.log('switching-session-member', ctx.session.Member.agentName)
	}
	await ctx.render('board', {	//	board
		title: 'Board of Directors',
		board: global.Maht.boardListing,	//	array of plain objects by mbr_id
		agent: ctx.session.Member.agent,
	})
}
async function chat(){
	async ctx => {
		await ctx.session.Member.processChatRequest(ctx)
			.then(_response => ctx.body = { 'answer': _response })
	}
}
async function index(ctx){
	await ctx.render('index', {
		title: `Meet ${ global.Maht.agentName }`,
		subtitle: `${global.Maht.agentDescription}`,
		agent: global.Maht,
	})
}
async function register(ctx){
	await ctx.render('register', {	//	register
		title: 'Register',
		subtitle: 'Register for MyLife',
		registerEmail: global.Maht.email,
	})
}
// exports
export {
	about,
	chat,
	board,
	index,
	register,
}