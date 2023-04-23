async function about(ctx){
	await ctx.render('about', {	//	about
		title: 'About MyLife',
		subtitle: 'Learn more about MyLife and your superintelligent future',
	})
}
async function board(ctx){
	const _boardAgent = ''	//	get from url-param (get or post) load 
	await ctx.render('board', {	//	board
		title: 'Board of Directors',
		subtitle: 'Meet the MyLife board of directors',
		board: global.Maht.board,	//	array of nav objects by mbr_id
		boardAgent: _boardAgent,	//	agent object
	})
}
async function index(ctx){
	await ctx.render('index', {
		title: `Meet ${ global.Maht.agentName }`,
		subtitle: `${global.Maht.agentDescription}`,
		board: global.Maht.board,	//	array of nav objects by mbr_id
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
	board,
	index,
	register,
}