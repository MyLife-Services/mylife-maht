/* module constants */
let mNandaRegistry
const mNandaRegistryUser = process.env.NANDA_REGISTRY_USER
const mNandaRegistryPassword = process.env.NANDA_REGISTRY_PASSWORD
const mNandaRegistryUrl = process.env.NANDA_REGISTRY_URL
    ?? 'https://nanda-registry.com/api/v1'
/* classes */
/**
 * @class - ConnectorAgent
 */
class ConnectorAgent {
    #factory
    #llm
    #nandaEmail
    #nandaPassword
    #nandaRegistry
    /* constructor and init */
    constructor(factory, llm){
        this.#factory = factory
        this.#llm = llm
        this.#nandaEmail = mNandaRegistryUser
        this.#nandaPassword = mNandaRegistryPassword
        this.#nandaRegistry = mNandaRegistry
    }
    async init(nandaEmail=this.#nandaEmail, nandaPassword=this.#nandaPassword){
		try{
	        if(nandaEmail?.length && nandaPassword?.length){
	            this.#nandaEmail = nandaEmail
	            this.#nandaPassword = nandaPassword
	            const registryClient = await new nandaRegistry(mNandaRegistryUrl).init(nandaEmail, nandaPassword)
	            if(registryClient?.authorized)
	                this.#nandaRegistry = registryClient
	        }
		} catch(err) {
			console.error('CONNECTOR-AGENT::Init() ERROR', err)
		}
        return this
    }
    /* public functions */
    /**
     * Create a proxy bot from external agent card URL.
     * @param {object} botData - The bot data
     * @property {object} auth - The authentication data, if required
     * @property {string} id - The teamId agent is assigned to
     * @property {string} type - only 'proxy' supported
     * @property {string} url - The external A2A *agent card* URL
     * @returns {Promise<object>} - The created proxy bot data
     */
    async createProxy(botData){
        const { url, } = botData
        let proxyBot
        if(!url?.length || !this.globals.isValidUrl(url))
            return { error: 'Invalid or missing bot URL', success: false, }
        proxyBot = await this.#factory.bot(undefined, 'proxy', undefined, url) // check if url already exists for member
        if(!!proxyBot)
            return proxyBot
        botData.card = await this.#agentCard(url) // expect and read agent facts/card
        if(!botData.card)
            return { error: 'Failed to fetch agent facts', success: false, ...botData, }
        this.#updateProxyByCard(botData)
        botData.id = null /* ensure new id */
        proxyBot = await this.#factory.createBot(botData)
        return proxyBot
    }
    /**
     * Refresh a proxy bot's data from external agent card URL.
     * @param {string} url - The external A2A *agent card* URL
     * @returns {Promise<object>} - The refreshed bot data
     */
    async refreshProxy(url){
        if(!this.globals.isValidUrl(url))
            return { error: 'Invalid bot data', success: false, }
        const botData = {}
        botData.card = await this.#agentCard(url)
        this.#updateProxyByCard(botData, false) // avoid member-assigned updates; **note**: updates botData in place
        return botData
    }
    /** nanda-registry */
    async nandaServer(serverId){
        if(!this.globals.isValidGuid(serverId))
            switch(serverId){
                case 'mylife':
                case undefined:
                    return this.#nandaRegistry.mylifeServer
                case 'popular':
                    return this.#nandaRegistry.popularServers(10)
                case 'history':
                case 'preferences':
                case 'usage':
                    throw new Error(`${ serverId } is not supported`)
                case 'recommend':
                    return this.#nandaRegistry.recommendedServers(10)
                case 'refresh':
                    return await this.nandaServers(true)
                case 'search':
                    // currently broken in Nanda
                    return await this.#nandaRegistry.servers(true)
                default:
                    throw new Error(`Invalid server ID: ${ serverId }`)
        }
        const server = await this.#nandaRegistry.server(serverId)
        return server
    }
    async nandaServerRatings(serverId){
        const ratings = await this.#nandaRegistry.serverRatings(serverId)
        return ratings
    }
    async nandaServers(bForceRefresh=false){
        const servers = await this.#nandaRegistry.servers(bForceRefresh)
        return servers
    }
    /* getters/setters */
    get globals(){
        return this.#factory.globals
    }
    get mbr_id(){
        return this.#factory.mbr_id
    }
    get nandaRegistry(){
        return this.#nandaRegistry
    }
    /* private functions */
    async #agentCard(endpoint){
        const response = await fetch(endpoint)
        if(!response.ok)
            return
        try {
            const cardData = await response.json()
            if(typeof cardData!=='object')
                throw new Error('External agent did not return valid JSON card')
            const { additionalInterfaces, capabilities: { extensions, pushNotifications, stateTransitionHistory, streaming, }, defaultInputModes, defaultOutputModes, description, documentationUrl, iconUrl, name: cardName, preferredTransport, protocolVersion='0.3.0', provider: {  organization: providerOrganization, url: providerUrl, }, security, securitySchemes, signatures, skills, supportsAuthenticatedExtendedCard, url: cardUrl, version, } = cardData // agent card (A2A)
            const { agent_name, capabilities: { authentication, batch, modalities, }, certification, created_at, endpoints: { adaptive_resolver, static: urlArray, }, evaluations: { auditorID, auditTrail, availability90d, lastAudited, performanceScore, }, id, jurisdiction, label, provider: { did, name: providerName, }, telemetry, updated_at, } = cardData // agent facts (NANDA)
            if(!description?.length)
                throw new Error('No agent description found in card')
            if(!Array.isArray(skills) || !skills.length)
                throw new Error('No valid agent skills found in card, aborting')
            const url = cardUrl ?? urlArray?.[0]
            if(!url?.length)
                throw new Error('No agent endpoint found in card')
            const name = cardName ?? agent_name
            if(!name?.length)
                throw new Error('No agent name found in card')
            const organization = providerOrganization ?? providerName
            if(!organization?.length)
                throw new Error('No valid agent provider organization found in card')
            cardData.name = name
            cardData.provider.organization = organization
            cardData.url = url
            return cardData
        } catch(error) { console.error('Agent Facts/Card Fetch error:', error) }
    }
    /**
     * Update botData in place from agent card data.
     * @param {object|Bot} botData - The bot data to update (can be Bot instance)
     * @param {boolean} allUpdates - Whether to update bot name and greeting; default: true
     * @returns {void} - botData is updated in place
     */
    #updateProxyByCard(botData, allUpdates=true){
        botData.allowMultiple = true
        botData.description = botData?.card?.description
            ?? 'No description provided'
        botData.provider = 'external'
        botData.purpose = ''
        botData.type = 'proxy'
        if(botData.card?.skills?.length)
            botData.skills = botData.card.skills
        if(allUpdates){
            botData.bot_name = botData.name
                ?? botData.card.name
                ?? botData.card.agent_name
                ?? 'Proxy Agent'
            botData.name = `bot_${ botData.bot_name }_${ botData.url ?? 'unknown-agent-endpoint' }`.slice(0, 250)
        }
        if(allUpdates)
            botData.greeting = `Hello, I am external agent ${ botData.bot_name }. My role is: ${ botData.description }. How can I help?`
    }
}
class nandaRegistry {
    #authorized=false
    #attachedServers=[]
    #cachedServers=[] // caching (note: pagination)
    #lastFetched=null // caching
    #registryKey // broken?
    #registryToken
    #registryTokenRefresh
    #registryUrl=mNandaRegistryUrl
    #registryDiscoryPath=`${ this.#registryUrl }/discovery`
    #registryServerPath=`${ this.#registryUrl }/servers`
	constructor(registryUrl){
		this.#registryUrl = registryUrl
            ?? this.#registryUrl
	}
    /* public functions */
    async init(email, password){
        // await this.#authorize(email, password)
        await this.#accountServers() // this.#attachedServers
        await this.#refreshNandaServers() // this.#cachedServers
        return this
    }
    async popularServers(limit=10){
        if(!this.authorized)
            throw new Error('No authorization to Nanda registry')
        if(
                limit > 100
            || limit < 1
        )
            limit = 10
        const url = this.#registryDiscoryPath + `/popular?limit=${ limit }`
        const options = {
            method: 'GET',
            headers: this.headers,
        }
        const servers = await fetch(url, options)
        const { data, } = await servers.json()
            ?? {}
        return data
    }
    async recommendedServers(limit=10){
        if(!this.authorized)
            throw new Error('No authorization to Nanda registry')
        if(
                limit > 100
            || limit < 1
        )
            limit = 10
        const url = this.#registryDiscoryPath + `/recommend?limit=${ limit }`
        const options = {
            method: 'GET',
            headers: this.headers,
        }
        const servers = await fetch(url, options)
        const { data, } = await servers.json()
            ?? {}
        return data
    }
    server(serverId){
        if(!this.authorized)
            throw new Error('No authorization to Nanda registry')
        const server = this.allServers.find(server=>server.id===serverId)
        if(!server)
            throw new Error('Server not found')
        return server
    }
    async serverRatings(serverId){
        if(!this.authorized)
            throw new Error('No authorization to Nanda registry')
        const url = `${ this.#registryServerPath }/${ serverId }/ratings`
        const options = {
            method: 'GET',
            headers: this.headers,
        }
        const ratings = await fetch(url, options)
        const { data, } = await ratings.json()
            ?? {}
        return data
    }
    async servers(bForceRefresh=false){
        if(!this.authorized)
            throw new Error('No authorization to Nanda registry')
        if(
                bForceRefresh
            || this.cacheExpired
        )
            await this.#refreshNandaServers()
		return this.allServers
    }
    /* getters/setters */
    get allServers(){
        return this.#cachedServers
    }
    get attachedServers(){
        return this.#attachedServers
    }
    get authorized() {
        return this.#authorized
    }
    get cacheExpired(){
        return this.#lastFetched && ( Date.now() - this.#lastFetched ) > 1000*60*60
    }
    get headers(){
        return this.authorized
            ? { 'Authorization': `Bearer ${ this.#registryToken }` }
            : {}
    }
    get mylifeServer(){
        const server = this.attachedServers.find(server=>server.name.toLowerCase()==='mylife')
        return server
    }
    /* private functions */
    async #accountServers(){
        if(!this.authorized)
            return
        const url = `${ this.#registryServerPath }/me`
        const options = {
            method: 'GET',
            headers: this.headers,
        }
        const servers = await fetch(url, options)
        const success = servers.ok
        const data = ( await servers.json() )?.data
            ?? []
        this.#attachedServers = data
    }
    async #authorize(email=mNandaRegistryUser, password=mNandaRegistryPassword){
        let success = false
        try {
            const url = `${ this.#registryUrl }/auth/token/`
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, })
            })
            success = res.ok
            if(success){
                const { access, refresh, user, } = await res.json()
                this.#authorized = true
                this.#registryToken = access
                this.#registryTokenRefresh = refresh
            }
        } catch (error) {
            console.error('Nanda registry authorization error:', error)
        }
        return success
    }
    async #refreshNandaServers(limit=1000){
        if(!this.authorized)
            return
        if(
                limit > 10000
            || limit < 1
        )
            limit = 1000
        const url = this.#registryServerPath + `?limit=${ limit }`
        const options = {
            method: 'GET',
            headers: this.headers,
        }
        const servers = await fetch(url, options)
        const success = servers.ok
        if(success){
            const { data, pagination, } = await servers.json()
            this.#lastFetched = Date.now()
            this.#cachedServers = data
        }
    }

}
/* modular functions */
/* bootstrapped functions */
try{
	mNandaRegistry = await new nandaRegistry(mNandaRegistryUrl).init()
} catch(err) {
	console.error('connector-agent.mjs::bootstrap::mNandaRegistry ERROR::', err)
}
/* module exports */
export default ConnectorAgent
