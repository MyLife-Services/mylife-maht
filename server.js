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
import MylifeMemberSession from './inc/js/session.js'
import MylifeSystemError from './inc/js/error.js'
//	bootstrap
//	koaenv.config()
//	constants/variables
const app = new Koa()
const port = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MemoryStore = new session.MemoryStore()
//	assign mylife-specific singletons
const mylifeDataservices=await new Dataservices()
	.init()	//	initialize the data manager
const mylifeMemberAgent = new MemberAgent(mylifeDataservices.core)
//	attach event listeners
mylifeMemberAgent
	.on('getMemberPrimaryChat',async (_callback)=>{
		const _chat = await mylifeDataservices.getMemberPrimaryChat()	//	returns array of 1
		if(_callback)	_callback(_chat[0])
	})
	.on('setItem',async (_data,_callback)=>{
		const _item = await mylifeDataservices.pushItem(_data.inspect())	//	present flat object
		if(_callback)	_callback(_item)
	})
	.on('testEmitter',(_callback)=>{
		if(_callback)	_callback(true)
	})
	.on('commitRequest',mylifeDataservices.commitRequest.bind(mylifeDataservices))
mylifeMemberAgent.init()	//	initialize the member agent after listeners are attached
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
			console.log(chalk.bgBlue('created-member-session-requesting',ctx.session.MemberAgent.chat))
		}
		await next()
	})
	.use(bodyParser())	//	enable body parsing
	.use(serve(path.join(__dirname, 'client')))	// define a route for the index page and browsable directory
	.use(MyLifeMemberRouter.routes())	//	enable member routes
	.use(MyLifeRouter.routes())	//	enable system routes
	.listen(port, () => {	//	start the server
		console.log(chalk.bgGreenBright('server available')+chalk.yellow(`\nlistening on port ${port}`))
	})
