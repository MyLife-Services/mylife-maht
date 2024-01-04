import { EventEmitter } from 'events'
import { EvolutionAssistant } from '../agents/system/evolution-assistant.mjs'
import {
    mAssignEvolverListeners,
    mChat,
    mCreateAssistant,
    mGetAssistant,
    mGetChatCategory,
    mMessages,
    mRuns,
 } from './class-avatar-functions.mjs'
import { _ } from 'ajv'
import { parse } from 'path'
//  function definitions to extend remarkable classes
function extendClass_avatar(_originClass,_references) {
    class Avatar extends _originClass {
        #activeChatCategory = mGetChatCategory()
        #emitter = new EventEmitter()
        #evolver
        #factory
        #openai = _references?.openai
        #proxyBeing = 'human'
        constructor(_obj,_factory) {
            super(_obj) //  should include contributions from db or from class schema
            if(_obj.proxyBeing)
                this.#proxyBeing = _obj.proxyBeing
            this.#factory = _factory
        }
        async init(){
            /* create evolver (exclude MyLife) */
            if(!this.factory.isMyLife){
                this.#evolver = new EvolutionAssistant(this)
                mAssignEvolverListeners(this.#evolver, this)
                /* init evolver */
                await this.#evolver.init()
            }
            this.emit('avatar-init-end',this)
            return this
        }
        /* public functions */
        /**
         * Processes and executes incoming category set request.
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
         * Processes and executes incoming chat request.
         * @public
         * @param {object} ctx - The context object.
         * @returns {object} - The response(s) to the chat request.
        */
        async chatRequest(ctx){
            if(!ctx?.state?.chatMessage)
                throw new Error('No message provided in context')
            if(!this.thread)
                this.thread = ctx.state.thread
            this.setActiveCategory(ctx.state.chatMessage) // also sets evolver contribution
            return mChat(
                this.#openai, 
                this, 
                ctx.state.chatMessage, 
                ctx.state.MemberSession.conversation.id
            )
        }
        /**
         * Proxy for emitter.
         * @public
         * @param {string} _eventName - The event to emit.
         * @param {any} - The event(s) to emit.
         * @returns {void}
         */
        emit(_eventName, ...args){
            this.#emitter.emit(_eventName, ...args)
        }
        async getAssistant(_dataservice){	//	openai `assistant` object
            //	3 states: 1) no assistant, 2) assistant id, 3) assistant object
            if(!this.assistant?.id.length) {
                this.assistant = await mCreateAssistant(this.#openai, this)
                //	save id to cosmos
                _dataservice.patch(this.id, {
                    assistant: {
                        id: this.assistant.id
                    ,	object: 'assistant'
                    }
                })
            } else if(!this.assistant?.name?.length){
                this.assistant = await mGetAssistant(this.#openai, this.assistant.id)
            }
            return this.assistant
        }
        async getMessage(_msg_id){	//	returns openai `message` object
            return this.messages.data
                .filter(_msg=>{ return _msg.id==_msg_id })
        }
        async getMessages(){
            this.messages = ( await mMessages(this.#openai, this.thread.id) )
                .data
            console.log('getMessages', this.messages)
            return this.messages
        }
        on(_eventName, listener){
            this.#emitter.on(_eventName, listener)
        }
        /* getters/setters */
        get avatar(){
            return this.inspect(true)
        }
        /**
         * Get the "avatar's" being, or more precisely the name of the being (affiliated object) the evatar is emulating.
         * Avatars are special case and are always avatars, so when we query them non-internally for system purposes (in which case we understand we need to go directly to factory.core.being) we display the underlying essence of the datacore; could put this in its own variable, but this seems protective _and_ gives an access point for alterations.
         * @returns {string} The object being the avatar is emulating.
        */
        get being(){    //  
            return this.#proxyBeing
        }
        get category(){
            return this.#activeChatCategory
        }
        set category(_category){
            this.#activeChatCategory = _category
        }
        get contributions(){
            return this.#evolver?.contributions
        }
        /**
         * Set incoming contribution.
         * @param {object} _contribution
        */
       set contribution(_contribution){
           this.#evolver.contribution = _contribution
        }
        // todo: deprecate to available convenience public emit() function
        get emitter(){  //  allows parent to squeeze out an emitter
            return this.#emitter
        }
        get factory(){
            return this.#factory
        }
        /**
         * Get uninstantiated class definition for message.
         * @returns {class} - class definition for message
         */
        get message(){
            return this.factory.message
        }
    }
    console.log('Avatar class extended')
    return Avatar
}
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
        constructor(_obj) {
            super(_obj)
        }
        //  public functions
        findMessage(_message_id){
            //  given this conversation, retrieve message by id
            return _message_id
        }
        //  public getters/setters
        get messages(){
            return this?.messages??[]
        }
        //  private functions
    }

    return Conversation

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
            mReviewContent(this, _obj)
        }
        /* public functions */
        async init(_thread){
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
            this.#message = await mGetMessage_openAI(
                _thread,
                this.content,
                this?.message?.id,
                this.#openai
            )
            return this
        }
        /* getters/setters */
        get message(){
            return this.#message
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
/* modular functions */
/* contribution modular functions */
/**
 * Evaluates Contribution and may update `status` property.
 * @modular
 * @param {Contribution} _contribution - Contribution object
 * @returns {void}
 */
function mEvaluateStatus(_contribution){
    // assess `status`
    // statuses=["new", "pending", "prepared", "requested", "submitted", "accepted", "rejected"],
    switch(true){
        case(['submitted', 'accepted', 'rejected'].includes(_contribution.status)):
            //  intentionally empty, different process manages, no change
            break
        case (_contribution.responses.length === 1): // **note** `.question` = responses[0]
            _contribution.status = 'pending'
            _contribution.emit('on-contribution-prepared', _contribution.id)
            break
        case(_contribution.responses.length > 1): // subsequent objects, by logic = response included
            _contribution.status = 'requested'
            break
        default:
            _contribution.status = 'pending' // no emission
            break
    }
}
/**
 * Updates contribution object with incoming contribution data.
 * @modular
 * @param {Contribution} _contribution - Contribution object
 * @param {object} _obj - Contribution data { category, contributionId, content??question??message }
 * @returns {void}
 */
function mUpdateContribution(_contribution, _obj){
    if(_obj?.question ?? _obj?.content ?? _obj?.message){
        _contribution.responses.unshift( // todo: ensure incoming has _only_ `content`
            _obj.question??
            _obj.content??
            _obj.message
        )
    }
    mEvaluateStatus(_contribution) // evaluates readiness for next stage of Contribution
}
/* message modular functions */
function mExtractCategory(_category){
    return _category
        .replace('Category Mode: ', '')
        .replace(/\n/g, '') // Remove all newline characters
        .trim()
        .replace(/\s+/g, '_')
        .toLowerCase()
}
/**
 * add or update openai portion of `this.message`
 * @private
 * @param {string} _message 
 * @returns {object} openai `message` object
 */
async function mGetMessage_openAI(_thread, _content, _msg_id, _openai){
    //  files are attached at the message level under file_ids _array_, only content aside from text = [image_file]:image_file.file_id
    return (!_msg_id)
    ?	await _openai.beta.threads.messages.create(	//	add
            _thread.id,
            mGetMessage_openAIFormat(_content)
        )
    :	await _openai.beta.threads.messages.update(	//	update
            _thread.id,
            _msg_id,
            mGetMessage_openAIFormat(_content)
        )
    /* TODO: code for message retrieval
    switch (this.system) {
        case 'openai_assistant':
            return await this.#openai.beta.threads.messages.retrieve(
                this.message.message.thread_id,
                this.message.id
            )
        default:
            break
    }
    */
}
function mGetMessage_openAIFormat(_message){
    return {
        role: 'user',
        content: _message,
//         file: this.file,
    }
}
/**
 * Gets questions from Cosmos, but could request from openAI.
 * @param {Contribution} _contribution Contribution object
 * @param {OpenAI} _openai OpenAI object
 * @returns {string}
 */
async function mGetQuestions(_contribution, _openai){
    /*  get questions from openAI
        -   if no content, generate questions for description
        -   if content, generate questions with intent to nuance content
    */
   const _contribution_request = _contribution.request
    if(!_contribution_request?.content){ //  null nodes render to false
        const _response = await _contribution.factory.getContributionQuestions(
            _contribution_request.impersonation,
            _contribution_request.category,
        )
        return _response
    }
    if(!process.env?.MYLIFE_ALLOW_INTELLIGENT_QUESTIONS??false)
        return ['What is the meaning of life?']
    //  generate question(s) from openAI when required
    const _response = await _evoAgent.openai.completions.create({
        model: 'gpt-3.5-turbo-instruct',
        prompt: 'give a list of 3 questions (markdown bullets) used to ' + (
            (!this.request.content)
            ?   `get more information about a ${this.request.impersonation} regarding its ${this.request.category}`
            :   `improve the following description of a ${this.request.impersonation} regarding its ${this.request.category}: "${this.request.content}"`
        ),
        temperature: 0.76,
        max_tokens: 700,
        top_p: 0.71,
        best_of: 5,
        frequency_penalty: 0.87,
        presence_penalty: 0.54,
    })
    //  parse response
    return _response.choices[0].text
        .split('\n')    // Split into lines
        .map(line => line.trim())   // Trim each line
        .filter(line => line.startsWith('-'))   // Filter lines that start with '-'
        .map(line => line.substring(1).trim())  // Remove the '-' and extra space
}
/**
 * Assigns content (from _message.message) to message object.
 * @modular
 * @param {Message} _message Message object
 * @param {object} _obj Object to assign to message
 */
function mReviewContent(_message, _obj){
    _message.content = (_obj?.category?.length)
        ?   `Category Mode: ${_obj.category}. If asked: ${_obj.question}, I would say: ` + _obj.message // todo: cleanse/prepare message function
        :   _obj?.message??
            _obj?.content??
            _message?.content??
            ''
}
/* exports */
export {
	extendClass_avatar,
	extendClass_consent,
    extendClass_contribution,
    extendClass_conversation,
    extendClass_file,
	extendClass_message,
}