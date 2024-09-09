import OpenAI from 'openai'
/* module constants */
const { OPENAI_API_KEY: mOpenaiKey, OPENAI_BASE_URL: mBasePath, OPENAI_ORG_KEY: mOrganizationKey, OPENAI_API_CHAT_RESPONSE_PING_INTERVAL, OPENAI_API_CHAT_TIMEOUT, } = process.env
const mPingIntervalMs = parseInt(OPENAI_API_CHAT_RESPONSE_PING_INTERVAL) || 890
const mTimeoutMs = parseInt(OPENAI_API_CHAT_TIMEOUT) || 55000
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
     * @param {object} bot - The bot object
     * @returns {Promise<object>} - openai assistant object
     */
    async createBot(bot){
        const assistantData = mValidateAssistantData(bot) // throws on improper format
        const assistant = await this.openai.beta.assistants.create(assistantData)
        return assistant
    }
    /**
     * Creates a new OpenAI Vectorstore.
     * @param {string} mbr_id - Member ID.
     * @returns {Promise<Object>} - OpenAI `vectorstore` object.
     */
    async createVectorstore(mbr_id){
        const vectorstore = await this.openai.beta.vectorStores.create({
            name: mbr_id,
        })
        return vectorstore
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
     * @param {Avatar} avatar - Avatar object.
     * @returns {Promise<Object[]>} - Array of openai `message` objects.
     */
    async getLLMResponse(threadId, botId, prompt, factory, avatar){
        if(!threadId?.length)
            threadId = ( await mThread(this.openai) ).id
        await mAssignRequestToThread(this.openai, threadId, prompt)
        const run = await mRunTrigger(this.openai, botId, threadId, factory, avatar)
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
     * @param {Avatar} avatar - Avatar object.
     * @returns {Promise<Object>} - openai `message` objects.
     */
    async help(threadId, botId, helpRequest, factory, avatar){
        const helpResponse = await this.getLLMResponse(threadId, botId, helpRequest, factory, avatar)
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
     * @param {string} bot - The bot object data.
     * @returns {Promise<Object>} - openai assistant object.
     */
    async updateBot(bot){
        let { bot_id, ...assistantData } = bot
        if(!bot_id?.length)
            throw new Error('No bot ID provided for update')
        assistantData = mValidateAssistantData(assistantData) // throws on improper format
        const assistant = await this.openai.beta.assistants.update(bot_id, assistantData)
        return assistant
    }
    /**
     * Upload files to OpenAI, currently `2024-05-13`, using vector-store, which is a new refactored mechanic.
     * @documentation [OpenAI API Reference: Vector Stores](https://platform.openai.com/docs/api-reference/vector-stores)
     * @documentation [file_search Quickstart](https://platform.openai.com/docs/assistants/tools/file-search/quickstart)
     * @param {string} vectorstoreId - Vector store ID from OpenAI.
     * @param {object} files - as seems to be requested by api: { files, fileIds, }.
     * @returns {Promise<object>} - The outcome of the upload { vectorstoreId, response, success, }.
     */
    async upload(vectorstoreId, files){
        if(!files?.length)
            throw new Error('No files to upload')
        if(!vectorstoreId?.length)
            throw new Error('No vector store ID provided')
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
async function mRunCancel(openai, threadId, runId){
    try {
        const run = await openai.beta.threads.runs.cancel(threadId, runId)
        return run
    } catch(err) { return false }
}
/**
 * Maintains vigil for status of openAI `run = 'completed'`.
 * @module
 * @async
 * @param {OpenAI} openai - openai object
 * @param {object} run - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @param {AgentFactory} factory - Avatar Factory object to process request
 * @param {Avatar} avatar - Avatar object
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunFinish(llmServices, run, factory, avatar){
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
            try {
                const functionRun = await mRunStatus(llmServices, run, factory, avatar)
                console.log('mRunFinish::functionRun()', functionRun?.status)
                if(functionRun?.status ?? functionRun ?? false){
                    clearInterval(checkInterval)
                    resolve(functionRun)
                }
            } catch (error) {
                clearInterval(checkInterval)
                mRunCancel(llmServices, run.thread_id, run.id)
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
 * @param {OpenAI} openai - openai object
 * @param {object} run - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @param {AgentFactory} factory - Avatar Factory object to process request
 * @param {Avatar} avatar - Avatar object
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @throws {Error} - If tool function not recognized
 */
async function mRunFunctions(openai, run, factory, avatar){ // add avatar ref
    try{
        if(
                run.required_action?.type=='submit_tool_outputs'
            &&  run.required_action?.submit_tool_outputs?.tool_calls
            &&  run.required_action.submit_tool_outputs.tool_calls.length
        ){
            const { assistant_id: bot_id, id: runId, metadata, thread_id, } = run
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
                        const { itemId, } = toolArguments
                        let item
                        if(itemId)
                            item = await factory.item(itemId)
                        switch(name.toLowerCase()){
                            case 'changetitle':
                            case 'change_title':
                            case 'change title':
                                console.log('mRunFunctions()::changeTitle', toolArguments)
                                const { itemId: titleItemId, title, } = toolArguments
                                if(!itemId?.length || !title?.length || itemId!==titleItemId)
                                    action = 'apologize for lack of clarity - member should click on the collection item (like a memory, story, etc) to make it active so I can use the `changeTitle` tool'
                                else {
                                    let item = { id: titleItemId, title, }
                                    await avatar.item(item, 'put')
                                    action = `Relay that title change to "${ title }" was successful`
                                    avatar.frontendInstruction = {
                                        command: 'updateItemTitle',
                                        itemId: titleItemId,
                                        title,
                                    }
                                    success = true
                                }
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'confirmregistration':
                            case 'confirm_registration':
                            case 'confirm registration':
                                console.log('mRunFunctions()::confirmregistration', toolArguments)
                                let { email: confirmEmail, registrationId, } = toolArguments
                                confirmEmail = confirmEmail.trim()
                                if(!confirmEmail?.length)
                                    action = `No email provided for registration confirmation, elicit email address for confirmation of registration and try function this again`
                                else if(!registrationId?.length)
                                    action = `No registrationId provided, continue discussing MyLife organization but forget all current registration data`
                                else if(await factory.confirmRegistration(confirmEmail, registrationId)){
                                    action = `congratulate on registration (**important** remember registrationId=${ registrationId }) and get required member data for follow-up: date of birth, initial account passphrase.`
                                    success = true
                                } else
                                    action = 'Registration confirmation failed, notify member of system error and continue discussing MyLife organization; forget all current registration data.'
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'createaccount':
                            case 'create_account':
                            case 'create account':
                                console.log('mRunFunctions()::createAccount', toolArguments, factory.mylifeRegistrationData)
                                const { birthdate, id, passphrase, } = toolArguments
                                action = `error setting basics for member: `
                                if(!birthdate)
                                    action += 'birthdate missing, elicit birthdate; '
                                if(!passphrase)
                                    action += 'passphrase missing, elicit passphrase; '
                                try {
                                    success = await avatar.createAccount(birthdate, passphrase)
                                    action = success
                                        ? `congratulate member on creating their MyLife membership, display \`passphrase\` in bold for review (or copy/paste), and explain that once the system processes their membership they will be able to use the login button at the top right.`
                                        : action + 'server failure for `factory.createAccount()`'
                                } catch(error){
                                    action += '__ERROR: ' + error.message
                                }
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'entrysummary': // entrySummary in Globals
                            case 'entry_summary':
                            case 'entry summary':
                                const entry = await factory.entry(toolArguments)
                                if(entry){
                                    action = `share brief version of entry and ask probing follow-up`
                                    success = true
                                } else {
                                    action = `journal entry failed to save, notify member and continue on for now`
                                }
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'getsummary':
                            case 'get_summary':
                            case 'get summary':
                                let { summary, } = item ?? {}
                                if(!summary?.length){
                                    action = `error getting summary for itemId: ${ itemId ?? 'missing itemId' } - halt any further processing and instead ask user to paste summary into chat and you will continue from there to incorporate their message.`
                                    summary = 'no summary found for itemId'
                                } else {
                                    action = `continue with initial instructions`
                                    success = true
                                }
                                confirmation.output = JSON.stringify({ action, itemId, success, summary, })
                                console.log('mRunFunctions()::getSummary::confirmation', itemId)
                                return confirmation
                            case 'hijackattempt':
                            case 'hijack_attempt':
                            case 'hijack-attempt':
                            case 'hijack attempt':
                                console.log('mRunFunctions()::hijack_attempt', toolArguments)
                                action = 'attempt noted in system and user ejected; greet per normal as first time new user'
                                success = true
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'registercandidate':
                            case 'register_candidate':
                            case 'register candidate':
                                console.log('mRunFunctions()::registercandidate', toolArguments)
                                const { avatarName, email: registerEmail, humanName, type, } = toolArguments /* rename email as it triggers IDE error being in switch */
                                const registration = await factory.registerCandidate({ avatarName, email: registerEmail, humanName, type, })
                                if(!registration)
                                    action = 'error registering candidate in system; notify member of system error and continue discussing MyLife organization'
                                else {
                                    action = 'candidate registered in system; let them know they will be contacted by email within the week and if they have any more questions'
                                    success = true
                                    console.log('mRunFunctions()::avatar', avatar, registration, toolArguments)
                                }
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'story': // storySummary.json
                            case 'storysummary':
                            case 'story-summary':
                            case 'story_summary':
                            case 'story summary':
                                const story = await factory.story(toolArguments)
                                if(story){
                                    const { keywords, phaseOfLife, } = story
                                    let { interests, updates, } = factory.core
                                    if(typeof interests=='array')
                                        interests = interests.join(', ')
                                    if(typeof updates=='array')
                                        updates = updates.join(', ')
                                    switch(true){
                                        case phaseOfLife?.length:
                                            action = `ask about another encounter during member's ${ phaseOfLife }`
                                            console.log('mRunFunctions()::story-summary::phaseOfLife', phaseOfLife)
                                            break
                                        case interests?.length:
                                            action = `ask about a different interest from: ${ interests }`
                                            console.log('mRunFunctions()::story-summary::interests', interests)
                                            break
                                        default:
                                            action = 'ask about another event in member\'s life'
                                            break
                                    }
                                    success = true
                                } // error cascades
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'updatesummary':
                            case 'update_summary':
                            case 'update summary':
                                console.log('mRunFunctions()::updatesummary::start', itemId)
                                const { summary: updatedSummary, } = toolArguments
                                // remove await once confirmed updates are connected
                                await factory.updateItem({ id: itemId, summary: updatedSummary, })
                                action=`confirm success and present updated summary to member`
                                success = true
                                confirmation.output = JSON.stringify({ action, success, })
                                console.log('mRunFunctions()::updatesummary::end', itemId, updatedSummary)
                                return confirmation
                            default:
                                console.log(`ERROR::mRunFunctions()::toolFunction not found: ${ name }`, toolFunction)
                                action = `toolFunction not found: ${ name }, apologize for the error and continue on with the conversation; system notified to fix`
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
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
    catch(error){
        console.log('mRunFunctions()::error::canceling-run', error.message, error.stack)
        rethrow(error)
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
 * @param {Avatar} avatar - Avatar object
 * @returns {boolean} - true if run completed, voids otherwise
 */
async function mRunStatus(openai, run, factory, avatar){
    run = await openai.beta.threads.runs
        .retrieve(
            run.thread_id,
            run.id,
        )
    switch(run.status){
        case 'requires_action':
            const completedRun = await mRunFunctions(openai, run, factory, avatar)
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
 * @param {Avatar} avatar - Avatar object
 * @returns {void} - All content generated by run is available in `avatar`.
 */
async function mRunTrigger(openai, botId, threadId, factory, avatar){
    const run = await mRunStart(openai, botId, threadId)
    if(!run)
        throw new Error('Run failed to start')
    // ping status; returns `completed` run
    const finishRun = await mRunFinish(openai, run, factory, avatar)
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
    const {
        bot_name,
        description,
        id,
        instructions,
        metadata={},
        model,
        name: gptName,
        temperature,
        tools,
        tool_resources,
        top_p,
        response_format,
        version,
    } = data
    const name = bot_name
        ?? gptName // bot_name internal mylife-alias for openai `name`
    delete metadata.created
    metadata.updated = `${ Date.now() }` // metadata nodes must be strings
    if(id)
        metadata.id = id
    else
        metadata.created = `${ Date.now() }`
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
        throw new Error('Assistant data does not have the correct structure.')
    return assistantData
}
/* exports */
export default LLMServices