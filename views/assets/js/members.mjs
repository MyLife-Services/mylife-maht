/* imports */
import {
    mExperienceEnd,
    mExperiencePlay,
    mExperienceSkip,
    mExperienceStart,
} from './experience.mjs'
import { fetchBots, updatePageBots } from './bots.mjs'
/* variables */
/* constants    */
const mExperiences = []
/* variables */
let activeBot, // replaced with pageBots[reference]
    chatBubbleCount = 0,
    pageBots = [], // @todo convert to const
    typingTimer
/* page div variables */
let mAwaitButton,
    mAgentSpinner,
    mBotBar,
    mChatInput,
    mChatLabel,
    mChatOutput,
    mMessageInput,
    mSubmitButton
/* page load listener */
document.addEventListener('DOMContentLoaded', () => {
    /* variable population */
    mAwaitButton = document.getElementById('await-button')
    mAgentSpinner = document.getElementById('agent-spinner')
    mBotBar = document.getElementById('bot-bar')
    mChatInput = document.getElementById('chat-input')
    mChatLabel = document.getElementById('user-chat-label')
    mChatOutput = document.getElementById('chat-output')
    mMessageInput = document.getElementById('user-chat-message')
    mSubmitButton = document.getElementById('submit-button')
    /* page listeners */
    mMessageInput.addEventListener('input', toggleInputTextarea);
    mSubmitButton.addEventListener('click', addUserMessage); // Event listener to submit message
    document.querySelectorAll('.bot-container').forEach(container => { // Event listener to toggle bot containers
        container.addEventListener('click', function() {
            // First, close any currently open containers
            document.querySelectorAll('.bot-container .bot-content.visible').forEach(openContainer => {
                if (openContainer.parentElement !== this) { // Check to avoid closing the current container
                    openContainer.classList.remove('visible')
                }
            });
            // Then, toggle the visibility of the clicked container's content
            var content = this.querySelector('.bot-content')
            if(content?.length) content.classList.toggle('visible')
        })
    })
    /* onLoad */
    mAwaitButton.style.display = 'none'
    fetchExperiences()
        .then(async experiencesObject => {
            if(experiencesObject){
                const { autoplay, experiences, mbr_id } = experiencesObject
                mExperiences.push(...experiences.filter(experience => !mExperiences.some(e => e.id === experience.id))) // only push `unknown` experiences
                const experience = experiences.find(experience => experience.id === autoplay)
                /* autoplay experience */
                if(experience){
                    await mExperienceStart(experience) // includes play at the end once welcome button and data is loaded
                }
            }
        })
    .catch(err => console.log('Error fetching experiences:', err));// alter server-side logic to accommodate a "dry" version of start (without attached events, maybe only set avatar.mode='experience')
    /* page-greeting 
    _greeting.forEach(_greet=>{
        chatBubbleCount++
        addMessageToColumn({
            message: _greet,
            chatBubbleCount: chatBubbleCount,
        })
    })*/
    fetchBots()
        .then(async _bots => { // peck out the bots and id
            const { bots, activeBotId: _id } = _bots
            pageBots = bots
            activeBot = bot(_id)
            await setActiveBot()
            updatePageBots(false)
            return
        })
        .catch(err => {
            console.log('Error fetching bots:', err)
            // alert(`Error fetching bots. Please try again later. ${err.message}`)
        })
})
/* page functions */
function addMessageToColumn(_message, _options={
	bubbleClass: 'agent-bubble',
	_delay: 15,
    chatBubbleCount: 0,
	_typewrite: true,
}){
	const {
		category=null,
		contributions=[],
		id=null,
		message,
		question=null
	} = _message
	const {
		bubbleClass,
		_delay,
        chatBubbleCount,
		_typewrite,
	} = _options
	const chatBubble = document.createElement('div')
	chatBubble.setAttribute('id', `chat-bubble-${chatBubbleCount}`)
	chatBubble.className = `chat-bubble ${bubbleClass}`
	mChatOutput.appendChild(chatBubble)
	_message = escapeHtml(message)
	if (_typewrite) {
		let i = 0;
		let tempMessage = '';
		function typeAgentMessage() {
			if (i < message.length) {
				tempMessage += message.charAt(i);
				chatBubble.innerHTML = '';
				chatBubble.insertAdjacentHTML('beforeend', tempMessage);
				i++;
				setTimeout(typeAgentMessage, _delay); // Adjust the typing speed here (50ms)
			} else {
				chatBubble.setAttribute('status', 'done');
			}
		}
		typeAgentMessage();
	} else {
		chatBubble.insertAdjacentHTML('beforeend', message);
	}
}
function addUserMessage(_event){
    _event.preventDefault()
    // Dynamically get the current message element (input or textarea)
    let userMessage = mMessageInput.value.trim()
    if (!userMessage.length) return
    userMessage = escapeHtml(userMessage) // Escape the user message
    submit(_event, userMessage)
    addMessageToColumn({ message: userMessage }, {
        bubbleClass: 'user-bubble',
        _delay: 7,
    })
    mMessageInput.value = ''; // Clear the message field
}
function bot(_id){
    return pageBots.find(bot => bot.id === _id)
}
// Function to escape HTML special characters
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
function fetchExperiences(){
    return fetch('/members/experiences/')
        .then(response=>{
            if(!response.ok)
                throw new Error(`HTTP error! Status: ${response.status}`)
            return response.json()
        })
        .catch(error=>console.log('fetchExperiences::Error()', error))
}
// Function to focus on the textarea and move cursor to the end
function focusAndSetCursor(textarea) {
    textarea.focus();
    // Move the cursor to the end of the text
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
}
function getActiveCategory() {
	return _activeCategory;
}
function getTextWidth(text, font) {
    // Create a temporary canvas element to measure text width
    let canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    let context = canvas.getContext("2d");
    context.font = font;
    return context.measureText(text).width;
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
    mChatOutput.scrollTop = mChatOutput.scrollHeight;
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
			_activeCategory = {
				contributionId: _response.contributionId,
				category: _response.category,
			}
		})
		.catch(err => {
			console.log('Error setting active category:', err);
			// Handle errors as needed
		});
}
function state(){
    return {
        activeBot,
        pageBots,
    }
}
async function submit(_event, _message) {
	_event.preventDefault()
	if(!_message.length??false)
		throw new Error('submit(): `message` property is required')
	mSubmitButton.style.display = 'none';
	mAwaitButton.style.display = 'block';
	mAgentSpinner.classList.remove('text-light');
	mAgentSpinner.classList.add('text-primary');
	const url = window.location.origin + '/members';
	const _request = {
			agent: 'member',
			id: null,
			message: _message,
		}
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(_request),	//	todo: pull json schema for this object from `/messages/$defs/message_member_chat`
	};
	const _MyLifeResponseArray = await submitChat(url, options);
	_MyLifeResponseArray.forEach(_MyLifeResponse => {
		addMessageToColumn({ message: _MyLifeResponse.message })
	});
	mAwaitButton.style.display = 'none';
	mSubmitButton.style.display = 'block';
	mAgentSpinner.classList.remove('text-primary');
	mAgentSpinner.classList.add('text-light');
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
function toggleInputTextarea() {
    const inputStyle = window.getComputedStyle(mChatInput)
    const inputFont = inputStyle.font;
    const textWidth = getTextWidth(mMessageInput.value, inputFont); // no trim required
    const inputWidth = mChatInput.offsetWidth;
	/* pulse */
	clearTimeout(typingTimer);
    mAgentSpinner.style.display = 'none';
    resetAnimation(mAgentSpinner); // Reset animation
    typingTimer = setTimeout(() => {
        mAgentSpinner.style.display = 'block';
        resetAnimation(mAgentSpinner); // Restart animation
    }, 2000);

    if (textWidth > inputWidth && mMessageInput.tagName !== 'TEXTAREA') { // Expand to textarea
        mMessageInput = replaceElement(mMessageInput, 'textarea');
        focusAndSetCursor(mMessageInput);
    } else if (textWidth <= inputWidth && mMessageInput.tagName === 'TEXTAREA' ) { // Revert to input
		mMessageInput = replaceElement(mMessageInput, 'input');
        focusAndSetCursor(mMessageInput);
    }
	toggleSubmitButtonState();
}
function toggleSubmitButtonState() {
	mSubmitButton.disabled = !mMessageInput.value?.trim()?.length??true;
}
/* exports */
export {
    addMessageToColumn,
    setActiveBot,
    setActiveCategory,
    state,
    submit,
    toggleInputTextarea,
}