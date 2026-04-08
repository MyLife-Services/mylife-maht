import OpenAI from 'openai'
import { a2aExternalRequest, } from './controllers/a2a-functions.mjs'
import { mcpCall, } from './controllers/mcp-functions.mjs'
/* module constants */
const {
    OPENAI_API_KEY: mOpenaiKey,
    OPENAI_BASE_URL: mBasePath,
    OPENAI_MAX_INSTRUCTIONS_LENGTH,
    OPENAI_ORG_KEY: mOrganizationKey,
    OPENAI_API_CHAT_RESPONSE_PING_INTERVAL,
    OPENAI_API_CHAT_TIMEOUT,
} = process.env
const mDefaultLLMProvider = 'openai',
    mMaxInstructionsLength = parseInt(OPENAI_MAX_INSTRUCTIONS_LENGTH) || 256000,
    mPingIntervalMs = parseInt(OPENAI_API_CHAT_RESPONSE_PING_INTERVAL) || 890,
    mTimeoutMs = parseInt(OPENAI_API_CHAT_TIMEOUT) || 55000
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
     * @param {string} mbr_id - Member ID
     * @returns {Promise<Object>} - OpenAI `vectorstore` object
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
     * @param {string} conversation_id - The conversation id
     * @returns 
     */
    async deleteConversation(conversation_id){
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
     * @param {string} fileId - OpenAI file ID
     * @returns - OpenAI `file` object
     */
    async file(fileId){
        return await this.openai.files.retrieve(fileId)
    }
    /**
     * Returns file list from indicated vector store.
     * @documentation [OpenAI API Reference: Vector Stores](https://platform.openai.com/docs/api-reference/vector-stores-files/listFiles)
     * @param {string} vectorstoreId - OpenAI vector store ID
     * @returns {Promise<Object[]>} - Array of openai `file` objects
     */
    async files(vectorstoreId){
        const files = await this.openai.vectorStores.files.list(vectorstoreId)
        return files
    }
    /**
     * Given member input, get a response from the specified LLM service.
     * @documentation [Handling function calls](https://platform.openai.com/docs/guides/function-calling#handling-function-calls)
     * @param {string} conversation_id - Conversation id (from thread id)
     * @param {string} llmProvider - LLM provider object: { *id, model, provider, *type, variables, version, }
     * @param {string} input - Member input text
     * @param {AgentFactory} factory - Avatar Factory object to process request
     * @param {Avatar} avatar - Avatar object
     * @param {object} variables - variables object to send to LLM for response generation (required when required by LLM prompt)
     * @returns {Promise<Object[]>} - Array of openai `message` objects
     */
    async getLLMResponse(conversation_id, llmProvider, input, factory, avatar){
        if(llmProvider.provider!=='openai')
            throw new Error(`LLM provider ${llmProvider.provider} not supported.`)
        let prompt = {}
        switch(llmProvider?.type){
            case 'prompt':
                prompt.id = llmProvider.id
                const promptVariables = llmProvider?.variables &&
                    Object.fromEntries(llmProvider.variables.map(v => [v.toLowerCase(), avatar.promptVariable(v)]))
                if(promptVariables)
                    prompt.variables = promptVariables
                console.log(`LLMServices::getLLMResponse()::using prompt ${ prompt.id } with variables:`, prompt.variables)
                break
            case 'assistant':
                throw new Error('LLMServices::getLLMResponse()::error - assistant type LLM provision is deprecated.')
            default:
                throw new Error(`LLM provider type ${ llmProvider?.type } not recognized by system.`)
        }
        // clean input - requiring arrays to be flattened
        if(Array.isArray(input))
            input.forEach(item=>{
                Object.keys(item).forEach(key=>{
                    if(typeof item[key]!=='string')
                        item[key] = JSON.stringify(item[key])
                })
            })
        conversation_id ??= ( await mConversation(this.openai, undefined, input) ).id
        const response = await mResponse(this.openai, conversation_id, prompt, input)
        const { completed_at, created_at, error, id: response_id, incomplete_details, metadata, model, output, output_text, prompt: _prompt, status, temperature, tools, top_p, usage, } = response
        const llmMessages = []
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
                    // @stub - theoretically one can receive **both** function calls and content, but for now, I am treating as either/or; have not encountered a scenario of combination
                    switch(true){
                        case !!functionCalls.length: {
                            const deleteCalls = [],
                                toolResponses = []
                            let deleteConversation = false
                            try{
                                await Promise.all(
                                    functionCalls.map(async call=>{
                                        if(call.arguments && typeof call.arguments==='string')
                                            call.arguments = JSON.parse(call.arguments)
                                        const { call_id, id: function_id, name, status, } = call
                                        let { arguments: args, } = call
                                        const toolResponse = await avatar.llmFunctionCall(name, args)
                                        const { cancelResponse=false, deleteThread=false, ..._toolResponse } = toolResponse
                                        if(deleteThread)
                                            deleteConversation = true
                                        if(cancelResponse)
                                            deleteCalls.push(function_id)
                                        else
                                            toolResponses.push(mConvertToolResponse(llmProvider, _toolResponse, { call_id, function_id, name, tools, }))
                                    }
                                ))
                                if(deleteConversation)
                                    return await mConversationDelete(this.openai, conversation_id) // temp call; will not be referenced again
                                else if(
                                        deleteCalls.length 
                                    &&  await mCallDelete(this.openai, conversation_id, response_id, deleteCalls, deleteCalls.length>=functionCalls.length)
                                ) // if all calls are cancelled, delete entire response; if some calls cancelled, delete specific calls
                                    return
                            } catch(error) {
                                console.error('ERROR running tool function calls from LLM response; removing response and calls', error.name, error.message, conversation_id, response_id)
                                deleteCalls.length = 0 // clear deleteCalls
                                functionCalls.forEach(call=>deleteCalls.push(call.id)) // add all function calls to deleteCalls
                                await mCallDelete(this.openai, conversation_id, response_id, deleteCalls, true)
                                return
                            }
                            return await this.getLLMResponse(conversation_id, llmProvider, toolResponses, factory, avatar)
                        }
                        default: {
                            console.log(response_id, `getLLMResponse()::total_tokens: ${ usage.total_tokens }, output_tokens: ${ usage.output_tokens }`)
                            llmMessages.push(...messages.map(message => mMessageConvert(this.provider, message)))
                            return llmMessages
                        }
                    }
                } else
                    llmMessages.push(mMessageConvert(this.provider, 'Intelligence was unable to respond; please try your request again.'))
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
    }
    /**
     * Returns a specific message associated with a conversation.
     * @param {string} conversation_id - Conversation id
     * @param {string} msg_id - Message id
     * @returns {Promise<object>} - openai `message` object
     */
    async message(conversation_id, msg_id){
        const message = await mMessages(this.provider, conversation_id, msg_id)
        return message
    }
    /**
     * Returns messages associated with specified conversation.
     * @param {string} conversation_id - Conversation id
     * @returns {Promise<Object[]>} - Array of openai `message` objects
     */
    async messages(conversation_id){
        const { data: messages } = await mMessages(this.provider, conversation_id)
        return messages
    }
    /**
     * Upload files to OpenAI, currently `2024-05-13`, using vector-store, which is a new refactored mechanic.
     * @documentation [OpenAI API Reference: Vector Stores](https://platform.openai.com/docs/api-reference/vector-stores)
     * @documentation [file_search Quickstart](https://platform.openai.com/docs/assistants/tools/file-search/quickstart)
     * @param {string} vectorstoreId - Vector store ID from OpenAI
     * @param {object} files - as seems to be requested by api: { files, fileIds, }
     * @returns {Promise<object>} - The outcome of the upload { vectorstoreId, response, success, }
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
 * Deletes function calls from an OpenAI response. If deleteAll is true, also deletes entire response.
 * @param {OpenAI} openai - OpenAI object
 * @param {string} conversation_id - The conversation id
 * @param {string} response_id - The response id
 * @param {string} call_ids - list of function call ids to delete from response
 * @param {boolean} deleteAll - Whether to delete response entirely
 * @returns {Promise<boolean>} - Whether the response was deleted entirely (true) or just specific calls (false); when `false` any remaining tool responses are sent.
 */
async function mCallDelete(openai, conversation_id, response_id, call_ids, deleteAll=false){
    await Promise.all(
        call_ids.map(function_id=>openai.conversations.items.delete(function_id, { conversation_id }))
    )
    if(deleteAll)
        await openai.responses.delete(response_id)
    return deleteAll
}
/**
 * Gets or creates OpenAI conversation. Originally written as thread, but now deprecating.
 * @param {OpenAI} openai - OpenAI object
 * @param {string} conversation_id - conversation id
 * @param {Object[]|string} messages - message(s) (optional)
 * @param {object} metadata - metadata object (optional)
 * @returns {object} - OpenAI `conversation` object
 */
async function mConversation(openai, conversation_id, messages, metadata){
    let conversation
    if(conversation_id?.length)
        conversation = conversation_id.startsWith('thread_')
            ? await mConvertThreadToConversation(openai, conversation_id, metadata)
            : await openai.conversations.retrieve(conversation_id)
    else
        conversation = await openai.conversations.create({ metadata, })
    if(conversation?.id && messages?.length){ // seed message(s)
        const items = typeof messages==='string'
            ? [{
                type: "message",
                role: "user",
                content: messages,
            }]
            : Array.isArray(messages)
                ? messages
                : []
        if(items.length)
            await openai.conversations.items.create(conversation.id, { items })
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
 * Gets or creates OpenAI conversation. Originally written as thread, but now deprecating.
 * @param {OpenAI} openai - openai object
 * @param {string} conversation_id - conversation id
 * @param {object} metadata - metadata object (optional)
 * @returns {object} - openai `conversation` object
 */
async function mConvertThreadToConversation(openai, conversation_id, metadata={}){
    metadata.thread_id = conversation_id
    const conversation = await openai.conversations.create({ metadata, }),
        messages = []
    if(!conversation?.id)
        throw new Error(`Failed to create conversation for thread ${ conversation_id }`, metadata)
    try {
        for await (const message of openai.beta.threads.messages.list(conversation_id, { limit: 100, order: "asc" }))
            messages.push(message)
        const items = messages.map((m)=>{
            const content = m.content.flatMap((c)=>{
                switch (c.type) {
                    case "text":
                        return [{ type: m.role === "user" ? "input_text" : "output_text", text: c.text.value }]
                    case "image_url":
                        return [{ type: "input_image", image_url: c.image_url.url, detail: c.image_url.detail }]
                    default:
                        return []
                }
            })
            return { role: m.role, content }
        })
        const batchSizeMax = 20
        for (let i = 0; i < items.length; i += batchSizeMax){
            const batch = items.slice(i, i + batchSizeMax)
            await openai.conversations.items.create(conversation.id, { items: batch })
        }
        console.warn(`mConversation()::${ conversation_id } is deprecated, converted to ${ conversation.id }`)
    } catch(error) {
        console.error(`ERROR converting thread content from ${ conversation_id } to conversation ${ conversation.id }`, error.name, error.message, metadata)
    }
    return conversation
}
/**
 * Converts tool response to a sanitized format for LLM response generation. This is required as tools can return a variety of content, but LLM response generation requires a consistent format.
 * @param {object} llmProvider - LLM provider object
 * @param {object} toolResponse - The MyLife response from the tool function call
 * @param {object} providerOptions - Additional options for specific LLM providers, such as call_id
 * @returns {object} - Sanitized tool response in expected format for LLM response generation
 */
function mConvertToolResponse(llmProvider, toolResponse, providerOptions={}){
    const provider = typeof llmProvider==='string'
        ? llmProvider
        : llmProvider?.provider
            ?? mDefaultLLMProvider
    let sanitizedResponse
    switch(provider.toLowerCase()){
        case 'openai':
            const { call_id, function_id, name, tools, } = providerOptions
            const { action, itemId, function: functionName, success=false, ...rest } = toolResponse
            sanitizedResponse = {
                type: "function_call_output",
                call_id: call_id,
                output: {
                    action,
                    itemId,
                    success,
                    ...rest,
                },
            }
            break
        default:
            sanitizedResponse = toolResponse
            break
    }
    return sanitizedResponse
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
 * @param {OpenAI} openai - openai object
 * @param {string} conversation_id - Conversation id (from thread id)
 * @param {object} prompt  - Prompt id in OpenAI (from assistant id)
 * @param {string|object[]} input - Member input text, be it one message or multiple (=JSON.stringify())
 * @param {object} metadata - Metadata object to send with request (optional)
 * @param {string} instructionOverride - String to override default instruction in prompt for this response generation (optional)
 * @param {number} max_output_tokens - Max output tokens for response (optional, default: 10240)
 * @returns {object} - [openai `response` object](https://platform.openai.com/docs/api-reference/responses/object?lang=javascript)
 */
async function mResponse(openai, conversation_id, prompt, input, metadata, instructionOverride, max_output_tokens=10240){
    const request = {
        conversation: conversation_id,
        include: ['web_search_call.action.sources', 'file_search_call.results'],
        input,
        max_output_tokens,
        metadata,
        prompt,
    }
    if(instructionOverride?.length)
        request.instructions = instructionOverride
    console.log(`LLMServices::mResponse()::sending request to OpenAI with conversation_id ${ conversation_id } and prompt:`, prompt, input, metadata, instructionOverride)
    const response = await openai.responses.create(request)
    return response
}
/**
 * Validates assistant data before sending to OpenAI.
 * @param {object} data - Object data to validate
 * @returns {object} - Cured assistant object data
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
    if(instructions?.length > mMaxInstructionsLength)
        instructions = instructions.substring(0, mMaxInstructionsLength)
    const assistantData = {
        description,
        instructions,
        metadata,
        model,
        name,
        tools,
        tool_resources,
    }
    Object.keys(assistantData).forEach(key =>{
        if(assistantData[key] === undefined)
            delete assistantData[key]
    })
    return assistantData
}
/* exports */
export default LLMServices