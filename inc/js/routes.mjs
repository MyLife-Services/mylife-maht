// imports
import Router from 'koa-router'
import {
    about,
    activateBot,
    alerts,
    bots,
    category,
    challenge,
    chat,
    collections,
    contributions,
    deleteItem,
    index,
    interfaceMode,
    login,
    logout,
    loginSelect,
    members,
    passphraseReset,
    privacyPolicy,
    signup,
    upload,
    _upload
} from './functions.mjs'
import {
    experience,
    experienceCast,
    experienceEnd,
    experienceManifest,
    experienceNavigation,
    experiences,
    experiencesLived,
    keyValidation,
    library,
    login as apiLogin,
    logout as apiLogout,
    register,
    story,
    storyLibrary,
    tokenValidation,
} from './api-functions.mjs'
// variables
const _Router = new Router()
const _memberRouter = new Router()
const _apiRouter = new Router()
//	root routes
_Router.get('/', index)
_Router.get('/about', about)
_Router.get('/alerts', alerts)
_Router.get('/login/:mid', login)
_Router.get('/logout', logout)
_Router.get('/select', loginSelect)
_Router.get('/status', status)
_Router.get('/privacy-policy', privacyPolicy)
_Router.get('/signup', status_signup)
_Router.post('/', chat)
_Router.post('/challenge/:mid', challenge)
_Router.post('/signup', signup)
/* api webhook routes */
_apiRouter.use(tokenValidation)
_apiRouter.get('/alerts', alerts)
_apiRouter.get('/alerts/:aid', alerts)
_apiRouter.get('/experiences/:mid', experiences) // **note**: currently triggers autoplay experience
_apiRouter.get('/experiencesLived/:mid', experiencesLived)
_apiRouter.get('/login/:mid', apiLogin)
_apiRouter.get('/logout', apiLogout)
_apiRouter.head('/keyValidation/:mid', keyValidation)
_apiRouter.patch('/experiences/:mid/experience/:eid/cast', experienceCast)
_apiRouter.patch('/experiences/:mid/experience/:eid/end', experienceEnd)
_apiRouter.patch('/experiences/:mid/experience/:eid/manifest', experienceManifest) // proxy for both cast and navigation
_apiRouter.patch('/experiences/:mid/experience/:eid/navigation', experienceNavigation)
_apiRouter.patch('/experiences/:mid/experience/:eid', experience) // **note**: This line should be the last one alphabetically due to the wildcard.
_apiRouter.post('/challenge/:mid', challenge)
_apiRouter.post('/keyValidation/:mid', keyValidation)
_apiRouter.post('/library/:mid', library)
_apiRouter.post('/register', register)
_apiRouter.post('/story/library/:mid', storyLibrary) /* ordered first for path rendering */
_apiRouter.post('/story/:mid', story)
/* member routes */
_memberRouter.use(memberValidation)
_memberRouter.delete('/items/:iid', deleteItem)
_memberRouter.get('/', members)
_memberRouter.get('/bots', bots)
_memberRouter.get('/bots/:bid', bots)
_memberRouter.get('/collections', collections)
_memberRouter.get('/collections/:type', collections)
_memberRouter.get('/contributions', contributions)
_memberRouter.get('/contributions/:cid', contributions)
_memberRouter.get('/experiences', experiences)
_memberRouter.get('/experiencesLived', experiencesLived)
_memberRouter.get('/mode', interfaceMode)
_memberRouter.get('/upload', upload)
_memberRouter.patch('/experience/:eid', experience)
_memberRouter.patch('/experience/:eid/end', experienceEnd)
_memberRouter.patch('/experience/:eid/manifest', experienceManifest)
_memberRouter.post('/', chat)
_memberRouter.post('/bots', bots)
_memberRouter.post('/bots/activate/:bid', activateBot)
_memberRouter.post('/category', category)
_memberRouter.post('contributions/:cid', contributions)
_memberRouter.post('/mode', interfaceMode)
_memberRouter.post('/passphrase', passphraseReset)
_memberRouter.post('/upload', _upload)
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
async function memberValidation(ctx, next) {
    // validation logic
    if(ctx.state.locked){
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
// exports
export default function init(_Menu) {
	connectRoutes(_Menu)
	return _Router
}