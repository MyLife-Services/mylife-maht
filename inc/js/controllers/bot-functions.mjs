/**
 * Activate a specific Bot.
 * @public
 * @async
 * @param {object} ctx - Koa Context object
 * @returns {object} - Activated Response object: { id, greeting, success, version, versionUpdate, }
 */
async function activateBot(ctx){
	const { bid, } = ctx.params
	if(!ctx.Globals.isValidGuid(bid))
		ctx.throw(400, `missing bot id`)
	const { avatar: Avatar, } = ctx.state
	ctx.body =await Avatar.setActiveBot(bid)
}
/**
 * Persists the last active item id for the member session. Called fire-and-forget from frontend.
 * @param {Koa} ctx - Koa Context object
 * @returns {boolean} - `true` if the item was persisted
 */
async function activateItem(ctx){
	const { iid, } = ctx.params
	if(!ctx.Globals.isValidGuid(iid))
		ctx.throw(400, `valid item id required`)
	const { avatar: Avatar, } = ctx.state
	ctx.body = await Avatar.setActiveItem(iid)
}
/**
 * Get a specified bot by id for the member.
 * @param {Koa} ctx - Koa context object
 * @returns {object} - Bot object corresponding to the provided bot id
 */
async function bot(ctx){
	const { bid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	ctx.body = await Avatar.getBot(bid)
}
/**
 * Manage bots for the member.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - Koa Context object
 */
async function bots(ctx){
	const { bid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	const bot = ctx.request.body
		?? {}
	switch(ctx.method){
		case 'DELETE': // retire bot
			if(!ctx.Globals.isValidGuid(bid))
				ctx.throw(400, `missing bot id`)
			ctx.body = await Avatar.retireBot(bid)
			break
		case 'POST': // create new bot
			ctx.body = await Avatar.createBot(bot)
			break
		case 'PUT': // update bot
			ctx.body = await Avatar.updateBot(bot)
			break
		case 'GET':
		default:
			if(bid?.length){ // specific bot
				ctx.body = await Avatar.getBot(bid)
				return
			}
			const bots = await Avatar.getBots()
			let { activeBotId, greeting, } = Avatar
			if(!activeBotId){
				const { id, greeting: activeGreeting } = await Avatar.setActiveBot()
				activeBotId = id
				greeting = activeGreeting
			}
			ctx.body = {
				activeBotId,
				bots,
				greeting,
			}
			break
	}
}
/**
 * Retrieves buttons for a specified bot.
 * @param {Koa} ctx - Koa Context object
 * @returns {Object[]} - Array of bot button objects: { endpoint, id, label, order, type, value, }
 */
async function botButtons(ctx){
    const { bid, } = ctx.params
    if(!ctx.Globals.isValidGuid(bid))
        ctx.throw(400, `missing bot id`)
    const { avatar: Avatar, } = ctx.state
    const response = await Avatar.botButtons(bid)
    ctx.body = response
}
/**
 * Retrieves options for a specified bot.
 * @param {Koa} ctx - Koa Context object
 * @returns {Object[]} - Array of bot option objects: { endpoint, id, label, options, order, placeholder, title, type, variable, }
 */
async function botOptions(ctx){
    const { bid, } = ctx.params
    if(!ctx.Globals.isValidGuid(bid))
        ctx.throw(400, `missing bot id`)
    const { avatar: Avatar, } = ctx.state
    const response = await Avatar.botOptions(bid)
    ctx.body = response
}
/**
 * Chat with the Member or System Avatar's intelligence.
 * @public
 * @async
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - The response from the chat in `ctx.body`
 * @property {object} instruction - Instructionset for the frontend to execute (optional)
 * @property {Object[]} responses - Response messages from Avatar intelligence
 */
async function chat(ctx){
	const { botId, itemId, message, } = ctx.request.body
		?? {} /* body nodes sent by fe */
	if(!message?.length)
			ctx.throw(400, 'missing `message` content')
	const { avatar: Avatar, } = ctx.state
	if(botId?.length && botId!==Avatar.activeBotId)
		throw new Error(`Bot ${ botId } not currently active; chat() requires active bot`)
	const response = await Avatar.chat(message, itemId, ctx.session)
	ctx.body = response
}
/**
 * Creates a new bot for the member.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - Created bot object
 */
async function createBot(ctx){
	const { teamId, type, } = ctx.request.body
	const { avatar, } = ctx.state
	const bot = { teams: [], type, } // `type` only requirement to create a known, MyLife-typed bot
	if(teamId?.length)
		bot.teams.push(teamId)
	ctx.body = await avatar.createBot(bot)
}
/**
 * Migrates a bot to a new configuration or environment.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - Migration result object
 */
async function migrateBot(ctx){
	const { bid, } = ctx.params
	const { avatar, } = ctx.state
	ctx.body = await avatar.migrateBot(bid)
}
/**
 * Migrates a chat to a new configuration or environment.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - Migration result object
 */
async function migrateChat(ctx){
	const { bid, } = ctx.params
	const { avatar, } = ctx.state
	ctx.body = await avatar.migrateChat(bid)
}
/**
 * Direct request from member to retire a bot.
 * @param {Koa} ctx - Koa Context object
 */
async function retireBot(ctx){
	ctx.method = 'DELETE'
	return await bots(ctx)
}
/**
 * Direct request from member to retire a chat (via bot).
 * @param {Koa} ctx - Koa Context object
 */
async function retireChat(ctx){
	const { avatar: Avatar, } = ctx.state
	const { bid, } = ctx.params
	if(!bid?.length)
		ctx.throw(400, `missing bot id`)
	const response = await Avatar.retireChat(bid)
	ctx.body = response
}
/**
 * Routines are pre-composed scripts that can be run on-demand. They animate HTML content formatted by <section>.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - Routine execution result object
 */
async function routine(ctx){
	const { rid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	const response = await Avatar.routine(rid)
	ctx.body = response
}
/**
 * Get a specified team, its details and bots, by id for the member.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - Team object
 */
async function team(ctx){
	const { tid, } = ctx.params
	const { avatar, } = ctx.state
	switch(ctx.method){
		case 'GET': // get team details
			ctx.body = await avatar.team(tid)
			break
		case 'POST': // set active team
			if(!ctx.Globals.isValidGuid(tid))
				ctx.throw(400, `Valid Team id required`)
			ctx.body = await avatar.setActiveTeam(tid)
			break
		case 'DELETE': // remove team from bot
		default:
			ctx.throw(405, `Unsupported method ${ ctx.method } for team endpoint`)
			break
	}
}
/**
 * Get a list of available teams and their default details.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Object[]} - List of team objects.
 */
async function teams(ctx){
	const { avatar: Avatar, } = ctx.state
	ctx.body = await Avatar.teams()
}
/**
 * Gets the list of shadows.
 * @param {Koa} ctx - Koa Context object
 * @returns {Object[]} - Array of shadow objects
 */
async function shadows(ctx){
	const { bid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	const response = await Avatar.shadows(bid)
	ctx.body = response
}
/**
 * Updates the instructions version for a specific bot.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - Updated bot object with new instructions version
 */
async function updateBotInstructions(ctx){
	const { bid, } = ctx.params
	if(!bid?.length)
		ctx.throw(400, `missing bot id`)
	const { avatar, } = ctx.state
	const bot = await avatar.updateBotInstructions(bid)
	ctx.body = {
		bot,
		success: !!bot,
	}
}
/* exports */
export {
	activateBot,
	activateItem,
	bot,
	bots,
    botButtons,
    botOptions,
    chat,
	createBot,
	migrateBot,
	migrateChat,
    retireBot,
    retireChat,
    routine,
    shadows,
	team,
	teams,
    updateBotInstructions,
}