import OpenAI from 'openai'
import { a2aExternalRequest, } from './controllers/a2a-functions.mjs'
import { mcpCall, } from './controllers/mcp-functions.mjs'
/* module constants */
const {
    OPENAI_API_CHAT_TIMEOUT,
    OPENAI_API_KEY: mOpenaiKey,
    OPENAI_BASE_URL: mBasePath,
    OPENAI_MAX_INSTRUCTIONS_LENGTH,
    OPENAI_MAX_OUTPUT_TOKENS,
    OPENAI_ORG_KEY: mOrganizationKey,
    OPENAI_API_VERSION: mOpenAIApiVersion = '7.62.0',
} = process.env
const mDefaultLLMProvider = 'openai',
    mMaxInstructionsLength = parseInt(OPENAI_MAX_INSTRUCTIONS_LENGTH) || 256000, // note: `??` does not parse NaN
    mMaxOutputTokens = parseInt(OPENAI_MAX_OUTPUT_TOKENS) || 10240,
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
                baseURL: mBasePath,
                organization: orgKey,
                timeout: mTimeoutMs,
            }))
    }
    /* public methods */
    /**
     * One-shot chat completion without conversation/thread overhead. [API documentation](https://developers.openai.com/api/reference/typescript/resources/chat/subresources/completions/methods/create)
     * @param {string} systemInstruction - System-level instruction for the model
     * @param {string} userContent - User content to process
     * @param {string} [model='gpt-3.5-turbo'] - Model to use
     * @returns {Promise<object|undefined>} - The assistant's response first choice `message`, or `undefined` on error { annotations, content, refusal, role, }
     */
    async chatCompletion(systemInstruction, userContent, model='gpt-3.5-turbo'){
        try {
            const messages = []
            if(systemInstruction?.length)
                messages.push({ role: 'system', content: systemInstruction })
            if(userContent?.length)
                messages.push({ role: 'user', content: userContent })
            const completion = await this.openai.chat.completions.create({
                model,
                messages,
            })
            return completion.choices?.[0]?.message
        } catch(error) {
            console.error('LLMServices::chatCompletion()::error', error)
            return undefined
        }
    }
    /**
     * Gets or creates (if no conversation_id) a new OpenAI conversation, previously thread().
     * @param {string} conversation_id - conversation id
     * @param {Bot} Bot - Required for Conversation creation
     * @param {string} message - array of messages (optional)
     * @param {object} metadata - metadata object (optional)
     * @returns {Promise<Object>} - openai conversation object
     */
    async conversation(conversation_id, Bot, messages=[], metadata){
        const conversation = await mConversation(this.openai, conversation_id, Bot, messages, metadata)
        return conversation
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
     * Deletes a conversation from OpenAI.
     * @param {string} conversation_id - The conversation id to delete
     * @returns {Promise<Object>} - The deleted conversation object
     */
    async deleteConversation(conversation_id){
        return await mConversationDelete(this.openai, conversation_id)
    }
    /**
     * Deletes a response object from OpenAI.
     * @param {string} response_id - The response id to delete
     * @returns {Promise<Object>} - The deleted response object
     */
    async deleteResponse(response_id){
        return await mResponseDelete(this.openai, response_id)
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
                const { content, created_at, id, thread_id, } = response
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
     * @param {string} input - Member input text, message strings, or system instructions array (limit 20 max)
     * @param {AgentFactory} factory - Avatar Factory object to process request
     * @param {Avatar} Avatar - Avatar object
     * @param {Bot} Bot - The active and correct Bot object
     * @param {string} previous_response_id - The previous response id to associate with this request (optional)
     * @returns {Promise<Object[]>} - Array of openai `message` objects
     */
    async getLLMResponse(conversation_id, llmProvider, input, factory, Avatar, Bot, previous_response_id){
        if(llmProvider.provider!=='openai')
            throw new Error(`LLM provider ${ llmProvider.provider ?? 'unknown' } not supported.`)
        Bot ??= Avatar.activeBot
        if(Array.isArray(input))
            input.forEach(item=>{
                Object.keys(item).forEach(key=>{
                    if(typeof item[key]!=='string')
                        item[key] = JSON.stringify(item[key])
                })
            })
        const options = {
            conversation_id,
            max_output_tokens: Bot?.maxOutputTokens ?? mMaxOutputTokens,
            metadata: {},
            previous_response_id,
            promptVariable: Avatar.promptVariable.bind(Avatar),
        }
        const response = await mResponse(this.openai, llmProvider, Bot, input, options)
        const {
            completed_at,
            created_at,
            error,
            id: response_id,
            incomplete_details,
            metadata,
            output,
            output_text,
            status,
            temperature,
            tools,
            top_p,
            usage,
        } = response
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
                                        const toolResponse = await Avatar.llmFunctionCall(name, args)
                                        const { cancelResponse=false, deleteThread=false, ..._toolResponse } = toolResponse
                                        if(deleteThread)
                                            deleteConversation = true
                                        if(cancelResponse)
                                            deleteCalls.push(function_id)
                                        else
                                            toolResponses.push(mConvertToolResponse(llmProvider, _toolResponse, { call_id, function_id, name, tools, }))
                                    }
                                ))
                                if(deleteConversation){
                                    this.deleteResponse(response_id) // no await
                                    this.deleteConversation(conversation_id) // no await
                                    return true
                                } else if(
                                        deleteCalls.length
                                    &&  await mCallDelete(this.openai, conversation_id, response_id, deleteCalls, deleteCalls.length>=functionCalls.length)
                                ) // if all calls are cancelled, delete entire response; if some calls cancelled, delete specific calls
                                    return true
                            } catch(error) {
                                console.error('ERROR running tool function calls from LLM response', response_id, error)
                                deleteCalls.length = 0 // clear deleteCalls
                                functionCalls.forEach(call=>deleteCalls.push(call.id)) // add all function calls to deleteCalls
                                await mCallDelete(this.openai, conversation_id, response_id, deleteCalls, true)
                                return false
                            }
                            return await this.getLLMResponse(conversation_id, llmProvider, toolResponses, factory, Avatar, Bot, conversation_id?.length ? undefined : response_id) // recursive call to process tool responses
                        }
                        default: {
                            console.log(response_id, `getLLMResponse()::total_tokens: ${ usage.total_tokens }, output_tokens: ${ usage.output_tokens }`)
                            llmMessages.push(...messages.map(message => mMessageConvert(this.provider, message, response_id)))
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
        return await mMessages(this.openai, conversation_id, msg_id)
    }
    /**
     * Returns all messages associated with a conversation (paginated internally).
     * @param {string} conversation_id - Conversation id
     * @returns {Promise<Object[]>} - Array of openai `message` objects, newest first
     */
    async messages(conversation_id){
        return await mMessages(this.openai, conversation_id)
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
    /* DELETE FUNCTION CALLS */
    await Promise.all( // delete calls so they no longer show in response history
        call_ids.map(function_id=>openai.conversations.items.delete(function_id, { conversation_id }))
    )
    /* DELETE MEMBER INPUT */
    // Requests may continue to trigger some function calls in the function array have a response
    const { data } = await openai.conversations.items.list(conversation_id, { limit: 20, order: 'desc', })
    const inputItems = []
    for(const item of data){
        if(item.role==='assistant')
            break
        if(item.role==='user')
            inputItems.push(item.id)
    }
    await Promise.all(
        inputItems.map(itemId=>openai.conversations.items.delete(itemId, { conversation_id }))
    )
    if(deleteAll){ // delete entire response to clear from context history
        /* DELETE RESPONSE */
        await mResponseDelete(openai, response_id)
    }
    return deleteAll
}
/**
 * Gets or creates OpenAI conversation. Originally written as thread, but now deprecating.
 * @param {OpenAI} openai - OpenAI object
 * @param {string} conversation_id - conversation id
 * @param {Bot} Bot - Required for Conversation creation
 * @param {Object[]|string} messages - message(s) (optional)
 * @param {object} metadata - metadata object (optional)
 * @returns {object} - OpenAI `conversation` object
 */
async function mConversation(openai, conversation_id, Bot, messages=[], metadata={}){
    let conversation
    metadata.botId ??= Bot?.id
    metadata.chatVersion ??= mOpenAIApiVersion
    metadata.mbrId ??= Bot?.mbr_id
    conversation = await mConversationModernize(openai, conversation_id, Bot, metadata)
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
 * Retrieves any existing items for an OpenAI conversation.
 * @param {OpenAI} openai - OpenAI object
 * @param {string} conversation_id - Conversation id
 * @param {boolean} conversationExists - Whether the conversation exists (as 'conv_')
 * @returns {Promise<Object[]>} - Array of conversation items
 */
async function mConversationItems(openai, conversation_id, conversationExists){
    let items=[]
    if(conversation_id.startsWith('thread_')){

    }
    return items
}
/**
 * Ensures modernization of OpenAI conversation.
 * @param {OpenAI} openai - openai object
 * @param {string} conversation_id - conversation id
 * @param {Bot} Bot - Required for Conversation creation
 * @param {object} metadata - metadata object (optional)
 * @returns {Promise<object>} - openai `conversation` object
 */
async function mConversationModernize(openai, conversation_id, Bot, metadata){
    let conversation,
        conversationExists =false
    if(conversation_id?.startsWith('conv_')){
        try {
            conversation = await openai.conversations.retrieve(conversation_id)
            conversationExists = true
        } catch(error){
            if(error?.status!==404)
                throw error
            console.warn('LLMServices::mConversationModernize()::conversation not found, recreating', conversation_id)
        }
    }
    const versionStamp = conversation?.metadata?.chatVersion
    if(mConversationVersionCheck(versionStamp, mOpenAIApiVersion)) // conversation already modern
        return conversation
    console.log('LLMServices::mConversation()::modernizing conversation', conversation_id, metadata, conversation)
    const instructions = Bot?.instructionsCurrent?.slice(0, mMaxInstructionsLength)
    metadata.chatVersion = mOpenAIApiVersion
    if(conversation_id?.length)
        metadata.upgradedConversationId = conversation_id
    const items = await mConversationItems(openai, conversation_id, conversationExists)
    items.unshift({ type: 'message', role: 'developer', content: instructions, }) // collection item ids and titles
    items.unshift({ type: 'message', role: 'system', content: instructions, })
    conversation = await openai.conversations.create({ items, metadata, })
    console.log('LLMServices::mConversation()::created new conversation', metadata, conversation, instructions)
}
/**
 * Checks version, and returns true if conversation is modern, false if needs modernization. Note that minor version changes are not considered necessary to adjust conversation, but major version changes are.
 * @param {string} conversationVersion - Conversation version from conversation metadata
 * @param {string} currentVersion - Current conversation version, defaults to `mOpenAIApiVersion`
 * @returns {boolean} - true if conversation is modern, false if needs modernization
 */
function mConversationVersionCheck(conversationVersion, currentVersion=mOpenAIApiVersion){
    return conversationVersion===currentVersion || (conversationVersion && currentVersion && conversationVersion.split('.')[0] === currentVersion.split('.')[0])
}
/**
 * Gets or creates OpenAI conversation. Originally written as thread, but now deprecating.
 * @param {OpenAI} openai - openai object
 * @param {string} conversation_id - conversation id
 * @param {Bot} Bot - Required for Conversation creation
 * @param {object} metadata - metadata object (optional)
 * @returns {object} - openai `conversation` object
 */
async function mConvertThreadToConversation(openai, conversation_id, Bot, metadata={}){
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
        const instructions = Bot?.instructionsCurrent?.slice(0, mMaxInstructionsLength)
        if(instructions?.length)
            items.unshift({ type: 'message', role: 'system', content: instructions })
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
 * @param {object} llmProvider - LLM provider object { *model, *provider, *type, variables, version, }
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
    if(msg_id?.length)
        return await openai.conversations.items.retrieve(conversation_id, msg_id)
    const items = []
    let after = undefined,
        has_more = true
    while(has_more){
        const page = await openai.conversations.items.list(
            conversation_id,
            { after, limit: 100, }
        )
        items.push(...(page.data ?? []))
        has_more = page.has_more ?? false
        after = page.last_id ?? undefined
        if(!after)
            break
    }
    return items
}
/**
 * Format input for OpenAI.
 * @module
 * @param {string} provider - LLM provider
 * @param {string} message - message text 
 * @param {string} response_id - response id to associate with message for traceability (optional)
 * @returns {object} - synthetic openai `message` object
 */
function mMessageConvert(provider, message, response_id){
    let messageConverted = {}
    switch(provider){
        default:
            if(typeof message==='string'){
                messageConverted.content = { text: message, type: 'input_text', }
                messageConverted.id = crypto.randomUUID()
                messageConverted.role = 'assistant'
                messageConverted.response_id = response_id
                messageConverted.status = 'completed'
                messageConverted.type = 'message'
            } else
                messageConverted = message
            break
    }
    return messageConverted
}
/**
 * Converts stored (Assistants-format) tools to Responses API format.
 * @param {object[]} tools - Bot tools: { type: 'function', function: {...} } | { type: 'file_search' } | ...
 * @param {object} tool_resources - { file_search: { vector_store_ids, } }
 * @returns {object[]} - Responses API tools
 */
function mNormalizeTools(tools=[], tool_resources){
    const vector_store_ids = tool_resources?.file_search?.vector_store_ids ?? []
    return tools.flatMap(tool=>{
        if(tool?.type==='function' && tool.function)
            return [{ type: 'function', ...tool.function }]
        if(tool?.type==='file_search')
            return vector_store_ids.length ? [{ type: 'file_search', vector_store_ids }] : []
        return tool ? [tool] : []
    })
}
/**
 * Creates an OpenAI request with member input. Appends to Conversation in OpenAI.
 * @param {OpenAI} openai - openai object
 * @param {object} llmProvider - LLM provider object
 * @param {Bot} Bot - The requested Bot object
 * @param {string|object[]} input - Member input text, be it one message or multiple (=JSON.stringify())
 * @param {object} options - Request options (optional) `{ conversation_id, max_output_tokens, metadata, promptVariable, }`
 * @returns {object} - [openai `response` object](https://platform.openai.com/docs/api-reference/responses/object?lang=javascript)
 */
async function mResponse(openai, llmProvider, Bot, input, options={}){
        let prompt = {}
        const {
            conversation_id,
            max_output_tokens,
            metadata,
            previous_response_id,
            promptVariable,
        } = options
        const request = {
            include: ['web_search_call.action.sources', 'file_search_call.results'],
            input,
            max_output_tokens,
            metadata,
            model: llmProvider?.model,
        }
        if(conversation_id?.length)
            request.conversation = conversation_id
        switch(llmProvider?.type){
            case 'assistant':
                throw new Error('LLMServices::getLLMResponse()::error - assistant type LLM provision is deprecated.')
            case 'prompt':
/* Original prompt code, if required to revive
                prompt.id = llmProvider.id
                const promptVariables = Array.isArray(llmProvider?.variables) && typeof promptVariable==='function'
                    ? Object.fromEntries(llmProvider.variables.map(v => [v.toLowerCase(), promptVariable(v, Bot)]))
                    : llmProvider?.variables
                if(promptVariables)
                    prompt.variables = promptVariables
*/
                console.warn('OpenAI will be deprecating `pronpt` objects on 2026-11-30; ensure that this protocol is no longer referenced by system intelligence instructions')
            case 'chat': {
                const tools = mNormalizeTools(Bot?.tools, Bot?.tool_resources)
                if(tools.length)
                    request.tools = tools
                if(!conversation_id?.length){
                    request.instructions = Bot?.instructionsCurrent?.slice(0, mMaxInstructionsLength)
                    if(previous_response_id?.length)
                        request.previous_response_id = previous_response_id
                }
                break
            }
            default:
                throw new Error(`LLM provider type ${ llmProvider?.type } not recognized by system.`)
        }
    const response = await openai.responses.create(request)
    console.log('mResponse()', request, response)
    return response
}
async function mResponseDelete(openai, response_id){
    return await openai.responses.delete(response_id)
}
/* exports */
export default LLMServices