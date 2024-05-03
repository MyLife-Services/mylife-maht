import { EventEmitter } from 'events'
import {
    mGetQuestions,
    mUpdateContribution,
} from './class-contribution-functions.mjs'
import {
    mSaveConversation,
} from './class-conversation-functions.mjs'
import{
    mAppear,
    mDialog,
    mGetEvent,
    mInput,
    mGetScene,
    mGetSceneNext,
} from './class-experience-functions.mjs'
import {
	mAssignContent,
} from './class-message-functions.mjs'
/**
 * Extends the `Consent` class.
 * @todo - global conversion of parent_id -> object_id
 * @param {*} originClass - The class to extend.
 * @param {Object} referencesObject - The references to extend the class with, factory, llm, etc.
 * @returns {Consent} - The extended class definition.
 */
function extendClass_consent(originClass, referencesObject) {
    class Consent extends originClass {
        constructor(obj) {
            super(obj)
        }
        //  public functions
        async allow(_request){
            //	this intends to evolve in near future, but is currently only a pass-through with some basic structure alluding to future functionality
            return true
        }
    }
    return Consent
}
/**
 * Extends the `Contribution` class.
 * @param {*} originClass - The class to extend.
 * @param {Object} referencesObject - The references to extend the class with, factory, llm, etc.
 * @returns {Contribution} - The `Contribution` extended class definition.
 */
function extendClass_contribution(originClass, referencesObject) {
    class Contribution extends originClass {
        #emitter = new EventEmitter()
        #factory
        #llm = referencesObject?.openai
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
            this.request.questions = await mGetQuestions(this, this.#llm) // generate question(s) from cosmos or openAI
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
            return this.#llm
        }
        get questions(){
            return this?.questions??[]
        }
        /* private functions */
    }
    return Contribution
}
/**
 * Extends the `Conversation` class.
 * @param {*} originClass - The class to extend.
 * @param {Object} referencesObject - The references to extend the class with, factory, llm, etc.
 * @returns {Conversation} - The `Conversation` extended class definition.
 */
function extendClass_conversation(originClass, referencesObject) {
    class Conversation extends originClass {
        #botId
        #factory
        #messages = []
        #saved = false
        #thread
        /**
         * 
         * @param {Object} obj - The object to construct the conversation from.
         * @param {AgentFactory} factory - The factory instance.
         * @param {Object} thread - The thread instance.
         * @param {Guid} botId - The initial active bot id (can mutate)
         */
        constructor(obj, factory, thread, botId) {
            super(obj)
            this.#factory = factory
            this.#thread = thread
            this.#botId = botId
            this.name = `conversation_${this.#factory.mbr_id}_${thread.thread_id}`
            this.type = this.type??'chat'
        }
        /* public functions */
        /**
         * Adds a `Message` instances to the conversation.
         * @public
         * @param {Object|Message} message - Message instance or object data to add.
         * @returns {Object[]} - The updated messages array.
         */
        addMessage(message){
            if(this.messages.find(_message=>_message.id===message.id))
                return this.messages
            if(!(message instanceof this.#factory.message)){
                if(typeof message!=='object')
                    message = { content: message }
                message = new (this.#factory.message)(message)
            }
            this.#messages = [message, ...this.messages]
            return this.messages
        }
        /**
         * Adds an array of `Message` instances to the conversation.
         * @public
         * @param {Object[]} messages - Array of messages to add.
         * @returns {Object[]} - The updated messages array.
         */
        addMessages(messages){
            messages
                .sort((mA, mB) => mA.created_at - mB.created_at)
                .forEach(message => this.addMessage(message))
            return this.messages
        }
        /**
         * Get the message by id, or defaults to last message added.
         * @public
         * @param {Guid} messageId - The message id.
         * @returns {object} - The openai `message` object.
         */
        async getMessage(messageId){
            return messageId && this.messages?.[0]?.id!==messageId
                ? this.messages.find(message=>message.id===messageId)
                : this.message
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
        get bot_id(){
            return this.#botId
        }
        get botId(){
            return this.bot_id
        }
        set botId(_botId){
            this.#botId = _botId
        }
        get isSaved(){
            return this.#saved
        }
        /**
         * Get the most recently added message.
         * @getter
         * @returns {Message} - The most recent message.
         */
        get message(){
            return this.messages[0]
        }
        get messages(){
            return this.#messages
        }
        /**
         * Gets most recent dialog contribution to conversation.
         * @getter
         * @returns {object} - Most recent facet of dialog from conversation.
         */
        get mostRecentDialog(){
            return this.message.content
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
/**
 * Extends the `Experience` class.
 * @param {*} originClass - The class to extend.
 * @param {Object} referencesObject - The references to extend the class with, factory, llm, etc.
 * @returns {Experience} - The `Experience` extended class definition.
 */
function extendClass_experience(originClass, referencesObject){
    class Experience extends originClass {
        #cast = []
        constructor(obj) {
            super(obj)
        }
        /* public functions */
        /**
         * Initialize the experience.
         * @todo - implement building classes either on-demand or on-init to create scene and event classes
         * @returns {Experience} - The initialized experience.
         */
        init(){
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
            return this
        }
        /**
         * From specified event, returns `synthetic` Dialog data package, see `mDialog` in `class-experience-functions.mjs`.
         * @param {Guid} eventId - The event id.
         * @param {number} iteration - The iteration number, array-variant.
         * @returns {object} - `synthetic` Dialog data package.
         */
        dialogData(eventId, iteration=0){
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
        sceneNext(sceneId){
            return mGetSceneNext(this.scenes, sceneId)
        }
        /* getters/setters */
        /**
         * Get the cast of the experience.
         * @getter
         * @returns {ExperienceCastMember[]} - The array of cast members.
         */
        get castMembers(){
            return this.cast.map(castMember=>{
                const { bot_id, icon, id, name, role, type, url, } = castMember
                return { bot_id, icon, id, name, role, type, url, }
            })
        }
        /**
         * Get the experience in frontend format. Currently intentionally omitting manifest, grab separately, they are not "required". Scenes and events are only required in `eventSequences`.
         * @getter
         * @returns {object} - The `synthetic` experience object.
         */
        get experience(){
            const { autoplay, description, goal, id, location, purpose, skippable, title, version } = this
            return {
                autoplay,
                description,
                goal,
                id,
                location,
                purpose,
                skippable,
                title,
                version: version ?? 0,
            }
        }
        /**
         * Get the manifest of the experience.
         * @getter
         * @returns {object} - The manifest of the experience.
         * @property {array} cast - The cast array of the experience.
         * @property {object} navigation - The navigation object of the experience.
         */
        get manifest(){
            return {
                cast: this.castMembers,
                navigation: this.navigation,
            }
        }
    }
    return Experience
}
/**
 * Extends the `File` class.
 * @param {*} originClass - The class to extend.
 * @param {Object} referencesObject - The references to extend the class with, factory, llm, etc.
 * @returns {File} - The `File` extended class definition.
 */
function extendClass_file(originClass, referencesObject) {
    class File extends originClass {
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
/**
 * Extends the `Message` class.
 * @param {*} originClass - The class to extend.
 * @param {Object} referencesObject - The references to extend the class with, factory, llm, etc.
 * @returns {Message} - The `Message` extended class definition.
 */
function extendClass_message(originClass, referencesObject) {
    /**
     * Message class.
     * @class
     * @extends originClass - variable that defines the _actual_ class to extend, here message.
     * @param {object} obj - The object to construct the message from..
     */
    class Message extends originClass {
        #content
        constructor(obj) {
            const { content, ..._obj } = obj
            super(_obj)
            try{
                this.#content = mAssignContent(content ?? obj)
            } catch(e){
                console.log('Message::constructor::ERROR', e)
                this.#content = ''
            }
        }
        /* getters/setters */
        get content(){
            return this.#content
        }
        set content(_content){
            try{
                this.#content = mAssignContent(_content)
            } catch(e){
                console.log('Message::content::ERROR', e)
            }
        }
        get message(){
            return this
        }
        get micro(){
            return { content: this.content, role: this.role??'user' }
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