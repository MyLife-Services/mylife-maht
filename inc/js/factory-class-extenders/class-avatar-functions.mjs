import { Marked } from 'marked'
/* modular "public" functions */
/**
 * Assigns evolver listeners.
 * @modular
 * @param {EvolutionAssistant} _evolver - Evolver object
 * @param {Avatar} _avatar - Avatar object
 * @returns {void}
 */
function mAssignEvolverListeners(_evolver, _avatar){
    /* assign evolver listeners */
    _evolver.on(
        'on-contribution-new',
        _contribution=>{
            _contribution.emit('on-contribution-new', _contribution)
        }
    )
    _evolver.on(
        'avatar-change-category',
        (_current, _proposed)=>{
            _avatar.category = _proposed
            console.log('avatar-change-category', _avatar.category.category)
        }
    )
    _evolver.on(
        'on-contribution-submitted',
        _contribution=>{
            // send to gpt for summary
            const _responses = _contribution.responses.join('\n')
            const _summary = _avatar.factory.openai.completions.create({
                model: 'gpt-3.5-turbo-instruct',
                prompt: 'summarize answers in 512 chars or less, if unsummarizable, return "NONE": ' + _responses,
                temperature: 1,
                max_tokens: 700,
                frequency_penalty: 0.87,
                presence_penalty: 0.54,
            })
            // evaluate summary
            console.log('on-contribution-submitted', _summary)
            abort
            //  if summary is good, submit to cosmos
        }
    )
}
/**
 * Requests and returns chat response from openAI.
 * @modular
 * @public
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _chatMessage - Chat message
 * @param {string} _conversation_id - Cosmos conversation id
 * @returns {array} - array of front-end MyLife chat response objects { agent, category, contributions, message, response_time, purpose, type }
 */
async function mChat(_openai, _avatar, _chatMessage, _conversation_id){
    const _processStartTime = Date.now()
    //  add metadata, optional
    //	assign uploaded files (optional) and push `retrieval` to tools
    //	create message
    const _message = new (_avatar.message)(_chatMessage)
    await _message.init(_avatar.thread)
    _avatar.messages.unshift(_message)
    await mRunTrigger(_openai, _avatar) // run is triggered by message creation, content embedded/embedding now in _avatar
    //	get message data from thread
    const _messages = (await _avatar.getMessages())
        .filter(_msg => _msg.run_id == _avatar.runs[0].id)
        .map(_msg => {
            return new (_avatar.factory.message)({
                avatar_id: _avatar.id,
                content: _msg.content[0].text.value,
                mbr_id: _avatar.mbr_id,
                role: 'assistant',
            })
        })
    const _responses = await Promise.all(
        _messages.map(async _msg => {
            return await _msg.init(_avatar.thread)
        })
    )
    _responses.forEach(_msg => {
//  @todo: reinstate contribution
//        _avatar.#evolver?.setContribution(_avatar.#activeChatCategory, _msg)??false
        _avatar.messages.unshift(_msg)
    })
    //	update cosmos
    if ((_avatar?.factory !== undefined) && (process.env?.MYLIFE_DB_ALLOW_SAVE === 'true')) {
        _avatar.factory.dataservices.patchArrayItems( // no need to await
            _conversation_id,
            'messages',
            [..._responses, _message]
        )
    }
    //	return response
    return _responses
        .map(_msg=>{
            const __message = mPrepareMessage(_msg.text) // returns object { category, content }
            return {
                agent: 'server',
                category: __message.category,
                contributions: [],
                message: __message.content,
                response_time: Date.now()-_processStartTime,
                purpose: 'chat response',
                type: 'chat',
            }
        })
}
/**
 * Creates openAI assistant.
 * @modular
 * @public
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @returns {object} - [OpenAI assistant object](https://platform.openai.com/docs/api-reference/assistants/object)
 */
async function mCreateAssistant(_openai, _avatar){
    const _core = {
        name: _avatar?.names[0]??_avatar.name,
        model: process.env.OPENAI_MODEL_CORE,
        description: _avatar.description,
        instructions: _avatar.purpose,
/* metadata does not function as expected, so need to move to instructions while in bounds, then file attachments 
        metadata: {
            ...Object.entries(_avatar.categories)
                .filter(([key, value]) => _avatar[value.replace(' ', '_').toLowerCase()]?.length)
                .slice(0, 16)
                .reduce((obj, [key, value]) => ({
                    ...obj,
                    [value]: _avatar[value.replace(' ', '_').toLowerCase()],
                }), {})
        },
*/
        file_ids: [],	//	no files at birth, can be added later
        tools: [],	//	only need tools if files
    }
    return await _openai.beta.assistants.create(_core)
}
async function mGetAssistant(_openai, _assistant_id){
    return await _openai.beta.assistants.retrieve(_assistant_id)
}
/**
 * Returns MyLife-version of chat category object
 * @modular
 * @public
 * @param {object} _category - local front-end category { category, contributionId, question/message/content }
 * @returns {object} - local category { category, contributionId, content }
 */
function mGetChatCategory(_category) {
    const _proposedCategory = {
        category: '',
        contributionId: undefined,
        content: undefined,
    }
    if(_category?.category && _category.category.toLowerCase() !== 'off'){
        _proposedCategory.category = mFormatCategory(_category.category)
        _proposedCategory.contributionId = _category.contributionId
        _proposedCategory.content = 
            _category?.question??
            _category?.message??
            _category?.content // test for undefined
    }
    return _proposedCategory
}
async function mMessages(_openai, _thread_id){
        return await _openai.beta.threads.messages
            .list(_thread_id)
}
/**
 * Returns all openai `run` objects for `thread`.
 * @modular
 * @public
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @returns {array} - array of [OpenAI run objects](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRuns(_openai, _avatar){
	if(!_avatar.runs){
		_avatar.runs = await _openai.beta.threads.runs
            .list(_avatar.thread.id)
	}
}
/* modular "private" functions [unexported] */
/**
 * Cancels openAI run.
 * @modular
 * @private
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _run_id - Run id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mCancelRun(_openai, _avatar, _run_id){
    return await _openai.beta.threads.runs.cancel(
        _avatar.thread.id,
        _run_id
    )
}
/**
 * Returns simple micro-category after logic mutation.
 * @modular
 * @private
 * @param {string} _category text of category
 * @returns {string} formatted category
 */
function mFormatCategory(_category){
    return _category
        .trim()
        .slice(0, 128)  //  hard cap at 128 chars
        .replace(/\s+/g, '_')
        .toLowerCase()
}
/**
 * returns simple micro-message with category after logic mutation. 
 * Currently tuned for openAI gpt-assistant responses.
 * @modular
 * @private
 * @param {string} _msg text of message, currently from gpt-assistants
 * @returns {object} { category, content }
 */
function mPrepareMessage(_msg){
    /* parse message */
    // Regular expression to match the pattern "Category Mode: {category}. " or "Category Mode: {category}\n"; The 'i' flag makes the match case-insensitive
    const _categoryRegex = /^Category Mode: (.*?)\.?$/gim
    const _match = _categoryRegex.exec(_msg)
    const _messageCategory = mFormatCategory(_match?.[1]??'')
    // Remove from _msg
    _msg = _msg.replace(_categoryRegex, '')
    const _content = _msg.split('\n')
        .filter(_line => _line.trim() !== '') // Remove empty lines
        .map(_msg=>{
            return new Marked().parse(_msg)
        })
        .join('\n')
    return {
        category: _messageCategory,
        content: _content,
    }
}
/**
 * Maintains vigil for status of openAI `run = 'completed'`.
 * @modular
 * @private
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunFinish(_openai, _avatar){
    const _run_id = _avatar.runs[0].id // runs[0] just populated, concretize before async
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
            try {
                const status = await mRunStatus(_openai, _avatar, _run_id)
                if (status) {
                    clearInterval(checkInterval)
                    resolve('Run completed')
                }
            } catch (error) {
                clearInterval(checkInterval)
                reject(error)
            }
        }, process.env?.OPENAI_API_CHAT_RESPONSE_PING_INTERVAL??890)
        // Set a timeout to resolve the promise after 55 seconds
        setTimeout(() => {
            clearInterval(checkInterval)
            resolve('Run completed (timeout)')
        }, process.env?.OPENAI_API_CHAT_TIMEOUT??55000)
    })
}
/**
 * Executes openAI run and returns associated `run` object.
 * @modular
 * @private
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunStart(_openai, _avatar){
    if(!_avatar.thread || !_avatar.messages.length)
        throw new Error('Cannot start run without thread and messages available')
    return await _openai.beta.threads.runs.create(
        _avatar.thread.id,
        { assistant_id: _avatar.assistant.id }
    )
}
/**
 * Checks status of openAI run.
 * @modular
 * @private
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _run_id - Run id
 * @param {number} _callInterval - Interval in milliseconds
 * @returns {boolean} - true if run completed, voids otherwise
 */
async function mRunStatus(_openai, _avatar, _run_id, _callInterval){
    const _run = await _openai.beta.threads.runs
        .retrieve(
            _avatar.thread.id,
            _run_id
        )
    switch(_run.status){
        //	https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
        case 'completed':
            const _runIndex = _avatar.runs.findIndex(__run => __run.id === _run_id)
            if(_runIndex === -1) _avatar.runs.unshift(_run)	//	add
            else _avatar.runs[_runIndex] = _run	//	update via overwrite
            return true
        case 'failed':
        case 'cancelled':
        case 'expired':
            return false
        case 'queued':
        case 'requires_action':
        case 'in_progress':
        case 'cancelling':
        default:
            console.log(`...${_run.status}:${_avatar.thread.id}...`) // ping check
            break
    }
}
/**
 * Returns requested openai `run` object.
 * @modular
 * @private
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _run_id - Run id
 * @param {string} _step_id - Step id
 * @returns {object} - [OpenAI run-step object]()
 */
async function mRunStep(_avatar, _run_id, _step_id){
	//	pull from known runs
	return _avatar.runs
		.filter(_run=>{ return _run.id==_run_id })
		.steps
			.filter(_step=>{ return _step.id==_step_id })
}
/**
 * Returns all openai `run-step` objects for `run`.
 * @modular
 * @private
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _run_id - Run id
 * @returns {array} - array of [OpenAI run-step objects]()
 */
async function mRunSteps(_avatar, _run_id){
	//	always get dynamically
	const _run = _avatar.runs
        .filter(_run=>{ return _run.id==_run_id })
        [0]
	_run.steps = await openai.beta.threads.runs.steps
        .list(_avatar.thread.id, _run.id)
}
/**
 * Triggers openAI run and updates associated `run` object.
 * @modular
 * @private
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @returns {void} - All content generated by run is available in `avatar`.
 */
async function mRunTrigger(_openai, _avatar){
    const _run = await mRunStart(_openai, _avatar)
    if(!_run)
        throw new Error('Run failed to start')
    _avatar.runs = _avatar?.runs??[]
    _avatar.runs.unshift(_run)
    // ping status
    return await mRunFinish(_openai, _avatar)
}
/* exports */
export {
    mAssignEvolverListeners,
    mChat,
    mCreateAssistant,
    mGetAssistant,
    mGetChatCategory,
    mMessages,
    mRuns,
}