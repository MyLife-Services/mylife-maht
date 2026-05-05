/* imports */
import Globals from './globals.mjs'
/* precursor constants */
const mGlobals = new Globals()
/* constants */
const hide = mGlobals.hide
const retract = mGlobals.retract
const show = mGlobals.show
/* variables */
let mAwaitingResponse = false,
    mAwaitingResponseId = 0,
    mAvatarIcon='Q.png',
    mChallengeMemberId,
    mChatBubbleCount = 0,
    mDefaultPauseDelay = 5, // in seconds
    mDefaultTypeDelay = 10,
    mIconDirectory= 'png/',
    mInitialBotId='',
    mMissionId,
    mPageType = null,
    mPersonalAvatarIcon='dandelion-thumb.png',
    mRecognition,
    mRecognizingSpeech = false,
    mSignupType = 'newsletter',
    mIgnoreEnd = true
/* page div variables */
let challengeError,
    challengeInput,
    challengeInputText,
    challengeSubmit,
    disclaimerButton,
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
    signupHumanNameInput,
    signupSuccess
/* page load */
document.addEventListener('DOMContentLoaded', async event=>{
    /* load data */
    let activeShare=false,
        activeShareId=new URLSearchParams(window.location.search).get('sid'),
        hideChat=false
    let { input, messages, } = await mLoadStart(mInitialBotId)
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
        await mAddMessages(messages, 'agent')
        if(input)
            mGlobals.addChatElement(input)
    /* execute Share */
    if(activeShare)
        mShareStart(activeShareId)
}, { once: true })
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
 * @param {String} message - The message to add to the chat column
 * @param {String} role - The role of the originator of the message
 * @param {Number} typeDelay - The delay between typing each character
 * @param {Function} callback - The callback function to execute after the message is added
 * @returns {Promise<HTMLElement>} - The chat message element
 */
async function mAddMessage(message, role='agent', typeDelay=mDefaultTypeDelay, callback){
    const isSynthetic = !['chat', 'guest', 'member', 'user', 'visitor'].includes(role)
    /* message container */
    const chatMessage = document.createElement('div')
    chatMessage.classList.add('chat-message')
    if(!isSynthetic)
        chatMessage.classList.add('chat-message-organic') // use reverse-flex for organic
    else
        chatMessage.classList.add(`chat-message-${ role }`)
    chatMessage.id = `chat-message-${ mChatBubbleCount }`
    chatMessage.name = 'chat-message'
    /* message thumbnail */
    const messageThumb = document.createElement('img')
    messageThumb.id = `message-thumb-${ mChatBubbleCount }`
    switch(role){
        case 'share':
        case 'system':
        case 'warning':
            messageThumb.src = 'png/Q.png'
            messageThumb.alt = `Q, MyLife's Corporate Intelligence`
            messageThumb.title = `Hi, I'm Q, MyLife's Corporate Synthetic Intelligence. I am designed to help you better understand MyLife's organization, membership, services and vision.`        
            break
        case 'agent':
            messageThumb.src = 'png/Q-alt.png'
            messageThumb.alt = `Q, MyLife's Corporate Intelligence`
            messageThumb.title = `Hi, I'm Q, MyLife's Corporate Synthetic Intelligence. I am designed to help you better understand MyLife's organization, membership, services and vision.`        
            break
        default:
            messageThumb.classList.add('chat-message-thumb-small')
            messageThumb.src = `${ mIconDirectory }${ mPersonalAvatarIcon }`
            messageThumb.alt = `Default Individual Avatar`
            messageThumb.title = `I represent the individual speaking or typing.`
            break
    }
    chatMessage.appendChild(messageThumb)
    /* message bubble */
	const chatBubble = document.createElement('div')
	chatBubble.classList.add('chat-message-text')
    chatBubble.id = `chat-message-${ mChatBubbleCount }`
    chatBubble.name = 'chat-message'
    chatMessage.appendChild(chatBubble)
    mChatBubbleCount++
    /* append chat message */
    mGlobals.addChatElement(chatMessage)
    if(!message.startsWith('<section>')) // fixes issues with inline flex blocks; ex. <b>...</b>
        message = `<section>${message}</section>`
    await mTypeMessage(chatBubble, message, typeDelay, callback)
    return chatMessage
}
/**
 * Adds multiple messages to the chat column.
 * @private
 * @param {Message[]} messages - The messages to add to the chat column
 * @param {String} role - The role of the originator of the message
 * @param {Number} typeDelay - The delay between typing each character
 * @param {Number} pause - The delay between each message
 * @returns {Promise<HTMLElement[]>} - The chat message elements
 */
async function mAddMessages(messages, role, typeDelay=mDefaultTypeDelay, pause=5) {
    const chatMessages = []
    for(let i = 0; i < messages.length; i++){
        const message = messages[i]?.message ?? messages[i]
        await new Promise(async resolve=>{
            const chatMessage = await mAddMessage(message, role, typeDelay)
            chatMessages.push(chatMessage)
            if (i===messages.length - 1) {
                resolve()
            } else {
                let timerId = setTimeout(resolve, pause * 1000)
                async function advance() {
                    clearTimeout(timerId)
                    resolve()
                }
                document.addEventListener('click', advance, { once: true })
            }
        });
    }
    return chatMessages
}
/**
 * Add `user` type message to the chat column.
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mAddUserMessage(event){
    event.preventDefault()
    const userMessage = mGlobals.chatInput
    if(!userMessage.length || mAwaitingResponse)
        return
    const message = mGlobals.escapeHtml(userMessage) // Escape the user message
    mAddMessage(message, 'member', 2)
    await mSubmitInput(event, message)
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
 * @param {string} activeBotId - The active bot id (uuid) to fetch the start routine for (optional)
 * @returns {Object} - Fetch response object: { input, messages, }
 */
async function mFetchStart(activeBotId){
    const isSignedUp = await mGlobals.datamanager.signupStatus()
    let missions
    if(mGlobals.isGuid(mMissionId))
        missions = await mGlobals.datamanager.availableMissions()
    !isSignedUp
        ? hide(signupSuccess)
        : mSignupSuccess()
    const messages = []
    let input // HTMLDivElement containing input element
    switch(mPageType){
        case 'about':
        case 'privacy-policy':
            break
        case 'challenge':
        case 'login':
        case 'select': {
            if(mChallengeMemberId){
                await mAddMessage(`Please enter the passphrase for your account to continue...`, 'system', 6)
                mGlobals.addChatElement(mCreateChallengeElement())
                mGlobals.scrollBottom()
            } else
                messages.push(`I'm sorry, I can't find the member you're looking for...`)
            break
        }
        default: {
            const initialResponses = (await mGlobals.datamanager.botActivate(activeBotId, true))?.responses
                ?? await mGlobals.datamanager.greetings()
                ?? [{
                        agent: 'avatar',
                        message: `Hello, I am <b>Q</b>, AI-Agent and corporate intelligence for the nonprofit member organization <b>MyLife</b>. <em>It looks like we may have encountered some error on startup, please try refreshing the page or coming back later.</em>`,
                        type: 'error',
                    }]
            messages.push(...initialResponses)
            break
        }
    }
    return {
        input,
        messages,
        missions,
    }
}
/**
 * Initializes event listeners.
 * @private
 * @returns {void}
 */
function mInitializeListeners(){
    document.addEventListener('keydown', e=>{
        if(e.key === 'Escape' && !mAwaitingResponse){
            console.log('mAwaitingRespons::listener', mAwaitingResponse)
            mAwaitingResponseId++ // orphans any in-flight submit
            mGlobals.toggleChatInput()
        }
    })
    document.getElementById('chat-input-submit')?.addEventListener('click', mAddUserMessage)
    disclaimerButton?.addEventListener('click', mDisclaimer, { once: true })
    signupButton?.addEventListener('click', mSubmitSignup)
    signupEmailInputField?.addEventListener('input', mUpdateFormState)
    signupHumanNameInput?.addEventListener('input', mUpdateFormState)
}
/**
 * Determines page type and loads data.
 * @private
 * @requires mGlobals
 * @param {string} activeBotId - The active bot id (uuid) to fetch the start routine for (optional)
 * @returns {Message[]} - The response Message array.
 */
async function mLoadStart(activeBotId){
    /* assign page div variables */
    disclaimerButton = document.getElementById('disclaimer')
    mainContent = mGlobals.mainContent
    if(!mainContent)
        throw new Error('mLoadStart: mainContent element not found')
    navigation = mGlobals.navigation
    pageLoader = document.getElementById('page-loader')
    privacyContainer = document.getElementById('privacy-container')
    sidebar = mGlobals.sidebar
    signupButton = document.getElementById('signup-submit')
    signupEmailInputField = document.getElementById('input-email')
    signupErrorMessage = document.getElementById('signup-error-message')
    signupForm = document.getElementById('signup-join')
    signupHumanNameInput = document.getElementById('input-name')
    signupSuccess = document.getElementById('signup-success')
    /* load page */
    if(signupButton)
        signupButton.disabled = true
    mChallengeMemberId = new URLSearchParams(window.location.search).get('mbr')
    mMissionId = new URLSearchParams(window.location.search).get('mid')
    mPageType = new URLSearchParams(window.location.search).get('type')
        ?? window.location.pathname.split('/').pop()
    const startObject = await mFetchStart(activeBotId)
    return startObject
}
/**
 * Retrieves and runs the requested routine.
 * @param {string} routineName - The routine name to execute
 * @returns {Promise<void>}
 */
async function mRoutine(routineName, awaitText='Awaiting response...'){
    hide(mGlobals.MemberChat)
    const awaitButton = mGlobals.await(awaitText)
    mGlobals.addChatElement(awaitButton)
    const generation = ++mAwaitingResponseId
    let inProcess = false
    console.log('mRoutine', mAwaitingResponse)
    if(mAwaitingResponse)
        inProcess = true
    mAwaitingResponse = true
    const { error, responses=[], routine: routineScript, success, } = await mGlobals.datamanager.routine(routineName)
    if(!inProcess)
        mAwaitingResponse = false
    mGlobals.expunge(awaitButton)
    if(success && routineScript){
        const { events: _events, pause, title, typeSpeed, } = routineScript
        const events = _events
            .filter(event=>event?.dialog?.message?.length)
            .map(event=>{
                let message = event.dialog.message
                return message
            })
        await mAddMessages(events, 'agent', typeSpeed, pause)
    } else if(responses?.length)
        await mAddMessages(responses, 'system', typeSpeed, pause)
    else if(error.message)
        await mAddMessage(error.message, 'error', 1)
    if(!mAwaitingResponse && generation===mAwaitingResponseId)
        mGlobals.toggleChatInput(true, false)
    console.log(`${ routineName } routine completed`)
}
/**
 * Leads interface through a shared memory.
 * @param {Guid} activeShareId - The share id to process
 * @returns {void}
 */
async function mShare(activeShareId){
    const awaitButton = mGlobals.await('Retrieving scene from server...')
    mGlobals.addChatElement(awaitButton)
    const inputText = document.getElementById('share-input')?.value
    const { instructions, scene, } = await mGlobals.datamanager.share(activeShareId, inputText)
    if(instructions?.length){
        switch(instructions){
            case 'stopShare':
                const shareCancel = document.getElementById('share-cancel')
                if(shareCancel)
                    shareCancel.click()
                else
                    await mShareStop(activeShareId)
                return
            default:
                return
        }
    }
    if(scene?.length){
        await mAddMessage(scene, 'share', 4)
        mShareProgress(activeShareId)
        mGlobals.scrollBottom()
    }
    mGlobals.expunge(awaitButton)
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
        mShareStop(activeShareId)
    } 
    function _next(){
        hide(shareProgress)
        mShare(activeShareId)
        shareProgress.remove()
    }
}
async function mShareStart(activeShareId){
    const shareWelcomeText = 'Congratulations! A <i>MyLife</i> Member has shared a memory with you!<br />Please wait while I load and interpret the memory'
    const shareWelcome = await mAddMessage(shareWelcomeText, 'system')
    const awaitButton = mGlobals.await('Connecting with Member Avatar to retrieve memory...')
    mGlobals.addChatElement(awaitButton)
    const shareHeader = await mGlobals.datamanager.shareHeader(activeShareId)
    shareWelcome.remove()
    const title = `<i>Prepare to experience</i>:<br />&mdash; <b>${ shareHeader.title ?? 'A MyLife Shared Memory' }</b>`
    mGlobals.expunge(awaitButton)
    const shareTitle = await mAddMessage(title, 'share')
    if(shareHeader.warnings?.length){
        const shareWarning = `Before we proceed, <i>MyLife</i> needs to notify you that the shared content contains the following warnings: <b>${ shareHeader.warnings }</b><br />&mdash; Please confirm that you are willing to continue, or cancel out now.`
        const triggerWarningBubble = await mAddMessage(shareWarning, 'warning', 4)
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
            const shareCancelText = `I'm sorry, but I cannot proceed with the shared memory at this time.`
            await mAddMessage(shareCancelText, 'system')
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
async function mShareStop(activeShareId){
    if(activeShareId){
        const response = await mGlobals.datamanager.shareStop(activeShareId)
        if(response?.responses?.length)
            await mAddMessage(response.responses, 'agent')
    }
    const awaitButton = document.getElementById('await-button')
    if(awaitButton)
        mGlobals.expunge(awaitButton)
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
    if(signupEmailInputField)
        signupEmailInputField.tabIndex = 1
    if(signupHumanNameInput)
        signupHumanNameInput.tabIndex = 2
    /* assign listeners */
    mInitializeListeners()
    /* display elements */
    hide(pageLoader)
    show(navigation)
    show(mainContent)
    show(sidebar)
    if(hideChat)
        hide(mGlobals.MemberChat)
}
function mSignupSuccess(){
    retract(signupForm)
    show(signupSuccess)
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
    if(!message || mAwaitingResponse)
        return
    event.stopPropagation()
	event.preventDefault()
    const generation = ++mAwaitingResponseId
    mGlobals.toggleChatInput(false, false)
    const awaitButton = mGlobals.await('Connecting with MyLife...')
    mGlobals.addChatElement(awaitButton)
    const chatData = {
        message,
        role: 'user',
    }
    mAwaitingResponse = true
	const { error, responses, success, } = await mGlobals.datamanager.submitChat(chatData)
    mAwaitingResponse = false
    mGlobals.expunge(awaitButton)
    await mAddMessages(error ? [error] : responses, 'agent', 2)
    if(generation===mAwaitingResponseId)
        mGlobals.toggleChatInput()
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
    const success = mGlobals.datamanager.submitSignup(formData)
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
 * @param {HTMLDivElement} chatBubble - The chat bubble element
 * @param {string} message - The message to type
 * @param {number} typeDelay - The delay between typing each character
 * @returns {Promise<void>} - allows await for typing to finish before proceeding
 */
function mTypeMessage(chatBubble, message, typeDelay=mDefaultTypeDelay, callback){
    return new Promise(resolve=>{
        let i = 0
        let tempMessage = ''
        function _typewrite() {
            if(i <= message.length ?? 0){
                tempMessage += message.charAt(i)
                chatBubble.innerHTML = ''
                chatBubble.insertAdjacentHTML('beforeend', tempMessage)
                i++
                setTimeout(_typewrite, typeDelay)
            } else {
                chatBubble.setAttribute('status', 'done')
                if(callback)
                    callback()
                resolve()
            }
            mGlobals.scrollBottom()
        }
        _typewrite()
    })
}
/**
 * Updates the form input and button states based on the input fields.
 * @private
 * @returns {void}
 */
function mUpdateFormState(){
    const { value: emailValue, } = signupEmailInputField
    const { value: humanNameValue, } = signupHumanNameInput
    signupButton.disabled = !(
           emailValue?.length > 5
        && humanNameValue.trim()?.length > 2
    )
}
