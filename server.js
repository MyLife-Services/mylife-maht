//	imports and config
//	server
import Koa from 'koa'
import Router from 'koa-router'
import bodyParser from 'koa-bodyparser'
import serve from 'koa-static'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
//	misc
import koaenv from 'dotenv'
koaenv.config()
import chalk from 'chalk'
import processRequest from './maht/maht.js'
//	constants/variables
const app = new Koa()
const router = new Router()
const port = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
//	routes
router.get(
	'/chat',
	async ctx => {
		const { message } = ctx.request.query
		await processRequest({ message })
		const answer = response.trim()
		ctx.body = { answer }
	}
)

router.post(
	'myName',
	'/chat',
	async ctx => {
		console.log(ctx.request.body.message)
		const _message = ctx.request.body.message
		const _response = await processRequest(_message)
		ctx.body = { 'answer': _response }
	}
)
//	app bootup
app.use(serve(path.join(__dirname, 'client')))	// define a route for the index page and browsable directory
app.use(bodyParser())
app.use(router.routes())
//	full operable
app.listen(port, () => {
  console.log(`server available and listening on port ${port}`)
})