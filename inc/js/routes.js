// imports
import Router from 'koa-router'
import { about, board, challenge, chat, index, members, register, upload, _upload } from './functions.mjs'
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
	_Router.post('/members/upload', _upload)

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
// exports
export default function init(_Agent,_Menu) {
	connectRoutes(_Agent,_Menu)
	return _Router
}