/* message modular functions */
/**
 * add or update openai portion of `this.message`
 * @modular
 * @public
 * @param {string} _message 
 * @returns {object} openai `message` object
 */
async function mGetMessage(_openai, _thread, _content, _msg_id, ){
    //  files are attached at the message level under file_ids _array_, only content aside from text = [image_file]:image_file.file_id
    return (!_msg_id)
    ?	await _openai.beta.threads.messages.create(	//	add
            _thread.id,
            mGetMessage_openAI(_content)
        )
    :	await _openai.beta.threads.messages.update(	//	update
            _thread.id,
            _msg_id,
            mGetMessage_openAI(_content)
        )
    /* TODO: code for message retrieval
    switch (this.system) {
        case 'openai_assistant':
            return await this.#openai.beta.threads.messages.retrieve(
                this.message.message.thread_id,
                this.message.id
            )
        default:
            break
    }
    */
}
/**
 * Assigns content (from _message.message) to message object.
 * @modular
 * @public
 * @param {Message} _message Message object
 * @param {object} _obj Object to assign to message
 */
function mReviewContent(_message, _obj){
    _message.content = (_obj?.category?.length)
        ?   `Category Mode: ${_obj.category}. If asked: ${_obj.question}, I would say: ` + _obj.message // todo: cleanse/prepare message function
        :   _obj?.message??
            _obj?.content??
            _message?.content??
            ''
}
/* message "private" modular functions [unexported] */
/**
 * @modular
 * @private
 * @param {string} _msg - message text 
 * @returns {object} - openai `message` object
 */
function mGetMessage_openAI(_msg){
    return {
        role: 'user',
        content: _msg,
//         file: this.file,
    }
}
/* exports */
export {
    mGetMessage,
	mReviewContent,
}