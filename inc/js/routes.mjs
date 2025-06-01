/* imports */
import Router from 'koa-router'
import {
    availableExperiences,
    entry,
    experience,
    experienceCast,
    experienceEnd,
    experienceManifest,
    experienceNavigation,
    experiences,
    experiencesLived,
    keyValidation,
    logout as apiLogout,
    memory,
    obscure as apiObscure,
    sharedMemories,
    sharedMemory,
    tokenValidation,
} from './controllers/api-functions.mjs'
import {
    about,
    activateBot,
    alerts,
    bots,
    challenge,
    chat,
    collections,
    createBot,
    evaluate,
    feedback,
    greetings,
    help,
    index,
    item,
    logout,
    loginSelect,
    members,
    migrateBot,
    migrateChat,
    obscure,
    passphraseReset,
    privacyPolicy,
    retireBot,
    retireChat,
    routine,
    shadows,
    signup,
    summarize,
    team,
    teams,
    updateBotInstructions,
    upload,
} from './controllers/functions.mjs'
import {
    acceptShareWarnings,
    collectMemory,
    deleteShare,
    endMemory,
    getShare,
    getShares,
    improveMemory,
    reliveMemory,
    shareCreate,
    shareDelete,
    shareMemory,
    shareFeedback,
    shareHeader,
    shareStop,
    shareUpdate,
    validateShare,
} from './controllers/memory-functions.mjs'
import {
    mcpCall,
    mSessionInfo,
    mcpStream,
    mcpSystemInfo,
} from './controllers/mcp-functions.mjs'
import {
    server,
    serverRatings,
    servers,
} from './controllers/nanda-functions.mjs'
import {
    mission,
    missionPlay,
    missions,
    missionsAvailable,
} from './controllers/testing-functions.mjs'
/* module constants */
const _Router = new Router()
const _memberRouter = new Router()
const _apiRouter = new Router()
const _mcpMemberRouter = new Router()
const _mcpSystemRouter = new Router()
const _nandaRouter = new Router()
const mClientEntities = JSON.parse(process.env.OPENAI_JWT_SECRETS)
//	root routes
_Router.get('/', index)
_Router.get('/about', about)
_Router.get('/alerts', alerts)
_Router.get('/alphadog/mission', mission)
_Router.get('/alphadog/mission/:mid', mission)
_Router.get('/alphadog/missions', missions)
_Router.get('/alphadog/missions/available', missionsAvailable)
_Router.get('/logout', logout)
_Router.get('/experiences', availableExperiences)
_Router.get('/greeting', greetings)
_Router.get('/greetings', greetings)
_Router.get('/share/header/:sid', shareHeader)
_Router.get('/share/stop/:sid', shareStop)
_Router.get('/share/:sid', validateShare) // last to not interfere with previous
_Router.get('/select', loginSelect)
_Router.get('/status', status)
_Router.get('/privacy-policy', privacyPolicy)
_Router.get('/routine', routine)
_Router.get('/routine/:rid', routine)
_Router.get('/shadows', shadows)
_Router.get('/signup', status_signup)
_Router.patch('/share/accept/:sid', acceptShareWarnings)
_Router.patch('/share/:sid', shareMemory) // last to not interfere with previous
_Router.post('/', chat)
_Router.post('/alphadog/mission/:mid', missionPlay)
_Router.post('/challenge/:mid', challenge)
_Router.post('/help', help)
_Router.post('/share/feedback/:sid', shareFeedback)
_Router.post('/signup', signup)
/* api webhook routes */
_apiRouter.use(tokenValidation)
_apiRouter.get('/alerts', alerts)
_apiRouter.get('/alerts/:aid', alerts)
_apiRouter.get('/experiences/:mid', experiences) // **note**: currently triggers autoplay experience
_apiRouter.get('/experiencesLived/:mid', experiencesLived)
_apiRouter.get('/logout', apiLogout)
_apiRouter.get('/memories', sharedMemories)
_apiRouter.get('/memories/memory', sharedMemory)
_apiRouter.get('/memories/memory/:sid', sharedMemory)
_apiRouter.head('/keyValidation/:mid', keyValidation)
_apiRouter.patch('/experiences/:mid/experience/:xid/cast', experienceCast)
_apiRouter.patch('/experiences/:mid/experience/:xid/end', experienceEnd)
_apiRouter.patch('/experiences/:mid/experience/:xid/manifest', experienceManifest) // { cast, navigation, }
_apiRouter.patch('/experiences/:mid/experience/:xid/navigation', experienceNavigation)
_apiRouter.patch('/experiences/:mid/experience/:xid', experience) // **note**: This line should be the last one alphabetically due to the wildcard.
_apiRouter.post('/challenge/:mid', challenge)
_apiRouter.post('/entry/:mid', entry)
_apiRouter.post('/keyValidation/:mid', keyValidation)
_apiRouter.post('/memory/:mid', memory)
_apiRouter.post('/obscure/:mid', apiObscure)
_apiRouter.post('/upload', upload)
_apiRouter.post('/upload/:mid', upload)
/* mcp system-avatar routes */
_mcpSystemRouter.use(mcpProtocolValidation)
_mcpSystemRouter.get('/', mcpSystemInfo)
_mcpSystemRouter.get('/sse', mcpStream)
_mcpSystemRouter.get('/message/:sid', mSessionInfo)
_mcpSystemRouter.get('/messages/:sid', mSessionInfo)
_mcpSystemRouter.post('/message', mcpCall)
_mcpSystemRouter.post('/messages', mcpCall)
/* member routes */
_memberRouter.use(memberValidation)
_memberRouter.delete('/bots/:bid', bots)
_memberRouter.delete('/items/:iid', item)
_memberRouter.delete('/share/:sid', shareDelete)
_memberRouter.get('/', members)
_memberRouter.get('/bots', bots)
_memberRouter.get('/bots/:bid', bots)
_memberRouter.get('/collections', collections)
_memberRouter.get('/collections/:type', collections)
_memberRouter.get('/experiences', experiences)
_memberRouter.get('/experiencesLived', experiencesLived)
_memberRouter.get('/greeting', greetings)
_memberRouter.get('/greetings', greetings)
_memberRouter.get('/item/:iid', item)
_memberRouter.get('/share/:sid', getShare)
_memberRouter.get('/share/delete/:sid', deleteShare)
_memberRouter.get('/shares', getShares)
_memberRouter.get('/shares/:iid', getShares)
_memberRouter.get('/teams', teams)
_memberRouter.patch('/experience/:xid', experience)
_memberRouter.patch('/experience/:xid/end', experienceEnd)
_memberRouter.patch('/experience/:xid/manifest', experienceManifest)
_memberRouter.patch('/memory/relive/:iid', reliveMemory)
_memberRouter.patch('/memory/end/:iid', endMemory)
_memberRouter.patch('/share/:sid', shareUpdate)
_memberRouter.post('/', chat)
_memberRouter.post('/bots', bots)
_memberRouter.post('/bots/create', createBot)
_memberRouter.post('/bots/activate/:bid', activateBot)
_memberRouter.post('/evaluate/:iid', evaluate)
_memberRouter.post('/feedback', feedback)
_memberRouter.post('/feedback/:mid', feedback)
_memberRouter.post('/item', item)
_memberRouter.post('/migrate/bot/:bid', migrateBot)
_memberRouter.post('/migrate/chat/:bid', migrateChat)
_memberRouter.post('/obscure/:iid', obscure)
_memberRouter.post('/passphrase', passphraseReset)
_memberRouter.post('/retire/chat/:bid', retireChat)
_memberRouter.post('/share', shareCreate)
_memberRouter.post('/summarize', summarize)
_memberRouter.post('/teams/:tid', team)
_memberRouter.post('/upload', upload)
_memberRouter.put('/bots/:bid', bots)
_memberRouter.put('/bots/version/:bid', updateBotInstructions)
_memberRouter.put('/item/:iid', item)
/* mcp member-avatar routes */
_mcpMemberRouter.use(async (ctx, next)=>{
    ctx.state.requestType = 'member'
    await next()
})
_mcpMemberRouter.use(mcpProtocolValidation)
_mcpMemberRouter.get('/', mcpSystemInfo)
_mcpMemberRouter.get('/sse', mcpStream)
_mcpMemberRouter.get('/message/:sid', mSessionInfo)
_mcpMemberRouter.get('/messages/:sid', mSessionInfo)
_mcpMemberRouter.post('/message', mcpCall)
_mcpMemberRouter.post('/messages', mcpCall)
/* Nanda routes */
_nandaRouter.get('/mylife', server)
_nandaRouter.get('/servers/:sid', server)
_nandaRouter.get('/servers/:sid/ratings', serverRatings)
_nandaRouter.get('/servers', servers)
// Mount the subordinate routers along respective paths
_Router.use('/members', _memberRouter.routes(), _memberRouter.allowedMethods())
_Router.use('/api/v1', _apiRouter.routes(), _apiRouter.allowedMethods())
_Router.use('/api/v2/mcp/system-avatar', _mcpSystemRouter.routes(), _mcpSystemRouter.allowedMethods())
_Router.use('/api/v2/mcp/bot', _mcpMemberRouter.routes(), _mcpMemberRouter.allowedMethods())
_Router.use('/nanda', _nandaRouter.routes(), _nandaRouter.allowedMethods())
/* modular functions */
/**
 * Connects the routes to the router
 * @param {object} _Menu Menu object
 * @returns {object} Koa router object
 */
function connectRoutes(_Menu){
	return _Router
}
/**
 * Ensure member session is unlocked or return to select.
 * @param {object} ctx Koa context object
 * @param {function} next Koa next function
 * @returns {function} Koa next function
 */
async function memberValidation(ctx, next){
    const { locked=true, } = ctx.state
    ctx.state.dateNow = Date.now()
    const redirectUrl = `/`
    if(locked){
        const isAjax = ctx.get('X-Requested-With') === 'XMLHttpRequest' || ctx.is('json')
        if(isAjax){
            ctx.status = 401
            ctx.body = {
                alert: true,
                message: 'Your MyLife Member Session has timed out and is no longer valid. Please log in again.',
                redirectUrl
            }
        } else
            ctx.redirect(redirectUrl)
    } else
        await next() // Proceed to the next middleware if authorized
}
/**
 * Returns the member session logged in status
 * @param {object} ctx Koa context object
 * @returns {boolean} false if member session is locked, true if registered and unlocked
 */
function status(ctx){ //	currently returns reverse "locked" status, could send object with more info
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
 * Validates the MCP protocol request.
 * @param {Koa} ctx - Koa context object
 * @param {function} next - Koa next function
 */
async function mcpProtocolValidation(ctx, next){
    if(!ctx.state.requestType)
        ctx.state.requestType = 'system'
    // confirm bearer always
    // POST create stream and sessionMeta
    switch(ctx.request.method.toUpperCase()){
        case 'GET':
            const headerAuthorization = ctx.header.authorization?.split(' ')?.pop()
            const bypassAuth = true
            if(!bypassAuth && ctx.path.endsWith('/sse') && !mClientEntities?.[headerAuthorization])
                ctx.throw(401, 'Invalid or missing authorization token')
            break
        case 'POST':
            const { sessionId, } = ctx.request.query
            if(!sessionId)
                ctx.throw(401, 'Missing sessionId')
            ctx.state.sessionMeta = ctx.mcpSessionMeta.get(sessionId)
            const { sessionMeta, } = ctx.state
            if(!sessionMeta)
                ctx.throw(401, `Session Unauthorized; sessionId=${ sessionId }`)
            const { sessionIdKoa, transportEntry, } = sessionMeta
            if(!transportEntry)
                ctx.throw(401, 'Unknown session; cannot communicate with MCP')
            if(!sessionIdKoa?.length)
                ctx.throw(401, 'Unknown session; cannot communicate with Koa')
            /* validate Koa session */
            const prefix = 'koa:sess:'
            const existingKoaSession = await ctx.MemoryStore.get(prefix+sessionIdKoa)
            if(!existingKoaSession)
                ctx.throw(401, 'Unknown session; cannot find existing Koa session')
            ctx.session = existingKoaSession
			await ctx.MemoryStore.destroy(prefix+ctx.sessionId) // destroy temporary blank session created by Koa
            // Koa server will have mis-assigned ctx.state
            ctx.state.avatar = ctx.session.avatar
            ctx.state.locked = ctx.session.locked
            ctx.state.mcp = ctx.request.body
            break
        default:
            break
    }
    await next()
}
/* exports */
export default function init(_Menu) {
	connectRoutes(_Menu)
	return _Router
}