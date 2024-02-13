//	*imports
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
import { _ } from 'ajv'
//	constants/variables
const app = new Koa()
const port = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MemoryStore = new session.MemoryStore()
const _Maht = await MyLife // Mylife is the pre-instantiated exported version of organization with very unique properties. MyLife class can protect fields that others cannot, #factory as first refactor will request
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
// Set an interval to check for alerts every minute (60000 milliseconds)
setInterval(checkForLiveAlerts, process.env?.MYLIFE_SYSTEM_ALERT_CHECK_INTERVAL??60000)
//	app bootup
//	app context (ctx) modification
app.context.MyLife = _Maht
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
			/* create generic session [references/leverages modular capabilities] */
			ctx.session.MemberSession = await ctx.MyLife.getMyLifeSession()	//	create default locked session upon first request; does not require init(), _cannot_ have in fact, as it is referencing a global modular set of utilities and properties in order to charge-back to system as opposed to member
			/* platform-required session-external variables */
			ctx.session.signup = false
			/* log */
			console.log(chalk.bgBlue('created-member-session'))
		}
		ctx.state.locked = ctx.session.MemberSession.locked
		ctx.state.MemberSession = ctx.session.MemberSession	//	lock-down session to state
		ctx.state.member = ctx.state.MemberSession?.member
			??	ctx.MyLife	//	point member to session member (logged in) or MAHT (not logged in)
		ctx.state.avatar = ctx.state.member.avatar
		ctx.state.avatar.name = ctx.state.avatar.names[0]
		ctx.state.contributions = ctx.state.avatar.contributions
		ctx.state.menu = ctx.MyLife.menu
		if(!await ctx.state.MemberSession.requestConsent(ctx))
			ctx.throw(404,'asset request rejected by consent')

		await next()
	})
	.use(async(ctx,next) => { // alert check
		await next()
	})
//	.use(MyLifeMemberRouter.routes())	//	enable member routes
//	.use(MyLifeMemberRouter.allowedMethods())	//	enable member routes
	.use(serverRouter.routes())	//	enable system routes
	.use(serverRouter.allowedMethods())	//	enable system routes
	.listen(port, () => {	//	start the server
		console.log(chalk.bgGreenBright('server available')+chalk.yellow(`\nlistening on port ${port}`))
	})
// Example of a periodic alert check function
function checkForLiveAlerts() {
    console.log("Checking for live alerts...")
	_Maht.getAlerts()	
}
