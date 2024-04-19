/* bot functionality */
/* imports */
import {
    addMessageToColumn,
    setActiveBot,
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
 * Get bot status based on thread and assistant population.
 * @public
 * @param {object} bot
 * @param {object} botIcon - icon <div> element
 * @returns {string} status
 */
function getBotStatus(bot, botIcon){
    switch (true) {
        case (bot?.thread_id?.length>0 || false): // activated
            botIcon.classList.add('active')
            botIcon.classList.remove('inactive')
            return 'active'
        case ( bot?.bot_id?.length>0 || false): // unactivated
            botIcon.classList.add('inactive')
            botIcon.classList.remove('active')
            return 'inactive'
        default:
            botIcon.classList.remove('active', 'inactive')
            return 'none'
    }
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
function toggleBotContainerOptions(event){
    event.stopPropagation()
    // First, close any currently open containers and rotate their dropdowns back
    const itemIdSnippet = event.target.id.split('-').pop()
    switch(itemIdSnippet){
        case 'create':
            // validate required fields
            /*
            if(!this.getAttribute('data-mbr_id')?.length){
                alert('Please login to create a bot.')
                return
            }
            */
           if(!this.getAttribute('data-bot_name')?.length){
               this.setAttribute('data-bot_name', `${mGlobals.variableIze(this.getAttribute('data-mbr_handle'))}-${this.getAttribute('data-type')}`)
           }
            if(!this.getAttribute('data-dob')?.length){
                alert('Birthdate is required to calibrate your biographer.')
                return
            }
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
                case 'personal-biographer':
                    bot.dob = this.getAttribute('data-dob')
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
            });
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
        default:
            break
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
 * Updates bot-widget containers with bot data.
 * @returns {void}
 */
function updateBotContainers(){
    const { activeBot, pageBots, } = mState
    document.querySelectorAll('.bot-container').forEach(botContainer => {
        const bot = pageBots.find(bot => bot.type === botContainer.id)??{ status: 'none' }
        const _type = botContainer.id
        const _mbrHandle = mGlobals.getHandle(activeBot.mbr_id)
        /* attributes */
        botContainer.setAttribute('data-active', activeBot.id === bot.id ? 'true' : 'false' )
        botContainer.setAttribute('data-bot_id', bot?.bot_id??'')
        botContainer.setAttribute('data-bot_name', bot?.bot_name??`${_mbrHandle}-${_type}`)
        botContainer.setAttribute('data-id', bot?.id??'')
        botContainer.setAttribute('data-mbr_id', activeBot.mbr_id)
        botContainer.setAttribute('data-mbr_handle', _mbrHandle)
        botContainer.setAttribute('data-provider', bot?.provider??'')
        botContainer.setAttribute('data-purpose', bot?.purpose??'')
        botContainer.setAttribute('data-thread_id', bot?.thread_id??'')
        botContainer.setAttribute('data-type', _type)
        /* constants */
        const botStatus = botContainer.querySelector(`#${_type}-status`)
        const botOptions = botContainer.querySelector(`#${_type}-options`)
        const botIcon = botStatus.querySelector(`#${_type}-icon`)
        const botOptionsDropdown = botStatus.querySelector(`#${_type}-options-dropdown`)
        /* container listeners */
        botContainer.addEventListener('click', toggleBotContainerOptions)
        /* logic */
        bot.status = bot?.status??getBotStatus(bot, botIcon) // fill in activation status
        // @todo: architect mechanic for bot-specific options
        switch(_type){
            case 'personal-biographer':
                const botName = botOptions.querySelector(`#${_type}-bot_name`)
                const botNameInput = botName.querySelector('input')
                botNameInput.value = botContainer.getAttribute('data-bot_name')
                const botNameTicker = document.querySelector(`#${_type}-name-ticker`)
                botNameInput.value = botContainer.getAttribute('data-bot_name')
                if(botNameTicker) botNameTicker.innerHTML = botNameInput.value
                botNameInput.addEventListener('input', function() {
                    botContainer.setAttribute('data-bot_name', botNameInput.value)
                    if(botNameTicker) botNameTicker.innerHTML = botNameInput.value
                })
                /*
                botContainer.setAttribute('data-dob', bot?.dob?.split('T')[0]??'')
                const botDob = botContainer.querySelector(`#${_type}-dob`)
                botDob.value = botContainer.getAttribute('data-dob')
                botDob.addEventListener('input', function() {
                    botContainer.setAttribute('data-dob', botDob.value)
                    botDob.value = botContainer.getAttribute('data-dob')
                })
                */
                const _interests = botContainer.querySelector(`#${_type}-interests`)
                const _checkboxes = _interests.querySelectorAll('input[type="checkbox"]')
                if(bot.interests?.length){
                    botContainer.setAttribute('data-interests', bot.interests)
                    const _interestsArray = bot.interests.split('; ')
                    _checkboxes.forEach(_checkbox => {
                        if(_interestsArray.includes(_checkbox.value)){
                            _checkbox.checked = true
                        }
                    })
                }
                /* add listeners to checkboxes */
                _checkboxes.forEach(_checkbox => {
                    _checkbox.addEventListener('change', function() {
                        /* concatenate checked values */
                        const checkedValues = Array.from(_checkboxes)
                            .filter(cb => cb.checked) // Filter only checked checkboxes
                            .map(cb => cb.value) // Map to their values
                            .join('; ')
                        botContainer.setAttribute('data-interests', checkedValues)
                    })
                })
                /* narrative slider */
                const narrativeSlider = botContainer.querySelector(`#${_type}-narrative`)
                botContainer.setAttribute('data-narrative', bot?.narrative??narrativeSlider.value)
                narrativeSlider.value = botContainer.getAttribute('data-narrative')
                narrativeSlider.addEventListener('input', function() {
                    botContainer.setAttribute('data-narrative', narrativeSlider.value);
                })
                /* privacy slider */
                const privacySlider = botContainer.querySelector(`#${_type}-privacy`)
                botContainer.setAttribute('data-privacy', bot?.privacy??privacySlider.value)
                privacySlider.value = botContainer.getAttribute('data-privacy')
                privacySlider.addEventListener('input', function() {
                    botContainer.setAttribute('data-privacy', privacySlider.value);
                })
                break
            default:
                break
        }
    })
}
/* exports */
export {
    fetchBots,
    updatePageBots,
}