import chalk from "chalk"
/* variables */
const mBotSecrets = JSON.parse(process.env.OPENAI_JWT_SECRETS)
/* private modular functions */
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
	if (!humanName?.length || !email?.length){
        ctx.status = 400 // Bad Request
        ctx.body = {
            success: false,
            message: 'Missing required contact information: humanName and/or email are required.',
        }
        return
    }
	// Email validation
    if (!ctx.Globals.isValidEmail(contact.email)) {
        ctx.status = 400 // Bad Request
        ctx.body = {
            success: false,
            message: 'Invalid email format.',
        }
        return
    }
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
    if(!storySummary?.length){
        ctx.status = 400 // Bad Request
        ctx.body = {
            success: false,
            message: 'No story summary provided. Use `storySummary` field.',
        }
        return
    }
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
    keyValidation,
    library,
    register,
    story,
    storyLibrary,
    tokenValidation,
}