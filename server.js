//	*imports
import { abort } from 'process'
//	native node [less dotenv => azure web app]
import path from 'path'
import { fileURLToPath } from 'url'
//	server
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import render from 'koa-ejs'
import session from 'koa-generic-session'
//	import Router from 'koa-router'
//	misc
import chalk from 'chalk'
//	local services
import { Factory } from './inc/js/factory.js'
//	dotenv
import koaenv from 'dotenv'
koaenv.config()
//	constants/variables
const app = new Koa()
const port = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MemoryStore = new session.MemoryStore()
const _Factory = new Factory()
//	Maht Singleton for server scope
const _Maht = await _Factory.server(process.env.MYLIFE_SERVER_MBR_ID,_Factory)
const serverRouter = await _Maht.router
console.log(await _Maht.board())
//	hosted members assigned by .env
//	stubbed until accessed, stored in server memory from that point on
//	Agents (:aid) referenced as /members/:mid/:aid/[action]
//	session will be used for agent interactions and authentication AGENT-related Data would be stored by session
//	create class Agent inside of core.js for trinity of Member, Agent, MyLife
console.log(chalk.bgBlue('created-core-entity:', chalk.bgRedBright('MAHT')))
const _sessionConfig = {
	key: process.env?.MYLIFE_SESSION_KEY??_Factory.newGuid,   // cookie session id
	maxAge: process.env?.MYLIFE_SESSION_TIMEOUT_MS??900000,     // session lifetime in milliseconds
	autoCommit: true,
	overwrite: true,
	httpOnly: false,
	signed: true,
	rolling: true,
	renew: true,
	store: MemoryStore,
}
//	koa-ejs
render(app, {
	root: path.join(__dirname, 'views'),
	layout: 'layout',
	viewExt: 'html',
	cache: false,
	debug: false,
})
//	default root routes
//	app bootup
//	app context (ctx) modification
app.context.MyLife = _Maht
app.keys = [`${process.env.MYLIFE_SESSION_KEY}`]
//	app definition
app.use(bodyParser())	//	enable body parsing
	.use(session(_sessionConfig, app))	//	enable session
	.use(async (ctx,next) => {	//	SESSION: member login
		//	system context, koa: https://koajs.com/#request
		ctx.session.id ??= ctx.MyLife.newid	//	assign unique session id
		ctx.session.mbr_id ??= 'guest'


		console.log(ctx.request,ctx.session.id,ctx.MyLife.agent(ctx.session.id))
		//	ctx.session.Member
		ctx.state.board = ctx.MyLife.boardMembers	//	array of member objects by [bid]
		ctx.state.boardListing = ctx.MyLife.boardListing	//	array of plain objects by full name
		ctx.state.menu = ctx.MyLife.menu
		ctx.state.blocked = ctx.session.MemberSession.locked
		//	change to use ctx.MyLife
		ctx.state.hostedMembers = ctx.MyLife.hostedMembers	//	array of mbr_id
		ctx.state.member = 
			(ctx.request.body?.agent==='member' || ctx.request.url.split('/')[1]==='members')	//	to-do: find better way to ascertain
			?	ctx.session.MemberSession.member	//	has key .member (even if `undefined`)
			:	(ctx.request.url.split('/')[1]==='board')
				?	ctx.state.board[ctx.session?.bid??0]	//	cannot bid yet, as there are no params developed at this stage, so just have to rely on alterations later
				:	ctx.MyLife
		ctx.state.agent = ctx.state.member?.agent
		console.log(chalk.bgBlue('ctx.state.agent:', chalk.bgRedBright(ctx.state.member?.agentName)))
		await next()
	})
//	.use(MyLifeMemberRouter.routes())	//	enable member routes
//	.use(MyLifeMemberRouter.allowedMethods())	//	enable member routes
	.use(serverRouter.routes())	//	enable system routes
	.use(serverRouter.allowedMethods())	//	enable system routes
	.listen(port, () => {	//	start the server
		console.log(chalk.bgGreen(`server available on port ${port}`))
	})