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
    #itemId
    #mbr_id
    #phaseOfLife
    #pov // point-of-view; enum: [1,2,3,4] **note** 4=first-person plural (we); first could reference personal pronouns
    #restrictions // NL requirements for viewing
    #scenes // array of scenes
    #scope // enum: [group, members, private, public]
    #summary // filled out in init()
    #title
    #variables // array of variables relevant to memory share
    /**
     * @constructor
     * @param {object} share - Data object
     * @param {Item} item - The Item instance
     */
    constructor(share, conversation){
        if(!experienceAgent)
            throw new Error('Experience agent required')
        super()
        const { anonymous=true, group, guessable, id, itemId, mbr_id, scope='private', restrictions, } = share
        if(!mbr_id || !id || !itemId)
            throw new Error('Member and item id required')
        this.#anonymous = anonymous
        this.#conversation = conversation
        this.#group = group
        this.#id = id
        this.#itemId = itemId
        this.#mbr_id = mbr_id
        this.#scope = scope
        this.#restrictions = restrictions
    }
    /* public functions */
    /**
     * Initialize the share with the Item instance. This is the sanitized version of the Item.
     * @param {Item} Item - The Item instance
     */
    async init(Item){
        this.#summary = Item.summary

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
    get id(){
        return this.#id
    }
    get itemId(){
        return this.#itemId
    }
    get mbr_id(){
        return this.#mbr_id
    }
    get share(){
        return {
            id: this.id,
            scope: this.scope,
            type: this.type,
        }
    }
    get scope(){
        return this.#scope
    }
    set scope(value){
        if(mShareScopes.indexOf(value)!==-1)
            this.#scope = value
    }
}
/* module functions */
/* exports */
export {
    Entry,
	Memory,
    Share,
}