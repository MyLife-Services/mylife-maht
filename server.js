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
router.get('/chat', async ctx => {
	const { message } = ctx.request.query
	await mahtModule.processRequest({ message })
	const answer = response.trim()
	ctx.body = { answer }
})

app.use(serve(__dirname))
app.use(bodyParser())
app.use(router.routes())

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})

console.log(`${chalk.yellowBright('### MAHT - running on GPT-3.5-TURBO. ####')}\n`, await processRequest('as a system assistant do you have access to the public github for Maht?'))