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
import * as systemError from './inc/js/error.js'
import * as systemOne from './system-one/core.js'
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
systemOne.emitter.on('commit', commitRequest) // listen for commit requests from the included module

	console.log(await mylifeDataservices.getQuestions())
//	functions
async function commitRequest(_data={}) {
	console.log('received request',chalk.greenBright(_data))
	await mylifeDataservices.commit(_data)
}
//	routes
//	SYSTEM ONE
router.post(
	'systemOne',
	'/question',
	async ctx => {
		const _message = ctx.request.body.message
		console.log('processing message',chalk.greenBright(_message))
		const _response = 
			await systemOne.processRequest(_message)
				.then()
				.catch(err=>{
					systemError.handleError(err)
				})
		ctx.body = { 'answer': _response }
	}
)
router.get(
	'systemOne',
	'/getAssistant',
	ctx => {
		ctx.body = { 'answer': systemOne.getAssistant() }
	}
)
//	app bootup
app.use(serve(path.join(__dirname, 'client')))	// define a route for the index page and browsable directory
app.use(bodyParser())
app.use(router.routes())
app.use(session(app))	 // Include the session middleware
//	session functionality -- not sure yet how to incorporate
app.use(()=>{
   let n = this.session.views || 0
   this.session.views = ++n
   console.log('views',n)
})
//	full operable
app.listen(port, () => {
  console.log(`server available and listening on port ${port}`)
})