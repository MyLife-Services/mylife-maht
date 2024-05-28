import OpenAI from 'openai'
/* module constants */
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
    async createBot(assistantData){
        assistantData = mValidateAssistantData(assistantData) // throws on improper format
        return await this.openai.beta.assistants.create(assistantData)
    }
    /**
     * Returns openAI file object.
     * @param {string} fileId - OpenAI file ID.
     * @returns - OpenAI `file` object.
     */
    async file(fileId){
        return await this.openai.files.retrieve(fileId)
    }
    /**
     * Returns file list from indicated vector store.
     * @param {string} vectorstoreId - OpenAI vector store ID.
     * @returns {Promise<Object[]>} - Array of openai `file` objects.
     */
    async files(vectorstoreId){
        return await this.openai.beta.vectorStores.files.list(vectorstoreId)
    }
    /**
     * Given member input, get a response from the specified LLM service.
     * @todo - confirm that reason for **factory** is to run functions as responses from LLM; ergo in any case, find better way to stash/cache factory so it does not need to be passed through every such function
     * @param {string} threadId - Thread id.
     * @param {string} botId - GPT-Assistant/Bot id.
     * @param {string} prompt - Member input.
     * @param {AgentFactory} factory - Avatar Factory object to process request.
     * @returns {Promise<Object[]>} - Array of openai `message` objects.
     */
    async getLLMResponse(threadId, botId, prompt, factory){
        if(!threadId?.length)
            threadId = ( await mThread(this.openai) ).id
        await mAssignRequestToThread(this.openai, threadId, prompt)
        const run = await mRunTrigger(this.openai, botId, threadId, factory)
        const { assistant_id, id: run_id, model, provider='openai', required_action, status, usage } = run
        const llmMessageObject = await mMessages(this.provider, threadId)
        const { data: llmMessages} = llmMessageObject
        return llmMessages
            .filter(message=>message.role=='assistant' && message.run_id==run_id)
    }
    /**
     * Given member request for help, get response from specified bot assistant.
     * @param {string} threadId - Thread id.
     * @param {string} botId - GPT-Assistant/Bot id.
     * @param {string} helpRequest - Member input.
     * @param {AgentFactory} factory - Avatar Factory object to process request.
     * @returns {Promise<Object>} - openai `message` objects.
     */
    async help(threadId, botId, helpRequest, factory){
        const helpResponse = await this.getLLMResponse(threadId, botId, helpRequest, factory)
        return helpResponse
    }
    /**
     * Create a new OpenAI thread.
     * @param {string} threadId - thread id
     * @returns {Promise<Object>} - openai thread object
     */
    async thread(threadId){
        return await mThread(this.openai, threadId)
    }
    /**
     * Updates assistant with specified data. Example: Tools object for openai: { tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } }, }; https://platform.openai.com/docs/assistants/tools/file-search/quickstart?lang=node.js
     * @param {string} assistantId - OpenAI assistant ID.
     * @param {object} assistantData - Assistant data object.
     * @returns {Promise<Object>} - openai assistant object.
     */
    async updateAssistant(assistantId, assistantData){
        assistantData = mValidateAssistantData(assistantData) // throws on improper format
        return await this.openai.beta.assistants.update(assistantId, assistantData)
    }
    /**
     * Upload files to OpenAI, currently `2024-05-13`, using vector-store, which is a new refactored mechanic.
     * @documentation [OpenAI API Reference: Vector Stores](https://platform.openai.com/docs/api-reference/vector-stores)
     * @documentation [file_search Quickstart](https://platform.openai.com/docs/assistants/tools/file-search/quickstart)
     * @param {string} vectorstoreId - Vector store ID from OpenAI.
     * @param {object} files - as seems to be requested by api: { files, fileIds, }.
     * @param {string} memberId - Member ID, will be `name` of vector-store.
     * @returns {Promise<string>} - The vector store ID.
     */
    async upload(vectorstoreId, files, memberId){
        if(!files?.length)
            throw new Error('No files to upload')
        if(!vectorstoreId){ /* create vector-store */
            const vectorstore = await this.openai.beta.vectorStores.create({
                name: memberId,
            })
            vectorstoreId = vectorstore.id
        }
        let response,
            success = false
        try{
            response = await this.openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorstoreId, { files, })
            success = true
        } catch(error) {
            console.log('LLMServices::upload()::error', error.message)
            response = error.message
        }
        return {
            vectorstoreId,
            response,
            success,
        }
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
/* module functions */
/**
 * Takes Member input request and assigns it to OpenAI thread for processing.
 * @module
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
 * @module
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
 * @module
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
 * @module
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
 * @module
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
 * @module
 * @private
 * @async
 * @param {object} run - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @param {AgentFactory} factory - Avatar Factory object to process request
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @throws {Error} - If tool function not recognized
 */
async function mRunFunctions(openai, run, factory){ // convert factory to avatar (or add)
    if(
            run.required_action?.type=='submit_tool_outputs'
        &&  run.required_action?.submit_tool_outputs?.tool_calls
        &&  run.required_action.submit_tool_outputs.tool_calls.length
    ){
        const { assistant_id: bot_id, metadata, thread_id, } = run
        const toolCallsOutput = await Promise.all(
            run.required_action.submit_tool_outputs.tool_calls
                .map(async tool=>{
                    const { id, function: toolFunction, type, } = tool
                    let { arguments: toolArguments={}, name, } = toolFunction
                    let action = '',
                        confirmation = {
                            tool_call_id: id,
                            output: '',
                        },
                        success = false
                    if(typeof toolArguments==='string')
                        toolArguments = JSON.parse(toolArguments) ?? {}
                    toolArguments.thread_id = thread_id
                    switch(name.toLowerCase()){
                        case 'confirmregistration':
                        case 'confirm_registration':
                        case 'confirm registration':
                            const { email, } = toolArguments
                            if(!email?.length)
                                action = `No email provided for registration confirmation, elicit email address for confirmation of registration and try function this again`
                            else if(email.toLowerCase()!==factory.registrationData?.email?.toLowerCase())
                                action = 'Email does not match -- if occurs more than three times in this thread, fire `hijackAttempt` function'
                            else {
                                success = factory.confirmRegistration()
                                if(success)
                                    action = `congratulate on registration and get required member data for follow-up: date of birth, initial account passphrase.`
                                else
                                    action = 'Registration confirmation failed, notify member of system error and continue discussing MyLife organization'
                            }
                            confirmation.output = JSON.stringify({ success, action, })
                            return confirmation
                        case 'entrysummary': // entrySummary in Globals
                        case 'entry_summary':
                        case 'entry summary':
                            const entry = await factory.entry(toolArguments)
                            if(entry){
                                action = `share summary of summary and follow-up with probing question`
                                success = true
                                confirmation = {
                                    tool_call_id: id,
                                    output: JSON.stringify({ success: true, action, }),
                                }
                                return confirmation
                            } else {
                                action = `journal entry failed to save, notify member and continue on for now`
                            }
                            confirmation.output = JSON.stringify({ success, action, })
                            return confirmation
                        case 'hijackattempt':
                        case 'hijack_attempt':
                        case 'hijack-attempt':
                        case 'hijack attempt':
                            console.log('mRunFunctions()::hijack_attempt', toolArguments)
                            success = true
                            confirmation.output = JSON.stringify({ success, action, })
                            return confirmation
                        case 'setmylifebasics':
                        case 'set_mylife_basics':
                        case 'set mylife basics':
                            const { birthdate, passphrase, } = toolArguments
                            action = `error setting basics for member: `
                            if(!birthdate)
                                action += 'birthdate missing, elicit birthdate; '
                            if(!passphrase)
                                action += 'passphrase missing, elicit passphrase; '
                            try {
                                success = await factory.createAccount(birthdate, passphrase)
                                action = success
                                    ? `congratulate member on creating their MyLife membership, display \`passphrase\` in bold for review (or copy/paste), and ask if they are ready to continue journey.`
                                    : action + 'server failure for `factory.createAccount()`'
                            } catch(error){
                                action += '__ERROR: ' + error.message
                            }
                            confirmation.output = JSON.stringify({ success, action, })
                            return confirmation
                        case 'story': // storySummary.json
                        case 'storysummary':
                        case 'story-summary':
                        case 'story_summary':
                        case 'story summary':
                            const story = await factory.story(toolArguments)
                            if(story){
                                const { keywords, phaseOfLife='unknown', } = story
                                let { interests, updates, } = factory.core
                                if(typeof interests=='array')
                                    interests = interests.join(', ')
                                if(typeof updates=='array')
                                    updates = updates.join(', ')
                                // @stub - action integrates with story and interests/phase
                                switch(true){
                                    case interests?.length:
                                        action = `ask about a different interest from: ${ interests }`
                                        console.log('mRunFunctions()::story-summary::interests', interests)
                                        break
                                    case phaseOfLife!=='unknown':
                                        action = `ask about another encounter during this phase of life: ${ phaseOfLife }`
                                        console.log('mRunFunctions()::story-summary::phaseOfLife', phaseOfLife)
                                        break
                                    case updates?.length:
                                        action = `ask about current events related to or beyond: ${ updates }`
                                        console.log('mRunFunctions()::story-summary::updates', updates)
                                        break
                                    default:
                                        action = 'ask about another event in member\'s life'
                                        break
                                }
                                success = true
                            } // error cascades
                            confirmation.output = JSON.stringify({ success, action, })
                            return confirmation
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
        return finalOutput /* undefined indicates to ping again */
    }
}
/**
 * Returns all openai `run` objects for `thread`.
 * @module
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
 * @module
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
 * @module
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
 * @module
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
 * @module
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
 * @module
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
 * @todo - create case for failure in thread creation/retrieval
 * @module
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
/**
 * Validates assistant data before sending to OpenAI.
 * @param {object} data - Object data to validate.
 * @returns {object} - Cured assistant object data.
 */
function mValidateAssistantData(data){
    if(!data)
        throw new Error('No data or data in incorrect format to send to OpenAI assistant.')
    if(typeof data==='string')
        data = { [`${ data.substring(0, 32) }`]: data }
    if(typeof data!=='object')
        throw new Error('Data to send to OpenAI assistant is not in correct format.')
    const { bot_name, description, instructions, metadata, model, name: gptName, temperature, tools, tool_resources, top_p, response_format, } = data
    const name = bot_name ?? gptName // bot_name internal alias for openai `name`
    const assistantData = {
        description,
        instructions,
        metadata,
        model,
        name,
        tools,
        tool_resources,
    }
    if(!Object.keys(assistantData).length)
        throw new Error('Assistant data is not in correct format.')
    return assistantData
}
/* exports */
export default LLMServices