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
	assignContent,
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
        #bot_id
        #factory
        #messages = []
        #saved = false
        #thread
        #threads = new Set()
        /**
         * 
         * @param {Object} obj - The object to construct the conversation from.
         * @param {AgentFactory} factory - The factory instance.
         * @param {Object} thread - The thread instance.
         * @param {Guid} bot_id - The initial active bot id (can mutate)
         */
        constructor(obj, factory, thread, bot_id){
            super(obj)
            this.#factory = factory
            this.#thread = thread
            if(factory.globals.isValidGuid(bot_id))
                this.#bot_id = bot_id
            this.form = this.form
                ?? 'system'
            this.name = `conversation_${this.#factory.mbr_id}`
            this.type = this.type
                ?? 'chat'
        }
        /* public functions */
        /**
         * Adds a `Message` instances to the conversation.
         * @public
         * @param {Object|Message} message - Message instance or object data to add.
         * @returns {Object[]} - The updated messages array.
         */
        addMessage(message){
            console.log('class-extenders::addMessage', message)
            const { id, } = message
            if(this.#messages.find(message=>message.id===id))
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
            const now = Date.now()
            messages
                .sort((mA, mB) => ( mA.created_at ?? now ) - ( mB.created_at ?? now ))
                .forEach(message => this.addMessage(message))
            return this.messages
        }
        /**
         * Adds a thread id to the conversation archive
         * @param {string} thread_id - The thread id to add
         * @returns {void}
         */
        addThread(thread_id){
            this.#threads.add(thread_id)
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
        /**
         * Removes a thread id from the conversation archive
         * @param {string} thread_id - The thread id to remove
         * @returns {void}
         */
        removeThread(thread_id){
            this.#threads.delete(thread_id)
        }
        /**
         * Sets the thread instance for the conversation.
         * @param {object} thread - The thread instance
         * @returns {void}
         */
        setThread(thread){
            const { id: thread_id, } = thread
            if(thread_id?.length && thread_id!=this.thread_id){
                this.#threads.add(this.thread_id)
                this.#thread = thread
            }
        }
        /**
         * Saves the conversation to the MyLife Database.
         * @async
         * @returns {void}
         */
        async save(){
            this.#saved = await mSaveConversation(this.#factory, this)
        }
        //  public getters/setters
        /**
         * Get the id {Guid} of the conversation's bot.
         * @getter
         * @returns {Guid} - The bot id.
         */
        get botId(){
            return this.#bot_id
        }
        get bot_id(){
            return this.#bot_id
        }
        /**
         * Set the id {Guid} of the conversation's bot.
         * @setter
         * @param {Guid} bot_id - The bot id.
         * @returns {void}
         */
        set botId(bot_id){
            if(!this.#factory.globals.isValidGuid(bot_id))
                throw new Error(`Invalid bot_id: ${ bot_id }`)
            this.#bot_id = bot_id
        }
        set bot_id(bot_id){
            if(!this.#factory.globals.isValidGuid(bot_id))
                throw new Error(`Invalid bot_id: ${ bot_id }`)
            this.#bot_id = bot_id
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
        set thread(thread){
            this.setThread(thread)
        }
        get thread_id(){
            return this.thread.id
        }
        get threadId(){
            return this.thread_id
        }
        get threads(){
            return this.#threads
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
        constructor(obj){
            const { content, ..._obj } = obj
            super(_obj)
            try{
                this.#content = assignContent(content ?? obj)
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
                this.#content = assignContent(_content)
            } catch(e){
                console.log('Message::content::ERROR', e)
            }
        }
        get message(){
            return this
        }
        /**
         * Get the message in micro format for storage.
         * @returns {object} - The message in micro format
         */
        get micro(){
            return {
                content: this.content,
                created_at: this.created_at
                    ?? Date.now(),
                id: this.id,
                role: this.role
                    ?? 'system'
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