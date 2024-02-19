import { Marked } from 'marked'
import EventEmitter from 'events'
import { EvolutionAssistant } from './agents/system/evolution-assistant.mjs'
/* modular constants */
/**
 * @class
 * @extends EventEmitter
 * @description An avatar is a digital self proxy of Member. Not of the class but of the human themselves - they are a one-to-one representation of the human, but the synthetic version that interopts between member and internet when inside the MyLife platform. The Avatar is the manager of the member experience, and is the primary interface with the AI (aside from when a bot is handling API request, again we are speaking inside the MyLife platform).
 */
class Avatar extends EventEmitter {
    #activeBotId // id of active bot in this.#bots; empty or undefined, then this
    #activeChatCategory = mGetChatCategory()
    #bots = []
    #conversations = []
    #evolver
    #factory // do not expose
    #llm
    #proxyBeing = 'human'
    /**
     * @constructor
     * @param {Object} obj - The data object from which to create the avatar
     * @param {Factory} _factory - The member factory on which avatar relies for all service interactions
     */
    constructor(_factory, _llm){
        super()
        this.#factory = _factory
        this.#llm = _llm
    }
    /* public functions */
    /**
     * @async
     * @public
     * @returns {Promise} Promise resolves to this Avatar class instantiation
     */
    async init(){
        const obj = await this.#factory.avatarProperties()
        Object.entries(obj)
            .forEach(([key, value]) => {
                if( // exclude certain properties
                        ['being', 'mbr_id'].includes(key)
                    ||  ['$', '_', ' ', '@', '#',].includes(key[0])
                )
                    return
                this[key] = value
            })
        /* create evolver (exclude MyLife) */
        // @todo: admin interface for modifying MyLife avatar and their bots
        this.#bots = await this.factory.bots(this.id)
        let _activeBot = this.avatarBot
        if(!this.isMyLife){
            if(!_activeBot.id){ // create: but do not want to call setBot() to activate
                _activeBot = await mBot(this)
                this.#bots.unshift(_activeBot)
            }
            this.activeBotId = _activeBot.id
            this.#evolver = new EvolutionAssistant(this)
            mAssignEvolverListeners(this.#evolver, this)
            /* init evolver */
            await this.#evolver.init()
        } else { // Q-specific, leave second as case is near always false
            this.activeBotId = this.avatarBot.id
            this.avatarBot.bot_id = process.env?.OPENAI_MAHT_GPT_OVERRIDE??this.avatarBot.bot_id
            const _conversation = await this.getConversation()
            this.avatarBot.thread_id = _conversation.threadId
        }
        this.emit('avatar-init-end', this)
        return this
    }
    /**
     * Get a bot.
     * @public
     * @param {string} _bot_id - The bot id.
     * @returns {object} - The bot.
     */
    async bot(_bot_id){
        return await this.factory.bot(_bot_id)
    }
    /**
     * Processes and executes incoming chat request.
     * @public
     * @param {object} ctx - The context object.
     * @returns {object} - The response(s) to the chat request.
    */
    async chatRequest(ctx){
        if(!ctx?.state?.chatMessage)
            throw new Error('No message provided in context')
        const _chat = await mChat(
            this,
            ctx.state.chatMessage
        )
        const _activeAlerts = ctx.state.MemberSession.alerts()
        if(_activeAlerts?.length){
            _chat.alerts = ctx.state.MemberSession.alerts()
        }
        return _chat
    }
    /**
     * @todo - review and refactor; unclear if required, trace if the avatar _is_ the assistant or will have access to all bot assistants - how does this differ from getting a bot in other words?
     * @param {Dataservices} _dataservice 
     * @returns 
     */
    async getAssistant(_dataservice){	//	openai `assistant` object
        // @todo: move to modular function and refine instructions as other bots
        if(!this.assistant?.id.length) {
            this.assistant = await mAI_openai(this.#llm, {
                name: this.names?.[0]??this.name,
                model: process.env.OPENAI_MODEL_CORE_AVATAR,
                description: this.description,
                instructions: this.purpose,
            })
            //	save id to cosmos
            _dataservice.patch(this.id, {
                assistant: {
                    id: this.assistant.id
                ,	object: 'assistant'
                }
            })
        } else if(!this.assistant.name?.length){
            this.assistant = await mGetAssistant(this.#llm, this.assistant.id)
        }
        return this.assistant
    }
    /**
     * Gets Conversation object. If no thread id, creates new conversation.
     * @param {string} _thread_id - openai thread id
     * @returns 
     */
    async getConversation(_thread_id){ // per bot
        let _conversation = this.#conversations.find(_=>_.thread?.id===_thread_id)
        if(!_thread_id || !_conversation){
            _conversation = new (this.factory.conversation)({ mbr_id: this.mbr_id}, this.factory)
            await _conversation.init(_thread_id)
            this.#conversations.push(_conversation)
        }
        return _conversation
    }
    /**
     * Processes and executes incoming category set request.
     * @todo - deprecate if possible.
     * @public
     * @param {string} _category - The category to set { category, contributionId, question }.
     */
    setActiveCategory(_category){
        const _proposedCategory = mGetChatCategory(_category)
        /* evolve contribution */
        if(_proposedCategory?.category){ // no category, no contribution
            this.#evolver.setContribution(this.#activeChatCategory, _proposedCategory)
        }
    }
    /**
     * Add or update bot, and identifies as activated, unless otherwise specified.
     * @param {object} _bot - Bot-data to set.
     */
    async setBot(_bot, _activate=true){
        _bot = await mBot(this, _bot) // returns bot object
        /* add bot to avatar */
        const _index = this.#bots.findIndex(bot => bot.id === _bot.id)
        if(_index !== -1) // update
            this.#bots[_index] = _bot
        else // add
            this.#bots.push(_bot)
        /* activation */
        if(_activate)
            this.activeBotId = _bot.id
        return _bot
    }
    async thread_id(){
        // @todo: once avatar extends bot, keep this inside
        if(!this.#conversations.length){
            await this.getConversation()
        }
        return this.#conversations[0].threadId
    }
    // upon dissolution, forced/squeezed by session presumably (dehydrate), present itself to factory.evolution agent (or emit?) for inspection and incorporation if appropriate into datacore
    /* getters/setters */
    /**
     * Get the active bot. If no active bot, return this as default chat engine.
     * @public
     * @returns {object} - The active bot.
     */
    get activeBot(){
        return this.#bots.find(_bot=>_bot.id===this.activeBotId)
    }
    /**
     * Get the active bot id.
     * @public
     * @returns {string} - The active bot id.
     */
    get activeBotId(){
        return this.#activeBotId
    }
    /**
     * Set the active bot id. If not match found in bot list, then defaults back to this.id
     * @public
     * @param {string} _bot_id - The active bot id.
     * @returns {void}
     */
    set activeBotId(_bot_id){ // default PA
        if(!_bot_id?.length) _bot_id = this.avatarBot.id
        this.#activeBotId = mFindBot(this, _bot_id)?.id??this.avatarBot.id
    }
    /**
     * Returns provider for avatar intelligence.
     * @public
     * @returns {object} - The avatar intelligence provider, currently only openAI API GPT.
     */
    get ai(){
        return this.#llm
    }
    /**
     * Gets Avatar inspectable properties.
     * @todo - deprecate if possible, but otherwise needs to create exposable object, preferably a modular function for self-portrayal as object.
     * @public
     * @returns {object} - The avatar properties.
     */
    get avatar(){
        return m
    }
    /**
     * Get the personal avatar bot.
     */
    get avatarBot(){
        return this.#bots.find(_bot=>_bot.type==='personal-avatar')
    }
    /**
     * Get the "avatar's" being, or more precisely the name of the being (affiliated object) the evatar is emulating.
     * Avatars are special case and are always avatars, so when we query them non-internally for system purposes (in which case we understand we need to go directly to factory.core.being) we display the underlying essence of the datacore; could put this in its own variable, but this seems protective _and_ gives an access point for alterations.
     * @public
     * @returns {string} The object being the avatar is emulating.
    */
    get being(){    //  
        return this.#proxyBeing
    }
    /**
     * Gets all Avatar bots.
     * @public
     * @returns {array} - The bots.
     */
    get bots(){
        return this.#bots
    }
    /**
     * Get the active chat category.
     * @public
     * @returns {string} - The active chat category.
     */
    get category(){
        return this.#activeChatCategory
    }
    /**
     * Set the active chat category.
     * @public
     * @param {string} _category - The new active chat category.
     * @returns {void}
     */
    set category(_category){
        this.#activeChatCategory = _category
    }
    /**
     * Get contributions.
     * @public
     * @returns {array} - The contributions.
     */
    get contributions(){
        return this.#evolver?.contributions
    }
    /**
     * Set incoming contribution.
     * @param {object} _contribution
    */
    set contribution(_contribution){
        this.#evolver.contribution = _contribution
    }
    /**
     * Get uninstantiated class definition for conversation. If getting a specific conversation, use .conversation(id).
     * @returns {class} - class definition for conversation
     */
    get conversation(){
        return this.factory.conversation
    }
    /**
     * Get conversations. If getting a specific conversation, use .conversation(id).
     * @returns {array} - The conversations.
     */
    get conversations(){
        return this.#conversations
    }
    
    /**
     * Get the Avatar's Factory.
     * @todo - deprecate if possible, return to private
     * @public
     * @returns {AgentFactory} - The Avatar's Factory.
     */
    get factory(){
        return this.#factory
    }
    /**
     * Globals shortcut.
     * @public
     * @returns {object} - The globals.
     */
    get globals(){
        return this.#factory.globals
    }
    /**
     * Whether or not the avatar is the MyLife avatar.
     * @public
     * @returns {boolean} - true if the avatar is the MyLife avatar. 
     */
    get isMyLife(){
        return this.#factory.isMyLife
    }
    /**
     * Get the member id.
     * @public
     * @returns {string} - The member's id.
     */
    get mbr_id(){
        return this.#factory.mbr_id
    }
    /**
     * Get the guid portion of member id.
     * @todo - deprecate to `mbr_sysId`
     * @public
     * @returns {guid} - The member's core guid.
     */
    get mbr_id_id(){
        return this.mbr_sysId
    }
    /**
     * Get the system name portion of member id.
     * @todo - deprecate to `mbr_sysName`
     * @public
     * @returns {guid} - The member's system name.
     */
    get mbr_name(){
        return this.mbr_sysName
    }
    /**
     * Get the guid portion of member id.
     * @public
     * @returns {guid} - The member's core guid.
     */
    get mbr_sysId(){
        return this.globals.sysId(this.mbr_id)
    }
    /**
     * Get the system name portion of member id.
     * @public
     * @returns {guid} - The member's system name.
     */
    get mbr_sysName(){
        return this.globals.sysName(this.mbr_id)
    }
    /**
     * Gets first name of member from `#factory`.
     * @public
     * @returns {guid} - The member's core guid.
     */
    get memberFirstName(){
        return this.memberName.split(' ')[0]
    }
    /**
     * Gets full name of member from `#factory`.
     * @public
     * @returns {guid} - The member's core guid.
     */
    get memberName(){
        return this.#factory.memberName
    }
    /**
     * Get uninstantiated class definition for message.
     * @returns {class} - class definition for message
     */
    get message(){
        return this.factory.message
    }
}
/* modular functions */
/**
 * Initializes openAI assistant and returns associated `assistant` object.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {object} _botData - bot creation instructions.
 * @returns {object} - [OpenAI assistant object](https://platform.openai.com/docs/api-reference/assistants/object)
 */
async function mAI_openai(_openai, _botData){
    const _assistantData = {
        description: _botData.description,
        model: _botData.model,
        name: _botData.bot_name??_botData.name, // take friendly name before Cosmos
        instructions: _botData.instructions,
    }
    return await _openai.beta.assistants.create(_assistantData)
}
/**
 * Assigns evolver listeners.
 * @modular
 * @param {EvolutionAssistant} _evolver - Evolver object
 * @param {Avatar} _avatar - Avatar object
 * @returns {void}
 */
function mAssignEvolverListeners(_evolver, _avatar){
    /* assign evolver listeners */
    _evolver.on(
        'on-contribution-new',
        _contribution=>{
            _contribution.emit('on-contribution-new', _contribution)
        }
    )
    _evolver.on(
        'avatar-change-category',
        (_current, _proposed)=>{
            _avatar.category = _proposed
            console.log('avatar-change-category', _avatar.category.category)
        }
    )
    _evolver.on(
        'on-contribution-submitted',
        _contribution=>{
            // send to gpt for summary
            const _responses = _contribution.responses.join('\n')
            // @todo: wrong factory?
            const _summary = _avatar.factory.openai.completions.create({
                model: 'gpt-3.5-turbo-instruct',
                prompt: 'summarize answers in 512 chars or less, if unsummarizable, return "NONE": ' + _responses,
                temperature: 1,
                max_tokens: 700,
                frequency_penalty: 0.87,
                presence_penalty: 0.54,
            })
            // evaluate summary
            console.log('on-contribution-submitted', _summary)
            return
            //  if summary is good, submit to cosmos
        }
    )
}
/**
 * Updates or creates bot (defaults to new personal-avatar) in Cosmos and returns successful `bot` object, complete with conversation (including thread/thread_id in avatar) and gpt-assistant intelligence.
 * @todo Fix occasions where there will be no object_id property to use, as it was created through a hydration method based on API usage, so will be attached to mbr_id, but NOT avatar.id
 * @modular
 * @param {Avatar} _avatar - Avatar object that will govern bot
 * @param {object} _bot - Bot object
 * @returns {object} - Bot object
 */
async function mBot(_avatar, _bot={type: 'personal-avatar'}){
    /* validation */
    if(!_bot.mbr_id?.length)
        _bot.mbr_id = _avatar.mbr_id
    else if(_bot.mbr_id!==_avatar.mbr_id)
        throw new Error('Bot mbr_id cannot be changed')
    if(!_bot.type?.length)
        throw new Error('Bot type required')
    /* set required _bot super-properties */
    if(!_bot.object_id?.length)
        _bot.object_id = _avatar.id
    if(!_bot.id)
        _bot.id = _avatar.factory.newGuid
    const _botSlot = _avatar.bots.findIndex(bot => bot.id === _bot.id)
    if(_botSlot!==-1){ // update
        const _existingBot = _avatar.bots[_botSlot]
        if(
                _bot.bot_id!==_existingBot.bot_id 
            ||  _bot.thread_id!==_existingBot.thread_id
        ){
            console.log(`ERROR: bot discrepency; bot_id: db=${_existingBot.bot_id}, inc=${_bot.bot_id}; thread_id: db=${_existingBot.thread_id}, inc=${_bot.thread_id}`)
            throw new Error('Bot id or thread id cannot attempt to be changed via bot')
        }
        _bot = {..._existingBot, ..._bot}
    } else { // add
        _bot = await mCreateBot(_avatar, _bot) // add in openai
    }
    /* create or update bot properties */
    if(!_bot?.thread_id?.length){
        // openai spec: threads are independent from assistant_id
        // @todo: investigate: need to check valid thread_id? does it expire?
        const _conversation = await _avatar.getConversation()
        _bot.thread_id = _conversation.thread_id
    }
    // update Cosmos (no need async)
    _avatar.factory.setBot(_bot)
    return _bot
}
/**
 * Cancels openAI run.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {string} _thread_id - Thread id
 * @param {string} _run_id - Run id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mCancelRun(_openai, _thread_id, _run_id,){
    return await _openai.beta.threads.runs.cancel(
        _thread_id,
        _run_id
    )
}
/**
 * Requests and returns chat response from openAI. Call session for conversation id.
 * @todo - reinstate contribution
 * @modular
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _chatMessage - Chat message
 * @returns {array} - array of front-end MyLife chat response objects { agent, category, contributions, message, response_time, purpose, type }
 */
/**
 * Requests and returns chat response from openAI. Call session for conversation id.
 * @todo - reinstate contribution
 * @modular
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _chatMessage - Chat message
 * @returns {array} - array of front-end MyLife chat response objects { agent, category, contributions, message, response_time, purpose, type }
 */
async function mChat(_avatar, _chatMessage){
    // note: Q/isMyLife PA bot does not have thread_id intentionally, as every session creates its own
    const _openai = _avatar.ai
    const _processStartTime = Date.now()
    const _bot = _avatar.activeBot
    // check if active bot, if not use self
    const _conversation = await _avatar.getConversation(_bot.thread_id) // create if not exists
    _conversation.addMessage(_chatMessage)
    //	@todo: assign uploaded files (optional) and push `retrieval` to tools
    _bot.thread_id = _bot.thread_id??_conversation.thread_id
    await mRunTrigger(_openai, _avatar, _conversation) // run is triggered by message creation, content embedded/embedding now in _conversation in _avatar.conversations
    const _messages = (await _conversation.getMessages_openai())
        .filter(_msg => _msg.run_id == _avatar.runs[0].id)
        .map(_msg => {
            return new (_avatar.factory.message)({
                bot_id: _bot.id,
                avatar_id: _avatar.id,
                message: _msg,
                content: _msg.content[0].text.value,
                mbr_id: _avatar.mbr_id,
                role: 'assistant',
            })
        })
    _messages.forEach(async _msg => {
//  @todo: reinstate contribution
//        _avatar.#evolver?.setContribution(_avatar.#activeChatCategory, _msg)??false
        await _conversation.addMessage(_msg)
    })
    //	add/update cosmos
    if ((_avatar?.factory!==undefined) && (process.env?.MYLIFE_DB_ALLOW_SAVE??false)) {
        _conversation.save()
    }
    const _chat = _messages
        .map(_msg=>{
            const __message = mPrepareMessage(_msg) // returns object { category, content }
            return {
                activeBotId: _bot.id,
                activeBotAIId: _bot.bot_id,
                agent: 'server',
                category: __message.category,
                contributions: [],
                message: __message.content,
                purpose: 'chat response',
                response_time: Date.now()-_processStartTime,
                thread_id: _conversation.thread_id,
                type: 'chat',
            }
        })
    //	return response
    return _chat
}
/**
 * Creates bot and returns associated `bot` object.
 * @modular
 * @private
 * @param {Avatar} _avatar - Avatar object
 * @param {object} _bot - Bot object
 * @returns {object} - Bot object
*/
async function mCreateBot(_avatar, _bot){
    // create gpt
    const _botData = await _avatar.factory.createBot(_bot)
    _botData.object_id = _avatar.id
    const _openaiGPT = await mAI_openai(_avatar.ai, _botData)
    _botData.bot_id = _openaiGPT.id
    return { ..._bot, ..._botData }
}
/**
 * Gets bot by id.
 * @modular
 * @param {object} _avatar - Avatar instance.
 * @param {string} _botId - Bot id
 * @returns {object} - Bot object
 */
function mFindBot(_avatar, _botId){
    return _avatar.bots
        .filter(_bot=>{ return _bot.id==_botId })
        [0]
}
/**
 * Returns simple micro-category after logic mutation.
 * @modular
 * @param {string} _category text of category
 * @returns {string} formatted category
 */
function mFormatCategory(_category){
    return _category
        .trim()
        .slice(0, 128)  //  hard cap at 128 chars
        .replace(/\s+/g, '_')
        .toLowerCase()
}
/**
 * Gets OpenAI Assistant.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {string} _assistant_id - Assistant id
 * @returns {object} - [OpenAI assistant object](https://platform.openai.com/docs/api-reference/assistants/assistants/retrieve)
 */
async function mGetAssistant(_openai, _assistant_id){
    return await _openai.beta.assistants.retrieve(_assistant_id)
}
/**
 * Returns MyLife-version of chat category object
 * @modular
 * @param {object} _category - local front-end category { category, contributionId, question/message/content }
 * @returns {object} - local category { category, contributionId, content }
 */
function mGetChatCategory(_category) {
    const _proposedCategory = {
        category: '',
        contributionId: undefined,
        content: undefined,
    }
    if(_category?.category && _category.category.toLowerCase() !== 'off'){
        _proposedCategory.category = mFormatCategory(_category.category)
        _proposedCategory.contributionId = _category.contributionId
        _proposedCategory.content = 
            _category?.question??
            _category?.message??
            _category?.content // test for undefined
    }
    return _proposedCategory
}
/**
 * returns simple micro-message with category after logic mutation. 
 * Currently tuned for openAI gpt-assistant responses.
 * @modular
 * @private
 * @param {string} _msg text of message, currently from gpt-assistants
 * @returns {object} { category, content }
 */
function mPrepareMessage(_msg){
    /* parse message */
    // Regular expression to match the pattern "Category Mode: {category}. " or "Category Mode: {category}\n"; The 'i' flag makes the match case-insensitive
    const _categoryRegex = /^Category Mode: (.*?)\.?$/gim
    const _match = _categoryRegex.exec(_msg)
    const _messageCategory = mFormatCategory(_match?.[1]??'')
    if(_msg.content) _msg = _msg.content
    // Remove from _msg
    _msg = _msg.replace(_categoryRegex, '')
    const _content = _msg.split('\n')
        .filter(_line => _line.trim() !== '') // Remove empty lines
        .map(_msg=>{
            return new Marked().parse(_msg)
        })
        .join('\n')
    return {
        category: _messageCategory,
        content: _content,
    }
}
/**
 * Maintains vigil for status of openAI `run = 'completed'`.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {object} _run - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunFinish(_openai, _run){
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
            try {
                const status = await mRunStatus(_openai, _run)
                if (status) {
                    clearInterval(checkInterval)
                    resolve(_run)
                }
            } catch (error) {
                clearInterval(checkInterval)
                reject(error)
            }
        }, process.env.OPENAI_API_CHAT_RESPONSE_PING_INTERVAL??890)
        // Set a timeout to resolve the promise after 55 seconds
        setTimeout(() => {
            clearInterval(checkInterval)
            resolve('Run completed (timeout)')
        }, process.env.OPENAI_API_CHAT_TIMEOUT??55000)
    })
}
/**
 * Returns all openai `run` objects for `thread`.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _thread_id - Thread id (from session)
 * @returns {array} - array of [OpenAI run objects](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRuns(_openai, _avatar, _thread_id){
	if(!_avatar.runs){
		_avatar.runs = await _openai.beta.threads.runs
            .list(_thread_id)
	}
}
/**
 * Executes openAI run and returns associated `run` object.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {string} _assistant_id - Assistant id
 * @param {string} _thread_id - Thread id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunStart(_openai, _assistant_id, _thread_id){
    return await _openai.beta.threads.runs.create(
        _thread_id,
        { assistant_id: _assistant_id }
    )
}
/**
 * Checks status of openAI run.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {object} _run - Run id
 * @returns {boolean} - true if run completed, voids otherwise
 */
async function mRunStatus(_openai, _run){
    const __run = await _openai.beta.threads.runs
        .retrieve(
            _run.thread_id,
            _run.id,
        )
    switch(__run.status){
        //	https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
        case 'completed':
            _run = __run // update via overwrite
            return true
        case 'failed':
        case 'cancelled':
        case 'expired':
            return false
        case 'queued':
        case 'requires_action':
        case 'in_progress':
        case 'cancelling':
        default:
            console.log(`...${__run.status}:${_run.thread_id}...`) // ping log
            break
    }
}
/**
 * Returns requested openai `run` object.
 * @modular
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _run_id - Run id
 * @param {string} _step_id - Step id
 * @returns {object} - [OpenAI run-step object]()
 */
async function mRunStep(_avatar, _run_id, _step_id){
	//	pull from known runs
	return _avatar.runs
		.filter(_run=>{ return _run.id==_run_id })
		.steps
			.filter(_step=>{ return _step.id==_step_id })
}
/**
 * Returns all openai `run-step` objects for `run`.
 * @modular
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _run_id - Run id
 * @returns {array} - array of [OpenAI run-step objects]()
 */
async function mRunSteps(_avatar, _run_id){
	//	always get dynamically
	const _run = _avatar.runs
        .filter(_run=>{ return _run.id==_run_id })
        [0]
	_run.steps = await openai.beta.threads.runs.steps
        .list(_avatar.thread.id, _run.id)
}
/**
 * Triggers openAI run and updates associated `run` object.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _conversation - Conversation Object
 * @returns {void} - All content generated by run is available in `avatar`.
 */
async function mRunTrigger(_openai, _avatar){
    const _bot = _avatar.activeBot
    const _run = await mRunStart(_openai, _bot.bot_id, _bot.thread_id)
    if(!_run)
        throw new Error('Run failed to start')
    // @todo: runs are ephemeral-ish, lasting only for session, ensure not stored
    _avatar.runs = _avatar.runs??[]
    _avatar.runs.unshift(_run)
    // ping status
    await mRunFinish(_openai, _run) // only returns 
    return
}
/* exports */
export default Avatar