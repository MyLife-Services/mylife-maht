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
/* variables */
/* constants */
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
    chatContainer,
    mainContent,
    memberChatContainer,
    memberChatInput,
    memberChatInputField,
    memberChatSystem,
    memberModerator,
    memberNavigation,
    memberSubmit,
    sceneContinue,
    screen,
    sidebar,
    spinner,
    systemChat,
    transport
/* page load listener */
document.addEventListener('DOMContentLoaded', ()=>{
    /* post-DOM population constants */
    awaitButton = document.getElementById('await-button')
    chatContainer = document.getElementById('chat-container')
    mainContent = document.getElementById('main-content')
    memberChatContainer = document.getElementById('chat-container')
    memberChatInput = document.getElementById('chat-member')
    memberChatInputField = document.getElementById('member-chat-message')
    memberChatSystem = document.getElementById('chat-system')
    memberModerator = document.getElementById('experience-member-moderator')
    memberNavigation = document.getElementById('navigation-container')
    memberSubmit = document.getElementById('submit-button')
    sceneContinue = document.getElementById('experience-continue')
    sidebar = document.getElementById('page-sidebar')
    spinner = document.getElementById('agent-spinner')
    transport = document.getElementById('experience-transport')
    screen = document.getElementById('experience-modal')
    systemChat = document.getElementById('chat-system')
    /* determine mode, default = member bot interface */
    mInitialize()
        .then(success=>{
            if(!success)
                throw new Error('CRITICAL::mInitialize::Error()', success)
            stageTransition()
        })
        .catch(err=>{
            console.log('CRITICAL::mInitialize::Error()', err)
        })
    fetchBots() // regardless, fetch member bot array
        .then(async _bots => { // peck out the bots and id
            const { bots, activeBotId: id } = _bots
            pageBots = bots
            activeBot = bot(id)
            await setActiveBot()
            updatePageBots(true)
        })
        .catch(err => {
            console.log('CRITICAL::Error fetching bots:', err)
        })
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
 * Escapes HTML text.
 * @public
 * @param {string} text - The text to escape.
 * @returns {string} - The escaped HTML text.
 */
function escapeHtml(text) {
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
function getMemberChatSystem(){
    return memberChatSystem
}
function getMemberModerator(){
    return memberModerator
}
/**
 * Hides an element, pre-executing any included callback function.
 * @public
 * @param {HTMLElement} element - The element to hide.
 * @param {function} callbackFunction - The callback function to execute after the element is hidden.
 */
function hide(element, callbackFunction){
    if(!element) {
        console.log('mHide::element not found', element, document.getElementById('chat-member'))
        return
    }
    element.classList.remove('show')
    if(element.getAnimations().length){
        element.addEventListener('animationend', function() {
            element.classList.add('hide')
        }, { once: true }) // The listener is removed after it's invoked
    }
    // element.style.animation = 'none' /* stop/rewind all running animations */
    if(callbackFunction)
        callbackFunction()
    element.classList.add('hide')
}
function hideMemberChat(){
    hide(memberNavigation)
    hide(memberChatInput)
    hide(sidebar)
}
/**
 * Last stop before Showing an element and kicking off animation chain. Adds universal run-once animation-end listener, which may include optional callback functionality.
 * @public
 * @param {HTMLElement} element - The element to show.
 * @param {function} listenerFunction - The listener function, defaults to `mAnimationEnd`.
 * @returns {void}
 */
function show(element, listenerFunction){
    element.addEventListener(
        'animationend',
        animationEvent=>mAnimationEnd(animationEvent, listenerFunction),
        { once: true },
    )
    if(!element.classList.contains('show')){
        element.classList.remove('hide')
        element.classList.add('show')
    }
}
function showMemberChat(){
    hide(screen)
    show(mainContent)
    show(memberChatContainer)
    show(memberChatSystem)
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
    else
        mStageTransitionMember()
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
 * Callback function for ending an animation. Currently only stops propagation.
 * @private
 * @param {Animation} animation - The animation object.
 * @param {function} callbackFunction - The listener function, defaults to `mAnimationEnd`.
 * @returns {void}
 */
function mAnimationEnd(animation, callbackFunction){
    animation.stopPropagation()
    if(callbackFunction)
        callbackFunction(animation)
}
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
    let memberMessage = memberChatInputField.value.trim()
    if (!memberMessage.length)
        return
    // memberMessage = escapeHtml(memberMessage) // Escape the user message

	hide(memberChatInput)
    memberChatInput.classList.remove('fade-in')
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
    memberChatInput.classList.add('fade-in')
    show(memberChatInput)

    memberChatInputField.value = null // Clear the message field
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
    memberChatInputField.addEventListener('input', toggleInputTextarea)
    // **note**: listener for `memberSubmit` added as required by event or chat
    memberSubmit.addEventListener('click', mAddMemberDialog, { once: true })
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
    };
    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
		.then(_response => {
			if (!_response.ok) {
				throw new Error(`HTTP error! Status: ${_response.status}`);
			}
			return _response.json();
		})
		.then(_response => {
			activeCategory = {
				contributionId: _response.contributionId,
				category: _response.category,
			}
		})
		.catch(err => {
			console.log('Error setting active category:', err)
		})
}
function mStageTransitionMember(){
    hide(transport)
    hide(screen)
    show(mainContent)
    show(chatContainer)
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
    const inputStyle = window.getComputedStyle(memberChatInput)
    const inputFont = inputStyle.font
    const textWidth = getTextWidth(memberChatInputField.value, inputFont) // no trim required
    const inputWidth = memberChatInput.offsetWidth
	/* pulse */
	clearTimeout(typingTimer);
    spinner.style.display = 'none';
    resetAnimation(spinner); // Reset animation
    typingTimer = setTimeout(() => {
        spinner.style.display = 'block';
        resetAnimation(spinner); // Restart animation
    }, 2000);

    if (textWidth > inputWidth && memberChatInputField.tagName !== 'TEXTAREA') { // Expand to textarea
        memberChatInputField = replaceElement(memberChatInputField, 'textarea');
        focusAndSetCursor(memberChatInputField);
    } else if (textWidth <= inputWidth && memberChatInputField.tagName === 'TEXTAREA' ) { // Revert to input
		memberChatInputField = replaceElement(memberChatInputField, 'input');
        focusAndSetCursor(memberChatInputField);
    }
	toggleSubmitButtonState();
}
function toggleSubmitButtonState() {
	memberSubmit.disabled = !memberChatInputField.value?.trim()?.length??true;
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
    getMemberChatSystem,
    getMemberModerator,
    hide,
    hideMemberChat,
    setActiveBot,
    setActiveCategory,
    show,
    showMemberChat,
    stageTransition,
    state,
    submit,
    toggleInputTextarea,
    waitForUserAction,
}