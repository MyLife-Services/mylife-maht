/* imports */
import Globals from './globals.mjs'
/* precursor constants */
const mGlobals = new Globals()
/* constants */
const hide = mGlobals.hide
const retract = mGlobals.retract
const show = mGlobals.show
window.about = about
window.privacyPolicy = privacyPolicy
/* variables */
let mChallengeMemberId,
    mChatBubbleCount = 0,
    mDefaultTypeDelay = 7,
    mPageType = null,
    mRecognition,
    mRecognizingSpeech = false,
    mSignupType = 'newsletter',
    mIgnoreEnd = true
/* page div variables */
let awaitButton,
    challengeError,
    challengeInput,
    challengeInputText,
    challengeSubmit,
    loginSelect,
    mainContent,
    navigation,
    pageLoader,
    privacyContainer,
    sidebar,
    signupButton,
    signupEmailInputField,
    signupErrorMessage,
    signupForm,
    signupHeader,
    signupHumanNameInput,
    signupSuccess,
    signupTeaser
/* page load */
document.addEventListener('DOMContentLoaded', async event=>{
    /* load data */
    let activeShare=false,
        activeShareId=new URLSearchParams(window.location.search).get('sid'),
        hideChat=false
    let { input, messages, } = await mLoadStart()
    /* display page */
    if(mGlobals.isGuid(activeShareId)){
        activeShareId = await mGlobals.datamanager.validateShare(activeShareId) // set with instanceId as opposed to share document id
        if(mGlobals.isGuid(activeShareId))
            activeShare = true
    }
    if(mPageType==='select' || activeShare)
        hideChat = true
    mShowPage(hideChat)
    if(messages.length)
        mAddMessages(messages, { // no await necessary
            bubbleClass: 'agent-bubble',
            typeDelay: 10,
            typewrite: true,
        })
        if(input)
            mGlobals.addChatElement(input)
    /* execute Share */
    if(activeShare)
        mShareStart(activeShareId)
})
/* public functions */
function about(){
    mRoutine('about')
}
function privacyPolicy(){
    mRoutine('privacy')
}
/* private functions */
/**
 * Adds a message to the chat column.
 * @private
 * @param {string} message - The message to add to the chat column
 * @param {object} options - The options for the chat bubble
 * @returns {chatBubble} - The chat bubble element
 */
function mAddMessage(message, options={}){
    const {
        bubbleClass='agent-bubble',
        callback=_=>{},
		typeDelay=mDefaultTypeDelay,
		typewrite=true,
	} = options
    const role = bubbleClass.split('-')[0]
    const isSynthetic = !['chat', 'guest', 'member', 'user', 'visitor'].includes(role)
    /* message container */
    const chatMessage = document.createElement('div')
    chatMessage.classList.add('chat-message-container', `chat-message-container-${ role }`)
    /* message thumbnail */
    if(isSynthetic){
        const messageThumb = document.createElement('img')
        messageThumb.classList.add('chat-thumb')
        messageThumb.id = `message-thumb-${ mChatBubbleCount }`
        messageThumb.src = 'png/Q.png'
        messageThumb.alt = `Q, MyLife's Corporate Intelligence`
        messageThumb.title = `Hi, I'm Q, MyLife's Corporate Synthetic Intelligence. I am designed to help you better understand MyLife's organization, membership, services and vision.`
        chatMessage.appendChild(messageThumb)
    }
    /* message bubble */
	const chatBubble = document.createElement('div')
	chatBubble.classList.add('chat-bubble', (bubbleClass ?? role+'-bubble'))
    chatBubble.id = `chat-bubble-${ mChatBubbleCount }`
    mChatBubbleCount++
    chatMessage.appendChild(chatBubble)
    /* append chat message */
    mGlobals.addChatElement(chatMessage)
    if(!message.startsWith('<section>'))
        message = `<section>${message}</section>`
	if(typewrite)
        mTypeMessage(chatBubble, message, typeDelay, callback)
	else {
		chatBubble.insertAdjacentHTML('beforeend', message)
        mGlobals.scrollBottom()
        callback()
	}
    return chatMessage
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
    const userMessage = mGlobals.chatInput
    if(!userMessage.length)
        return
    const message = mGlobals.escapeHtml(userMessage) // Escape the user message
    const options = {
        bubbleClass: 'user-bubble',
        typeDelay: 2,
    }
    mSubmitInput(event, message)
    mAddMessage(message, options)
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
    /* requires challengeSubmit */
    challengeInputText.addEventListener('keydown', event=>{
        if(event.key==='Enter')
            challengeSubmit.click()
    })
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
 * Fetches the greeting messages or start routine from the server.
 * @private
 * @requires mGlobals
 * @requires mPageType
 * @returns {Object} - Fetch response object: { input, messages, }
 */
async function mFetchStart(){
    const isSignedUp = await mGlobals.datamanager.signupStatus()
    !isSignedUp
        ? retract(signupSuccess)
        : mSignupSuccess()
    const messages = []
    let input // HTMLDivElement containing input element
    switch(mPageType){
        case 'about':
        case 'privacy-policy':
            break
        case 'challenge':
        case 'login':
        case 'select':
            if(mChallengeMemberId){
                await mAddMessage(`Please enter the passphrase for your account to continue...`, { typeDelay: 6, })
                mGlobals.addChatElement(mCreateChallengeElement())
                mGlobals.scrollBottom()
            } else
                messages.push(`I'm sorry, I can't find the member you're looking for...`)
            break
        default:
            messages.push(...await mGlobals.datamanager.greetings())
            break
    }
    return {
        input,
        messages,
    }
}
/**
 * Initializes event listeners.
 * @private
 * @returns {void}
 */
function mInitializeListeners(){
    const chatSubmit = document.getElementById('chat-submit')
    if(chatSubmit)
        chatSubmit.addEventListener('click', mAddUserMessage)
    signupButton.addEventListener('click', mSubmitSignup)
    signupEmailInputField.addEventListener('input', mUpdateFormState)
    signupHumanNameInput.addEventListener('input', mUpdateFormState)
}
/**
 * Determines page type and loads data.
 * @private
 * @returns {Message[]} - The response Message array.
 */
async function mLoadStart(){
    /* assign page div variables */
    awaitButton = document.getElementById('await-button')
    mainContent = mGlobals.mainContent
    navigation = mGlobals.navigation
    pageLoader = document.getElementById('page-loader')
    privacyContainer = document.getElementById('privacy-container')
    sidebar = mGlobals.sidebar
    signupButton = document.getElementById('signup-submit')
    signupEmailInputField = document.getElementById('email-input-text')
    signupErrorMessage = document.getElementById('signup-error-message')
    signupForm = document.getElementById('signup-form')
    signupHeader = document.getElementById('signup-header')
    signupHumanNameInput = document.getElementById('human-name-input-text')
    signupSuccess = document.getElementById('signup-success')
    signupTeaser = document.getElementById('signup-teaser')
    /* load page */
    mChallengeMemberId = new URLSearchParams(window.location.search).get('mbr')
    mPageType = new URLSearchParams(window.location.search).get('type')
        ?? window.location.pathname.split('/').pop()
    const startObject = await mFetchStart()
    return startObject
}
/**
 * Retrieves and runs the requested routine.
 * @param {string} routineName - The routine name to execute
 * @returns {Promise<void>}
 */
async function mRoutine(routineName){
    const { error, responses=[], routine: routineScript, success, } = await mGlobals.datamanager.routine(routineName)
    if(success && routineScript){
        const { events: _events, title, } = routineScript
        const events = _events
            .filter(event=>event?.dialog?.message?.length)
            .map(event=>{
                let message = event.dialog.message
                return message
            })
        mAddMessages(events, { bubbleClass: 'system-bubble', responseDelay: 6, typeDelay: 4, typewrite: true, })
    } else if(responses?.length)
        mAddMessages(responses, { responseDelay: 4, typeDelay: 1, typewrite: true, })
    else if(error.message)
        mAddMessage(error.message, { bubbleClass: 'system-bubble', typeDelay: 1, typewrite: true, })
}
/**
 * Leads interface through a shared memory.
 * @param {Guid} activeShareId - The share id to process
 * @returns {void}
 */
async function mShare(activeShareId){
    const awaitOriginalContent = awaitButton.textContent.trim()
    awaitButton.textContent = 'Retrieving scene from server...'
    show(awaitButton)
    const inputText = document.getElementById('share-input')?.value
    const { instructions, scene, } = await mGlobals.datamanager.share(activeShareId, inputText)
    if(instructions?.length){
        switch(instructions){
            case 'stopShare':
                const shareCancel = document.getElementById('share-cancel')
                console.log('stopShare', shareCancel)
                if(shareCancel)
                    shareCancel.click()
                else
                    mShareStop()
                return
            default:
                return
        }
    }
    if(scene?.length){
        await mAddMessage(scene, { bubbleClass: 'share-bubble', typeDelay: 4, typewrite: true, })
        mShareProgress(activeShareId)
        mGlobals.scrollBottom()
    }
    hide(awaitButton)
    awaitButton.textContent = awaitOriginalContent
}
function mShareProgress(activeShareId){
    /* share progress container */
    const shareProgress = document.createElement('div')
    shareProgress.className = 'share-progress'
    shareProgress.id = 'share-progress'
    /* share cancel */
    const shareProgressCancel = document.createElement('button')
    shareProgressCancel.className = 'share-cancel'
    shareProgressCancel.id = 'share-cancel'
    shareProgressCancel.innerHTML = 'Stop Memory'
    shareProgressCancel.addEventListener('click', _cancel)
    shareProgress.appendChild(shareProgressCancel)
    /* share input */
    const shareProgressText = document.createElement('textarea')
    shareProgressText.className = 'share-input'
    shareProgressText.id = 'share-input'
    shareProgressText.placeholder = 'Share thoughts or personal updates regarding this memory here...'
    shareProgressText.addEventListener('input', _=>{
        shareProgressText.style.height = 'auto'; // Reset height to calculate the new height
        shareProgressText.style.height = `${Math.min(shareProgressText.scrollHeight, 128)}px`; // 128px = 8rem
    })
    shareProgress.appendChild(shareProgressText)
    /* share next */
    const shareProgressNext = document.createElement('button')
    shareProgressNext.className = 'share-next'
    shareProgressNext.id = 'share-next'
    shareProgressNext.innerHTML = 'Next'
    shareProgressNext.addEventListener('click', _next)
    shareProgress.appendChild(shareProgressNext)
    mGlobals.addChatElement(shareProgress)
    shareProgressText.focus()
    /* share progress inline functions */
    function _cancel(){
        shareProgress.remove()
        console.log('_cancel', activeShareId)
        mShareStop(activeShareId)
    } 
    function _next(){
        hide(shareProgress)
        mShare(activeShareId)
        shareProgress.remove()
    }
}
async function mShareStart(activeShareId){
    const shareWelcome = mAddMessage('Congratulations! A <i>MyLife</i> Member has shared a memory with you!<br />Please wait while I load and interpret the memory', { // no await necessary
        bubbleClass: 'system-bubble',
        typeDelay: 10,
        typewrite: true,
    })
    const awaitOriginalContent = awaitButton.textContent.trim()
    awaitButton.textContent = 'Connecting with Member Avatar to retrieve memory...'
    show(awaitButton)
    const shareHeader = await mGlobals.datamanager.shareHeader(activeShareId)
    shareWelcome.remove()
    const title = `<i>Prepare to experience</i>:<br />&mdash; <b>${ shareHeader.title ?? 'A MyLife Shared Memory' }</b>`
    hide(awaitButton)
    awaitButton.textContent = awaitOriginalContent
    const shareTitle = await mAddMessage(title, { // no await necessary
        bubbleClass: 'share-bubble',
        typeDelay: 10,
        typewrite: true,
    })
    if(shareHeader.warnings?.length){
        const shareWarning = `Before we proceed, <i>MyLife</i> needs to notify you that the shared content contains the following warnings: <b>${ shareHeader.warnings }</b><br />&mdash; Please confirm that you are willing to continue, or cancel out now.`
        const triggerWarningBubble = await mAddMessage(shareWarning, { bubbleClass: 'warning-bubble', typeDelay: 4, typewrite: true, })
        /* trigger warnings */
        // @todo - move to response `input` node
        const triggerWarning = document.createElement('div')
        triggerWarning.className = 'warning-input'
        triggerWarning.id = 'warning-input'
        /* cancel button */
        const triggerWarningCancel = document.createElement('button')
        triggerWarningCancel.className = 'warning-cancel'
        triggerWarningCancel.id = 'warning-cancel'
        triggerWarningCancel.innerHTML = 'Cancel'
        triggerWarningCancel.addEventListener('click', _warningCancel, { once: true })
        triggerWarningCancel.addEventListener('keydown', event=>{
            if(event.key==='Escape')
                triggerWarningCancel.click()
        })
        triggerWarning.appendChild(triggerWarningCancel)
        /* continue button */
        const triggerWarningContinue = document.createElement('button')
        triggerWarningContinue.className = 'warning-continue'
        triggerWarningContinue.id = 'warning-continue'
        triggerWarningContinue.innerHTML = 'Continue'
        triggerWarningContinue.addEventListener('click', _warningContinue, { once: true })
        triggerWarningContinue.addEventListener('keydown', event=>{
            if(event.key==='Escape')
                triggerWarningCancel.click()
        })
        triggerWarning.appendChild(triggerWarningContinue)
        mGlobals.addChatElement(triggerWarning)
        /* trigger warning inline functions */
        async function _warningCancel(){
            _removeWarning()
            await mAddMessage(`I'm sorry about that! I'm still happy to share information about MyLife... just ask!`, {
                bubbleClass: 'system-bubble',
                typeDelay: 10,
                typewrite: true,
            })
            show(mGlobals.MemberChat)
        }
        async function _warningContinue(){
            _removeWarning(true)
            if(await mGlobals.datamanager.acceptShareWarnings(activeShareId))
                mShare(activeShareId)
        }
        function _removeWarning(warningOnly=false){
            triggerWarningBubble.remove()
            triggerWarning.remove()
            if(warningOnly)
                return
            shareWelcome.remove()
            shareTitle.remove()
        }
    } else
        mShare(activeShareId)
}
/**
 * Stops a shared memory. Upon local stop, the server is told to cease.
 * @param {Guid} activeShareId - The share id to process (optional)
 * @returns {void}
 */
function mShareStop(activeShareId){
    if(activeShareId)
        mGlobals.datamanager.shareStop(activeShareId)
    hide(awaitButton)
    console.log('mShareStop', activeShareId)
    show(mGlobals.MemberChat)
}
/**
 * Display the entire page.
 * @todo - refactor for special pages
 * @private
 * @returns {void}
 */
function mShowPage(hideChat=false){
    /* DOM elements */
    signupEmailInputField.tabIndex = 1
    signupHumanNameInput.tabIndex = 2
    /* assign listeners */
    mInitializeListeners()
    /* display elements */
    hide(pageLoader)
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
    if(hideChat)
        hide(mGlobals.MemberChat)
}
function mSignupSuccess(){
    retract(signupForm)
    retract(signupTeaser)
    show(signupSuccess)
    signupHeader.innerHTML = `Thank you for joining our pilot!`
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
	const validatePassphrase = await mGlobals.datamanager.submitPassphrase(passphrase, mChallengeMemberId)
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
 * Submits a message to the server.
 * @param {Event} event - The event object.
 * @param {string} message - The message to submit. 
 */
async function mSubmitInput(event, message){
    if(!message)
        return
    event.stopPropagation()
	event.preventDefault()
    hide(mGlobals.MemberChat)
    show(awaitButton)
    const chatData = {
        message,
        role: 'user',
    }
	const { responses, success, } = await mGlobals.datamanager.submitChat(chatData)
	responses.forEach(gptMessage=>{
		mAddMessage(gptMessage.message)
	})
    hide(awaitButton)
    mGlobals.chatInput = null
    mGlobals.toggleChatInput()
    show(mGlobals.MemberChat)
}
/**
 * Submits the signup form to the server.
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mSubmitSignup(event){
    const { value: email, } = signupEmailInputField
    const { value: humanName, } = signupHumanNameInput
    const formData = {
        avatarName: humanName,
        email,
        humanName,
        type: mSignupType,
    }
    const success = mGlobals.datamanager.signup(formData)
    if(success)
        mSignupSuccess()
    else {
        const signupInputContainer = document.getElementById('signup-input-container')
        if(signupInputContainer){
            const errorDiv = document.createElement('div')
            errorDiv.textContent = `Please review your inputs, system cannot process your request.`
            errorDiv.classList.add('error-message')
            signupInputContainer.prepend(errorDiv)
            errorDiv.addEventListener('animationend', _=>errorDiv.remove())
            setTimeout(_=>{
                errorDiv.classList.add('fade-out')
            }, 6000)
        }
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
        mGlobals.scrollBottom()
    }
    _typewrite()
}
/**
 * Updates the form input and button states based on the input fields.
 * @private
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mUpdateFormState(event){
    const { value: emailValue, } = signupEmailInputField
    const { value: humanNameValue, } = signupHumanNameInput
    signupButton.disabled = !(
           emailValue?.length > 5
        && humanNameValue.trim()?.length > 2
    )
}