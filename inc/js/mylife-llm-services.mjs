import OpenAI from 'openai'
/* modular constants */
const { OPENAI_API_KEY: mOpenaiKey, OPENAI_BASE_URL: mBasePath, OPENAI_ORG_KEY: mOrganizationKey, OPENAI_API_CHAT_RESPONSE_PING_INTERVAL, OPENAI_API_CHAT_TIMEOUT, } = process.env
const mTimeoutMs = parseInt(OPENAI_API_CHAT_TIMEOUT) || 55000
const mPingIntervalMs = parseInt(OPENAI_API_CHAT_RESPONSE_PING_INTERVAL) || 890
/* class definition */
class LLMServices {
    #llmProviders = []
    /**
     * Constructor for LLM Services.
     * @param {string} apiKey - openai api key
     * @param {string} organizationKey - openai organization key
     */
    constructor(apiKey=mOpenaiKey, orgKey=mOrganizationKey){
        this.#llmProviders.push(
            new OpenAI({
                apiKey,
                basePath: mBasePath,
                organizationId: orgKey,
                timeoutMs: mTimeoutMs,
            }))
    }
    /* public methods */
    /**
     * Creates openAI GPT API assistant.
     * @param {object} assistant - Assistant object
     * @returns {Promise<object>} - openai assistant object
     */
    async createBot(assistant){
        return await this.openai.beta.assistants.create(assistant)
    }
    /**
     * Given member input, get a response from the specified LLM service.
     * @param {string} threadId - Thread id.
     * @param {string} botId - GPT-Assistant/Bot id.
     * @param {string} prompt - Member input.
     * @returns {Promise<Object[]>} - Array of openai `message` objects.
     */
    async getLLMResponse(threadId, botId, prompt){
        await mAssignRequestToThread(this.openai, threadId, prompt)
        const run = await mRunTrigger(this.openai, botId, threadId)
        const { assistant_id, id: run_id, model, provider='openai', required_action, status, usage } = run
        const llmMessageObject = await mMessages(this.provider, threadId)
        const { data: llmMessages} = llmMessageObject
        return llmMessages
            .filter(message=>message.role=='assistant' && message.run_id==run_id)
    }
    /**
     * Create a new OpenAI thread.
     * @param {string} threadId - thread id
     * @returns {Promise<Object>} - openai thread object
     */
    async thread(threadId){
        return await mThread(this.openai, threadId)
    }
    /* getters/setters */
    get openai(){
        return this.provider
    }
    get provider(){
        return this.#llmProviders[0]
    }
    get providers(){
        return this.#llmProviders
    }
}
/* modular functions */
/**
 * Takes Member input request and assigns it to OpenAI thread for processing.
 * @modular
 * @async
 * @param {OpenAI} openai - openai object
 * @param {string} threadId - thread id
 * @param {string} request - message text 
 * @returns {object} - openai `message` object
 */
async function mAssignRequestToThread(openai, threadId, request){
    const messageObject = await openai.beta.threads.messages.create(
        threadId,
        mMessage_openAI(request)
    )
    return messageObject
}
/**
 * Gets message from OpenAI thread.
 * @modular
 * @async
 * @param {OpenAI} openai - openai object
 * @param {string} threadId - thread id
 * @param {string} messageId - message id
 * @returns {object} openai `message` object
 */
async function mMessage(openai, threadId, messageId){
    //  files are attached at the message level under file_ids _array_, only content aside from text = [image_file]:image_file.file_id
    return await openai.beta.threads.messages.retrieve(
            threadId,
            messageId,
        )
}
/**
 * Format input for OpenAI.
 * @modular
 * @param {string} message - message text 
 * @returns {object} - synthetic openai `message` object
 */
function mMessage_openAI(message){
    return {
        role: 'user',
        content: message,
//         file: this.file,
    }
}
/**
 * Gets messages from OpenAI thread.
 * @modular
 * @async
 * @param {OpenAI} openai - openai object
 * @param {string} threadId - thread id
 */
async function mMessages(openai, threadId){
    return await openai.beta.threads.messages
        .list(threadId)
}
/**
 * Maintains vigil for status of openAI `run = 'completed'`.
 * @modular
 * @async
 * @param {OpenAI} openai - openai object
 * @param {object} run - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunFinish(llmServices, run){
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
            try {
                const _run = await mRunStatus(llmServices, run)
                if( _run?.status ?? _run ?? false){
                    clearInterval(checkInterval)
                    resolve(_run)
                }
            } catch (error) {
                clearInterval(checkInterval)
                reject(error)
            }
        }, mPingIntervalMs)
        // Set a timeout to resolve the promise after 55 seconds
        setTimeout(() => {
            clearInterval(checkInterval)
            resolve('Run completed (timeout)')
        }, mTimeoutMs)
    })
}
/**
 * Returns all openai `run` objects for `thread`.
 * @modular
 * @async
 * @param {OpenAI} openai - openai object
 * @param {string} threadId - Thread id
 * @returns {array} - array of [OpenAI run objects](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRuns(openai, threadId){
    return await openai.beta.threads.runs
        .list(threadId)
}
/**
 * Checks status of openAI run.
 * @modular
 * @async
 * @param {OpenAI} openai - openai object
 * @param {object} run - Run id
 * @returns {boolean} - true if run completed, voids otherwise
 */
async function mRunStatus(openai, run){
    run = await openai.beta.threads.runs
        .retrieve(
            run.thread_id,
            run.id,
        )
    switch(run.status){
        //	https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
        case 'completed':
            return run // run
        case 'failed':
        case 'cancelled':
        case 'expired':
            return false
        case 'queued':
        case 'requires_action':
        case 'in_progress':
        case 'cancelling':
        default:
            console.log(`...${run.status}:${run.thread_id}...`) // ping log
            break
    }
}
/**
 * Returns requested openai `run` object.
 * @modular
 * @async
 * @param {Avatar} _avatar - Avatar object
 * @param {string} run_id - Run id
 * @param {string} _step_id - Step id
 * @returns {object} - [OpenAI run-step object]()
 */
async function mRunStep(_avatar, run_id, _step_id){
	//	pull from known runs
	return _avatar.runs
		.filter(run=>{ return run.id==run_id })
		.steps
			.filter(_step=>{ return _step.id==_step_id })
}
/**
 * Returns all openai `run-step` objects for `run`.
 * @modular
 * @async
 * @param {Avatar} _avatar - Avatar object
 * @param {string} run_id - Run id
 * @returns {array} - array of [OpenAI run-step objects]()
 */
async function mRunSteps(_avatar, run_id){
	//	always get dynamically
	const run = _avatar.runs
        .filter(run=>{ return run.id==run_id })
        [0]
	run.steps = await openai.beta.threads.runs.steps
        .list(_avatar.thread.id, run.id)
}
/**
 * Executes openAI run and returns associated `run` object.
 * @modular
 * @param {OpenAI} openai - OpenAI object
 * @param {string} assistantId - Assistant id
 * @param {string} threadId - Thread id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunStart(llmServices, assistantId, threadId){
    return await llmServices.beta.threads.runs.create(
        threadId,
        { assistant_id: assistantId }
    )
}
/**
 * Triggers openAI run and updates associated `run` object.
 * @modular
 * @param {OpenAI} openai - OpenAI object
 * @param {string} botId - Bot id
 * @param {string} threadId - Thread id
 * @returns {void} - All content generated by run is available in `avatar`.
 */
async function mRunTrigger(openai, botId, threadId){
    const run = await mRunStart(openai, botId, threadId)
    if(!run)
        throw new Error('Run failed to start')
    // ping status; returns `completed` run
    const _run = await mRunFinish(openai, run)
        .then(response=>response)
        .catch(err=>err)
    return _run
}
/**
 * Create or retrieve an OpenAI thread.
 * @modular
 * @param {OpenAI} openai - openai object
 * @param {string} threadId - thread id
 * @returns {Promise<Object>} - openai thread object
 */
async function mThread(openai, threadId){
    if(threadId?.length)
        return await openai.beta.threads.retrieve(threadId)
    else
        return await openai.beta.threads.create()
}
/* exports */
export default LLMServices