/**
 * Session manager for MyLife synthetic testing harness.
 * Handles authentication and cookie persistence across scores.
 * All scores share this session — one synthetic account, one active session.
 */
const BASE_URL = process.env.MYLIFE_BASE_URL ?? 'https://mylife.ngrok.app'
const MBR_ID = process.env.SYNTHETIC_MBR_ID ?? 'ember|95ade320-e0f7-4cef-a001-9324edcb6e71'
const PASSPHRASE = process.env.SYNTHETIC_PASSPHRASE ?? 'ember lights the way forward'
/* shared state — scores deposit what they learn here for downstream use */
export const context = {
    conversationLog: [], /* semantic exchange log: { score, role, message, timestamp, ...meta } */
    apiLog: [],          /* raw HTTP log: every request() call, full payload in + out */
}
/* cookie jar — single string, updated on every set-cookie response */
let cookie = ''
/**
 * Authenticated fetch wrapper. All score movements use this, never raw fetch.
 * Automatically logs every request/response pair to context.apiLog.
 * Credentials (passphrase) are redacted in the log.
 * @param {string} path - Path relative to BASE_URL
 * @param {object} options - fetch options
 * @returns {Promise<object>} - Parsed JSON response body
 */
export async function request(path, options={}){
    const url = `${ BASE_URL }${ path }`
    const method = (options.method ?? 'GET').toUpperCase()
    const headers = {
        'Content-Type': 'application/json',
        ...( cookie ? { Cookie: cookie } : {} ),
        ...options.headers,
    }
    /* parse request body for logging — redact passphrase */
    let requestBody
    if(options.body){
        try {
            requestBody = JSON.parse(options.body)
            if(requestBody?.passphrase)
                requestBody = { ...requestBody, passphrase: '[redacted]' }
        } catch {
            requestBody = '[unparseable]'
        }
    }
    const sentAt = new Date().toISOString()
    const response = await fetch(url, { ...options, headers })
    const { status, } = response
    const setCookies = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter(Boolean)
    if(setCookies.length)
        cookie = setCookies.map(c=>c.split(';')[0]).join('; ')
    const text = await response.text()
    let parsed
    try {
        parsed = JSON.parse(text)
    } catch {
        parsed = text
    }
    context.apiLog.push({
        sentAt,
        receivedAt: new Date().toISOString(),
        method,
        path,
        status,
        request: requestBody,
        response: parsed,
    })
    return parsed
}
/**
 * Establishes authenticated session for the synthetic account.
 * Must be called before any member-scoped score movements.
 * @returns {Promise<boolean>}
 */
export async function authenticate(){
    const encodedId = encodeURIComponent(MBR_ID)
    const result = await request(`/challenge/${ encodedId }`, {
        method: 'POST',
        body: JSON.stringify({ passphrase: PASSPHRASE }),
    })
    if(result !== true)
        throw new Error(`Authentication failed: ${ JSON.stringify(result) }`)
    return true
}
/**
 * Records one conversational turn into the semantic conversation log.
 * Complements apiLog (raw) with human-readable exchange context.
 * @param {string} score - Score identifier, e.g. '03'
 * @param {'synthetic'|'biographer'|'avatar'|'system'} role - Who is speaking
 * @param {string} message - The message text (stripped of HTML)
 * @param {object} meta - Optional metadata: { exchange, movement, instructions, note }
 */
export function logTurn(score, role, message, meta={}){
    context.conversationLog.push({
        score,
        role,
        message,
        timestamp: new Date().toISOString(),
        ...meta,
    })
}
