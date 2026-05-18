/** imports **/
import 'dotenv/config'
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
/* env variables */
const {
	MYLIFE_HOSTING_KEY: mHostingKey,
	MYLIFE_SESSION_KEY: mSessionKey,
	MYLIFE_SESSION_TIMEOUT_MS,
	PORT: MYLIFE_PORT,
} = process.env
const mPort = !isNaN(parseInt(MYLIFE_PORT))
	? parseInt(MYLIFE_PORT)
	: 3000
const mSessionTimeout = !isNaN(parseInt(MYLIFE_SESSION_TIMEOUT_MS))
	? parseInt(MYLIFE_SESSION_TIMEOUT_MS)
	: 900000
/** variables **/
const version = '0.2.0'
const app = new Koa()
const port = mPort
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
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
/** dependent variables */
const C4RG_Intelligence = await SystemAvatar // Mylife is the pre-instantiated exported version of organization with very unique properties. MyLife class can protect fields that others cannot, #factory as first refactor will request
if(!mHostingKey || mHostingKey !== C4RG_Intelligence.hosting_key)
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
app.keys = [ mSessionKey ?? `mylife-session-failsafe|${ C4RG_Intelligence.newGuid }` ]
app
	.use(serve(path.join(__dirname, 'views'))) // Serve everything inside /views as static files
	.use(
		session(	//	session initialization
			{
				key: 'c4rg.sid',   // cookie session id
				maxAge: mSessionTimeout, // session lifetime in milliseconds
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
			const clientDisconnect = err.code==='ECONNRESET' || err.code==='ERR_STREAM_PREMATURE_CLOSE'
			ctx.status = err.statusCode || err.status || 500
			ctx.body = {
				message: err.message
			}
			if(clientDisconnect)
				console.log(`⚡ client disconnected: ${ ctx.method } ${ ctx.path }`)
			else
				console.error(err)
		}
	})
	.use(async (ctx,next)=>{
		ctx.session.avatar ??= ctx.SystemAvatar
		ctx.session.locked ??= true
		ctx.session.signup ??= false
		ctx.session._lastAccess = Date.now()
		ctx.session._sessionId ??= ctx.session.avatar.newGuid // generate New Token
		ctx.state.avatar = ctx.session.avatar
		ctx.state.avatar.sessionId = ctx.session._sessionId // inject token into campaigns
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
/* server routines */
/* 10-minute interval */
const sessionCheckInterval = 10 * 60 * 1000
setInterval(async _=>{
	/* session cleanup */
	const now = Date.now(),
		sessions = Object.entries(app.context.MemoryStore.sessions)
	let mcpTracking = 0,
		sessionTracking = 0
	for(const [sid, session] of sessions){
		const { avatar, _lastAccess, _sessionId, } = session
		if(now - (_lastAccess ?? 0) > mSessionTimeout){
			if(avatar)
				await avatar.campaignServerClose(session)
			app.context.MemoryStore.destroy(sid)
			sessionTracking++
			console.log(`⏱️ Session expired and cleaned: ${sid}`)
		}
	}
	/* MCP session meta erasure */
    for(const [sessionId, sessionMeta] of app.context.mcpSessionMeta){
		const { sessionIdKoa, } = sessionMeta
		const koaSess = await app.context.MemoryStore.get(`koa:sess:${ sessionIdKoa }`)
		if(!koaSess){
			app.context.mcpSessionMeta.delete(sessionId)
			mcpTracking++
		}
    }
	console.log(chalk.greenBright(`⏱️ 10-minute interval server check complete: ${ now }\n`) +
		chalk.gray(`MCP sessions `) + chalk.redBright(`removed: `) + chalk.yellowBright(`${ mcpTracking }\n`) +
		chalk.gray(`Sessions (stale) `) + chalk.redBright(`removed: `) + chalk.yellowBright(`${ sessionTracking }\n`) +
		chalk.greenBright(`Active `) + chalk.gray(`sessions: `) + chalk.yellowBright(`${ sessions.length }`)
	)
}, sessionCheckInterval)
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