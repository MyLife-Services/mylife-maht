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
async function oAuthCallback(ctx){
    const { sessionMeta, } = ctx.state
    const { provider, } = ctx.params
    const { code, } = ctx.query
    console.log(chalk.blue('oAuth Callback'), provider, code)
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
    console.log(chalk.green('Google Member:'), member)
    // Upsert or lookup member in DB by email or sub (user.id)
    // Set session (Koa or MCP sessionMeta) to "logged in" as this member
    ctx.session.member = { email: member.email, id: member.sub, ...member }
    ctx.redirect('/members') // member dashboard
}
/* exports */
export {
    oAuth,
    oAuthCallback,
}
