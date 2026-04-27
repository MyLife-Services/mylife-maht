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
	const { DigitalSelf, } = ctx.state
	body.missionId = missionId
	ctx.body = await DigitalSelf.mission(body, method)
}
/**
 * Interact with AlphaDog to start/continue a mission.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object>} - The AlphaDog mission play response
 */
async function missionPlay(ctx){
	const { mid: missionId, } = ctx.params
	const { body, } = ctx.request
	const { DigitalSelf, } = ctx.state
	body.missionId = missionId
	ctx.body = await DigitalSelf.missionPlay(body)
}
/**
 * Get all available missions for the current DigitalSelf.
 * @param {Koa} ctx - Koa context object
 * @returns {Promise<object[]>} - Array of available missions (`Mission.header`)
 */
async function missions(ctx){
	const { DigitalSelf, } = ctx.state
	ctx.body = await DigitalSelf.missions()
}
async function missionsAvailable(ctx){
	const { DigitalSelf, } = ctx.state
	ctx.body = await DigitalSelf.missionsAvailable()
}
/* exports */
export {
	mission,
	missionPlay,
	missions,
	missionsAvailable,
}