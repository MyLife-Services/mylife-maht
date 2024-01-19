// imports
import Router from 'koa-router'
import {
    about,
    activateBot,
    alerts,
    api_register,
    avatarListing,
    bots,
    category,
    challenge,
    chat,
    contributions,
    index,
    login,
    loginSelect,
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
_Router.get('/alerts', alerts)
_Router.get('/login/:mid', login)
_Router.get('/select', loginSelect)
_Router.get('/status', status)
_Router.get('/privacy-policy', privacyPolicy)
_Router.get('/signup', status_signup)
_Router.post('/', chat)
_Router.post('/challenge', challenge)
_Router.post('/signup', signup)
/* api webhook routes */
_apiRouter.use(_tokenValidate)
_apiRouter.get('/alerts', alerts)
_apiRouter.get('/alerts/:aid', alerts)
_apiRouter.post('/register', api_register)
/* member routes */
_memberRouter.use(_memberValidate)
_memberRouter.get('/', members)
_memberRouter.get('/avatars', avatarListing)
_memberRouter.get('/avatars/:aid', avatarListing)
_memberRouter.get('/bots', bots)
_memberRouter.get('/bots/:bid', bots)
_memberRouter.get('/contributions/', contributions)
_memberRouter.get('/contributions/:cid', contributions)
_memberRouter.get('/upload', upload)
_memberRouter.post('/category', category)
_memberRouter.post('/', chat)
_memberRouter.post('/upload', _upload)
_memberRouter.post('/bots', bots)
_memberRouter.post('/bots/activate/:bid', activateBot)
_memberRouter.post('contributions/:cid', contributions)
_memberRouter.put('/bots/:bid', bots)
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
    if(ctx.state.locked) {
        ctx.redirect(
            ( ctx.params?.mid?.length??false)
            ?   `/login/${encodeURIComponent(ctx.params.mid)}`
            :   '/select'
        ) // Redirect to /members if not authorized
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
        const _error = {
            name: error.name,
            message: error.message,
            stack: error.stack
        }
        ctx.body = { message: 'Unauthorized Access', error: _error }
        return
    }
}
// exports
export default function init(_Menu) {
	connectRoutes(_Menu)
	return _Router
}