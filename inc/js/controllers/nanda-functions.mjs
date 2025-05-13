/* imports */
/* module export functions */
async function server(ctx){
    const { sid, } = ctx.params
    const { avatar: Avatar, } = ctx.state
    if(!Avatar.isMyLife)
        return ctx.throw(401, 'Unauthorized access to Nanda server')
    ctx.body = await Avatar.nandaServer(sid)
}
async function serverRatings(ctx){
    const { sid, } = ctx.params
    const { avatar: Avatar, } = ctx.state
    if(!Avatar.isMyLife)
        return ctx.throw(401, 'Unauthorized access to Nanda server ratings')
    ctx.body = await Avatar.nandaServerRatings(sid)
}
async function servers(ctx){
	const { avatar: Avatar, } = ctx.state
	if(!Avatar.isMyLife)
		return ctx.throw(401, 'Unauthorized access to Nanda servers')
	ctx.body = await Avatar.nandaServers()
}
/* exports */
export {
    server,
    serverRatings,
	servers,
}