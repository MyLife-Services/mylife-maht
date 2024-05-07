/* imports */
let mLoginButton,
    mLoginContainer,
    mChallengeInput,
    mChallengeError,
    mChallengeSubmit,
    mHelpContainer,
    mHelpHeader,
    mHelpInput,
    mHelpSystemChat,
    mHelpType,
    mLoginSelect,
    mMainContent,
    mNavigation,
    mNavigationHelp,
    mSidebar
/* class definitions */
class Globals {
    constructor(){
        mLoginButton = document.getElementById('navigation-login-logout-button')
        mLoginContainer = document.getElementById('navigation-login-logout')
        mMainContent = document.getElementById('main-content')
        mChallengeInput = document.getElementById('member-challenge-input-text')
        mChallengeError = document.getElementById('member-challenge-error')
        mChallengeSubmit = document.getElementById('member-challenge-submit')
        mLoginSelect = document.getElementById('member-select')
        mHelpContainer = document.getElementById('help-container')
        mHelpHeader = document.getElementById('help-header') /* container for help header */
        mHelpInput = document.getElementById('help-input') /* container for help user input */
        mHelpSystemChat = document.getElementById('help-chat') /* container for help system chat */
        mHelpType = document.getElementById('help-type') // pseudo-navigation: membership, interface, experiences, etc.
        mNavigation = document.getElementById('navigation-container')
        mNavigationHelp = document.getElementById('navigation-help')
        mSidebar = document.getElementById('sidebar')
        /* assign event listeners */
        mNavigationHelp.addEventListener('click', mToggleHelp)
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
    get sidebar(){
        return mSidebar
    }
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
function mLogin(){
    console.log('login')
    window.location.href = '/select'
}
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
 * @public
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
 * 
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
/* export */
export default Globals
/*
getHandle
getId
hide
isGuid
show
variableIze
*/