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
//	misc
//	import koaenv from 'dotenv'
import Dataservices from './inc/js/mylife-data-service.js'
import { router as MyLifeMemberRouter } from './member/routes/routes.js'
import { router as MyLifeRouter } from './inc/js/routes.js'
import MylifeMemberSession from './inc/js/session.js'
import MylifeSystemError from './inc/js/error.js'
import MemberAgent from './member/core.js'
//	bootstrap
//	koaenv.config()
//	constants/variables
const app = new Koa()
const port = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const mylifeDataservices=await new Dataservices().init()	//	initialize the data manager
//	pseudo-constructor
//	MemberAgent.emitter.on('commit', commitRequest) // listen for commit requests from the included module
//	app bootup
app.keys = [`${process.env.MYLIFE_SESSION_KEY}`,'mylife-session-04']
//	PRIVATE functions
async function commitRequest(_data={}) {
	console.log('received request',chalk.greenBright(_data))
	await mylifeDataservices.commit(_data)
}
//	app definition
app.use(
	session(	//	session initialization
		{
			key: 'mylife-session',   // cookie name
			maxAge: 86400000,     // session lifetime in milliseconds
			autoCommit: true,
			overwrite: true,
			httpOnly: true,
			signed: true,
			rolling: false,
			renew: false,
		},
		app
	))
	.use(async (ctx,next) => {
		if (!ctx.session.mylifeMemberSession) {
			ctx.session.mylifeMemberSession = new MylifeMemberSession(mylifeDataservices.getCore())
			console.log('created-member-session-request',ctx.session.mylifeMemberSession.member)
		}
		ctx.state.mylifeMemberCoreData = ctx.session.mylifeMemberSession.member	//	ctx x-fer session -> state
		await next()
	})
	.use(bodyParser())	//	enable body parsing
	.use(serve(path.join(__dirname, 'client')))	// define a route for the index page and browsable directory
	.use(MyLifeMemberRouter.routes())	//	enable member routes
	.use(MyLifeRouter.routes())	//	enable system routes
	.listen(port, () => {	//	start the server
		console.log(chalk.bgGreenBright('server available')+chalk.yellow(`\nlistening on port ${port}`))
	})
