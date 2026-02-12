import {
    mSaveConversation,
} from './class-conversation-functions.mjs'
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
 * Extends the `Conversation` class.
 * @param {*} originClass - The class to extend.
 * @param {Object} referencesObject - The references to extend the class with, factory, llm, etc.
 * @returns {Conversation} - The `Conversation` extended class definition.
 */
function extendClass_conversation(originClass, referencesObject){
    class Conversation extends originClass {
        #activeExchangeId
        #bot_id
        #factory
        #exchanges = new Set()   //  utilized for tracking exchanges related to conversation
        #form
        #id
        #llm_id
        #mbr_id
        #messages = []
        #saved = false
        #thread
        #threads = new Set()
        #type
        /**
         * Constructor for Conversation class.
         * @param {Object} obj - Data object for construction
         * @param {AgentFactory} factory - The factory instance
         * @param {Guid} botId - The initial active bot MyLife `id`
         * @param {String} llm_id - The initial active LLM `id`
         * @param {Object} thread - The related thread instance
         * @returns {Conversation} - The constructed conversation instance
         */
        constructor(obj, factory, botId, llm_id, thread){
            const {
                form='system-avatar',
                mbr_id,
                type='chat',
                ..._obj
            } = obj
            super(_obj)
            this.#factory = factory
            this.#thread = thread
            this.#bot_id = botId
            this.#form = form
            this.#id = this.#factory.newGuid
            this.#llm_id = llm_id
            this.#mbr_id = mbr_id
                ?? this.#factory.mbr_id
            this.name = `conversation_${ this.#mbr_id }`
            this.#type = type
        }
        /* public functions */
        /**
         * Adds a `Message` instances to the conversation.
         * @public
         * @param {Object|Message} message - Message instance or object data to add.
         * @returns {Object[]} - The updated messages array.
         */
        addMessage(message){
            const { id, } = message
            if(this.#messages.find(message=>message.id===id))
                return this.messages
            if(!(message instanceof this.#factory.message)){
                if(typeof message!=='object')
                    message = { content: message, }
                message = new (this.#factory.message)(message)
                if(this.exchangeId?.length)
                    message.exchangeId = this.exchangeId
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
            messages.forEach(message => this.addMessage(message))
            return this.messages
        }
        /**
         * Adds a conversation id to the conversation archive
         * @param {string} conversation_id - The conversation id to add to thread
         * @returns {void}
         */
        addThread(conversation_id){
            this.#threads.add(conversation_id)
        }
        /**
         * Starts an exchange within the conversation by exchange id, or defaults to new guid
         * @param {string} exchangeId - The exchange id (uuid) to start, or defaults to new guid if not provided
         * @returns {void}
         */
        exchangeStart(exchangeId = this.#factory.newGuid){
            this.#activeExchangeId = exchangeId
            this.#exchanges.add(exchangeId)
        }
        /**
         * Get the message by id, or defaults to last message added.
         * @public
         * @param {Guid} messageId - The message id
         * @returns {Message} - The `Message` instance
         */
        getMessage(messageId){
            const Message = messageId?.length
                ? this.getMessages().find(message=>message.id===messageId)
                : this.message
            return Message
        }
        /**
         * Get the messages for the conversation.
         * @public
         * @param {boolean} agentOnly - Whether or not to get only agent messages
         * @param {boolean} currentExchangeOnly - Whether or not to get only messages from the current exchange; defaults to `false` will return all exchanges
         * @param {string} conversation_id - The conversation id to get messages for (optional)
         * @param {string} exchangeId - The exchange id to get messages for (optional)
         * @param {boolean} chronological - Whether or not to return messages in chronological order, defaults to `true`, oldest first
         * @returns {Message[]} - The messages array
         */
        getMessages(agentOnly=true, currentExchangeOnly=false, conversation_id, exchangeId, chronological=true){
            let messages = this.messages
            if(agentOnly)
                messages = messages.filter(message=>['member', 'user'].indexOf(message.role) < 0)
            if(currentExchangeOnly)
                if(this.#activeExchangeId?.length)
                    messages = messages.filter(message=>message.exchangeId===this.exchangeId)
                else if(this.#exchanges.size)
                    messages = messages.filter(message=>message.exchangeId===[...this.#exchanges][this.#exchanges.size-1]) // get last <uuid> in set
            if(conversation_id?.length)
                messages = messages.filter(message=>message.thread_id===conversation_id)
            if(exchangeId?.length)
                messages = messages.filter(message=>message.exchangeId===exchangeId)
            if(chronological)
                messages = messages.sort((a, b) => a.created_at - b.created_at)
            return messages
        }
        /**
         * Removes a thread id from the conversation archive
         * @param {string} conversation_id - The conversation id to remove
         * @returns {void}
         */
        removeThread(conversation_id){
            this.#threads.delete(conversation_id)
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
            this.#saved = await mSaveConversation(this, this.#factory)
        }
        //  public getters/setters
        get bot_id(){
            return this.#bot_id
        }
        set bot_id(botId){
            if(!this.#factory.globals.isValidGuid(botId))
                throw new Error(`Invalid bot id: ${ botId }`)
            this.#bot_id = botId
        }
        get botId(){
            return this.bot_id
        }
        set botId(botId){
            this.bot_id = botId
        }
        get exchangeId(){
            return this.#activeExchangeId
        }
        get form(){
            return this.#form
        }
        get id(){
            return this.#id
        }
        /**
         * Whether or not the conversation has _ever_ been saved.
         * @getter
         * @returns {boolean} - Whether or not the conversation has _ever_ been saved
         */
        get isSaved(){
            return this.#saved
        }
        get llm_id(){
            return this.#llm_id
        }
        /**
         * Sets the `id` {String} of the conversation's active LLM.
         * @getter
         * @returns {String} - The llm id
         */
        set llm_id(llm_id){
            if(!llm_id?.length)
                this.#llm_id = llm_id
        }
        get mbr_id(){
            return this.#mbr_id
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
        get type(){
            return this.#type
        }
    }
    return Conversation
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
            _obj.created_at = _obj.created_at ?? Date.now()
            super(_obj)
            try{
                this.#content = assignContent(content ?? obj)
            } catch(e){
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
            } catch(e){}
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
    extendClass_conversation,
    extendClass_file,
	extendClass_message,
}