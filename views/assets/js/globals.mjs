/* module constants */
const mDefaultHelpPlaceholderText = 'Help me, Q-bi Wan, Help me!'
const mHelpInitiatorContent = {
    experiences: `I'll do my best to assist with an "experiences" request. Please type in your question or issue below and click "Send" to get started.`,
    interface: `I'll do my best to assist with an "interface" request. Please type in your question or issue below and click "Send" to get started.`,
    membership: `I'll do my best to assist with a "membership" request. Please type in your question or issue below and click "Send" to get started.`,
    tutorial: `The tutorial is a great place to start! Click this button to launch or re-run the tutorial:`,
}
const mNewGuid = () => crypto.randomUUID()
/* module variables */
let mActiveHelpType, // active help type, currently entire HTMLDivElement
    mLoginButton,
    mLoginContainer,
    mChallengeInput,
    mChallengeError,
    mChallengeSubmit,
    mHelpAwait,
    mHelpClose,
    mHelpContainer,
    mHelpError,
    mHelpErrorClose,
    mHelpErrorText,
    mHelpHeader,
    mHelpInput,
    mHelpInputText,
    mHelpInputSubmit,
    mHelpRefresh,
    mHelpSystemChat,
    mHelpType,
    mLoaded = false,
    mLoginSelect,
    mMainContent,
    mNavigation,
    mNavigationHelp,
    mNavigationHelpIcon,
    mSidebar
/* class definitions */
class Globals {
    #uuid = mNewGuid()
    constructor(){
        if(!mLoaded){
            mLoginButton = document.getElementById('navigation-login-logout-button')
            mLoginContainer = document.getElementById('navigation-login-logout')
            mMainContent = document.getElementById('main-content')
            mChallengeInput = document.getElementById('member-challenge-input-text')
            mChallengeError = document.getElementById('member-challenge-error')
            mChallengeSubmit = document.getElementById('member-challenge-submit')
            mLoginSelect = document.getElementById('member-select')
            mHelpAwait = document.getElementById('help-await')
            mHelpClose = document.getElementById('help-close')
            mHelpContainer = document.getElementById('help-container')
            mHelpError = document.getElementById('help-error')
            mHelpErrorClose = document.getElementById('help-error-close')
            mHelpErrorText = document.getElementById('help-error-text')
            mHelpHeader = document.getElementById('help-header') /* container for help header */
            mHelpInput = document.getElementById('help-input') /* container for help user input */
            mHelpInputText = document.getElementById('help-input-text')
            mHelpInputSubmit = document.getElementById('help-input-submit')
            mHelpRefresh = document.getElementById('help-chat-refresh')
            mHelpSystemChat = document.getElementById('help-chat') /* container for help system chat */
            mHelpType = document.getElementById('help-type') // pseudo-navigation: membership, interface, experiences, etc.
            mNavigation = document.getElementById('navigation-container')
            mNavigationHelp = document.getElementById('navigation-help')
            mNavigationHelpIcon = document.getElementById('navigation-help-icon')
            mSidebar = document.getElementById('sidebar')
            this.init()
        }
    }
    init(){
        console.log('Globals::init()', this.#uuid)
        /* global visibility settings */
        this.hide(mHelpContainer)
        /* assign event listeners */
        if(mNavigationHelp){
            mHelpClose.addEventListener('click', mToggleHelp)
            mHelpInputSubmit.addEventListener('click', mSubmitHelp)
            mHelpInputText.addEventListener('input', mToggleHelpSubmit)
            mHelpRefresh.addEventListener('click', mChatRefresh)
            mHelpType.addEventListener('click', mSetHelpType)
            mNavigationHelpIcon.addEventListener('click', mToggleHelp)
            Array.from(mHelpType.children)?.[0]?.click() // default to first type
            mToggleHelpSubmit()
        }
        mLoginButton.addEventListener('click', this.loginLogout, { once: true })
        if(mChallengeInput){
            mChallengeInput.addEventListener('input', mToggleChallengeSubmit)
            mChallengeSubmit.addEventListener('click', mSubmitChallenge)
        }
        if(mLoginSelect)
            mLoginSelect.addEventListener('change', mSelectLoginId, { once: true })
    }
    /* public functions */
    /**
     * Clears an element of its contents, brute force currently via innerHTML.
     * @param {HTMLElement} element - The element to clear.
     * @returns {void}
     */
    clearElement(element){
        mClearElement(element)
    }
	/**
	 * Escapes HTML characters in a string.
	 * @param {string} text - The text to escape.
	 * @returns {string} - The escaped text.
	 */
	escapeHtml(text){
		const map = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		}
		const escapedText = text.replace(/[&<>"']/g, m=>(map[m]) )
		return escapedText
	}
    /**
     * Returns the avatar object if poplated by on-page EJS script.
     * @todo - refactor to api call
     * @returns {object} - The avatar object.
     */
    getAvatar(){
        const avatar = window?.mylifeAvatar
            ?? window?.mylifeAvatarData
            ?? window?.avatar
        return avatar
    }
    /**
     * Returns the handle of a given MyLife member composite string.
     * @param {string} str - String to get handle of.
     * @returns {string} - The handle of the string.
     */
    getHandle(str){
        if(typeof str !== 'string')
            return str
        return this.variableIze(str).split('|')[0]
    }
    /**
     * Returns the id of a given MyLife member composite string. **Note**: must return a guid
     * @param {string} str - String to get id of.
     * @returns {string|Guid} - The id of the string.
     */
    getId(str){
        try{
            return this.isGuid(this.variableIze(str).split('|').pop())
        } catch(e){
            return false
        }
    }
    /**
     * Hides an element, pre-executing any included callback function.
     * @public
     * @param {HTMLElement} element - The element to hide.
     * @param {function} callbackFunction - The callback function to execute after the element is hidden.
     * @returns {void}
     */
    hide(element, callbackFunction){
        mHide(element, callbackFunction)
    }
    /**
     * Determines whether the argument is a valid guid.
     * @param {string} str - String (or other) to check.
     * @returns {boolean} - Whether the argument is a valid guid.
     */
    isGuid(str){
        try{
            return str.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        } catch(e){
            return false
        }
    }
    loginLogout(event){
        const { target: loginButton, } = event
        if(loginButton!==mLoginButton)
            throw new Error('loginLogout::loginButton not found')
        if(loginButton.getAttribute('data-locked') === 'true')
            mLogin()
        else
            mLogout()
    }
    /**
     * Last stop before Showing an element and kicking off animation chain. Adds universal run-once animation-end listener, which may include optional callback functionality.
     * @public
     * @param {HTMLElement} element - The element to show.
     * @param {function} listenerFunction - The listener function, defaults to `mAnimationEnd`.
     * @returns {void}
     */
    show(element, listenerFunction){
        mShow(element, listenerFunction)
    }
    /**
     * Toggles the visibility of an element.
     * @param {HTMLElement} element - The element to toggle.
     * @returns {void}
     */
    toggleVisibility(element){
        const { classList, } = element
        mIsVisible(classList) ? mHide(element) : mShow(element)
    }
    /**
     * Variable-izes (for js) a given string.
     * @param {string} undashedString - String to variable-ize.
     * @returns {string} - The variable-ized string.
     */
    variableIze(undashedString=''){
        if(typeof undashedString !== 'string')
            return ''
        return undashedString.replace(/ /g, '-').toLowerCase()
    }
    /* getters/setters */
    get mainContent(){
        return mMainContent
    }
    get navigation(){
        return mNavigation
    }
    get navigationLogin(){
        return mLoginContainer
    }
    get navigationLoginButton(){
        return mLoginButton
    }
    get newGuid(){ 
        return mNewGuid()
    }
    get sidebar(){
        return mSidebar
    }
}
/* private functions */
/**
 * Adds a dialog bubble to the chat container.
 * @private
 * @param {HTMLElement} chatContainer - The chat container to add the bubble to.
 * @param {string} text - The text to add to the bubble.
 * @param {string} type - The type of bubble to add, enum: [user, member, agent].
 * @param {string} subType - The subtype of bubble to add; possibly `help`.
 * @returns {void}
 */
function mAddDialogBubble(chatContainer, text, type='agent', subType){
    const bubble = document.createElement('div')
    bubble.id = `chat-dialog-${ type }-${ mNewGuid() }`
    bubble.classList.add('chat-bubble', `${ type }-bubble`)
    bubble.innerHTML = text
    if(subType)
        bubble.classList.add(`${ subType }-bubble`)
    chatContainer.appendChild(bubble)
}
/**
 * Adds a popup dialog to the chat container.
 * @private
 * @param {HTMLElement} popupChat - The chat element to attach dialog to.
 * @param {string} content - The content to populate the dialog with.
 * @param {string} type - The type of dialog to create.
 * @returns {void}
 */
function mAddPopupDialog(popupChat, content, type){
    const dialog = mCreatePopupDialog(popupChat, content, type)
    mShow(dialog)
}
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
 * Refreshes Help Chat.
 * @todo - remove hack
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mChatRefresh(event){
    const reattachRefresh = mHelpRefresh // @stub - hack
    mClearElement(mHelpSystemChat)
    mHelpSystemChat.appendChild(reattachRefresh)
}
/**
 * Clears an element of its contents, brute force currently via innerHTML.
 * @private
 * @param {HTMLElement} element - The element to clear.
 * @returns {void}
 */
function mClearElement(element){
    element.innerHTML = ''
}
/**
 * Creates the shell for a help initiator dialog lane and dialog box. Help initiator dialogs are the first step in the help process, where the dialog area is co-opted for local population.
 * @param {HTMLDivElement} popupChat - The chat element to attach dialog to.
 * @param {string} type - The type of help initiator dialog to create.
 * @returns {HTMLDivElement} - The dialog element.
 */
function mCreateHelpInitiatorDialog(popupChat, type){
    console.log('mCreateHelpInitiatorDialog', mActiveHelpType.id.split('-').pop())
    const dialog = document.createElement('div')
    dialog.classList.add('popup-dialog', 'help-initiator-dialog', `help-initiator-dialog-${ type }`)
    dialog.id = `help-initiator`
    const dialogBox = document.createElement('div')
    dialogBox.classList.add('popup-dialog-box', 'help-initiator-dialog-box', `help-initiator-dialog-box-${ type }`)
    dialogBox.id = `help-initiator-dialog-box`
    dialog.appendChild(dialogBox)
    popupChat.appendChild(dialog)
    return dialog
}
/**
 * Creates a popup dialog based on type and attaches to popup chat element.
 * @requires mActiveHelpType
 * @param {HTMLDivElement} popupChat - The chat element to attach dialog to.
 * @param {string} content - The content to populate the dialog with.
 * @param {string} type - The type of dialog to create.
 * @returns 
 */
function mCreatePopupDialog(popupChat, content, type){
    let dialog
    switch(type){
        case 'help-initiator':
            if(!mActiveHelpType)
                throw new Error('mCreatePopupDialog::mActiveHelpType not set')
            // run animation on transition, since stays in same bubble
            const { id, } = mActiveHelpType
            const activeType = id.split('-').pop()
            dialog = document.getElementById(type)
                ?? mCreateHelpInitiatorDialog(popupChat, activeType)
            const dialogBox = dialog.querySelector('#help-initiator-dialog-box')
            dialogBox.innerHTML = mGetHelpInitiatorContent(activeType)
            /* @stub - animations
            if(dialogBox.style.animation){
                dialogBox.style.animation = 'helpInitiatorFade 2s ease-in-out reverse forwards'
                dialogBox.addEventListener('animationend', function(){
                    dialogBox.innerHTML = mGetHelpInitiatorContent(activeType)
                    dialogBox.style.animation = 'helpInitiatorFade 2s ease-in-out forwards'
                }, { once: true })
            } else {
                dialogBox.style.animation = 'helpInitiatorFade 2s ease-in-out forwards'
                dialogBox.innerHTML = mGetHelpInitiatorContent(activeType)
            } */
            switch(activeType){
                case 'membership':
                    break
                case 'tutorial':
                    const tutorialLauncher = mCreateTutorialLauncher()
                    dialogBox.appendChild(tutorialLauncher)
                    break
                case 'experiences':
                case 'interface':
                default:
                    break
            }
            break
        case 'user':
            break
        case 'agent':
        case 'general':
        default:
            dialog = document.createElement('div')
            dialog.id = `popup-dialog-${ type }-${ mNewGuid() }`
            dialog.classList.add(`popup-dialog`, `${ type }-dialog`)
            dialog.innerHTML = content
            popupChat.appendChild(dialog)
            break
    }
    return dialog
}
/**
 * Creates a tutorial launcher button.
 * @returns {HTMLDivElement} - The tutorial launcher button.
 */
function mCreateTutorialLauncher(){
    const tutorialLauncher = document.createElement('div')
    tutorialLauncher.classList.add('tutorial-launcher', 'help-button', 'help-button-tutorial')
    tutorialLauncher.innerHTML = 'Launch Tutorial'
    tutorialLauncher.addEventListener('click', mLaunchTutorial, { once: true })
    return tutorialLauncher
}
/**
 * Returns help content appropriate to indicated `type`.
 * @requires mHelpInitiatorContent
 * @param {string} type - The type of help content to return.
 * @returns {string} - The help content.
 */
function mGetHelpInitiatorContent(type){
    return mHelpInitiatorContent?.[type]
        ?? `I'll do my best to assist with a "${ type }" request. Please type in your question or issue below and click "Send" to get started.`
}
/**
 * Hides an element, pre-executing any included callback function.
 * @private
 * @param {HTMLElement} element - The element to hide.
 * @param {function} callbackFunction - The callback function to execute after the element is hidden.
 * @returns {void}
 */
function mHide(element, callbackFunction){
    if(!element)
        return
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
/**
 * Determines whether an element is visible. Does not allow for any callbackFunctions
 * @private
 * @param {Object[]} classList - list of classes to check: `element.classList`.
 * @returns {boolean} - Whether the element is visible.
 */
function mIsVisible(classList){
    return classList.contains('show')
}
/**
 * Launches the tutorial.
 * @todo - remove hard-coded experience id
 * @private
 * @returns {void}
 */
function mLaunchTutorial(){
    let event = new CustomEvent('launchExperience', { detail: '88043968-d7ef-4a57-a923-335bc9f92792', })
    window.dispatchEvent(event)
    mHelpClose.click()
//    mHide(mHelpContainer)
}
/**
 * Redirects to the login page.
 * @private
 * @returns {void}
 */
function mLogin(){
    console.log('login')
    window.location.href = '/select'
}
/**
 * Logs out the current user and redirects to homepage.
 * @private
 * @async
 * @returns {void}
 */
async function mLogout(){
    const response = await fetch('/logout', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })
    if(response.ok)
        window.location.href = '/'
    else
        console.error('mLogout::response not ok', response)
}
/**
 * Redirects to the login page with a selected member id.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mSelectLoginId(event){
    event.preventDefault()
    console.log('mSelectLoginId', mLoginSelect)
    const { value, } = mLoginSelect
    if(!value?.length)
        return
    window.location = `/login/${value}`
}
/**
 * Sets the type of help required by member.
 * @todo - incorporate multiple help strata before llm access; here local
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mSetHelpType(event){
    const { currentTarget, target, } = event
    if(currentTarget===target || mActiveHelpType===target) // clicked gap between buttons
        return
    mActiveHelpType = target
    Array.from(this.children)
        .forEach(child=>{
            if(child!==mActiveHelpType){
                child.classList.remove('active')
                child.classList.add('inactive')
            } else {
                mActiveHelpType.classList.remove('inactive')
                mActiveHelpType.classList.add('active', 'help-type-active')
            }
        })
    /* populate dumb-initiator dialog in chat */
    mAddPopupDialog(mHelpSystemChat, 'content, son', 'help-initiator')
}
/**
 * Last stop before Showing an element and kicking off animation chain. Adds universal run-once animation-end listener, which may include optional callback functionality.
 * @public
 * @param {HTMLElement} element - The element to show.
 * @param {function} listenerFunction - The listener function, defaults to `mAnimationEnd`.
 * @returns {void}
 */
function mShow(element, listenerFunction){
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
/**
 * Submits a challenge response to the server.
 * @module
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mSubmitChallenge(event){
	event.preventDefault()
    event.stopPropagation()
    const { id, value: passphrase, } = mChallengeInput
    if(!passphrase.trim().length)
        return
    mHide(mChallengeSubmit)
	const _mbr_id = window.location.pathname.split('/')[window.location.pathname.split('/').length-1]
	const url = window.location.origin+`/challenge/${_mbr_id}`
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ passphrase, }),
	}
	const validatePassphrase = await mSubmitPassphrase(url, options)
	if(validatePassphrase)
        location.href = '/members'
    else {
        mChallengeError.innerHTML = 'Invalid passphrase: please try again and remember that passphrases are case sensitive.';
        mChallengeInput.value = null
        mChallengeInput.placeholder = 'Try your passphrase again...'
        mChallengeInput.focus()
    }
}
/**
 * Submits a help request to the server.
 * @module
 * @requires mActiveHelpType
 * @requires mHelpAwait
 * @requires mHelpError
 * @requires mHelpInput
 * @requires mHelpInputSubmit
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mSubmitHelp(event){
    const { value, } = mHelpInputText
    const { id, } = mActiveHelpType
    if(!value?.length || !id)
        throw new Error('mSubmitHelp()::value and active help type required')
    const type = id.split('-').pop()
    /* display await */
    mHide(mHelpInput)
    mShow(mHelpAwait)
    /* user-bubble */
    mAddDialogBubble(mHelpSystemChat, value, 'user', `help`)
    /* server-request */
    let response
    try{
        response = await mSubmitHelpToServer(value, type)
    } catch(error){
        console.log('mSubmitHelp()::error', error)
        mHelpErrorText.innerHTML = `There was an error submitting your help request.<br />${error.message}`
        mHelpErrorClose.addEventListener('click', ()=>mHide(mHelpError), { once: true })
        response = {
            message: `I'm sorry, I had trouble processing your request. The error message I received was: "${ error.message }." Please try again.`,
        }
        mShow(mHelpError)
    }
    /* display input */
    response = response?.message ?? response ?? `I'm sorry, I had trouble processing your request. Please try again.`
    mAddDialogBubble(mHelpSystemChat, response, 'agent', `help`)
    mHelpInputText.value = null
    mHelpInputText.placeholder = mDefaultHelpPlaceholderText
    mToggleHelpSubmit()
    mHide(mHelpAwait)
    mShow(mHelpInput)
    mHelpInputText.focus()
}
/**
 * 
 * @param {string} helpRequest - The help request to submit.
 * @param {string} type - The type of help request.
 * @param {string} mbr_id - The member id of the requestor.
 * @returns {object} - The message response from the server.
 */
async function mSubmitHelpToServer(helpRequest, type='general', mbr_id){
    if(!helpRequest.trim().length)
        throw new Error('mSubmitHelpToServer::helpRequest required')
    const response = await fetch('/help', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            helpRequest,
            type,
            mbr_id,
        }),
    })
    const jsonResponse = await response.json()
    if(response.ok)
        return jsonResponse
    else
        throw new Error(jsonResponse?.message ?? 'unknown server error')
}
/**
 * Submits a passphrase to the server.
 * @param {string} url - The url to submit the passphrase to.
 * @param {object} options - The options for the fetch request.
 * @returns {object} - The response from the server.
 */
async function mSubmitPassphrase(url, options) {
	try {
		const response = await fetch(url, options)
		const jsonResponse = await response.json()
		return jsonResponse
	} catch (err) {
		console.log('fatal error', err)
		return false
	}
}
/**
 * Toggles the visibility of the challenge submit button based on `input` event.
 * @requires mChallengeSubmit
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mToggleChallengeSubmit(event){
    const { value, } = event.target
    if(value.trim().length){
        mChallengeSubmit.disabled = false
        mChallengeSubmit.style.cursor = 'pointer'
        mShow(mChallengeSubmit)
    } else {
        mChallengeSubmit.disabled = true
        mChallengeSubmit.style.cursor = 'not-allowed'
    }
}
/**
 * Toggles the visibility of the help container based on `click` event.
 * @requires mHelpContainer
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mToggleHelp(event){
    const { classList, } = mHelpContainer
    mIsVisible(classList) ? mHide(mHelpContainer) : mShow(mHelpContainer)
}
/**
 * Toggles the visibility of the help submit button based on `input` event.
 * @module
 * @requires mHelpInputText
 * @requires mHelpInputSubmit
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mToggleHelpSubmit(event){
    const { value, } = mHelpInputText /* onClick = this, but this function is called independently at startup */
    mHelpInputSubmit.disabled = !value?.length ?? true
    if(mHelpInputSubmit.disabled)
        mHide(mHelpInputSubmit)
    else
        mShow(mHelpInputSubmit)
}
/* export */
export default Globals