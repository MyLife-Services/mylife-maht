/* imports */
import {
    experienceEnd,
    experiencePlay,
    experienceSkip,
    experienceStart,
    submitInput,
} from './experience.mjs'
import {
    setActiveBot as _setActiveBot,
    updatePageBots,
} from './bots.mjs'
import Globals from './globals.mjs'
/* variables */
/* constants */
const mGlobals = new Globals()
const mExperiences = []
const mainContent = mGlobals.mainContent,
    navigation = mGlobals.navigation,
    sidebar = mGlobals.sidebar
/* variables */
let activeBot,
    mAutoplay=false,
    mChatBubbleCount = 0,
    mExperience,
    mMemberId,
    typingTimer
/* page div variables */
let activeCategory,
    awaitButton,
    botBar,
    chatContainer,
    chatInput,
    chatInputField,
    chatRefresh,
    memberSubmit,
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
    chatInputField = document.getElementById('member-input')
    chatRefresh = document.getElementById('chat-refresh')
    memberSubmit = document.getElementById('submit-button')
    sceneContinue = document.getElementById('experience-continue')
    spinner = document.getElementById('agent-spinner')
    transport = document.getElementById('experience-transport')
    screen = document.getElementById('experience-modal')
    systemChat = document.getElementById('chat-system')
    /* determine mode, default = member bot interface */
    const initialized = await mInitialize()
    if(!initialized)
        throw new Error('CRITICAL::mInitialize::Error()')
    stageTransition()
    /* temporary shortcut to experience */
    const helpShortcut = document.getElementById('navigation-help-input-container')
    helpShortcut.addEventListener('click', mExperienceStart)
    /* **note**: bots run independently upon conclusion */
})
/* public functions */
/**
 * Pushes content to the chat column.
 * @public
 * @param {string} message - The message object to add to column.
 * @param {object} options - The options object.
 */
function addMessageToColumn(message, options={
	bubbleClass: 'agent-bubble',
	_delay: 10,
	_typewrite: true,
}){
    const messageContent = message.message ?? message
	const {
		bubbleClass,
		_delay,
		_typewrite,
	} = options
	const chatBubble = document.createElement('div')
    chatBubble.id = `chat-bubble-${mChatBubbleCount}`
	chatBubble.classList.add('chat-bubble', bubbleClass)
    chatBubble.innerHTML = escapeHtml(messageContent)
    mChatBubbleCount++
	systemChat.appendChild(chatBubble)
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
    console.log('assignElements()', parent, elements, clear)
    if(clear)
        while(parent.firstChild)
            parent.removeChild(parent.firstChild)
    elements.forEach(element=>parent.appendChild(element))
}
/**
 * Get experiences available to the member.
 * @returns {object[]} - The available experiences.
 */
function availableExperiences(){
    // repull from server? prefer separate function
    return mExperiences
}
/**
 * Clears the system chat by removing all chat bubbles instances.
 * @todo - store chat locally for retrieval?
 * @public
 * @returns {void}
 */
function clearSystemChat(){
    // Remove all chat bubbles and experience chat-lanes under chat-system
    systemChat.innerHTML = ''
}
function escapeHtml(text) {
    return mGlobals.escapeHtml(text)
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
 * @requires mExperience
 * @returns {void}
 */
function stageTransition(endExperience=false){
    if(endExperience)
        mExperience = null
    if(mExperience?.id)
        experienceStart(mExperience)
    else {
        mStageTransitionMember()
        if(endExperience)
            updatePageBots(true)
    }
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
 * @private
 * @async
 * @param {Event} event - The event object.
 * @returns {Promise<void>}
 */
async function mAddMemberDialog(event){
    event.stopPropagation()
	event.preventDefault()
    let memberMessage = chatInputField.value.trim()
    if (!memberMessage.length)
        return
    /* prepare request */
    toggleMemberInput(false) /* hide */
    addMessageToColumn({ message: memberMessage }, {
        bubbleClass: 'user-bubble',
        _delay: 7,
    })
    /* server request */
    const responses = await submit(memberMessage, false)
    /* process responses */
	responses.forEach(response => {
		addMessageToColumn({ message: response.message })
	})
    toggleMemberInput(true)/* show */
}
function bot(_id){
    return mPageBots.find(bot => bot.id === _id)
}
/**
 * Proxy to start first experience.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mExperienceStart(event){
    mExperience = mExperiences[0]
    if(mExperience)
        stageTransition()
}
function mFetchExperiences(){
    return fetch('/members/experiences/')
        .then(response=>{
            if(!response.ok)
                throw new Error(`HTTP error! Status: ${response.status}`)
            return response.json()
        })
        .catch(error=>console.log('mFetchExperiences::Error()', error))
}
function getActiveCategory(){
	return activeCategory
}
/**
 * Initialize modular variables based on server fetch.
 * @private
 * @requires mExperience
 * @requires mExperiences
 * @requires mMemberId
 * @returns {Promise<boolean>} - The return is a boolean indicating success.
 */
function mInitialize(){
    /* page listeners */
    mInitializePageListeners()
    /* experiences */
    return mFetchExperiences()
        .then(experiencesObject=>{
            const { autoplay, experiences, mbr_id } = experiencesObject
            mExperiences.push(...experiences.filter(experience => !mExperiences.some(e => e.id === experience.id))) // only `unknown`
            mMemberId = mbr_id /* should exist regardless, though should apply independently */
            return autoplay
        })
        .then(autoplay=>{
            if(autoplay)
                mExperience = mExperiences.find(experience => experience.id===autoplay)
            return true
        })
        .catch(err => {
            console.log('Error fetching experiences:', err)
        })
}
/**
 * Initialize page listeners.
 * @private
 * @returns {void}
 */
function mInitializePageListeners(){
    /* page listeners */
    chatInputField.addEventListener('input', toggleInputTextarea)
    memberSubmit.addEventListener('click', mAddMemberDialog) /* note default listener */
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
function isActive(id) {
    return id===activeBot.id
}
/**
 * Resets the animation of an element.
 * @param {HTMLElement} element - The element to reset animation.
 * @returns {void}
 */
function mResetAnimation(element){
    element.style.animation = 'none';
    // Trigger a reflow to restart the animation
    element.offsetHeight;
    element.style.animation = '';
}
/**
 * Transitions and sets the stage to experience version of member screen indicated.
 * @public
 * @param {string} type - The type of scene transition, defaults to `interface`.
 * @returns {void}
 */
function sceneTransition(type='interface'){
    /* assign listeners */
    memberSubmit.removeEventListener('click', mAddMemberDialog)
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
 * Transitions the stage to active member version.
 * @param {boolean} includeSidebar - The include-sidebar flag.
 * @returns {void}
 */
function mStageTransitionMember(includeSidebar=true){
    memberSubmit.removeEventListener('click', submitInput)
    memberSubmit.addEventListener('click', mAddMemberDialog)
    hide(transport)
    hide(screen)
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
    if(includeSidebar){
        show(sidebar)
        show(botBar)
    }
}
/**
 * Submits a message to MyLife Member Services chat.
 * @param {string} message - The message to submit.
 * @param {boolean} bypass - The bypass-server flag.
 * @returns 
 */
async function submit(message, bypass=false){
    if(bypass)
        return [{ message: message }]
	if(!message?.length)
		throw new Error('submit(): `message` argument is required')
	const url = window.location.origin + '/members';
	const _request = {
			agent: 'member',
			id: null,
			message: message,
		}
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(_request),	//	todo: pull json schema for this object from `/messages/$defs/message_member_chat`
	}
	const chatResponse = await submitChat(url, options)
    return chatResponse
}
async function submitChat(url, options) {
	try {
		const response = await fetch(url, options);
		const jsonResponse = await response.json();
		return jsonResponse;
	} catch (err) {
		console.log('fatal error', err);
		return alert(`Error: ${err.message}`);
	}
}
/**
 * Toggles the member input between input and server `waiting`.
 * @public
 * @param {boolean} display - Whether to show/hide (T/F), default `true`.
 * @returns {void}
 */
function toggleMemberInput(display=true, hidden=false){
    if(display){
        hide(awaitButton)
        awaitButton.classList.remove('slide-up')
        chatInput.classList.add('slide-up')
        chatInputField.value = null
        show(chatInput)
    } else {
        hide(chatInput)
        chatInput.classList.remove('fade-in')
        chatInput.classList.remove('slide-up')
        awaitButton.classList.add('slide-up')
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
 * @param {number} delay - The delay between iterations.
 * @param {number} i - The iteration number.
 */
function mTypewriteMessage(chatBubble, message, delay=10, i=0){
    if(i<message.length){
        chatBubble.innerHTML += message.charAt(i)
        i++
        setTimeout(()=>mTypewriteMessage(chatBubble, message, delay, i), delay)
    } else {
        chatBubble.setAttribute('status', 'done')
    }
}
/* exports */
export {
    addMessageToColumn,
    assignElements,
    availableExperiences,
    clearSystemChat,
    escapeHtml,
    getInputValue,
    getSystemChat,
    hide,
    hideMemberChat,
    inExperience,
    replaceElement,
    sceneTransition,
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