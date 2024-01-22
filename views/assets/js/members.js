document.addEventListener('DOMContentLoaded', () => {
    /* vars */
    _awaitButton = document.getElementById('await-button')
    _agentSpinner = document.getElementById('agent-spinner')
    _botBar = document.getElementById('bot-bar')
    _chatInput = document.getElementById('chat-input')
    _chatLabel = document.getElementById('user-chat-label')
    _chatOutput = document.getElementById('chat-output')
    _messageInput = document.getElementById('user-chat-message')
    _submitButton = document.getElementById('submit-button')
    /* page listeners */
    _messageInput.addEventListener('input', toggleInputTextarea);
    _submitButton.addEventListener('click', addUserMessage); // Event listener to submit message
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
    _awaitButton.style.display = 'none'
    /* page-greeting */
    _greeting.forEach(_greet=>{
        _chatBubbleCount++
        addMessageToColumn({
            message: _greet,
            chatBubbleCount: _chatBubbleCount,
        })
    })
    fetchBots()
        .then(async _botFetch => { // peck out the bots and id
            const { bots: _bots, activeBotId: _id } = _botFetch
            _pageBots = _bots
            _activeBot = bot(_id)
            await setActiveBot()
            updatePageBots(false) // if not an update per se, force here
            console.log('active bot:', _activeBot)
            return
        })
        .catch(err => {
            console.log('Error fetching bots:', err)
            // alert(`Error fetching bots. Please try again later. ${err.message}`)
        })
})
/* page chat vars */
/* define variables */
const _greeting = [`So nice to see you!`]
let _activeBot // replaced with _pagebots[reference]
let _chatBubbleCount = 0
let _pageBots = [] // send for processing
let typingTimer
/* page div vars */
let _awaitButton
let _agentSpinner
let _botBar
let _chatInput
let _chatLabel
let _chatOutput
let _messageInput
let _submitButton
/* page functions */
function addMessageToColumn(_message, _options={
	bubbleClass: 'agent-bubble',
	_delay: 15,
    _chatBubbleCount: 0,
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
        _chatBubbleCount,
		_typewrite,
	} = _options
	const chatBubble = document.createElement('div')
	chatBubble.setAttribute('id', `chat-bubble-${_chatBubbleCount}`)
	chatBubble.className = `chat-bubble ${bubbleClass}`
	_chatOutput.appendChild(chatBubble)
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
    let userMessage = _messageInput.value.trim()
    if (!userMessage.length) return
    userMessage = escapeHtml(userMessage) // Escape the user message
    submit(_event, userMessage)
    addMessageToColumn({ message: userMessage }, {
        bubbleClass: 'user-bubble',
        _delay: 7,
    })
    _messageInput.value = ''; // Clear the message field
}
function bot(_id){
    return _pageBots.find(bot => bot.id === _id)
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
    return _id===_activeBot.id
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
    _chatOutput.scrollTop = _chatOutput.scrollHeight;
}
async function setActiveBot(_incEventOrBot) {
    const _activeBotId = _incEventOrBot?.target?.dataset?.botId
        ?? _incEventOrBot?.target.id?.split('_')[1]
        ?? _incEventOrBot?.id
        ?? _activeBot?.id
        ?? _incEventOrBot
    if(isActive(_activeBotId)) return
    /* server request: set active bot */
    const _id = await fetch(
        '/members/bots/activate/' + _activeBotId,
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
    _activeBot = bot(_id)
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
async function submit(_event, _message) {
	_event.preventDefault()
	if(!_message.length??false)
		throw new Error('submit(): `message` property is required')
	_submitButton.style.display = 'none';
	_awaitButton.style.display = 'block';
	_agentSpinner.classList.remove('text-light');
	_agentSpinner.classList.add('text-primary');
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
	_awaitButton.style.display = 'none';
	_submitButton.style.display = 'block';
	_agentSpinner.classList.remove('text-primary');
	_agentSpinner.classList.add('text-light');
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
    const inputStyle = window.getComputedStyle(_chatInput)
    const inputFont = inputStyle.font;
    const textWidth = getTextWidth(_messageInput.value, inputFont); // no trim required
    const inputWidth = _chatInput.offsetWidth;
	/* pulse */
	clearTimeout(typingTimer);
    _agentSpinner.style.display = 'none';
    resetAnimation(_agentSpinner); // Reset animation
    typingTimer = setTimeout(() => {
        _agentSpinner.style.display = 'block';
        resetAnimation(_agentSpinner); // Restart animation
    }, 2000);

    if (textWidth > inputWidth && _messageInput.tagName !== 'TEXTAREA') { // Expand to textarea
        _messageInput = replaceElement(_messageInput, 'textarea');
        focusAndSetCursor(_messageInput);
    } else if (textWidth <= inputWidth && _messageInput.tagName === 'TEXTAREA' ) { // Revert to input
		_messageInput = replaceElement(_messageInput, 'input');
        focusAndSetCursor(_messageInput);
    }
	toggleSubmitButtonState();
}
function toggleSubmitButtonState() {
	_submitButton.disabled = !_messageInput.value?.trim()?.length??true;
}