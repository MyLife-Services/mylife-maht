//	*imports
import { abort } from 'process'
import path from 'path'
import { fileURLToPath } from 'url'
//	server
import Koa from 'koa'
import { koaBody } from 'koa-body'
import render from 'koa-ejs'
import session from 'koa-generic-session'
import serve from 'koa-static'
//	import Router from 'koa-router'
//	misc
import chalk from 'chalk'
//	local services
import MyLife from './inc/js/mylife-agent-factory.mjs'
//	constants/variables
const app = new Koa()
const port = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MemoryStore = new session.MemoryStore()
const _Maht = MyLife // Mylife is the pre-instantiated exported version of organization with very unique properties. MyLife class can protect fields that others cannot, #factory as first refactor will request
const serverRouter = await _Maht.router
console.log(chalk.bgBlue('created-core-entity:', chalk.bgRedBright('MAHT')))
//	test harness region

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
//	app.context.AgentFactory = _Maht.factory	//	todo: remove ctx.AgentFactory, rely on ctx.MyLife, no direct access to manipulate system factory
app.context.Globals = _Maht.globals
app.context.menu = _Maht.menu
app.context.hostedMembers = JSON.parse(process.env.MYLIFE_HOSTED_MBR_ID)	//	array of mbr_id
//	does _Maht, as uber-sessioned, need to have ctx injected?
app.keys = [process.env.MYLIFE_SESSION_KEY || `mylife-session-failsafe|${_Maht.newGuid()}`]
// Enable Koa body w/ configuration
app.use(koaBody({
    multipart: true,
    formidable: {
        maxFileSize: parseInt(process.env.MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT_ADMIN) || 10485760, // 10MB in bytes
    },
}))
	.use(serve(path.join(__dirname, 'views', 'assets')))
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
		if(!ctx.session?.MemberSession){
			ctx.session.MemberSession = await _Maht.getMyLifeSession()	//	create default locked session upon first request
			//	assign listeners to session
			ctx.session.MemberSession
				.on( 'session-init', async (_session)=>{
					console.log(chalk.bgBlackBright('session-init'), _session.core)
				}
			)
			ctx.session.MemberSession
				.on( 'member-unlocked', async (_mbr_id)=>{
					console.log(chalk.bgBlackBright('member-unlocked'), _mbr_id)
				}
			)
			ctx.session.MemberSession
				.on( 'onInit-member-initialize', async (_member)=>{
					console.log(chalk.bgBlackBright('onInit-member-initialize'), _member)
				}
			)
			await ctx.session.MemberSession
				.init()
			//	MemberSession-external variables
			ctx.session.signup = false
			console.log(chalk.bgBlue('created-member-session', chalk.bgRedBright(ctx.session.MemberSession.threadId)))
		}
		ctx.state.locked = ctx.session.MemberSession.locked
		ctx.state.member = ctx.session.MemberSession?.member??ctx.MyLife	//	point member to session member (logged in) or MAHT (not logged in)
		ctx.state.avatar = ctx.state.member.avatar
		ctx.state.avatar.name = ctx.state.avatar.names[0]
		ctx.state.contributions = ctx.state.avatar.contributions
		ctx.state.menu = ctx.MyLife.menu
		if(!await ctx.session.MemberSession.requestConsent(ctx))
			ctx.throw(404,'asset request rejected by consent')

		await next()
	})
//	.use(MyLifeMemberRouter.routes())	//	enable member routes
//	.use(MyLifeMemberRouter.allowedMethods())	//	enable member routes
	.use(serverRouter.routes())	//	enable system routes
	.use(serverRouter.allowedMethods())	//	enable system routes
	.listen(port, () => {	//	start the server
		console.log(chalk.bgGreen(`server available on port ${port}`))
	})