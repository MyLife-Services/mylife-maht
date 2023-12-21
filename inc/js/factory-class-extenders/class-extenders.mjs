import { EventEmitter } from 'events'
import { Marked } from 'marked'
import { EvolutionAssistant } from '../agents/system/evolution-assistant.mjs'
import { _ } from 'ajv'
//  function definitions to extend remarkable classes
function extendClass_avatar(_originClass,_references) {
    class Avatar extends _originClass {
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
            /* create evolver */
            this.#evolver = new EvolutionAssistant(this)
            /* assign evolver listeners */
            this.#evolver.on(
                'on-new-contribution',
                _contribution=>{this.emitter.emit('on-new-contribution', _contribution) }
            )
            /* init evolver */
            await this.#evolver.init()
            this.emitter.emit('avatar-init-end',this)
            return this
        }
        /* getters/setters */
        get avatar(){
            return this.inspect(true)
        }
        get being(){    //  avatars are special case and are always avatars, so when we query them non-internally for system purposes (in which case we understand we need to go directly to factory.core.being) we display the underlying essence of the datacore; could put this in its own variable, but this seems protective _and_ gives an access point for alterations
            return this.#proxyBeing
        }
        get contributions(){
            return this.#evolver.contributions
        }
        /**
         * Set incoming contribution.
         * @param {object} _contribution
         */
        set contribution(_contribution){
            this.#evolver.contribution = _contribution
        }
        get emitter(){  //  allows parent to squeeze out an emitter
            return this.#emitter
        }
        get factory(){
            return this.#factory
        }
        get openai(){
            return this.#openai
        }
        //	based on avatar.type, could assign different prototypes
        //  public functions
        async cancelRun(_run_id){	//	returns openai run object
            return await this.openai.beta.threads.runs.cancel(
                this.thread.id,
                _run_id
            )
        }
        async chatRequest(ctx){
            if(!ctx) {
                throw new Error('No context provided in factory')
            }
            if(!this.thread)
                this.thread = ctx.session.MemberSession.thread
            //  add metata, optional
            //	assign uploaded files (optional) and push `retrieval` to tools
            //	create message
            const _message = new (this.factory.message)({
                avatar_id: this.id,
                content: ctx.request.body.message,
                mbr_id: this.mbr_id,
                role: 'user',
            })
            await _message.init(this.thread) //  by embedding content above, init routine requires no parameters
            this.messages.unshift(_message)
            console.log('this.messages-01', this.messages)
            //	run thread
            await this.run()
            //	get message data from thread

const ____messages = await this.getMessages()
const ____fmessages = ____messages
    .filter(_msg => _msg.run_id == this.runs[0].id)
    .map(_msg => {
        return new (this.factory.message)({
            avatar_id: this.id,
            content: _msg.content[0].text.value,
            mbr_id: this.mbr_id,
            role: 'assistant',
        })
    })

const _responses = await Promise.all(
    ____fmessages.map(async _msg => {
        return await _msg.init(this.thread)
    })
)
this.messages.unshift(..._responses)	//	post each response to this.messages
console.log('this.messages', this.messages)
            //	update cosmos
            if(this?.factory)
                await this.factory.dataservices.patchArrayItems(
                    ctx.session.MemberSession.conversation.id,
                    'messages',
                    [..._responses, _message]
                )
            //	return response
            return _responses
                .map(_msg=>{
                    return new Marked().parse(_msg.text)
                })
                .join('\n')
        }
        async checkStatus(_thread_id,_run_id,_callInterval){
            //	should be able to remove params aside from _callInterval, as they are properties of this
            const _run = await this.openai.beta.threads.runs.retrieve(
                _thread_id,
                _run_id
            )
            switch(_run.status){
                //	https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
                case 'completed':
                    if(!this?.runs[0]?.id === _run_id) this.runs.unshift(_run)	//	add
                    else this.runs[0] = _run	//	update
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
                    console.log(`...${_run.status}:${_thread_id}...`)
                    break
            }
        }
        async completeRun(_run_id){
            return new Promise((resolve, reject) => {
                const checkInterval = setInterval(async () => {
                    try {
                        const status = await this.checkStatus(this.thread.id, _run_id)
                        if (status) {
                            clearInterval(checkInterval)
                            resolve('Run completed')
                        }
                    } catch (error) {
                        clearInterval(checkInterval)
                        reject(error)
                    }
                }, 700)
                // Set a timeout to resolve the promise after 12 seconds
                setTimeout(() => {
                    clearInterval(checkInterval)
                    resolve('Run completed (timeout)')
                }, 220000)
            })
        }
        async getAssistant(_dataservice){	//	openai `assistant` object
            //	3 states: 1) no assistant, 2) assistant id, 3) assistant object
            if(!this.assistant?.id.length) {
                const _core = {
                    name: this?.names[0]??this.name,
                    model: process.env.OPENAI_MODEL_CORE,
                    description: this.description,
                    instructions: this.purpose,
                    metadata: {
                        ...Object.entries(this.categories)
                            .filter(([key, value]) => this[value.replace(' ', '_').toLowerCase()]?.length)
                            .slice(0, 16)
                            .reduce((obj, [key, value]) => ({
                                ...obj,
                                [value]: this[value.replace(' ', '_').toLowerCase()],
                            }), {})
                    },
                    file_ids: [],	//	no files at birth, can be added later
                    tools: [],	//	only need tools if files
                }
                this.assistant = await this.openai.beta.assistants.create(_core)
                //	save id to cosmos
                _dataservice.patch(this.id, {
                    assistant: { 
                        id: this.assistant.id
                    ,	object: 'assistant'
                    }
                })
            }
            else if(!this.assistant?.name.length) this.assistant = await this.openai.beta.assistants.retrieve(this.assistant.id)
            return this.assistant
        }
        async getMessage(_msg_id){	//	returns openai `message` object
            if(!this.thread) await this.getThread()
            return this.messages.data.filter(_msg=>{ return _msg.id==_msg_id })
        }
        async getMessages(){
            if(!this.thread) await this.getThread()
            this.messages = ( await this.openai.beta.threads.messages.list(
                this.thread.id
            ) )	//	extra parens to resolve promise
                .data
            return this.messages
        }
        async getRun(_run_id){	//	returns openai `run` object
            return this.runs.filter(_run=>{ return _run.id==_run_id })
        }
        async getRuns(){	//	runs are also descending
            if(!this.runs){
                this.runs = await this.openai.beta.threads.runs.list(this.thread.id)
                //	need to winnow to mapped array?
            }
        }
        async getRunStep(_run_id,_step_id){
            //	pull from known runs
            return this.runs
                .filter(_run=>{ return _run.id==_run_id })
                .steps
                    .filter(_step=>{ return _step.id==_step_id })
        }
        async getRunSteps(_run_id){
            //	always get dynamically
            const _run = this.runs.filter(_run=>{ return _run.id==_run_id })
            _run.steps = await openai.beta.threads.runs.steps.list(this.thread.id, _run.id)
        }
        async run(){
            const _run = await this.startRun()
            if(!_run) throw new Error('Run failed to start')
            this.runs = this?.runs??[]	//	once begun, ought complete even if failed
            this.runs.unshift(_run)
            // ping status
            await this.completeRun(_run.id)
        }
        async startRun(){	//	returns openai `run` object
            if(!this.thread || !this.messages.length) return
            return await this.openai.beta.threads.runs.create(
                this.thread.id,
                { assistant_id: this.assistant.id }
            )
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
            this.request.questions = await mGetQuestions(this, this.openai) // generate question(s) from cosmos or openAI
            this.id = this.factory.newGuid
            this.status = 'prepared'
            this.emitter.emit('on-new-contribution',this)
            return this
        }
        async allow(_request){
            //	this intends to evolve in near future, but is currently only a pass-through with some basic structure alluding to future functionality
            return true
        }
        update(_contribution){
            //  update contribution
            if(!_contribution?.response)
                ctx.throw(400, `missing contribution response`)
            this.response = _contribution.response
            console.log('updated', this.response, this.inspect(true))
            this.emitter.emit('on-contribution-reponse',this.response)
            return this
        }
        /*  getters/setters */
        get emitter(){
            return this.#emitter
        }
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
    class Message extends _originClass {
        #maxContextWindow = Math.min((process.env.OPENAI_MAX_CONTEXT_WINDOW || 2000), 5000)    //  default @2k chars, hard cap @5k
        #message
        #openai = _references?.openai
        constructor(_obj) {
            super(_obj)
        }
        //  public functions
        async init(_thread){
            if(!this.content & !this.files)
                throw new Error('No content provided for message')
            /* todo: limit requirements for context window, generate file and attach to file_ids array
            if(this.content.length > this.#maxContextWindow) {
                //  TODO: generate file and attach to file_ids array
                throw new Error('unimplemented')
                const _file = await this.#constructFile(this.content)
                this.files.push(_file)
                this.content = `user posted content length greater than context window: find request in related file, file_id: ${_file.id}`      //   default content points to file
            }*/
            this.#message = await this.#getMessage_openAI(_thread)
            return this
        }
        //  public getters/setters
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
        //  private functions
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
        #getMessage(){
            return {
                role: 'user',
                content: this.content,
       //         file: this.file,
            }
        }
        /**
         * add or update openai portion of `this.message`
         * @private
         * @param {string} _message 
         * @returns {object} openai `message` object
         */
        async #getMessage_openAI(_thread){
            //  files are attached at the message level under file_ids _array_, only content aside from text = [image_file]:image_file.file_id
            return (!this.message?.id)
            ?	await this.#openai.beta.threads.messages.create(	//	add
                    _thread.id,
                    this.#getMessage()
                )
            :	await this.#openai.beta.threads.messages.update(	//	update
                    _thread.id,
                    this.message.id,
                    this.#getMessage()
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
        
    }

    return Message
}
/* modular functions */
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
    if(process.env.DISABLE_OPENAI)
        return ['What is the meaning of life?']
    //  attempt to pull from Cosmos, containerId: 'seeds'

    //  generate question(s) from openAI
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
/* exports */
export {
	extendClass_avatar,
	extendClass_consent,
    extendClass_contribution,
    extendClass_conversation,
    extendClass_file,
	extendClass_message,
}