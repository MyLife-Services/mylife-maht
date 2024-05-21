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
let mChatBubbleCount = 0,
    threadId = null,
    typingTimer
/* page div variables */
let aboutContainer,
    awaitButton,
    agentSpinner,
    chatContainer,
    chatInput,
    chatLabel,
    chatSubmit,
    chatSystem,
    chatUser,
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
 * @param {object|string} message - The message to add to the chat column.
 * @param {object} options - The options for the chat bubble.
 * @returns`{void}
 */
function mAddMessage(message, options={
	bubbleClass: 'agent-bubble',
	delay: 15,
	typewrite: true,
}){
    let messageContent = message.message ?? message
    const originalMessage = messageContent
	const {
		bubbleClass,
		delay,
		typewrite,
	} = options
	const chatBubble = document.createElement('div')
	chatBubble.id = `chat-bubble-${mChatBubbleCount}`
	chatBubble.className = `chat-bubble ${bubbleClass}`
	mChatBubbleCount++
	chatSystem.appendChild(chatBubble)
	messageContent = mGlobals.escapeHtml(messageContent)
	if(typewrite){
		let i = 0
		let tempMessage = ''
		function _typeAgentMessage() {
			if (i <= originalMessage.length ?? 0) {
				tempMessage += originalMessage.charAt(i)
				chatBubble.innerHTML = ''
				chatBubble.insertAdjacentHTML('beforeend', tempMessage)
				i++
				setTimeout(_typeAgentMessage, delay) // Adjust the typing speed here (50ms)
				scrollToBottom()
			} else {
				chatBubble.setAttribute('status', 'done')
			}
		}
		_typeAgentMessage()
	} else {
		chatBubble.insertAdjacentHTML('beforeend', originalMessage)
		scrollToBottom()
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
    let userMessage = chatInput.value.trim()
    if (!userMessage.length) return
    userMessage = mGlobals.escapeHtml(userMessage) // Escape the user message
    mSubmitInput(event, userMessage)
    mAddMessage({ message: userMessage }, {
        bubbleClass: 'user-bubble',
        delay: 7,
    })
}
/**
 * Fetches the greeting messages from the server. The greeting object from server: { error, messages, success, }
 * @private
 * @param {boolean} dynamic - Whether or not greeting should be dynamically generated (true) or static (false).
 * @returns {Promise<Message[]>} - The response Message array.
 */
async function mFetchGreetings(dynamic=false){
    let query = window.location.search || '?'
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
 * Fetches the greeting messages or start routine from the server.
 * @private
 * @returns {void}
 */
async function mFetchStart(){
    const greetings = await mFetchGreetings()
    greetings.forEach(greeting=>{
        mAddMessage(greeting, {
            bubbleClass: 'agent-bubble',
            delay: 10,
            typewrite: true,
        })
    })
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
 * Load data for the page.
 * @private
 * @returns {void}
 */
async function mLoadStart(){
    /* assign page div variables */
    aboutContainer = document.getElementById('about-container')
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
    await mFetchStart()
}
function scrollToBottom() {
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
 * 
 * @param {Event} event 
 * @param {string} _message 
 */
async function mSubmitInput(event, _message){
	event.preventDefault()
	const url = window.location.origin
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ message: _message, role: 'user', thread_id: threadId }),
	}
    hide(chatUser)
    show(awaitButton)
	const _gptChat = await submitChat(url, options)
	// now returns array of messages
	_gptChat.forEach(gptMessage=>{
		threadId = gptMessage.thread_id
		mAddMessage({
			message: gptMessage.message,
			delay: 10,
		});
	});
    hide(awaitButton)
    chatInput.value = null
    chatInput.placeholder = mPlaceholder
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