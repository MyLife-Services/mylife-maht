// imports
import chalk from 'chalk'
import Router from 'koa-router'
import session from 'koa-session'	//	needed?
import MemberAgent from '../core.js'
// variables
const router = new Router()
const memberAgent = new MemberAgent()
//	personal routes
//	SYSTEM ONE
router.post(
	'gptTurboMaht',
	'/chat',
	async ctx => {
		const _message = ctx.request.body.message
		console.log('processing message',chalk.greenBright(_message))
		await memberAgent.processRequest(_message)
			.then(_response => ctx.body = { 'answer': _response })
	}
)
router.post(
	'MemberAgentQuestion',
	'/question',
	async ctx => {
		ctx.body = { 'answer': _response }
	}
)
router.get(
	'MemberAgentAssistant',
	'/getAssistant',
	ctx => {
		ctx.body = { 'answer': memberAgent.getAssistant() }
	}
)
//	exports
export { router }