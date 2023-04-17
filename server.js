//	*imports
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
//	import Globals from './inc/js/globals.js'
//	import { commitRequest } from './inc/js/functions.js'
//	import MylifeMemberSession from './inc/js/session.js'
import Dataservices from './inc/js/mylife-data-service.js'
import MemberAgent from './member/core.js'
import { router as MyLifeMemberRouter } from './member/routes/routes.js'
import { router as MyLifeRouter } from './inc/js/routes.js'
import { commitRequest } from './inc/js/functions.js'
//	dotenv
import koaenv from 'dotenv'
koaenv.config()
//	constants/variables
const app = new Koa()
const port = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MemoryStore = new session.MemoryStore()
const mylifeDataservices=await new Dataservices().init()	//	initialize the data manager
const mylifeMemberAgent = await new MemberAgent(mylifeDataservices.getCore()).init()	//	initialize the member agent
//	attach event listeners
console.log(await mylifeDataservices.getMemberPrimaryChat())
mylifeMemberAgent
	.on('getMemberPrimaryChat',mylifeDataservices.getMemberPrimaryChat.bind(mylifeDataservices))
	.on('commitRequest',commitRequest)
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
			ctx.session.MemberAgent = mylifeMemberAgent
			mylifeMemberAgent.emit('getMemberPrimaryChat',mylifeMemberAgent.memberId)
			console.log(chalk.bgBlue('created-member-session-request'))
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