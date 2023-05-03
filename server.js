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
import Router from 'koa-router'
//	misc
import chalk from 'chalk'
//	local services
//	import { commitRequest } from './inc/js/functions.js'
//	import MylifeMemberSession from './inc/js/session.js'
import Globals from './inc/js/globals.js'
import Dataservices from './inc/js/mylife-data-service.js'
import Menu from './inc/js/menu.js'
import { Member, MyLife } from './member/core.js'
import { router as MyLifeMemberRouter } from './member/routes/routes.js'
import { router as MyLifeRouter } from './inc/js/routes.js'
//	dotenv
import koaenv from 'dotenv'
koaenv.config()
//	constants/variables
const app = new Koa()
const port = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const router = new Router()
const MemoryStore = new session.MemoryStore()
//	Maht Singleton for server scope
global.Globals = await new Globals()
	.init()
const _Maht = new MyLife(
	(await new Dataservices(process.env.MYLIFE_SERVER_MBR_ID).init())
)
_Maht	//	attach event listeners
	.on('testEmitter',(_callback)=>{
		if(_callback)	_callback(true)
	})
await _Maht.init()	//	initialize member after event listeners are attached
global.Maht = _Maht	//	if human, this is the root, if core is org, it can proxy anyone in session
global.Menu = new Menu().menu
console.log(chalk.bgBlue('created-core-entity:', chalk.bgRedBright('MAHT')))
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
app.keys = [`${process.env.MYLIFE_SESSION_KEY}`]
//	app definition
app.use(
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
		if(!ctx.session?.Member){	//	check if already logged in
			const _mbr_id = JSON.parse(process.env.MYLIFE_HOSTED_MBR_ID)[0]	//	root host id
			ctx.session.Member = await new Member(	//	login currently only supported by .env vars hosted on MyLife azure
				await new Dataservices(_mbr_id)
					.init()
			)
				.init()
			console.log(chalk.bgBlue('created-member:', chalk.bgRedBright(ctx.session.Member.agentName )))
		}
		await next()
	})
	.use(bodyParser())	//	enable body parsing
	.use(router.routes())	//	enable routes
	.use(router.allowedMethods())	//	enable routes
	.use(MyLifeMemberRouter.routes())	//	enable member routes
	.use(MyLifeMemberRouter.allowedMethods())	//	enable member routes
	.use(MyLifeRouter.routes())	//	enable system routes
	.use(MyLifeRouter.allowedMethods())	//	enable system routes
	.listen(port, () => {	//	start the server
		console.log(chalk.bgGreen(`server available on port ${port}`))
	})