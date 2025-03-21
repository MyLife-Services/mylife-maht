/* imports */
/* public functions */
/**
 * Get or interact regarding "Missions with Moka," our AlphaDog Alpha Tester companion intelligence.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object>} - The AlphaDog mission response
 */
async function mission(ctx){
	const { mid: missionId, } = ctx.params
	const { body, method, } = ctx.request
	const { avatar: Avatar, } = ctx.state
	body.missionId = missionId
	await Avatar.alphaDogAlert()
	switch(method.toLowerCase()){
		case 'delete':
		case 'patch':
		case 'post':
		case 'put':
			ctx.throw(501, 'Not Implemented')
			break
		case 'get':
		default:
			ctx.body = await Avatar.mission(body, method)
			break
	}
}
/**
 * Get all available missions for the current avatar.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object[]>} - Array of available missions (`Mission.header`)
 */
async function missions(ctx){
	const { avatar: Avatar, } = ctx.state
	await Avatar.alphaDogAlert()
	ctx.body = await Avatar.missions()
}
async function missionsAvailable(ctx){
	const { avatar: Avatar, } = ctx.state
	await Avatar.alphaDogAlert()
	ctx.body = await Avatar.missionsAvailable()
}
/* exports */
export {
	mission,
	missions,
	missionsAvailable,
}