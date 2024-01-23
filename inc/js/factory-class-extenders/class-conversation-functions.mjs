async function mInvokeThread(_openai, _thread_id){
    if(_thread_id?.length)
        return await _openai.beta.threads.retrieve(_thread_id)
    else
        return await _openai.beta.threads.create()
}    
async function mMessages(_openai, _thread_id){
    return await _openai.beta.threads.messages
        .list(_thread_id)
}
async function mSaveConversation(_factory, _conversation){
    const { thread, messages, ..._retainedProperties} = _conversation.inspect(true)
    _retainedProperties.thread = _conversation.thread
    _retainedProperties.messages = [] // populated separately as unshifted array to cosmos
    await _factory.dataservices.pushItem(_retainedProperties)
}
export {
    mInvokeThread,
    mMessages,
    mSaveConversation,
}