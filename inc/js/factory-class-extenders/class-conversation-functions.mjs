async function mSaveConversation(factory, conversation){
    const { thread, messages, ...properties} = conversation.inspect(true)
    properties.thread = conversation.thread
    properties.messages = [] // populated separately as unshifted array to cosmos
    const savedConversation = await factory.dataservices.pushItem(properties)
    console.log('mSaveConversation', savedConversation)
}
export {
    mSaveConversation,
}