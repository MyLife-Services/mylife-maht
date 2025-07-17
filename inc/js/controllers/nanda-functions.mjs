/* imports */
/* export functions */
export async function registries(ctx){
    const { avatar: Avatar, } = ctx.state
    if(!Avatar.isMyLife)
        return ctx.throw(401, 'Unauthorized access to Nanda registries')
    const options = {}
    ctx.body = await Avatar.registries(options)
}
export async function registry(ctx){
    const { registryId='mylife', } = ctx.params
    const { avatar: Avatar, } = ctx.state
    if(!Avatar.isMyLife)
        return ctx.throw(401, 'Unauthorized access to Nanda registry')
    ctx.body = await Avatar.registry(registryId)
}
export async function server(ctx){
    const { sid, } = ctx.params
    const { avatar: Avatar, } = ctx.state
    if(!Avatar.isMyLife)
        return ctx.throw(401, 'Unauthorized access to Nanda server')
    ctx.body = await Avatar.nandaServer(sid)
}
export async function serverRatings(ctx){
    const { sid, } = ctx.params
    const { avatar: Avatar, } = ctx.state
    if(!Avatar.isMyLife)
        return ctx.throw(401, 'Unauthorized access to Nanda server ratings')
    ctx.body = await Avatar.nandaServerRatings(sid)
}
export async function servers(ctx){
	const { avatar: Avatar, } = ctx.state
	if(!Avatar.isMyLife)
		return ctx.throw(401, 'Unauthorized access to Nanda servers')
	ctx.body = await Avatar.nandaServers()
}