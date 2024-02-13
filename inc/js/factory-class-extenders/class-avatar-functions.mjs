import { _ } from 'ajv'
import { Marked } from 'marked'
/* modular constants */
/* modular "public" functions */
/**
 * Initializes openAI assistant and returns associated `assistant` object.
 * @modular
 * @public
 * @param {OpenAI} _openai - OpenAI object
 * @param {object} _botData - bot creation instructions.
 * @returns {object} - [OpenAI assistant object](https://platform.openai.com/docs/api-reference/assistants/object)
 */
async function mAI_openai(_openai, _botData){
    const _assistantData = {
        description: _botData.description,
        model: _botData.model,
        name: _botData.bot_name??_botData.name, // take friendly name before Cosmos
        instructions: _botData.instructions,
    }
    return await _openai.beta.assistants.create(_assistantData)
}
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
            // @todo: wrong factory?
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
            return
            //  if summary is good, submit to cosmos
        }
    )
}
/**
 * Updates or creates bot (defaults to new personal-avatar) in Cosmos and returns successful `bot` object, complete with conversation (including thread/thread_id in avatar) and gpt-assistant intelligence.
 * @param {Avatar} _avatar - Avatar object that will govern bot
 * @param {object} _bot - Bot object
 * @returns {object} - Bot object
 */
async function mBot(_avatar, _bot={type: 'personal-avatar'}){
    // @todo: there will be occasions where there will be no object_id property to use, as it was created through a hydration method based on API usage, so will be attached to mbr_id, but NOT avatar.id
    /* validation */
    if(!_bot.mbr_id?.length)
        _bot.mbr_id = _avatar.mbr_id
    else if(_bot.mbr_id!==_avatar.mbr_id)
        throw new Error('Bot mbr_id cannot be changed')
    if(!_bot.type?.length)
        throw new Error('Bot type required')
    /* set required _bot super-properties */
    if(!_bot.object_id?.length)
        _bot.object_id = _avatar.id
    if(!_bot.id)
        _bot.id = _avatar.factory.newGuid
    const _botSlot = _avatar.bots.findIndex(bot => bot.id === _bot.id)
    if(_botSlot!==-1){ // update
        const _existingBot = _avatar.bots[_botSlot]
        if(
                _bot.bot_id!==_existingBot.bot_id 
            ||  _bot.thread_id!==_existingBot.thread_id
        ){
            console.log(`ERROR: bot discrepency; bot_id: db=${_existingBot.bot_id}, inc=${_bot.bot_id}; thread_id: db=${_existingBot.thread_id}, inc=${_bot.thread_id}`)
            throw new Error('Bot id or thread id cannot attempt to be changed via bot')
        }
        _bot = {..._existingBot, ..._bot}
    } else { // add
        _bot = await mCreateBot(_avatar, _bot) // add in openai
    }
    /* create or update bot properties */
    if(!_bot?.thread_id?.length){
        // openai spec: threads are independent from assistant_id
        // @todo: investigate: need to check valid thread_id? does it expire?
        const _conversation = await _avatar.getConversation()
        _bot.thread_id = _conversation.thread_id
    }
    // update Cosmos (no need async)
    _avatar.factory.setBot(_bot)
    return _bot
}
/**
 * Requests and returns chat response from openAI. Call session for conversation id.
 * @modular
 * @public
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _chatMessage - Chat message
 * @returns {array} - array of front-end MyLife chat response objects { agent, category, contributions, message, response_time, purpose, type }
 */
async function mChat(_avatar, _chatMessage){
    // note: Q/isMyLife PA bot does not have thread_id intentionally, as every session creates its own
    const _openai = _avatar.ai
    const _processStartTime = Date.now()
    const _bot = _avatar.activeBot
    // check if active bot, if not use self
    const _conversation = await _avatar.getConversation(_bot.thread_id) // create if not exists
    _conversation.addMessage(_chatMessage)
    //	@todo: assign uploaded files (optional) and push `retrieval` to tools
    _bot.thread_id = _bot.thread_id??_conversation.thread_id
    await mRunTrigger(_openai, _avatar, _conversation) // run is triggered by message creation, content embedded/embedding now in _conversation in _avatar.conversations
    const _messages = (await _conversation.getMessages_openai())
        .filter(_msg => _msg.run_id == _avatar.runs[0].id)
        .map(_msg => {
            return new (_avatar.factory.message)({
                bot_id: _bot.id,
                avatar_id: _avatar.id,
                message: _msg,
                content: _msg.content[0].text.value,
                mbr_id: _avatar.mbr_id,
                role: 'assistant',
            })
        })
    _messages.forEach(async _msg => {
//  @todo: reinstate contribution
//        _avatar.#evolver?.setContribution(_avatar.#activeChatCategory, _msg)??false
        await _conversation.addMessage(_msg)
    })
    //	add/update cosmos
    if ((_avatar?.factory!==undefined) && (process.env?.MYLIFE_DB_ALLOW_SAVE??false)) {
        _conversation.save()
    }
    const _chat = _messages
        .map(_msg=>{
            const __message = mPrepareMessage(_msg) // returns object { category, content }
            return {
                activeBotId: _bot.id,
                activeBotAIId: _bot.bot_id,
                agent: 'server',
                category: __message.category,
                contributions: [],
                message: __message.content,
                purpose: 'chat response',
                response_time: Date.now()-_processStartTime,
                thread_id: _conversation.thread_id,
                type: 'chat',
            }
        })
    //	return response
    return _chat
}
function mFindBot(_avatar, _botId){
    return _avatar.bots
        .filter(_bot=>{ return _bot.id==_botId })
        [0]
}
/**
 * Creates bot and returns associated `bot` object.
 * @modular
 * @private
 * @param {Avatar} _avatar - Avatar object
 * @param {object} _bot - Bot object
 * @returns {object} - Bot object
*/
async function mCreateBot(_avatar, _bot){
        // create gpt
        const _botData = await _avatar.factory.createBot(_bot)
        _botData.object_id = _avatar.id
        const _openaiGPT = await mAI_openai(_avatar.ai, _botData)
        _botData.bot_id = _openaiGPT.id
        return { ..._bot, ..._botData }
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
/**
 * Returns all openai `run` objects for `thread`.
 * @modular
 * @public
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _thread_id - Thread id (from session)
 * @returns {array} - array of [OpenAI run objects](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRuns(_openai, _avatar, _thread_id){
	if(!_avatar.runs){
		_avatar.runs = await _openai.beta.threads.runs
            .list(_thread_id)
	}
}
/* modular "private" functions [unexported] */
/**
 * Cancels openAI run.
 * @modular
 * @private
 * @param {OpenAI} _openai - OpenAI object
 * @param {string} _thread_id - Thread id
 * @param {string} _run_id - Run id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mCancelRun(_openai, _thread_id, _run_id,){
    return await _openai.beta.threads.runs.cancel(
        _thread_id,
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
async function mHydrateBot(_avatar, _id){
    return await _avatar.bot(_id)
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
    if(_msg.content) _msg = _msg.content
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
 * @param {object} _run - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunFinish(_openai, _run){
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
            try {
                const status = await mRunStatus(_openai, _run)
                if (status) {
                    clearInterval(checkInterval)
                    resolve(_run)
                }
            } catch (error) {
                clearInterval(checkInterval)
                reject(error)
            }
        }, process.env.OPENAI_API_CHAT_RESPONSE_PING_INTERVAL??890)
        // Set a timeout to resolve the promise after 55 seconds
        setTimeout(() => {
            clearInterval(checkInterval)
            resolve('Run completed (timeout)')
        }, process.env.OPENAI_API_CHAT_TIMEOUT??55000)
    })
}
/**
 * Executes openAI run and returns associated `run` object.
 * @modular
 * @private
 * @param {OpenAI} _openai - OpenAI object
 * @param {string} _assistant_id - Assistant id
 * @param {string} _thread_id - Thread id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunStart(_openai, _assistant_id, _thread_id){
    return await _openai.beta.threads.runs.create(
        _thread_id,
        { assistant_id: _assistant_id }
    )
}
/**
 * Checks status of openAI run.
 * @modular
 * @private
 * @param {OpenAI} _openai - OpenAI object
 * @param {object} _run - Run id
 * @returns {boolean} - true if run completed, voids otherwise
 */
async function mRunStatus(_openai, _run){
    const __run = await _openai.beta.threads.runs
        .retrieve(
            _run.thread_id,
            _run.id,
        )
    switch(__run.status){
        //	https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
        case 'completed':
            _run = __run // update via overwrite
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
            console.log(`...${__run.status}:${_run.thread_id}...`) // ping log
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
 * @param {string} _conversation - Conversation Object
 * @returns {void} - All content generated by run is available in `avatar`.
 */
async function mRunTrigger(_openai, _avatar){
    const _bot = _avatar.activeBot
    const _run = await mRunStart(_openai, _bot.bot_id, _bot.thread_id)
    if(!_run)
        throw new Error('Run failed to start')
    // @todo: runs are ephemeral-ish, lasting only for session, ensure not stored
    _avatar.runs = _avatar.runs??[]
    _avatar.runs.unshift(_run)
    // ping status
    await mRunFinish(_openai, _run) // only returns 
    return
}
/* exports */
export {
    mAI_openai,
    mAssignEvolverListeners,
    mBot,
    mChat,
    mFindBot,
    mGetAssistant,
    mGetChatCategory,
    mHydrateBot,
    mRuns,
}