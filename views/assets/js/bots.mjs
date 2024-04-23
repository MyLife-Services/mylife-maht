/* bot functionality */
/* imports */
import {
    addMessageToColumn,
    hide,
    setActiveBot,
    show,
    state,
} from './members.mjs'
import Globals from './globals.mjs'
/* variables */
const mGlobals = new Globals()
let mState
/* public functions */
/**
 * Fetch bots from server, used primarily for initialization of page, though could be requested on-demand.
 * @public
 * @returns {Promise<Array>} bots
 */
async function fetchBots(){
    const url = window.location.origin + '/members/bots'
    const response = await fetch(url)
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    return await response.json()
}
/**
 * Proxy to update bot-bar, bot-containers, and bot-greeting, if desired. Requirements should come from including module, here `members.mjs`.
 * @public
 * @requires mState
 * @param {boolean} bIncludeGreeting - Include bot-greeting.
 * @returns {void}
 */
async function updatePageBots(bIncludeGreeting=false){
    mState = state()
    updateBotBar()
    updateBotContainers()
    if(bIncludeGreeting)
        mGreeting()
}
/* private functions */
/**
 * Paints bot-greeting to column
 * @private
 * @requires mState
 * @returns {void}
 */
function mGreeting(){
    const { activeBot, } = mState
    const greeting = Array.isArray(activeBot.greeting)
        ?   activeBot.greeting
        :   [
                activeBot?.greeting
            ?? activeBot?.description
            ?? activeBot?.purpose
            ]
    if(!greeting.length)
        throw new Error(`No bot-greeting provided.`)
    /* bot-greeting routine */
    setTimeout(() => { // Set a timeout for 1 second to wait for the first line to be fully painted
        // Set another timeout for 7.5 seconds to add the second message
        const timerId = setTimeout(addIntroductionMessage, 7500)
        /* add listeners */
        window.addEventListener('mousemove', addIntroductionMessage, { once: true })
        window.addEventListener('click', addIntroductionMessage, { once: true })
        window.addEventListener('focus', addIntroductionMessage, { once: true })
        window.addEventListener('scroll', addIntroductionMessage, { once: true })
        /* local timeout functions */
        function addIntroductionMessage() { // Clear the 7.5 seconds timeout if any event is triggered
            clearTimeout(timerId)
            greeting.forEach(_greeting =>{
                addMessageToColumn({ message: _greeting })
            })
            cleanupListeners()
        }
        /* cleanup */
        function cleanupListeners() {
            window.removeEventListener('mousemove', addIntroductionMessage)
            window.removeEventListener('click', addIntroductionMessage)
            window.removeEventListener('focus', addIntroductionMessage)
            window.removeEventListener('scroll', addIntroductionMessage)
        }
    }, 1000)
}
/**
 * Returns icon path string based on bot type.
 * @param {string} type - bot type
 * @returns {string} icon path
 */
function botIcon(type){
    let image = 'png/'
    switch(type){
        case 'art':
            image+='art-thumb.png'
            break
        case 'education':
            image+='education-thumb.png'
            break
        case 'health':
            image+='health-thumb.png'
            break
        case 'personal-biographer':
            return 'png/biographer-thumb.png'
        case 'resume':
            image+='resume-thumb.png'
            break
        case 'avatar':
        case 'personal-avatar':
            image+='personal-avatar-thumb-02.png'
            break
        default:
            image+='work-thumb.png'
            break
    }
    return image
}
/**
 * Cancel passphrase reset.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mCancelPassphrase(event){
    mTogglePassphrase(false)
}
/**
 * Get bot status based on thread and assistant population.
 * @public
 * @param {object} bot
 * @param {object} botIcon - icon <div> element
 * @returns {string} status
 */
function getStatus(bot, botIcon){
    switch (true) {
        case (bot.thread_id?.length>0 || false): // activated
            botIcon.classList.add('active')
            botIcon.classList.remove('inactive')
            return 'active'
        case ( bot.bot_id?.length>0 ): // unactivated
            botIcon.classList.add('inactive')
            botIcon.classList.remove('active')
            return 'inactive'
        default:
            botIcon.classList.remove('active', 'inactive')
            return 'none'
    }
}
function mInputPassphrase(event){
    const passphraseInput = event.target
    const passphraseSubmit = document.getElementById(`personal-avatar-passphrase-submit`)
    if(passphraseInput.value.length)
        show(passphraseSubmit)
    else
        hide(passphraseSubmit)
}
/**
 * Reset passphrase for MyLife via avatar.
 * @param {Event} event 
 * @returns {void}
 */
function mResetPassphrase(event){
    const element = event.target
    const passphraseCancel = document.getElementById(`personal-avatar-passphrase-cancel`)
    const passphraseInput = document.getElementById(`personal-avatar-passphrase`)
    const passphraseSubmit = document.getElementById(`personal-avatar-passphrase-submit`)
    /* add listeners */
    passphraseCancel.addEventListener('click', mCancelPassphrase, { once: true })
    passphraseInput.addEventListener('input', mInputPassphrase, { once: true })
    passphraseSubmit.addEventListener('click', mSubmitPassphrase, { once: true })
    /* prepare reset */
    mTogglePassphrase(true)

}
/**
 * Set Bot data on server.
 * @param {Object} bot - bot object
 * @returns {void}
 */
async function setBot(bot){
    try {
        const url = window.location.origin + '/members/bots/' + bot.id
        const method = bot.id?.length ? 'PUT' : 'POST'
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bot)
        })
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`)
        }
        const responseData = await response.json()
        console.log('Success:', responseData)
    } catch (error) {
        console.log('Error posting bot data:', error)
    }
    return
}
/**
 * Submit updated passphrase for MyLife via avatar.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mSubmitPassphrase(event){
    const passphraseInputContainer = document.getElementById(`personal-avatar-passphrase-container`)
    const passphraseInput = document.getElementById(`personal-avatar-passphrase`)
    const passphraseResetButton = document.getElementById(`passphrase-reset-button`)
    const passphraseSubmit = document.getElementById(`personal-avatar-passphrase-submit`)
    if(!passphraseInput.value.length)
        return
    /* submit to server */
    
    /* add listener */
    passphraseResetButton.addEventListener('click', mResetPassphrase, { once: true })
    hide(passphraseInputContainer)
    show(passphraseResetButton)
}
function toggleBotContainerOptions(event){
    event.stopPropagation()
    const element = event.target
    const itemIdSnippet = element.id.split('-').pop()
    switch(itemIdSnippet){
        case 'create':
            // validate required fields
           if(!this.getAttribute('data-bot_name')?.length){
               this.setAttribute('data-bot_name', `${ mGlobals.variableIze(this.getAttribute('data-mbr_handle')) }-${ this.getAttribute('data-type') }`)
           }
           /* deprecate
            if(!this.getAttribute('data-dob')?.length){
                alert('Birthdate is required to calibrate your biographer.')
                return
            }
            */
            // mutate bot object
            const bot = {
                bot_id: this.getAttribute('data-bot_id'),
                bot_name: this.getAttribute('data-bot_name'),
                dob: this.getAttribute('data-dob'),
                id: this.getAttribute('data-id'),
                mbr_id: this.getAttribute('data-mbr_id'),
                object_id: this.getAttribute('data-object_id'),
                provider: this.getAttribute('data-provider'),
                purpose: this.getAttribute('data-purpose'),
                thread_id: this.getAttribute('data-thread_id'),
                type: this.getAttribute('data-type'),
            }
            switch(bot.type){
                case 'personal-avatar':
                    bot.dob = this.getAttribute('data-dob')
                    break
                case 'personal-biographer':
                    bot.interests = this.getAttribute('data-interests')
                    const _n = parseInt(this.getAttribute('data-narrative'), 10)
                    bot.narrative = isNaN(_n) ? 50 : Math.min(100, Math.max(1, _n))
                    const _pv = parseInt(this.getAttribute('data-privacy'), 10)
                    bot.privacy = isNaN(_pv) ? 50 : Math.min(100, Math.max(0, _pv))
                    break
                default:
                    break
            }
            setBot(bot) // post to endpoint, update server
            /* check for success and activate */
            setActiveBot(bot)
            return
        case 'name':
        case 'ticker':
            // start/stop ticker
            // @todo: double-click to edit in place
            const _span = this.querySelector('span')
                ? this.querySelector('span')
                : event.target
            _span.classList.toggle('no-animation')
            return
        case 'status':
        case 'type':
        case 'dropdown':
            document.querySelectorAll('.bot-container').forEach(otherContainer => {
                if (otherContainer !== this) {
                    // Close the bot options
                    var otherContent = otherContainer.querySelector('.bot-options')
                    if (otherContent) {
                        otherContent.classList.remove('open')
                    }
                    // Rotate back the dropdowns
                    var otherDropdown = otherContainer.querySelector('.bot-options-dropdown')
                    if (otherDropdown) {
                        otherDropdown.classList.remove('open')
                    }
                }
            })
            // Then, toggle the visibility of the clicked container's content
            var content = this.querySelector('.bot-options')
            if (content) {
                content.classList.toggle('open')
            }
            // Also toggle the dropdown rotation
            var dropdown = this.querySelector('.bot-options-dropdown')
            if (dropdown) {
                dropdown.classList.toggle('open')
            }
            return
        case 'update':

            break
        case 'upload':
        default:
            break
    }
}
function mTogglePassphrase(bShowInput=true){
    const passphraseInputContainer = document.getElementById(`personal-avatar-passphrase-container`)
    const passphraseInput = document.getElementById(`personal-avatar-passphrase`)
    const passphraseResetButton = document.getElementById(`passphrase-reset-button`)
    const passphraseSubmitButton = document.getElementById(`personal-avatar-passphrase-submit`)
    /* set properties */
    passphraseInput.value = ''
    passphraseInput.placeholder = 'Enter new passphrase...'
    hide(passphraseSubmitButton)
    if(bShowInput){
        passphraseInput.focus()
        hide(passphraseResetButton)
        show(passphraseInputContainer)
    } else {
        passphraseInput.blur()
        passphraseResetButton.addEventListener('click', mResetPassphrase, { once: true })
        hide(passphraseInputContainer)
        show(passphraseResetButton)
    }
}
/**
 * Activates bot bar icon and container. Creates div and icon in bot bar.
 * @returns {void}
 */
function updateBotBar(){
    const { activeBot, pageBots, } = mState
    console.log('updateBotBar()', pageBots, activeBot)
    const botBar = document.getElementById('bot-bar')
    botBar.innerHTML = '' // clear existing
    // add personal-avatar
    pageBots.forEach(bot => {
        // Create a container div for each bot
        const botContainer = document.createElement('div')
        botContainer.classList.add('bot-thumb-container')
        // Create an icon element for each bot container
        const botIconImage = document.createElement('img')
        botIconImage.classList.add('bot-thumb')
        botIconImage.src = botIcon(bot.type)
        botIconImage.alt = bot.type
        if (bot.id === activeBot.id) {
            botIconImage.classList.add('active-bot') // Apply a special class for the active bot
        }
        botIconImage.id = `bot-bar-icon_${bot.id}`
        botIconImage.dataset.botId = bot.id
        botIconImage.addEventListener('click', setActiveBot)
        botBar.appendChild(botIconImage)
    })
}
/**
 * Updates bot-widget containers for whom there is data. If no bot data exists, ignores container.
 * @todo - creation mechanism for new bots or to `reinitialize` or `reset` current bots, like avatar.
 * @todo - architect  better mechanic for populating and managing bot-specific options
 * @returns {void}
 */
function updateBotContainers(){
    const { activeBot, pageBots, } = mState
    /* iterate over bot containers */
    document.querySelectorAll('.bot-container').forEach(botContainer=>{
        const bot = pageBots.find(bot => bot.type === botContainer.id)
        if(!bot)
            return /* no problem if not found, available on different team */
        const type = botContainer.id
        const _mbrHandle = mGlobals.getHandle(activeBot.mbr_id)
        /* attributes */
        const attributes = [
            { name: 'active', value: activeBot.id === bot.id ? 'true' : 'false' },
            { name: 'bot_id', value: bot.bot_id },
            { name: 'bot_name', value: bot.bot_name ?? `${ _mbrHandle }-${ type }` },
            { name: 'id', value: bot.id },
            { name: 'mbr_id', value: activeBot.mbr_id },
            { name: 'mbr_handle', value: _mbrHandle },
            { name: 'provider', value: bot.provider ?? '' },
            { name: 'purpose', value: bot.purpose ?? `To assist ${ _mbrHandle } with tasks as their ${ type }` },
            { name: 'thread_id', value: bot.thread_id ?? '' },
            { name: 'type', value: type },
        ]
        /* constants */
        const botStatus = document.getElementById(`${ type }-status`)
        const botOptions = document.getElementById(`${ type }-options`)
        const botIcon = document.getElementById(`${ type }-icon`)
        const botOptionsDropdown = document.getElementById(`${ type }-options-dropdown`)
        /* container listeners */
        botContainer.addEventListener('click', toggleBotContainerOptions)
        /* universal logic */
        bot.status = bot.status
            ?? getStatus(bot, botIcon)
        attributes.forEach(attribute =>{
            const { name, value, } = attribute
            botContainer.setAttribute(`data-${ name }`, value)
            const element = document.getElementById(`${ type }-${ name }`)
            if(element){
                const botInput = element.querySelector('input')
                if(botInput)
                    botInput.value = botContainer.getAttribute(`data-${ name }`)
            }
        })
        /* ticker logic */
        mUpdateTicker(type)
        /* interests */
        mUpdateInterests(type, bot.interests, botContainer)
        /* narrative slider */
        mUpdateNarrativeSlider(type, bot.narrative, botContainer)
        /* privacy slider */
        mUpdatePrivacySlider(type, bot.privacy, botContainer)
        /* type-specific logic */
        switch(type){
            case 'personal-avatar':
                /* attach avatar listeners */
                const passphraseResetButton = document.getElementById(`passphrase-reset-button`)
                passphraseResetButton.addEventListener('click', mResetPassphrase, { once: true })
                /* date of birth (dob) */
                botContainer.setAttribute('data-dob', bot.dob?.split('T')[0] ?? '')
                const memberDobInput = document.getElementById(`${ type }-input-dob`)
                memberDobInput.value = botContainer.getAttribute('data-dob')
                memberDobInput.addEventListener('input', event=>{
                    botContainer.setAttribute('data-dob', memberDobInput.value)
                    memberDobInput.value = botContainer.getAttribute('data-dob')
                })
                break
            case 'personal-biographer':
                break
            default:
                break
        }
        show(botContainer)
    })
}
/**
 * Update the bot interests checkbox structure with specifics.
 * @param {string} type - The bot type.
 * @param {string} interests - The member's interests.
 * @param {HTMLElement} botContainer - The bot container.
 * @returns {void}
 */
function mUpdateInterests(type, memberInterests, botContainer){
    const interests = document.getElementById(`${ type }-interests`)
    if(!interests)
        return
    const checkboxes = interests.querySelectorAll('input[type="checkbox"]')
    if(memberInterests?.length){
        botContainer.setAttribute('data-interests', memberInterests)
        const interestsArray = memberInterests.split('; ')
        checkboxes.forEach(checkbox=>{
            if(interestsArray.includes(checkbox.value)){
                checkbox.checked = true
            }
        })
    }
    /* add listeners to checkboxes */
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            /* concatenate checked values */
            const checkedValues = Array.from(checkboxes)
                .filter(cb => cb.checked) // Filter only checked checkboxes
                .map(cb => cb.value) // Map to their values
                .join('; ')
            botContainer.setAttribute('data-interests', checkedValues)
        })
    })
}
/**
 * Update the bot narrative slider with specifics.
 * @param {string} type - The bot type.
 * @param {number} narrative - The narrative value.
 * @param {HTMLElement} botContainer - The bot container.
 * @returns {void}
 */
function mUpdateNarrativeSlider(type, narrative, botContainer){
    const narrativeSlider = document.getElementById(`${ type }-narrative`)
    if(narrativeSlider){
        botContainer.setAttribute('data-narrative', narrative ?? narrativeSlider.value)
        narrativeSlider.value = botContainer.getAttribute('data-narrative')
        narrativeSlider.addEventListener('input', event=>{
            botContainer.setAttribute('data-narrative', narrativeSlider.value)
        })
    }
}
/**
 * Update the bot privacy slider with specifics.
 * @param {string} type - The bot type.
 * @param {number} privacy - The privacy value.
 * @param {HTMLElement} botContainer - The bot container.
 * @returns {void}
 */
function mUpdatePrivacySlider(type, privacy, botContainer){
    const privacySlider = document.getElementById(`${ type }-privacy`)
    if(privacySlider){
        botContainer.setAttribute('data-privacy', privacy ?? privacySlider.value)
        privacySlider.value = botContainer.getAttribute('data-privacy')
        privacySlider.addEventListener('input', event=>{
            botContainer.setAttribute('data-privacy', privacySlider.value)
        })
    }
}
/**
 * Update the bot ticker with name from 
 * @param {string} type - The bot type.
 * @returns {void}
 */
function mUpdateTicker(type){
    const botTicker = document.getElementById(`${ type }-name-ticker`)
    const botNameInput = document.getElementById(`${ type }-input-bot_name`)
    if(botTicker)
        botTicker.innerHTML = botNameInput.value
    if(botNameInput)
        botNameInput.addEventListener('input', event=>{
            botContainer.setAttribute('data-bot_name', botNameInput.value)
            if(botTicker)
                botTicker.innerHTML = botNameInput.value
        })
}
/* exports */
export {
    fetchBots,
    updatePageBots,
}