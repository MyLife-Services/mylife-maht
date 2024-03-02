import { EventEmitter } from 'events'
import {
    mGetQuestions,
    mUpdateContribution,
} from './class-contribution-functions.mjs'
import {
    mInvokeThread,
    mMessages,
    mSaveConversation,
} from './class-conversation-functions.mjs'
import{
    mAppear,
    mDialog,
    mGetEvent,
    mInput,
    mGetScene,
} from './class-experience-functions.mjs'
import {
    mGetMessage,
	mAssignContent,
} from './class-message-functions.mjs'
import { _ } from 'ajv'
import { parse } from 'path'
import { Guid } from 'js-guid'
//  function definitions to extend remarkable classes
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
            this.type = this.type??'chat'
        }
        //  public functions
        async addMessage(_chatMessage){
            const _message = (_chatMessage.id?.length)
                ?   _chatMessage
                :   await ( new (this.#factory.message)(_chatMessage) ).init(this.thread)
             this.messages.unshift(_message)
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
    }
    return Conversation
}
function extendClass_experience(_originClass, _references){
    class Experience extends _originClass {
        #experienceVariables = {}
        constructor(_obj) {
            super(_obj)
        }
        /* public functions */
        /**
         * Initialize the experience.
         * @todo - implement building classes either on-demand or on-init to create scene and event classes
         * @param {object} experienceVariables - The experience variables to initialize with.
         * @returns {Experience} - The initialized experience.
         */
        init(experienceVariables={}){
            /* self-validation */
            if(!this.scenes || !this.scenes.length)
                throw new Error('No scenes provided for experience')
            /* sort scenes/events by order in place */
            this.scenes.sort((_a, _b)=>(_a?.order??0)-(_b.order??0))
            this.scenes.forEach(_scene=>{
                if(!_scene.events || !_scene.events.length)
                    throw new Error('No events provided for scene')
                _scene.events.sort((_a, _b)=>(_a?.order??0)-(_b.order??0))
            })
            this.experienceVariables = this.variables.reduce((obj, keyName) => {
                obj[keyName] = undefined
                return obj
            }, {}) // turn array this.variables into object with key[name from array]/value[undefined]
            this.experienceVariables = experienceVariables
            return this
        }
        /**
         * From specified event, returns `synthetic` Dialog data package, see `mDialog` in `class-experience-functions.mjs`.
         * @param {Guid} eventId - The event id.
         * @param {number} iteration - The iteration number, array-variant.
         * @returns {object} - `synthetic` Dialog data package.
         */
        dialog(eventId, iteration=0){
            return mDialog(this.event(eventId), iteration)
        }
        /**
         * Gets a specified event from the experience. Throws error if not found.
         * @param {Array} scenes - The array of scenes to search.
         * @param {Guid} eventId - The event id.
         * @returns {object} - The event object data.
         * @throws {Error} - If event not found.
         */
        event(eventId){
            return mGetEvent(this.scenes, eventId)
        }
        /**
         * From specified event, returns `synthetic` Input data package, see `mInput` in `class-experience-functions.mjs`.
         * @param {Guid} eventId - The event id.
         * @param {number} iteration - The iteration number, array-variant.
         * @returns {object} - `synthetic` Input data package.
         */
        input(eventId, iteration=0){
            return mInput(this.event(eventId), iteration)
        }
        /**
         * Gets a specified scene from the experience. Throws error if not found.
         * @param {Guid} sceneId 
         * @returns {object} - The scene object data.
         */
        scene(sceneId){
            return mGetScene(this.scenes, sceneId)
        }
        /* getters/setters */
        /**
         * Get the experience variables.
         * @getter
         * @returns {object} - The experience variables object.
         */
        get experienceVariables(){
            return this.#experienceVariables
        }
        /**
         * Set the experience variables.
         * @setter
         * @param {object} obj - The object to set the experience variables to, ergo can have any number of properties.
         * @returns {void}
         */
        set experienceVariables(obj){
            this.#experienceVariables = { ...this.#experienceVariables, ...obj }
        }
    }
    return Experience
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
            if(!_obj?.content) mAssignContent(this, _obj)
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
	extendClass_consent,
    extendClass_contribution,
    extendClass_conversation,
    extendClass_experience,
    extendClass_file,
	extendClass_message,
}