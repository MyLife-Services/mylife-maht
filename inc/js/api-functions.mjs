import chalk from "chalk"
/* variables */
const mBotSecrets = JSON.parse(process.env.OPENAI_JWT_SECRETS)
/* public modular functions */
// @todo implement builder functionality, allowing for interface creation of experiences by members
// @todo implement access to exposed member experiences using `mbr_key` as parameter to `factory.getItem()`
async function experienceBuilder(ctx){
    mAPIKeyValidation(ctx)
    const { assistantType, mbr_id } = ctx.state
    const { eid, sid } = ctx.params
    const { experience } = ctx.request.body?.experience
    console.log(chalk.yellowBright('experienceBuilder()'), { assistantType, mbr_id, eid, sid, experience })
    if(!experience)
        ctx.throw(400, 'No experience provided for builder. Use `experience` field.')
}
/**
 * Returns cast of an experience. Cast is the array of characters and other entities that are part of the experience.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Object[]} - Array of Cast Objects.
 * @property {array} cast - Experience cast array.
 * @property {object} navigation - Navigation object (optional - for interactive display purposes only).
 */
function experienceCast(ctx){
    mAPIKeyValidation(ctx)
    const { assistantType, avatar, mbr_id } = ctx.state
    const { eid } = ctx.params
    ctx.body = avatar.cast
    return
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
    /* reject if experience is locked */
    /* lock could extend to gating requests as well */
    if(ctx.state.MemberSession.experienceLock){
        // @stub - if experience is locked, perhaps request to run an internal check to see if exp is bugged or timed out
        ctx.throw(500, 'Experience is locked. Wait for previous event to complete. If bugged, end experience and begin again.')
    }
    mAPIKeyValidation(ctx)
    const { assistantType, avatar, mbr_id, } = ctx.state
    const { eid, } = ctx.params
    let events = []
    ctx.state.MemberSession.experienceLock = true
    try{ // requires try, as locks would otherwise not release on unidentified errors
        if(!avatar.isInExperience){
            await avatar.experienceStart(eid)
        }
        else {
            const eventSequence = await avatar.experiencePlay(eid, ctx.request.body)
            events = eventSequence
            console.log(chalk.yellowBright('experience() events'), events?.length)
        } 
    } catch (error){
        console.log(chalk.redBright('experience() error'), error, avatar.experience)
        const { experience } = avatar
        if(experience){ // embed error in experience
            experience.errors = experience.errors ?? []
            experience.errors.push(error)
        }
    }
    const { experience } = avatar
    const { autoplay, location, title, } = experience
    ctx.body = {
        autoplay,
        events,
        location,
        title,
    }
    ctx.state.MemberSession.experienceLock = false
    if(events.find(event=>{ return event.action==='end' && event.type==='experience' })){
        if(!avatar.experienceEnd(eid)) // attempt to end experience
            throw new Error('Experience failed to end.')
    }
    return
}
/**
 * Request to end an active Living-Experience for member.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Object} - Represents `ctx.body` object with following `experience` properties.
 * @property {boolean} success - Success status, true/false.
 */
function experienceEnd(ctx){
    mAPIKeyValidation(ctx)
    const { assistantType, avatar, mbr_id } = ctx.state
    const { eid } = ctx.params
    let endSuccess = false
    try {
        endSuccess = avatar.experienceEnd(eid)
    } catch(err) {
        console.log(chalk.redBright('experienceEnd() error'), err)
        // can determine if error is critical or not, currently implies there is no running experience
        endSuccess = true
    }
    ctx.body = endSuccess
    ctx.state.MemberSession.experienceLock = !ctx.body
    return
}
/**
 * Delivers the manifest of an experience. Manifests are the data structures that define the experience, including scenes, events, and other data. Experience must be "started" in order to request.
 * @todo - if scripts should require skipping to _otherwise_ "invisible" scenes/events, then disclaimer should register front-end navigation required, for now, demand by consent agreement to provide mechanics for accessibility.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Object} - Represents `ctx.body` object with following `manifest` properties.
 * @property {Array} cast - Experience cast array.
 * @property {Object} navigation - Navigation object (optional - for interactive display purposes only).
 */
function experienceManifest(ctx){
    mAPIKeyValidation(ctx)
    const { assistantType, avatar, mbr_id } = ctx.state
    ctx.body = avatar.manifest
    return
}
/**
 * Navigation array of scenes for experience.
 */
function experienceNavigation(ctx){
    mAPIKeyValidation(ctx)
    const { assistantType, avatar, mbr_id } = ctx.state
    ctx.body = avatar.navigation
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
    mAPIKeyValidation(ctx)
    const { assistantType, MemberSession } = ctx.state
    // limit one mandatory experience (others could be highlighted in alerts) per session
    const experiencesObject = await MemberSession.experiences()
    ctx.body = experiencesObject
    return
}
async function keyValidation(ctx){ // from openAI
    mAPIKeyValidation(ctx)
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
    mAPIKeyValidation(ctx)
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
	if(!ctx.params.mid?.length)
        ctx.throw(400, `missing member id`) // currently only accepts single contributions via post with :cid
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
    mAPIKeyValidation(ctx) // sets ctx.state.mbr_id and more
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
        if(!mTokenValidation(_token)){
            ctx.status = 401
            ctx.body = { error: 'Authorization token failure' }
            return
        }
        ctx.state.token = _token // **note:** keep first, as it is used in mTokenType()
        ctx.state.assistantType = mTokenType(ctx)
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
/* "private" modular functions */
/**
 * Validates key and sets `ctx.state` and `ctx.session` properties. `ctx.state`: [ assistantType, isValidated, mbr_id, ]. `ctx.session`: [ isAPIValidated, APIMemberKey, ].
 * @modular
 * @private
 * @param {Koa} ctx - Koa Context object.
 * @returns {void}
 */
function mAPIKeyValidation(ctx){ // transforms ctx.state
    if(!ctx.state.locked) return
    if(ctx.params.mid === ':mid') ctx.params.mid = undefined
    // ctx session alternatives to hitting DB every time? can try...
    const mbr_id = ctx.params.mid??ctx.request.body.memberKey
    if(!mbr_id?.length)
        ctx.throw(400, 'Missing member key.')
    const serverHostedMembers = JSON.parse(process.env.MYLIFE_HOSTED_MBR_ID??'[]')
    const localHostedMembers = [
        'system-one|4e6e2f26-174b-43e4-851f-7cf9cdf056df',
    ].filter(member=>serverHostedMembers.includes(member)) // none currently
    serverHostedMembers.push(...localHostedMembers)
    /* inline function definitions */
    function _keyValidation(ctx, mbr_id){ // returns Promise<boolean>
        return new Promise(async (resolve, reject) => {
            if( // session validation
                    (ctx.session?.isAPIValidated ?? false)
                && mbr_id === (ctx.session?.APIMemberKey ?? false)
            ){
                resolve(true)
            }
            if(serverHostedMembers.includes(mbr_id)){ // initial full validation
                resolve( await ctx.MyLife.testPartitionKey(mbr_id) )
            }
            resolve(false)
        })
    }
    _keyValidation(ctx, mbr_id)
        .then(isValidated=>{
            if(!isValidated)
                ctx.throw(400, 'Member Key unknown', error)
            ctx.state.isValidated = isValidated
            ctx.state.mbr_id = mbr_id
            ctx.state.assistantType = mTokenType(ctx)
            ctx.session.isAPIValidated = ctx.state.isValidated
            ctx.session.APIMemberKey = ctx.state.mbr_id
        })
        .catch(error=>{
            ctx.throw(500, 'API Key Validation Error', error)
        })
}
function mTokenType(ctx){
    const _token = ctx.state.token
    const _assistantType = mBotSecrets?.[_token]??'personal-avatar'
    return _assistantType
}
function mTokenValidation(_token){
    return mBotSecrets?.[_token]?.length??false
}
/* exports */
export {
    experience,
    experienceCast,
    experienceEnd,
    experienceManifest,
    experienceNavigation,
    experiences,
    keyValidation,
    library,
    login,
    register,
    story,
    storyLibrary,
    tokenValidation,
}