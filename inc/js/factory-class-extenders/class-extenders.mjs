import { EventEmitter } from 'events'
import { EvolutionAssistant } from '../agents/system/evolution-assistant.mjs'
import {
    mAssignEvolverListeners,
    mChat,
    mCreateAssistant,
    mGetAssistant,
    mGetChatCategory,
    mRuns,
 } from './class-avatar-functions.mjs'
import {
    mGetQuestions,
    mUpdateContribution,
} from './class-contribution-functions.mjs'
import {
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
        #activeChatCategory = mGetChatCategory()
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
        }
        async init(){
            /* create evolver (exclude MyLife) */
            if(!this.factory.isMyLife){
                this.#evolver = new EvolutionAssistant(this)
                mAssignEvolverListeners(this.#evolver, this)
                /* init evolver */
                await this.#evolver.init()
            }
            this.emit('avatar-init-end',this)
            return this
        }
        /* public functions */
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
         * Processes and executes incoming chat request.
         * @public
         * @param {object} ctx - The context object.
         * @returns {object} - The response(s) to the chat request.
        */
        async chatRequest(ctx){
            if(!ctx?.state?.chatMessage)
                throw new Error('No message provided in context')
            this.setActiveCategory(ctx.state.chatMessage) // also sets evolver contribution
            const _chat = await mChat(
                this.#openai,
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
            //	3 states: 1) no assistant, 2) assistant id, 3) assistant object
            if(!this.assistant?.id.length) {
                this.assistant = await mCreateAssistant(this.#openai, this)
                //	save id to cosmos
                _dataservice.patch(this.id, {
                    assistant: {
                        id: this.assistant.id
                    ,	object: 'assistant'
                    }
                })
            } else if(!this.assistant?.name?.length){
                this.assistant = await mGetAssistant(this.#openai, this.assistant.id)
            }
            return this.assistant
        }
        async getConversation(_thread_id){
            if(!_thread_id){ // add new conversation
                return await this.setConversation()
            }
            return this.#conversations.find(_=>_.thread?.id===_thread_id)
        }
        async setConversation(_conversation){
            if(!_conversation){
                _conversation = new (this.factory.conversation)({ mbr_id: this.mbr_id}, this.factory)
                await _conversation.init()
                this.#conversations.push(_conversation)
            } else {
// @todo: add update version
            }
            return _conversation
        }
        on(_eventName, listener){
            this.#emitter.on(_eventName, listener)
        }
        /* getters/setters */
        get avatar(){
            return this.inspect(true)
        }
        /**
         * Get the "avatar's" being, or more precisely the name of the being (affiliated object) the evatar is emulating.
         * Avatars are special case and are always avatars, so when we query them non-internally for system purposes (in which case we understand we need to go directly to factory.core.being) we display the underlying essence of the datacore; could put this in its own variable, but this seems protective _and_ gives an access point for alterations.
         * @returns {string} The object being the avatar is emulating.
        */
        get being(){    //  
            return this.#proxyBeing
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
         * Get uninstantiated class definition for conversation.
         * @returns {class} - class definition for conversation
         */
        get conversation(){
            return this.factory.conversation
        }
        // todo: deprecate to available convenience public emit() function
        get emitter(){  //  allows parent to squeeze out an emitter
            return this.#emitter
        }
        get factory(){
            return this.#factory
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
        #factory
        #messages = []
        #openai = _references?.openai
        #saved = false
        #thread
        constructor(_obj, _factory) {
            super(_obj)
            this.#factory = _factory
        }
        async init(){
            this.#thread = await this.invokeThread()
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
        async invokeThread(){
            return await this.#openai.beta.threads.create()
        }    
        async save(){
            // also if this not saved yet, save to cosmos
            if(!this.isSaved){
                await mSaveConversation(this.#factory, this)
            }
            //  save messages to cosmos
            await this.#factory.dataservices.patchArrayItems( // no need to await
                this.id,
                'messages',
                this.messages.map(_msg=>_msg.micro),
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