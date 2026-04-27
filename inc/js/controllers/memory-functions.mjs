/* module export functions */
function acceptShareWarnings(ctx){
	const { sid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	if(!Avatar.isMyLife)
		return ctx.throw(401, 'Unauthorized access to MyLife memory')
	ctx.body = Avatar.acceptShareWarnings(sid)
}
async function collectMemory(ctx){
	// @todo - implement memory collection
}
/**
 * Deletes a share from MyLife `shares` container and associated object (get itemId from `share` itself).
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<Boolean>} - Success or failure of the operation
 */
async function deleteShare(ctx){
	const { sid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	if(Avatar.isMyLife)
		return ctx.throw(401, 'MyLife cannot delete shares')
	ctx.body = await Avatar.deleteShare(sid)
}
/**
 * Gets an owned share from MyLife `shares` container.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object>} - The MemberShare document
 */
async function getShare(ctx){
	const { sid, } = ctx.params
	const { avatar: MemberAvatar, } = ctx.state
	const { avatar: SystemAvatar, } = ctx.SystemAvatar
	ctx.body = await MemberAvatar.getShare(sid)
}
/**
 * Gets all owned relevant shares from MyLife `shares` container, either by item or member.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object[]>} - The MemberShare array
 */
async function getShares(ctx){
	const { iid, } = ctx.params
	const { avatar: MemberAvatar, } = ctx.state
	ctx.body = await MemberAvatar.getShares(iid)
}
/**
 * Ends a memory session.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object>} - The result of ending the memory session
 */
async function endMemory(ctx){
	const { iid, } = ctx.params
	const { Globals, MyLife, } = ctx
	if(!Globals.isValidGuid(iid))
		return ctx.throw(400, 'Invalid Item ID')
	const { avatar, } = ctx.state
	ctx.body = await avatar.endMemory(iid)
}
/**
 * Reliving a memory is a unique MyLife `experience` that allows a user to relive a memory from any vantage they choose. The bot by default will:
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object>} - livingMemory engagement object (i.e., includes frontend parameters for engagement as per instructions for included `portrayMemory` function in LLM-speak)
 */
async function reliveMemory(ctx){
	const { iid } = ctx.params
	const { Globals, MyLife, } = ctx
	if(!Globals.isValidGuid(iid))
		return ctx.throw(400, 'Invalid Item ID')
	const { avatar, } = ctx.state
	const { memberInput, } = ctx.request.body
	console.log('Avatar::reliveMemory()::memberInput', memberInput, ctx.request.body)
	ctx.body = await avatar.reliveMemory(iid, memberInput)
}
async function shareCreate(ctx){
	const { avatar: Avatar, } = ctx.state
	const shareData = ctx.request.body
	if(Avatar.isMyLife)
		return ctx.throw(401, 'Unauthorized access to MyLife sharing system')
	if(shareData.id)
		shareData.id = undefined
	ctx.body = await Avatar.shareCreate(shareData)
}
async function shareDelete(ctx){
	const { sid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	if(Avatar.isMyLife)
		return ctx.throw(401, 'Unauthorized access to MyLife share delete')
	ctx.body = await Avatar.deleteShare(sid)
}
/**
 * Share a memory `Header` with frontend to determine warnings or restrictions.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object>} - shareHeader object
 */
async function shareHeader(ctx){
	const { sid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	if(!Avatar.isMyLife)
		return ctx.throw(401, 'Unauthorized access to MyLife share header')
	ctx.body = await Avatar.shareHeader(sid)
}
/**
 * Submit memory `Feedback`.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object>} - shareFeedback object
 */
async function shareFeedback(ctx){
	const { sid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	ctx.throw(501, 'Not Implemented')
}
/**
 * Execute a memory `Share`; currently only shared publicly with non-MyLife members.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object>} - shareMemory object
 */
async function shareMemory(ctx){
	const { sid, } = ctx.params
	const { Globals, MyLife, } = ctx
	const { avatar: Avatar, } = ctx.state
	if(!Globals.isValidGuid(sid))
		return ctx.throw(400, 'Invalid Item ID')
	if(!Avatar.isMyLife)
		return ctx.throw(401, 'Unauthorized access to MyLife memory')
	const { input, } = ctx.request.body
	const Share = await Avatar.shareMemory(sid, input)
	ctx.body = Share.share
}
/**
 * Stop sharing a memory.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object>} - shareStop object
 */
async function shareStop(ctx){
	const { sid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	if(!Avatar.isMyLife)
		return ctx.throw(401, 'Unauthorized access to MyLife share')
	ctx.body = await Avatar.shareStop(sid)
}
async function shareUpdate(ctx){
	const { sid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	const shareData = ctx.request.body
	if(Avatar.isMyLife)
		return ctx.throw(401, 'Unauthorized access to MyLife sharing system')
	shareData.id = sid
	ctx.body = await Avatar.shareUpdate(shareData)
}
async function validateShare(ctx){
	const { sid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	if(!Avatar.isMyLife)
		return ctx.throw(401, 'Unauthorized access to MyLife share')
	ctx.body = await Avatar.validateShare(sid)
}
/* exports */
export {
	acceptShareWarnings,
    collectMemory,
	deleteShare,
	endMemory,
	getShare,
	getShares,
    reliveMemory,
	shareCreate,
	shareDelete,
	shareHeader,
	shareFeedback,
	shareMemory,
	shareStop,
	shareUpdate,
	validateShare,
}