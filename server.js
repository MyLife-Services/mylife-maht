//	*imports
import { abort } from 'process'
//	native node [less dotenv => azure web app]
import path from 'path'
import { fileURLToPath } from 'url'
//	server
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import serve from 'koa-static'
import session from 'koa-generic-session'
//	misc
import chalk from 'chalk'
//	local services
//	import { commitRequest } from './inc/js/functions.js'
//	import MylifeMemberSession from './inc/js/session.js'
import Globals from './inc/js/globals.js'
import Dataservices from './inc/js/mylife-data-service.js'
import Member from './member/core.js'
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
const MemoryStore = new session.MemoryStore()
//	Maht Singleton for server scope
const _globals = await new Globals()
	.init()
const _Maht = new Member(
	(await new Dataservices().init()),
	_globals
)
//	attach event listeners
_Maht
	.on('testEmitter',(_callback)=>{
		if(_callback)	_callback(true)
	})
_Maht.init()	//	initialize member after event listeners are attached
console.log(chalk.bgBlue('created-core-entity'))
console.log(_Maht)
//	app bootup
app.keys = [`${process.env.MYLIFE_SESSION_KEY}`]
//	app definition
app.use(
	session(	//	session initialization
		{
			key: 'mylife.sid',   // cookie session id
			maxAge: 86400000,     // session lifetime in milliseconds
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
	.use(async (ctx,next) => {
		if (!ctx.session?.MemberAgent) {
			ctx.session.MemberAgent = _Maht
			console.log(chalk.bgBlue('created-member-session-requesting',ctx.session.MemberAgent.chat))
		}
		await next()
	})
	.use(bodyParser())	//	enable body parsing
	.use(serve(path.join(__dirname, 'client')))	// define a route for the index page and browsable directory
	.use(MyLifeMemberRouter.routes())	//	enable member routes
	.use(MyLifeRouter.routes())	//	enable system routes
	.listen(port, () => {	//	start the server
		console.log(chalk.bgGreen(`server available on port ${port}`))
	})