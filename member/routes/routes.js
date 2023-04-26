// imports
import Router from 'koa-router'
const router = new Router({
	prefix: '/member'
})
//	root get() route in server
//	personal routes
/*
router.post(
	'/chat',
	async ctx => {
		await ctx.session.Member.processChatRequest(ctx)
			.then(_response => ctx.body = { 'answer': _response })
	}
)
*/
router.post(
	'/questions',
	async ctx => {
		ctx.body = { 'answer': _response }
	}
)
router.get(
	'/getAssistant',
	ctx => {
		ctx.body = { 'answer': ctx.session.Member.getAssistant() }
	}
)
//	exports
export { router }