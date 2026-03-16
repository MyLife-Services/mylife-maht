/* imports */
import {
    activeBot,
    activeChat,
    activeClose,
    activeItem,
    activeStatus,
    activeTeam,
    activeThumb,
    activeTitle,
    createItem,
    endMemory,
    getAction,
    getBot,
    getBotIcon,
    getBots,
    getBotsByForm,
    getItem,
    initBots,
    isAvatar,
    refreshCollection,
    setActiveBot,
    setActiveItem,
    toggleBotContainers,
    togglePopup,
    unsetActiveItem,
    updateActiveItemTitle,
    updateItem,
    updateItemSummary,
    updateItemTitle,
    updateTitle,
} from './bots.mjs'
import {
    experienceEnd,
    experiencePlay,
    experiences as _experiences,
    experienceSkip,
    experienceStart,
    routine,
    submitInput,
} from './experience.mjs'
import Globals from './globals.mjs'
/* variables */
/* constants */
const globals = new Globals()
const navigation = globals.navigation,
    sidebar = globals.sidebar
window.about = about
window.privacyPolicy = privacyPolicy
/* variables */
let mAutoplay=false,
    mChatBubbleCount=0,
    mMemberId
let activePopup = null, // dragging vars
    isDragging = false,
    offsetX = 0,
    offsetY = 0
/* page div variables */
const mChatRefresh = document.getElementById('chat-refresh'),
    mLogout = document.getElementById('navigation-logout')
const mLoader = document.getElementById('page-loader')
const sceneContinue = document.getElementById('experience-continue')
const screen = document.getElementById('experience-modal')
const spinner = document.getElementById('agent-spinner')
const transport = document.getElementById('experience-transport')
/* page load listener */

document.addEventListener('DOMContentLoaded', async event=>{
    /* determine mode, default = member bot interface */
    await mInitialize() // throws if error
    stageTransition()
    unsetActiveAction()
})
/* public functions */
/**
 * Presents the `about` page as a series of sectional responses from your avatar.
 * @public
 * @async
 * @returns {void}
 */
function about(){
    routine('about')
}
/**
 * Adds an input element (button, input, textarea,) to the system chat column.
 * @param {HTMLElement} HTMLElement - The HTML element to add to the system chat column.
 * @returns {void}
 */
function addInput(HTMLElement){
    globals.addChatElement(HTMLElement)
}
/**
 * Pushes message content to the chat column.
 * @public
 * @param {String} message - The message object to add to column.
 * @param {String} role - The role of the message, default=`agent`
 * @param {number} typeDelay - The delay between typing each character, default=`2`
 * @returns {void}
 */
function addMessage(message, role, typeDelay){
    mAddMessage(message, role, typeDelay)
}
/**
 * Pushes an array of messages to the chat column.
 * @param {String[]} messages - The array of string messages to add to the chat column.
 * @param {String} role - The role of the message, uses `type` of bot to trigger CSS
 * @param {number} typeDelay - The delay between typing each character, default=`2`
 * @param {number} responseDelay - The delay between each message, default=`3` seconds
 * @returns {void}
 */
function addMessages(messages, role, typeDelay, responseDelay=3){
    for(let i=0; i<messages.length; i++)
        if(responseDelay)
            setTimeout(_=>mAddMessage(messages[i], role, typeDelay), i * responseDelay * 1000)
        else
            mAddMessage(messages[i], role, typeDelay)
}
/**
 * Clears the system chat column.
 * @public
 * @returns {void}
 */
function clearSystemChat(){
    activeBot().interactionCount = 0
    globals.clearElement()
}
/**
 * Called from setActiveBot, triggers any main interface changes as a result of new selection.
 * @public
 * @param {object} activeBot - The active bot.
 * @returns {void}
 */
function decorateActiveBot(){
    const { id, name, } = activeBot()
    globals.chatInputPlaceholder = `Type your message to ${ name }...`
}
/**
 * Consumes instruction object and performs the requested actions.
 * @todo - all interfaceLocations supported
 * @todo - currently just force-feeding _all_ the functions I need; make more contextual
 * @param {object} instruction - The instruction object
 * @param {string} interfaceLocation - The interface location, default=`chat`
 * @param {object} additionalFunctions - The additional functions object, coming from other module requests
 * @returns {void}
 */
function enactInstruction(instruction, interfaceLocation='chat', additionalFunctions={}){
    if(!instruction || interfaceLocation!='chat')
        return
    const functions = {
        addInput,
        addMessages,
        ...additionalFunctions, // overloads feasible
    }
    globals.enactInstruction(instruction, functions)
}
function escapeHtml(text) {
    return globals.escapeHtml(text)
}
function experiences(){
    return _experiences()
}
/**
 * Deletes an element from the DOM via Avatar functionality.
 * @param {HTMLElement} element - The element to expunge.
 * @returns {void}
 */
function expunge(element){
    return globals.expunge(element)
}
/**
 * Proxy for Globals.hide().
 * @param {HTMLElement} element - The element to hide.
 * @param {function} callbackFunction - The callback function to execute after the element is hidden.
 * @returns {void}
 */
function hide(){
    globals.hide(...arguments)
}
/**
 * Determines whether an experience is in progress.
 * @returns {boolean} - The return is a boolean indicating whether an experience is in progress.
 */
function inExperience(){
    return mExperience?.id?.length ?? false
}
/**
 * Presents the `introduction` routine.
 * @public
 * @returns {void}
 */
function introduction(){
    clearSystemChat()
    routine('introduction')
}
/**
 * Gets the main content element.
 * @public
 * @returns {HTMLElement} - The return is the main content element
 */
function mainContent(){
    return globals.mainContent
}
function overlays(){
    return globals.overlays
}
/**
 * Presents the `privacy-policy` page as a routine.
 * @public
 * @returns {void}
 */
function privacyPolicy(){
    routine('privacy')
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
        return element
    }
}
/**
 * Sets the active item to an `action` determined by the requesting bot.
 * @public
 * @param {object} instructions - The action object describing how to populate { button, callback, icon, status, text, thumb, }.
 * @property {string} button - The button text; if false-y, no button is displayed
 * @property {function} callback - The callback function to execute on button click
 * @property {string} icon - The icon class to display
 * @property {string} status - The status text to display
 * @property {string} text - The text to display
 * @property {string} thumb - The thumbnail image URL
 * @returns {void}
 */
function setActiveAction(instructions){
    if(!instructions)
        return
    activeItem().inAction = true
    const { button, callback, icon, status, text, thumb, } = instructions
    const activeButton = document.getElementById('chat-active-item-button')
    const activeClose = document.getElementById('chat-active-item-close')
    const activeIcon = document.getElementById('chat-active-item-icon')
    const activeStatus = document.getElementById('chat-active-item-status')
    const activeTitle = document.getElementById('chat-active-item-title')
    activeThumb().className = 'fas chat-active-action-thumb'
    if(thumb?.length)
        activeThumb().src = thumb
    else
        hide(activeThumb())
    if(activeIcon){
        activeIcon.className = 'fas chat-active-action-icon'
        if(icon?.length)
            activeIcon.classList.add(icon)
        else
            hide(activeIcon)
    }
    if(activeStatus){
        activeStatus.className = 'chat-active-action-status'
        activeStatus.removeEventListener('click', e=>togglePopup(activeItem().id))
        if(status?.length)
            activeStatus.textContent = status
        else
            hide(activeStatus)
    }
    if(activeButton){
        activeButton.className = 'button chat-active-action-button'
        if(button?.length){
            activeButton.textContent = button
            if(callback){
                activeButton.addEventListener('click', callback, { once: true })
                activeButton.disabled = false
            }
        } else
            hide(activeButton)
    }
    if(activeTitle){
        activeTitle.className = 'chat-active-action-title'
        if(text?.length)
            activeTitle.textContent = text
        else
            hide(activeTitle)
    }
    if(activeClose){
        activeClose.addEventListener('click', unsetActiveAction, { once: true })
    }
    show(activeChat())
}
/**
 * Proxy for Globals.show().
 * @public
 * @param {HTMLElement} element - The element to show.
 * @param {function} listenerFunction - The listener function, defaults to `mAnimationEnd`.
 * @returns {void}
 */
function show(){
    globals.show(...arguments)
}
/**
 * Shows the member system.
 * @public
 * @returns {void}
 */
function showMemberInterface(){
    hide(screen)
    show(mainContent())
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
    if(globals.isGuid(experienceId))
        experienceStart(experienceId)
    else
        mStageTransitionMember()
}
/**
 * Initiates drag of popups, currently only used for item popups.
 * @public
 * @param {HTMLElement} popup - The popup element to drag
 * @param {Event} e - The mouse event object from the initiating event listener
 * @return {void}
 */
function startDrag(popup, e){
    isDragging = true
    activePopup = popup
    const rect = activePopup.getBoundingClientRect()
    activePopup.style.left = rect.left + 'px'
    activePopup.style.top = rect.top + 'px'
    activePopup.style.transform = 'none'
    offsetX = e.clientX - rect.left
    offsetY = e.clientY - rect.top
}
/**
 * Start experience onscreen, displaying welcome and loading remaining data. Passthrough to `experience.mjs::experienceStart()`.
 * @public
 * @param {Guid} experienceId - The Experience id
 * @returns {void}
 */
async function startExperience(experienceId){
    await experienceStart(experienceId)
}
/**
 * Submits a message to MyLife Member Services chat.
 * @async
 * @param {string} message - The message to submit
 * @param {string} role - The role of the message, default=`member`
 * @param {boolean} hideMemberChat - The hide member chat flag, default=`true`
 * @returns {Promise<object>} - The return is the chat response object: { instruction, responses, success, }
 */
async function submit(message, role='member', hideMemberChat=true){
	if(!message?.length)
		return
    if(hideMemberChat)
        toggleMemberInput(false)
    const awaitBar = globals.await(`Connecting with ${ activeBot().name }...`)
    globals.addChatElement(awaitBar)
    const { id: itemId, } = activeItem()
    const { id: botId, } = activeBot()
	const request = {
        botId,
        itemId,
        message,
        role,
    }
	const response = await globals.datamanager.submitChat(request, true)
    globals.expunge(awaitBar)
    if(hideMemberChat)
        toggleMemberInput(true)
    return response
}
/**
 * Toggles the member input between input and server `waiting`.
 * @public
 * @param {boolean} display - Whether to show/hide (T/F), default `true`.
 * @param {boolean} hidden - Whether to force-hide (T/F), default `false`. **Note**: used in `experience.mjs`
 * @param {boolean} connectingText - The server-connecting text, default: `Connecting with `.
 * @returns {void}
 */
function toggleMemberInput(display=true){
    globals.toggleChatInput(display, 'slide-up')
}
/**
 * Toggles the visibility of an element with option to force state.
 * @param {HTMLElement} element - The element to toggle.
 * @param {boolean} bForceState - The state to force the element to, defaults to `null`.
 * @returns {void}
 */
function toggleVisibility(){
    globals.toggleVisibility(...arguments)
}
/**
 * Unsets the active action in the chat system.
 * @public
 * @returns {void}
 */
function unsetActiveAction(){
    unsetActiveItem()
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
    const Bot = activeBot() // lock in here `await`
    let memberMessage = globals.chatInput
    if (!memberMessage.length)
        return
    /* prepare request */
    mAddMessage(memberMessage, 'member', 7)
    /* server request */
    const response = await submit(memberMessage)
    let { instruction, responses=[], success=false, } = response
    if(!success)
        mAddMessage('I\'m sorry, I didn\'t understand that, something went wrong on the server. Please try again.')
    if(!!instruction)
        enactInstruction(instruction, 'chat', {
            createItem,
            updateItem,
            updateItemSummary,
            updateItemTitle,
        })
    else {
        if(!Bot.interactionCount)
            Bot.interactionCount = 0
        Bot.interactionCount++
        if(Bot.interactionCount>2){
            setActiveAction(getAction(Bot.type))
            Bot.interactionCount = 0
        }
    }
    /* process response */
	responses
        .forEach(message=>{
            mAddMessage(message.message ?? message.content, Bot.type, 10)
        })
}
/**
 * Adds specified string message to interface.
 * @param {object|string} message - The message to add to the chat; if object, reduces to `.message` or fails.
 * @param {String} role - The role of the message, default=`agent`
 * @param {number} typeDelay - The delay between typing each character, default=`2`
 * @returns {void}
 */
async function mAddMessage(message, role='agent', typeDelay=2){
    if(typeof message==='object'){
        if(message?.message){ // otherwise error throws for not string (i.e., Array or classed object)
            role = message?.role // overwrite if exists
                ?? role
            message = message.message
        }
    }
    if(typeof message!=='string' || !message.length)
        throw new Error('mAddMessage::Error()::`message` string is required')
    role = role.split('-').pop().trim().toLowerCase()
    const isSynthetic = !['chat', 'guest', 'member', 'user', 'visitor'].includes(role)
    /* message container */
    const chatMessage = document.createElement('div')
    chatMessage.classList.add('chat-message', `chat-message-${ role }`)
    if(!isSynthetic)
        chatMessage.classList.add('chat-message-organic')
    /* message thumbnail */
    if(isSynthetic){
        const messageThumb = document.createElement('img')
        messageThumb.classList.add('chat-thumb')
        messageThumb.id = `message-thumb-${ mChatBubbleCount }`
        switch(role){
            case 'system':
                messageThumb.src = getBotIcon('system')
                messageThumb.alt = `Q, MyLife's Corporate Intelligence`
                messageThumb.title = `Hi, I'm Q, MyLife's Corporate Synthetic Intelligence. I am designed to help you better understand MyLife's organization, membership, services and vision.`
                break
            default:
                const bot = activeBot()
                const type = bot.type.split('-').pop()
                messageThumb.src = getBotIcon(type)
                messageThumb.alt = bot.name
                messageThumb.title = bot.purpose
                    ?? `I'm ${ bot.name }, an artificial intelligence ${ type.replace('-', ' ') } designed to assist you!`
                break
        }
        chatMessage.appendChild(messageThumb)
    }
    /* message bubble */
	const chatText = document.createElement('div')
	chatText.classList.add('chat-message-text')
    chatText.id = `chat-bubble-${ mChatBubbleCount }`
    /* message tab */
    const chatMessageTab = document.createElement('div')
    chatMessageTab.id = `chat-message-tab-${ mChatBubbleCount }`
    chatMessageTab.classList.add('chat-message-tab', `chat-message-tab-${ isSynthetic ? 'agent': 'member' }`)
    const chatCopy = document.createElement('i')
    chatCopy.classList.add('fas', 'fa-copy', 'chat-copy')
    chatCopy.title = 'Copy content to clipboard'
    const chatSave = document.createElement('i')
    chatSave.classList.add('fas', 'fa-floppy-disk', 'chat-save')
    chatSave.title = 'Save memory directly to MyLife'
    const chatFeedbackPositive = document.createElement('i')
    chatFeedbackPositive.classList.add('fas', 'fa-thumbs-up', 'chat-feedback')
    chatFeedbackPositive.title = 'I like this!'
    const chatFeedbackNegative = document.createElement('i')
    chatFeedbackNegative.classList.add('fas', 'fa-thumbs-down', 'chat-feedback')
    chatFeedbackNegative.title = `I don't care for this.`
    /* attach children */
    chatMessageTab.appendChild(chatCopy)
    if(role==='member')
        chatMessageTab.appendChild(chatSave)
    else {
        chatMessageTab.appendChild(chatFeedbackPositive)
        chatMessageTab.appendChild(chatFeedbackNegative)
    }
    chatMessage.appendChild(chatText)
    chatMessage.appendChild(chatMessageTab)
	globals.addChatElement(chatMessage)
    /* assign listeners */
    chatMessage.addEventListener('mouseover', _=>{
        chatMessageTab.classList.add('chat-message-tab-hover', `chat-message-tab-hover-${ isSynthetic ? 'agent' : 'member' }`)
    })
    chatCopy.addEventListener('click', _=>{
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
    chatFeedbackNegative.addEventListener('click', async event=>{
        const baseClass = 'fa-thumbs-down'
        chatFeedbackNegative.classList.remove(baseClass)
        chatFeedbackNegative.classList.add('fa-spinner', 'spin')
        const feedbackTimeout = setTimeout(_=>{
            chatFeedbackNegative.classList.remove('fa-spinner', 'spin')
            chatFeedbackNegative.classList.add(baseClass)
        }, 5000)
        const success = await globals.datamanager.feedback(false, message)
        clearTimeout(feedbackTimeout)
        const successClass = success ? 'fa-check' : 'fa-times'
        chatFeedbackNegative.classList.add(successClass)
        chatFeedbackNegative.classList.remove('fa-spinner', 'spin')
        setTimeout(_=>{
            chatFeedbackNegative.remove()
            chatFeedbackPositive.remove()
        }, 2000)
    }, { once: true })
    chatFeedbackPositive.addEventListener('click', async event=>{
        const baseClass = 'fa-thumbs-up'
        chatFeedbackPositive.classList.remove(baseClass)
        chatFeedbackPositive.classList.add('fa-spinner', 'spin')
        const feedbackTimeout = setTimeout(_=>{
            chatFeedbackPositive.classList.remove('fa-spinner', 'spin')
            chatFeedbackPositive.classList.add(baseClass)
        }, 5000)
        const success = await globals.datamanager.feedback(true, message)
        clearTimeout(feedbackTimeout)
        const successClass = success ? 'fa-check' : 'fa-times'
        chatFeedbackPositive.classList.add(successClass)
        chatFeedbackPositive.classList.remove('fa-spinner', 'spin')
        setTimeout(_=>{
            chatFeedbackNegative.remove()
            chatFeedbackPositive.remove()
        }, 2000)
    }, { once: true })
    chatSave.addEventListener('click', async event=>{
        const baseClass = 'fa-floppy-disk'
        chatSave.classList.remove(baseClass)
        chatSave.classList.add('fa-spinner', 'spin')
        const feedbackTimeout = setTimeout(_=>{
            chatFeedbackPositive.classList.remove('fa-spinner', 'spin')
            chatFeedbackPositive.classList.add(baseClass)
        }, 15000)
        const saveMessage = `## PRINT\n${ message }\n`
        const success = await submit(saveMessage, false)
        clearTimeout(feedbackTimeout)
        const successClass = success ? 'fa-check' : 'fa-exclamation-triangle'
        chatSave.classList.add(successClass)
        chatSave.classList.remove('fa-spinner', 'spin')
        setTimeout(_=>{
            if(success)
                chatSave.remove()
            else {
                chatSave.classList.remove(successClass)
                chatSave.classList.add(baseClass)
            }
        }, 2000)
    }, { once: true })
    chatMessage.addEventListener('mouseleave', _=>{
        chatMessageTab.classList.remove('chat-message-tab-hover', `chat-message-tab-hover-${ isSynthetic ? 'agent' : 'member' }`)
    })
    /* chat message */
    if(!message.startsWith('<section>'))
        message = `<section>${message}</section>`
    mTypeMessage(chatText, message, typeDelay)
    mChatBubbleCount++
}
/**
 * Initialize module variables from server.
 * @private
 * @requires mMemberId
 * @returns {Promise<boolean>} - The return is a boolean indicating success.
 */
async function mInitialize(){
    mInitializePageListeners()
    await initBots()
}
/**
 * Initialize page listeners.
 * @private
 * @returns {void}
 */
function mInitializePageListeners(){
    /* page listeners */
    globals.ChatSubmit.addEventListener('click', mAddMemberMessage) /* note default listener */
    mChatRefresh.addEventListener('click', clearSystemChat)
    const currentPath = window.location.pathname // Get the current path
    const navigationLinks = document.querySelectorAll('.navigation-nav .navigation-link') // Select all nav links
    navigationLinks.forEach(link=>{
        console.log('link', link)
        if(link.getAttribute('href')===currentPath){
            link.classList.add('active') // Add 'active' class to the current link
            link.addEventListener('click', event=>{
                event.preventDefault() // Prevent default action (navigation) on click
            })
        }
    })
    /* dragging events */
    document.addEventListener('mousemove', (e)=>{
        if(!isDragging || !activePopup)
            return
        const maxLeft = window.innerWidth * 0.4 // 40vw
        let newLeft = e.clientX - offsetX
        let newTop = e.clientY - offsetY
        if (newLeft > maxLeft) newLeft = maxLeft
        activePopup.style.left = newLeft + 'px'
        activePopup.style.top = newTop + 'px'
    })
    document.addEventListener('mouseup', ()=>{
        isDragging = false
    })
}
/**
 * Primitive step to set a "modality" or intercession for the member chat.
 * @public
 * @param {Guid} itemId - The Active Item ID
 * @param {Guid} shadowId - The shadow ID
 * @param {string} value - The value to seed the input with
 * @param {string} placeholder - The placeholder to seed the input with (optional)
 */
function seedInput(itemId, shadowId, value, placeholder){
    setActiveItem({ id: itemId, shadowId, })
    globals.seedInput(value, placeholder)
}
/**
 * Transitions and sets the stage to experience version of member screen indicated.
 * @public
 * @param {string} type - The type of scene transition, defaults to `interface`.
 * @returns {void}
 */
function sceneTransition(type='interface'){
    /* assign listeners */
    globals.ChatSubmit.removeEventListener('click', mAddMemberMessage)
    globals.ChatSubmit.addEventListener('click', submitInput)
    /* clear "extraneous" */
    hide(navigation)
    globals.toggleChatInput(false)
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
    showMemberInterface()
}
/**
 * Transitions the stage to active member version.
 * @param {boolean} includeSidebar - The include-sidebar flag.
 * @returns {void}
 */
function mStageTransitionMember(includeSidebar=true){
    globals.ChatSubmit.removeEventListener('click', submitInput)
    globals.ChatSubmit.addEventListener('click', mAddMemberMessage)
    hide(transport)
    hide(screen)
    hide(mLoader)
    show(mainContent())
    show(navigation)
    show(sidebar)
    show(globals.ChatContainer)
    if(includeSidebar && sidebar)
        show(sidebar)
}
/* DEPRECATE?
function mToggleItemPopup(event){
    event.stopPropagation()
    event.preventDefault()
    const itemId = activeItem()?.id
    togglePopup(itemId, true)
}
*/
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
        globals.scrollBottom()
    }
    _typewrite()
}
/* exports */
export {
    activeBot,
    activeItem,
    activeTeam,
    addInput,
    addMessage,
    addMessages,
    clearSystemChat,
    decorateActiveBot,
    escapeHtml,
    experiences,
    getBot,
    getBotIcon,
    getBots,
    getBotsByForm,
    inExperience,
    introduction,
    enactInstruction,
    privacyPolicy,
    replaceElement,
    routine,
    sceneTransition,
    seedInput,
    setActiveAction,
    setActiveBot,
    showMemberInterface,
    showSidebar,
    stageTransition,
    startDrag,
    startExperience,
    submit,
    toggleMemberInput,
    toggleBotContainers,
    toggleVisibility,
    unsetActiveAction,
    waitForUserAction,
    /* globals */
    expunge,
    globals,
    hide,
    mainContent,
    overlays,
    show,
}