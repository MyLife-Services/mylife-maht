/** conditional imports */
// Support both standard Azure name and custom name for Application Insights
const aiConnectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING 
	|| process.env.MS_APPLICATIONINSIGHTS_CONNECTION_STRING
if(aiConnectionString?.trim() && aiConnectionString.trim() !== 'disabled')
	await importMSAI(aiConnectionString.trim())
/** imports **/
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
/* server imports */
import Koa from 'koa'
import { koaBody } from 'koa-body'
import session from 'koa-generic-session'
import serve from 'koa-static'
/* misc imports */
import chalk from 'chalk'
/* local service imports */
import SystemAvatar from './inc/js/factory.mjs'
/** variables **/
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = new Koa()
const MemoryStore = new session.MemoryStore()
const mimeTypesToExtensions = {
	/* text formats */
	'text/plain': ['.txt', '.markdown', '.md', '.csv', '.log',], // Including Markdown (.md) as plain text
	'text/html': ['.html', '.htm'],
	'text/css': ['.css'],
	'text/javascript': ['.js'],
	'text/xml': ['.xml'],
	'application/json': ['.json'],
	'application/javascript': ['.js'],
	'application/xml': ['.xml'],
  /* image formats */
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
  'image/webp': ['.webp'],
  'image/tiff': ['.tiff', '.tif'],
  'image/bmp': ['.bmp'],
  'image/x-icon': ['.ico'],
  /* document formats */
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/rtf': ['.rtf'],
  'application/vnd.oasis.opendocument.text': ['.odt'],
  'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
  'application/vnd.oasis.opendocument.presentation': ['.odp'],
	/* audio formats */
	'audio/mpeg': ['.mp3'],
	'audio/vorbis': ['.ogg'], // Commonly .ogg can also be used for video
	'audio/x-wav': ['.wav'],
	'audio/webm': ['.weba'],
	'audio/aac': ['.aac'],
	'audio/flac': ['.flac'],
  /* video formats */
  'video/mp4': ['.mp4'],
  'video/x-msvideo': ['.avi'],
  'video/x-ms-wmv': ['.wmv'],
  'video/mpeg': ['.mpeg', '.mpg'],
  'video/webm': ['.webm'],
  'video/ogg': ['.ogv'],
  'video/x-flv': ['.flv'],
  'video/quicktime': ['.mov'],
}
const port = process.env.PORT ?? 3000
const version = '0.1.01'
/** dependent variables */
const C4RG_Intelligence = await SystemAvatar // Mylife is the pre-instantiated exported version of organization with very unique properties. MyLife class can protect fields that others cannot, #factory as first refactor will request
if(!process.env.MYLIFE_HOSTING_KEY || process.env.MYLIFE_HOSTING_KEY !== C4RG_Intelligence.hosting_key)
	throw new Error('Invalid hosting key. Server will not start.')
C4RG_Intelligence.version = version
const serverRouter = await C4RG_Intelligence.router
console.log(chalk.bgBlue('created-system-avatar:', chalk.bgRedBright('C4RG_Intelligence'), chalk.bgGreenBright(C4RG_Intelligence.version)))
/** RESERVED: test harness **/
/** application startup **/
app.context.SystemAvatar = C4RG_Intelligence
app.context.Globals = C4RG_Intelligence.globals
app.context.Globals.rootDirectory = __dirname
app.context.MemoryStore = MemoryStore
app.context.mcpSessionMeta ??= new Map()
app.keys = [
	process.env.MYLIFE_SESSION_KEY
		?? `mylife-session-failsafe|${ C4RG_Intelligence.newGuid }`
]
app
	.use(serve(path.join(__dirname, 'views'))) // Serve everything inside /views as static files
	.use(
		session(	//	session initialization
			{
				key: 'c4rg.sid',   // cookie session id
				maxAge: parseInt(process.env.MYLIFE_SESSION_TIMEOUT_MS) || 900000, // session lifetime in milliseconds
				autoCommit: true,
				overwrite: true,
				httpOnly: false,
				signed: true,
				rolling: false,
				renew: true,
				store: MemoryStore,
			},
			app
		))
	.use(async (ctx,next) => { // GLOBAL ERROR `.catch()` to present in ctx format.
		try {
			await next()
		} catch (err) {
			ctx.status = err.statusCode || err.status || 500
			ctx.body = {
				message: err.message
			}
			console.error(err)
		}
	})
	.use(async (ctx,next)=>{
		ctx.session.locked = ctx.session.locked
			?? true
		ctx.session.signup = ctx.session.signup
			?? false
		ctx.session.avatar = ctx.session.avatar
			?? ctx.SystemAvatar
		ctx.state.avatar = ctx.session.avatar
		ctx.state.locked = ctx.session.locked
		ctx.state.subdomain = ctx.hostname?.split('.')?.[0]
		ctx.state.version = ctx.SystemAvatar.version
		await next()
	})
	.use(async(ctx,next) => { // alert check
		await next()
	})
	.use(koaBody({	//	body parser
		json: true,
		multipart: false,
		text: true,
		urlencoded: true,
	}))
//	.use(MyLifeMemberRouter.routes())	//	enable member routes
//	.use(MyLifeMemberRouter.allowedMethods())	//	enable member routes
	.use(serverRouter.routes())	//	enable system routes
	.use(serverRouter.allowedMethods())	//	enable system routes
/* post-start server functions */
/* server listens */
app.listen(port, () => {	//	start the server
	console.log(chalk.greenBright('server available'))
	console.log(chalk.yellow(`listening on port ${port}`))
})
/** MCP session meta erasure **/
const sessionCheckInterval = 10 * 60 * 1000 // every 10 minutes
setInterval(async _=>{
    for(const [sessionId, sessionMeta] of app.context.mcpSessionMeta){
		const { sessionIdKoa, } = sessionMeta
      const koaSess = await app.context.MemoryStore.get(`koa:sess:${ sessionIdKoa }`)
      if(!koaSess){
        app.context.mcpSessionMeta.delete(sessionId)
        console.log(`⏱️ Removed meta session for ${ sessionId }`, sessionIdKoa)
      }
    }
}, sessionCheckInterval)
/** server functions **/
/**
 * Imports and initializes Microsoft Application Insights for telemetry and monitoring.
 * @param {string} connectionString - application insights connection string from Azure
 * @returns {Promise<void>} - A promise that resolves when Application Insights is set up and started.
 */
async function importMSAI(connectionString){
	try{
		const ai = await import('applicationinsights')
		ai.default
			.setup(connectionString)
			.setAutoCollectRequests(true)
			.setAutoCollectPerformance(true, true)
			.setAutoCollectExceptions(true)
			.setAutoCollectDependencies(true)
			.setAutoCollectConsole(true, true)
			.setUseDiskRetryCaching(true)
			.setSendLiveMetrics(false)
			.start()
		console.log('✅ Application Insights initialized successfully')
		console.log('   Connection String:', connectionString.substring(0, 50) + '...')
	} catch(e){
		console.error(`❌ Failed to initialize Application Insights. Telemetry will be disabled.`)
		console.error('   Error:', e.message)
		console.error('   Stack:', e.stack)
	}
}
/** DEPRECATIONS
setInterval(
	checkForLiveAlerts,
	JSON.parse(process.env.MYLIFE_SYSTEM_ALERT_CHECK_INTERVAL ?? '60000')
)
function checkForLiveAlerts(){
	C4RG_Intelligence.alerts()
}
// upload directory
const uploadDir = path.join(__dirname, '.tmp')
if(!fs.existsSync(uploadDir)){
	fs.mkdirSync(uploadDir, { recursive: true })
}
**/