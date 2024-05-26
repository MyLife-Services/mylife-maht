/* imports */
import Globals from './globals.mjs'
/* precursor constants */
const mGlobals = new Globals()
/* constants */
const mAvatarName = mGlobals.getAvatar()?.name
const hide = mGlobals.hide
const mPlaceholder = `Type a message to ${ mAvatarName }...`
const show = mGlobals.show
/* variables */
let mChallengeMemberId,
    mChatBubbleCount = 0,
    mDefaultTypeDelay = 7,
    mPageType = null,
    threadId = null
/* page div variables */
let awaitButton,
    agentSpinner,
    challengeError,
    challengeInput,
    challengeInputText,
    challengeSubmit,
    chatContainer,
    chatInput,
    chatLabel,
    chatSubmit,
    chatSystem,
    chatUser,
    loginSelect,
    mainContent,
    navigation,
    privacyContainer,
    sidebar
document.addEventListener('DOMContentLoaded', event=>{
    /* load data */
    mLoadStart()
    /* display page */
    mShowPage()
})
/* private functions */
/**
 * Adds a message to the chat column.
 * @private
 * @param {string} message - The message to add to the chat column.
 * @param {object} options - The options for the chat bubble.
 * @returns`{void}
 */
function mAddMessage(message, options={}){
    const {
        bubbleClass='agent-bubble',
        callback=_=>{},
		typeDelay=mDefaultTypeDelay,
		typewrite=true,
	} = options
	const chatBubble = document.createElement('div')
	chatBubble.id = `chat-bubble-${mChatBubbleCount}`
	chatBubble.className = `chat-bubble ${bubbleClass}`
	mChatBubbleCount++
	chatSystem.appendChild(chatBubble)
	if(typewrite)
        mTypeMessage(chatBubble, message, typeDelay, callback)
	else {
		chatBubble.insertAdjacentHTML('beforeend', message)
        mScrollBottom()
        callback()
	}
}
/**
 * Adds multiple messages to the chat column.
 * @param {Message[]} messages - The messages to add to the chat column.
 * @param {object} options - The options for the chat bubble.
 * @returns {void}
 */
async function mAddMessages(messages, options={}){
    for (const message of messages) {
        await new Promise(resolve=>{
            mAddMessage(message, {...options, callback: resolve})
        })
    }
}
/**
 * Add `user` type message to the chat column.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mAddUserMessage(event){
    event.preventDefault()
    // Dynamically get the current message element (input or textarea)
    const userMessage = chatInput.value.trim()
    if(!userMessage.length)
        return
    const message = mGlobals.escapeHtml(userMessage) // Escape the user message
    mSubmitInput(event, message)
    mAddMessage(message, { bubbleClass: 'user-bubble', typeDelay: 2, })
}
async function mChallengeMember(event){
    const { options, selectedIndex, value, } = this
    mChallengeMemberId = value
    const memberName = options[selectedIndex].text
    // set member on server
    this.disabled = true
    const messages = [`If you want to get to ${ memberName }, I challenge you to a game of passphrase!`, `Please enter the passphrase for your account to continue...`]
    await mAddMessages(messages, { typeDelay: 6, })
    chatSystem.appendChild(mCreateChallengeElement())
}
/**
 * Creates a challenge element for the user to enter their passphrase. Simultaneously sets modular variables to the instantion of the challenge element. Unclear what happens if multiples are attempted to spawn, but code shouldn't allow for that, only hijax. See the `@required` for elements that this function generates and associates.
 * @private
 * @required challengeError
 * @required challengeInput
 * @required challengeInputText
 * @required challengeSubmit
 * @returns {HTMLDivElement} - The challenge element.
 */
function mCreateChallengeElement(){
    /* input container */
    challengeInput = document.createElement('div')
    challengeInput.className = 'challenge-input'
    challengeInput.id = 'challenge-input'
    const challengeInputContainer = document.createElement('div')
    challengeInputContainer.className = 'challenge-input-container'
    /* input field */
    challengeInputText = document.createElement('input')
    challengeInputText.addEventListener('input', mToggleChallengeSubmitButton)
    challengeInputText.className = 'challenge-input-text'
    challengeInputText.id = 'challenge-input-text'
    challengeInputText.placeholder = 'Enter your passphrase...'
    challengeInputText.type = 'password'
    challengeInputContainer.appendChild(challengeInputText)
    /* submit button */
    challengeSubmit = document.createElement('button')
    challengeSubmit.addEventListener('click', mSubmitChallenge)
    challengeSubmit.className = 'challenge-submit'
    challengeSubmit.id = 'challenge-submit'
    challengeSubmit.innerHTML = 'Enter MyLife'
    challengeInputContainer.appendChild(challengeSubmit)
    challengeInput.appendChild(challengeInputContainer)
    /* error message */
    challengeError = document.createElement('div')
    challengeError.className = 'challenge-error'
    challengeError.id = 'challenge-error'
    challengeInput.appendChild(challengeError)
    hide(challengeError)
    hide(challengeSubmit)
    return challengeInput
}
/**
 * Fetches the greeting messages from the server. The greeting object from server: { error, messages, success, }
 * @private
 * @param {boolean} dynamic - Whether or not greeting should be dynamically generated (true) or static (false).
 * @returns {Promise<Message[]>} - The response Message array.
 */
async function mFetchGreetings(dynamic=false){
    let query = window.location.search
        ? window.location.search + '&'
        : '?'
    dynamic = `dyn=${ dynamic }&`
    query += dynamic
    let url = window.location.origin
        + '/greeting'
        + query
    try {
        const response = await fetch(url)
        const { messages, success, } = await response.json()
        return messages
    } catch(error) {
        return [`Error: ${ error.message }`, `Please try again. If this persists, check back with me later or contact support.`]
    }
}
/**
 * Fetches the hosted members from the server.
 * @private
 * @returns {Promise<MemberList[]>} - The response Member List { id, name, } array.
 */
async function mFetchHostedMembers(){
    let url = window.location.origin
        + '/select'
    try {
        const response = await fetch(url)
        const hostedMembers = await response.json()
        return hostedMembers
    } catch(error) {
        return [`Error: ${ error.message }`, `Please try again. If this persists, check back with me later or contact support.`]
    }
}
/**
 * Fetches the greeting messages or start routine from the server.
 * @private
 * @requires mPageType
 * @returns {void}
 */
async function mFetchStart(){
    const messages = []
    let input // HTMLDivElement containing input element
    switch(mPageType){
        case 'challenge':
        case 'select':
            const hostedMembers = await mFetchHostedMembers()
            if(!hostedMembers.length)
                messages.push(`My sincere apologies, I'm unable to get the list of hosted members, the MyLife system must be down -- @Mookse`)
            else {
                messages.push(...[`Welcome to MyLife!`, `Please select your avatar-id from the list below...`])
                // create the select element and append
                const selectContainer = document.createElement('div')
                selectContainer.id = 'member-selection'
                selectContainer.className = 'member-selection'
                const select = document.createElement('select')
                select.id = 'member-select'
                select.className = 'member-select'
                select.addEventListener('change', mChallengeMember)
                hostedMembers.unshift({ id: null, name: 'Select your avatar-id...', })
                hostedMembers
                    .forEach(member=>{
                        const option = document.createElement('option')
                        option.disabled = false
                        option.hidden = false
                        option.selected = false
                        option.text = member.name
                        option.value = member.id
                        select.appendChild(option)
                    })
                selectContainer.appendChild(select)
                input = selectContainer
            }
            break
        default:
            const greetings = ( await mFetchGreetings() )
                .map(greeting=>
                    greeting?.message
                        ?? greeting
                )
            messages.push(...greetings)
            break
    }
    if(messages.length)
        await mAddMessages(messages, {
            bubbleClass: 'agent-bubble',
            typeDelay: 10,
            typewrite: true,
        })
    if(input)
        chatSystem.appendChild(input)
}
/**
 * Initializes event listeners.
 * @private
 * @returns {void}
 */
function mInitializeListeners(){
    if(chatInput)
        chatInput.addEventListener('input', mToggleInputTextarea)
    if(chatSubmit)
        chatSubmit.addEventListener('click', mAddUserMessage)
}
/**
 * Determines page type and loads data.
 * @private
 * @returns {void}
 */
async function mLoadStart(){
    /* assign page div variables */
    awaitButton = document.getElementById('await-button')
    agentSpinner = document.getElementById('agent-spinner')
    chatContainer = document.getElementById('chat-container')
    chatLabel = document.getElementById('user-chat-label')
    chatInput = document.getElementById('chat-user-message')
    chatSubmit = document.getElementById('chat-user-submit')
    chatSystem = document.getElementById('chat-system')
    chatUser = document.getElementById('chat-user')
    mainContent = mGlobals.mainContent
    navigation = mGlobals.navigation
    privacyContainer = document.getElementById('privacy-container')
    sidebar = mGlobals.sidebar
    /* fetch the greeting messages */
    // get query params
    mPageType = new URLSearchParams(window.location.search).get('type')
    await mFetchStart()
}
/**
 * Scrolls overflow of system chat to bottom.
 * @returns {void}
 */
function mScrollBottom(){
    chatSystem.scrollTop = chatSystem.scrollHeight
}
/**
 * Display the entire page.
 * @todo - refactor for special pages
 * @private
 * @returns {void}
 */
function mShowPage(){
    /* assign listeners */
    mInitializeListeners()
    /* display elements */
    show(navigation)
    document.querySelectorAll('.mylife-widget')
        .forEach(widget=>{
            const guestStatus = (widget.dataset?.requireLogin ?? "false")==="false"
            if(guestStatus)
                show(widget)
            else
                hide(widget)
        })
    show(sidebar)
    show(mainContent)
    if(!chatInput)
        return
    chatInput.value = null
    chatInput.placeholder = mPlaceholder
    show(chatSystem)
    show(chatContainer)
    show(chatUser)
}
/**
 * Submits a challenge response to the server.
 * @module
 * @async
 * @requires mChallengeMemberId
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mSubmitChallenge(event){
	event.preventDefault()
    event.stopPropagation()
    const { id, value: passphrase, } = challengeInputText
    if(!passphrase.trim().length > 3 || !mChallengeMemberId)
        return
    hide(challengeSubmit)
	const url = window.location.origin+`/challenge/${ mChallengeMemberId }`
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ passphrase, }),
	}
	const validatePassphrase = await mSubmitPassphrase(url, options)
	if(validatePassphrase)
        location.href = '/members'
    else {
        challengeError.innerHTML = 'incorrect passphrase, please try again.';
        challengeInputText.value = null
        challengeInputText.placeholder = 'Oops! Try your passphrase again...'
        show(challengeError)
        challengeInputText.focus()
    }
}
/**
 * Submits a passphrase to the server.
 * @param {string} url - The url to submit the passphrase to.
 * @param {object} options - The options for the fetch request.
 * @returns {object} - The response from the server.
 */
async function mSubmitPassphrase(url, options) {
	try {
		const response = await fetch(url, options)
		const jsonResponse = await response.json()
		return jsonResponse
	} catch (err) {
		console.log('fatal error', err)
		return false
	}
}
/**
 * Submits a message to the server.
 * @param {Event} event - The event object.
 * @param {string} message - The message to submit. 
 */
async function mSubmitInput(event, message){
    if(!message)
        return
	event.preventDefault()
	const url = window.location.origin
    const thread_id = threadId ?? null
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
            message,
            role: 'user',
            thread_id,
        }),
	}
    hide(chatUser)
    show(awaitButton)
	const _gptChat = await submitChat(url, options)
	// now returns array of messages
	_gptChat.forEach(gptMessage=>{
		threadId = gptMessage.thread_id
		mAddMessage(gptMessage.message)
	})
    hide(awaitButton)
    chatInput.value = null
    chatInput.placeholder = mPlaceholder
    mToggleInputTextarea()
    show(chatUser)
}
async function submitChat(url, options) {
	try {
		const response = await fetch(url, options)
		const jsonResponse = await response.json()
		return jsonResponse
	} catch (err) {
		console.log('fatal error', err)
		return alert(`Error: ${err.message}`)
	}
}
/**
 * Toggles the visibility of the challenge submit button based on `input` event.
 * @requires mChallengeSubmit
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mToggleChallengeSubmitButton(event){
    const { value, } = this
    if(value.trim().length > 3){
        challengeSubmit.disabled = false
        challengeSubmit.style.cursor = 'pointer'
        show(challengeSubmit)
    } else {
        challengeSubmit.disabled = true
        challengeSubmit.style.cursor = 'not-allowed'
        hide(challengeSubmit)
    }
}
function mToggleInputTextarea() {
    chatInput.style.height = 'auto' // Reset height to shrink if text is removed
    chatInput.style.height = chatInput.scrollHeight + 'px' // Set height based on content
	mToggleSubmitButton()
}
/**
 * Toggles the disabled state of a button based on the input element value.
 * @private
 * @returns {void}
 */
function mToggleSubmitButton(){
    const hasInput = chatInput.value.trim().length ?? false
    chatSubmit.disabled = !hasInput
    chatSubmit.style.cursor = hasInput ? 'pointer' : 'not-allowed'
}
/**
 * Types a message in the chat bubble.
 * @param {HTMLDivElement} chatBubble - The chat bubble element.
 * @param {string} message - The message to type.
 * @param {number} typeDelay - The delay between typing each character.
 * @returns {void}
 */
function mTypeMessage(chatBubble, message, typeDelay=mDefaultTypeDelay, callback){
    let i = 0
    let tempMessage = ''
    function _typewrite() {
        if(i <= message.length ?? 0){
            tempMessage += message.charAt(i)
            chatBubble.innerHTML = ''
            chatBubble.insertAdjacentHTML('beforeend', tempMessage)
            i++
            setTimeout(_typewrite, typeDelay) // Adjust the typing speed here (50ms)
        } else {
            chatBubble.setAttribute('status', 'done')
            callback()
        }
        mScrollBottom()
    }
    _typewrite()
}