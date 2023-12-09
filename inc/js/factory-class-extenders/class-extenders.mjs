import { EventEmitter } from 'events'
import { Marked } from 'marked'
//  function definitions to extend remarkable classes
function extendClass_avatar(_originClass,_references) {
    class Avatar extends _originClass {
        #emitter = new EventEmitter()
        #contributions
        #openai = _references?.openai
        #factory = _references?.factory
        constructor(_obj,_factory) {
            super(_obj) //  should include contributions from db or from class schema
            this.#factory = _factory
        }
        async init(){
            this.emitter.emit('onInitBegin')
            //  review assigned categories and map against intelligence (call to gpt)
            //  assess context
            //  obtain contributions, post to session if valid and room (i.e., presume a limit to number of contributions operable at one time, presumably stored in the session array)
            this.emitter.emit('onInitEnd',this.core)
            return this
        }
        //  public getters/setters
        get avatar(){
            return this.inspect(true)
        }
        get contribution() {
            return this.#contributions ? this.#contributions[0] : this.#contributions
        }
        get contributions(){   //  overloaded for clarity only
            return this.#contributions
        }
        get ctx(){
            return this.factory.ctx
        }
        get emitter(){
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
        async chatRequest(_ctx){
            //  should I always update factory? make sure I have correct underlying factory
            if(_ctx) this.factory.ctx = _ctx    //  update reference, as I was getting odd results without
            if(!this.ctx) {
                throw new Error('No context provided in factory')
            }
            if(!this.thread)
                this.thread = this.ctx.session.MemberSession.thread
            //	assign files and metadata, optional
            //	create message
            const _message = new (this.factory.message)({
                message: await this.setMessage({content: this.ctx.request.body.message}),
                mbr_id: this.mbr_id,
                avatar_id: this.id,
                role: 'user',
            })
            this.messages.unshift(_message)
            //	run thread
            await this.run()
            //	get message data from thread
            const _responses = (await this.getMessages())
                .filter(
                    _msg=>{ return _msg.run_id==this.runs[0].id }
                )
                .map(
                    _msg=>{ return new (this.factory.message)({
                        message: _msg,
                        mbr_id: this.mbr_id,
                        avatar_id: this.id,
                        role: 'assistant',
                    }) }
                )
            this.messages.unshift(..._responses)	//	post each response to this.messages
            //	update cosmos
            if(this?.factory)
                await this.factory.dataservices.patchArrayItems(
                    this.ctx.session.MemberSession.conversation.id,
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
        async setMessage(_message){	//	add or update message; returns openai `message` object
            return (!_message.id)
                ?	await this.openai.beta.threads.messages.create(	//	add
                    this.thread.id,
                    {
                        role: "user",
                        content: _message.content
                    }
                )
                :	await this.openai.beta.threads.messages.update(	//	update
                        this.thread.id,
                        _message.id,
                        {
                            role: "user",
                            content: _message.content
                        }
                    )
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
			console.log('Consent class extended')
        }
        //  public functions
        async allow(_request){
            //	this intends to evolve in near future, but is currently only a pass-through with some basic structure alluding to future functionality
            return true
        }
    }

    return Consent
}
function extendClass_message(_originClass,_references) {
    class Message extends _originClass {
        constructor(_obj) {
            super(_obj)
			console.log('Message class extended')
        }
        //  public functions
        //  public getters/setters
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
    }

    return Message
}
// exports
export {
	extendClass_avatar,
	extendClass_consent,
	extendClass_message,
}