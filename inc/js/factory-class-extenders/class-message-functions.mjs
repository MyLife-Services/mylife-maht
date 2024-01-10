/* message modular functions */
/**
 * Assigns content (from _message.message) to message object.
 * @modular
 * @public
 * @param {Message} _message Message object
 * @param {object} _obj Object to assign to message
 */
function mAssignContent(_message, _obj){
    _message.content = (_obj?.category?.length)
        ?   `Category Mode: ${_obj.category}. If asked: ${_obj.question}, I would say: ` + _obj.message // todo: cleanse/prepare message function
        :   _obj?.message??
            _obj?.content??
            _message?.content??
            ''
}
/**
 * add or update openai portion of `this.message`
 * @modular
 * @public
 * @param {string} _message 
 * @returns {object} openai `message` object
 */
async function mGetMessage(_openai, _thread, _content, _msg_id){
    //  files are attached at the message level under file_ids _array_, only content aside from text = [image_file]:image_file.file_id
    return (!_msg_id)
    ?	await _openai.beta.threads.messages.create(	//	add
            _thread.id,
            mGetMessage_openAI(_content)
        )
    :	await _openai.beta.threads.messages.retrieve(	//	get
            _thread.id,
            _msg_id,
        )
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
	mAssignContent,
}