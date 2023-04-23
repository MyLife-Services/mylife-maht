// imports
import Router from 'koa-router'
const router = new Router()
//	root get() route in server
//	personal routes
router.post(
	'agentChat',
	'/chat',
	async ctx => {
		await ctx.session.MemberAgent.processChatRequest(ctx)
			.then(_response => ctx.body = { 'answer': _response })
	}
)
router.post(
	'agentQuestion',
	'/questions',
	async ctx => {
		ctx.body = { 'answer': _response }
	}
)
router.get(
	'agentInfo',
	'/getAssistant',
	ctx => {
		ctx.body = { 'answer': memberAgent.getAssistant() }
	}
)
//	exports
export { router }