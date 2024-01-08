// imports
import Router from 'koa-router'
import {
    about,
    api_register,
    avatarListing,
    category,
    challenge,
    chat,
    contributions,
    index,
    members,
    privacyPolicy,
    signup,
    upload,
    _upload
} from './functions.mjs'
// variables
const _Router = new Router()
const _memberRouter = new Router()
const _apiRouter = new Router()
//	root routes
_Router.get('/', index)
_Router.get('/about', about)
_Router.get('/status', status)
_Router.get('/members', members) // todo: this should be simpler and more precise a conductor of the request to sub-elements
_Router.get('/members/:mid', members) // todo: dual purposed at moment, should be part of /login route or something akin
_Router.get('/privacy-policy', privacyPolicy)
_Router.get('/signup', status_signup)
_Router.post('/', chat)
_Router.post('/challenge', challenge)
_Router.post('/signup', signup)
/* api webhook routes */
_apiRouter.use(_tokenValidate)
_apiRouter.post('/register', api_register)
/* member routes */
_memberRouter.use(_memberValidate)
_memberRouter.get('/:mid/contributions/', contributions)
_memberRouter.get('/:mid/contributions/:cid', contributions)
_memberRouter.get('/upload', upload)
_memberRouter.post('/category', category)
_memberRouter.post('/', chat)
_memberRouter.post('/upload', _upload)
_memberRouter.post('/:mid/contributions/:cid', contributions)
_memberRouter.get('/:mid/avatars', avatarListing)
// Mount the subordinate routers along respective paths
_Router.use('/members', _memberRouter.routes(), _memberRouter.allowedMethods())
_Router.use('/api/v1', _apiRouter.routes(), _apiRouter.allowedMethods())
/* mondular functions */
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
/**
 * Validates api token
 * @param {object} ctx Koa context object
 * @param {function} next Koa next function
 * @returns {function} Koa next function
 */
async function _tokenValidate(ctx, next) {
    try {
        const authHeader = ctx.request.headers['authorization']
        if(!authHeader){
            ctx.status = 401
            ctx.body = { error: 'Authorization header is missing' }
            return
        }
        const _token = authHeader.split(' ')[1] // Bearer TOKEN_VALUE
        if(_token!==process.env.OPENAI_JWT_SECRET){
            ctx.status = 401
            ctx.body = { error: 'Authorization token failure' }
            return
        }
        await next()
    }  catch (error) {
        ctx.status = 401
        ctx.body = { error: 'Unauthorized Access' }
        return
    }
}
// exports
export default function init(_Menu) {
	connectRoutes(_Menu)
	return _Router
}