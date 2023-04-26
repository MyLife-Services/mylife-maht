// imports
import Router from 'koa-router'
import { about, board, chat, index, register } from './functions.js'
// variables
const router = new Router()
//	top-level system routes
router.get('/', index)
//	router.post('/', chat)
router.post(
	'/',
	async ctx => {
		console.log('chat-request-post')
		await global.Maht.processChatRequest(ctx)
			.then(_response => ctx.body = { 'answer': _response })
	}
)
router.get('/about', about)
router.get('/board', board)
router.post(
	'/board', 
	async ctx => {
		console.log('board-chat-request-post')
		await ctx.session.Member.processChatRequest(ctx)
			.then(_response => ctx.body = { 'answer': _response })
	}
)
router.get('/board/:bid', board)
router.get('/register', register)
//	exports
export { router }