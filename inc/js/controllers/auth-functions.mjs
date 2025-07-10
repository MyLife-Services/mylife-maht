import chalk from "chalk"
/* variables */
const mOAuthValidations = {
    github: {},
    google: {
        access_type: 'offline',
        authUri: ( process.env.GOOGLE_AUTH_URI ?? 'https://accounts.google.com/o/oauth2/auth' ),
        client_id: process.env.GOOGLE_CLIENT_ID,
        prompt: 'consent',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
    },
}
/* public module functions */
/**
 * Challenge the member session with a passphrase.
 * @public
 * @async
 * @param {Koa} ctx - Koa Context object
 * @param {string} memberId - The member id to challenge (optional, allows for external access)
 * @param {string} memberPassphrase - The passphrase to challenge with (optional, allows for external access)
 * @returns {boolean} - Whether or not challenge was successful
 */
async function challenge(ctx, memberId, memberPassphrase){
	const { passphrase=memberPassphrase, } = ctx.request.body
	if(!passphrase?.length)
		ctx.throw(400, `challenge request requires passphrase`)
	const { mid=memberId, } = ctx.params
	if(!mid?.length)
		ctx.throw(400, `challenge request requires member id`)
	if(!ctx.state.locked)
		return true
	const { avatar: Avatar, } = ctx.state
	const challengeSuccessful = await Avatar.challengeAccess(mid, passphrase)
	if(challengeSuccessful)
        await mSetSession(ctx, mid)
	ctx.body = !ctx.session.locked
}
/**
 * Logout the member from the system.
 * @param {Koa} ctx - Koa Context object
 * @returns {void} - Redirects to the home page
 */
async function logout(ctx){
	const { avatar: Avatar, } = ctx.state
	if(Avatar?.isMyLife ?? true)
		ctx.throw(400, `cannot logout from system avatar`)
	await Avatar.logout(ctx)
	ctx.redirect('/')
}
/**
 * Returns a member list for selection.
 * @todo: should obscure and hash ids in session.mjs
 * @todo: set and read long-cookies for seamless login
 * @param {Koa} ctx - Koa Context object
 * @returns {Object[]} - List of hosted members available for login.
 */
async function loginSelect(ctx){
	const { avatar, } = ctx.state
	ctx.body = await avatar.hostedMembers(process.env.MYLIFE_HOSTING_KEY)
}
/**
 * Returns all publicly-available experiences.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Object[]} - Array of Experience Objects.
 */
async function oAuth(ctx){
    let { provider, } = ctx.params
    provider = mOAuthValidations[provider.toLowerCase()]
    if(!provider)
        ctx.throw(404, chalk.red(`OAuth provider "${ provider }" not allowed.`))
    ctx.session.oAuth = provider
    const { authUri, ..._provider } = provider
    const params = new URLSearchParams(_provider).toString(),
        uri = authUri + '?' + params
    ctx.redirect(uri)
}
/**
 * Handles the OAuth callback from the provider and logs in the member. Redirects to the member dashboard after successful login.
 * @param {Koa} ctx - Koa Context object
 * @returns {void} - Redirects
 */
async function oAuthCallback(ctx){
    const { avatar: Avatar, sessionMeta, } = ctx.state
    const { provider, } = ctx.params
    const { code, } = ctx.query
    if(provider.toLowerCase() !== 'google')
        ctx.throw(404, chalk.red(`OAuth provider "${ provider }" not currently allowed`))
    const tokenRequest = await fetch('https://oauth2.googleapis.com/token', { // Exchange code for token
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code'
        })
    })
    const token = await tokenRequest.json()
    const memberRequest = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${ token.access_token }` }
    })
    const member = await memberRequest.json()
    if(!member?.email || !member?.sub)
        ctx.throw(400, chalk.red('Invalid member data from OAuth provider'))
    if(!( member?.email_verified ?? false ))
        ctx.throw(400, chalk.red('Member email not verified by OAuth provider'))
    const mbr_id = await Avatar.memberLookup(provider, member.email, member.sub)
    if(!mbr_id)
        ctx.throw(404, chalk.red(`Member not found for email: ${ member.email }`))
    const loggedIn = await mSetSession(ctx, mbr_id)
    ctx.redirect('/members') // member dashboard
}
/* private module functions */
/**
 * Sets the session for a member.
 * @param {Koa} ctx - Koa Context object
 * @param {string} memberId - The member id to set in the session
 * @returns {Promise<boolean>} - Whether the session was set successfully
 */
async function mSetSession(ctx, memberId){
    try{
        const { avatar: Avatar, } = ctx.state
        if(!Avatar?.isMyLife ?? true)
            return false
        const { Conversation, } = ctx.session
        ctx.session.locked = false
        ctx.session.avatar = await Avatar.mylifeMember(memberId)
        ctx.state.avatar = ctx.session.avatar
        if(Conversation)
            await Avatar.deleteChat(Conversation)
        return true
    } catch (err) {
        console.error(chalk.red('mSetSession()::error'), err)
        console.log(chalk.yellow(`mSetSession()::memberId: ${ memberId }`))
        return false
    }
}
/* exports */
export {
    challenge,
    logout,
    loginSelect,
    oAuth,
    oAuthCallback,
}
