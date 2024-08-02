/* imports */
import {
    experienceEnd,
    experiencePlay,
    experiences,
    experienceSkip,
    experienceStart,
    submitInput,
} from './experience.mjs'
import {
    activeBot,
    refreshCollection,
    setActiveBot as _setActiveBot,
} from './bots.mjs'
import Globals from './globals.mjs'
/* variables */
/* constants */
const mGlobals = new Globals()
const mainContent = mGlobals.mainContent,
    navigation = mGlobals.navigation,
    sidebar = mGlobals.sidebar
/* variables */
let mAutoplay=false,
    mChatBubbleCount=0,
    mMemberId
/* page div variables */
let activeCategory,
    awaitButton,
    botBar,
    chatContainer,
    chatInput,
    chatInputField,
    chatRefresh,
    memberSubmit,
    pageLoader,
    sceneContinue,
    screen,
    spinner,
    systemChat,
    transport
/* page load listener */
document.addEventListener('DOMContentLoaded', async event=>{
    /* post-DOM population constants */
    awaitButton = document.getElementById('await-button')
    botBar = document.getElementById('bot-bar')
    chatContainer = document.getElementById('chat-container')
    chatInput = document.getElementById('chat-member')
    chatInputField = document.getElementById('chat-member-input')
    chatRefresh = document.getElementById('chat-refresh')
    memberSubmit = document.getElementById('chat-member-submit')
    pageLoader = document.getElementById('page-loader')
    sceneContinue = document.getElementById('experience-continue')
    spinner = document.getElementById('agent-spinner')
    transport = document.getElementById('experience-transport')
    screen = document.getElementById('experience-modal')
    systemChat = document.getElementById('chat-system')
    /* determine mode, default = member bot interface */
    await mInitialize() // throws if error
    stageTransition()
    console.log('members.mjs::DOMContentLoaded')
    /* **note**: bots run independently upon conclusion */
})
/* public functions */
/**
 * Adds an input element (button, input, textarea,) to the system chat column.
 * @param {HTMLElement} HTMLElement - The HTML element to add to the system chat column.
 * @returns {void}
 */
function addInput(HTMLElement){
    systemChat.appendChild(HTMLElement)
}
/**
 * Pushes message content to the chat column.
 * @public
 * @param {string} message - The message object to add to column.
 * @param {object} options - The options object { bubbleClass, typeDelay, typewrite }.
 * @returns {void}
 */
function addMessage(message, options={}){
    mAddMessage(message, options)
}
/**
 * Pushes an array of messages to the chat column.
 * @param {Array} messages - The array of string messages to add to the chat column.
 * @param {object} options - The options object { bubbleClass, typeDelay, typewrite }.
 * @returns {void}
 */
function addMessages(messages, options={}){
    messages.forEach(message=>mAddMessage(message, options))
}
/**
 * Removes and attaches all payload elements to element.
 * @public
 * @param {HTMLDivElement} parent - The moderator element.
 * @param {object[]} elements - The elements to append to moderator.
 * @param {boolean} clear - The clear flag to remove previous children, default=`true`.
 * @returns {HTMLDivElement} - The moderator modified element.
 */
function assignElements(parent=chatInput, elements, clear=true){
    if(clear)
        while(parent.firstChild)
            parent.removeChild(parent.firstChild)
    elements.forEach(element=>parent.appendChild(element))
}
/**
 * Clears the system chat by removing all chat bubbles instances.
 * @todo - store chat locally for retrieval?
 * @public
 * @returns {void}
 */
function clearSystemChat(){
    mGlobals.clearElement(systemChat)
}
/**
 * Called from setActiveBot, triggers any main interface changes as a result of new selection.
 * @public
 * @param {object} activeBot - The active bot.
 * @returns {void}
 */
function decorateActiveBot(activeBot=activeBot()){
    const { bot_name, id, purpose, type, } = activeBot
    chatInputField.placeholder = `type your message to ${ bot_name }...`
    // additional func? clear chat?
}
function escapeHtml(text) {
    return mGlobals.escapeHtml(text)
}
/**
 * Deletes an element from the DOM via Avatar functionality.
 * @param {HTMLElement} element - The element to expunge.
 * @returns {void}
 */
function expunge(element){
    return mGlobals.expunge(element)
}
/**
 * Fetches the summary via PA for a specified file.
 * @param {string} fileId - The file ID.
 * @param {string} fileName - The file name.
 * @returns {Promise<object>} - The return is the summary object.
 */
async function fetchSummary(fileId, fileName){
    /* validate request */
    if(!fileId?.length && !fileName?.length)
        throw new Error('fetchSummary::Error()::`fileId` or `fileName` is required')
    return await mFetchSummary(fileId, fileName)
}
function getInputValue(){
    return chatInputField.value.trim()
}
/**
 * Gets the member chat system DOM element.
 * @returns {HTMLDivElement} - The member chat system element.
 */
function getSystemChat(){
    return systemChat
}
/**
 * Proxy for Globals.hide().
 * @param {HTMLElement} element - The element to hide.
 * @param {function} callbackFunction - The callback function to execute after the element is hidden.
 * @returns {void}
 */
function hide(){
    mGlobals.hide(...arguments)
}
function hideMemberChat(){
    hide(navigation)
    hide(chatInput)
    hide(sidebar)
}
/**
 * Determines whether an experience is in progress.
 * @returns {boolean} - The return is a boolean indicating whether an experience is in progress.
 */
function inExperience(){
    return mExperience?.id?.length ?? false
}
/**
 * Replaces an element (input/textarea) with a specified type.
 * @param {HTMLInputElement} element - The element to replace.
 * @param {string} newType - The new element type.
 * @param {boolean} retainValue - Whether or not to keep the value of the original element, default=true.
 * @param {string} onEvent - The event to listen for.
 * @param {function} listenerFunction - The listener function to execute.
 * @returns {HTMLInputElement} - The new element.
 */
function replaceElement(element, newType, retainValue=true, onEvent, listenerFunction){
    const newElementType = ['select', 'textarea'].includes(newType)
        ? newType
        : 'input'
    try{
        const newElement = document.createElement(newElementType)
        newElement.id = element.id
        newElement.name = element.name
        newElement.required = element.required
        newElement.classList = element.classList
        /* type-specific alterations */
        switch(newType){
            case 'select':
                break
            case 'textarea':
                newElement.placeholder = element.placeholder /* input, textarea */
                if(retainValue)
                    newElement.value = element.value
                newElement.setAttribute('rows', '3')
                break
            case 'checkbox':
            case 'radio':
            case 'text':
            default:
                newElement.placeholder = element.placeholder /* input, textarea */
                newElement.type = newType /* input variants [text, checkbox, radio, etc.] */
                if(retainValue)
                    newElement.value = element.value
                break
        }
        if(onEvent){
            newElement.addEventListener(onEvent, listenerFunction) // Reattach event listener
        }
        element.parentNode.replaceChild(newElement, element)
        return newElement
    } catch(error){
        console.log('replaceElement::Error()', error)
        return element
    }
}
/**
 * Proxy to set the active bot (via `bots.mjs`).
 * @public
 * @async
 * @returns {Promise<void>} - The return is its own success.
 */
async function setActiveBot(){
    return await _setActiveBot(...arguments)
}
async function setActiveCategory(category, contributionId, question) {
    const url = '/members/category'; // Replace with your server's URL
    const data = {
        contributionId: contributionId,
        category: category,
        question: question
    }
    let response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);
    response = await response.json()
    activeCategory = {
        contributionId: response.contributionId,
        category: response.category,
    }
}
/**
 * Proxy for Globals.show().
 * @public
 * @param {HTMLElement} element - The element to show.
 * @param {function} listenerFunction - The listener function, defaults to `mAnimationEnd`.
 * @returns {void}
 */
function show(){
    mGlobals.show(...arguments)
}
/**
 * Shows the member chat system.
 * @public
 * @returns {void}
 */
function showMemberChat(){
    hide(screen)
    show(mainContent)
    show(chatContainer)
    show(systemChat)
}
/**
 * Shows the sidebar.
 * @public
 * @returns {void}
 */
function showSidebar(){
    show(sidebar)
}
/**
 * Enacts stage transition.
 * @public
 * @param {string} experienceId - The experience ID, optional.
 * @returns {void}
 */
function stageTransition(experienceId){
    if(mGlobals.isGuid(experienceId))
        experienceStart(experienceId)
    else
        mStageTransitionMember()
}
/**
 * Toggle visibility functionality.
 * @returns {void}
 */
function toggleVisibility(){
    mGlobals.toggleVisibility(...arguments)
}
/**
 * Waits for user action.
 * @public
 * @returns {Promise<void>} - The return is its own success.
 */
function waitForUserAction(){
    return new Promise((resolve)=>{
        show(sceneContinue)
        document.addEventListener('click', ()=>{
            hide(sceneContinue)
            resolve()
        }, { once: true })
    })
}
/* private functions */
/**
 * Adds a message to the chat column on member's behalf.
 * @todo - normalize return from backend so no need for special processing.
 * @private
 * @async
 * @param {Event} event - The event object.
 * @returns {Promise<void>}
 */
async function mAddMemberMessage(event){
    event.stopPropagation()
	event.preventDefault()
    let memberMessage = chatInputField.value.trim()
    if (!memberMessage.length)
        return
    /* prepare request */
    toggleMemberInput(false) /* hide */
    mAddMessage(memberMessage, {
        bubbleClass: 'user-bubble',
        role: 'member',
        typeDelay: 7,
    })
    /* server request */
    let messages,
        response = await submit(memberMessage)
    /* special processing cases */
    // @stub - special processing cases remove
    if(!Array.isArray(response)){
        switch(typeof response){
            case 'object':
                const { itemId, messages: responseMessages, processingBotId, success, } = response
                if(processingBotId?.length && processingBotId!=activeBot().id)
                    setActiveBot(processingBotId)
                messages = responseMessages
                break
            case 'boolean': // pass-through intentional
            case 'number':
                response = response.toString()
            case 'string':
                messages = [{ message: response }]
                break
            default:
                throw new Error('mAddMemberMessage::Error()::`response` is indecipherable')
        }
    } else
        messages = response
    /* process response */
	messages
        .forEach(message => {
            mAddMessage(message.message ?? message.content, {
                bubbleClass: 'agent-bubble',
                role: 'agent',
                typeDelay: 1,
            })
        })
    toggleMemberInput(true)/* show */
}
/**
 * Adds specified string message to interface.
 * @param {object|string} message - The message to add to the chat; if object, reduces to `.message` or fails.
 * @param {object} options - The options object { bubbleClass, role, typeDelay, typewrite }.
 * @returns {void}
 */
async function mAddMessage(message, options={}){
    if(typeof message==='object'){
        if(message?.message){ // otherwise error throws for not string (i.e., Array or classed object)
            options.role = message?.role // overwrite if exists
                ?? options?.role
                ?? 'agent'
            message = message.message
        }
    }
    if(typeof message!=='string' || !message.length)
        throw new Error('mAddMessage::Error()::`message` string is required')
    const {
		bubbleClass,
        role='agent',
		typeDelay=2,
		typewrite=true,
	} = options
    /* message container */
    const chatMessage = document.createElement('div')
    chatMessage.classList.add('chat-message-container')
    /* message bubble */
	const chatBubble = document.createElement('div')
	chatBubble.classList.add('chat-bubble', (bubbleClass ?? role+'-bubble'))
    chatBubble.id = `chat-bubble-${mChatBubbleCount}`
    mChatBubbleCount++
    /* message tab */
    const chatMessageTab = document.createElement('div')
    chatMessageTab.id = `chat-message-tab-${mChatBubbleCount}`
    chatMessageTab.classList.add('chat-message-tab')
    const chatCopy = document.createElement('i')
    chatCopy.classList.add('fas', 'fa-copy', 'chat-copy')
    /* attach children */
    chatMessageTab.appendChild(chatCopy)
    chatMessage.appendChild(chatBubble)
    chatMessage.appendChild(chatMessageTab)
	systemChat.appendChild(chatMessage)
    /* assign listeners */
    chatBubble.addEventListener('mouseover', event=>{
        chatMessageTab.style.transform = 'translateX(-33%)'
        chatMessageTab.style.opacity = '1'
        chatMessageTab.style.pointerEvents = 'all'
    })
    chatCopy.addEventListener('click', event=>{
        navigator.clipboard.writeText(message).then(_=>{
            chatCopy.classList.remove('fa-copy')
            chatCopy.classList.add('fa-check')
            setTimeout(_=>{
                chatCopy.classList.remove('fa-check')
                chatCopy.classList.add('fa-copy')
            }, 2000)
        }).catch(err => {
            console.error('Failed to copy: ', err)
        })
    })
    chatMessage.addEventListener('mouseleave', event => {
        chatMessageTab.style.transform = 'translateX(-100%)'
        chatMessageTab.style.opacity = '0'
        chatMessageTab.style.pointerEvents = 'none'
    })
    /* print chat message */
	if(typewrite)
        mTypeMessage(chatBubble, message, typeDelay)
    else {
        chatBubble.insertAdjacentHTML('beforeend', message)
        mScrollBottom()
	}
}
async function mFetchExperiences(){
    let response = await fetch('/members/experiences/')
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    response = await response.json()
    return response
}
/**
 * Fetches the summary via PA for a specified file.
 * @private
 * @param {string} fileId - The file ID.
 * @param {string} fileName - The file name.
 * @returns {Promise<object>} - The return is the summary object.
 */
async function mFetchSummary(fileId, fileName){
    const url = '/members/summarize'
    const data = {
        fileId,
        fileName,
    }
    let response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    response = await response.json()
    return response
}
function getActiveCategory(){
	return activeCategory
}
/**
 * Initialize module variables based on server fetch.
 * @private
 * @requires mMemberId
 * @returns {Promise<boolean>} - The return is a boolean indicating success.
 */
async function mInitialize(){
    /* fetch primary collections */
    await refreshCollection('story') // memories required
    /* page listeners */
    mInitializePageListeners()
}
/**
 * Initialize page listeners.
 * @private
 * @returns {void}
 */
function mInitializePageListeners(){
    /* page listeners */
    chatInputField.addEventListener('input', toggleInputTextarea)
    memberSubmit.addEventListener('click', mAddMemberMessage) /* note default listener */
    chatRefresh.addEventListener('click', clearSystemChat)
    const currentPath = window.location.pathname // Get the current path
    const navigationLinks = document.querySelectorAll('.navigation-nav .navigation-link') // Select all nav links
    navigationLinks.forEach(link=>{
        if(link.getAttribute('href')===currentPath){
            link.classList.add('active') // Add 'active' class to the current link
            link.addEventListener('click', event=>{
                event.preventDefault() // Prevent default action (navigation) on click
            })
        }
    })
}
/**
 * Primitive step to set a "modality" or intercession for the member chat. Currently will key off dataset in `chatInputField`.
 * @todo - mature this architecture
 * @param {string} proxy - The proxy endpoint for this chat exchange.
 * @param {string} action - The action to take on the proxy endpoint.
 * @param {Guid} itemId - The item ID as context for chat exchange.
 * @param {Guid} shadowId - The shadow ID as context for chat exchange.
 * @param {string} value - The value to seed the input with.
 * @param {string} placeholder - The placeholder to seed the input with.
 */
function seedInput(proxy, action, itemId, shadowId, value, placeholder){
    chatInputField.dataset.action = action
    chatInputField.dataset.active = 'true'
    chatInputField.dataset.itemId = itemId
    chatInputField.dataset.proxy = proxy
    chatInputField.dataset.shadowId = shadowId
    chatInputField.value = value
    chatInputField.placeholder = placeholder
    chatInputField.focus()
}
/**
 * Transitions and sets the stage to experience version of member screen indicated.
 * @public
 * @param {string} type - The type of scene transition, defaults to `interface`.
 * @returns {void}
 */
function sceneTransition(type='interface'){
    /* assign listeners */
    memberSubmit.removeEventListener('click', mAddMemberMessage)
    memberSubmit.addEventListener('click', submitInput)
    /* clear "extraneous" */
    hide(navigation)
    hide(botBar)
    hide(chatInput)
    /* type specifics */
    switch(type){
        case 'chat':
            hide(sidebar)
            break
        case 'interface':
        default:
            show(sidebar)
            break
    }
    /* show member chat */
    showMemberChat()
}
/**
 * Scrolls overflow of system chat to bottom.
 * @returns {void}
 */
function mScrollBottom(){
    systemChat.scrollTop = systemChat.scrollHeight
}
/**
 * Transitions the stage to active member version.
 * @param {boolean} includeSidebar - The include-sidebar flag.
 * @returns {void}
 */
function mStageTransitionMember(includeSidebar=true){
    memberSubmit.removeEventListener('click', submitInput)
    memberSubmit.addEventListener('click', mAddMemberMessage)
    hide(transport)
    hide(screen)
    hide(pageLoader)
    document.querySelectorAll('.mylife-widget')
        .forEach(widget=>{
            const loginRequired = (widget.dataset?.requireLogin ?? "false")==="true"
            if(loginRequired)
                show(widget)
            else
                hide(widget)
        })
    show(mainContent)
    show(navigation)
    show(chatContainer)
    show(systemChat)
    show(chatInput)
    if(includeSidebar && sidebar){
        show(sidebar)
        if(botBar)
            show(botBar)
    }
}
/**
 * Submits a message to MyLife Member Services chat.
 * @param {string} message - The message to submit.
 * @param {object} proxyInfo - The proxy information { itemId, proxy, shadowId }.
 * @param {boolean} hideMemberChat - The hide member chat flag, default=`true`.
 * @returns 
 */
async function submit(message, proxyInfo, hideMemberChat=true){
	if(!message?.length)
		throw new Error('submit(): `message` argument is required')
    const { action, active, itemId, proxy='', shadowId, } = proxyInfo
        ?? chatInputField.dataset
	const url = window.location.origin + '/members' + proxy
    const { id: botId, thread_id: threadId, } = activeBot()
	const request = {
            action,
            active,
			botId,
            itemId,
			message,
			role: 'member',
            shadowId,
            threadId,
		}
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(request),
	}
    if(hideMemberChat)
        toggleMemberInput(false)
	const chatResponse = await submitChat(url, options)
    /* clear dataset, proxy only request level */
    for(let key in chatInputField.dataset){ // nuclear erasure
        delete chatInputField.dataset[key]
    }
    if(hideMemberChat)
        toggleMemberInput(true)
    return chatResponse
}
async function submitChat(url, options) {
	try {
		const response = await fetch(url, options)
		const jsonResponse = await response.json()
		return jsonResponse
	} catch(error) {
		console.log('fatal error', error)
		return alert(`Error: ${error.message}`)
	}
}
/**
 * Toggles the member input between input and server `waiting`.
 * @public
 * @param {boolean} display - Whether to show/hide (T/F), default `true`.
 * @param {boolean} hidden - Whether to force-hide (T/F), default `false`. **Note**: used in `experience.mjs`
 * @returns {void}
 */
function toggleMemberInput(display=true, hidden=false){
    if(display){
        const { bot_name, id, mbr_id, provider, purpose, type, } = activeBot()
        hide(awaitButton)
        awaitButton.classList.remove('slide-up')
        chatInput.classList.add('slide-up')
        chatInputField.style.height = 'auto'
        chatInputField.placeholder = `type your message to ${ bot_name }...`
        chatInputField.value = null
        show(chatInput)
    } else {
        hide(chatInput)
        chatInput.classList.remove('fade-in')
        chatInput.classList.remove('slide-up')
        awaitButton.classList.add('slide-up')
        awaitButton.innerHTML = `Connecting with ${ activeBot().bot_name }...`
        show(awaitButton)
    }
    if(hidden)
        hide(chatInput)
}
/**
 * Toggles the input textarea.
 * @param {Event} event - The event object.
 * @returns {void} - The return is void.
 */
function toggleInputTextarea(event){
    chatInputField.style.height = 'auto' // Reset height to shrink if text is removed
    chatInputField.style.height = chatInputField.scrollHeight + 'px' // Set height based on content
	toggleSubmitButtonState()
}
function toggleSubmitButtonState() {
	memberSubmit.disabled = !(chatInputField.value?.trim()?.length ?? true)
}
/**
 * Typewrites a message to a chat bubble.
 * @param {HTMLDivElement} chatBubble - The chat bubble element.
 * @param {string} message - The message to type.
 * @param {number} typeDelay - The delay between typing each character.
 * @returns {void}
 */
function mTypeMessage(chatBubble, message, typeDelay=mDefaultTypeDelay){
    let i = 0
    let tempMessage = ''
    function _typewrite() {
        if(i <= message.length ?? 0){
            tempMessage += message.charAt(i)
            chatBubble.innerHTML = ''
            chatBubble.insertAdjacentHTML('beforeend', tempMessage)
            i++
            setTimeout(_typewrite, typeDelay) // Adjust the typing speed here (50ms)
        } else
            chatBubble.setAttribute('status', 'done')
        mScrollBottom()
    }
    _typewrite()
}
/* exports */
export {
    addInput,
    addMessage,
    addMessages,
    assignElements,
    clearSystemChat,
    decorateActiveBot,
    escapeHtml,
    expunge,
    fetchSummary,
    getInputValue,
    getSystemChat,
    mGlobals as globals,
    hide,
    hideMemberChat,
    inExperience,
    replaceElement,
    sceneTransition,
    seedInput,
    setActiveBot,
    setActiveCategory,
    show,
    showMemberChat,
    showSidebar,
    stageTransition,
    submit,
    toggleMemberInput,
    toggleInputTextarea,
    toggleVisibility,
    waitForUserAction,
}