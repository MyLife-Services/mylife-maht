import chalk from "chalk"
/* variables */
const mBotSecrets = JSON.parse(process.env.OPENAI_JWT_SECRETS)
/* private modular functions */
// @todo implement builder functionality, allowing for interface creation of experiences by members
// @todo implement access to exposed member experiences using `mbr_key` as parameter to `factory.getItem()`
async function experienceBuilder(ctx){
    await _keyValidation(ctx)
    const { assistantType, mbr_id } = ctx.state
    const { eid, sid } = ctx.params
    const { experience } = ctx.request.body?.experience
    console.log(chalk.yellowBright('experienceBuilder()'), { assistantType, mbr_id, eid, sid, experience })
    if(!experience)
        ctx.throw(400, 'No experience provided for builder. Use `experience` field.')
}
/**
 * Conducts active Living-Experience for member. Passes data to avatar to manages the start, execution and completion of a member experience. Note: ctx.request.body is free JSON in order to tolerate a number of success/failure conditions.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Promise<object>} - Promise object represents object with following properties.
 * @property {boolean} success - Success status.
 * @property {array} events - Array of next Event(s).
 * @property {object} scene - Scene data, regardless if "current" or new.
 */
async function experience(ctx){
    // if needs to send update OTHER than member input ctx.request.body.memberInput
    await _keyValidation(ctx)
    const { assistantType, avatar, mbr_id } = ctx.state
    const { eid, sid, vid } = ctx.params
    if(ctx.state.MemberSession.experienceLock)
        ctx.throw(500, 'Experience is locked. Wait for previous event to complete. If bugged, end experience and begin again.')
    ctx.state.MemberSession.experienceLock = true
    const events = await avatar.experienceUpdate(eid, sid, vid, ctx.request.body)
    ctx.state.MemberSession.experienceLock = false
    ctx.body = events
    return
}
/**
 * Request to end an active Living-Experience for member.
 * @param {Koa} ctx - Koa Context object.
 * @returns 
 */
async function experienceEnd(ctx){
    await _keyValidation(ctx)
    const { assistantType, avatar, mbr_id } = ctx.state
    const { eid } = ctx.params
    ctx.body = avatar.experienceEnd(eid)
    return
}
/**
 * Delivers the manifest of an experience. Manifests are the data structures that define the experience, including scenes, events, and other data. Experience must be "started" in order to request.
 * @param {Koa} ctx - Koa Context object.
 * @returns 
 */
async function experienceManifest(ctx){
    await _keyValidation(ctx)
    const { assistantType, avatar, mbr_id } = ctx.state
    const { eid } = ctx.params
    const { manifest } = ctx.request.body
    console.log(chalk.yellowBright('experienceManifest()'), { assistantType, mbr_id, eid, manifest })
    ctx.body = avatar.experienceManifest(eid, manifest)
    return
}
/**
 * Returns experiences relevant to member. If first request of session, will return mandatory system experience, if exists **and begin executing it**! On subsequent requests, just returns experiences.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Promise<object>} - Promise object represents `ctx.body` object with following properties.
 * @property {string<Guid>} autoplay - Autoplay Experience with this id.
 * @property {array} experiences - Array of Experience shorthand objects.
 */
async function experiences(ctx){
    await _keyValidation(ctx)
    const { assistantType, MemberSession } = ctx.state
    // limit one mandatory experience (others could be highlighted in alerts) per session
    const experiencesObject = await MemberSession.experiences()
    ctx.body = experiencesObject
    return
}
/**
 * Validates key and sets `ctx.state` and `ctx.session` properties.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Promise<void>} - Promise object represents void.
 * @property {string} ctx.state.mbr_id - Member ID
 */
async function _keyValidation(ctx){ // transforms ctx.state
    if(ctx.params.mid === ':mid') ctx.params.mid = undefined
    // ctx session alternatives to hitting DB every time? can try...
    const _mbr_id = ctx.params.mid??ctx.request.body.memberKey
    const _validated =
        ( // session validation shorthand
                ( ctx.session?.isAPIValidated??false )
            && _mbr_id?.length
            && ( _mbr_id===ctx.session?.APIMemberKey??false )
        ) || ( // initial full validation
            (_mbr_id?.length)
            &&  process.env.MYLIFE_HOSTED_MBR_ID.includes(_mbr_id)
            &&  await ctx.MyLife.testPartitionKey(_mbr_id)
        )
    ctx.state.mbr_id = _mbr_id
    ctx.state.assistantType = _tokenType(ctx)
    ctx.state.isValidated = _validated
    ctx.session.isAPIValidated = ctx.state.isValidated
    ctx.session.APIMemberKey = ctx.state.mbr_id
}
function _tokenType(ctx){
    const _token = ctx.state.token
    const _assistantType = mBotSecrets?.[_token]??'personal-avatar'
    return _assistantType
}
function _tokenValidation(_token){
    return mBotSecrets?.[_token]?.length??false
}
/* public modular functions */
async function keyValidation(ctx){
    await _keyValidation(ctx)
    if(!ctx.state.isValidated){
        ctx.status = 400 // Bad Request
        ctx.body = {
            success: false,
            message: 'Invalid member.',
        }
        return
    }
    ctx.status = 200 // OK
    if(ctx.method === 'HEAD') return
    // @todo: determine how to instantiate avatar via Maht Factory--session? In any case, perhaps relegate to session
    const _memberCore = await ctx.MyLife.datacore(ctx.state.mbr_id)
    const { updates, interests, birth, birthDate, fullName, names, nickname } = _memberCore
    const _birth = (Array.isArray(birth) && birth.length)
        ? birth[0]
        : birth??{}
    _birth.date = birthDate??_birth.date??''
    _birth.place = _birth.place??''
    const _memberCoreData = {
        mbr_id: ctx.state.mbr_id,
        updates: updates??'',
        interests: interests??'',
        birthDate: _birth.date,
        birthPlace: _birth.place,
        fullName: fullName??names?.[0]??'',
        preferredName: nickname??names?.[0].split(' ')[0]??'',
    }
    ctx.body = {
        success: true,
        message: 'Valid member.',
        data: _memberCoreData,
    }
    console.log(chalk.yellowBright(`keyValidation():${_memberCoreData.mbr_id}`), _memberCoreData.fullName)
    return
}
/**
 * All functionality related to a library. Note: Had to be consolidated, as openai GPT would only POST.
 * @modular
 * @public
 * @param {Koa} ctx - Koa Context object
 * @returns {Koa} Koa Context object
 */
async function library(ctx){
    await _keyValidation(ctx) // sets ctx.state.mbr_id and more
    const {
        assistantType,
        mbr_id,
        library = ctx.request?.body?.library
            ?? ctx.request?.body
            ?? {}
    } = ctx.state
    const _library = await ctx.MyLife.library(mbr_id, assistantType, library)
    ctx.status = 200 // OK
    ctx.body = {
        library: _library,
        message: `library function(s) completed successfully.`,
        success: true,
    }
    return
}
/**
 * Login function for member. Requires mid in params.
 * @modular
 * @public
 * @param {Koa} ctx - Koa Context object
 * @returns {Koa} Koa Context object
 * @property {string} ctx.body.challengeId
 */
async function login(ctx){
	if(!ctx.params.mid?.length) ctx.throw(400, `missing member id`) // currently only accepts single contributions via post with :cid
	ctx.session.MemberSession.challenge_id = decodeURIComponent(ctx.params.mid)
    ctx.body = { challengeId: ctx.session.MemberSession.challenge_id }
    return
}
async function register(ctx){
	const _registrationData = ctx.request.body
	const {
		registrationInterests,
		contact={}, // as to not elicit error destructuring
		personalInterests,
		additionalInfo
	} = _registrationData
	const {
		avatarName,
		humanName,
		humanDateOfBirth,
		email,
		city,
		state,
		country,
	} = contact
	if (!humanName?.length || !email?.length)
        ctx.throw(400, 'Missing required contact information: humanName and/or email are required.')
	// Email validation
    if (!ctx.Globals.isValidEmail(contact.email))
        ctx.throw(400, 'Invalid email format.')
	// throttle requests?
	// write to cosmos db
	_registrationData.email = email // required at root for select
	const _ = ctx.MyLife.registerCandidate(_registrationData)
	const { mbr_id, ..._return } = _registrationData // abstract out the mbr_id
	ctx.status = 200
    ctx.body = {
        success: true,
        message: 'Registration completed successfully.',
		data: _return,
    }
	return
}
/**
 * Functionality around story contributions.
 * @param {Koa} ctx - Koa Context object
 * @returns {Koa} Koa Context object
 */
async function story(ctx){
    await _keyValidation(ctx) // sets ctx.state.mbr_id and more
    const { assistantType, mbr_id } = ctx.state
    const { storySummary } = ctx.request?.body??{}
    if(!storySummary?.length)
        ctx.throw(400, 'No story summary provided. Use `storySummary` field.')
    // write to cosmos db
    const _story = await ctx.MyLife.story(mbr_id, assistantType, storySummary) // @todo: remove await
    console.log(chalk.yellowBright('story submitted:'), _story)
    ctx.status = 200 // OK
    ctx.body = {
        success: true,
        message: 'Story submitted successfully.',
    }
    return
}
/**
 * Management of Member Story Libraries. Note: Key validation is performed in library(). Story library may have additional functionality inside of core/MyLife
 * @param {Koa} ctx - Koa Context object
 * @returns {Koa} Koa Context object. Body = { data: library, success: boolean, message: string }
 */
async function storyLibrary(ctx){
    const { id, form='biographer' } = ctx.request?.body??{}
    const type = 'story' // force constant
    ctx.state.library = {
        id,
        type,
        form,
    }
    const _library = await library(ctx) // returns ctx.body
}
/**
 * Validates api token
 * @modular
 * @public
 * @param {object} ctx Koa context object
 * @param {function} next Koa next function
 * @returns {function} Koa next function
 */
async function tokenValidation(ctx, next) {
    try {
        const authHeader = ctx.request.headers['authorization']
        if(!authHeader){
            ctx.status = 401
            ctx.body = { error: 'Authorization header is missing' }
            return
        }
        const _token = authHeader.split(' ')[1] // Bearer TOKEN_VALUE
        if(!_tokenValidation(_token)){
            ctx.status = 401
            ctx.body = { error: 'Authorization token failure' }
            return
        }
        ctx.state.token = _token // **note:** keep first, as it is used in _tokenType()
        ctx.state.assistantType = _tokenType(ctx)
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
/* exports */
export {
    experience,
    experienceEnd,
    experienceManifest,
    experiences,
    keyValidation,
    library,
    login,
    register,
    story,
    storyLibrary,
    tokenValidation,
}