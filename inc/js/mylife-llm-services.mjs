import OpenAI from 'openai'
/* modular constants */
const { OPENAI_API_KEY: mOpenaiKey, OPENAI_BASE_URL: mBasePath, OPENAI_ORG_KEY: mOrganizationKey, OPENAI_API_CHAT_RESPONSE_PING_INTERVAL, OPENAI_API_CHAT_TIMEOUT, } = process.env
const mTimeoutMs = parseInt(OPENAI_API_CHAT_TIMEOUT) || 55000
const mPingIntervalMs = parseInt(OPENAI_API_CHAT_RESPONSE_PING_INTERVAL) || 890
/* class definition */
/**
 * LLM Services class.
 * @todo - rather than passing factory in run, pass avatar
 * @todo - convert run to streaming as defined in @documentation
 * @class
 * @classdesc LLM Services class.
 * @documentation [OpenAI API Reference: Assistant Function Calling](https://platform.openai.com/docs/assistants/tools/function-calling/quickstart)
 * @param {string} apiKey - openai api key
 * @param {string} organizationKey - openai organization key
 * @returns {LLMServices} - LLM Services object
 */
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
     * @param {AgentFactory} factory - Avatar Factory object to process request.
     * @returns {Promise<Object[]>} - Array of openai `message` objects.
     */
    async getLLMResponse(threadId, botId, prompt, factory){
        await mAssignRequestToThread(this.openai, threadId, prompt)
        const run = await mRunTrigger(this.openai, botId, threadId, factory)
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
 * @param {AgentFactory} factory - Avatar Factory object to process request
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunFinish(llmServices, run, factory){
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
            try {
                const functionRun = await mRunStatus(llmServices, run, factory)
                console.log('mRunFinish::functionRun()', functionRun?.status)
                if(functionRun?.status ?? functionRun ?? false){
                    clearInterval(checkInterval)
                    resolve(functionRun)
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
 * Executes openAI run functions. See https://platform.openai.com/docs/assistants/tools/function-calling/quickstart.
 * @todo - storysummary output action requires integration with factory/avatar data intersecting with story submission
 * @modular
 * @private
 * @async
 * @param {object} run - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @param {AgentFactory} factory - Avatar Factory object to process request
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @throws {Error} - If tool function not recognized
 */
async function mRunFunctions(openai, run, factory){
    if(
            run.required_action?.type=='submit_tool_outputs'
        &&  run.required_action?.submit_tool_outputs?.tool_calls
        &&  run.required_action.submit_tool_outputs.tool_calls.length
    ){
        const toolCallsOutput = await Promise.all(
            run.required_action.submit_tool_outputs.tool_calls
                .map(async tool=>{
                    const { id, function: toolFunction, type, } = tool
                    let { arguments: toolArguments, name, } = toolFunction
                    switch(name.toLowerCase()){
                        case 'story': // storySummary.json
                        case 'storysummary':
                        case 'story-summary':
                        case 'story_summary':
                        case 'story summary':
                            if(typeof toolArguments == 'string')
                                toolArguments = JSON.parse(toolArguments)
                            const story = await factory.story(toolArguments)
                            if(story){
                                const { keywords, phaseOfLife='unknown', } = story
                                let { interests, updates, } = factory.core
                                // @stub - action integrates with story and interests/phase
                                let action
                                switch(true){
                                    case interests:
                                        console.log('mRunFunctions()::story-summary::interests', interests)
                                        if(typeof interests == 'array')
                                            interests = interests.join(',')
                                        action = `ask about a different interest from: ${ interests }`
                                        break
                                    case phaseOfLife!=='unknown':
                                        console.log('mRunFunctions()::story-summary::phaseOfLife', phaseOfLife)
                                        action = `ask about another encounter during this phase of life: ${story.phaseOfLife}`
                                        break
                                    default:
                                        action = 'ask about another event in member\'s life'
                                        break
                                }
                                const confirmation = {
                                    tool_call_id: id,
                                    output: JSON.stringify({ success: true, action, }),
                                }
                                return confirmation
                            } // error cascades
                        default:
                            throw new Error(`Tool function ${name} not recognized`)
                    }
                }))
        /* submit tool outputs */
        const finalOutput = await openai.beta.threads.runs.submitToolOutputsAndPoll( // note: must submit all tool outputs at once
            run.thread_id,
            run.id,
            { tool_outputs: toolCallsOutput },
        )
        console.log('mRunFunctions::submitToolOutputs()::run=complete', finalOutput?.status)
        return finalOutput /* undefined indicates to ping again */
    }
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
 * @param {AgentFactory} factory - Avatar Factory object to process request
 * @returns {boolean} - true if run completed, voids otherwise
 */
async function mRunStatus(openai, run, factory){
    run = await openai.beta.threads.runs
        .retrieve(
            run.thread_id,
            run.id,
        )
    switch(run.status){
        case 'requires_action':
            const completedRun = await mRunFunctions(openai, run, factory)
            return completedRun /* if undefined, will ping again */
        case 'completed':
            return run // run
        case 'failed':
        case 'cancelled':
        case 'expired':
            return false
        case 'queued':
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
 * @param {AgentFactory} factory - Avatar Factory object to process request
 * @returns {void} - All content generated by run is available in `avatar`.
 */
async function mRunTrigger(openai, botId, threadId, factory){
    const run = await mRunStart(openai, botId, threadId)
    if(!run)
        throw new Error('Run failed to start')
    // ping status; returns `completed` run
    const finishRun = await mRunFinish(openai, run, factory)
        .then(response=>response)
        .catch(err=>err)
    return finishRun
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