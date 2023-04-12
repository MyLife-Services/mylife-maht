//	imports and config
//	server
import Koa from 'koa'
import Router from 'koa-router'
import bodyParser from 'koa-bodyparser'
import serve from 'koa-static'
import session from 'koa-session'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import chalk from 'chalk'
//	import { Transform } from 'stream'
//	misc
import koaenv from 'dotenv'
import Dataservices from './inc/js/mylife-data-service.js'
import MylifeMemberSession from './inc/js/session.js'
import MylifeSystemError from './inc/js/error.js'
import MemberAgent from './member/core.js'
//	bootstrap
koaenv.config()
//	constants/variables
const app = new Koa()
const router = new Router()
const port = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const mylifeDataservices=await new Dataservices().init()	//	initialize the data manager
//	pseudo-constructor
//	MemberAgent.emitter.on('commit', commitRequest) // listen for commit requests from the included module
//	app bootup
app.keys = [`${process.env.MYLIFE_SESSION_KEY}`,'mylife-session-02']
app.use(session({
	key: 'mylife-session',   // cookie name
	maxAge: 86400000,     // session lifetime in milliseconds
	autoCommit: true,
	overwrite: true,
	httpOnly: true,
	signed: true,
	rolling: false,
	renew: false,}, app))
//	session functionality -- not sure yet how to incorporate
//	session object should be: core personality doc
app.use(async ctx => {
  if (!ctx.session.MylifeMemberSession) {
    ctx.session.MylifeMemberSession = new MylifeMemberSession()
  }
  console.log('member-session-request',ctx.session.MylifeMemberSession)
})
//	routes
//	SYSTEM ONE
router.post(
	'MemberAgentQuestion',
	'/question',
	async ctx => {
		const _message = ctx.request.body.message
		console.log('processing message',chalk.greenBright(_message))
		const _response = 
			await MemberAgent.processRequest(_message)
				.then()
				.catch(err=>{
					new MylifeSystemError(err)
						.handleError()
				})
		ctx.body = { 'answer': _response }
	}
)
router.get(
	'MemberAgentAssistant',
	'/getAssistant',
	ctx => {
		ctx.body = { 'answer': MemberAgent.getAssistant() }
	}
)
router.get(
	'MemberSession',
	'/getMemberSession',
	ctx => {
		ctx.body = { 'answer': MemberAgent.getAssistant() }
	}
)
//	PRIVATE functions
async function commitRequest(_data={}) {
	console.log('received request',chalk.greenBright(_data))
	await mylifeDataservices.commit(_data)
}
app.use(serve(path.join(__dirname, 'client')))	// define a route for the index page and browsable directory
app.use(bodyParser())
app.use(router.routes())
//	full operable
app.listen(port, () => {
  console.log(`server available and listening on port ${port}`)
})