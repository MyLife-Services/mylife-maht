import { Marked } from 'marked'
import EventEmitter from 'events'
import { EvolutionAssistant } from './agents/system/evolution-assistant.mjs'
import { _ } from 'ajv'
import { inspect } from 'util'
import { experience } from './api-functions.mjs'
/* modular constants */
const mAvailableModes = ['standard', 'admin', 'evolution', 'experience', 'restoration']
/**
 * @class
 * @extends EventEmitter
 * @description An avatar is a digital self proxy of Member. Not of the class but of the human themselves - they are a one-to-one representation of the human, but the synthetic version that interopts between member and internet when inside the MyLife platform. The Avatar is the manager of the member experience, and is the primary interface with the AI (aside from when a bot is handling API request, again we are speaking inside the MyLife platform).
 * @todo - deprecate `factory` getter
 * @todo - determine how best to collect and present experience data; currently bound in 3 #-scope variables [livedExperience, experience, livingExperience]
 * @todo - more efficient management of modular constants, should be classes?
 */
class Avatar extends EventEmitter {
    #activeBotId // id of active bot in this.#bots; empty or undefined, then this
    #activeChatCategory = mGetChatCategory()
    #bots = []
    #cast
    #conversations = []
    #evolver
    #experience
    #experienceVariables = {
        age: undefined,
        birthdate: undefined,
        birthplace: undefined,
        interests: undefined,
        memberName: undefined,
        memberFirstName: undefined,
        name: undefined, // memberName
        nickname: undefined,
    } // object of experience variables, comprise `system` "hard-coded" variables
    #factory // do not expose
    #livedExperiences = [] // array of ids for lived experiences
    #livingExperience
    #llm
    #mode = 'standard' // interface-mode from modular `mAvailableModes`
    #proxyBeing = 'human'
    /**
     * @constructor
     * @param {Object} obj - The data object from which to create the avatar
     * @param {Factory} factory - The member factory on which avatar relies for all service interactions
     * @param {OpenAI} llm - The openAI object
     */
    constructor(factory, llm){
        super()
        this.#factory = factory
        this.#llm = llm
    }
    /* public functions */
    /**
     * @async
     * @public
     * @returns {Promise} Promise resolves to this Avatar class instantiation
     */
    async init(){
        const obj = await this.#factory.avatarProperties()
        Object.entries(obj)
            .forEach(([key, value]) => {
                if( // exclude certain properties
                        ['being', 'mbr_id'].includes(key)
                    ||  ['$', '_', ' ', '@', '#',].includes(key[0])
                )
                    return
                this[key] = value
            })
        /* create evolver (exclude MyLife) */
        // @todo: admin interface for modifying MyLife avatar and their bots
        this.#bots = await this.factory.bots(this.id)
        let _activeBot = this.avatarBot
        if(!this.isMyLife){
            if(!_activeBot.id){ // create: but do not want to call setBot() to activate
                _activeBot = await mBot(this)
                this.#bots.unshift(_activeBot)
            }
            this.activeBotId = _activeBot.id
            this.#experienceVariables = mAssignExperienceVariables(this.#experienceVariables, this)
            this.#evolver = new EvolutionAssistant(this)
            mAssignEvolverListeners(this.#evolver, this)
            /* init evolver */
            await this.#evolver.init()
        } else { // Q-specific, leave second as case is near always false
            this.activeBotId = this.avatarBot.id
            this.avatarBot.bot_id = process.env?.OPENAI_MAHT_GPT_OVERRIDE??this.avatarBot.bot_id
            const _conversation = await this.getConversation()
            this.avatarBot.thread_id = _conversation.threadId
            this.#proxyBeing = 'MyLife'
        }
        this.emit('avatar-init-end', this)
        return this
    }
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
     * Processes and executes incoming experience request.
     * @public
     * @param {string} experienceId - The experience id.
     * @param {string} sceneId - The scene id.
     * @param {object} memberInput - The member input.
     * @returns {Promise<array>} - The next sequence of evets in experience for front-end.
     */
    async experienceUpdate(experienceId, sceneId, memberInput){
        if(this.isMyLife)
            throw new Error('MyLife avatar cannot present experiences to itself.')
        if(this.mode!=='experience'){ // start experience
            const experience = await mExperienceStart(this.#factory, experienceId, sceneId, this.#experienceVariables)
            /* mutate avatar (this) */
            this.mode = 'experience'
            const { id, scenes } = experience
            if(id!==experienceId)
                throw new Error('Experience failure, unexpected id mismatch.')
            this.experience = experience
            let [conversation, scriptDialog] = await Promise.all([
                this.getConversation(undefined, 'experience'),
                this.getConversation(undefined, 'dialog')
            ]) // async cobstruction
            this.#livingExperience = new (this.#factory.livedExperience)({
                conversation,
                scriptDialog,
                experience_id: id,
                location: {
                    experienceId: id,
                    sceneId: scenes[0].id,
                    eventId: scenes[0].events[0].id,
                },
                mbr_id: this.mbr_id,
                version: this.experience.version??0,
            }) // create shell for storing lived experience
            this.#cast = await mCast(this.#factory, this.experience.cast)
        }
        const response = await mExperienceUpdate(
            this.#factory,
            this.#llm,
            this.experience,
            this.#livingExperience,
            this.#cast,
            memberInput,
        )
        return response
    }
    async experienceEnd(experienceId){
        if(this.isMyLife)
            throw new Error('MyLife avatar cannot conduct nor end experiences.')
        if(this.mode!=='experience')
            throw new Error('Avatar is not currently in an experience.')
        if(this.experience.id!==experienceId)
            throw new Error('Avatar is not currently in the requested experience.')
        if(!this.experience.skippable) // @todo - even if skippable, won't this function still process?
            throw new Error('Avatar cannot end this experience at this time, experience is not skippable.')
        this.mode = 'standard'
        // delete this.experience
        return true
    }
    async experienceManifest(experienceId){
        // includes cast, scenes, and navigable events
    }
    /**
     * Gets Conversation object. If no thread id, creates new conversation.
     * @param {string} thread_id - openai thread id
     * @param {string} type - Type of conversation: chat, experience, dialog, inter-system, etc.
     * @returns 
     */
    async getConversation(thread_id, type='chat'){
        let conversation = this.#conversations.find(_=>_.thread?.id===thread_id)
        if(!thread_id || !conversation){
            conversation = new (this.factory.conversation)({ mbr_id: this.mbr_id, type: type }, this.factory)
            await conversation.init(thread_id)
            this.#conversations.push(conversation)
        }
        return conversation
    }
    /**
     * Processes and executes incoming category set request.
     * @todo - deprecate if possible.
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
    // upon dissolution, forced/squeezed by session presumably (dehydrate), present itself to factory.evolution agent (or emit?) for inspection and incorporation if appropriate into datacore
    /* getters/setters */
    /**
     * Get the active bot. If no active bot, return this as default chat engine.
     * @getter
     * @returns {object} - The active bot.
     */
    get activeBot(){
        return this.#bots.find(_bot=>_bot.id===this.activeBotId)
    }
    /**
     * Get the active bot id.
     * @getter
     * @returns {string} - The active bot id.
     */
    get activeBotId(){
        return this.#activeBotId
    }
    /**
     * Set the active bot id. If not match found in bot list, then defaults back to this.id
     * @setter
     * @param {string} _bot_id - The active bot id.
     * @returns {void}
     */
    set activeBotId(_bot_id){ // default PA
        if(!_bot_id?.length) _bot_id = this.avatarBot.id
        this.#activeBotId = mFindBot(this, _bot_id)?.id??this.avatarBot.id
    }
    /**
     * Get actor or default avatar bot.
     * @getter
     * @returns {object} - The actor bot (or default bot).
     */
    get actorBot(){
        return this.#bots.find(_bot=>_bot.type==='actor')??this.avatarBot
    }
    /**
     * Get the age of the member.
     * @getter
     * @returns {number} - The member's age.
     */
    get age(){
        if(!this.birthdate)
            return 0
        const birthdate = new Date(this.birthdate)
        const today = new Date()
        let age = today.getFullYear() - birthdate.getFullYear();
        const isBirthdayPassedThisYear = today.getMonth() > birthdate.getMonth()
        || (
                today.getMonth() === birthdate.getMonth() 
            &&  today.getDate() >= birthdate.getDate()
            )
        if (!isBirthdayPassedThisYear) {
            age -= 1 // Subtract a year if the birthday hasn't occurred yet this year
        }
        return age
    }
    /**
     * Returns provider for avatar intelligence.
     * @getter
     * @returns {object} - The avatar intelligence provider, currently only openAI API GPT.
     */
    get ai(){
        return this.#llm
    }
    /**
     * Get the personal avatar bot.
     * @getter
     * @returns {object} - The personal avatar bot.
     */
    get avatarBot(){
        return this.#bots.find(_bot=>_bot.type==='personal-avatar')
    }
    /**
     * Get the "avatar's" being, or more precisely the name of the being (affiliated object) the evatar is emulating.
     * Avatars are special case and are always avatars, so when we query them non-internally for system purposes (in which case we understand we need to go directly to factory.core.being) we display the underlying essence of the datacore; could put this in its own variable, but this seems protective _and_ gives an access point for alterations.
     * @getter
     * @returns {string} The object being the avatar is emulating.
    */
    get being(){    //  
        return this.#proxyBeing
    }
    /**
     * Get the birthdate of _member_ from `#factory`.
     * @getter
     * @returns {string} - The member's birthdate.
     */
    get birthdate(){
        return this.core?.birthdate
            ?? this.core?.birth?.date
            ?? this.core?.birth?.[0]?.date
    }
    /**
     * Get the birthplace of _member_ from `#factory`.
     * @getter
     * @returns {string} - The member's birthplace.
     */
    get birthplace(){
        return this.core.birthplace
            ?? this.core.birth?.place
            ?? this.core.birth?.[0]?.place
    }
    /**
     * Gets all Avatar bots.
     * @getter
     * @returns {array} - The bots.
     */
    get bots(){
        return this.#bots
    }
    /**
     * Get the active chat category.
     * @getter
     * @returns {string} - The active chat category.
     */
    get category(){
        return this.#activeChatCategory
    }
    /**
     * Set the active chat category.
     * @setter
     * @param {string} _category - The new active chat category.
     * @returns {void}
     */
    set category(_category){
        this.#activeChatCategory = _category
    }
    /**
     * Get contributions.
     * @getter
     * @returns {array} - The contributions.
     */
    get contributions(){
        return this.#evolver?.contributions
    }
    /**
     * Set incoming contribution.
     * @setter
     * @param {object} _contribution
    */
    set contribution(_contribution){
        this.#evolver.contribution = _contribution
    }
    /**
     * Get uninstantiated class definition for conversation. If getting a specific conversation, use .conversation(id).
     * @getter
     * @returns {class} - class definition for conversation
     */
    get conversation(){
        return this.factory.conversation
    }
    /**
     * Get conversations. If getting a specific conversation, use .conversation(id).
     * @getter
     * @returns {array} - The conversations.
     */
    get conversations(){
        return this.#conversations
    }
    /**
     * Get the datacore.
     * @getter
     * @returns {object} - The Member's datacore.
     */
    get core(){
        return this.#factory.core
    }
    /**
     * Get the current experience.
     * @getter
     * @returns {object} - The current experience.
     */
    get experience(){
        return this.#experience
    }
    /**
     * Set the experience.
     * @setter
     * @todo - test experience for type and validity.
     * @param {any} experience - The new experience.
     */
    set experience(experience){
        this.#experience = experience
    }
    /**
     * Get the Avatar's Factory.
     * @todo - deprecate if possible, return to private
     * @getter
     * @returns {AgentFactory} - The Avatar's Factory.
     */
    get factory(){
        return this.#factory
    }
    /**
     * Globals shortcut.
     * @getter
     * @returns {object} - The globals.
     */
    get globals(){
        return this.#factory.globals
    }
    /**
     * Whether or not the avatar is the MyLife avatar.
     * @getter
     * @returns {boolean} - true if the avatar is the MyLife avatar. 
     */
    get isMyLife(){
        return this.#factory.isMyLife
    }
    /**
     * Get the member id.
     * @getter
     * @returns {string} - The member's id.
     */
    get mbr_id(){
        return this.#factory.mbr_id
    }
    /**
     * Get the guid portion of member id.
     * @todo - deprecate to `mbr_sysId`
     * @getter
     * @returns {guid} - The member's core guid.
     */
    get mbr_id_id(){
        return this.mbr_sysId
    }
    /**
     * Get the system name portion of member id.
     * @todo - deprecate to `mbr_sysName`
     * @getter
     * @returns {guid} - The member's system name.
     */
    get mbr_name(){
        return this.mbr_sysName
    }
    /**
     * Get the guid portion of member id.
     * @getter
     * @returns {guid} - The member's core guid.
     */
    get mbr_sysId(){
        return this.globals.sysId(this.mbr_id)
    }
    /**
     * Get the system name portion of member id.
     * @getter
     * @returns {guid} - The member's system name.
     */
    get mbr_sysName(){
        return this.globals.sysName(this.mbr_id)
    }
    /**
     * Gets first name of member from `#factory`.
     * @getter
     * @returns {guid} - The member's core guid.
     */
    get memberFirstName(){
        return this.memberName.split(' ')[0]??this.nickname??this.name
    }
    /**
     * Gets full name of member from `#factory`.
     * @getter
     * @returns {guid} - The member's core guid.
     */
    get memberName(){
        return this.#factory.memberName
    }
    /**
     * Get uninstantiated class definition for message.
     * @getter
     * @returns {class} - class definition for message
     */
    get message(){
        return this.factory.message
    }
    /**
     * Get the mode.
     * @getter
     * @returns {string} - The current active mode.
     */
    get mode(){
        return this.#mode
    }
    /**
     * Set the mode. If mode request is invalid, does not change mode and throws error in order to identify failure.
     * @setter
     * @param {string} requestedMode - The new mode.
     * @returns {void}
     */
    set mode(requestedMode){
        this.#mode = mValidateMode(requestedMode, this.mode)
    }
}
/* modular functions */
/**
 * Initializes openAI assistant and returns associated `assistant` object.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {object} _botData - bot creation instructions.
 * @returns {object} - [OpenAI assistant object](https://platform.openai.com/docs/api-reference/assistants/object)
 */
async function mAI_openai(_openai, _botData){
    const _assistantData = {
        description: _botData.description,
        model: _botData.model,
        name: _botData.bot_name??_botData.name, // take friendly name before Cosmos
        instructions: _botData.instructions,
    }
    return await _openai.beta.assistants.create(_assistantData)
}
/**
 * Assigns evolver listeners.
 * @modular
 * @param {EvolutionAssistant} _evolver - Evolver object
 * @param {Avatar} _avatar - Avatar object
 * @returns {void}
 */
function mAssignEvolverListeners(_evolver, _avatar){
    /* assign evolver listeners */
    _evolver.on(
        'on-contribution-new',
        _contribution=>{
            _contribution.emit('on-contribution-new', _contribution)
        }
    )
    _evolver.on(
        'avatar-change-category',
        (_current, _proposed)=>{
            _avatar.category = _proposed
            console.log('avatar-change-category', _avatar.category.category)
        }
    )
    _evolver.on(
        'on-contribution-submitted',
        _contribution=>{
            // send to gpt for summary
            const _responses = _contribution.responses.join('\n')
            // @todo: wrong factory?
            const _summary = _avatar.factory.openai.completions.create({
                model: 'gpt-3.5-turbo-instruct',
                prompt: 'summarize answers in 512 chars or less, if unsummarizable, return "NONE": ' + _responses,
                temperature: 1,
                max_tokens: 700,
                frequency_penalty: 0.87,
                presence_penalty: 0.54,
            })
            // evaluate summary
            console.log('on-contribution-submitted', _summary)
            return
            //  if summary is good, submit to cosmos
        }
    )
}
/**
 * Assigns (directly mutates) private experience variables from avatar.
 * @todo - theoretically, the variables need not come from the same avatar instance... not sure of viability
 * @modular
 * @param {object} experienceVariables - Experience variables object from Avatar class definition.
 * @param {Avatar} avatar - Avatar instance.
 * @returns {void} - mutates experienceVariables
 */
function mAssignExperienceVariables(experienceVariables, avatar){
    Object.keys(experienceVariables).forEach(_key=>{
        experienceVariables[_key] = avatar[_key]
    })
    /* handle unique variable instances (jic) */
    const localOverrides = {
        name: avatar.memberName,
        nickname: avatar.memberFirstName
    }
    return {...experienceVariables, ...localOverrides}
}
/**
 * Updates or creates bot (defaults to new personal-avatar) in Cosmos and returns successful `bot` object, complete with conversation (including thread/thread_id in avatar) and gpt-assistant intelligence.
 * @todo Fix occasions where there will be no object_id property to use, as it was created through a hydration method based on API usage, so will be attached to mbr_id, but NOT avatar.id
 * @modular
 * @param {Avatar} _avatar - Avatar object that will govern bot
 * @param {object} _bot - Bot object
 * @returns {object} - Bot object
 */
async function mBot(_avatar, _bot={type: 'personal-avatar'}){
    /* validation */
    if(!_bot.mbr_id?.length)
        _bot.mbr_id = _avatar.mbr_id
    else if(_bot.mbr_id!==_avatar.mbr_id)
        throw new Error('Bot mbr_id cannot be changed')
    if(!_bot.type?.length)
        throw new Error('Bot type required')
    /* set required _bot super-properties */
    if(!_bot.object_id?.length)
        _bot.object_id = _avatar.id
    if(!_bot.id)
        _bot.id = _avatar.factory.newGuid
    const _botSlot = _avatar.bots.findIndex(bot => bot.id === _bot.id)
    if(_botSlot!==-1){ // update
        const _existingBot = _avatar.bots[_botSlot]
        if(
                _bot.bot_id!==_existingBot.bot_id 
            ||  _bot.thread_id!==_existingBot.thread_id
        ){
            console.log(`ERROR: bot discrepency; bot_id: db=${_existingBot.bot_id}, inc=${_bot.bot_id}; thread_id: db=${_existingBot.thread_id}, inc=${_bot.thread_id}`)
            throw new Error('Bot id or thread id cannot attempt to be changed via bot')
        }
        _bot = {..._existingBot, ..._bot}
    } else { // add
        _bot = await mCreateBot(_avatar, _bot) // add in openai
    }
    /* create or update bot properties */
    if(!_bot?.thread_id?.length){
        // openai spec: threads are independent from assistant_id
        // @todo: investigate: need to check valid thread_id? does it expire?
        const _conversation = await _avatar.getConversation()
        _bot.thread_id = _conversation.thread_id
    }
    // update Cosmos (no need async)
    _avatar.factory.setBot(_bot)
    return _bot
}
/**
 * Pruned version of mChat where call is internal via experience or member avatar dial-up. Direct member bot access is through mChat. Mutates conversation, but unclear if _ever_ saved from this function.
 * @todo - create actor-bot for internal chat? Concern is that API-assistants are only a storage vehicle, ergo not an embedded fine tune as I thought (i.e., there still may be room for new fine-tuning exercise); i.e., micro-instructionsets need to be developed for most. Unclear if direct thread/message instructions override or ADD, could check documentation or gpt, but...
 * @modular
 * @param {OpenAI} llm - OpenAI object currently
 * @param {Conversation} conversation - Conversation object
 * @param {string} prompt - dialog-prompt/message for llm
 * @param {string} botId - bot id
 * @returns {void} - Conversation dialog is mutated
 */
async function mCallLLM(llm, conversation, prompt, botId){
    const { thread_id: threadId } = conversation
    if(!threadId)
        throw new Error('No `thread_id` found for conversation')
    // **note**: creates own synthetic thread that _should not be stored_.
    // @todo: test db to ensure conversations are not stored
    prompt = {
        message: prompt,
        role: 'user'
    } // in this context, the actor is the 'user' in order to request a piece of dialog. See, not confusing at all!
    await conversation.addMessage(prompt)
    const runs = await mRunTrigger(llm, undefined, botId, threadId)
    const messages = await conversation.getMessages_openai()
    const _messages = messages
        .filter(message => message.run_id === runs[0].id)
        .map(_msg =>({
            bot_id: botId,
            content: _msg.content[0].text.value,
            role: 'assistant',
        }))
    await Promise.all(
        _messages.map(async _msg => await conversation.addMessage(_msg))
    )
    if(process.env?.MYLIFE_DB_ALLOW_SAVE){
        conversation.save()
    } //	add/update cosmos (?)
    return
}
/**
 * Cancels openAI run.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {string} _thread_id - Thread id
 * @param {string} _run_id - Run id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mCancelRun(_openai, _thread_id, _run_id,){
    return await _openai.beta.threads.runs.cancel(
        _thread_id,
        _run_id
    )
}
/**
 * Creates cast and returns associated `cast` object.
 * @todo - move as much functionality for actor into `init()` as makes sense
 * @todo - any trouble retrieving a known actor should be understudied by... Q? or personal-avatar? yes, personal avatar for now
 * @todo - implement `creator` version of actor
 * @todo - include variables for names of roles/actors
 * @modular
 * @param {AgentFactory} factory - Agent Factory object
 * @param {array} cast - Array of cast objects
 * @returns {Promise<array>} - Array of ExperienceCastMember instances
 */
async function mCast(factory, cast){
    // create `actors`, may need to create class
    cast = await Promise.all(cast.map(async castMember=>{
        const actor = new (factory.castMember)(castMember)
        switch(castMember.type.toLowerCase()){
            case 'mylife':
            case 'q':
            case 'system':
                actor.bot = await factory.systemActor
                break
            case 'bot':
            case 'member':
            case 'member-bot':
            default:
                actor.bot = await factory.bot() // should be new-member safe, but check
                break
        }
        return actor
    }))
    return cast
}
/**
 * Requests and returns chat response from openAI.
 * @todo - reinstate contribution
 * @modular
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _chatMessage - Chat message
 * @returns {array} - array of front-end MyLife chat response objects { agent, category, contributions, message, response_time, purpose, type }
 */
async function mChat(_avatar, _chatMessage){
    // **note**: Q/isMyLife PA bot does not have thread_id intentionally, as every session creates its own
    const _processStartTime = Date.now()
    const _bot = _avatar.activeBot
    // check if active bot, if not use self
    const _conversation = await _avatar.getConversation(_bot.thread_id) // create if not exists
    _conversation.addMessage(_chatMessage)
    //	@todo: assign uploaded files (optional) and push `retrieval` to tools
    _bot.thread_id = _bot.thread_id??_conversation.thread_id
    const { id: botId, thread_id: threadId } = _bot
    _avatar.runs = await mRunTrigger(_avatar.ai, _avatar.runs??[], botId, threadId) // run is triggered by message creation, content embedded/embedding now in _conversation in _avatar.conversations
    const _messages = (await _conversation.getMessages_openai())
        .filter(_msg => _msg.run_id == _avatar.runs[0].id)
        .map(_msg => {
            return new (_avatar.factory.message)({
                bot_id: _bot.id,
                avatar_id: _avatar.id,
                message: _msg,
                content: _msg.content[0].text.value,
                mbr_id: _avatar.mbr_id,
                role: 'assistant',
            })
        })
    _messages.forEach(async _msg => {
//  @todo: reinstate contribution
//        _avatar.#evolver?.setContribution(_avatar.#activeChatCategory, _msg)??false
        await _conversation.addMessage(_msg)
    })
    //	add/update cosmos
    if ((_avatar?.factory!==undefined) && (process.env?.MYLIFE_DB_ALLOW_SAVE??false)) {
        _conversation.save()
    }
    const _chat = _messages
        .map(_msg=>{
            const __message = mPrepareMessage(_msg) // returns object { category, content }
            return {
                activeBotId: _bot.id,
                activeBotAIId: _bot.bot_id,
                agent: 'server',
                category: __message.category,
                contributions: [],
                message: __message.content,
                purpose: 'chat response',
                response_time: Date.now()-_processStartTime,
                thread_id: _conversation.thread_id,
                type: 'chat',
            }
        })
    //	return response
    return _chat
}
/**
 * Creates bot and returns associated `bot` object.
 * @modular
 * @private
 * @param {Avatar} _avatar - Avatar object
 * @param {object} _bot - Bot object
 * @returns {object} - Bot object
*/
async function mCreateBot(_avatar, _bot){
    // create gpt
    const _botData = await _avatar.factory.createBot(_bot)
    _botData.object_id = _avatar.id
    const _openaiGPT = await mAI_openai(_avatar.ai, _botData)
    _botData.bot_id = _openaiGPT.id
    return { ..._bot, ..._botData }
}
/**
 * Returns a processed appearance event.
 * @param {ExperienceEvent} event - Event object
 * @returns {ExperienceEvent} - Event object
 */
function mEventAppear(event){
    return event
}
/**
 * Returns processed dialog as string.
 * @todo - when `variable` undefined in `experience.variables`, check to see if event can be found that will provide it
 * @modular
 * @public
 * @param {OpenAI} llm - OpenAI object currently
 * @param {Experience} experience - Experience class instance.
 * @param {LivedExperience} livingExperience - LivedExperience object
 * @param {array} cast - Array of ExperienceCastMember instances
 * @param {ExperienceEvent} event - Event object
 * @param {number} iteration - The current iteration number (iterations _also_ allow for `refresh` of dialog front-end)
 * @returns {Promise<string>} - Parsed piece of event dialog
 */
async function mEventDialog(llm, experience, livingExperience, cast, event, iteration=0){
    if(!event.data) return // no dialog to parse
    const { actor, id, type='script' } = event
    let dialog = experience.dialog(id, iteration)
    if(!dialog)
        throw new Error('Dialog error, could not establish dialog.')
    // process instructions
    switch(type){
        case 'script':
        case 'scripts':
            event.type = 'script' // force standardization
            return dialog?.dialog
                ?? dialog?.text
                ?? dialog?.prompt
                ?? dialog?.content
                ?? 'No dialog developed for script'
        case 'prompt':
        case 'prompts':
            event.type = 'prompt' // force standardization
            let prompt = dialog.prompt??'no prompt content for dynamic script!'
            const promptFallback = dialog.promptFallback??`No dialog developed for prompt: ${prompt}`
            if(dialog.example?.length??dialog.examples?.length){
                if(dialog.examples?.length && Array.isArray(dialog.examples)){
                    dialog.example = dialog.examples[0]
                } // boild down example from array to string
                prompt = `using example: "${dialog.example}";\n` + prompt
            }
            // check for content variables and replace
            if(dialog.variables?.length){
                dialog.variables.forEach(keyName=>{
                    const value = experience.experienceVariables[keyName]
                    if(value){
                        // @todo: find input event where variable is identified as input and insert (if logic allows, otherwise error)
                        prompt = prompt.replace(new RegExp(`@@${keyName}`, 'g'), value)
                    }
                })
                console.log('mEventDialog: prompt variables updated', prompt, dialog.prompt)
            }
            // do I reproduce mChat with what I have? sure - it may ultimately be more streamlined without the request of the avatar?
            // **note**: system chat would refer to Q, but I want any internal chat to go through this channel, depending on cast member
            // set botId from cast
            const castMember = cast.find(_castMember=>_castMember.id===actor)
            const botId = castMember?.bot?.bot_id
            if(!botId)
                throw new Error('No bot found for actor')
            const { scriptDialog } = livingExperience
            await mCallLLM(llm, scriptDialog, prompt, botId) // mutates scriptDialog
            return scriptDialog.messages[0].content??promptFallback
        default:
            throw new Error(`Dialog type \`${type}\` not recognized`)
    }   
}
/**
 * Returns a processed memberInput event.
 * @modular
 * @public
 * @param {OpenAI} llm - OpenAI object currently.
 * @param {Experience} experience - Experience class instance.
 * @param {LivedExperience} livingExperience - LivedExperience object.
 * @param {array} cast - Array of ExperienceCastMember instances.
 * @param {ExperienceEvent} event - Event object.
 * @param {number} iteration - The current iteration number.
 * @param {object} memberInput - Member input, any data type.
 * @returns {Promise<object>} - Synthetic Input Event.
 */
async function mEventInput(llm, experience, livingExperience, cast, event, iteration, memberInput){
    const { actor, id, type='script' } = event
    const input = experience.input(id, iteration)
    if(!input)
        throw new Error('Script input error, could not establish input parameters.')
    if(memberInput??false){/* WRITE SCRIPT */
        console.log('mEventInput::Input Script Event', input)
        throw new Error('`memberInput` Input script not yet implemented')
    }
    return input
}
/**
 * Processes an event and adds appropriate accessors to `ExperienceEvent` passed instance.
 *   1. Stage `event.stage`
 *   2. Dialog `event.dialog`
 *   3. Input `event.input`
 * @todo - keep track of iterations inside livingExperience to manage flow
 * @todo - mutations should be handled by `ExperienceEvent` extenders.
 * @todo - script dialog change, input assessment, success evals to completions or cheaper? babbage-002 ($0.40/m) is only cheaper than 3.5 ($3.00/m); can test efficacy for dialog completion, otherwise, 3.5 exceptional
 * @modular
 * @public
 * @param {OpenAI} llm - OpenAI object currently
 * @param {Experience} experience - Experience class instance.
 * @param {array} cast - Array of ExperienceCastMember instances
 * @param {LivedExperience} livingExperience - LivedExperience object
 * @param {ExperienceEvent} event - Event object
 * @param {object} memberInput - Member input
 * @returns {Promise<ExperienceEvent>} - Event object
 */
async function mEventProcess(llm, experience, cast, livingExperience, event, memberInput){
    switch(event.action){
        case 'appear': // front-end only pass-throughs
            event.stage = mEventAppear() // stage will handle front-end instructions
            break
        case 'dialog': // requires processing
            // need livingExperience vars to manage flow
            event.dialog = await mEventDialog(llm, experience, livingExperience, cast, event, livingExperience.currentIteration)
            livingExperience.location.eventId = event.dialog.id
            break
        case 'input': // requires processing
            // create `dialog` string and `input` synthetic object in `event`
            event.dialog = await mEventDialog(llm, experience, livingExperience, cast, event, livingExperience.currentIteration)
            event.input = await mEventInput(llm, experience, livingExperience, cast, event, livingExperience.currentIteration)
            livingExperience.location.eventId = event.dialog.id
            event.breakpoint = true
            break
        default: // error/failure
            throw new Error('Event action not recognized')
    }
    // iteration logging, etc? to livedExperience which holds conversation(s)
    return mSanitizeEvent(event)
}
/**
 * Starts or continues experience with avatar functionality as director/puppeteer. Everything is herein mutated and returned as one final experience instructionset to front-end.
 * @todo - allow auto-skip to scene/event?
 * @todo - allow for memberInput to be processed
 * @todo - ExperienceScene and ExperienceEvent should be classes?
 * @modular
 * @public
 * @param {AgentFactory} factory - AgentFactory object
 * @param {object} llm - ai interface object
 * @param {Experience} experience - Experience object
 * @param {LivedExperience} livingExperience - LivedExperience object
 * @param {array} cast - Array of ExperienceCastMember instances
 * @param {object} memberInput - Member input
 * @returns {object} - A JSON-serializable experience sequence object for front-end
 */
async function mExperienceUpdate(factory, llm, experience, livingExperience, cast, memberInput){
    const { sceneId, eventId } = livingExperience.location
    const currentScene = experience.scenes.find(
        _scene=>_scene.id==sceneId
    )
    const currentEventIndex = currentScene.events.findIndex(
        event=>event.id==eventId
    )
    if(currentEventIndex===-1)
        throw new Error('Experience failure, could not find event.')
    // @todo: if continuing, update event with memberInput
    const eventSequence = []
    let i = currentEventIndex
    while(i < currentScene.events.length){
        const _event = new (factory.experienceEvent)(currentScene.events[i])
        const event = await mEventProcess(llm, experience, cast, livingExperience, _event, memberInput)
        eventSequence[i] = event
        livingExperience.location.eventId = event.id
        // livingExperience.conversation.addMessage(event.dialog)





        i++
        if(event.breakpoint)
            break
    }
    return eventSequence
}
/**
 * Starts Experience.
 * @param {AgentFactory} factory - AgentFactory object.
 * @param {guid} experienceId - Experience id.
 * @param {guid} sceneId
 * @param {object} experienceVariables - Experience variables object from Avatar class definition.
 * @returns {Experience} - Experience initialized instance.
 */
async function mExperienceStart(factory, experienceId, sceneId, experienceVariables){
    let experience = await factory.getExperience(experienceId) // database object
    if(!experience)
        throw new Error('Experience not found')
    if(sceneId?.length){
        // get scene from experience (test skippable/ requested scene prior reqs)
        const _scene = experience.scenes.find(_scene=>_scene.id==sceneId)
        throw new Error('Starting experiences at subsequent scenes not yet implemented')
    }
    /* hydrate experience */
    const _experience = new (factory.experience)(experience)
    if(!_experience instanceof factory.experience)
        throw new Error('Experience not valid')
    await _experience.init(experienceVariables)
    return _experience
}
/**
 * Gets bot by id.
 * @modular
 * @param {object} _avatar - Avatar instance.
 * @param {string} _botId - Bot id
 * @returns {object} - Bot object
 */
function mFindBot(_avatar, _botId){
    return _avatar.bots
        .filter(_bot=>{ return _bot.id==_botId })
        [0]
}
/**
 * Returns simple micro-category after logic mutation.
 * @modular
 * @param {string} _category text of category
 * @returns {string} formatted category
 */
function mFormatCategory(_category){
    return _category
        .trim()
        .slice(0, 128)  //  hard cap at 128 chars
        .replace(/\s+/g, '_')
        .toLowerCase()
}
/**
 * Returns MyLife-version of chat category object
 * @modular
 * @param {object} _category - local front-end category { category, contributionId, question/message/content }
 * @returns {object} - local category { category, contributionId, content }
 */
function mGetChatCategory(_category) {
    const _proposedCategory = {
        category: '',
        contributionId: undefined,
        content: undefined,
    }
    if(_category?.category && _category.category.toLowerCase() !== 'off'){
        _proposedCategory.category = mFormatCategory(_category.category)
        _proposedCategory.contributionId = _category.contributionId
        _proposedCategory.content = 
            _category?.question??
            _category?.message??
            _category?.content // test for undefined
    }
    return _proposedCategory
}
/**
 * returns simple micro-message with category after logic mutation. 
 * Currently tuned for openAI gpt-assistant responses.
 * @modular
 * @private
 * @param {string} _msg text of message, currently from gpt-assistants
 * @returns {object} { category, content }
 */
function mPrepareMessage(_msg){
    /* parse message */
    // Regular expression to match the pattern "Category Mode: {category}. " or "Category Mode: {category}\n"; The 'i' flag makes the match case-insensitive
    const _categoryRegex = /^Category Mode: (.*?)\.?$/gim
    const _match = _categoryRegex.exec(_msg)
    const _messageCategory = mFormatCategory(_match?.[1]??'')
    if(_msg.content) _msg = _msg.content
    // Remove from _msg
    _msg = _msg.replace(_categoryRegex, '')
    const _content = _msg.split('\n')
        .filter(_line => _line.trim() !== '') // Remove empty lines
        .map(_msg=>{
            return new Marked().parse(_msg)
        })
        .join('\n')
    return {
        category: _messageCategory,
        content: _content,
    }
}
/**
 * Maintains vigil for status of openAI `run = 'completed'`.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {object} _run - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunFinish(_openai, _run){
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
            try {
                const status = await mRunStatus(_openai, _run)
                if (status) {
                    clearInterval(checkInterval)
                    resolve(_run)
                }
            } catch (error) {
                clearInterval(checkInterval)
                reject(error)
            }
        }, process.env.OPENAI_API_CHAT_RESPONSE_PING_INTERVAL??890)
        // Set a timeout to resolve the promise after 55 seconds
        setTimeout(() => {
            clearInterval(checkInterval)
            resolve('Run completed (timeout)')
        }, process.env.OPENAI_API_CHAT_TIMEOUT??55000)
    })
}
/**
 * Returns all openai `run` objects for `thread`.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _thread_id - Thread id (from session)
 * @returns {array} - array of [OpenAI run objects](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRuns(_openai, _avatar, _thread_id){
	if(!_avatar.runs){
		_avatar.runs = await _openai.beta.threads.runs
            .list(_thread_id)
	}
}
/**
 * Executes openAI run and returns associated `run` object.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {string} _assistant_id - Assistant id
 * @param {string} _thread_id - Thread id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunStart(_openai, _assistant_id, _thread_id){
    return await _openai.beta.threads.runs.create(
        _thread_id,
        { assistant_id: _assistant_id }
    )
}
/**
 * Checks status of openAI run.
 * @modular
 * @param {OpenAI} _openai - OpenAI object
 * @param {object} _run - Run id
 * @returns {boolean} - true if run completed, voids otherwise
 */
async function mRunStatus(_openai, _run){
    const __run = await _openai.beta.threads.runs
        .retrieve(
            _run.thread_id,
            _run.id,
        )
    switch(__run.status){
        //	https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
        case 'completed':
            _run = __run // update via overwrite
            return true
        case 'failed':
        case 'cancelled':
        case 'expired':
            return false
        case 'queued':
        case 'requires_action':
        case 'in_progress':
        case 'cancelling':
        default:
            console.log(`...${__run.status}:${_run.thread_id}...`) // ping log
            break
    }
}
/**
 * Returns requested openai `run` object.
 * @modular
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _run_id - Run id
 * @param {string} _step_id - Step id
 * @returns {object} - [OpenAI run-step object]()
 */
async function mRunStep(_avatar, _run_id, _step_id){
	//	pull from known runs
	return _avatar.runs
		.filter(_run=>{ return _run.id==_run_id })
		.steps
			.filter(_step=>{ return _step.id==_step_id })
}
/**
 * Returns all openai `run-step` objects for `run`.
 * @modular
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _run_id - Run id
 * @returns {array} - array of [OpenAI run-step objects]()
 */
async function mRunSteps(_avatar, _run_id){
	//	always get dynamically
	const _run = _avatar.runs
        .filter(_run=>{ return _run.id==_run_id })
        [0]
	_run.steps = await openai.beta.threads.runs.steps
        .list(_avatar.thread.id, _run.id)
}
/**
 * Triggers openAI run and updates associated `run` object.
 * @modular
 * @param {OpenAI} openai - OpenAI object
 * @param {object} runs - Array of Run objects
 * @param {string} botId - Bot id
 * @param {string} threadId - Thread id
 * @returns {void} - All content generated by run is available in `avatar`.
 */
async function mRunTrigger(openai, runs=[], botId, threadId){
    const run = await mRunStart(openai, botId, threadId)
    if(!run)
        throw new Error('Run failed to start')
    runs.unshift(run)
    // ping status
    await mRunFinish(openai, run) // returns void, but updates run
    return runs
}
function mSanitizeEvent(event){
    const { action, actor, animation, breakpoint, dialog, duration, effect, effects, id, input, order, stage, type,  } = event
    return {
        action,
        actor,
        animation,
        breakpoint,
        dialog,
        duration,
        effects: effects??[effect],
        id,
        input,
        order,
        stage,
        type,
    }
}
function mValidateMode(_requestedMode, _currentMode){
    if(!mAvailableModes.includes(_requestedMode))
        throw new Error('Invalid interface mode request. Mode not altered.')
    switch(_requestedMode){
        case 'admin':
            console.log('Admin interface not currently implemented. Mode not altered.')
            return _currentMode
        case 'experience':
        case 'standard':
        case 'restore':
        default:
            return _requestedMode
    }
}
/* exports */
export default Avatar