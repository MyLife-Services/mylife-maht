/* imports */
import {
    experienceEnd,
    experiencePlay,
    experienceSkip,
    experienceStart,
} from './experience.mjs'
import {
    fetchBots,
    updatePageBots,
} from './bots.mjs'
import Globals from './globals.mjs'
/* variables */
/* constants */
const mGlobals = new Globals()
const mExperiences = []
/* variables */
let activeBot, // replaced with pageBots[reference]
    mAutoplay=false,
    chatBubbleCount = 0,
    mExperience,
    mMemberId,
    pageBots = [], // @todo convert to const
    typingTimer
/* page div variables */
let activeCategory,
    awaitButton,
    botBar,
    chatContainer,
    chatInput,
    chatInputField,
    chatRefresh,
    mainContent,
    memberModerator,
    memberSelect,
    memberSubmit,
    sceneContinue,
    screen,
    sidebar,
    siteNavigation,
    spinner,
    systemChat,
    transport
/* page load listener */
document.addEventListener('DOMContentLoaded', async ()=>{
    /* post-DOM population constants */
    awaitButton = document.getElementById('await-button')
    botBar = document.getElementById('bot-bar')
    chatContainer = document.getElementById('chat-container')
    chatInput = document.getElementById('chat-member')
    chatInputField = document.getElementById('member-chat-message')
    chatRefresh = document.getElementById('chat-refresh')
    mainContent = document.getElementById('main-content')
    memberModerator = document.getElementById('experience-member-moderator')
    memberSelect = document.getElementById('member-select')
    memberSubmit = document.getElementById('submit-button')
    sceneContinue = document.getElementById('experience-continue')
    sidebar = document.getElementById('page-sidebar')
    siteNavigation = document.getElementById('navigation-container')
    spinner = document.getElementById('agent-spinner')
    transport = document.getElementById('experience-transport')
    screen = document.getElementById('experience-modal')
    systemChat = document.getElementById('chat-system')
    /* determine mode, default = member bot interface */
    const initialized = await mInitialize()
    if(!initialized)
        throw new Error('CRITICAL::mInitialize::Error()', success)
    stageTransition()
    /* bots */
    const { bots, activeBotId: id } = await fetchBots()
    pageBots = bots
    activeBot = bot(id)
    await setActiveBot()
    updatePageBots(!inExperience())
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
    chatBubbleCount: 0,
	_typewrite: true,
}){
    let messageContent = message.message ?? message
	const {
		bubbleClass,
		_delay,
        chatBubbleCount,
		_typewrite,
	} = options
	const chatBubble = document.createElement('div')
	chatBubble.setAttribute('id', `chat-bubble-${chatBubbleCount}`)
	chatBubble.className = `chat-bubble ${bubbleClass}`
	systemChat.appendChild(chatBubble)
	// messageContent = escapeHtml(messageContent)
    console.log('messageContent', messageContent)
	if(_typewrite)
		mTypewriteMessage(chatBubble, messageContent, _delay)
	else
		chatBubble.insertAdjacentHTML('beforeend', messageContent)
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
/**
 * Escapes HTML text.
 * @public
 * @param {string} text - The text to escape.
 * @returns {string} - The escaped HTML text.
 */
function escapeHtml(text){
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
/**
 * Gets the member chat system DOM element.
 * @returns {HTMLDivElement} - The member chat system element.
 */
function getSystemChat(){
    return systemChat
}
function getMemberModerator(){
    return memberModerator
}
/**
 * Proxy for Globals.hide().
 * @param {HTMLElement} element - The element to hide.
 * @param {function} callbackFunction - The callback function to execute after the element is hidden.
 * @returns {void}
 */
function hide(){
    return mGlobals.hide(...arguments)
}
function hideMemberChat(){
    hide(siteNavigation)
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
 * Proxy for Globals.show().
 * @public
 * @param {HTMLElement} element - The element to show.
 * @param {function} listenerFunction - The listener function, defaults to `mAnimationEnd`.
 * @returns {void}
 */
function show(){
    return mGlobals.show(...arguments)
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
    if(mExperience?.id) // begin with empty canvas
        experienceStart(mExperience)
    else {
        mStageTransitionMember()
        updatePageBots(true)
    }
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
 * @param {} event - 
 * @returns 
 */
async function mAddMemberDialog(event){
    event.stopPropagation()
	event.preventDefault()
    // Dynamically get the current message element (input or textarea)
    let memberMessage = chatInputField.value.trim()
    if (!memberMessage.length)
        return
    // memberMessage = escapeHtml(memberMessage) // Escape the user message

	hide(chatInput)
    chatInput.classList.remove('fade-in')
    awaitButton.classList.add('slide-up')
    show(awaitButton)

    addMessageToColumn({ message: memberMessage }, {
        bubbleClass: 'user-bubble',
        _delay: 7,
    })

    const responses = await submit(memberMessage, false)
    console.log('responses', responses)
	responses.forEach(response => {
		addMessageToColumn({ message: response.message })
	})

    hide(awaitButton)
    awaitButton.classList.remove('slide-up')
    chatInput.classList.add('fade-in')
    show(chatInput)

    chatInputField.value = null // Clear the message field
}
function bot(_id){
    return pageBots.find(bot => bot.id === _id)
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
// Function to focus on the textarea and move cursor to the end
function focusAndSetCursor(textarea) {
    textarea.focus();
    // Move the cursor to the end of the text
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
}
function getActiveCategory(){
	return activeCategory
}
function getTextWidth(text, font) {
    // Create a temporary canvas element to measure text width
    let canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    let context = canvas.getContext("2d");
    context.font = font;
    return context.measureText(text).width;
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
            console.log('autoplay', autoplay)
            if(autoplay)
                mExperience = mExperiences.find(experience => experience.id===autoplay)
            return true
        })
        .catch(err => {
            console.log('Error fetching experiences:', err)
        })
}
function mInitializePageListeners(){
    /* page listeners */
    chatInputField.addEventListener('input', toggleInputTextarea)
    // **note**: listener for `memberSubmit` added as required by event or chat
    memberSubmit.addEventListener('click', mAddMemberDialog, { once: true })
    chatRefresh.addEventListener('click', clearSystemChat)
    const currentPath = window.location.pathname // Get the current path
    const navigationLinks = document.querySelectorAll('.navbar-nav .nav-link') // Select all nav links
    navigationLinks.forEach(link=>{
        if(link.getAttribute('href')===currentPath){
            link.classList.add('active') // Add 'active' class to the current link
            link.addEventListener('click', event=>{
                event.preventDefault() // Prevent default action (navigation) on click
            })
        }
    })
}
function isActive(_id) {
    return _id===activeBot.id
}
// Function to replace an element (input/textarea) with a specified type
function replaceElement(element, newType) {
    const newElement = document.createElement(newType);
    newElement.id = element.id;
    newElement.name = element.name;
    newElement.required = element.required;
    newElement.classList = element.classList;
    newElement.value = element.value;
    if (newType === 'textarea') {
        newElement.setAttribute('rows', '3');
    }
    element.parentNode.replaceChild(newElement, element);
    newElement.addEventListener('input', toggleInputTextarea); // Reattach the event listener
    return newElement;
}
function resetAnimation(element) {
    element.style.animation = 'none';
    // Trigger a reflow to restart the animation
    element.offsetHeight;
    element.style.animation = '';
}
function scrollToBottom() {
    systemChat.scrollTop = systemChat.scrollHeight;
}
async function setActiveBot(_incEventOrBot) {
    const activeBotId = _incEventOrBot?.target?.dataset?.botId
        ?? _incEventOrBot?.target?.id?.split('_')[1]
        ?? _incEventOrBot?.id
        ?? activeBot?.id
        ?? _incEventOrBot
    if(isActive(activeBotId)) return
    /* server request: set active bot */
    const _id = await fetch(
        '/members/bots/activate/' + activeBotId,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(_response => {
            if (!_response.ok) {
                throw new Error(`HTTP error! Status: ${_response.status}`)
            }
            return _response.json()
        })
        .then(_response => {
            return _response.activeBotId
        })
        .catch(error => {
            console.log('Error:', error)
            return null
        })
    if(isActive(_id)) return
    /* update active bot */
    activeBot = bot(_id)
    updatePageBots(true)
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
 * Transitions the stage to member mode.
 * @param {boolean} includeSidebar - The include-sidebar flag.
 * @returns {void}
 */
function mStageTransitionMember(includeSidebar=true){
    hide(transport)
    hide(screen)
    hide(memberModerator)
    document.querySelectorAll('.mylife-widget')
        .forEach(widget=>{
            const loginRequired = (widget.dataset?.requireLogin ?? "false")==="true"
            if(loginRequired)
                show(widget)
            else
                hide(widget)
        })
    show(mainContent)
    show(siteNavigation)
    show(chatContainer)
    show(systemChat)
    show(chatInput)
    if(includeSidebar){
        show(sidebar)
        show(botBar)
    }
}
function state(){
    return {
        activeBot,
        pageBots,
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
/*
    spinner.classList.remove('text-light');
	spinner.classList.add('text-primary');
	spinner.classList.remove('text-primary');
	spinner.classList.add('text-light');
*/
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
// Function to toggle between textarea and input based on character count
function toggleInputTextarea(){
    const inputStyle = window.getComputedStyle(chatInput)
    const inputFont = inputStyle.font
    const textWidth = getTextWidth(chatInputField.value, inputFont) // no trim required
    const inputWidth = chatInput.offsetWidth
	/* pulse */
	clearTimeout(typingTimer);
    spinner.style.display = 'none';
    resetAnimation(spinner); // Reset animation
    typingTimer = setTimeout(() => {
        spinner.style.display = 'block';
        resetAnimation(spinner); // Restart animation
    }, 2000);

    if (textWidth > inputWidth && chatInputField.tagName !== 'TEXTAREA') { // Expand to textarea
        chatInputField = replaceElement(chatInputField, 'textarea')
        focusAndSetCursor(chatInputField);
    } else if (textWidth <= inputWidth && chatInputField.tagName === 'TEXTAREA' ) { // Revert to input
		chatInputField = replaceElement(chatInputField, 'input');
        focusAndSetCursor(chatInputField);
    }
	toggleSubmitButtonState();
}
function toggleSubmitButtonState() {
	memberSubmit.disabled = !chatInputField.value?.trim()?.length??true;
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
    clearSystemChat,
    getMemberModerator,
    getSystemChat,
    hide,
    hideMemberChat,
    inExperience,
    setActiveBot,
    setActiveCategory,
    show,
    showMemberChat,
    showSidebar,
    stageTransition,
    state,
    submit,
    toggleInputTextarea,
    waitForUserAction,
}