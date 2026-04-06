/* imports */
import { EventEmitter } from 'events'
/* module constants */
const mAvailableForms = ['entry', 'memory'],
    mBeing = `story`,
    mShareGratitude = `Thank you for letting us share this narrative with you! I hope you enjoyed it as much as I did.`,
    mShareScopes = ['group', 'members', 'private', 'public'],
    mVersion = 1.00
/**
 * @class - Consent
 * @extends EventEmitter
 * @description A `Consent` is a class that represents a consent object in the datacore or vectorstore, referenced by a consent-agent intelligence to inform outgoing processes on whether the content suggested in the request or response is allowable.
 */
class Consent extends EventEmitter {
    constructor(obj) {
        super()
        Object.assign(this, obj)
    }
    //  public functions
    async allow(_request){
        //	this intends to evolve in near future, but is currently only a pass-through with some basic structure alluding to future functionality
        return true
    }
}
class Conversation extends EventEmitter {
    #activeExchangeId
    #being='chat'
    #bot_id
    #exchanges = new Set() //  utilized for tracking exchanges related to conversation
    #factory
    #form
    #id
    #llmProvider
    #mbr_id
    #messages = []
    #saved = false
    #thread
    #threads = new Set()
    #type
    constructor(obj, factory, botId, llmProvider, thread){
        if(!factory || !llmProvider)
            throw new Error('Factory and LLM properties required')
        super()
        const {
            form='system-avatar',
            id,
            mbr_id,
            type='chat',
            ..._obj
        } = obj
        this.#factory = factory
        this.#thread = thread
        this.#bot_id = botId
        this.#form = form
        this.#id = id
            ?? this.#factory.newGuid
        this.#llmProvider = llmProvider
        this.#mbr_id = mbr_id
            ?? this.#factory.mbr_id
        this.name = `conversation_${ this.#mbr_id }_${ this.#id }`
        this.#type = type
        Object.assign(this, _obj)
    }
    /* public functions */
    /**
     * Adds a `Message` instances to the conversation.
     * @public
     * @param {Object|Message} message - Message instance or object data to add
     * @returns {Object[]} - The updated messages array
     */
    addMessage(message){
        const { id, } = message
        if(this.#messages.find(message=>message.id===id))
            return this.messages
        if(!(message instanceof this.#factory.message)){
            if(typeof message!=='object')
                message = { content: message, }
            message.exchangeId = this.exchangeId
            message = new (this.#factory.message)(message)
        }
        this.#messages = [message, ...this.messages]
        return this.messages
    }
    /**
     * Adds an array of `Message` instances to the conversation.
     * @public
     * @param {Object[]} messages - Array of messages to add
     * @returns {Object[]} - The updated messages array
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
    conversation(){
        return {
            bot_id: this.bot_id,
            id: this.#id,
            form: this.form,
            llm_id: this.llm_id,
            mbr_id: this.mbr_id,
            name: this.name,
            thread: this.thread,
            type: this.type,
        }
    }
    /**
     * Starts an exchange within the conversation by exchange id, or defaults to new guid
     * @param {string} exchangeId - The exchange id (uuid) to start, or defaults to new guid if not provided
     * @returns {void}
     */
    exchangeStart(exchangeId=this.#factory.newGuid){
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
    /* public getters/setters */
    get being(){
        return this.#being
    }
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
    get isSaved(){ //Whether or not the conversation has _ever_ been saved
        return this.#saved
    }
    get llm_id(){
        return this.#llmProvider?.id
    }
    set llm_id(llm_id){
        if(!llm_id?.length)
            this.#llmProvider.id = llm_id
    }
    get llmProvider(){
        return this.#llmProvider
    }
    get mbr_id(){
        return this.#mbr_id
    }
    get message(){ // Get the most recently added message
        return this.messages[0]
    }
    get messages(){
        return this.#messages
    }
    get mostRecentDialog(){ // Gets most recent dialog contribution to conversation
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
/**
 * Message class
 * @class
 * @param {object} obj - The object to construct the message from
 */
class Message extends EventEmitter {
    #being='message'
    #content
    #role
    constructor(obj){
        super()
        const { content, message, role='system', ..._obj } = obj
        _obj.created_at = _obj.created_at
            ?? Date.now()
        Object.assign(this, _obj)
        try{
            this.#role = role
            this.#content = mAssignContent(content ?? message ?? obj)
        } catch(e){
            this.#content = ''
        }
    }
    /* getters/setters */
    get being(){
        return this.#being
    }
    get content(){
        return this.#content
    }
    set content(_content){
        try{
            this.#content = mAssignContent(_content)
        } catch(e){}
    }
    get message(){
        return this
    }
    get role(){
        return this.#role
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
            role: this.role,
        }
    }
}
/**
 * @class - File
 * @extends EventEmitter
 * @description A `File` is a class that represents a file in the datacore or vectorstore
 */
class File extends EventEmitter {
    #contents   //  utilized _only_ for text files
    constructor(_obj) {
        super()
        Object.assign(this, _obj)
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
/**
 * @class - Item
 * @extends EventEmitter
 * @description An `Item` is the root class for `story` beings in the datacore. `Story` currently is extended by `Memory` and `Entry` classes. These classes by design have access to private intelligence based upon incoming parameters or the initial generating request bot.
 */
class Item extends EventEmitter {
    #additionalProperties
    #availableForms = mAvailableForms
    #avatar
    #being
    #complete=false
    #created=Date.now()
    #form
    #id
    #lastSaved
    #llm_id
    #llmServices
    #mbr_id
    #summary
    #type
    #version
    /**
     * @constructor
     * @param {object} item - Data object (optional)
     * @param {Avatar} avatar - The Member Avatar instance
     * @param {LLMServices} llmServices - The LLM services object
     */
    constructor(item, avatar, llmServices){
        if(!avatar || !llmServices)
            throw new Error('Avatar and LLM services required')
        if(avatar.isMyLife)
            throw new Error('MyLife cannot create stories')
        if(!item?.summary?.length)
            throw new Error('Item requires a summary')
        super()
        this.#avatar = avatar
        this.#llmServices = llmServices
        item = this.#avatar.sanitize(item)
        const {
            being,
            complete,
            form,
            id=this.#avatar.newGuid,
            llm_id,
            mbr_id,
            summary='',
            type,
            version=mVersion,
            ...additionalProperties
        } = item
        this.#additionalProperties = additionalProperties
        this.#being = being
            ?? mBeing
        this.#form = form
        this.#id = id
        this.#llm_id = llm_id
        this.#mbr_id = avatar.mbr_id
        this.#summary = summary
        this.#type = type
        this.#version = version
        this.#avatar.populateObject(this, this.#additionalProperties)
    }
    /* public functions */
    async create(){
        await this.#avatar.itemCreate(this.item)
        this.#lastSaved = Date.now()
    }
    /**
     * Save the item to the datacore, and updates the next mechanical version.
     * @param {object} data - Data object describing fields to be saved (optional), defaults to allowable fields
     * @returns {Promise<void>}
     */
    async save(data=this.item){
        await this.#avatar.itemUpdate(data)
        this.updateVersion()
        this.#lastSaved = Date.now()
    }
    /**
     * Update the item with valid new data.
     * @param {object} data - Data object to update instance
     * @param {Boolean} save - Save the item after update, default: `true`
     * @returns {Promise<void>}
     */
    async update(data, save=true){
        delete data.itemId
        const immutableFields = ['being', 'id', 'llm_id', 'mbr_id', 'type']
        this.#avatar.populateObject(this, data, immutableFields)
        this.updateVersion()
        if(save)
            await this.save(data)
    }
    /**
     * Update the item version.
     * @param {boolean} system - Update the system version (default: true)
     * @returns {void}
     */
    updateVersion(system=true){
        if(system)
            this.#version += 0.10
        else
            this.#version = Math.floor(this.#version) + 1.0
    }
    /* getters/setters */
    get being(){
        return this.#being
    }
    get complete(){
        return this.#complete
    }
    get form(){
        return this.#form
    }
    get id(){
        return this.#id
    }
    get itemCore(){
        return {
            being: this.being,
            complete: this.complete,
            form: this.form,
            id: this.id,
            llm_id: this.llm_id,
            mbr_id: this.mbr_id,
            summary: this.summary,
            type: this.type,
            version: this.version,
        }
    }
    get item(){
        return {
            ...this.#additionalProperties,
            ...this.itemCore,
        }
    }
    get llm_id(){
        return this.#llm_id
    }
    get mbr_id(){
        return this.#mbr_id
    }
    get summary(){
        return this.#summary
    }
    set summary(value){
        if(typeof value==='string' && value?.length){
            this.#summary = value
            this.updateVersion()
        }
    }
    /**
     * Gets time since last object save in milliseconds.
     * @getter
     * @returns {number} - Time since last save
     */
    get unsavedDuration(){
        return Date.now()-(this.#lastSaved ?? this.#created)
    }
    get type(){
        return this.#type
    }
    set type(value){
        if(this.#availableForms.indexOf(value)!==-1)
            this.#type = value
    }
    get version(){
        return this.#version
    }
}
class Entry extends Item {
    #content
    constructor(item, avatar, llmServices){
        const { content, ..._item } = item
        _item.type = 'entry'
        super(_item, avatar, llmServices)
        this.#content = content
    }
    /* getters/setters */
    get itemCore(){
        return {
            ...super.itemCore,
            content: this.#content,
        }
    }
    get content(){
        return this.#content
    }
}
class Issue extends Item {
    #influences
    #issue
    constructor(item, avatar, llmServices){
        item.being = 'stance'
        item.type = 'issue'
        const { influences, issue, ..._item } = item
        super(_item, avatar, llmServices)
        this.#influences = influences
        this.#issue = issue
    }
    /* getters/setters */
    get itemCore(){
        return {
            ...super.itemCore,
            influences: this.#influences,
            issue: this.#issue,
        }
    }
    get influences(){
        return this.#influences
    }
    get issue(){
        return this.#issue
    }
}
class Memory extends Item {
    constructor(item, avatar, llmServices){
        item.type = 'memory'
        super(item, avatar, llmServices)
    }
}
/**
 * @class - Share
 * @extends EventEmitter
 * @description A `Share` is a class that represents a shared item in the datacore. This class represents the sharing of an `Item` within a given scope enum: [Group, Members, Private, Public].
 */
class Share extends EventEmitter {
    #acceptWarnings=false
    #anonymous
    #being='share'
    #characters
    #conclusion
    #conversation
    #currentScene // index of current scene in `scenes` array
    #group
    #guessable
    #guesses=0
    #header=false
    #id
    #initialized=false
    #instanceId
    #itemId
    #mbr_id
    #phaseOfLife
    #pov // point-of-view; enum: [1,2,3,4] **note** 4=first-person plural (we); first could reference personal pronouns
    #restrictions // NL requirements for viewing
    #scenes // array of scenes
    #scope // enum: [group, members, private, public]
    #summary // filled out in init()
    #title
    #type // enum: [entry, memory]
    #warnings
    #variables={} // variables (key/value) relevant to memory share
    #voice
    /**
     * @constructor
     * @param {object} share - The Share data core object
     * @returns {Share}
     */
    constructor(share){
        const { anonymous=true, conclusion, group, guessable=false, id, instanceId=this.id & Date.now().toString(), itemId, mbr_id, pov, restrictions, scope='private', title, type='memory', voice, } = share
        if(!mbr_id || !id || !itemId)
            throw new Error('Member and item id required')
        super()
        this.#anonymous = anonymous
        this.#conclusion = conclusion
        this.#guessable = guessable
        this.#group = group
        this.#id = id
        this.#instanceId = instanceId
        this.#itemId = itemId
        this.#mbr_id = mbr_id
        this.#pov = pov
        this.#restrictions = restrictions
        this.#scope = scope
        this.#restrictions = restrictions
        this.#title = title
        this.#type = type
        this.#voice = voice
        return this
    }
    /* private functions */
    #sceneExists(){
        return this.#currentScene < this.scenes.length
    }
    /* public functions */
    /**
     * Initialize the share with the filled Share instance. This is the sanitized version of the Item.
     * @param {object} shareData - The secondary share data
     * @returns {Promise<Share>}
     */
    init(shareData){
        if(!this.#header)
            return
        const { characters, Conversation, scenes, } = shareData
        if(!Array.isArray(scenes) || !scenes?.length)
            throw new Error('Scenes required')
        this.#characters = characters
        this.#conversation = Conversation
        this.#scenes = scenes
        this.#currentScene = 0
        this.#initialized = true
        return this
    }
    /**
     * Accept the warnings for the share.
     * @param {Boolean} acceptance - Acceptance of warnings
     * @returns {void}
     */
    acceptWarnings(){
        this.#acceptWarnings = true
        return this.#acceptWarnings
    }
    /**
     * Add a variable to the share.
     * @param {object} obj - Key/Value pair of variables to add to the share
     * @returns {void}
     */
    addVariable(obj){
        this.#variables = {
            ...this.#variables,
            ...obj,
        }
    }
    async create(){
        
    }
    /**
     * Validate guess of Member name based on the input.
     * @param {String} input - The input to validate against the Member name
     * @returns {Boolean}
     */
    guessMember(input){
        this.#guesses++
        if(this.#guessable && this.#guesses<=3)
            return mValidateGuess(this.#variables.memberName, input)
        return false
    }
    async play(input){
        if(!this.warningsAccepted)
            return this.share
        if(input?.length)
            this.#conversation.addMessage({
                content: input,
                created_at: Date.now(),
                role: 'member',
            })
        if(!this.#sceneExists())
            return {
                ...this.share,
                instructions: `stopShare`,
                scene: this.stop()
            }
        const scene = this.currentScene
        this.#conversation.addMessage({
            content: scene,
            created_at: Date.now(),
            role: 'agent',
        })
        this.#currentScene++
        return scene
    }
    /**
     * Save the Conversation to the member's datacore.
     * @param {object} data - Data object describing fields to be saved (optional), defaults to allowable fields
     * @returns {Promise<void>}
     */
    async save(){
        if(this.#conversation)
            this.#conversation.save()
    }
    /**
     * Stop the share, ending the conversation, save if complete.
     * @returns {void}
     */
    stop(){
        if(!this.#sceneExists())
            this.save()
        if(this.#conversation)
            this.#conversation.removeThread(this.#conversation.thread_id)
        this.#conversation = null
        return mShareGratitude
    }
    triggerWarnings(){
        return this.#warnings
    }
    /**
     * Update the share with valid new data.
     * @param {object} data - Data object to update instance
     * @param {Boolean} save - Save the share after update, default: `true`
     * @returns {Promise<void>}
     */
    async update(data, save=true){
        delete data.shareId
        // this.#item.avatar.populateObject(this, data)
        if(save)
            await this.save(data)
    }
    /* getters/setters */
    get anonymous(){
        return this.#anonymous
    }
    get conclusion(){
        return this.#conclusion
    }
    get conversation(){
        return this.#conversation
    }
    set conversation(Conversation){
        this.#conversation = Conversation
    }
    get currentScene(){
        return this.scenes?.[this.#currentScene]
    }
    get guessable(){
        return this.#guessable
    }
    get header(){
        if(this.#header)
            return this.share
    }
    set header(headerData){
        const { preparedSummary, summary, warnings, variables, } = headerData
        this.#summary = preparedSummary
            ?? summary
            ?? 'No summary provided'
        this.#warnings = warnings
        if(variables && typeof variables==='object' && !Array.isArray(variables))
            this.addVariable(variables)
        this.#header = true
    }
    get id(){
        return this.#id
    }
    get initialized(){
        return this.#initialized
    }
    get instanceId(){
        return this.#instanceId
    }
    get itemId(){
        return this.#itemId
    }
    get mbr_id(){
        return this.#mbr_id
    }
    get pov(){
        return this.#pov
    }
    get previousScene(){
        const sceneIndex = this.#currentScene > 0
            ? this.#currentScene-1
            : 0
        return this.scenes?.[sceneIndex]
    }
    get restrictions(){
        return this.#restrictions
    }
    get scenes(){
        return this.#scenes
    }
    set scenes(value){
        if(Array.isArray(value))
            this.#scenes = value
    }
    get share(){
        const response = {
            acceptWarnings: this.#acceptWarnings,
            anonymous: this.anonymous,
            guessable: this.guessable,
            id: this.instanceId,
            itemId: this.itemId,
            scope: this.scope,
            shareId: this.id,
            title: this.title,
            type: this.type,
            warnings: this.warnings,
        }
        if(!this.#anonymous)
            response.variables = this.#variables
        return response
    }
    get scope(){
        return this.#scope
    }
    set scope(value){
        if(mShareScopes.indexOf(value)!==-1)
            this.#scope = value
    }
    get summary(){
        return this.#summary
    }
    get title(){
        return this.#title
    }
    get type(){
        return this.#type
    }
    get voice(){
        return this.#voice
    }
    get warnings(){
        return this.#warnings
    }
    get warningsAccepted(){
        if(!this.header) // warnings not yet created
            return false
        else if(!this.#warnings?.length)
            return true
        else
            return this.#acceptWarnings
    }
}
class Value extends Item {
    #influences
    #issue
    constructor(item, avatar, llmServices){
        item.being = 'stance'
        item.type = 'value'
        const { influences, issue, ..._item } = item
        super(_item, avatar, llmServices)
        this.#influences = influences
        this.#issue = issue
    }
    /* getters/setters */
    get itemCore(){
        return {
            ...super.itemCore,
            influences: this.#influences,
            issue: this.#issue,
        }
    }
    get influences(){
        return this.#influences
    }
    get issue(){
        return this.#issue
    }
}
/* module functions */
/**
 * Assigns content (from _message.message) to message object.
 * @module
 * @public
 * @param {any} obj - Element to assign to `content` property
 * @returns {string} - message text content
 */
function mAssignContent(obj){
    const contentErrorMessage = 'No content found.'
    const keyIncludes = ['category', 'content', 'input', 'message', 'text', 'value']
    switch(typeof obj){
        case 'undefined':
            throw new Error(contentErrorMessage)
        case 'object':
            if(Array.isArray(obj)){
                if(!obj.length)
                    throw new Error(contentErrorMessage)
                for(const element of obj){
                    try{
                        const content = mAssignContent(element)
                        return content
                    } catch(e){
                        if(e.message===contentErrorMessage)
                            continue
                    }
                }
                throw new Error(contentErrorMessage)
            }
            for(const key in obj){
                try{
                    if(keyIncludes.includes(key)){
                        const content = mAssignContent(obj[key])
                        return content
                    }
                } catch(e){
                    if(e.message===contentErrorMessage)
                        continue
                }
            }
            throw new Error(contentErrorMessage)
        case 'string':
            if(!obj.trim().length)
                throw new Error(contentErrorMessage)
            return obj.trim()
        default:
            return `${obj}`
    }
}
/**
 * Consumes a conversation object and uses supplied factory to (create/)save it to MyLife CosmosDB. Each session conversation is saved as a separate document, and a given thread may span many conversations, so cross-checking by thread_id will be required when rounding up and consolidating summaries for older coversations.
 * @param {AgentFactory} factory - Factory instance
 * @param {Conversation} Conversation - Conversation instance
 * @returns {Promise<void>}
 */
async function mSaveConversation(Conversation, factory){
    const {
        being,
        bot_id,
        form,
        id,
        isSaved=false,
        mbr_id,
        name,
        thread,
        type,
    } = Conversation
    let messages = Conversation.getMessages(false, true)
    messages = messages
        .map(_msg=>_msg.micro)
    if(!isSaved){
        const _newConversation = {
            being,
            bot_id,
            form,
            id,
            messages,
            mbr_id,
            name,
            thread,
            type,
        }
        const newConversation = await factory.dataservices.pushItem(_newConversation)
        return !!newConversation
    }
    const updatedConversation = await factory.dataservices.patch(
        id,
        { mbr_id, messages, }
    )
    return !!updatedConversation
}
/**
 * Validate a guess against a Member name.
 * @param {String} memberName - The Member name to validate
 * @param {String} input - The input to validate against Member name
 * @returns {Boolean}
 */
function mValidateGuess(memberName, input){
    const nameWords = memberName.trim().toLowerCase().split(/\s+/)
    const inputWords = input.trim().toLowerCase().split(/\s+/)
    if(inputWords.length===1)
        return nameWords.includes(inputWords[0])
    else if(nameWords.length===1)
        return inputWords.includes(nameWords[0])
    else
        return inputWords.every(word =>nameWords.includes(word))
}
/* exports */
export {
    Conversation,
    Entry,
    Issue,
	Memory,
    Message,
    Share,
    Value,
}