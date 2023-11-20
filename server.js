//	*imports
import { abort } from 'process'
import path from 'path'
import { fileURLToPath } from 'url'
//	server
import Koa from 'koa'
import { koaBody } from 'koa-body'
import render from 'koa-ejs'
import session from 'koa-generic-session'
//	import Router from 'koa-router'
//	misc
import chalk from 'chalk'
//	local services
import AgentFactory from './inc/js/mylife-agent-factory.mjs'
//	constants/variables
const app = new Koa()
const port = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MemoryStore = new session.MemoryStore()
const _factory = await new AgentFactory().init()
console.log(chalk.bgBlue('created-core-entity:', chalk.bgRedBright('agent-factory')))
const _Maht = _factory.organization	//	use something like `createServer()` for an alternate instance than default
const serverRouter = await _Maht.router
console.log(chalk.bgBlue('created-core-entity:', chalk.bgRedBright('MAHT')))
//	test harness region

//	end test harness region
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
app.context.AgentFactory = _factory
app.context.Globals = _factory.globals
app.context.menu = _Maht.menu
app.context.hostedMembers = JSON.parse(process.env.MYLIFE_HOSTED_MBR_ID)	//	array of mbr_id
app.keys = [process.env.MYLIFE_SESSION_KEY || `mylife-session-failsafe|${_factory.newGuid()}`]
// Enable Koa body w/ configuration
app.use(koaBody({
    multipart: true,
    formidable: {
        maxFileSize: parseInt(process.env.MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT_ADMIN) || 10485760, // 10MB in bytes
    },
}))
	.use(
		session(	//	session initialization
			{
				key: 'mylife.sid',   // cookie session id
				maxAge: process.env.MYLIFE_SESSION_TIMEOUT_MS,     // session lifetime in milliseconds
				autoCommit: true,
				overwrite: true,
				httpOnly: false,
				signed: true,
				rolling: false,
				renew: false,
				store: MemoryStore,
			},
			app
		))
	.use(async (ctx,next) => {	//	SESSION: member login
		//	system context, koa: https://koajs.com/#request
		//	MyLife uses Maht as the default until login
		ctx.state.member = ctx.session?.MemberSession?.member??ctx.MyLife
		ctx.state.avatar = ctx.state.member.avatar
		ctx.state.avatar.name = ctx.state.avatar.names[0]
		ctx.state.menu = ctx.MyLife.menu
		console.log(chalk.bgBlue('ctx.state.avatar:', chalk.bgRedBright(ctx.state.avatar.name)))
		await next()
	})
//	.use(MyLifeMemberRouter.routes())	//	enable member routes
//	.use(MyLifeMemberRouter.allowedMethods())	//	enable member routes
	.use(serverRouter.routes())	//	enable system routes
	.use(serverRouter.allowedMethods())	//	enable system routes
	.listen(port, () => {	//	start the server
		console.log(chalk.bgGreen(`server available on port ${port}`))
	})