// provide mechanic so that local installations can still hook up with MyLife Service
//	this is MyLife server tech -- although distributable, it would be the gum that manages the final relationship with MyLife Mothership; if you can self-host, that's great! Here's how you do it...
//	server should handle routes?
//	server should handle the general intelligence around agent <-> agent interaction

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
import processRequest from './maht/core.js'
import mylifeError from './inc/js/error.js'
//	bootstrap
koaenv.config()
console.log(process.env.MYLIFE_KERNAL_DIR)
//	constants/variables
const app = new Koa()
const router = new Router()
const port = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

//	routes
//	MAHT
router.post(
	'gptTurboMaht',
	'/chat',
	async ctx => {
		const _message = ctx.request.body.message
		console.log('processing message',chalk.greenBright(_message))
		const _response = 
			await processRequest(_message)
				.then()
				.catch(err=>{
					mylifeError.handleError(err)
				})
		ctx.body = { 'answer': _response }
	}
)
//	BOARD
router.post(
	'gptTurboBoard',
	'/board',
	async ctx => {
		const _message = ctx.request.body.message
		console.log('processing board message',chalk.greenBright(_message))
		const _response = 
			await processRequest(_message,'board')
				.then()
				.catch(err=>{
					mylifeError.handleError(err)
				})
		ctx.body = { 'answer': _response }
	}
)
//	app bootup
app.use(serve(path.join(__dirname, 'client')))	// define a route for the index page and browsable directory
app.use(bodyParser())
app.use(router.routes())
app.keys = [process.env.SECRETKEY]
app.use(session(app))	 // Include the session middleware
//	session functionality -- not sure yet how to incorporate
app.use(function *(){
   let n = this.session.views || 0
   this.session.views = ++n
})
//	full operable
app.listen(port, () => {
  console.log(`server available and listening on port ${port}`)
})

const mbr_id = "<your partition key value>";
const payload = { id: "<your document ID>", data: "<your document data>" };

createCoreMylifeAccount(mbr_id, payload)
  .then(doc => console.log(doc))
  .catch(err => console.error(err));