// imports
import Router from 'koa-router'
import { about, avatarListing, category, challenge, chat, contributions, index, members, signup, upload, _upload } from './functions.mjs'
// variables
const _Router = new Router()
const _memberRouter = new Router()
//	root routes
_Router.get('/', index)
_Router.get('/about', about)
_Router.get('/status', status)
_Router.get('/members', members) // todo: this should be simpler and more precise a conductor of the request to sub-elements
_Router.get('/members/:mid', members) // todo: dual purposed at moment, should be part of /login route or something akin
_Router.get('/signup', status_signup)
_Router.post('/', chat)
_Router.post('/challenge', challenge)
_Router.post('/signup', signup)
//	members routes
_memberRouter.use(_memberValidate)
_memberRouter.get('/:mid/contributions/', contributions)
_memberRouter.get('/:mid/contributions/:cid', contributions)
_memberRouter.get('/upload', upload)
_memberRouter.post('/category', category)
_memberRouter.post('/', chat)
_memberRouter.post('/upload', _upload)
_memberRouter.post('/:mid/contributions/:cid', contributions)
_memberRouter.get('/:mid/avatars', avatarListing)
// Mount the _memberRouter on the main router at the '/members' path
_Router.use('/members', _memberRouter.routes(), _memberRouter.allowedMethods())
/**
 * Connects the routes to the router
 * @param {object} _Menu Menu object
 * @returns {object} Koa router object
 */
function connectRoutes(_Menu){
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
    if (ctx.state.locked) {
        ctx.redirect('/members') // Redirect to /members if not authorized
        return
    }
    await next() // Proceed to the next middleware if authorized
}
/**
 * Returns the member session logged in status
 * @param {object} ctx Koa context object
 * @returns {boolean} false if member session is locked, true if registered and unlocked
 */
function status(ctx){	//	currently returns reverse "locked" status, could send object with more info
	ctx.body = !ctx.state.locked
}
/**
 * Returns the member session signup status
 * @param {object} ctx Koa context object
 * @returns {boolean} session user has signed up (t/f)
 */
function status_signup(ctx){
	ctx.body = ctx.session.signup
}
// exports
export default function init(_Menu) {
	connectRoutes(_Menu)
	return _Router
}