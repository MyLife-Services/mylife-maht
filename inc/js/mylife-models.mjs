/* imports */
import { EventEmitter } from 'events'
/* module constants */
const mAvailableForms = ['entry', 'memory'],
    mBeing = `story`,
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
    #anonymous
    #being='share'
    #characters
    #conversation
    #group
    #guessable
    #id
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
    /**
     * @constructor
     * @param {object} share - The Share data core object
     * @param {Item} item - The Item instance
     * @returns {Promise<Share>}
     */
    constructor(share, Conversation){
        const { anonymous=true, group, guessable=false, id, instanceId=this.id & Date.now().toString(), itemId, mbr_id, pov, restrictions, scope='private', title, type='memory', } = share
        if(!mbr_id || !id || !itemId)
            throw new Error('Member and item id required')
        super()
        this.#anonymous = anonymous
        this.#conversation = Conversation
        this.#guessable = guessable
        this.#group = group
        this.#id = id
        this.#itemId = itemId
        this.#mbr_id = mbr_id
        this.#pov = pov
        this.#restrictions = restrictions
        this.#scope = scope
        this.#restrictions = restrictions
        this.#title = title
        this.#type = type
        return this
    }
    /* public functions */
    /**
     * Initialize the share with the filled Share instance. This is the sanitized version of the Item.
     * @param {object} shareData - The secondary share data
     * @param {Conversation} Conversation - The Conversation instance
     * @returns {Promise<Share>}
     */
    init(shareData){
        const { characters, scenes, summary, warnings, } = shareData
        this.#characters = characters
        this.#scenes = scenes
        this.#summary = summary
        this.#warnings = warnings
        return this
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
        console.log(this.#variables)
    }
    async create(){
        
    }
    /**
     * Save the share to the datacore.
     * @param {object} data - Data object describing fields to be saved (optional), defaults to allowable fields
     * @returns {Promise<void>}
     */
    async save(data=this.share){
        // **NOTE** item itself never gets stored, only the share
        // await this.#item.avatar.shareUpdate(data)
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
    get conversation(){
        return this.#conversation
    }
    get guessable(){
        return this.#guessable
    }
    get id(){
        return this.#id
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
    get share(){
        return {
            anonymous: this.anonymous,
            guessable: this.guessable,
            id: this.id,
            itemId: this.itemId,
            pov: this.pov,
            scope: this.scope,
            summary: this.summary,
            title: this.title,
            type: this.type,
            warnings: this.warnings,
        }
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
    get warnings(){
        return this.#warnings
    }
}
/* module functions */
/* exports */
export {
    Entry,
	Memory,
    Share,
}