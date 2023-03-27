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
//	import { Transform } from 'stream'
//	misc
import chalk from 'chalk'
import processRequest from './maht/maht.js'
//	constants/variables
const app = new Koa()
const router = new Router()
const port = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
//	routes
router.post(
	'myName',
	'/chat',
	async ctx => {
		const _message = ctx.request.body.message
		const _response = await processRequest(_message)
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