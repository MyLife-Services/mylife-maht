/* bot functionality */
/* imports */
import {
    addMessageToColumn,
    hide,
    inExperience,
    show,
} from './members.mjs'
import Globals from './globals.mjs'
/* constants */
const botBar = document.getElementById('bot-bar'),
    mGlobals = new Globals(),
    passphraseCancelButton = document.getElementById(`personal-avatar-passphrase-cancel`),
    passphraseInput = document.getElementById(`personal-avatar-passphrase`),
    passphraseInputContainer = document.getElementById(`personal-avatar-passphrase-container`),
    passphraseResetButton = document.getElementById(`passphrase-reset-button`),
    passphraseSubmitButton = document.getElementById(`personal-avatar-passphrase-submit`)
/* variables */
let mActiveBot,
    mPageBots
/* onDomContentLoaded */
document.addEventListener('DOMContentLoaded', async event=>{
    const { bots, activeBotId: id } = await fetchBots()
    if(!bots?.length)
        throw new Error(`No bots found.`)
    mPageBots = bots
    mActiveBot = mBot(id)
    updatePageBots()
})
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
 * Set active bot on server and update page bots.
 * @requires mActiveBot
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function setActiveBot(event){
    const botId = event.target?.dataset?.botId
        ?? event.target.id.split('-').slice(0, -1).join('-')
    const bot = mBot(botId)
    mActiveBot = mActiveBot
        ?? bot
    if(!bot)
        throw new Error(`Bot not found.`)
    if(bot===mActiveBot)
        return
    const { id, } = bot
    /* server request: set active bot */
    const _id = await fetch(
        '/members/bots/activate/' + id,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`)
            }
            return response.json()
        })
        .then(response => {
            return response.activeBotId
        })
        .catch(error => {
            console.log('Error:', error)
            return
        })
    /* update active bot */
    mActiveBot = bot
    updatePageBots(true)
}
/**
 * Proxy to update bot-bar, bot-containers, and bot-greeting, if desired. Requirements should come from including module, here `members.mjs`.
 * @public
 * @requires mGreeting()
 * @param {boolean} bIncludeGreeting - Include bot-greeting.
 * @returns {void}
 */
async function updatePageBots(bIncludeGreeting=false){
    mUpdateBotContainers()
    mUpdateBotBar()
    if(bIncludeGreeting)
        mGreeting()
}
/* private functions */
/**
 * Find bot in mPageBots by id.
 * @requires mPageBots
 * @param {string} type - The bot type.
 * @returns {object} - The bot object.
 */
function mBot(type){
    return mPageBots.find(bot=>bot.type===type)
        ?? mPageBots.find(bot=>bot.id===type)
}
/**
 * Check if bot is active (by id).
 * @param {Guid} id 
 * @returns 
 */
function mBotActive(id) {
    return (id && mActiveBot && id===mActiveBot.id)
}
/**
 * Returns icon path string based on bot type.
 * @param {string} type - bot type
 * @returns {string} icon path
 */
function mBotIcon(type){
    let image = 'png/'
    switch(type){
        case 'art':
            image+='art-thumb.png'
            break
        case 'avatar':
        case 'personal-avatar':
            image+='personal-avatar-thumb-02.png'
            break
        case 'diary':
        case 'diarist':
        case 'journal':
        case 'journaler':
            image+='journal-thumb.png'
            break
        case 'education':
            image+='education-thumb.png'
            break
        case 'health':
            image+='health-thumb.png'
            break
        case 'library':
            image+='library-thumb.png'
            break
        case 'personal-biographer':
            return 'png/biographer-thumb.png'
        case 'resume':
            image+='resume-thumb.png'
            break
        case 'ubi':
            image+='ubi-thumb.png'
            break
        default:
            image+='work-thumb.png'
            break
    }
    return image
}
/**
 * Sets bot status based on active bot, thread, and assistant population.
 * @private
 * @requires mActiveBot
 * @param {object} bot - The bot object.
 * @returns {string} - Determined status.
 */
function mSetBotIconStatus(bot){
    const { bot_id, id, thread_id, type, } = bot
    const botIcon = document.getElementById(`${ type }-icon`)
    switch(true){
        case ( mActiveBot && mActiveBot.id===id): // activated
            botIcon.classList.remove('online', 'offline', 'error')
            botIcon.classList.add('active')
            return 'active'
        case ( thread_id?.length>0 || false ): // online
            botIcon.classList.remove('active', 'offline', 'error')
            botIcon.classList.add('online')
            return 'online'
        case ( bot_id?.length>0 ): // offline
            botIcon.classList.remove('active', 'online', 'error')
            botIcon.classList.add('offline')
            return 'inactive'
        default: // error
            botIcon.classList.remove('active', 'online', 'offline')
            botIcon.classList.add('error')
            return 'error'
    }
}
/**
 * Paints bot-greeting to column
 * @private
 * @requires mActiveBot
 * @returns {void}
 */
function mGreeting(){
    const greeting = Array.isArray(mActiveBot.greeting)
        ?   mActiveBot.greeting
        :   [
                mActiveBot?.greeting
            ?? mActiveBot?.description
            ?? mActiveBot?.purpose
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
 * Toggle submit button for input passphrase.
 * @requires passphraseInput
 * @returns {void}
 */
function mInputPassphrase(){
    if(passphraseInput?.value?.length)
        show(passphraseSubmitButton)
    else
        hide(passphraseSubmitButton)
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
        let response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bot)
        })
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`)
        }
        response = await response.json()
        console.log('Success:', response)
        return response
    } catch (error) {
        console.log('Error posting bot data:', error)
        return error
    }
}
/**
 * Sets bot attributes on bot container.
 * @requires mGlobals
 * @param {object} bot - The bot object.
 * @param {HTMLDivElement} botContainer - The bot container.
 * @returns {void}
 */
function mSetAttributes(bot, botContainer){
    const { bot_id: botId, bot_name: botName, id, mbr_id, provider, purpose, thread_id: threadId, type, } = bot
    const memberHandle = mGlobals.getHandle(mActiveBot.mbr_id)
    /* attributes */
    const attributes = [
        { name: 'active', value: mBotActive(id) },
        { name: 'bot_id', value: botId },
        { name: 'bot_name', value: botName ?? `${ memberHandle }-${ type }` },
        { name: 'id', value: id },
        { name: 'mbr_id', value: mbr_id },
        { name: 'mbr_handle', value: memberHandle },
        { name: 'provider', value: provider ?? 'openai' },
        { name: 'purpose', value: purpose ?? `To assist ${ memberHandle } with tasks as their ${ type }` },
        { name: 'thread_id', value: threadId ?? '' },
        { name: 'type', value: type },
    ]
    attributes.forEach(attribute=>{
        const { name, value, } = attribute
        botContainer.setAttribute(`data-${ name }`, value)
        const element = document.getElementById(`${ type }-${ name }`)
        if(element){
            const botInput = element.querySelector('input')
            if(botInput)
                botInput.value = botContainer.getAttribute(`data-${ name }`)
        }
    })
}
/**
 * Submit updated passphrase for MyLife via avatar.
 * @private
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mSubmitPassphrase(event){
    const { value, } = passphraseInput
    if(!value?.length)
        return
    try{
        /* submit to server */
        const url = window.location.origin + '/members/passphrase'
        const method = 'POST'
        let response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ passphrase: value })
        })
        if(!response.ok)
            throw new Error(`HTTP error! Status: ${response.status}`)
        response = await response.json()
        if(!response.success)
            throw new Error(`Passphrase "${ value }" not accepted.`)
        mTogglePassphrase(false)
    } catch(err){
        console.log('Error submitting passphrase:', err)
        mTogglePassphrase(true)
    }
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
            // setBot(bot) // post to endpoint, update server
            /* check for success and activate */
            // setActiveBot(bot)
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
            const updateBot = {
                bot_name: this.getAttribute('data-bot_name'),
                id: this.getAttribute('data-id'),
                type: this.getAttribute('data-type'),
            }
            if(this.getAttribute('data-dob')?.length)
                updateBot.dob = this.getAttribute('data-dob')
            if(this.getAttribute('data-interests')?.length)
                updateBot.interests = this.getAttribute('data-interests')
            if(this.getAttribute('data-narrative')?.length)
                updateBot.narrative = this.getAttribute('data-narrative')
            if(this.getAttribute('data-privacy')?.length)
                updateBot.privacy = this.getAttribute('data-privacy')
            if(!setBot(updateBot))
                throw new Error(`Error updating bot.`)
            break
        case 'upload':
        default:
            break
    }
}
function mTogglePassphrase(event){
    /* set properties */
    passphraseInput.value = ''
    passphraseInput.placeholder = 'Enter new passphrase...'
    hide(passphraseSubmitButton)
    if(event.target===passphraseResetButton){
        passphraseInput.focus()
        passphraseInput.addEventListener('input', mInputPassphrase)
        passphraseCancelButton.addEventListener('click', mTogglePassphrase, { once: true })
        passphraseSubmitButton.addEventListener('click', mSubmitPassphrase)
        hide(passphraseResetButton)
        show(passphraseInputContainer)
    } else {
        passphraseInput.blur()
        passphraseInput.removeEventListener('input', mInputPassphrase)
        passphraseSubmitButton.removeEventListener('click', mSubmitPassphrase)
        passphraseResetButton.addEventListener('click', mTogglePassphrase, { once: true })
        hide(passphraseInputContainer)
        show(passphraseResetButton)
    }
}
/**
 * Activates bot bar icon and container. Creates div and icon in bot bar.
 * @todo - limit to bots that actually show on sidebar?
 * @requires mActiveBot
 * @requires mPageBots
 * @returns {void}
 */
function mUpdateBotBar(){
    botBar.innerHTML = '' // clear existing
    mPageBots.forEach(bot => {
        // Create a container div for each bot
        const botContainer = document.createElement('div')
        botContainer.classList.add('bot-thumb-container')
        // Create an icon element for each bot container
        const botIconImage = document.createElement('img')
        botIconImage.classList.add('bot-thumb')
        botIconImage.src = mBotIcon(bot.type)
        botIconImage.alt = bot.type
        if(bot===mActiveBot){
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
 * @requires mActiveBot
 * @requires mPageBots
 * @returns {void}
 */
function mUpdateBotContainers(){
    /* iterate over bot containers */
    document.querySelectorAll('.bot-container').forEach(botContainer=>{
        const { dataset, id: type, } = botContainer
        const bot = mBot(type)
        if(!bot)
            return /* no problem if not found, available on different team */
        /* constants */
        const botStatus = document.getElementById(`${ type }-status`)
        const botOptions = document.getElementById(`${ type }-options`)
        const botOptionsDropdown = document.getElementById(`${ type }-options-dropdown`)
        /* container listeners */
        botContainer.addEventListener('click', toggleBotContainerOptions)
        botStatus.addEventListener('click', setActiveBot)
        /* universal logic */
        mSetBotIconStatus(bot)
        mSetAttributes(bot, botContainer)
        mUpdateTicker(type, botContainer)
        mUpdateInterests(type, bot.interests, botContainer)
        mUpdateNarrativeSlider(type, bot.narrative, botContainer)
        mUpdatePrivacySlider(type, bot.privacy, botContainer)
        /* type-specific logic */
        switch(type){
            case 'personal-avatar':
                /* attach avatar listeners */
                mTogglePassphrase(false)
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
 * Update the bot ticker with value from name input, and assert to `data-bot_name`.S
 * @param {string} type - The bot type.
 * @param {HTMLElement} botContainer - The bot container.
 * @returns {void}
 */
function mUpdateTicker(type, botContainer){
    const botTicker = document.getElementById(`${ type }-name-ticker`)
    const botNameInput = document.getElementById(`${ type }-input-bot_name`)
    if(botTicker)
        mUpdateTickerValue(botTicker, botNameInput.value)
    if(botNameInput)
        botNameInput.addEventListener('input', event=>{
            const { value, } = event.target
            mUpdateTickerValue(botTicker, value)
            botContainer.setAttribute('data-bot_name', value)
        })
}
/**
 * Simple proxy to update tickers innerHTML.
 * @param {HTMLDivElement} ticker - The ticker element.
 * @param {string} value - The value to update.
 * @returns {void}
 */
function mUpdateTickerValue(ticker, value){
    ticker.innerText = value
}
/* exports */
// @todo - export combine of fetchBots and updatePageBots
export {
    fetchBots,
    setActiveBot,
    updatePageBots,
}