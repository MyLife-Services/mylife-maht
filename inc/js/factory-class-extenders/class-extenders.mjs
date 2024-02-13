import { EventEmitter } from 'events'
import { EvolutionAssistant } from '../agents/system/evolution-assistant.mjs'
import {
    mAI_openai,
    mAssignEvolverListeners,
    mBot,
    mChat,
    mFindBot,
    mGetAssistant,
    mGetChatCategory,
 } from './class-avatar-functions.mjs'
import {
    mGetQuestions,
    mUpdateContribution,
} from './class-contribution-functions.mjs'
import {
    mInvokeThread,
    mMessages,
    mSaveConversation,
} from './class-conversation-functions.mjs'
import {
    mGetMessage,
	mAssignContent,
} from './class-message-functions.mjs'
import { _ } from 'ajv'
import { parse } from 'path'
//  function definitions to extend remarkable classes
function extendClass_avatar(_originClass,_references) {
    class Avatar extends _originClass {
        #activeBotId // id of active bot in this.#bots; empty or undefined, then this
        #activeChatCategory = mGetChatCategory()
        #bots = []
        #conversations = []
        #emitter = new EventEmitter()
        #evolver
        #factory
        #openai = _references?.openai
        #proxyBeing = 'human'
        constructor(_obj,_factory) {
            super(_obj) //  should include contributions from db or from class schema
            if(_obj.proxyBeing)
                this.#proxyBeing = _obj.proxyBeing
            this.#factory = _factory
            this.#bots = _obj?.bots ?? [] // array of ids
        }
        async init(){
            /* create evolver (exclude MyLife) */
            // @todo: admin interface for modifying MyLife avatar and their bots
            this.#bots = await this.factory.bots(this.id)
            let _activeBot = this.avatarBot
            if(!this.factory.isMyLife){
                if(!_activeBot.id){ // create: but do not want to call setBot() to activate
                    _activeBot = await mBot(this)
                    this.#bots.unshift(_activeBot)
                }
                this.activeBotId = _activeBot.id
                this.#evolver = new EvolutionAssistant(this)
                mAssignEvolverListeners(this.#evolver, this)
                /* init evolver */
                await this.#evolver.init()
            } else { // Q-specific
                this.activeBotId = this.avatarBot.id
                this.avatarBot.bot_id = (process.env.OPENAI_MAHT_GPT_OVERRIDE) ? process.env.OPENAI_MAHT_GPT_OVERRIDE : this.avatarBot.bot_id
                let _conversation = await this.getConversation()
                this.avatarBot.thread_id = _conversation.threadId
            }
            this.emit('avatar-init-end',this)
            return this
        }
        /* public functions */
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
         * Proxy for emitter.
         * @public
         * @param {string} _eventName - The event to emit.
         * @param {any} - The event(s) to emit.
         * @returns {void}
         */
        emit(_eventName, ...args){
            this.#emitter.emit(_eventName, ...args)
        }
        async getAssistant(_dataservice){	//	openai `assistant` object
            // @todo: move to modular function and refine instructions as other bots
            if(!this.assistant?.id.length) {
                this.assistant = await mAI_openai(this.#openai, {
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
                this.assistant = await mGetAssistant(this.#openai, this.assistant.id)
            }
            return this.assistant
        }
        async getConversation(_thread_id){ // per bot
            let _conversation = this.#conversations.find(_=>_.thread?.id===_thread_id)
            if(!_thread_id || !_conversation){
                _conversation = new (this.factory.conversation)({ mbr_id: this.mbr_id}, this.factory)
                await _conversation.init(_thread_id)
                this.#conversations.push(_conversation)
            }
            return _conversation
        }
        on(_eventName, listener){
            this.#emitter.on(_eventName, listener)
        }
        /**
         * Processes and executes incoming category set request.
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
        /* getters/setters */
        /**
         * Get the active bot. If no active bot, return this as default chat engine.
         * @public
         * @returns {object} - The active bot.
         */
        get activeBot(){
            return this.#bots.find(_bot=>_bot.id===this.activeBotId)
        }
        get aiId(){
            return this.conversation[0]
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
            return this.#openai
        }
        get avatar(){
            return this.inspect(true)
        }
        get avatarBot(){
            return this.#bots.find(_bot=>_bot.type==='personal-avatar')
        }
        /**
         * Get the "avatar's" being, or more precisely the name of the being (affiliated object) the evatar is emulating.
         * Avatars are special case and are always avatars, so when we query them non-internally for system purposes (in which case we understand we need to go directly to factory.core.being) we display the underlying essence of the datacore; could put this in its own variable, but this seems protective _and_ gives an access point for alterations.
         * @returns {string} The object being the avatar is emulating.
        */
        get being(){    //  
            return this.#proxyBeing
        }
        get bots(){
            return this.#bots
        }
        get category(){
            return this.#activeChatCategory
        }
        set category(_category){
            this.#activeChatCategory = _category
        }
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
        // todo: deprecate to available convenience public emit() function
        get emitter(){  //  allows parent to squeeze out an emitter
            return this.#emitter
        }
        // @todo: return factory privacy
        get factory(){
            return this.#factory
        }
        get globals(){
            return this.factory.globals
        }
        get mbr_id(){
            return this.factory.mbr_id
        }
        get mbr_id_id(){
            return this.mbr_sysId
        }
        get mbr_name(){
            return this.mbr_sysName
        }
        get mbr_sysId(){
            return this.globals.sysId(this.mbr_id)
        }
        get mbr_sysName(){
            return this.globals.sysName(this.mbr_id)
        }
        get memberFirstName(){
            return this.memberName.split(' ')[0]
        }
        get memberName(){
            return this.factory.memberName
        }
        /**
         * Get uninstantiated class definition for message.
         * @returns {class} - class definition for message
         */
        get message(){
            return this.factory.message
        }
    }
    console.log('Avatar class extended')
    return Avatar
}
function extendClass_consent(_originClass,_references) {
    class Consent extends _originClass {
        constructor(_obj) {
            super(_obj)
        }
        //  public functions
        async allow(_request){
            //	this intends to evolve in near future, but is currently only a pass-through with some basic structure alluding to future functionality
            return true
        }
    }

    return Consent
}
function extendClass_contribution(_originClass,_references) {
    class Contribution extends _originClass {
        #emitter = new EventEmitter()
        #factory
        #openai = _references?.openai
        constructor(_obj) {
            super(_obj)
        }
        /* public functions */
        /**
         * Initialize a contribution.
         * @async
         * @public
         * @param {object} _factory - The factory instance.
         */
        async init(_factory){
            this.#factory = _factory
            this.request.questions = await mGetQuestions(this, this.#openai) // generate question(s) from cosmos or openAI
            this.id = this.factory.newGuid
            this.status = 'prepared'
            this.emit('on-contribution-new',this)
            return this
        }
        async allow(_request){
            //	todo: evolve in near future, but is currently only a pass-through with some basic structure alluding to future functionality
            return true
        }
        /**
         * Convenience proxy for emitter.
         * @param {string} _eventName - The event to emit.
         * @param {any} - The event(s) to emit.
         * @returns {void}
         */
        emit(_eventName, ...args){
            this.#emitter.emit(_eventName, ...args)
        }
        /**
         * Convenience proxy for listener.
         * @param {string} _eventName - The event to emit.
         * @param {function} _listener - The event listener functionality.
         * @returns {void}
         */
        on(_eventName, _listener){
            this.#emitter.on(_eventName, _listener)
        }
        /**
         * Updates `this` with incoming contribution data.
         * @param {object} _contribution - Contribution data to incorporate 
         * @returns {void}
         */
        update(_contribution){
            mUpdateContribution(this, _contribution) // directly modifies `this`, no return
        }
        /*  getters/setters */
        /**
         * Get the factory instance.
         * @returns {object} MyLife Factory instance
         */
        get factory(){
            return this.#factory
        }
        get memberView(){
            return this.inspect(true)
        }
        get openai(){
            return this.#openai
        }
        get questions(){
            return this?.questions??[]
        }
        /* private functions */
    }

    return Contribution
}
function extendClass_conversation(_originClass,_references) {
    class Conversation extends _originClass {
        // @todo: convert parent_id -> object_id
        #factory
        #messages = []
        #openai = _references?.openai
        #saved = false
        #thread
        constructor(_obj, _factory) {
            super(_obj)
            this.#factory = _factory
        }
        async init(_thread_id){
            this.#thread = await mInvokeThread(this.#openai, _thread_id)
            this.name = `conversation_${this.#factory.mbr_id}_${this.thread_id}`
        }
        //  public functions
        async addMessage(_chatMessage){
            const _message = (_chatMessage.id?.length)
                ?   _chatMessage
                :   await ( new (this.#factory.message)(_chatMessage) ).init(this.thread)
            this.#messages.unshift(_message)
        }
        findMessage(_message_id){
            //  given this conversation, retrieve message by id
            return this.messages.find(_msg=>_msg.id===_message_id)
        }
        async getMessage(_msg_id){	//	returns openai `message` object
            return this.messages
                .filter(_msg=>{ return _msg.id==_msg_id })
        }
        async getMessages_openai(){ // refresh from opanAI
            return ( await mMessages(this.#openai, this.thread_id) )
                .data
        }
        async save(){
            // also if this not saved yet, save to cosmos
            if(!this.isSaved){
                await mSaveConversation(this.#factory, this)
            }
            //  save messages to cosmos
            // @todo: no need to await
            await this.#factory.dataservices.patch(
                this.id,
                { messages: this.messages.map(_msg=>_msg.micro), }
            )
            // flag as saved
            this.#saved = true
            return this
        }
        //  public getters/setters
        get isSaved(){
            return this.#saved
        }
        get messages(){
            return this.#messages
        }
        get thread(){
            return this.#thread
        }
        get thread_id(){
            return this.threadId
        }
        get threadId(){
            return this.thread.id
        }
        //  private functions
        async #add(){
            //  add to cosmos
            return this
        }
    }
    return Conversation
}
function extendClass_file(_originClass,_references) {
    class File extends _originClass {
        #contents   //  utilized _only_ for text files
        constructor(_obj) {
            super(_obj)
        }
        //  public functions
        async init(){
            //  self-validation
            if(!this.contents && this.type=='text')
                throw new Error('No contents provided for text file; will not store')
            //  save to embedder
        }
        //  public getters/setters
        //  private functions
    }
    return File
}
function extendClass_message(_originClass,_references) {
    /**
     * Message class.
     * @class
     * @extends _originClass - variable that defines the _actual_ class to extend, here message.
     * @param {object} _obj - The object to construct the message from..
     */
    class Message extends _originClass {
        #maxContextWindow = Math.min((process.env.OPENAI_MAX_CONTEXT_WINDOW || 2000), 5000)    //  default @2k chars, hard cap @5k
        #message
        #openai = _references?.openai
        constructor(_obj) {
            super(_obj)
            /* category population */
            if(!_obj.content) mAssignContent(this, _obj)
        }
        /* public functions */
        async init(_thread){ // only required if user message
            if((!this.content & !this.files)||!_thread)
                throw new Error('Insufficient data provided for message init()')
            /* todo: limit requirements for context window, generate file and attach to file_ids array
            if(this.content.length > this.#maxContextWindow) {
                //  TODO: generate file and attach to file_ids array
                throw new Error('unimplemented')
                const _file = await this.#constructFile(this.content)
                this.files.push(_file)
                this.content = `user posted content length greater than context window: find request in related file, file_id: ${_file.id}`      //   default content points to file
            }*/
            this.#message = await mGetMessage(
                this.#openai,
                _thread,
                this.content,
                this.message?.id,
            )
            return this
        }
        /* getters/setters */
        get message(){
            return this.#message
        }
        get micro(){
            return { content: this.content, role: this.role??'user' }
        }
        get text(){
            switch (this.type) {
                case 'chat':
                    switch (this.system) {
                        case 'openai_assistant':
                            return this.message.content[0].text.value
                        default:
                            break
                    }
                default:
                    return 'no content derived'
            }
        }
        /* private functions */
        /**
         * When incoming text is too large for a single message, generate dynamic text file and attach/submit.
         * @private
         * @param {string} _file - The file to construct.
         * @returns 
         */
        async #constructFile(_file){
            //  construct file object
            const __file = new (this.factory.file)({
                name: `file_message_${this.id}`,
                type: 'text',
                contents: _file,
            })
            //  save to embedder
            return {
                name: __file.name,
                type: __file.type,
                contents: await __file.arrayBuffer(),
            }
        }
    }
    return Message
}
/* exports */
export {
	extendClass_avatar,
	extendClass_consent,
    extendClass_contribution,
    extendClass_conversation,
    extendClass_file,
	extendClass_message,
}