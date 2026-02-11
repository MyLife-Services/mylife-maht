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
     * Gets or creates (if no conversation_id) a new OpenAI conversation, previously thread().
     * @param {string} conversation_id - conversation id
     * @param {string} message - array of messages (optional)
     * @param {object} metadata - metadata object (optional)
     * @returns {Promise<Object>} - openai conversation object
     */
    async conversation(conversation_id, messages=[], metadata){
        const conversation = await mConversation(this.openai, conversation_id, messages, metadata)
        return conversation
    }
    /**
     * Creates openAI GPT API assistant.
     * @param {object} bot - The bot data
     * @returns {Promise<object>} - openai assistant object
     */
    async createBot(botData){
        botData = mValidateAssistantData(botData)
        const bot = await this.openai.beta.assistants.create(botData)
        const thread = await mConversation(this.openai)
        bot.thread_id = thread.id
        return bot
    }
    /**
     * Creates a new OpenAI Vectorstore.
     * @param {string} mbr_id - Member ID.
     * @returns {Promise<Object>} - OpenAI `vectorstore` object.
     */
    async createVectorstore(mbr_id){
        const vectorstore = await this.openai.vectorStores.create({
            name: mbr_id,
        })
        return vectorstore
    }
    /**
     * Deletes an assistant from OpenAI.
     * @param {string} llm_id - GPT-Assistant external ID
     * @returns 
     */
    async deleteBot(llm_id){
        try {
            const deletedBot = await this.openai.beta.assistants.del(llm_id)
            return deletedBot
        } catch (error) {
            if(error.name==='PermissionDeniedError')
                console.error(`Permission denied to delete assistant: ${ llm_id }`)
            else
                console.error(`ERROR trying to delete assistant: ${ llm_id }`, error.name, error.message)
        }
    }
    /**
     * Deletes a conversation from OpenAI.
     * @param {string} conversation_id - OpenAI Conversation id.
     * @returns 
     */
    async deleteThread(conversation_id){
        return await mConversationDelete(this.openai, conversation_id)
    }
    /**
     * Extracts response from LLM response object.
     * @param {Object[]} responses - Array of LLM response objects
     * @param {String} provider - LLM provider
     * @returns {Array} - Array of extracted string responses
     */
    extractResponses(llmResponses, provider){
        if(!llmResponses?.length)
            return []
        const responses = []
        llmResponses.forEach(response=>{
                if(typeof response==='string' && response.length)
                    responses.push(response)
                const { assistant_id: llm_id, content, created_at, id, run_id, thread_id, } = response
                if(!!content?.length)
                    content.forEach(content=>{
                        if(!!content?.text?.value?.length)
                            responses.push(content.text.value)
                    })

            })
        return responses
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
     * @documentation [OpenAI API Reference: Vector Stores](https://platform.openai.com/docs/api-reference/vector-stores-files/listFiles)
     * @param {string} vectorstoreId - OpenAI vector store ID.
     * @returns {Promise<Object[]>} - Array of openai `file` objects.
     */
    async files(vectorstoreId){
        const files = await this.openai.vectorStores.files.list(vectorstoreId)
        return files
    }
    /**
     * Given member input, get a response from the specified LLM service.
     * @documentation [Handling function calls](https://platform.openai.com/docs/guides/function-calling#handling-function-calls)
     * @param {string} conversation_id - Conversation id (from thread id)
     * @param {string} prompt_id - Prompt id in OpenAI (from assistant id)
     * @param {string} prompt - Member input text
     * @param {AgentFactory} factory - Avatar Factory object to process request
     * @param {Avatar} avatar - Avatar object
     * @returns {Promise<Object[]>} - Array of openai `message` objects
     */
    async getLLMResponse(conversation_id, prompt_id, prompt, factory, avatar){
        conversation_id ??= ( await mConversation(this.openai, undefined, prompt) ).id
        const response = await mResponse(this.openai, conversation_id, prompt_id, prompt)
        const { completed_at, created_at, error, id, incomplete_details, metadata, model, output, output_text, prompt: _prompt, status, temperature, top_p, usage, } = response
        let llmMessages = []
        switch(status){
            case 'completed':
                if(Array.isArray(output)){
                    const fileSearches = output.filter(message=>message?.type==='file_search_call')
                    const functionCalls = output.filter(message=>message?.type==='function_call')
                    const imageGenerations = output.filter(message=>message?.type==='image_generation_call')
                    const mcpCalls = output.filter(message=>message?.type==='mcp_call')
                    const messages = output.filter(message=>message?.type==='message' && Array.isArray(message?.content))
                    const reasonings = output.filter(message=>message?.type==='reasoning')
                    const webSearches = output.filter(message=>message?.type==='web_search_call')
                    if(functionCalls.length){
                        // loop through awaiting function calls and process them, package results as messages to call another `getLLMResponse()`
                        const toolResponses = []
                        functionCalls.forEach(async call=>{
                            if(call.arguments && typeof call.arguments==='string')
                                call.arguments = JSON.parse(call.arguments)
                            const { call_id, id, name, status, } = call
                            let { arguments: args, } = call
                            if(status==='completed') // already finished
                                return
                            let toolResponse
                            if(avatar[name])
                                toolResponse = await avatar[name](args)
                            else if(factory[name])
                                toolResponse = await factory[name](args)
                            else
                                toolResponse = { error: `Tool function ${ name } not recognized by system.` }
                            toolResponses.push(toolResponse)
                        })
                    }
                    llmMessages = messages.map(message => mMessageConvert(this.provider, message))
                } else if(typeof output==='string' && output.length)
                    llmMessages.append(mMessageConvert(this.provider, output_text))
                else
                    llmMessages.append(mMessageConvert(this.provider, 'No LLM response was parseable; please try your request again.'))
                console.log(`LLMServices::getLLMResponse()::success::total_tokens: ${ usage.total_tokens }, output_tokens: ${ usage.output_tokens }`)
                break
            case 'in_progress':
            case 'queued':
                console.log('LLMServices::getLLMResponse()::pending::need to retry', status)
                break
            case 'incomplete':
                console.log('LLMServices::getLLMResponse()::incomplete', status, incomplete_details)
                break
            case 'cancelled':
            case 'failed':
            default:
                console.log('LLMServices::getLLMResponse()::error', status, error)
                break
        }
        return llmMessages
    }
    /**
     * Given member request for help, get response from specified bot assistant.
     * @param {string} thread_id - Thread id.
     * @param {string} llm_id - GPT-Assistant/Bot id.
     * @param {string} helpRequest - Member input.
     * @param {AgentFactory} factory - Avatar Factory object to process request.
     * @param {Avatar} avatar - Avatar object.
     * @returns {Promise<Object>} - openai `message` objects.
     */
    async help(thread_id, llm_id, helpRequest, factory, avatar){
        const helpResponse = await this.getLLMResponse(thread_id, llm_id, helpRequest, factory, avatar)
        return helpResponse
    }
    /**
     * Returns a specific message associated with a conversation.
     * @param {string} conversation_id - Conversation id
     * @param {string} msg_id - Message id
     * @returns {Promise<object>} - openai `message` object.
     */
    async message(conversation_id, msg_id){
        const message = await mMessages(this.provider, conversation_id, msg_id)
        return message
    }
    /**
     * Returns messages associated with specified conversation.
     * @param {string} conversation_id - Conversation id
     * @returns {Promise<Object[]>} - Array of openai `message` objects.
     */
    async messages(conversation_id){
        const { data: messages } = await mMessages(this.provider, conversation_id)
        return messages
    }
    /**
     * Updates assistant with specified data. Example: Tools object for openai: { tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } }, }; https://platform.openai.com/docs/assistants/tools/file-search/quickstart?lang=node.js
     * @todo - conform payload to OpenAI API Reference
     * @param {Object} botData - The bot object data.
     * @returns {Promise<Object>} - openai assistant object.
     */
    async updateBot(botData){
        let { bot_id, llm_id, ...assistantData } = botData
        if(!llm_id?.length)
            throw new Error('No bot ID provided for update')
        botData = mValidateAssistantData(assistantData)
        const assistant = await this.openai.beta.assistants.update(llm_id, botData)
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
            response = await this.openai.vectorStores.fileBatches.uploadAndPoll(vectorstoreId, { files, })
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
 * Gets or creates OpenAI conversation. Originally written as thread, but now deprecating.
 * @param {OpenAI} openai - openai object
 * @param {string} conversation_id - conversation id
 * @param {string} messageText - message text (optional)
 * @param {object} metadata - metadata object (optional)
 * @returns {object} - openai `conversation` object
 */
async function mConversation(openai, conversation_id, messageText, metadata){
    let conversation
    if(conversation_id?.length)
        conversation =  await openai.conversations.retrieve(conversation_id)
    else {
        const conversationOptions = { metadata, }
        if(messageText?.length)
            conversationOptions.items = [{
                type: "message",
                role: "user",
                content: messageText,
            }]
        conversation = await openai.conversations.create(conversationOptions)
    }
    return conversation
}
/**
 * Deletes an OpenAI conversation.
 * @param {OpenAI} openai - OpenAI object
 * @param {string} conversation_id - Conversation id
 * @returns {Promise<object>} - Deleted conversation object: { deleted: true, id: conversation_id, object: 'conversation.deleted', }
 */
async function mConversationDelete(openai, conversation_id){
    let deletedConversation
    try {
        deletedConversation = await openai.conversations.delete(conversation_id)
    } catch (error) {
        if(error.name==='PermissionDeniedError')
            console.error(`Permission denied to delete conversation: ${ conversation_id }`)
        else
            console.error(`ERROR trying to delete conversation: ${ conversation_id }`,  error.name, error.message)
        deletedConversation = { deleted: false, error, id: conversation_id, object: 'conversation.delete_failed', }
    }
    return deletedConversation
}
/**
 * Gets message from OpenAI thread.
 * @module
 * @async
 * @param {OpenAI} openai - openai object
 * @param {string} conversation_id - conversation id
 * @param {string} msg_id - message id, returns specific message (optional)
 * @returns {object} openai `message` object
 */
async function mMessages(openai, conversation_id, msg_id){
    return msg_id?.length
        ? await openai.conversations.items.retrieve(
                conversation_id,
                msg_id,
            )
        : await openai.conversations.items.list(
                conversation_id,
                { limit: 50, }
            )
}
/**
 * Format input for OpenAI.
 * @module
 * @param {string} provider - LLM provider
 * @param {string} message - message text 
 * @returns {object} - synthetic openai `message` object
 */
function mMessageConvert(provider, message){
    let messageConverted = {}
    switch(provider){
        default:
            if(typeof message==='string'){
                messageConverted.content = { text: message, type: 'input_text', }
                messageConverted.id = crypto.randomUUID()
                messageConverted.role = 'assistant'
                messageConverted.status = 'completed'
                messageConverted.type = 'message'
            } else
                messageConverted = message
            break
    }
    return messageConverted
}
/**
 * Creates an OpenAI request with member input. Appends to Conversation in OpenAI.
 * @param {*} openai - openai object
 * @param {string} conversation_id - Conversation id (from thread id)
 * @param {string} prompt_id  - Prompt id in OpenAI (from assistant id)
 * @param {string} prompt - Member input text
 * @returns {object} - [openai `response` object](https://platform.openai.com/docs/api-reference/responses/object?lang=javascript)
 */
async function mResponse(openai, conversation_id, prompt_id, prompt){
    const response = await openai.responses.create({
        conversation: conversation_id,
        include: ['web_search_call.action.sources', 'file_search_call.results'],
        input: prompt,
        max_output_tokens: 1024,
        metadata: {},
        // model: "gpt-4.1", // only use if overriding prompt default
        prompt: { id: prompt_id, },
    })
    return response
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
        ?? gptName
    metadata.id = id
    metadata.updated = `${ Date.now() }` // metadata nodes must be strings
    const assistantData = {
        description,
        instructions,
        metadata,
        model,
        name,
        tools,
        tool_resources,
    }
    Object.keys(assistantData).forEach(key => {
        if (assistantData[key] === undefined) {
            delete assistantData[key]
        }
    })
    return assistantData
}
/* exports */
export default LLMServices

/**
 * **DEPRECATED** - convert to handling tool response requests from standard output items. 
 * Executes openAI run functions. See https://platform.openai.com/docs/assistants/tools/function-calling/quickstart.
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
/* deprecated: moved to bot-agent and/or factory
async function mRunFunctions(openai, run, factory, avatar){
    try{
        if(
                run.required_action?.type=='submit_tool_outputs'
            &&  run.required_action?.submit_tool_outputs?.tool_calls
            &&  run.required_action.submit_tool_outputs.tool_calls.length
        ){
            const { assistant_id: llm_id, id: runId, metadata, thread_id, } = run
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
                            item,
                            success = false
                        if(typeof toolArguments==='string')
                            toolArguments = await JSON.parse(toolArguments)
                                ?? {}
                        toolArguments.thread_id = thread_id // deprecate?
                        const { itemId, } = toolArguments
                        switch(name.toLowerCase()){
                            case 'changetitle':
                            case 'change_title':
                            case 'change title':
                                const { title: newTitle, } = toolArguments
                                console.log('mRunFunctions()::changeTitle start', newTitle, itemId)
                                avatar.backupResponse = {
                                    message: `I encountered an unexpected error while changing our title to: ${ newTitle }. Please try again.`,
                                    type: 'system',
                                }
                                if(!itemId?.length || !newTitle?.length){
                                    action = 'apologize for lack of clarity - member should click on the collection item (like a memory, story, etc) to identify it as active'
                                    confirmation.output = JSON.stringify({ action, success, })
                                    return confirmation
                                }
                                delete avatar.actionCallback
                                delete avatar.backupResponse
                                delete avatar.frontendInstruction
                                const updateTitle = {
                                    id: itemId,
                                    title: newTitle
                                }
                                if(await avatar.itemUpdate(updateTitle))
                                    avatar.frontendInstruction = {
                                        command: 'updateItemTitle',
                                        itemId,
                                        title: newTitle,
                                    }
                                return {
                                    cancelResponse: true,
                                    deleteThread: false,
                                    function: 'changeTitle',
                                    run_id: runId, // required for canceling run
                                    success: true,
                                    title: newTitle,
                                }
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
                                console.log('mRunFunctions()::createAccount::start', toolArguments)
                                const { birthdate, passphrase, } = toolArguments
                                action = `error setting basics for member: `
                                if(!birthdate)
                                    action += 'birthdate missing, elicit birthdate; '
                                if(!passphrase)
                                    action += 'passphrase missing, elicit passphrase; '
                                try {
                                    const { success: createAccountSuccess, } = await avatar.createAccount(birthdate, passphrase, factory.candidate)
                                    action = createAccountSuccess
                                        ? `congratulate member on creating their MyLife membership, display \`passphrase\` in bold for review (or copy/paste), and explain that once the system processes their membership they will be able to use the login button at the top right.`
                                        : action + 'server failure for `factory.createAccount()`'
                                    success = createAccountSuccess
                                } catch(error){
                                    action += '__ERROR: ' + error.message
                                }
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'endreliving':
                            case 'end_reliving':
                            case 'end reliving':
                                avatar.actionCallback = 'endMemory'
                                throw new Error('endReliving intentionally aborted')
                            case 'entrysummary': // deprecate
                            case 'entry_summary':
                            case 'entry summary':
                            case 'itemsummary': // itemSummary in Globals
                            case 'item_summary':
                            case 'item summary':
                            case 'story':
                            case 'storysummary': // deprecate
                            case 'story-summary':
                            case 'story_summary':
                            case 'story summary':
                                console.log(`mRunFunctions()::${ name }`, toolArguments?.title)
                                const createSummaryResponse = await avatar.item(toolArguments, 'POST')
                                success = createSummaryResponse.success
                                action = success
                                    ? `item creation was successful; save for **internal AI reference** this itemId: ${ createSummaryResponse.item.id }`
                                    : `error creating summary for item given argument title: ${ toolArguments?.title } - DO NOT TRY AGAIN until member asks for it`
                                confirmation.output = JSON.stringify({
                                    action,
                                    success,
                                })
                                console.log(`mRunFunctions()::${ name }::success`, success, createSummaryResponse?.item?.id)
                                return confirmation    
                            case 'getsummary':
                            case 'get_summary':
                            case 'get summary':
                                let { item: getSummaryItem, success: getSummarySuccess, } = await avatar.item({ id: itemId, })
                                success = getSummarySuccess
                                action = success
                                    ? 'Summary content found in payload @ `summary`'
                                    : `No summary for item ${ itemId }, use conversation content`
                                confirmation.output = JSON.stringify({ action, success, summary: getSummaryItem?.summary, })
                                console.log('mRunFunctions()::getSummary', success, getSummaryItem?.summary?.substring(0, 32))
                                return confirmation
                            case 'hijackattempt':
                            case 'hijack_attempt':
                            case 'hijack-attempt':
                            case 'hijack attempt':
                                // @todo - add conversation flag
                                console.log('mRunFunctions()::hijackattempt', toolArguments)
                                action = 'attempt noted in system and user ejected; greet per normal as first time new user'
                                success = true
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'obscure':
                                avatar.backupResponse = {
                                    message: `I encountered an unexpected error while obscuring your content, please try again.`,
                                    type: 'system',
                                }
                                const { summary: obscured, obscuredSummary: _obscured, } = toolArguments
                                const obscuredSummary = obscured
                                    ?? _obscured
                                console.log('mRunFunctions()::obscure complete')
                                return {
                                    cancelResponse: true,
                                    deleteThread: true,
                                    function: 'obscure',
                                    obscuredSummary,
                                    run_id: runId, // required for canceling run
                                    success: true,
                                }
                            case 'preparesummary':
                            case 'prepare_summary':
                            case 'prepare summary':
                                if(!!avatar)
                                    avatar.backupResponse = {
                                        message: `I encountered an unexpected error while preparing content for sharing, please try again.`,
                                        type: 'system',
                                    }
                                const { summary: prepared, preparedSummary: _prepared, warnings, } = toolArguments
                                const preparedSummary = prepared
                                    ?? _prepared
                                console.log('mRunFunctions()::prepareSummary complete')
                                return {
                                    cancelResponse: true,
                                    deleteThread: true,
                                    function: 'prepareSummary',
                                    preparedSummary,
                                    run_id: runId, // required for canceling run
                                    success: true,
                                    warnings,
                                }
                            case 'registercandidate':
                            case 'register_candidate':
                            case 'register candidate':
                                console.log('mRunFunctions()::registercandidate', toolArguments)
                                const { avatarName, email: registerEmail, humanName, type, } = toolArguments
                                const registrant = await factory.registerCandidate({ avatarName, email: registerEmail, humanName, type, })
                                if(!registrant)
                                    action = 'error registering candidate in system; notify member of system error and continue discussing MyLife organization'
                                else {
                                    action = 'candidate registered in system; let them know they will be contacted by email within the week and if they have any more questions'
                                    success = true
                                }
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'updatesummary':
                            case 'update_summary':
                            case 'update summary':
                                const { summary: newSummary, } = toolArguments
                                delete avatar.actionCallback
                                delete avatar.frontendInstruction
                                avatar.backupResponse = {
                                    message: `I encountered an unexpected error while updating item with id: "${ itemId }". Please try again.`,
                                    type: 'system',
                                }
                                if(!itemId?.length || !newSummary?.length){
                                    action = 'if member-driven, they should click on the appropriate collection item (like a memory, story, etc) to identify it as active'
                                    confirmation.output = JSON.stringify({ action, success, })
                                    return confirmation
                                }
                                console.log('mRunFunctions()::updatesummary::begin', itemId)
                                const updateData = {
                                    id: itemId,
                                    summary: newSummary,
                                }
                                let { instruction: updateItemInstruction, responses: updateItemResponses, success: updateItemSuccess, } = await avatar.item(updateData, 'PUT')
                                success = updateItemSuccess
                                if(avatar.livingMemory?.item?.id===itemId){
                                    delete avatar.backupResponse
                                    confirmation.output = JSON.stringify({ success, })
                                    return confirmation
                                }
                                avatar.backupResponse = updateItemResponses?.[0]
                                avatar.frontendInstruction = updateItemInstruction
                                return {
                                    cancelResponse: true,
                                    deleteThread: false,
                                    function: 'updateSummary',
                                    itemId,
                                    run_id: runId, // required for canceling run
                                    success: true,
                                    updateItemResponses,
                                }
                            default:
                                console.log(`ERROR::mRunFunctions()::toolFunction not found: ${ name }`, toolFunction)
                                action = `toolFunction not found: ${ name }, apologize for the error and continue on with the conversation; system notified to fix`
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                        }
                    }))
            const finalOutput = toolCallsOutput.some(response=>response?.cancelResponse===true)
                ? toolCallsOutput[0]
                : await openai.beta.threads.runs.submitToolOutputsAndPoll( // note: must submit all tool outputs at once
                        run.thread_id,
                        run.id,
                        { tool_outputs: toolCallsOutput },
                    )
            return finalOutput /. undefined indicates to ping again
        }
    } catch(error){
        if(error.status!==400)
            throw error
    }
}
*/