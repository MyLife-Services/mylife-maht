async function about(ctx){
	await ctx.render('about', {	//	about
		title: 'About MyLife',
		subtitle: 'Learn more about MyLife and your superintelligent future',
	})
}
async function index(ctx){
	await ctx.render('index', {
		title: `Meet ${ global.ServerAgent.agentName }`,
		subtitle: `AI-Agent for MyLife's membership and board of directors`,
		board: ['Erik','Steve','Ken','Emily','Russ','Sam'],
	})
}
async function register(ctx){
	await ctx.render('register', {	//	register
		title: 'Register',
		subtitle: 'Register for MyLife',
		registerEmail: global.ServerAgent.email,
	})
}
// exports
export {
	about,
	index,
	register,
}