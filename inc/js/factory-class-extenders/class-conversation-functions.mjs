async function mSaveConversation(_factory, _conversation){
    const { thread, messages, ..._retainedProperties} = _conversation.inspect(true)
    _retainedProperties.thread = _conversation.thread
    _retainedProperties.messages = [] // populated separately as unshifted array to cosmos
    await _factory.dataservices.pushItem(_retainedProperties)
}
export {
    mSaveConversation,
}