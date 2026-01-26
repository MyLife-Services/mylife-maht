/* module constants */
const mAudioNotRecording = `<div>Click or Tap on <b>Microphone</b> to start recording</div>`
const mAudioRecording = `<div><b>I am listening!</b><br />To <span style="color: indianred;"><b>STOP</b></span>, click the <b>Microphone</b> again, or <em><u>after a pause</u></em> say <em>DONE</em> or <em>SEND</em> to send directly to <b>Q</b></div>`
const mDefaultHelpPlaceholderText = 'Help me, C4-PAC, I\'m confused!'
const mHelpInitiatorContent = {
    experiences: `I'll do my best to assist with an "experiences" request. Please type in your question or issue below and click "Send" to get started.`,
    interface: `I'll do my best to assist with an "interface" request. Please type in your question or issue below and click "Send" to get started.`,
    membership: `I'll do my best to assist with a "membership" request. Please type in your question or issue below and click "Send" to get started.`,
    tutorial: `The tutorial is a great place to start! Click this button to launch or re-run the tutorial:`,
}
const mNewGuid = ()=>crypto.randomUUID()
/* module variables */
let mActiveHelpType, // active help type, currently entire HTMLDivElement
    mChatAudioIcon,
    mChatAudioPopup,
    mAvatarName,
    mChatContainer,
    mChatInputContainer,
    mChatInputField,
    mChatSubmit,
    mChatSystem,
    mDatamanager,
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
    mLogoutButton,
    mMainContent,
    mNavigation,
    mNavigationHamburger,
    mNavigationHelp,
    mNavigationHelpIcon,
    mPage,
    mPlaceholder,
    mRecognition,
    mRecognizingSpeech = false,
    mSidebar,
    mSynthesis
/* class definitions */
class Datamanager {
    #url
    /**
     * Creates a new Datamanager.
     * @param {String} type - The type of user, defaults to 'visitor'
     * @param {String} url - The base URL, defaults to window.location.origin
     */
    constructor(type='visitor', url=window.location.origin){
        this.#url = url
        switch(type){
            case 'member':
                this.#url += '/member'
                break
            case 'visitor':
            default:
                break
        }
    }
    /* private functions */
    async #fetch(url='', options){
        let response
        try {
            url = url.startsWith('/')
                ? url
                : `/${url}`
            url = this.#url + url
            response = await fetch(url, options)
            if(response.status>=400 && response.status < 500)
                window.location.href = response?.redirectUrl
                    ?? '/'
            else
                response = await response.json()
        } catch(e) {
            const errorMessage = e.message
            response = {
                error: errorMessage,
                message: errorMessage,
                success: false
            }
        }
        return response
    }
    /* public functions */
    async acceptShareWarnings(shareId){
        const url = `/share/accept/${ shareId }`
        const options = {
            method: 'PATCH',
        }
        const response = await this.#fetch(url, options)
        return response
    }
    async alerts(){
        const url = `alerts`
        const responses = await this.#fetch(url)
        responses.forEach(response=>mAlertCreate(response))
        return responses
    }
    async availableMissions(){
        const url = `/alphadog/missions/available`
        const responses = await this.#fetch(url)
        return responses
    }
    async botActivate(botId){
        const url = `/members/bots/activate/${ botId }`
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * Request bot be created on server.
     * @requires mActiveTeam
     * @param {string} type - bot type
     * @returns {object} - Bot object from server.
     */
    botCreate(botData){
        const url = `/members/bots/create`
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(botData)
        }
        const response = this.#fetch(url, options)
        return response
    }
    async botRetire(bot_id){
        const url = `/members/bots/${ bot_id }`
        const options = {
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'DELETE',
        }
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * Fetch bots from server, used primarily for initialization of page, though could be requested on-demand.
     * @public
     * @returns {Promise<Object>} - The bot array object wrapper
     */
    async bots(){
        const url = `/members/bots`
        const response = await this.#fetch(url)
        return response
    }
    /**
     * Updates Bot data on server.
     * @param {Object} bot - bot object
     * @returns {object} - response from server
     */
    async botUpdate(botData){
        const { id, } = botData
        const url = `/members/bots/${ id }`
        const method = id?.length
            ? 'PUT' // update
            : 'POST' // create
        const options = {
            body: JSON.stringify(botData),
            headers: {
                'Content-Type': 'application/json'
            },
            method: method,
        }
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * Request bot version update.
     * @param {Guid} bot_id - The bot id to update
     * @returns {object} - Response from server { bot, success, }
     */
    async botVersion(bot_id){
        const url = `/members/bots/version/${ bot_id }`
        const options = {
            method: 'PUT',
        }
        const response = await this.#fetch(url, options)
        return response
    }
    async chatRetire(bot_id){
        const url = `/members/retire/chat/${ bot_id }`
        const options = {
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST',
        }
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * Fetch collection(s) requested on-demand.
     * @param {string} type - The type of collections to fetch.
     * @returns {Promise<Object[Array]>} - The collection(s)' items, no wrapper.
     */
    async collections(type=''){
        const url = `/members/collections/${ type }`
        const response = await this.#fetch(url)
        return response
    }
    /**
     * Calls a dynamic endpoint. Dynamic endpoints are sent from the server to the frontend during an instruction command that requires the creation of an input for a member to interact with.
     * @param {string} endpoint - The endpoint to fetch
     * @param {object} options - The fetch options, defaults to GET
     * @param {object} payload - The payload to send (optional)
     * @returns 
     */
    async dynamicInput(endpoint, options, payload){
        const url = `${ endpoint }`
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * MyLife function to obscure an item summary
     * @param {Guid} itemId - The item ID
     * @returns {Object} - The item object: { id, summary, etc. }
     */
    async evaluate(itemId){
        const url = `/members/evaluate/${ itemId }`
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        }
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * Retrieves first or next sequence of experience events and updates mExperience object.
     * @private
     * @async
     * @param {Guid} eid - The experience id
     * @param {object} memberInput - Member input in form of object
     * @returns {Promise<Experience>} - Experience object: { autoplay, events, id, location, name, purpose, skippable, }
     */
    async experience(eid, memberInput){
        const url = `/members/experience/${ eid }`
        let body = memberInput
            ? JSON.stringify(memberInput)
            : null
        const options = {
            body,
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'PATCH',
        }
        console.log(`experience: ${ url }`, body, options)
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * End experience on server.
     * @public
     * @async
     * @param {Guid} experienceId - The experience id
     * @returns {Promise<Object>} - The response object
     */
    async experienceEnd(experienceId){
        const url = `/members/experience/${ experienceId }/end`
        const options = { method: 'PATCH', }
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * Gets the manifest of the Experience.
     * @private
     * @async
     * @param {Guid} xid - The Experience id
     * @returns {Promise<Experience>} - Experience object: { autoplay, events, id, location, name, purpose, skippable, }
     */
    async experienceManifest(xid){
        const url =`/members/experience/${ xid }/manifest`
        const options = {
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'PATCH',
        }
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * Fetches the experiences from the server.
     * @returns {Promise<Experience[]>} - Array of Experience objects: { autoplay, events, id, location, name, purpose, skippable, }
     */
    async experiences(){
        const url = `/experiences`
        const response = await this.#fetch(url)
        return response
    }
    async feedback(isPositive=true, message, message_id=''){
        const url = `/members/feedback/${ message_id }`
        const options = {
            body: JSON.stringify({ isPositive, message, }),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        }
        const response = await this.#fetch(url, options)
        return response
    }
    async getShare(shareId){
        const url = `/members/share/${ shareId }`
        const response = await this.#fetch(url)
        return response
    }
    async getShares(itemId){
        const url = `/members/shares`
        if(itemId?.length)
            url += `/${ itemId }`
        const response = await this.#fetch(url)
        return response
    }
    /**
     * Fetches the greetings from the server.
     * @param {Boolean} dynamic - Whether or not to use dynamic greetings
     * @returns {Promise<object>} - The server response object
     * @property {Array} response - Array of greeting message objects { agent, message, response_time, type, }
     * @property {Boolean} success - Whether or not the request was successful
     */
    async greetings(dynamic=false){
        dynamic = '?dyn=' + dynamic
        let validation = new URLSearchParams(window.location.search).get('vld')
        validation = validation?.length
            ? `&vld=${ validation }`
            : ''
        const url = `greetings/${ dynamic + validation }`
        const response = await this.#fetch(url)
        const responses = ( response?.responses ?? [] )
            .map(response=>response.message)
        return responses
    }
    async help(helpData){
        const url = `/help`
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(helpData),
        }
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * Deletes the item from the server.
     * @param {Guid} itemId - The collection item id
     * @returns {Object} - The item object: { item, message, success, }
     */
    async itemDelete(itemId){
        const url = `/members/items/${ itemId }`
        const options = { method: 'DELETE', }
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * Sets collection item content on server.
     * @private
     * @async
     * @param {Event} event - The event object.
     * @returns {Object} - The response object: { item, success, }
     */
    async itemUpdate(itemId, summary, emoticons){
        const url = `/members/item/${ itemId }`
        const options = {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ emoticons, summary, })
        }
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * Sets collection item title on server.
     * @param {Guid} itemId - The collection item id
     * @param {string} title - The title to set
     * @returns {boolean} - Whether or not the title was set
     */
    async itemUpdateTitle(itemId, title){
        if(!title?.length)
            throw new Error(`No title provided for title update`)
        const url = `/members/item/${ itemId }`
        const options = {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ itemId, title, })
        }
        const response = await this.#fetch(url, options)
        if(!response.success)
            throw new Error(`Title "${ title }" not accepted.`)
        return true
    }
    async logout(){
        const url = `/logout`
        const response = await this.#fetch(url)
        return response
    }
    /**
     * Relives a memory for a member.
     * @param {Guid} id - The memory collection item id
     * @param {string} memberInput - The member's updates to the memory
     * @returns {Object} - The response object
     */
    async memoryRelive(itemId, memberInput){
        const url = `/members/memory/relive/${ itemId }`
        const body = memberInput?.length
            ? JSON.stringify({ memberInput, })
            : null
        const options = {
            body,
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'PATCH',
        }
        const response = await this.#fetch(url, options)
        return response
    }
    async memoryReliveEnd(itemId){
        const url = `/members/memory/end/${ itemId }`
        const options = { method: 'PATCH', }
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * MyLife function to obscure an item summary
     * @param {Guid} itemId - The item ID
     * @returns {Object} - The item object: { id, summary, etc. }
     */
    async obscure(itemId){
        const url = `/members/obscure/${ itemId }`
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        }
        const response = await this.#fetch(url, options)
        return response
    }
    async passphraseUpdate(passphrase){
        const url = `/members/passphrase`
        const options = {
            body: JSON.stringify({ passphrase, }),
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST',
        }
        const success = await this.#fetch(url, options)
        return success
    }
    async routine(type){
        const url = `/routine/${ type }`
        const response = await this.#fetch(url)
        return response
    }
    /**
     * Fetches shadows from the server.
     * @private
     * @async
     * @returns {Object[]} - The shadows array.
     */
    async shadows(){
        const url = `/shadows`
        const response = await this.#fetch(url)
        return response
    }
    /**
     * Conducts a share of a memory with recipient visitor.
     * @param {Guid} shareId - The share ID
     * @param {String} input - Whether or not to use dynamic greetings
     * @returns {Promise<object>} - The server response object
     * @property {Array} response - Array of greeting message objects { agent, message, response_time, type, }
     * @property {Boolean} success - Whether or not the request was successful
     */
    async share(shareId, input){
        const url = `/share/${ shareId }`
        console.log(`share: ${ shareId }`, input)
        const options = {
            body: JSON.stringify({ input, }),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'PATCH',
        }
        const response = await this.#fetch(url, options)
        return response
    }
    async shareUpdate(shareData){
        const { id, } = shareData
        const url = `/members/share/${ id ?? '' }`
        const options = {
            body: JSON.stringify(shareData),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'PATCH',
        }
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * Creates a new member share on the server.
     * @param {object} shareData - The share data
     * @returns 
     */
    async shareCreate(shareData){
        const url = `/members/share`
        const options = {
            body: JSON.stringify(shareData),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        }
        const response = await this.#fetch(url, options)
        return response
    }
    async shareDelete(shareId){
        const url = `members/share/${ shareId }`
        const options = {
            method: 'DELETE',
        }
        const response = await this.#fetch(url, options)
        return response
    }
    async shareHeader(shareId){
        const url = `/share/header/${ shareId }`
        const response = await this.#fetch(url)
        return response
    }
    async shareFeedback(shareId, isPositive=true, message){
        const url = `/share/feedback/${ shareId }`
        const options = {
            body: JSON.stringify({ isPositive, message, }),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        }
        const response = await this.#fetch(url, options)
        return response
    }
    async shareStop(shareId){
        const url = `/share/stop/${ shareId }`
        const response = await this.#fetch(url)
        return response
    }
    async shareUpdate(shareData){
        const { id, } = shareData
        const url = `/members/share/${ id ?? '' }`
        const options = {
            body: JSON.stringify(shareData),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'PATCH',
        }
        const response = await this.#fetch(url, options)
        return response
    }
    async signupStatus(){
        const response = await this.#fetch('signup')
        return response
    }
    async submitChat(chatData, useMemberRoute=false){
        const url = useMemberRoute
            ? `/members/`
            : `/`
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(chatData),
        }
        const response = await this.#fetch(url, options)
        return response
    }
    async submitPassphrase(passphrase, mbr_id){
        const url = `/challenge/${ mbr_id }`
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ passphrase, }),
        }
        const response = await this.#fetch(url, options)
        return response
    }
    async submitSignup(signupData){
        const url = `signup`
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(signupData),
        }
        const { success, } = await this.#fetch(url, options)
        return success
    }
    /**
     * Fetches the summary for a specified file.
     * @public
     * @param {string} fileId - The file ID
     * @param {string} fileName - The file name
     * @returns {Promise<object>} - The Summary response
     */
    async summary(fileId, fileName){
        const url = `/members/summarize`
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileId,
                fileName,
            }),
        }
        const response = await this.#fetch(url, options)
        return response
    }
    /**
     * Fetches the team for a specified team ID.
     * @param {Guid} teamId - The team name
     * @returns {Object}- The team object: { id, name, etc. }
     */
    async team(teamId){

    }
    /**
     * Sets the active Team.
     * @param {Guid} teamId - The team ID
     * @returns {Object} - The response object
     */
    async teamActivate(teamId){
        const url = `/members/teams/${ teamId }`
        const options = {
            method: 'POST', 
        }
        const response = await this.#fetch(url, options)
        return response 
    }
    async teams(){
        const url = `/members/teams`
        const response = await this.#fetch(url)
        return response
    }
    async uploadFiles(formData){
        const url = `/members/upload`
        const options = {
            method: 'POST',
            body: formData,
        }
        const response = await this.#fetch(url, options)
        return response
    }
    async validateShare(shareId){
        const { instanceId, } = await this.#fetch(`/share/${ shareId }`)
        return instanceId
    }
}
class Globals {
    #uuid = mNewGuid()
    constructor(){
        if(!mLoaded){
            /* constants */
            mAvatarName = this.getAvatar()?.name
                ?? 'C4-PAC'
            mPlaceholder = `Type your message to ${ mAvatarName }...`
            /* elements */
            mChatAudioIcon = document.getElementById('audio-icon')
            mChatAudioPopup = document.getElementById('audio-popup')
            mChatContainer = document.getElementById('chat-container')
            mChatInputContainer = document.getElementById('chat-input-container')
            mChatInputField = document.getElementById('chat-input-text')
            mChatSubmit = document.getElementById('chat-input-submit')
            mChatSystem = document.getElementById('chat-system')
            mDatamanager = new Datamanager()
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
            mLogoutButton = document.getElementById('navigation-logout')
            mMainContent = document.getElementById('main-content')
            mNavigation = document.getElementById('page-header')
            mNavigationHamburger = document.getElementById('hamburger')
            mNavigationHelp = document.getElementById('navigation-help')
            mNavigationHelpIcon = document.getElementById('navigation-help-icon')
            mPage = document?.getElementById('page-header')
                ?? document?.getElementById('page-wrapper')
            mSidebar = document.getElementById('sidebar')
                ?? document.getElementById('bot-container')
            /* element initialization */
            if(mChatInputField){
                this.chatInput = null
                this.chatInputPlaceholder = mPlaceholder
            }
            if(mChatAudioIcon)
                mSpeechInitialization(this.checkChatInput)
            /* required existence checks */
            if(!mChatContainer || !mChatSystem || !mDatamanager || !mMainContent || !mPage)
                console.error('Critical global elements missing:', {
                    mChatContainer,
                    mChatSystem,
                    mDatamanager,
                    mMainContent,
                    mPage,
                })
            else
                this.init()
        }
    }
    /* public functions */
    async init(){
        /* global visibility settings */
        this.hide(mHelpContainer)
        /* assign event listeners */
        if(mChatInputField)
            mChatInputField.addEventListener('input', this.checkChatInput)
        if(mNavigationHelp){
            mHelpClose.addEventListener('click', mToggleHelp)
            mHelpInputSubmit.addEventListener('click', mSubmitHelp)
            mHelpInputText.addEventListener('input', mToggleHelpSubmit)
            mHelpRefresh.addEventListener('click', mRefreshHelpChat)
            mHelpType.addEventListener('click', mSetHelpType)
            mNavigationHelpIcon.addEventListener('click', mToggleHelp)
            Array.from(mHelpType.children)?.[0]?.click() // default to first type
            mToggleHelpSubmit()
        }
        if(mChatAudioIcon){
            let iconHover = false
            mChatAudioIcon.addEventListener('click', mSpeechRecognition)
            mChatAudioIcon.addEventListener('touchend', mSpeechRecognition)
            mChatAudioIcon.addEventListener('mouseover', ()=>{
                if(!mRecognizingSpeech){
                    iconHover = true
                    let audioPopupTimeout
                    mChatAudioIcon.addEventListener('mouseover', _=>{
                        if(!mRecognizingSpeech){
                            iconHover = true
                            audioPopupTimeout = setTimeout(()=>{
                                mChatAudioPopup.classList.remove('hide', 'fade-out', 'show')
                                void mChatAudioPopup.offsetWidth
                                mChatAudioPopup.classList.add('fade-out')
                            }, 3000)
                            mChatAudioPopup.addEventListener('animationend', this.hide(mChatAudioPopup))
                            this.show(mChatAudioPopup)
                            this.scrollBottom()
                        }
                    })
                    mChatAudioIcon.addEventListener('mouseout', _=>{
                        if(audioPopupTimeout){
                            clearTimeout(audioPopupTimeout)
                            audioPopupTimeout = null
                        }
                        if(iconHover && !mRecognizingSpeech){
                            iconHover = false
                            mChatAudioPopup.classList.remove('fade-out')
                            mChatAudioPopup.getAnimations().forEach(animation => animation.cancel())
                            this.hide(mChatAudioPopup)
                            this.scrollBottom()
                        }
                    })
                    this.scrollBottom()
                }
            })
            mChatAudioIcon.addEventListener('mouseout', _=>{
                if(iconHover && !mRecognizingSpeech){
                    iconHover = false
                    mChatAudioPopup.classList.remove('hide', 'fade-out', 'show')
                    mChatAudioPopup.getAnimations().forEach(animation => animation.cancel())
                    this.hide(mChatAudioPopup)
                    this.scrollBottom()
                }
            })
            mChatAudioPopup.addEventListener('click', _=>this.hide(mChatAudioPopup))
            setTimeout(()=>{
                mChatAudioPopup.classList.remove('hide', 'fade-out')
                void mChatAudioPopup.offsetWidth
                mChatAudioPopup.classList.add('fade-out')
                mChatAudioPopup.addEventListener('animationend', _=>{
                    this.hide(mChatAudioPopup)})
            }, 5000)
        }
        if(mLogoutButton)
            mLogoutButton.addEventListener('click', mLogout, { once: true })
        /* fetch data */
        await this.datamanager.alerts()
        /* page loaded */
        mLoaded = true
    }
    /* public functions */
    /**
     * Adds an element to the chat system container
     * @param {HTMLElement} element - The element to add to the chat system
     */
    addChatElement(element){
        mChatSystem.appendChild(element)
    }
    /**
     * Creates an await button element for the user to interact with.
     * @param {String} message - The text for button
     * @returns (HTMLELement) - The await element
     */
    await(message){
        return mCreateAwait(message)
    }
    checkChatInput(){
        mCheckChatInput()
    }
	/**
	 * Clears a const array with nod to garbage collection.
	 * @param {Array} a - the array to clear.
	 * @returns {void}
	 */
	clearArray(a){
		if(!Array.isArray(a))
			throw new TypeError('Expected an array to clear')
		for(let i = 0; i < a.length; i++){
			a[i] = null
		}
		a.length = 0
	}
    /**
     * Operates on a dataset to clear all frontend-defined keys.
     * @param {DOMStringMap} dataset - The dataset to clear
     * @returns {void}
     */
    clearDataset(dataset){
        if(!(dataset instanceof DOMStringMap))
            return
        for(let key in dataset){
            if(dataset.hasOwnProperty(key))
                delete dataset[key]
        }
    }
    /**
     * Clears an element of its contents, brute force currently via innerHTML.
     * @param {HTMLElement} element - The element to clear.
     * @returns {void}
     */
    clearElement(element=mChatSystem){
        mClearElement(element)
    }
    /**
     * Consumes instruction object and performs the requested actions.
     * @param {object} instruction - The instruction object: { command, input, inputs, item, itemId, summary, title, }
     * @param {object} functions - Object with access to injected functions, populated by case
     * @returns {void}
     */
    enactInstruction(instruction, functions){
        const { command, input, inputs=[], item, itemId, livingMemoryId, summary, title, } = instruction
        const {
            addInput,
            addMessages,
            createItem,
            endMemory,
            removeItem,
            updateItem,
            updateItemSummary,
            updateItemTitle,
        } = functions
        switch(command){
            case 'createInput':
            case 'createInputs':
                if(typeof addInput!=='function' || typeof addMessages!=='function')
                    return
                this.removeDisappearingElements()
                if(input?.length && !inputs.find(_input=>_input.id===input.id))
                    inputs.push(input) // normalize to array
                for(let _input of inputs){
                    const { disappear=true, endpoint, id, interfaceLocation='chat', method, prompt, required, type, } = _input
                    const inputElement = document.createElement('div')
                    inputElement.classList.add('input-container')
                    if(disappear)
                        inputElement.classList.add('input-disappear')
                    inputElement.id = `input-container_${ id }`
                    inputElement.name = `dynamic-input` + ( disappear ? '-disappear' : '' )
                    const inputObject = document.createElement('input')
                    inputObject.type = type
                        ?? 'text'
                    if(type==='button'){
                        inputObject.classList.add('button', 'input-button')
                        inputObject.value = prompt
                        if(endpoint)
                            inputObject.addEventListener('click', async event=>{
                                const { instruction: dynamicInputResponseInstruction, responses, success, } = await mDatamanager.dynamicInput(endpoint, { method, })
                                if(responses?.length && success){
                                    addMessages(responses)
                                    if(!!dynamicInputResponseInstruction)
                                        this.enactInstruction(dynamicInputResponseInstruction, functions)
                                }
                                this.expunge(inputObject)
                            }, { once: true })
                    }
                    inputElement.appendChild(inputObject)
                    addInput(inputElement, interfaceLocation)
                }
                return
            case 'createItem':
                if(!item || typeof createItem!=='function')
                    return
                createItem(item)
                return
            case 'endLiving': // server has already ended, call frontend cleanup
            case 'endMemory':
            case 'endReliving':
                if(!itemId?.length || typeof endMemory!=='function')
                    return
                endMemory(itemId)
                return
            case 'error':
                return
            case 'removeBot': // retireBot in Avatar
            return
            case 'removeItem':
                if(typeof removeItem !== 'function')
                    return
                removeItem(itemId)
                return
            case 'updateItem':
                if(typeof updateItem!=='function')
                    return
                updateItem(item)
                return
            case 'updateItemSummary':
                if(typeof updateItemSummary!=='function')
                    return
                updateItemSummary(itemId, summary)
                return
            case 'updateItemTitle':
                if(typeof updateItemTitle!=='function')
                    return
                updateItemTitle(itemId, title)
            default:
                return
        }
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
     * Deletes an element from the DOM via Avatar functionality.
     * @todo - build out cases so that intelligence can be employed when removing elements from DOM
     * @param {HTMLElement} element - The element to expunge.
     * @returns {void}
     */
    expunge(element){
        if(!element)
            return
        this.hide(element) /* trigger any animations */
        element.remove()
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
     * Consumes an HTML id and returns the functionality name. Example: `library-upload` returns `upload`.
     * @public
     * @param {string} id - The HTML id to convert.
     * @returns {string} - The functionality name.
     */
    HTMLIdToFunction(id){
        if(id.includes('-'))
            id = id.split('-').pop()
        return id
    }
    /**
     * Consumes an HTML id and returns the type. Example: `library-upload` returns `library`.
     * @public
     * @param {string} id - The HTML id to convert.
     * @returns {string} - The type.
     */
    HTMLIdToType(id){
        if(id.includes('-'))
            id = id.split('-').slice(0, -1).join('-')
        return id
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
    /**
     * Remove an element from the DOM based upon its class name of `input-disappear`.
     * @returns {void}
     */
    removeDisappearingElements(){
        const dynamicInputs = document.getElementsByClassName('input-disappear')
        Array.from(dynamicInputs)
            .forEach(inputElement=>this.retract(inputElement))
    }
    /**
     * Remove an element from the DOM.
     * @param {HTMLElement} element - The element to remove from the DOM.
     * @returns {void}
     */
    retract(element){
        element.remove()
    }
    /**
     * Scroll an element to the bottom.
     * @param {HTMLElement} element - The element to scroll to the bottom of; defaults to `mChatSystem`
     * @returns {void}
     */
    scrollBottom(element=mChatSystem){
        mScrollBottom(element)
    }
    /**
     * Sets the chat input value and placeholder text.
     * @param {String} value - The value to seed the chat input with.
     * @param {String} placeholder - The placeholder to seed the chat input with
     */
    seedInput(value, placeholder){
        this.chatInput = value
        if(placeholder?.length)
            this.chatInputPlaceholder = placeholder
        mChatInputField.focus()
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
     * Toggles the chat input field.
     * @param {boolean} display - Whether or not to display the chat input field, defaults to `true`
     * @param {DOMTokenList} classList - Class list of the chat input field to add or remove
     * @returns {void}
     */
    toggleChatInput(display=true, classList){
        mToggleChatInput(display, classList)
    }
    /**
     * Toggles the visibility of an element with option to force state.
     * @param {HTMLElement} element - The element to toggle.
     * @param {boolean} bForceState - The state to force the element to, defaults to `null`.
     * @returns {void}
     */
    toggleVisibility(element, bForceState=null){
        if(bForceState!=null){ /* loose type equivalence intentional */
            bForceState ? mShow(element) : mHide(element)
        } else {
            const { classList, } = element
            mIsVisible(classList) ? mHide(element) : mShow(element)
        }
    }
    /**
     * Returns the URL parameters as an object.
     * @returns {object} - The URL parameters as an object.
     */
    urlParameters(){
        const parameters = new URLSearchParams(window.location.search)
        let parametersObject = {}
        for(let parameter of parameters) {
            parametersObject[parameter[0]] = parameter[1]
        }
        return parametersObject
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
    get ChatContainer(){
        return mChatContainer
    }
    get chatInput(){
        return mChatInputField.value.trim()
    }
    set chatInput(value){
        mChatInputField.value = value
    }
    get chatInputPlaceholder(){
        return mChatInputField.placeholder
    }
    set chatInputPlaceholder(value){
        mChatInputField.placeholder = value
    }
    get ChatInput(){
        return mChatInput
    }
    get ChatSubmit(){
        return mChatSubmit
    }
    get datamanager(){
        return mDatamanager
    }
    get mainContent(){
        return mMainContent
    }
    get MemberChat(){ // return member chat container HTMLElement
        return mChatInputContainer
    }
    get navigation(){
        return mNavigation
    }
    get newGuid(){ 
        return mNewGuid()
    }
    get page(){
        return mPage
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
    bubble.classList.add('chat-message', `chat-message-${ type }`)
    bubble.innerHTML = text
    if(subType)
        bubble.classList.add(`chat-message-${ subType }`)
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
function mCheckChatInput(){
    mChatInputField.style.height = 'auto' // Reset height to shrink if text is removed
    mChatInputField.style.height = mChatInputField.scrollHeight + 'px' // Set height based on content
    mToggleSubmitButton()
}
/**
 * Creates an await button element for the user to interact with.
 * @param {String} message - The text for button
 * @returns (HTMLELement) - The await element
 */
function mCreateAwait(message){
    const awaitButton = document.createElement('div')
    awaitButton.classList.add('await-button')
    awaitButton.id = 'await-button'
    const spinner = document.createElement('span')
    spinner.classList.add('spinner-border', 'spinner-border-sm', 'await-button-spinner')
    const text = document.createElement('span')
    text.classList.add('await-button-text')
    text.textContent = message
    awaitButton.appendChild(spinner)
    awaitButton.appendChild(text)
    return awaitButton
}
/**
 * Initializes the speech recognition object, when available
 * @returns {void}
 */
function mSpeechInitialization(inputCheckCallback){
    /* speech recognition */
    if(!('webkitSpeechRecognition' in window)){
        alert('MyLife requires a browser that supports Speech Recognition. Please use Google Chrome or Microsoft Edge.')
        mChatAudioIcon.style.display = 'none'
        return
    }
    mChatAudioPopup.innerHTML = mAudioNotRecording
    let finalTranscript='',
        ignoreEnd = false
    mRecognition = new webkitSpeechRecognition()
    mRecognition.continuous = true
    mRecognition.interimResults = true
    mRecognition.lang = 'en-US'
    mRecognition.SpeechRecognitionMode = 'ondevice-only'
    /* speech grammar */
    try{
        const grammar =
        '#JSGF V1.0; grammar core; public <core> = MyLife | Q | humanism | humanist ;'
          const speechRecognitionList = new webkitSpeechGrammarList()
          speechRecognitionList.addFromString(grammar, 1)
          mRecognition.grammar = speechRecognitionList
    } catch(e){
        console.log('Error loading grammar', e)
    }
    mRecognition.onend = ()=>{
        mRecognizingSpeech = false
        mChatAudioIcon.classList.remove('listening-mic')
        mChatInputField.classList.remove('listening')
        mChatInputField.placeholder = mPlaceholder
        mChatAudioPopup.innerHTML = mAudioNotRecording
        mHide(mChatAudioPopup)
        mToggleSubmitButton() // no content keeps button disabled
        if(mRecognition?.trigger){
            mChatSubmit.click()
            mRecognition.trigger = false
        }
    }
    mRecognition.onerror = (event)=>{
        ignoreEnd = true
        if(event.error=='audio-capture')
            alert('No microphone was found. Ensure that a microphone is installed and that microphone settings are configured correctly.')
        if(event.error=='no-speech')
            alert('No speech was detected. Please try again.')
        // if(event.error=='not-allowed') // @todo - not allowed fix? download?
    }
    mRecognition.onresult = event=>{
        let interimTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if(event.results[i].isFinal){
                let finalPhrase = event.results[i][0].transcript.trim().toLowerCase()
                finalPhrase = finalPhrase.replace(/[.,!?]$/, '') // Remove trailing punctuation
                const triggerWords = ['complete', 'done', 'end', 'finish', 'finished', 'send', 'stop', 'submit'] // trigger words
                if(triggerWords.some(word=>finalPhrase==word)){
                    finalTranscript += finalPhrase.split(' ').slice(0, -1).join(' ') // remove trigger words
                    mChatInputField.value = finalTranscript
                    if(finalPhrase.endsWith('send') || finalPhrase.endsWith('submit'))
                        mRecognition.trigger = true // request to submit input
                    mRecognition.stop() // Stop recognition
                } else {
                    finalTranscript += finalPhrase + " "
                }
            } else {
                interimTranscript += event.results[i][0].transcript
            }
        }
        mChatInputField.value = finalTranscript + interimTranscript
        mCheckChatInput() // adjust input box height
    }
    mRecognition.onstart = ()=>{
        finalTranscript = ''
        // transform popup content
        mChatAudioPopup.innerHTML = mAudioRecording
        mShow(mChatAudioPopup)
        mChatInputField.innerHTML = finalTranscript
        mChatAudioIcon.classList.add('listening-mic')
        mChatInputField.classList.add('listening')
        mChatInputField.placeholder = 'Speak aloud to capture your voice...'
        mRecognizingSpeech = true
    }
    /* speech synthesis */
    if(!('speechSynthesis' in window)){
        mChatAudioIcon.style.display = 'none'
        alert('MyLife requires a browser that supports Speech Synthesis. Please use Google Chrome or Microsoft Edge.')
        return
    }
    mSynthesis = window.speechSynthesis
    const langRegex = /^en(-[a-z]{2})?$/i
    const voices = mSynthesis
        .getVoices()
    //    .filter((voice)=>langRegex.test(voice.lang))
    // @todo - no voices found?
}
/**
 * Speech recognition start/stop handler.
 * @requires mRecognition
 * @requires mRecognizingSpeech
 * @returns {void}
 */
function mSpeechRecognition(){
    if(!mRecognition)
        return
    if(mRecognizingSpeech)
        mRecognition.stop()
    else
        mRecognition.start()
}
/**
 * Refreshes Help Chat.
 * @todo - remove hack
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mRefreshHelpChat(event){
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
/* alerts */
function mAlertCreate(alertData){
    const systemAlertContainer = document.getElementById('system-alert-container')
    const _id = alertData.id
    /* individual alert box */
    const systemAlertBox = document.createElement('div')
    systemAlertBox.id = `alert-${_id}`
    systemAlertBox.name = systemAlertBox.id
    systemAlertBox.classList.add('alert-box')
    systemAlertContainer.appendChild(systemAlertBox)
    /* alert box content */
    const systemAlertContent = document.createElement('div')
    systemAlertContent.id = `alert-content-${_id}`
    systemAlertContent.name = systemAlertContent.id
    systemAlertContent.classList.add('alert-content')
    systemAlertContent.textContent = alertData.content
    if(alertData.urgency?.length){
        let urgency = ''
        switch(alertData.urgency.toLowerCase()) {
            case 'low':
                urgency = 'alert-low'
                break
            case 'medium':
                urgency = 'alert-medium'
                break
            case 'high':
                urgency = 'alert-high'
                break
            default:
                break
        }
        systemAlertContent.classList.add(alertUrgencyClass(urgency))
    }
    systemAlertBox.appendChild(systemAlertContent)
    /* alert box close */
    const systemAlertClose = document.createElement('div')
    systemAlertClose.id = `alert-close-${_id}`
    systemAlertClose.name = systemAlertClose.id
    if(alertData.dismissable){
        systemAlertClose.classList.add('alert-close', 'fa', 'fa-times')
        systemAlertClose.onclick = ()=>mAlertHide(systemAlertBox)
    }
    systemAlertBox.appendChild(systemAlertClose)
    mShowAlert(systemAlertBox)
    setTimeout(()=>mAlertHide(systemAlertBox), 22000)
    function mAlertHide(systemAlert) {
        systemAlert.classList.add('alert-hide')
    }
    function mShowAlert(systemAlert) {
        systemAlert.classList.remove('alert-hide')
    }
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
    let event = new CustomEvent('launchExperience', { detail: 'aae28fe4-30f9-4c29-9174-a0616569e762', })
    window.dispatchEvent(event)
    mHelpClose.click()
}
/**
 * Logs out the current user and redirects to homepage.
 * @private
 * @async
 * @returns {void}
 */
async function mLogout(){
    const response = await mDatamanager.logout()
    if(response)
        window.location.href = '/'
    else
        console.error('mLogout::failure', response)
}
/**
 * Scrolls overflow of passed element to bottom.
 * @param {HTMLElement} element - The element to scroll to the bottom
 * @returns {void}
 */
function mScrollBottom(element){
    element.scrollTop = element.scrollHeight
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
    if(!element)
        return
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
    const helpData = {
        helpRequest,
        type,
        mbr_id,
    }
    const response = await mDatamanager.help(helpData)
    return response
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
/**
 * Toggles the chat input container based on `input` or other request.
 * @param {Boolean} display - Whether to display the chat input container
 * @param {DOMTokenList} classList - Class list to add or remove from the chat input container
 * @returns {void}
 */
function mToggleChatInput(display, classList){
    if(display){
        mShow(mChatInputContainer)
        mChatInputField.focus()
        if(classList)
            mChatInputField.classList.add(classList)
        mChatInputField.value = null
    } else {
        mHide(mChatInputContainer)
        mChatInputField.classList.remove('fade-in')
        if(classList)
            mChatInputField.classList.remove(classList)
    }
    mToggleSubmitButton()
}
/**
 * Toggles the disabled state of a button based on the input element value.
 * @private
 * @returns {void}
 */
function mToggleSubmitButton(){
    const hasInput = mChatInputField.value.trim().length ?? false
    mChatSubmit.disabled = !hasInput
    mChatSubmit.style.cursor = hasInput ? 'pointer' : 'not-allowed'
}
/* exports */
export default Globals