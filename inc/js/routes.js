// imports
import Router from 'koa-router'
import fs from 'fs'
import { koaBody } from 'koa-body'
import { about, board, challenge, chat, index, members, register, upload, _upload } from './functions.js'
// variables
const _Router = new Router()
function connectRoutes(_Agent,_Menu){
	//	validation
	_Router.all('/member', _memberValidate)
	//	*routes
	_Router.get('/', index)
	_Router.get('/about', about)
	_Router.get('/board', board)
	_Router.get('/board/:bid', board)
	_Router.get('/members', members)
	_Router.get('/members/:mid', members)
	_Router.get('/members/upload', upload)
	_Router.get('/register', register)
	_Router.post('/', chat)
	_Router.post('/board', chat)
	_Router.post('/challenge', challenge)
	_Router.post('/members/upload', koaBody(), _validateFile, _upload)

	return _Router
}
async function _memberValidate(ctx, next) {
	// validation logic
	if (ctx.session.locked) {
		ctx.status = 401 // Unauthorized
		ctx.body = "Unauthorized access to member route."
		return
	}
	return next()
}

async function _validateFile(ctx, next){
	//	define variables
	const { lastModifiedDate, filepath, newFilename, originalFilename, mimetype, size } = ctx.request.files.file
	ctx.state._uploadFile ={
		...{ lastModifiedDate, filepath, newFilename, originalFilename, mimetype, size },
		...ctx.request.body
	}
	const allowedMimeTypes = [
		'application/json',
		'application/msword',
		'application/pdf',
		'application/rtf',
		'application/vnd.ms-powerpoint',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'text/csv',
		'text/html',
		'text/markdown',
		'text/plain',
	]
	// reject size
	if (ctx.state._uploadFile.size > 1000000) {
		ctx.status = 413 // Payload Too Large
		ctx.body = `File size too large. File size must be less than 1MB.`
		return
	}
	//	reject mime-type
	if (!allowedMimeTypes.includes(ctx.state._uploadFile.mimetype)) {
		ctx.status = 415 // Unauthorized
		ctx.body = `Unsupported media type: ${ctx.state._uploadFile.mimetype}. File type not allowed.`
		return
	}
	const _uploadDestination = `./.uploads/.tmp/${ctx.request.body.name??originalFilename}`
	const reader = fs.createReadStream(filepath)	// create a read stream
	const stream = fs.createWriteStream(_uploadDestination)	// create a write stream
	reader.pipe(stream)	// pipe the file to the destination
	console.log('File uploaded successfully', ctx.state._uploadFile)

	return next()
}

// exports
export default function init(_Agent,_Menu) {
	connectRoutes(_Agent,_Menu)
	return _Router
}