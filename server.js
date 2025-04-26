/** imports **/
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
/* server imports */
import Koa from 'koa'
import { koaBody } from 'koa-body'
import koaConnect from 'koa-connect'
import mount from 'koa-mount'
import render from 'koa-ejs'
import session from 'koa-generic-session'
import serve from 'koa-static'
/* misc imports */
import chalk from 'chalk'
/* local service imports */
import SystemAvatar from './inc/js/mylife-factory.mjs'
import {
	app as nandaRegisteryApp,
	mcpManager as nandaMCPManager,
	server as nandaServer,
} from './inc/services/nanda/server/dist/server/src/index.js'
/** variables **/
const version = '0.0.36'
const app = new Koa()
const port = process.env.PORT
	?? '3000'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const _Maht = await SystemAvatar // Mylife is the pre-instantiated exported version of organization with very unique properties. MyLife class can protect fields that others cannot, #factory as first refactor will request
if(!process.env.MYLIFE_HOSTING_KEY || process.env.MYLIFE_HOSTING_KEY !== _Maht.hosting_key)
	throw new Error('Invalid hosting key. Server will not start.')
_Maht.version = version
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
const serverRouter = await _Maht.router
console.log(chalk.bgBlue('created-system-avatar:', chalk.bgRedBright('MAHT'), chalk.bgGreenBright(_Maht.version)))
/** RESERVED: test harness **/
/** application startup **/
const nandaClientPath = path.join(process.cwd(), 'inc', 'services', 'nanda', 'client', 'build')
render(app, {
	root: path.join(__dirname, 'views'),
	layout: 'layout',
	viewExt: 'html',
	cache: false,
	debug: false,
})
setInterval(
	checkForLiveAlerts,
	JSON.parse(process.env.MYLIFE_SYSTEM_ALERT_CHECK_INTERVAL ?? '60000')
)
/* upload directory */
const uploadDir = path.join(__dirname, '.tmp')
if(!fs.existsSync(uploadDir)){
	fs.mkdirSync(uploadDir, { recursive: true })
}
app.context.SystemAvatar = _Maht
app.context.Globals = _Maht.globals
app.context.Globals.rootDirectory = __dirname
app.context.menu = _Maht.menu
app.context.mcpSessionMeta ??= new Map()
app.keys = [
	process.env.MYLIFE_SESSION_KEY
		?? `mylife-session-failsafe|${ _Maht.newGuid }`
]
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/nanda') || ctx.path.startsWith('/nanda-registry')) // ⚡ Skip koaBody for Nanda API and registry paths
    await next()
  else
    await koaBody({
      multipart: true,
      formidable: {
        keepExtensions: true,
        maxFileSize: parseInt(process.env.MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT_ADMIN) || 10485760,
        uploadDir: uploadDir,
        onFileBegin: (name, file) => {
          const { filepath, mimetype, newFilename, originalFilename, size } = file
          let extension = path.extname(originalFilename).toLowerCase()
          if (!extension)
            extension = mimeTypesToExtensions[mimetype]?.[0]
          const validFileType = mimeTypesToExtensions[mimetype]?.includes(extension)
          if (!validFileType)
            throw new Error('Invalid mime type')
          const { name: filename } = path.parse(originalFilename)
          const safeName = filename.replace(/[^a-z0-9.]/gi, '_').replace(/\s/g, '-').toLowerCase() + extension
          file.newFilename = safeName
          file.filepath = path.join(uploadDir, safeName)
        }
      }
    })(ctx, next)
})

	.use(serve(path.join(__dirname, 'views', 'assets')))
	.use(mount('/nanda', serve(nandaClientPath)))
	.use(
		session(	//	session initialization
			{
				key: 'mylife.sid',   // cookie session id
				maxAge: parseInt(process.env.MYLIFE_SESSION_TIMEOUT_MS) || 900000, // session lifetime in milliseconds
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
	.use(mount('/nanda-registry', koaConnect(nandaRegisteryApp)))
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
		ctx.state.menu = ctx.SystemAvatar.menu
		ctx.state.version = ctx.SystemAvatar.version
		await next()
	})
	.use(async(ctx,next) => { // alert check
		await next()
	})
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
/** server functions **/
function checkForLiveAlerts(){
	_Maht.alerts()
}