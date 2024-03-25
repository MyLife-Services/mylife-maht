import { Marked } from 'marked'
import EventEmitter from 'events'
import { EvolutionAssistant } from './agents/system/evolution-assistant.mjs'
import { _ } from 'ajv'
import { abort } from 'process'
/* modular constants */
const { MYLIFE_DB_ALLOW_SAVE, OPENAI_MAHT_GPT_OVERRIDE, } = process.env
const allowSave = JSON.parse(MYLIFE_DB_ALLOW_SAVE ?? 'false')
const mAvailableModes = ['standard', 'admin', 'evolution', 'experience', 'restoration']
const botIdOverride = OPENAI_MAHT_GPT_OVERRIDE
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
    #llmServices
    #mode = 'standard' // interface-mode from modular `mAvailableModes`
    #proxyBeing = 'human'
    /**
     * @constructor
     * @param {Object} obj - The data object from which to create the avatar
     * @param {Factory} factory - The member factory on which avatar relies for all service interactions
     * @param {LLMServices} llmServices - The LLM services object
     */
    constructor(factory, llmServices){
        super()
        this.#factory = factory
        this.#llmServices = llmServices
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
        this.#bots = await this.#factory.bots(this.id)
        let activeBot = this.avatarBot
        if(!this.isMyLife){
            if(!activeBot.id){ // create: but do not want to call setBot() to activate
                activeBot = await mBot(this)
                this.#bots.unshift(activeBot)
            }
            this.activeBotId = activeBot.id
            this.#llmServices.botId = activeBot.bot_id
            this.#experienceVariables = mAssignExperienceVariables(this.#experienceVariables, this)
            this.#evolver = new EvolutionAssistant(this)
            mAssignEvolverListeners(this.#evolver, this)
            /* init evolver */
            await this.#evolver.init()
        } else { // Q-specific, leave as `else` as is near always false
            // @todo - something doesn't smell right in how session would handle conversations - investigate logic; fine if new Avatar instance is spawned for each session, which might be true
            this.activeBotId = activeBot.id
            activeBot.bot_id = botIdOverride ?? activeBot.bot_id
            this.#llmServices.botId = activeBot.bot_id
            const conversation = await this.createConversation()
            activeBot.thread_id = conversation.threadId
            this.#proxyBeing = 'MyLife'
        }
        this.emit('avatar-init-end', this.conversations)
        return this
    }
    /**
     * Get a bot.
     * @public
     * @param {string} _bot_id - The bot id.
     * @returns {object} - The bot.
     */
    async bot(_bot_id){
        return await this.#factory.bot(_bot_id)
    }
    /**
     * Processes and executes incoming chat request.
     * @todo - cleanup/streamline frontend communication as it really gets limited to Q&A... other events would fire API calls on the same same session, so don't need to be in chat or conversation streams
     * @public
     * @param {object} ctx - The context object.
     * @returns {object} - The response(s) to the chat request.
    */
    async chatRequest(ctx){
        const processStartTime = Date.now()
        const { chatMessage, } = ctx.state
        const { message: prompt, role, thread_id, } = chatMessage
        if(!prompt)
            throw new Error('No message provided in context')
        // send active bot? send active conversation?
        let conversation = this.getConversation(this.activeBot.thread_id)
        if(!conversation){
            conversation = await this.createConversation('chat')
        }
        conversation.botId = this.activeBot.bot_id // pass in via quickly mutating conversation (or independently if preferred in end), versus llmServices which are global
        const messages = await mCallLLM(this.#llmServices, conversation, prompt)
        conversation.addMessages(messages)
        console.log('here', messages.map(message=>message.content[0].text))
        if(allowSave)
            conversation.save()
        else
            console.log('chatRequest::BYPASS-SAVE', conversation.message)
        /* frontend mutations */
        const { activeBot: bot } = this
        // current fe will loop through messages in reverse chronological order
        const chat = conversation.messages
            .filter(message=>{ // limit to current chat response(s); usually one, perhaps faithfully in future [or could be managed in LLM]
                return messages.find(_message=>_message.id===message.id)
                    && message.type==='chat'
                    && message.role!=='user'
            })
            .map(message=>{
                message = mPrepareMessage(message.content) // returns object { category, content }
                const { category, content } = message
                return {
                    activeBotId: bot.id,
                    activeBotAIId: bot.bot_id,
                    agent: 'server',
                    category: category,
                    contributions: [],
                    message: content,
                    purpose: 'chat response',
                    response_time: Date.now()-processStartTime,
                    thread_id: conversation.thread_id,
                    type: 'chat',
                }
            })
        return chat
    }
    async createConversation(type='chat'){
        const thread = await this.#llmServices.thread()
        const conversation = new (this.#factory.conversation)({ mbr_id: this.mbr_id, type: type }, this.#factory, thread, this.activeBotId) // guid only
        this.#conversations.push(conversation)
        return conversation
    }
    /**
     * Ends an experience.
     * @todo - save living experience to cosmos, no need to await
     * @todo - relived experiences? If only saving by experience id then maybe create array?
     * @param {Guid} experienceId 
     * @returns {boolean}
     */
    experienceEnd(experienceId){
        if(this.isMyLife)
            throw new Error('MyLife avatar cannot conduct nor end experiences.')
        if(this.mode!=='experience')
            throw new Error('Avatar is not currently in an experience.')
        if(this.experience.id!==experienceId)
            throw new Error('Avatar is not currently in the requested experience.')
        if(!this.experience.skippable) // @todo - even if skippable, won't this function still process?
            throw new Error('Avatar cannot end this experience at this time, experience is not skippable.')
        this.mode = 'standard'
        this.experience = undefined
        this.#livedExperiences.push(this.#livingExperience.id)
        // @stub - save living experience to cosmos
        console.log('experienceEnd::ended experience:', this.#livingExperience.name)
        this.#livingExperience = undefined
        return true
    }
    /**
     * Processes and executes incoming experience request.
     * @todo - experienceStart has error when route ends in '/', allowed, but fails beacuse eid = guid +'/'
     * @public
     * @param {Guid} experienceId - The experience id.
     * @param {object} memberInput - The member input.
     * @returns {Promise<array>} - The next sequence of evets in experience for front-end.
     */
    async experiencePlay(experienceId, memberInput){
        if(this.isMyLife)
            throw new Error('MyLife avatar cannot present experiences to itself.')
        if(this.mode!=='experience')
            throw new Error('Avatar is not currently in an experience. Experiences must be started.')
        if(experienceId!==this.experienceLocation.experienceId)
            throw new Error(`Experience failure, unexpected experience id mismatch\n- experienceId: ${experienceId} \n- location: ${this.experienceLocation.experienceId}`)
        const events = await mExperiencePlay(
            this.#factory,
            this.#llmServices,
            this.experience,
            this.#livingExperience,
            memberInput,
        )
        return events // final manifest of events [question, could manifest still be needed?]
    }
    /**
     * Returns array of available experiences for the member in shorthand object format, i.e., not a full `Experience` class instance. That is only required when performing.
     * @public
     * @param {boolean} includeLived - Include lived experiences in the list.
     * @returns {Promise<Object[]>} - Array of Experiences "shorthand" objects.
     * @property {Guid} autoplay - The id of the experience to autoplay, if any.
     * @property {Object[]} experiences - Array of shorthand experiences.
     */
    async experiences(includeLived=false){
        const experiences = mExperiences(await this.#factory.experiences(includeLived))
        return experiences
    }
    async experiencesLived(){
        // get experiences-lived [stub]
        const livedExperiences = await this.#factory.experiencesLived()
    }
    /**
     * Starts an avatar experience.
     * @todo - scene and event id start points
     * @param {Guid} experienceId - Experience id to start.
     * @param {Guid} sceneId - Scene id to start, optional.
     * @param {Guid} eventId - Event id to start, optional.
     * @returns {Promise<void>} - Returns void if avatar started experience successfully.
     */
    async experienceStart(experienceId, sceneId, eventId){
        if(this.mode==='experience')
            throw new Error(`Avatar is currently conducting experience "${this.experience.id}"`)
        await mExperienceStart( // throws error if fails
            this,
            this.#factory,
            experienceId,
            this.#experienceVariables
        )
        return
    }
    /**
     * Gets Conversation object. If no thread id, creates new conversation.
     * @param {string} thread_id - openai thread id
     * @param {string} type - Type of conversation: chat, experience, dialog, inter-system, etc.
     * @returns {Conversation} - The conversation object.
     */
    getConversation(thread_id){
        return this.#conversations
            .find(_=>_.thread?.id===thread_id)
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
    get activeBotAIId(){
        return this.activeBot.bot_id
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
        return this.#llmServices
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
     * Get the cast members in frontend format.
     * @getter
     * @returns {Object[]} - Array of ExperienceCastMembers.
     */
    get cast(){
        return this.experience.castMembers
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
     * Get the cast.
     * @getter
     * @returns {array} - The cast.
     */
    get cast(){
        return this.experience.cast
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
        return this.#factory.conversation
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
     * Get the current experience location (or pointer). Should always map to the last event being sent, if inspecting an array of events via `api.experience()`.
     * @getter
     * @returns {object} - The current experience location.
     */
    get experienceLocation(){
        return this.#livingExperience.location
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
    get isInExperience(){
        return this.mode==='experience'
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
     * Get the current living.
     */
    get livingExperience(){
        if(!this.isInExperience) return false
        // **note**: `dialog` and `scriptDialog` conversations must be assigned to object separately (requires await)
        if(!this.#livingExperience){
            this.#livingExperience = new (this.#factory.livedExperience)({
                cast: this.cast,
                location: {
                    experienceId: this.experience.id,
                    eventId: this.experience.scenes[0].events[0].id,
                    iteration: 0,
                    sceneId: this.experience.scenes[0].id,
                },
                mbr_id: this.mbr_id,
                version: this.experience.version??0,
            }) // create shell for storing lived experience
        }
        return this.#livingExperience
    }
    /**
     * Returns manifest for navigation of scenes/events and cast for the current experience.
     * @returns {ExperienceManifest} - The experience manifest.
     * @property {ExperienceCastMember[]} cast - The cast array for the experience.
     * @property {Object[]} navigation - The scene navigation array for the experience.
     */
    get manifest(){
        if(!this.isInExperience)
            throw new Error('Avatar is not currently in an experience.')
        return this.experience.manifest
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
        return this.#factory.message
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
    /**
     * Get experience scene navigation array.
     * @getter
     * @returns {Object[]} - The scene navigation array for the experience.
     * @property {Guid} id - The scene id.
     * @property {string} description - The scene description.
     * @property {Object[]} events - The scene events. @stub
     * @property {number} order - The scene order, default=1.
     * @property {boolean} required - Whether the scene is required, default=false.
     * @property {boolean} skippable - Whether the scene is skippable, default=true.
     * @property {string} title - The scene name.
     */
    get navigation(){
        return this.experience.navigation
    }
}
/* modular functions */
/**
 * Initializes openAI assistant and returns associated `assistant` object.
 * @modular
 * @param {LLMServices} llmServices - OpenAI object
 * @param {object} _botData - bot creation instructions.
 * @returns {object} - [OpenAI assistant object](https://platform.openai.com/docs/api-reference/assistants/object)
 */
async function mAI_openai(llmServices, _botData){
    const _assistantData = {
        description: _botData.description,
        model: _botData.model,
        name: _botData.bot_name??_botData.name, // take friendly name before Cosmos
        instructions: _botData.instructions,
    }
    return await llmServices.beta.assistants.create(_assistantData)
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
        const conversation = await _avatar.getConversation()
        _bot.thread_id = conversation.thread_id
    }
    // update Cosmos (no need async)
    _avatar.factory.setBot(_bot)
    return _bot
}
/**
 * Makes call to LLM and to return response(s) to prompt.\
 * @todo - create actor-bot for internal chat? Concern is that API-assistants are only a storage vehicle, ergo not an embedded fine tune as I thought (i.e., there still may be room for new fine-tuning exercise); i.e., micro-instructionsets need to be developed for most. Unclear if direct thread/message instructions override or ADD, could check documentation or gpt, but...
 * @todo - address disconnect between conversations held in memory in avatar and those in openAI threads; use `addLLMMessages` to post internally
 * @modular
 * @param {LLMServices} llmServices - OpenAI object currently
 * @param {Conversation} conversation - Conversation object
 * @param {string} prompt - dialog-prompt/message for llm
 * @returns {Promise<Object[]>} - Array of Message instances in descending chronological order.
 */
async function mCallLLM(llmServices, conversation, prompt){
    const { thread_id: threadId } = conversation
    if(!threadId)
        throw new Error('No `thread_id` found for conversation')
    if(!conversation.botId)
        throw new Error('No `botId` found for conversation')
    const messages = await llmServices.getLLMResponse(threadId, conversation.botId, prompt)
    messages.sort((mA, mB) => {
        return mB.created_at - mA.created_at
    })
    return messages
}
/**
 * Cancels openAI run.
 * @modular
 * @param {LLMServices} llmServices - OpenAI object
 * @param {string} threadId - Thread id
 * @param {string} runId - Run id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mCancelRun(llmServices, threadId, runId,){
    return await llmServices.beta.threads.runs.cancel(
        threadId,
        runId
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
                actor.bot_id = actor.bot.id
                break
            case 'bot':
            case 'member':
            case 'member-bot':
            default:
                actor.bot = await factory.bot() // should be new-member safe, but check
                actor.bot_id = actor.bot.id
                break
        }
        return actor
    }))
    return cast
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
 * Returns a processed stage event.
 * @todo - add LLM usage data to conversation.
 * @todo - when `action==='stage'`, deprecate effects and actor
 * @modular
 * @public
 * @param {LLMServices} llm - OpenAI object currently.
 * @param {Experience} experience - Experience class instance.
 * @param {Object} stage - `Event.stage` data object.
 * @returns {Object} - Synthetic Stage object.
 */
function mEventStage(llm, experience, stage){
    if(!stage)
        return // no stage to parse
    if((stage.type??'script')!=='script'){
        console.log('Dynamic stage effects not yet implemented')
        stage.type = 'script' // force standardization
    }
    return stage
}
/**
 * Returns processed dialog as string.
 * @todo - add LLM usage data to conversation
 * @todo - when `variable` undefined in `experience.variables`, check to see if event can be found that will provide it
 * @todo - seems unnecessary to have experience extension handling basic data construction at this stage... refactor, tho?
 * @modular
 * @public
 * @param {LLMServices} llm - OpenAI object currently
 * @param {Experience} experience - Experience class instance.
 * @param {LivedExperience} livingExperience - LivedExperience object
 * @param {ExperienceEvent} event - Event object
 * @param {number} iteration - The current iteration number (iterations _also_ allow for `refresh` of dialog front-end)
 * @returns {Promise<string>} - Parsed piece of event dialog
 */
async function mEventDialog(llm, experience, livingExperience, event, iteration=0){
    const { character, dialog: eventDialog, id: eventId, useDialogCache, } = event
    if(!eventDialog || !Object.keys(eventDialog).length)
        return // no dialog to parse
    if(!character)
        throw new Error('Dialog error, no character identified.')
    const { characterId: _id, id } = character
    const characterId = id ?? _id
    if(useDialogCache){
        const livingEvent = livingExperience.events.find(_event=>_event.id===id)
        if(livingEvent)
            return livingEvent.dialog
    }
    let dialog = experience.dialog(eventId, iteration)
    if(!dialog)
        throw new Error('Dialog error, could not establish dialog.')
    const { content, dialog: dialogDialog, example, prompt: dialogPrompt, text, type, variables } = dialog
    const dialogVariables = variables ?? event.variables ?? experience.variables ?? []
    switch(type){
        case 'script':
            const scriptedDialog = dialogDialog
                ?? text
                ?? dialogPrompt
                ?? content
            if(!scriptedDialog)
                throw new Error('Script line requested, no content identified.')
            return scriptedDialog
        case 'prompt':
            if(!dialogPrompt)
                throw new Error('Dynamic script requested, no prompt identified.')
            let prompt = dialogPrompt
            if(example?.length)
                prompt = `using example: "${example}";\n` + prompt
            // check for content variables and replace
            if(dialogVariables.length){
                dialogVariables.forEach(keyName=>{
                    const value = experience.experienceVariables[keyName]
                    if(value){
                        // @todo: find input event where variable is identified as input and insert (if logic allows, otherwise error)
                        prompt = prompt.replace(new RegExp(`@@${keyName}`, 'g'), value)
                    }
                })
            }
            // **note**: system chat would refer to `Q`, but I want any internal chat to go through this channel, depending on cast member
            const { cast, scriptAdvisorBotId } = experience
            const { dialog: coreDialog, scriptDialog } = livingExperience
            const castMember = cast.find(castMember=>castMember.id===characterId)
            scriptDialog.botId = castMember.bot?.bot_id ?? scriptAdvisorBotId ?? this.activebot.bot_id // set llm assistant id
            const messages = await mCallLLM(llm, scriptDialog, prompt) ?? []
            if(!messages.length){
                console.log('mEventDialog::no messages returned from LLM', prompt, scriptDialog.botId)
            }
            scriptDialog.addMessages(messages)
            coreDialog.addMessage(scriptDialog.mostRecentDialog)
            return coreDialog.mostRecentDialog
        default:
            throw new Error(`Dialog type \`${type}\` not recognized`)
    }   
}
/**
 * Returns a processed memberInput event.
 * @todo - once conversations are not spurred until needed, add a third conversation to the experience, which would be the scriptAdvisor (not actor) to determine success conditions for scene, etc.
 * @todo - handle complex success conditions
 * @modular
 * @public
 * @param {LLMServices} llm - OpenAI object currently.
 * @param {Experience} experience - Experience class instance.
 * @param {LivedExperience} livingExperience - LivedExperience object.
 * @param {ExperienceEvent} event - Event object.
 * @param {number} iteration - The current iteration number.
 * @param {object} memberInput - Member input, any data type.
 * @returns {Promise<object>} - Synthetic Input Event.
 * @note - review https://platform.openai.com/docs/assistants/tools/defining-functions
 */
async function mEventInput(llm, experience, livingExperience, event, iteration=0, memberInput){
    const { character, id: eventId, input, type='script' } = event
    const { characterId: _id, id } = character
    const characterId = id ?? _id
    const { dialog, events, scriptAdvisor, scriptDialog, } = livingExperience
    const hasMemberInput = 
            ( typeof memberInput==='object' && Object.keys(memberInput)?.length )
         || ( typeof memberInput==='string' && ( memberInput.trim().length ?? false ) )
         || ( Array.isArray(memberInput) && memberInput.length && memberInput[0])
    const livingEvent = events.find(_event=>_event.id===eventId)
    /* return initial or repeat request without input */
    input.complete = false
    if(!hasMemberInput){
        if(livingEvent){
            livingEvent.input.useDialogCache = true
            return livingEvent.input
        }
        return input
    }
    /* process and flatten memberInput */
    switch(input.inputType){
        case 'input':
        case 'text':
        case 'textarea':
            switch(typeof memberInput){
                case 'array':
                    memberInput = memberInput?.[0]??''
                    break
                case 'object':
                    // grab first key, ought have been string
                    memberInput = Object.values(memberInput)?.[0]??''
                    break
                }
            break
        default:
            break
    }
    /* local success variants */
    if(!input.condition?.trim()?.length){
        if(memberInput.trim().length){
            // add user message to livingExperience dialog
            input.complete = true
            return input
        }
    }
    /* consult LLM scriptAdvisor */
    let prompt = 'CONDITION: '
        + input.condition.trim()
        + '\n'
        + 'RESPONSE: '
        + memberInput.trim()
        + '\n'
    if(input.outcome?.trim()?.length)
        prompt += 'OUTCOME: return JSON-parsable object = '
            + input.outcome.trim()
    const scriptAdvisorBotId = experience.scriptAdvisorBotId
        ?? experience.cast.find(castMember=>castMember.id===characterId)?.bot?.bot_id
        ?? experience.cast[0]?.bot?.bot_id
    const scriptConsultant = scriptAdvisor ?? scriptDialog ?? dialog
    scriptConsultant.botId = scriptAdvisorBotId
    const messages = await mCallLLM(llm, scriptConsultant, prompt) ?? []
    if(!messages.length){
        console.log('mEventInput::no messages returned from LLM', prompt, scriptAdvisorBotId, scriptConsultant)
        throw new Error('No messages returned from LLM')
    }
    scriptConsultant.addMessages(messages)
    /* validate return from LLM */
    let evaluationResponse = scriptConsultant.mostRecentDialog
    if(!evaluationResponse.length)
        throw new Error('LLM content did not return a string')
    evaluationResponse = evaluationResponse.replace(/\\n|\n/g, '')
    evaluationResponse = evaluationResponse.substring(
        evaluationResponse.indexOf('{'),
        evaluationResponse.lastIndexOf('}')+1,
    )
    try{
        evaluationResponse = JSON.parse(evaluationResponse) // convert to JSON
    } catch(err){
        console.log('JSON PARSING ERROR', err, evaluationResponse)
        evaluationResponse = evaluationResponse.replace(/([a-zA-Z0-9_$\-]+):/g, '"$1":') // keys must be in quotes
        evaluationResponse = JSON.parse(evaluationResponse)
    }
    const evaluationSuccess = evaluationResponse.success
        || (typeof evaluationResponse === 'object' && Object.keys(evaluationResponse).length)
    if(!evaluationSuccess){ // default to true, as object may well have been returned
        // @todo - handle failure; run through script again, probably at one layer up from here
        input.followup = evaluationResponse.followup ?? input.followup
        return input
    }
    input.variables.forEach(_variable=>{ // when variables found, add to experience.experienceVariables
        console.log('mEventInput::evaluationResponse', _variable, evaluationResponse)
        experience.experienceVariables[_variable] = evaluationResponse.outcome?.[_variable]
            ?? evaluationResponse?.[_variable] // when wrong bot used, will send back raw JSON object
    })
    if(typeof input.success === 'object'){ // @stub - handle complex object success object conditions
        // denotes multiple potential success outcomes, currently scene/event branching based on content
        // See success_complex in API script, key is variable, value is potential values _or_ event guid
        // loop through keys and compare to experience.experienceVariables
    }
    input.complete = input.success ?? false
    return input
}
/**
 * Processes an event and adds appropriate accessors to `ExperienceEvent` passed instance.
 *   1. Stage `event.stage`
 *   2. Dialog `event.dialog`
 *   3. Input `event.input`
 * @todo - keep track of iterations inside livingExperience to manage flow
 * @todo - JSON data should NOT be in data, but instead one of the three wrappers: stage, dialog, input; STAGE done
 * @todo - mutations should be handled by `ExperienceEvent` extenders.
 * @todo - script dialog change, input assessment, success evals to completions or cheaper? babbage-002 ($0.40/m) is only cheaper than 3.5 ($3.00/m); can test efficacy for dialog completion, otherwise, 3.5 exceptional
 * @todo - iterations need to be re-included, although for now, one dialog for experience is fine
 * @modular
 * @public
 * @param {LLMServices} llm - OpenAI object currently
 * @param {Experience} experience - Experience class instance.
 * @param {LivedExperience} livingExperience - LivedExperience object
 * @param {ExperienceEvent} event - Event object
 * @param {object} memberInput - Member input
 * @returns {Promise<ExperienceEvent>} - Event object
 */
async function mEventProcess(llm, experience, livingExperience, event, memberInput){
    const { events, location, } = livingExperience
    const { action, id } = event
    let { character, dialog, input, stage, } = event
    switch(action){ // **note**: intentional pass-throughs on `switch`
        case 'input':
            if(input && Object.keys(input).length){
                const _input = await mEventInput(llm, experience, livingExperience, event, undefined, memberInput)
                input = _input
                event.complete = input.complete
                event.skip = input.complete // member input need not be in event scheme
                event.useDialogCache = input.useDialogCache
            }
            if(event.complete)
                break
        case 'dialog':
            // dialog from inputs cascading down already have iteration information
            if(dialog && Object.keys(dialog).length)
                dialog.dialog = await mEventDialog(llm, experience, livingExperience, event)
        case 'character':
        case 'stage':
            if(stage && Object.keys(stage).length)
                stage = mEventStage(llm, experience, stage)
            event.complete = event.complete ?? true // when `false`, value retained
            break
        default: // error/failure
            throw new Error('Event action not recognized')
    }
    event.experienceId = location.experienceId // not native, since redundant
    event.sceneId = location.sceneId // not native, since redundant
    /* log to livingExperience */
    events.push(event)
    /* update location pointers */
    location.eventId = event.id
    location.iteration = event.complete ? 0 : location.iteration + 1
    return mSanitizeEvent(event)
}
/**
 * Starts or continues experience with avatar functionality as director/puppeteer. Everything is herein mutated and returned as one final experience instructionset to front-end.
 * @todo - allow auto-skip to scene/event?
 * @todo - Branching and requirements for scene entry and completion
 * @todo - ExperienceScene and ExperienceEvent should be classes?
 * @modular
 * @public
 * @param {AgentFactory} factory - AgentFactory object
 * @param {object} llm - ai interface object
 * @param {Experience} experience - Experience object
 * @param {LivedExperience} livingExperience - LivedExperience object
 * @param {object} memberInput - Member input
 * @returns {Promise<Array>} - An array of ExperienceEvent objects.
 */
async function mExperiencePlay(factory, llm, experience, livingExperience, memberInput){
    // okay, here is thinking - the living experience stores the important outcomes, and if they need to be relived, a different call is made to pull from the lived event in the /living experience
    // always pitch current event, and no other when "repeated"
    const { sceneId, eventId } = livingExperience.location
    let currentEvent = experience.event(eventId)
    const currentScene = experience.scene(sceneId)
    let eventIndex = currentScene.events.findIndex(event => event.id === currentEvent.id)
    if(eventIndex === -1)
        throw new Error('Event not found in scene')
    const eventSequence = []
    const maxSceneIndex = currentScene.events.length - 1
    let sceneComplete = true // presume to display entire scene from eventIndex
    while(eventIndex <= maxSceneIndex){
        const _event = new (factory.experienceEvent)(currentScene.events[eventIndex])
        const event = await mEventProcess(llm, experience, livingExperience, _event, memberInput)
        if(event.skip){ // currently no occasion
            console.log('mExperiencePlay: event skipped, not presented to frontend')
        } else {
            eventSequence.push(event)
        }
        if(!event.complete){
            console.log('mExperiencePlay: event incomplete', event)
            sceneComplete = false
            break
        } // INPUT event incomplete
        eventIndex++
    }
    /* end-of-scene */
    if(sceneComplete){
        // @stub - check for additional scene requirements (beyond being finished)
        // @stub - check for scene branching
        eventSequence.push({
            action: 'end',
            complete: true,
            id: sceneId,
            experienceId: experience.id,
            sceneId: sceneId,
            type: 'scene',
        }) // provide marker for front-end [end of event dequence]; begin next scene with next request
        const nextScene = experience.sceneNext(currentScene.id)
        if(nextScene){
            livingExperience.location.sceneId = nextScene.id
            livingExperience.location.eventId = nextScene.events[0].id
            console.log('mExperiencePlay: next scene', nextScene)
        } else {
            /* end-of-experience */
            eventSequence.push({
                action: 'end',
                complete: true,
                id: experience.id,
                experienceId: experience.id,
                type: 'experience',
            }) // provide marker for front-end [end of event sequence]
        }
    }
    return eventSequence
}
/**
 * Takes an experience document and converts it to use by frontend. Also filters out any inappropriate experiences.
 * @param {array<object>} experiences - Array of Experience document objects.
 * @returns {array<object>} - Array of Experience shorthand objects.
 * @property {boolean} autoplay - Whether or not the experience is autoplay.
 * @property {string} description - The description of the experience.
 * @property {guid} id - The id of the experience.
 * @property {string} name - The name of the experience.
 * @property {string} purpose - The purpose of the experience.
 * @property {boolean} skippable - Whether or not the experience is skippable
 */
function mExperiences(experiences){
    return experiences
        .filter(experience=>{
            const { status, dates, } = experience
            const { end, runend, runEnd, runstart, runStart, start, } = dates
            const now = Date.now()
            const startDate = start || runstart || runStart
                ? new Date(start ?? runstart ?? runStart).getTime()
                : now
            const endDate = end || runend || runEnd
                ? new Date(end ?? runend ?? runEnd).getTime()
                : now          
            return status==='active'
                && startDate <= now 
                && endDate >= now
        })
        .map(experience=>{ // map to display versions
            const { autoplay=false, description, id, name, purpose, skippable=true,  } = experience
            return {
                autoplay,
                description,
                id,
                name,
                purpose,
                skippable,
            }
        })
}
/**
 * Starts Experience.
 * @todo - sceneId and eventId start forms
 * @param {Avatar} avatar - Avatar object.
 * @param {AgentFactory} factory - AgentFactory object.
 * @param {guid} experienceId - Experience id.
 * @param {object} avatarExperienceVariables - Experience variables object from Avatar class definition.
 * @returns {Promise<void>} - Successfully mutated avatar.
 */
async function mExperienceStart(avatar, factory, experienceId, avatarExperienceVariables){
    let _experience = await factory.getExperience(experienceId) // database object
    if(!_experience)
        throw new Error('Experience not found')
    /* hydrate experience */
    avatar.mode = 'experience'
    avatar.experience = await ( new (factory.experience)(_experience) )
        .init(avatarExperienceVariables)
    const { livingExperience, experience, mode } = avatar
    const { id, scenes } = experience
    if(id!==experienceId)
        throw new Error('Experience failure, unexpected id mismatch.')
    experience.cast = await mCast(factory, experience.cast) // hydrates cast data
    experience.location = livingExperience.location
    experience.navigation = mNavigation(scenes) // hydrate scene data for navigation
    /* assign living experience */
    let [dialog, scriptDialog] = await Promise.all([
        avatar.createConversation('experience'),
        avatar.createConversation('dialog')
    ]) // async cobstruction
    livingExperience.dialog = dialog
    livingExperience.scriptDialog = scriptDialog
    return
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
 * Get experience scene navigation array.
 * @getter
 * @returns {Object[]} - The scene navigation array for the experience.
 * @property {Guid} id - The scene id.
 * @property {string} description - The scene description.
 * @property {Object[]} events - The scene events. @stub not currently included
 * @property {number} order - The scene order, default=1.
 * @property {boolean} required - Whether the scene is required, default=false.
 * @property {boolean} skippable - Whether the scene is skippable, default=true.
 * @property {string} title - The scene name.
 */
function mNavigation(scenes){
    return scenes
        .map(scene=>{
            const { id, description, order=1, required=false, skippable=true, title=`untitled` } = scene
            return {
                id,
                description,
                order,
                required,
                skippable,
                title,
            }
        })
        .sort((a,b)=>{
            return a.order - b.order
        })
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
 * Returns a sanitized event.
 * @modular
 * @param {ExperienceEvent} event - Event object.
 * @returns {object} - Synthetic Event object.
 */
function mSanitizeEvent(event){
    const { action, character, breakpoint, complete, dialog, experienceId, id, input, order, sceneId, skip=false, stage, type, useDialogCache,  } = event
    return {
        action,
        character,
        breakpoint,
        complete,
        dialog,
        experienceId,
        id,
        input,
        order,
        sceneId,
        skip,
        stage,
        type,
        useDialogCache,
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