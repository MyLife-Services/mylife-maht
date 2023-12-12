// imports
import Router from 'koa-router'
import { challenge, chat, index, members, register, signup, upload, _upload } from './functions.mjs'
// variables
const _Router = new Router()
function connectRoutes(_Menu){
	//	validation
	_Router.all('/member', _memberValidate)
	//	*routes
	_Router.get('/', index)
	_Router.get('/status', status)
	_Router.get('/members', members)
	_Router.get('/members/:mid', members)
	_Router.get('/members/upload', upload)
	_Router.get('/register', register)
	_Router.post('/', chat)
	_Router.post('/challenge', challenge)
	_Router.post('/members/upload', _upload)
	_Router.post('/signup', signup)

	return _Router
}
/**
 * Validates member session is locked
 * @param {object} ctx Koa context object
 * @param {function} next Koa next function
 * @returns {function} Koa next function
 */
async function _memberValidate(ctx, next) {
	// validation logic
	if(!status(ctx)) {
		ctx.status = 401 // Unauthorized
		ctx.body = "Unauthorized access to member route."
		return
	}
	return next()
}
/**
 * Returns the member session logged in status
 * @param {object} ctx Koa context object
 * @returns {boolean} false if member session is locked, true if registered and unlocked
 */
function status(ctx){	//	currently returns "locked" status, could send object with more info
	ctx.body = !ctx.state?.locked??true
}
// exports
export default function init(_Menu) {
	connectRoutes(_Menu)
	return _Router
}