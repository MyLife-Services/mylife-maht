/* bot functionality */
/**
 * Paints bot-greeting to column
 * @param {string|array} _greeting - greeting message(s)
 * @returns {void}
 */
function botGreeting(){
    const _greeting = Array.isArray(_activeBot.greeting)
        ?   _activeBot.greeting
        :   [  
                _activeBot?.greeting
            ?? _activeBot?.description
            ?? _activeBot?.purpose
            ]
    if(!_greeting.length) throw new Error(`No bot-greeting provided.`)
    /* bot-greeting routine */
    setTimeout(() => { // Set a timeout for 1 second to wait for the first line to be fully painted
        // Set another timeout for 7.5 seconds to add the second message
        const timerId = setTimeout(_addIntroductionMessage, 7500)
        /* add listeners */
        window.addEventListener('mousemove', _addIntroductionMessage, { once: true })
        window.addEventListener('click', _addIntroductionMessage, { once: true })
        window.addEventListener('focus', _addIntroductionMessage, { once: true })
        window.addEventListener('scroll', _addIntroductionMessage, { once: true })
        /* local timeout functions */
        function _addIntroductionMessage() { // Clear the 7.5 seconds timeout if any event is triggered
            clearTimeout(timerId)
            _greeting.forEach(__greeting =>{
                addMessageToColumn({ message: __greeting })
            })
            _cleanupListeners()
        }
        /* cleanup */
        function _cleanupListeners() {
            window.removeEventListener('mousemove', _addIntroductionMessage)
            window.removeEventListener('click', _addIntroductionMessage)
            window.removeEventListener('focus', _addIntroductionMessage)
            window.removeEventListener('scroll', _addIntroductionMessage)
        }
    }, 1000)
}
/**
 * Returns icon path string based on bot type.
 * @param {string} _type - bot type
 * @returns {string} icon path
 */
function botIcon(_type){
    let _image = 'png/'
    switch(_type){
        case 'art':
            _image+='art-thumb.png'
            break
        case 'education':
            _image+='education-thumb.png'
            break
        case 'health':
            _image+='health-thumb.png'
            break
        case 'personal-biographer':
            return 'png/biographer-thumb.png'
        case 'resume':
            _image+='resume-thumb.png'
            break
        case 'avatar':
        case 'personal-avatar':
            _image+='personal-avatar-thumb-02.png'
            break
        default:
            _image+='work-thumb.png'
            break
    }
    return _image
}
/**
 * Fetch bots from server, used primarily for initialization of page, though could be requested on-demand.
 * @returns {Promise<Array>} bots
 */
async function fetchBots(){
    const _url = window.location.origin + '/members/bots'
    const response = await fetch(_url)
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
    }
    return await response.json()
}
/**
 * Get bot status based on thread and assistant population.
 * @public
 * @param {object} _bot
 * @param {object} _botIcon - icon <div> element
 * @returns {string} status
 */
function getBotStatus(_bot, _botIcon){
    switch (true) {
        case (_bot?.thread_id?.length>0 || false): // activated
            _botIcon.classList.add('active')
            _botIcon.classList.remove('inactive')
            return 'active'
        case ( _bot?.bot_id?.length>0 || false): // unactivated
            _botIcon.classList.add('inactive')
            _botIcon.classList.remove('active')
            return 'inactive'
        default:
            _botIcon.classList.remove('active', 'inactive')
            return 'none'
    }
}
async function setBot(_bot){
    try {
        const _url = window.location.origin + '/members/bots/' + _bot.id
        const _method = _bot.id?.length ? 'PUT' : 'POST'
        const response = await fetch(_url, {
            method: _method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(_bot)
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
function toggleBotContainerOptions(_event){
    _event.stopPropagation()
    // First, close any currently open containers and rotate their dropdowns back
    const _itemIdSnippet = _event.target.id.split('-').pop()
    switch(_itemIdSnippet){
        case 'create':
            // validate required fields
            /*
            if(!this.getAttribute('data-mbr_id')?.length){
                alert('Please login to create a bot.')
                return
            }
            */
           if(!this.getAttribute('data-bot_name')?.length){
               this.setAttribute('data-bot_name', `${g_dash(this.getAttribute('data-mbr_handle'))}-${this.getAttribute('data-type')}`)
           }
            if(!this.getAttribute('data-dob')?.length){
                alert('Birthdate is required to calibrate your biographer.')
                return
            }
            // mutate bot object
            const _bot = {
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
            switch(_bot.type){
                case 'personal-biographer':
                    _bot.dob = this.getAttribute('data-dob')
                    _bot.interests = this.getAttribute('data-interests')
                    const _n = parseInt(this.getAttribute('data-narrative'), 10)
                    _bot.narrative = isNaN(_n) ? 50 : Math.min(100, Math.max(1, _n))
                    const _pv = parseInt(this.getAttribute('data-privacy'), 10)
                    _bot.privacy = isNaN(_pv) ? 50 : Math.min(100, Math.max(0, _pv))
                    break
                default:
                    break
            }
            // post to endpoint
            const _returnBot = setBot(_bot)
            /* check for success and activate */
            setActiveBot(_bot)
            return
        case 'name':
        case 'ticker':
            // start/stop ticker
            // @todo: double-click to edit in place
            const _span = this.querySelector('span')
                ? this.querySelector('span')
                : _event.target
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
 * @requires _pageBots
 * @requires _activeBot
 */
function updateBotBar() {
    const _botBar = document.getElementById('bot-bar')
    _botBar.innerHTML = '' // clear existing
    // add personal-avatar
    _pageBots.forEach(_bot => {
        // Create a container div for each bot
        const botContainer = document.createElement('div')
        botContainer.classList.add('bot-thumb-container')
        // Create an icon element for each bot container
        const botIconImage = document.createElement('img')
        botIconImage.classList.add('bot-thumb')
        botIconImage.src = botIcon(_bot.type)
        botIconImage.alt = _bot.type
        if (_bot.id === _activeBot.id) {
            botIconImage.classList.add('active-bot') // Apply a special class for the active bot
        }
        botIconImage.id = `bot-bar-icon_${_bot.id}`
        botIconImage.dataset.botId = _bot.id
        botIconImage.addEventListener('click', setActiveBot)
        _botBar.appendChild(botIconImage)
    })
}
/**
 * Updates bot-widget containers with bot data.
 * @requires _pageBots
 * @requires _activeBot
 */
function updateBotContainers(){
    document.querySelectorAll('.bot-container').forEach(_botContainer => {
        const _bot = _pageBots.find(_bot => _bot.type === _botContainer.id)??{ status: 'none' }
        const _type = _botContainer.id
        const _mbrHandle = g_handle(_activeBot.mbr_id)
        /* attributes */
        _botContainer.setAttribute('data-active', _activeBot.id === _bot.id ? 'true' : 'false' )
        _botContainer.setAttribute('data-bot_id', _bot?.bot_id??'')
        _botContainer.setAttribute('data-bot_name', _bot?.bot_name??`${_mbrHandle}-${_type}`)
        _botContainer.setAttribute('data-id', _bot?.id??'')
        _botContainer.setAttribute('data-mbr_id', _activeBot.mbr_id)
        _botContainer.setAttribute('data-mbr_handle', _mbrHandle)
        _botContainer.setAttribute('data-provider', _bot?.provider??'')
        _botContainer.setAttribute('data-purpose', _bot?.purpose??'')
        _botContainer.setAttribute('data-thread_id', _bot?.thread_id??'')
        _botContainer.setAttribute('data-type', _type)
        /* constants */
        const _botStatus = _botContainer.querySelector(`#${_type}-status`)
        const _botOptions = _botContainer.querySelector(`#${_type}-options`)
        const _botIcon = _botStatus.querySelector(`#${_type}-icon`)
        const _botOptionsDropdown = _botStatus.querySelector(`#${_type}-options-dropdown`)
        /* container listeners */
        _botContainer.addEventListener('click', toggleBotContainerOptions)
        /* logic */
        _bot.status = _bot?.status??getBotStatus(_bot, _botIcon) // fill in activation status
        // @todo: architect mechanic for bot-specific options
        switch(_type){
            case 'personal-biographer':
                const _botName = _botOptions.querySelector(`#${_type}-bot_name`)
                const _botNameInput = _botName.querySelector('input')
                _botNameInput.value = _botContainer.getAttribute('data-bot_name')
                const _botNameTicker = document.querySelector(`#${_type}-name-ticker`)
                _botNameInput.value = _botContainer.getAttribute('data-bot_name')
                if(_botNameTicker) _botNameTicker.innerHTML = _botNameInput.value
                _botNameInput.addEventListener('input', function() {
                    _botContainer.setAttribute('data-bot_name', _botNameInput.value)
                    if(_botNameTicker) _botNameTicker.innerHTML = _botNameInput.value
                })
                _botContainer.setAttribute('data-dob', _bot?.dob?.split('T')[0]??'')
                const _botDob = _botContainer.querySelector(`#${_type}-dob`)
                _botDob.value = _botContainer.getAttribute('data-dob')
                _botDob.addEventListener('input', function() {
                    _botContainer.setAttribute('data-dob', _botDob.value)
                    _botDob.value = _botContainer.getAttribute('data-dob')
                })
                const _interests = _botContainer.querySelector(`#${_type}-interests`)
                const _checkboxes = _interests.querySelectorAll('input[type="checkbox"]')
                if(_bot.interests?.length){
                    _botContainer.setAttribute('data-interests', _bot.interests)
                    const _interestsArray = _bot.interests.split('; ')
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
                        _botContainer.setAttribute('data-interests', checkedValues)
                    })
                })
                /* narrative slider */
                const _narrativeSlider = _botContainer.querySelector(`#${_type}-narrative`)
                _botContainer.setAttribute('data-narrative', _bot?.narrative??_narrativeSlider.value)
                _narrativeSlider.value = _botContainer.getAttribute('data-narrative')
                _narrativeSlider.addEventListener('input', function() {
                    _botContainer.setAttribute('data-narrative', _narrativeSlider.value);
                })
                /* privacy slider */
                const _privacySlider = _botContainer.querySelector(`#${_type}-privacy`)
                _botContainer.setAttribute('data-privacy', _bot?.privacy??_privacySlider.value)
                _privacySlider.value = _botContainer.getAttribute('data-privacy')
                _privacySlider.addEventListener('input', function() {
                    _botContainer.setAttribute('data-privacy', _privacySlider.value);
                })
                break
            default:
                break
        }
    })
}/**
 * Proxy to update bot-bar, bot-containers, and bot-greeting, if desired.
 * @param {boolean} bIncludeGreeting 
 */
async function updatePageBots(bIncludeGreeting=false){
    updateBotBar()
    updateBotContainers()
    if(bIncludeGreeting) botGreeting()
}
