/* imports */
/* public functions */
/**
 * Get or start "Missions with Moka," our AlphaDog Alpha Tester companion intelligence.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object>} - The AlphaDog mission response
 */
async function mission(ctx){
	const { mid: missionId, } = ctx.params
	const { body, method, } = ctx.request
	const { avatar: Avatar, } = ctx.state
	body.missionId = missionId
	ctx.body = await Avatar.mission(body, method)
}
/**
 * Interact with AlphaDog to start/continue a mission.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object>} - The AlphaDog mission play response
 */
async function missionPlay(ctx){
	const { mid: missionId, } = ctx.params
	const { body, } = ctx.request
	const { avatar: Avatar, } = ctx.state
	body.missionId = missionId
	ctx.body = await Avatar.missionPlay(body)
}
/**
 * Get all available missions for the current avatar.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object[]>} - Array of available missions (`Mission.header`)
 */
async function missions(ctx){
	const { avatar: Avatar, } = ctx.state
	ctx.body = await Avatar.missions()
}
async function missionsAvailable(ctx){
	const { avatar: Avatar, } = ctx.state
	ctx.body = await Avatar.missionsAvailable()
}
/* exports */
export {
	mission,
	missionPlay,
	missions,
	missionsAvailable,
}