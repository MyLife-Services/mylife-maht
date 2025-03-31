/* imports */
import { EventEmitter } from 'events'
/* module constants */
const mAvailableForms = ['entry', 'memory'],
    mBeing = `story`,
    mShareGratitude = `Thank you for letting us share this narrative with you! I hope you enjoyed it as much as I did.`,
    mShareScopes = ['group', 'members', 'private', 'public'],
    mVersion = 1.00
/**
 * @class - Item
 * @extends EventEmitter
 * @description An `Item` is the root class for `story` beings in the datacore. `Story` currently is extended by `Memory` and `Entry` classes. These classes by design have access to private intelligence based upon incoming parameters or the initial generating request bot.
 */
class Item extends EventEmitter {
    #additionalProperties
    #availableForms = mAvailableForms
    #avatar
    #being=mBeing
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
        const scene = this.scenes[this.#currentScene]
        this.#conversation.addMessage({
            content: scene,
            created_at: Date.now(),
            role: 'agent',
        })
        this.#currentScene++
        return {
            ...this.share,
            scene,
        }
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
            anonymous: this.anonymous,
            guessable: this.guessable,
            id: this.instanceId,
            scope: this.scope,
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
/* module functions */
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
    Entry,
	Memory,
    Share,
}