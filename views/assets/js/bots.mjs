/* bot functionality */
/* imports */
import {
    activeChat,
    activeClose,
    activeItem,
    activeStatus,
    activeTitle,
    createItem,
    endMemory,
    getCollection,
    getItem,
    init as initCollections,
    refreshCollection,
    setActiveItem,
    togglePopup,
    unsetActiveItem,
    updateActiveItemTitle,
    updateItem,
    updateItemSummary,
    updateItemTitle,
    updateTitle,
} from './collections.mjs'
import {
    addInput,
    addMessage,
    addMessages,
    clearSystemChat,
    decorateActiveBot,
    enactInstruction,
    experiences,
    expunge,
    globals,
    hide,
    introduction,
    mainContent,
    overlays,
    privacyPolicy,
    seedInput,
    replaceElement,
    routine,
    setActiveAction,
    show,
    startDrag,
    startExperience,
    submit,
    toggleMemberInput,
    toggleVisibility,
    unsetActiveAction,
} from './members.mjs'
const mAvailableUploaderTypes = ['personal-avatar'],
    mAvatarTypes = ['avatar', 'personal-avatar'],
    mBotMount = document.getElementById('bot-mount'),
    mDefaultTeam = 'memory',
    mSidebar = document.getElementById('sidebar'),
    mTeamAddMemberIcon = document.getElementById('add-team-member-icon'),
    mTeamHeader = document.getElementById('team-header'),
    mTeamName = document.getElementById('team-name'),
    mTeamPopup = document.getElementById('team-popup'),
    mTeams = [],
    mTutorialId = 'aae28fe4-30f9-4c29-9174-a0616569e762',
    mTutorialOriginal = '88043968-d7ef-4a57-a923-335bc9f92792'
/* variables */
let mActiveBot,
    mActiveTeam,
    mBots
/* public functions */
async function init(){
    /* teams */
    mTeams.push(...await globals.datamanager.teams())
    if(!mTeams?.length)
        throw new Error(`ERROR: No teams returned from server.`)
    if(mTeams.length > 1)
        mTeamName.addEventListener('click', mCreateTeamSelect)
    mTeamAddMemberIcon.addEventListener('click', mCreateTeamMemberSelect)
    const { bots, activeBotId: id } = await globals.datamanager.bots()
    if(!bots?.length)
        throw new Error(`ERROR: No bots returned from server`)
    mBots = bots
    await getActiveTeam() // sets activeTeam()
    // bring back setActiveTeam display elements
}
/**
 * Get active bot.
 * @public
 * @returns {object} - The active bot object.
 */
function activeBot(){
    return mActiveBot
}
function activeTeam(){
    return mActiveTeam
}
/**
 * Get default Action population from active bot.
 * @todo - remove hardcoding
 * @public
 * @returns {object} - The active bot default Action object
 * @param {object} instructions - The action object describing how to populate { button, callback, icon, status, text, thumb, }.
 * @property {string} button - The button text; if false-y, no button is displayed
 * @property {function} callback - The callback function to execute on button click
 * @property {string} icon - The icon class to display
 * @property {string} status - The status text to display
 * @property {string} text - The text to display
 * @property {string} thumb - The thumbnail image URL
 */
function getAction(type='avatar'){
    let instructions
    switch(type){
        case 'biographer':
        case 'personal-biographer':
            instructions = {
                button: `Make a Memory`,
                callback: async function(event){
                    const actionButton = event.target
                    actionButton.disabled = true
                    const response = await submit('## PRINT\nCreate the summary from our conversation since the last saved memory.')
                    unsetActiveAction()
                    if(!response?.success)
                        addMessage('An error occurred while talking to the server. Try again.', 'error')
                    else {
                        enactInstruction(response.instruction, 'chat', { createItem, })
                        addMessages(response.responses, type)
                    }
                },
                icon: 'fa-play',
                status: 'Let\'s',
                text: 'from our chat',
                thumb: '/png/Q.png',
            }
        case 'avatar':
        case 'diary':
        case 'diarist':
        case 'journal':
        case 'journaler':
        case 'personal-avatar':
        default:
            break
    }
    return instructions
}
async function getActiveBot(){
    const currentActiveBot = await globals.datamanager.bot()
    if(currentActiveBot?.id?.length){
        if(!getBot(currentActiveBot.id))
            mBots.push(currentActiveBot)
        if(mActiveBot?.id!==currentActiveBot.id)
            await setActiveBot(currentActiveBot.id)
    }
}
async function getActiveTeam(){
    const currentActiveTeam = await globals.datamanager.team()
    if(currentActiveTeam?.id?.length && mActiveTeam?.id!==currentActiveTeam.id)
        mActiveTeam = currentActiveTeam
    await mUpdateTeams()
}
/**
 * Get specific bot by id (first) or type.
 * @param {string} type - The bot type, optional.
 * @param {Guid} id - The bot id, optional.
 * @returns {object} - The bot object.
 */
function getBot(type='personal-avatar', id){
    return mBot(id ?? type)
        ?? mActiveBot
}
function getBotIcon(type){
    return mBotIcon(type)
}
/**
 * Gets list of current bots in memory
 * @requires mBots
 * @param {Guid} teamId - The team id to filter by
 * @param {boolean} includeAvatar - Whether or not to include personal avata, defaults to `true`
 * @returns {Object[]} - List of bots
 */
function getBots(teamId, includeAvatar=true){
    const bots = includeAvatar
        ? mBots
        : mBots.filter(bot=>bot.type!=='avatar' && bot.type!=='personal-avatar')
    return bots
}
/**
 * Gets an Array of Bot objects who can service the given form.
 * @param {string} form - The database item format required
 * @returns {Object[]} - The Array of bots who accommodate this form
 */
function getBotsByForm(form){
    if(!typeof form==='string' || !form.length)
        return
    return getBots().filter(bot=>bot.itemForms.includes(form))
}
/**
 * Get team by name or id.
 * @param {string|Guid} identifier - The team name or id to find, defaults to `mDefaultTeam`
 * @returns {object} - The team object: { active, allowCustom, allowProxy, allowedBotTypes, allowedItemTypes, collection, defaultActiveType, defaultTypes, description, id, name, primaryCollectionTypes, title, }
 */
function getTeam(identifier){
    return mTeams.find(team=>team.name===identifier || team.id===identifier)
}
/**
 * Checks if bot type is an avatar (personal or not).
 * @param {string} type - The bot type to check
 * @returns {boolean} - True if the bot is an avatar, false otherwise
 */
function isAvatar(type){
    return mAvatarTypes.includes(type)
}
/**
 * Set active bot on server and update page bots.
 * @requires mActiveBot
 * @requires mBots
 * @param {Guid} botId - The bot id
 * @param {boolean} dynamic - Whether or not to add dynamic greeting, only triggered from source code
 * @returns {void}
 */
async function setActiveBot(botId, displayGreeting=true){
    if(!globals.isGuid(botId))
        throw new Error(`Invalid bot id: ${ botId }`)
    const initialActiveBot = mActiveBot
    mActiveBot = getBot(null, botId)
        ?? initialActiveBot
    if(!mActiveBot)
        throw new Error(`ERROR: failure to set active bot with id: ${ botId }`)
    if(initialActiveBot===mActiveBot)
        return // no change, no problem
    const { id, type, } = mActiveBot
    const { bot_id, firstAccess, responses=[], routine: botRoutine, success=false, version, versionUpdate, } = await globals.datamanager.botActivate(id)
    if(!success)
        throw new Error(`Server unsuccessful at setting active bot.`)
    /* update page bot data */
    const { activated=[], activatedFirst=Date.now(), } = mActiveBot
    mActiveBot.activatedFirst = activatedFirst
    activated.push(Date.now()) // newest date is last to .pop()
    mActiveBot.activated = activated
    mActiveBot.versionUpdate = versionUpdate
    if(versionUpdate!==version){
        const botVersion = document.getElementById(`${ id }-title-version`)
            ?? document.getElementById(`${ type }-title-version`)
        if(botVersion)
            botVersion.classList.add('update-available')
    }
    /* update page */
    mSpotlightBotStatus()
    if(firstAccess && botRoutine?.length)
        routine(botRoutine)
    else if(displayGreeting && responses.length)
        addMessages(responses, type)
    else if(displayGreeting)
        addMessage(mActiveBot.purpose, type)
    decorateActiveBot(mActiveBot)
}
/**
 * Set active team on server and update page team data. If no identifier provided, defaults to `mDefaultTeam`, then active team, then first team in list.
 * @param {string|Guid} teamIdentifier - The team name or id to find, defaults to `mDefaultTeam`
 * @returns {Promise<void>}
 */
async function setActiveTeam(teamIdentifier=mDefaultTeam){
    const team = getTeam(teamIdentifier)
        ?? mTeams.find(team=>team.active===true)
        ?? mTeams[0]
    const { active, id, } = team
    if(id===mActiveTeam?.id)
        return // no change, no problem
    const { botResponse, team: activeTeam, } = await globals.datamanager.teamActivate(id)
    const { defaultActiveType, id: activeTeamId, } = team ?? {}
    const { id: bot_id=getBot(null, defaultActiveType), responses=[], } = botResponse ?? {}
    if(activeTeam?.id!==id)
        throw new Error(`Server failure trying to activate team "${ identifier }".`)
    mActiveTeam = team
    await mUpdateTeams() // sets active bot
}
/**
 * Toggles bot containers and checks for various actions on master click of `this` bot-container. Sub-elements appear as targets and are rendered appropriately.
 * @private
 * @async
 * @param {Event} event - The event object, represents entire bot box as `this`
 * @returns {void}
 */
function toggleBotContainers(event){
    mToggleBotContainers(event) // no await
}
/**
 * Proxy to update bot-containers and bot-greeting.
 * @public
 * @requires mBots
 * @param {Array} bots - The bot objects to update page with.
 * @param {boolean} includeGreeting - Include bot-greeting.
 * @returns {void}
 */
async function updatePageBots(includeGreeting=false, dynamic=false){
    await mUpdateBotContainers()
    if(includeGreeting && mActiveBot?.greeting?.length)
        addMessage(mActiveBot.greeting, mActiveBot.type)
}
/* private functions */
/**
 * Find bot in mBots by id.
 * @requires mBots
 * @param {string} type - The bot type or id
 * @returns {object} - The bot object
 */
function mBot(type='avatar'){
    const heritageType = type.replace('personal-', '')
    return mBots.find(bot=>bot.type===type)
        ?? mBots.find(bot=>bot.type===heritageType)
        ?? mBots.find(bot=>bot.type===`personal-${ type }`)
        ?? mBots.find(bot=>bot.id===type)
}
/**
 * Check if bot is active (by id).
 * @param {Guid} id - The bot id to check
 * @returns {boolean} - True if the bot is active, false otherwise
 */
function mBotActive(id){
    return id===mActiveBot?.id
        ?? false
}
/**
 * Returns icon path string based on bot type.
 * @param {string} type - bot type
 * @returns {string} - icon path
 */
function mBotIcon(type){
    let image = 'png/'
    switch(type){
        case 'art':
            image+='art-thumb.png'
            break
        case 'avatar':
        case 'personal-avatar':
            image+='avatar-thumb.png'
            break
        case 'diary':
        case 'diarist':
            image+='diary-thumb.png'
            break
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
        case 'biographer':
            image+='biographer-thumb.png'
            break
        case 'political-stance':
        case 'stance':
            image+='stance-thumb.png'
            break
        case 'political-values':
        case 'values':
            image+='values-thumb.png'
            break
        case 'proxy':
        case 'proxy-agent':
            image+='Q.png'
            break
        case 'resume':
            image+='resume-thumb.png'
            break
        case 'system':
            image+='Q.png'
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
async function mBotNameChange(e){
    const nameInput = e.target
    const botId = globals.extractId(nameInput.id)
    const bot = getBot(botId) // will match either `id` or `type`
    const { id, name, type, } = bot
    const newName = nameInput.value.trim()
    if(!newName?.length){
        nameInput.value = name
        nameInput.focus()
        alert('Bot name cannot be empty. Reverting to current name.')
    } else {
        nameInput.blur()
        nameInput.disabled = true
        const botData = {
            bot_name: newName,
            id,
            type,
        }
        const { name: updatedName, } = await globals.datamanager.botUpdate(botData)
        nameInput.disabled = false
        if(!name?.length) // revert
            nameInput.value = name
        else {
            const botTitleName = document.getElementById(`${ botId }-title-name`)
            botTitleName && (botTitleName.textContent = updatedName)
            bot.name = updatedName
            globals.chatInputPlaceholder = `Type a message to ${ updatedName }...`
        }
    }
    nameInput.addEventListener('change', mBotNameChange, { once: true })
}
/**
 * Creates an options checkbox list for a bot options panel from bot option group data.
 * @private
 * @param {Guid} botId - The bot id (uuid), used as element id prefix
 * @param {object} options - The option object { id, label, options: { id, label, value, }, order, placeholder, range: { max, min, }, title, type, variable, }
 * @returns {HTMLDivElement} - The options container element
 */
function mBotOptionContainer(botId, options){
    const { id, label, title, type, variable, } = options
    if(!id?.length || !type?.length || !variable?.length)
        return
    const containerId = `${ botId }-input-group-${ id }`,
        inputId = `${ botId }-input-${ variable }`
    // option container
    const optionContainer = document.createElement('div')
    optionContainer.classList.add('input-group')
    optionContainer.id = containerId
    // title (applies to container not input)
    if(title?.length){
        const optionTitle = document.createElement('label')
        optionTitle.classList.add('input-group-title')
        optionTitle.htmlFor = containerId
        optionTitle.textContent = title
        optionContainer.appendChild(optionTitle)
    }
    // label
    let optionLabel
    if(label?.length){
        optionLabel = document.createElement('label')
        optionLabel.htmlFor = inputId
        optionLabel.textContent = label
        optionContainer.appendChild(optionLabel)
    }
    // input(s)
    switch(type){
        case 'checkbox':
            const { options: items=[], } = options
            if(optionContainer)
                optionContainer.classList.add('options')
            if(!!optionLabel)
                optionLabel.classList.add('options-label')
            const checkboxGroup = document.createElement('div')
            checkboxGroup.classList.add('checkbox-group')
            checkboxGroup.id = inputId
            items.forEach(({ id, value, label: optionLabel, })=>{
                const item = document.createElement('div')
                item.classList.add('checkbox-group-item')
                const checkbox = document.createElement('input')
                checkbox.type = 'checkbox'
                checkbox.name = variable
                checkbox.id = `${ botId }-${ id }`
                checkbox.value = value
                const itemLabel = document.createElement('label')
                itemLabel.htmlFor = `${ botId }-${ id }`
                itemLabel.textContent = optionLabel
                item.appendChild(checkbox)
                item.appendChild(itemLabel)
                checkboxGroup.appendChild(item)
            })
            optionContainer.appendChild(checkboxGroup)
            break
        case 'text':
        default:
            const { placeholder, } = options
            const inputField = document.createElement('input')
            inputField.type = 'text'
            inputField.id = inputId
            inputField.placeholder = placeholder
            optionContainer.appendChild(inputField)
            break
    }
    return optionContainer
}
/**
 * Closes the team popup.
 * @param {Event} e - The event object.
 * @returns {void}
 */
function mCloseTeamPopup(e){
    // e.stopPropagation()
    const { ctrlKey, key, target, } = e
    if((key && key!='Escape') && !(ctrlKey && key=='w'))
        return
    document.removeEventListener('keydown', mCloseTeamPopup)
    hide(mTeamPopup)
}
/**
 * Creates bot button for a bot buttons panel from bot button data.
 * @param {Guid} botId - The bot id (uuid)
 * @param {object} button - The button object { id, label, order, type, value, }
 */
function mCreateBotButton(botId, button){
    const { clearSystemChat=false, id, label, order, type, value } = button
    const buttonElement = document.createElement('button')
    buttonElement.classList.add('bot-button', 'button', `${ type }-button`)
    buttonElement.id = id
    buttonElement.textContent = label
    buttonElement.type = 'button'
    let element = buttonElement
    switch(type){
        case 'routine':
            buttonElement.addEventListener('click', ()=>routine(value, clearSystemChat))
            break
        case 'prompt':
            buttonElement.addEventListener('click', ()=>mSubmitPrompt(botId, value, clearSystemChat))
            break
        case 'experience':
            if(globals.isGuid(value))
                buttonElement.addEventListener('click', async ()=>{
                    hide(buttonElement)
                    await startExperience(value)
                }, { once: true })
            break
        case 'passphrase':
            /* passphrase container */
            const passphraseContainer = document.createElement('div')
            passphraseContainer.classList.add('passphrase-container')
            passphraseContainer.id = `passphrase-container-${ id }`
            passphraseContainer.appendChild(buttonElement)
            /* cancel */
            const passphraseCancel = document.createElement('div')
            passphraseCancel.classList.add('fas', 'fa-close', 'passphrase-cancel')
            passphraseCancel.id = `passphrase-cancel-${ id }`
            passphraseContainer.appendChild(passphraseCancel)
            hide(passphraseCancel)
            /* input */
            const passphraseInput = document.createElement('input')
            passphraseInput.classList.add('bot-input', 'passphrase-input')
            passphraseInput.id = `passphrase-input-${ id }`
            passphraseInput.maxLength = 256
            passphraseInput.placeholder = 'Enter new passphrase...'
            passphraseInput.value = null
            passphraseContainer.appendChild(passphraseInput)
            hide(passphraseInput)
            /* submit */
            const passphraseSubmit = document.createElement('div')
            passphraseSubmit.classList.add('fa-solid', 'fa-circle-arrow-right', 'passphrase-submit')
            passphraseSubmit.id = `passphrase-submit-${ id }`
            passphraseContainer.appendChild(passphraseSubmit)
            hide(passphraseSubmit)
            buttonElement.addEventListener('click', mTogglePassphrase, { once: true })
            element = passphraseContainer
            break
        case 'instruction':
            default:
        break
    }
    return element
}
function mCreateBotButtons(botId, buttons=[]){
    const buttonContainer = document.createElement('div')
    buttonContainer.classList.add('bot-buttons')
    buttonContainer.id = `bot-buttons-container-${ botId }`
    buttons
        .slice()
        .sort((a, b)=>(a.order ?? 0) - (b.order ?? 0))
        .forEach(button=>buttonContainer.appendChild(mCreateBotButton(botId, button)))
    return buttonContainer
}
/**
 * Creates a dynamic bot container element for the given bot, replacing hard-coded HTML.
 * @private
 * @requires mBots
 * @requires mBotIcon
 * @param {object} bot - The bot object from mBots
 * @returns {HTMLDivElement} - The bot container element
 */
async function mCreateBotContainer(bot){
    const { buttons=[], description, flags, icon, id, name, options: botOptions=[], purpose, retirable=true, type, version, } = bot
    if(!botOptions.length)
        botOptions.push(...await globals.datamanager.botOptions(id))
    if(!buttons.length)
        buttons.push(...await globals.datamanager.botButtons(id))
    if(!icon?.length)
        bot.icon = mBotIcon(type)
    /* container */
    const container = document.createElement('div')
    container.classList.add('bot-container')
    container.id = id
    /* status bar */
    const status = document.createElement('div')
    status.classList.add('bot-status')
    status.id = `${ id }-status`
    const iconEl = document.createElement('div')
    iconEl.classList.add('bot-icon')
    iconEl.id = `${ id }-icon`
    const thumb = document.createElement('img')
    thumb.classList.add('bot-image')
    thumb.id = `${ id }-thumb`
    thumb.src = icon ? `png/${ icon }` : mBotIcon(type)
    iconEl.appendChild(thumb)
    const title = document.createElement('div')
    title.classList.add('bot-title')
    title.id = `${ id }-title`
    const titleType = document.createElement('div')
    titleType.classList.add('bot-title-type')
    titleType.id = `${ id }-title-type`
    let titleTextContent = type.replace('personal-', '')
    titleTextContent = titleTextContent.charAt(0).toUpperCase() + titleTextContent.slice(1)
    titleType.textContent = titleTextContent
    const titleName = document.createElement('div')
    titleName.classList.add('bot-title-name')
    titleName.id = `${ id }-title-name`
    titleName.textContent = name
    const titleVersion = document.createElement('div')
    titleVersion.classList.add('bot-title-version')
    titleVersion.id = `${ id }-title-version`
    titleVersion.textContent = 'v.' + (version ? version : '1.0')
    title.appendChild(titleType)
    title.appendChild(titleName)
    title.appendChild(titleVersion)
    const dropdown = document.createElement('div')
    dropdown.classList.add('bot-options-dropdown')
    dropdown.id = `${ id }-options-dropdown`
    // add listener to dropdown
    status.appendChild(iconEl)
    status.appendChild(title)
    status.appendChild(dropdown)
    /* options panel */
    const options = document.createElement('div')
    options.classList.add('bot-options', 'hidden')
    options.id = `${ id }-options`
    options.name = 'bot-options'
    /* bot name input */
    const nameGroup = document.createElement('div')
    nameGroup.classList.add('input-group')
    nameGroup.id = `${ id }-bot_name`
    const nameLabel = document.createElement('label')
    nameLabel.htmlFor = `${ id }-input-bot_name`
    nameLabel.textContent = 'Bot Name:'
    const nameInput = document.createElement('input')
    nameInput.classList.add('bot-input', 'bot-name')
    nameInput.id = `${ id }-input-bot_name`
    nameInput.maxLength = 256
    nameInput.value = name
    nameInput.addEventListener('change', mBotNameChange, { once: true })
    nameGroup.appendChild(nameLabel)
    nameGroup.appendChild(nameInput)
    options.appendChild(nameGroup)
    // options panels
    botOptions
        .sort((a, b)=>(a.order ?? 1) - (b.order ?? 1))
        .forEach(option=>{
            const optionsElement = mBotOptionContainer(id, option)
            if(optionsElement)
                options.appendChild(optionsElement)
        })
    // buttons
    options.appendChild(mCreateBotButtons(id, buttons))
    // retirements
    options.appendChild(mCreateRetireContainer(id, retirable))
    container.appendChild(status)
    container.appendChild(options)
    return container
}
/**
 * Creates a bot container for a proxy agent and appends it to the bot mount.
 * @param {object} proxyAgent - The proxy agent
 * @returns {HTMLDivElement} - The proxy bot container element
 */
function mCreateProxyBotContainer(proxyAgent){
    const { access=[], description, id, name, purpose, skills=[], url='A2A', } = proxyAgent
    /* container [begin] */
    const proxyContainer = document.createElement('div')
    proxyContainer.classList.add('bot-container', 'proxy-container')
    proxyContainer.id = id
    /* status [begin] */
    const proxyStatus = document.createElement('div')
    proxyStatus.classList.add('bot-status', 'proxy-status')
    proxyStatus.id = `${ id }-status`
    /* icon */
    const proxyIcon = document.createElement('div')
    proxyIcon.classList.add('bot-icon')
    proxyIcon.id = `${ id }-icon`
    const proxyIconImage = document.createElement('img')
    proxyIconImage.alt = `I am External Agent: ${ name } (${ url })`
    proxyIconImage.classList.add('bot-image')
    proxyIconImage.id = `${ id }-image`
    proxyIconImage.src = mBotIcon('proxy')
    proxyIconImage.title = description
    proxyIcon.appendChild(proxyIconImage)
    /* title */
    const proxyTitle = document.createElement('div')
    proxyTitle.classList.add('bot-title')
    const proxyTitleType = document.createElement('div')
    proxyTitleType.classList.add('bot-title-type', 'proxy-title-type')
    proxyTitleType.id = `${ id }-title-type`
    proxyTitleType.textContent = `Proxy Agent`
    const proxyTitleName = document.createElement('div')
    proxyTitleName.id = `${ id }-title-name`
    proxyTitleName.classList.add('bot-title-name', 'proxy-title-name')
    proxyTitleName.textContent = name
    // no version for external, refreshed differently
    proxyTitle.appendChild(proxyTitleType)
    proxyTitle.appendChild(proxyTitleName)
    /* dropdown caret */
    const proxyDropdown = document.createElement('div')
    proxyDropdown.classList.add('bot-options-dropdown', 'proxy-options-dropdown')
    proxyDropdown.id = `${ id }-options-dropdown`
    /* status [end] */
    proxyStatus.appendChild(proxyIcon)
    proxyStatus.appendChild(proxyTitle)
    proxyStatus.appendChild(proxyDropdown)
    /* options [begin] */
    const proxyOptions = document.createElement('div')
    proxyOptions.classList.add('bot-options', 'hidden', 'proxy-options')
    proxyOptions.id = `${ id }-options`
    proxyOptions.appendChild(mProxyName(id, name))
    proxyOptions.appendChild(mProxyEndpoint(id, url))
    proxyOptions.appendChild(mProxyDescription(id, description))
    proxyOptions.appendChild(mProxySkills(id, skills))
    proxyOptions.appendChild(mProxyPurpose(id, purpose))
    proxyOptions.appendChild(mProxyAccess(id, access))
    proxyOptions.appendChild(mProxyRetire(id))
    /* options [end] */
    proxyContainer.appendChild(proxyStatus)
    proxyContainer.appendChild(proxyOptions)
    /* container [end] */
    return proxyContainer
}
/**
 * Creates the retire container for a bot options panel.
 * @private
 * @param {Guid} id - The bot id (uuid)
 * @param {boolean} retirable - Whether or not the bot is retirable, if false, retire options are hidden/disabled
 * @returns {HTMLDivElement} - The retire container element
 */
function mCreateRetireContainer(id, retirable=false){
    const retireContainer = document.createElement('div')
    retireContainer.classList.add('retire-container')
    retireContainer.id = `${ id }-retire`
    const retireText = document.createElement('div')
    retireText.classList.add('retire-text')
    retireText.id = `${ id }-retire-text`
    retireText.textContent = 'Retire this:'
    const retireChat = document.createElement('span')
    retireChat.classList.add('fas', 'fa-comment-slash', 'retire-icon', 'retire-chat')
    retireChat.id = `${ id }-retire-chat`
    retireChat.title = 'Retire this Chat. Begins new chat.'
    retireChat.addEventListener('click', mRetireChat)
    retireContainer.appendChild(retireText)
    retireContainer.appendChild(retireChat)
    if(retirable){
        const retireBot = document.createElement('span')
        retireBot.classList.add('fas', 'fa-user-large-slash', 'retire-icon', 'retire-bot')
        retireBot.id = `${ id }-retire-bot`
        retireBot.title = 'Relieves this bot, cannot be returned.'
        retireBot.addEventListener('click', mRetireBot, { once: true })
        retireContainer.appendChild(retireBot)
    }
    return retireContainer
}
/**
 * Create a team member that has been selected from add-team-member icon.
 * @requires mActiveTeam
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mCreateTeamMember(event){
    event.stopPropagation()
    const { value: type, } = this
    if(!type)
        throw new Error(`no team member type selected`)
    if(globals.isProxy(type)){}
    const data = {
        id: mActiveTeam.id,
        type,
    }
    if(globals.isProxy(type)){
        const endpoint = window.prompt(
            'Enter the external agent URL (A2A/NANDA endpoint):',
            'https://list39.org/@'
        )
        if(!endpoint?.length)
            throw new Error('External proxy bot requires a valid URL')
        data.url = endpoint.trim()
    }
    const bot = globals.isProxy(type)
        ? await globals.datamanager.botProxy(data)
        : await globals.datamanager.botCreate(data)
    if(!bot)
        throw new Error(`no bot created for team member`)
    const { id, } = bot
    mBots.push(bot)
    setActiveBot(id, true)
    updatePageBots(false, true)
}
/**
 * Create a team new popup.
 * @requires mActiveTeam
 * @requires mTeamPopup
 * @requires mTeams
 * @param {string} type - The type of team to create.
 * @param {boolean} showPopup - Whether or not to show the popup.
 * @returns {void}
 */
function mCreateTeamPopup(type, clickX=0, clickY=0, showPopup=true){
    const { allowCustom=false, allowProxy=false, allowedBotTypes, allowedItemTypes, } = mActiveTeam
    mTeamPopup.style.visibility = 'hidden'
    mTeamPopup.innerHTML = '' // clear existing
    const teamPopup = document.createElement('div')
    teamPopup.classList.add(`team-popup-${ type }`, 'team-popup-content')
    teamPopup.id = `team-popup-${ type }`
    teamPopup.name = `team-popup-${ type }`
    let listener,
        offsetX = 0,
        popup
    switch(type){
        case 'addTeamMember':
            const memberSelect = document.createElement('select')
            memberSelect.id = `team-member-select`
            memberSelect.name = `team-member-select`
            memberSelect.classList.add('team-member-select')
            const memberOption = document.createElement('option')
            memberOption.disabled = true
            memberOption.textContent = 'Select a team member to add...'
            memberOption.selected = true
            memberOption.value = ''
            memberSelect.appendChild(memberOption)
            allowedBotTypes.forEach(type=>{
                if(mBot(type)) // no duplicates currently
                    return
                const memberOption = document.createElement('option')
                memberOption.textContent = type
                memberOption.value = type
                memberSelect.appendChild(memberOption)
            })
            if(allowCustom || allowProxy){
                const divider = document.createElement('optgroup')
                divider.label = "-----------------"
                memberSelect.appendChild(divider)
                if(allowCustom){
                    const memberOptionCustom = document.createElement('option')
                    memberOptionCustom.value = 'custom'
                    memberOptionCustom.textContent = 'Create a custom team member'
                    memberSelect.appendChild(memberOptionCustom)
                }
                if(allowProxy){
                    const memberOptionProxy = document.createElement('option')
                    memberOptionProxy.value = 'proxy'
                    memberOptionProxy.textContent = 'Link an external agent'
                    memberSelect.appendChild(memberOptionProxy)
                }
            }
            memberSelect.addEventListener('click', (e)=>e.stopPropagation()) // stops from closure onClick
            memberSelect.addEventListener('change', mCreateTeamMember, { once: true })
            listener = mTeamMemberSelect
            popup = memberSelect
            break
        case 'selectTeam':
            const teamSelect = document.createElement('select')
            teamSelect.id = `team-select`
            teamSelect.name = `team-select`
            teamSelect.classList.add('team-select')
            const teamOption = document.createElement('option')
            teamOption.disabled = true
            teamOption.textContent = `MyLife's pre-defined agent teams...`
            teamOption.selected = true
            teamOption.value = ''
            teamSelect.appendChild(teamOption)
            mTeams.forEach(team=>{
                const { name, title, } = team
                const teamOption = document.createElement('option')
                teamOption.value = name
                teamOption.textContent = title
                teamSelect.appendChild(teamOption)
            })
            teamSelect.addEventListener('click', (e)=>e.stopPropagation()) // stops from closure onClick
            listener = mTeamSelect
            popup = teamSelect
            break
        default:
            break
    }
    mTeamPopup.appendChild(teamPopup)
    if(showPopup){
        show(mTeamPopup)
        document.addEventListener('click', mCloseTeamPopup, { once: true })
        document.addEventListener('keydown', mCloseTeamPopup)
    }
    if(popup){
        teamPopup.appendChild(popup)
        mTeamPopup.style.position = 'absolute'
        offsetX = teamPopup.offsetWidth
        let leftPosition = clickX - offsetX / 2
        const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
        if(leftPosition < 0)
            leftPosition = 0
        else if(leftPosition + offsetX > viewportWidth)
            leftPosition = viewportWidth - offsetX
        mTeamPopup.style.left = `${ leftPosition }px`
        mTeamPopup.style.top = `${clickY}px`
        popup.focus()
        if(listener)
            popup.addEventListener('change', listener, { once: true })
    }
    mTeamPopup.style.visibility = 'visible'
}
/**
 * Create add a team member popup.
 */
function mCreateTeamMemberSelect(event){
    event.stopPropagation()
    const { clientX, clientY, } = event
    mCreateTeamPopup('addTeamMember', clientX, clientY, true)
}
/**
 * Create a team select popup.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mCreateTeamSelect(event){
    event.stopPropagation()
    const { clientX, clientY, } = event
    mCreateTeamPopup('selectTeam', clientX, clientY, true)
}
/**
 * Find checkbox associated with element, or errors.
 * @param {HTMLElement} element - The element to search for checkbox.
 * @param {boolean} searchParent - Whether or not to search parent element.
 * @returns {HTMLElement} - The input checkbox found in element.
 */
function mFindCheckbox(element, searchParent=true){
    const { children, parentElement, } = element
    if(mIsInputCheckbox(element))
        return element
    for(let child of children){
        const result = mFindCheckbox(child, false)
        if(result)
            return result
    }
    if(searchParent && parentElement){
        const { children: parentChildren, } = parentElement
        // do not run second time (obviously)
        for(let child of parentChildren){
            if(child===element)
                continue // skip redundant processing
            const result = mFindCheckbox(child, false)
            if(result)
                return result
        }
    }
}
/**
 * Toggle submit button for input passphrase.
 * @requires passphraseInput
 * @returns {void}
 */
function mInputPassphrase(event){
    const passphraseContainer = this.closest('.passphrase-container')
    const passphraseInput = passphraseContainer.querySelector('.passphrase-input')
    const passphraseSubmit = passphraseContainer.querySelector('.passphrase-submit')
    const passphraseCancel = passphraseContainer.querySelector('.passphrase-cancel')
    switch(event.type){
        case 'keydown':
            const key = event.key
            switch(key){
                case 'Escape':
                    passphraseCancel.click()
                    break
                case 'Enter':
                    passphraseSubmit.click()
                    break
            }
            break
        case 'input':
            if((passphraseInput.value?.length ?? 0)>2)
                show(passphraseSubmit)
            else
                hide(passphraseSubmit)
            break
    }
}
/**
 * Determines whether or not the element is an input checkbox.
 * @param {HTMLElement} element - The element to check.
 * @returns {boolean} - Whether or not the element is an input checkbox.
 */
function mIsInputCheckbox(element){
    const { tagName, type, } = element
    const outcome = tagName.toLowerCase()==='input' && type.toLowerCase()==='checkbox'
    return outcome
}
/**
 * Open bot container for passed element, closes all the rest.
 * @param {HTMLDivElement} element - The bot container.
 * @returns {void}
 */
function mOpenStatusDropdown(element){
    document.querySelectorAll('.bot-container, .collections-container')
        .forEach(otherContainer=>{
            if(otherContainer!==element){
                const otherContent = otherContainer.querySelector('.bot-options')
                if(otherContent)
                    otherContent.classList.remove('open')
                var otherDropdown = otherContainer.querySelector('.bot-options-dropdown')
                if(otherDropdown)
                    otherDropdown.classList.remove('open')
            }
        })
        var content = element.querySelector('.bot-options') // even collections use bot-options
        if(content)
            content.classList.toggle('open')
        var dropdown = element.querySelector('.bot-options-dropdown')
        if(dropdown)
            dropdown.classList.toggle('open')
}
/**
 * Creates a proxy agent access element.
 * @param {Set} accessList - List of bot ids that have access to this proxy agent.
 * @returns {DocumentFragment} - Access element for a proxy agent
 */
function mProxyAccess(id, accessList){
    const accessFragment = document.createDocumentFragment()
    if(!Array.isArray(accessList))
        accessList = []
    const avatarId = mBot('personal-avatar')?.id
    if(!avatarId?.length){
        const accessNotice = document.createElement('div')
        accessNotice.classList.add('error')
        accessNotice.textContent = `No personal avatar found, cannot set access. Create your personal avatar to enable access.`
        return accessFragment // no avatar, no access list
    }
    if(!accessList.some(id=>id===avatarId)) // force avatar into access list
        accessList.push(avatarId)
    const accessLabel = document.createElement('div')
    accessLabel.classList.add('proxy-access-label')
    accessLabel.textContent = `Allow access to the following:`
    const proxyAccess = document.createElement('div')
    proxyAccess.classList.add('input-group', 'proxy-access')
    proxyAccess.id = `${ id }-access`
    mBots.filter(bot=>!globals.isProxy(bot.type) && bot.id!==id)
        .forEach(bot=>{
            const { id: botId, type, name, } = bot
            const botAccess = document.createElement('div')
            botAccess.classList.add('proxy-access-bot')
            /* - access checkbox */
            const botAccessId = `${ id }-access-${ type }-${ botId }`
            const botAccessInput = document.createElement('input')
            botAccessInput.addEventListener('change', mProxyAccessAssign, { once: true })
            botAccessInput.checked = accessList.some(accessId=>accessId===botId)
            botAccessInput.classList.add('proxy-access-checkbox')
            botAccessInput.disabled = botId===avatarId // force avatar access, cannot be unchecked
            botAccessInput.id = botAccessId
            botAccessInput.proxyBotId = id
            botAccessInput.title = botId===avatarId
                ? `Your Member Avatar will always have access to utilize your proxy agents`
                : `Grant or revoke access for ${ name } to utilize this proxy agent`
            botAccessInput.type = 'checkbox'
            botAccessInput.value = botId
            /* - access label */
            const botAccessLabel = document.createElement('label')
            botAccessLabel.classList.add('proxy-access-label')
            botAccessLabel.htmlFor = botAccessId
            botAccessLabel.textContent = name
            botAccessLabel.title = type.replace(/-/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
            /* appends */
            botAccess.appendChild(botAccessInput)
            botAccess.appendChild(botAccessLabel)
            proxyAccess.appendChild(botAccess)
        })
    accessFragment.appendChild(accessLabel)
    accessFragment.appendChild(proxyAccess)
    return accessFragment
}
/**
 * Assigns or revokes access for a bot to use a proxy agent.
 * @param {Event} e - The event object
 * @returns {void}
 */
async function mProxyAccessAssign(e){
    const checkbox = e.target
    checkbox.disabled = true
    const { proxyBotId, } = checkbox
    const action = checkbox.checked ? `grant` : `revoke`
    const resultAction = checkbox.checked
        ? 'This bot will have its instructions updated to use this proxy agent as per the purpose you have described.'
        : 'This bot will no longer be able to use this proxy agent.'
    if(confirm(`Are you sure you want to ${ action } rights?\n${ resultAction }`)){
        const assignResult = await globals.datamanager.botProxyAccess(proxyBotId, checkbox.value, checkbox.checked)
    } else
        checkbox.checked = !checkbox.checked
    checkbox.disabled = false
    checkbox.addEventListener('change', mProxyAccessAssign, { once: true })
}
/**
 * Creates a proxy agent description element.
 * @param {Guid} id - The proxy agent id
 * @param {string} description - Description text
 * @returns {DocumentFragment} - Description element for a proxy agent
 */
function mProxyDescription(id, description){
    const descriptionFragment = document.createDocumentFragment()
    if(description?.length){
        const proxyDescription = document.createElement('div')
        proxyDescription.classList.add('input-group', 'proxy-inputs')
        proxyDescription.id = `${ id }-description`
        /* - description label */
        const proxyDescriptionLabel = document.createElement('label')
        proxyDescriptionLabel.id = `${ id }-label-description`
        proxyDescriptionLabel.htmlFor = `${ id }-input-description`
        proxyDescriptionLabel.textContent = `Description:`
        /* - description input */
        const proxyDescriptionInput = document.createElement('textarea')
        proxyDescriptionInput.classList.add('bot-input', 'proxy-input', 'proxy-description')
        proxyDescriptionInput.disabled = true
        proxyDescriptionInput.id = `${ id }-input-description`
        proxyDescriptionInput.maxLength = 512
        const proxyDescriptionValue = description?.length > proxyDescriptionInput.maxLength
            ? description.substring(0, proxyDescriptionInput.maxLength-3) + '...'
            : description
        proxyDescriptionInput.value = proxyDescriptionValue
        /* appends */
        proxyDescription.appendChild(proxyDescriptionLabel)
        proxyDescription.appendChild(proxyDescriptionInput)
        descriptionFragment.appendChild(proxyDescription)
    }
    return descriptionFragment
}
/**
 * Creates a proxy endpoint element.
 * @param {Guid} id - The proxy agent id
 * @param {string} url - Endpoint URL
 * @returns {DocumentFragment} - Endpoint element for a proxy agent
 */
function mProxyEndpoint(id, url){
    const endpointFragment = document.createDocumentFragment()
    if(url?.length){
        const proxyUrl = document.createElement('div')
        proxyUrl.classList.add('input-group', 'proxy-inputs')
        proxyUrl.id = `endpoint-container-${ id }`
        /* - endpoint label */
        const proxyUrlLabel = document.createElement('label')
        proxyUrlLabel.id = `endpoint-label-${ id }`
        proxyUrlLabel.htmlFor = `endpoint-${ id }`
        proxyUrlLabel.textContent = `Endpoint:`
        /* - endpoint input */
        const proxyUrlInput = document.createElement('input')
        proxyUrlInput.classList.add('bot-input', 'proxy-input', 'proxy-url')
        proxyUrlInput.disabled = true
        proxyUrlInput.id = `endpoint-${ id }`
        proxyUrlInput.value = url
        /* - endpoint refresh */
        const proxyUrlRefresh = document.createElement('span')
        proxyUrlRefresh.classList.add('fas', 'fa-arrows-rotate', 'proxy-refresh')
        proxyUrlRefresh.id = `endpoint-refresh-${ id }`
        proxyUrlRefresh.title = `Refresh Endpoint`
        proxyUrlRefresh.addEventListener('click', mRefreshProxyUrl, { once: true })
        /* appends */
        proxyUrl.appendChild(proxyUrlLabel)
        proxyUrl.appendChild(proxyUrlInput)
        proxyUrl.appendChild(proxyUrlRefresh)
        endpointFragment.appendChild(proxyUrl)
    }
    return endpointFragment
}
/**
 * Creates a proxy agent purpose element.
 * @param {Guid} id - The proxy agent id
 * @param {string} purpose - Purpose text
 * @returns {DocumentFragment} - Purpose element for a proxy agent
 */
function mProxyName(id, name){
    const nameFragment = document.createDocumentFragment()
    if(name?.length){
        /* name */
        const proxyName = document.createElement('div')
        proxyName.classList.add('input-group', 'proxy-inputs')
        proxyName.id = `${ id }-bot_name`
        /* - name label */
        const proxyNameLabel = document.createElement('label')
        proxyNameLabel.htmlFor = `${ id }-input-bot_name`
        proxyNameLabel.id = `${ id }-label-bot_name`
        proxyNameLabel.textContent = `Agent Name:`
        /* - name input */
        const proxyNameInput = document.createElement('input')
        proxyNameInput.classList.add('bot-input', 'bot-name', 'proxy-input', 'proxy-bot-name')
        proxyNameInput.id = `${ id }-input-bot_name`
        proxyNameInput.maxLength = 256
        proxyNameInput.placeholder = 'Your agent name...'
        proxyNameInput.value = name
        proxyNameInput.addEventListener('change', mBotNameChange, { once: true })
        /* appends */
        proxyName.appendChild(proxyNameLabel)
        proxyName.appendChild(proxyNameInput)
        nameFragment.appendChild(proxyName)
    }
    return nameFragment
}
/**
 * Creates a proxy agent purpose element. **Note**: Purpose is used to apply instructions to other bots (minimally Avatar) that have been given explicit access to this proxy agent by the member.
 * @param {Guid} id - The proxy agent id
 * @param {string} purpose - Purpose text
 * @returns {DocumentFragment} - Purpose element for a proxy agent
 */
function mProxyPurpose(id, purpose){
    const purposeFragment = document.createDocumentFragment()
    const purposeMaxLength = 1024
    purpose = purpose?.trim().substring(0, purposeMaxLength)
    const proxyPurpose = document.createElement('div')
    proxyPurpose.classList.add('input-group', 'proxy-inputs')
    proxyPurpose.id = `${ id }-purpose`
    /* - purpose label */
    const proxyPurposeLabel = document.createElement('label')
    proxyPurposeLabel.id = `${ id }-label-purpose`
    proxyPurposeLabel.htmlFor = `${ id }-input-purpose`
    proxyPurposeLabel.textContent = `Purpose:`
    /* - purpose input */
    const proxyPurposeInput = document.createElement('textarea')
    proxyPurposeInput.addEventListener('change', mProxyPurposeInput, { once: false })
    proxyPurposeInput.classList.add('bot-input', 'proxy-input', 'proxy-purpose')
    proxyPurposeInput.id = `${ id }-input-purpose`
    proxyPurposeInput.maxLength = purposeMaxLength
    proxyPurposeInput.originalValue = purpose
    proxyPurposeInput.placeholder = `Define the purpose of this agent, which will be used when applying instructions to other bots that have been given access to this agent. Example: "This agent is familiar with my current calendar schedule."`
    proxyPurposeInput.proxyId = id
    proxyPurposeInput.value = purpose
    /* appends */
    proxyPurpose.appendChild(proxyPurposeLabel)
    proxyPurpose.appendChild(proxyPurposeInput)
    purposeFragment.appendChild(proxyPurpose)
    return purposeFragment
}
/**
 * Handles input change for proxy agent purpose. **Note**: Purpose is not included in `dataset` so no need to incorporate; although will deprecate dataset in future.
 * @param {Event} e - The input change event
 * @returns {void}
 */
async function mProxyPurposeInput(e){
    const { target, } = e
    const { proxyId, value, } = target
    if(!confirm(`By updating the purpose for this proxy agent, you will be changing the instructions for any MyLife intelligences utilizing this agent. Are you sure you want to proceed?`))
        target.value = target.originalValue
    else {
        const { purpose, } = await globals.datamanager.botUpdate({ id: proxyId, purpose: value, })
        target.originalValue = purpose
        const bot = mBot(proxyId)
        if(!!bot)
            bot.purpose = purpose
    }
}
/**
 * Creates a retire element for a proxy agent.
 * @param {Guid} id - The external agent id
 * @returns {DocumentFragment} - Retire element for a proxy agent
 */
function mProxyRetire(id){
    const retireFragment = document.createDocumentFragment()
    const proxyRetire = document.createElement('div')
    proxyRetire.classList.add('retire-container', 'proxy-retire')
    proxyRetire.id = `${ id }-retire`
    const proxyRetireText = document.createElement('div')
    proxyRetireText.classList.add('retire-text', 'proxy-retire-text')
    proxyRetireText.id = `${ id }-retire-text`
    proxyRetireText.textContent = `Retire this Agent:`
    const proxyRetireBot = document.createElement('span')
    proxyRetireBot.classList.add('fas', 'fa-user-large-slash', 'retire-icon', 'retire-bot', 'proxy-retire-bot')
    proxyRetireBot.id = `${ id }-retire-bot`
    proxyRetireBot.title = `Retire this external Agent. This action is permanent and cannot be undone. Agent will have to be recreated.`
    proxyRetire.appendChild(proxyRetireText)
    proxyRetire.appendChild(proxyRetireBot)
    retireFragment.appendChild(proxyRetire)
    return retireFragment
}
/**
 * Creates a proxy agent skills element.
 * @param {Guid} id - The proxy agent id
 * @param {Array} skills - List of skills for this proxy agent
 * @returns {DocumentFragment} - Skills element for a proxy agent
 */
function mProxySkills(id, skills){
    const skillsFragment = document.createDocumentFragment()
    if(!Array.isArray(skills) || !skills?.length){
        const skillError = document.createElement('div')
        skillError.classList.add('error')
        skillError.textContent = 'No skills found for this agent. Please refresh or consult A2A service for agent provider.'
        skillsFragment.appendChild(skillError)
        return skillsFragment
    }
    const skillsContainer = document.createElement('div')
    skillsContainer.classList.add('proxy-skills')
    skillsContainer.id = `${ id }-skills`
    /* - skills label */
    const skillsLabel = document.createElement('div')
    skillsLabel.classList.add('proxy-skills-label')
    skillsLabel.id = `${ id }-skills-label`
    skillsLabel.textContent = `Agent Skills:`
    skillsContainer.appendChild(skillsLabel)
    /* skills list */
    skills.forEach(skill=>{
        const { description, id: skillId, inputModes, outputModes, supportedLanguages, } = skill
        let skillTitle = description
        if(inputModes?.length)
            skillTitle+=`\nInput Modes: ${ inputModes.join(', ') }`
        if(outputModes?.length)
            skillTitle+=`\nOutput Modes: ${ outputModes.join(', ') }`
        if(supportedLanguages?.length)
            skillTitle+=`\nSupported Languages: ${ supportedLanguages.join(', ') }`
        const skillContainer = document.createElement('div')
        skillContainer.classList.add('proxy-skill')
        skillContainer.id = `${ id }-${ skillId }-skill`
        skillContainer.title = skillTitle
        const skillBullet = document.createElement('span')
        skillBullet.classList.add('proxy-skill-bullet', 'fa', 'fa-id-card')
        const skillName = document.createElement('span')
        skillName.classList.add('proxy-skill-name')
        skillName.textContent = skillId
        skillContainer.appendChild(skillBullet)
        skillContainer.appendChild(skillName)
        skillsContainer.appendChild(skillContainer)
    })
    skillsFragment.appendChild(skillsContainer)
    return skillsFragment
}
/**
 * Refresh the proxy URL for the proxy agent.
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mRefreshProxyUrl(event){
    event.stopPropagation()
    const { id: fullId, } = event.target
    const id = globals.extractId(fullId)
    event.target.classList.add('spin')
    const response = await globals.datamanager.botProxyRefresh(id)
    event.target.style.display = 'none'
    event.target.classList.remove('spin')
    setTimeout(() => {
        event.target.style.display = 'flex'
        event.target.addEventListener('click', mRefreshProxyUrl, { once: true })
    }, 5 * 60 * 1000)
    console.log('Proxy URL refreshed:', response)
}
/**
 * Request to retire an identified bot.
 * @param {Event} e - The event object
 * @returns {void}
 */
async function mRetireBot(e){
    e.stopPropagation()
    try {
        const { id: botId, } = e.target
        botId = globals.extractId(fullId)
        const bot = getBot(botId) // will match either `id` or `type`
        const { id, type, } = bot
        if(globals.isProxy(type) && !confirm("Retiring a proxy bot will not notify the external agent. Are you sure?"))
            return
        /* reset active bot */
        if(mActiveBot.id===id)
            setActiveBot()
        const response = await globals.datamanager.botRetire(id)
        addMessages(response.responses, 'avatar')
    } catch(err) {
        addMessage(`Error posting bot data: ${ err.message }`, 'error')
    }
}
/**
 * Retires chat thread on server and readies for a clean one.
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mRetireChat(e){
    e.stopPropagation()
    try {
        const { id: botId, } = e.target
        botId = globals.extractId(fullId)
        const bot = getBot(botId) // will match either `id` or `type`
        const { id, } = bot
        const response = await globals.datamanager.chatRetire(id)
        addMessages(response.responses, mActiveBot.type)
    } catch(err) {
        addMessage(`Error posting bot data: ${ err.message }`, 'error')
    }
}
/**
 * Sets additional attributes on bot.
 * @private
 * @requires mActiveBot
 * @param {object} bot - The bot object
 * @returns {void}
 */
function mSetAttributes(bot=mActiveBot){
    bot.active = mBotActive(bot.id)
    bot.activeFirst = bot.activeFirst ?? true
    bot.initialized = Date.now()
}
/**
 * Sets bot container status bar based on bot, thread, and assistant population.
 * @private
 * @requires mActiveBot - active bot object, but can be undefined without error.
 * @param {object} bot - The bot object.
 * @returns {void}
 */
function mSetStatusBar(bot){
    const { container, id, name, } = bot
    if(!container)
        return
    const containerIdentifier = container.id
    const botIcon = document.getElementById(`${ containerIdentifier }-icon`)
    if(!botIcon)
        return
    let status
    /* status icon */
    switch(true){
        case ( mActiveBot?.id==id ): // activated
            botIcon.classList.remove('online', 'offline', 'error')
            botIcon.classList.add('active')
            status = 'active'
            break
        case ( name?.length>0 ): // online
            botIcon.classList.remove('active', 'offline', 'error')
            botIcon.classList.add('online')
            status = 'online'
            break
        default: // error
            botIcon.classList.remove('active', 'online', 'offline')
            botIcon.classList.add('error')
            status = 'error'
            break
    }
    bot.status = status
}
/**
 * Highlights bot container of active bot.
 * @public
 * @requires mActiveBot
 * @returns {void}
 */
function mSpotlightBotStatus(){
    mBots.forEach(bot=>mSetStatusBar(bot))
}
/**
 * Submits a prompt button through member functions and prints to screen.
 * @param {Guid} botId - The bot id to submit prompt to
 * @param {string} prompt - The prompt to submit
 * @param {boolean} clearChat - Whether or not to clear system chat, default is `false`
 * @returns {Promise<void>}
 */
async function mSubmitPrompt(botId, prompt, clearChat=false){
    if(activeBot()?.id!==botId)
        setActiveBot(botId, false)
    const { error, responses, success, } = await submit(prompt, 'prompt', true)
    if(success && responses?.length){
        if(clearChat)
            clearSystemChat()
        addMessages(responses, activeBot().type)
    } else
        addMessage(`Error submitting prompt: ${ error }`, 'error')
}
/**
 * Manages `change` event selection of team member from `team-select` dropdown.
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mTeamMemberSelect(event){
    const { value, } = this
    if(value?.length){ // request to server
        /* validate */
        const bot = mBot(value)
        if(bot)
            mUpdateBotContainers()
    }
    mCloseTeamPopup(event)
}
/**
 * Manages `change` event selection of team from `team-select` dropdown.
 * @async
 * @requires mActiveTeam
 * @param {Event} event - The event object. 
 * @returns {void}
 */
async function mTeamSelect(event){
    const { value, } = this
    setActiveTeam(value)
    mCloseTeamPopup(event)
}
/**
 * Toggles bot containers and checks for various actions on master click of `this` bot-container. Sub-elements appear as targets and are rendered appropriately.
 * @private
 * @async
 * @param {Event} event - The event object, represents entire bot box as `this`.
 * @returns {void}
 */
async function mToggleBotContainers(event){
    event.stopPropagation()
    const botContainer = event.target.closest('.bot-container, .collections-container')
    if(!botContainer)
        return
    const { id, } = botContainer
    const { id: elementId, } = event.target
    switch(elementId.split('-').pop()){
        case 'dropdown':
        case 'name':
        case 'status':
        case 'title':
        case 'titlebar':
        case 'type':
            mOpenStatusDropdown(botContainer)
            break
        case 'icon':
        case 'image':
        case 'thumb':
            await setActiveBot(id, true)
            break
        case 'update':
        case 'upload':
            break
        case 'version':
            mUpdateBotVersion(id)
            break
        default:
            break
    }
}
/**
 * Toggles passphrase input visibility.
 * @param {Event} event - The event object
 * @returns {void}
 */
function mTogglePassphrase(event){
    event.preventDefault()
    event.stopPropagation()
    const passphraseContainer = this.closest('.passphrase-container')
    const passphraseCancel = passphraseContainer.querySelector('.passphrase-cancel'),
        passphraseInput = passphraseContainer.querySelector('.passphrase-input'),
        passphraseReset = passphraseContainer.querySelector('.passphrase-button'),
        passphraseSubmit = passphraseContainer.querySelector('.passphrase-submit')
    hide(passphraseSubmit)
    if(this===passphraseReset){
        passphraseInput.focus()
        passphraseInput.disabled = false
        passphraseInput.placeholder = 'Enter new passphrase...'
        passphraseInput.value = null
        passphraseCancel.addEventListener('click', mTogglePassphrase, { once: true })
        passphraseSubmit.classList.add('fa-circle-arrow-right')
        passphraseSubmit.classList.remove('fa-check')
        passphraseSubmit.addEventListener('click', mUpdatePassphrase)
        passphraseInput.addEventListener('input', mInputPassphrase)
        passphraseInput.addEventListener('keydown', mInputPassphrase)
        passphraseSubmit.classList.add('fa-circle-arrow-right')
        hide(passphraseReset)
        show(passphraseCancel)
        show(passphraseInput)
    } else {
        passphraseInput.blur()
        passphraseInput.disabled = true
        hide(passphraseCancel)
        hide(passphraseInput)
        hide(passphraseSubmit)
        show(passphraseReset)
        passphraseInput.removeEventListener('input', mInputPassphrase)
        passphraseInput.removeEventListener('keydown', mInputPassphrase)
        passphraseSubmit.removeEventListener('click', mUpdatePassphrase)
        passphraseReset.addEventListener('click', mTogglePassphrase, { once: true })
    }
}
/**
 * Updates bot-widget containers for whom there is data. If no bot data exists, ignores container.
 * @requires mBots
 * @returns {void}
 */
async function mUpdateBotContainers(){
    if(!mBots?.length)
        throw new Error(`mBots not populated`)
    const collectionsContainer = document.getElementById('collections-container')
    const [bots, proxyAgents] = mBots.reduce( // set vanilla bots and proxy agents
        ([normal, proxy], bot)=>{
            (globals.isProxy(bot.type)
                ? proxy
                : normal
            )
                .push(bot)
            return [normal, proxy]
        }, [[], []]
    )
    // MyLife internal bots
    for(const bot of bots){
        const { container, id, type, } = bot
        if(!container)
            bot.container = document.getElementById(id)
        if(!bot.container){
            const botContainer = await mCreateBotContainer(bot)
            bot.container = botContainer
        }
    }
    // external proxy agents
    if(proxyAgents.length){
        proxyAgents.forEach(async proxyAgent=>{
            const proxyContainer = mCreateProxyBotContainer(proxyAgent)
            proxyAgent.container = proxyContainer
        })
    }
    // ensure DOM avatar
    const Avatar = bots.find(bot=>isAvatar(bot.type))
    if(Avatar && !document.getElementById(Avatar?.id)){
        const { container, id: avatarId, } = Avatar
        mSidebar.insertBefore(container, mTeamHeader) // avatar always first
        mUpdateBotContainer(Avatar)
    }
    // mount team bots
    mBotMount.innerHTML = ''
    const teamBots = [
        ...bots.filter(bot => activeTeam().allowedBotTypes.includes(bot.type)),
        ...(activeTeam().allowProxy ? proxyAgents : [])
    ]
    teamBots.forEach(bot=>{
        const { container, id, } = bot
        if(container)
            mBotMount.appendChild(container)
        mUpdateBotContainer(bot)
    })
}
/**
 * Updates the bot container with specifics.
 * @param {object} bot - The bot object
 * @returns {void}
 */
function mUpdateBotContainer(bot) {
    const { container, } = bot
    container.addEventListener('click', mToggleBotContainers)
    mSetAttributes(bot)
    mSetStatusBar(bot)
    mUpdateOptions(bot)
}
/**
 * Updates bot version on server.
 * @param {Guid} botId - The bot ID
 * @returns {void}
 */
async function mUpdateBotVersion(botId){
    const bot = mBot(botId)
    if(!bot)
        return
    const { container, version, versionUpdate, } = bot
    if(!versionUpdate>version)
        return
    const updater = document.getElementById(`${ container.id }-title-version`)
    if(!updater)
        return
    try{
        updater.textContent ='Updating...'
        const { success, bot: { version: updatedVersion, }, } = await globals.datamanager.botVersion(botId)
        if(success && updatedVersion!==version){
            bot.version = updatedVersion
            bot.versionUpdate = null
        } else
            throw new Error(`Failed to update bot version for bot ${ botId }: Failed updating version: ${ version } to ${ versionUpdate }; returned version: ${ updatedVersion }`)
    } finally {
        updater.classList.remove('update-available')
        updater.textContent = mVersion(bot.version)
    }
}
/**
 * Update a bot checkbox structure with specifics.
 * @param {object} bot - The bot object
 * @returns {void}
 */
function mUpdateOptions(bot){
    const { container, id, options, type, } = bot
    if(!container || !options?.length)
        return
    for(const option of options){
        const { id: optionId, type: optionType, variable, } = option
        const value = bot[variable]
            ?? ''
        const optionGroup = document.getElementById(`${ id }-input-group-${ optionId }`)
        const optionInput = document.getElementById(`${ id }-input-${ variable }`)
        switch(optionType){
            case 'checkbox':
                const checkboxDelimiter = ';'
                const checkboxValuesArray = value
                    .split(checkboxDelimiter)
                    .map(v=>v.trim().toLowerCase())
                const checkboxes = Array.from(optionGroup.querySelectorAll(`input[type="checkbox"]`))
                checkboxes.forEach(checkbox=>{
                    checkbox.checked = checkboxValuesArray.includes(checkbox.value.toLowerCase())
                    checkbox.addEventListener('change', ()=>checkboxUpdate(checkboxes, variable))
                })
                break
            default:
                break
        }
    }
    // local function
    function checkboxUpdate(checkboxes, variable){
        const checkedValues = checkboxes
            .filter(cb => cb.checked) // Filter only checked checkboxes
            .map(cb => cb.value) // Map to their values
            .join(';')
        const bot = {
            id,
            type,
        }
        bot[variable] = checkedValues
        globals.datamanager.botUpdate(bot) // no need `await
    }
}
/**
 * Submit updated passphrase for MyLife.
 * @private
 * @async
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mUpdatePassphrase(event){
    event.preventDefault()
    event.stopPropagation()
    const passphraseContainer = this.closest('.passphrase-container')
    const passphraseCancel = passphraseContainer.querySelector('.passphrase-cancel'),
        passphraseInput = passphraseContainer.querySelector('.passphrase-input'),
        passphraseSubmit = passphraseContainer.querySelector('.passphrase-submit')
    const { value, } = passphraseInput
    if(!value?.length)
        return
    passphraseSubmit.disabled = true
    const success = await globals.datamanager.passphraseUpdate(value)
    if(success){
        hide(passphraseCancel)
        passphraseInput.disabled = true
        passphraseInput.placeholder = 'Passphrase updated!'
        passphraseInput.value = null
        passphraseSubmit.classList.remove('fa-circle-arrow-right')
        passphraseSubmit.classList.add('fa-check')
        setTimeout(_=>{
            passphraseCancel.click()
            passphraseSubmit.disabled = false
        }, 2000)
        return
    }
    passphraseSubmit.disabled = false
}
/**
 * Updates the active team to specific or default. Team object: { active, allowCustom, allowProxy, allowedBotTypes, allowedItemTypes, collection, defaultActiveType, defaultTypes, description, id, name, primaryCollectionTypes, title, }.
 * @async
 * @requires mActiveTeam
 * @requires mBots
 * @requires mTeamName
 * @returns {void}
 */
async function mUpdateTeams(){
    const { active, allowCustom, allowProxy, allowedBotTypes, allowedItemTypes, collection, description, id, name, primaryCollectionTypes, title, } = activeTeam() ?? {}
    if(!id)
        throw new Error(`No active team available at this time.`)
    const teamName = title
        ?? name
    mTeamName.textContent = `${ teamName } Team`
    mTeamName.title = `${ description }. The team allows ${ allowedBotTypes?.join(', ') ?? 'various' } bots and ${ allowedItemTypes?.join(', ') ?? 'various' } items. ${ allowCustom ? 'Custom bots and items are allowed. ' : '' }${ allowProxy ? 'Proxy agents are allowed. ' : '' }`
    hide(mTeamPopup)
    show(mTeamHeader)
    await Promise.all([
        updatePageBots(),
        initCollections()
    ])
    getActiveBot() // no await
}
/**
 * Upload Files to server from any .
 * @async
 * @requires mAvailableMimeTypes
 * @requires mAvailableUploaderTypes
 * @requires globals
 * @requires mCollectionsUpload
 * @param {Event} event - The event object.
 */
async function mUploadFiles(event){
    const { id, parentNode: uploadParent, } = this
    const type = globals.HTMLIdToType(id)
    if(!mAvailableUploaderTypes.includes(type))
        throw new Error(`Uploader "${ type }" not found, upload function unavailable for this bot.`)
    let fileInput
    try {
        mCollectionsUpload.disabled = true
        fileInput = document.createElement('input')
        fileInput.id = `file-input-${ type }`
        fileInput.multiple = true
        fileInput.name = fileInput.id
        fileInput.type = 'file'
        uploadParent.appendChild(fileInput)
        hide(fileInput)
        fileInput.click()
        window.addEventListener('focus', async event=>{
            await mUploadFilesInput(fileInput, uploadParent, mCollectionsUpload)
        }, { once: true })
    } catch(error){
        mUploadFilesInputRemove(fileInput, uploadParent, mCollectionsUpload)
    }
}
/**
 * Handles file input change event, uploads files to server, and updates the collection list.
 * @async
 * @param {HTMLElement} fileInput - The file input element
 * @param {HTMLElement} uploadParent - The parent element of the upload input
 * @param {HTMLElement} uploadButton - The upload button element
 */
async function mUploadFilesInput(fileInput, uploadParent, uploadButton){
    fileInput.addEventListener('change', async event=>{
        const { files: uploads, } = fileInput
        if(uploads?.length){
            const formData = new FormData()
            for(let file of uploads){
                formData.append('files[]', file)
            }
            formData.append('type', globals.HTMLIdToType(uploadParent.id))
            const { files, message, success, } = await globals.datamanager.uploadFiles(formData)
            const type = 'file'
            const itemList = document.getElementById(`collection-list-${ type }`)
            mUpdateCollection(type, itemList, files)
        }
    }, { once: true })
    mUploadFilesInputRemove(fileInput, uploadParent, uploadButton)
}
/**
 * Removes the file input element from the DOM and re-enables the upload button.
 * @param {HTMLElement} fileInput - The file input element
 * @param {HTMLElement} uploadParent - The parent element of the upload input
 * @param {HTMLElement} uploadButton - The upload button element
 */
function mUploadFilesInputRemove(fileInput, uploadParent, uploadButton){
    if(fileInput && uploadParent.contains(fileInput))
        uploadParent.removeChild(fileInput)
    uploadButton.disabled = false
}
/**
 * Versions per frontend.
 * @param {string} version - The version to format
 * @returns {string} - The formatted version
 */
function mVersion(version){
    version = version.toString()
    version = `v.${ version?.includes('.') ? version : `${ version }.0` ?? '1.0' }`
    return version
}
/* exports */
export {
    activeBot,
    activeTeam,
    getAction,
    getBot,
    getBotIcon,
    getBots,
    getBotsByForm,
    init as initBots,
    isAvatar,
    setActiveBot,
    updatePageBots,
    /* collections.mjs */
    activeChat,
    activeClose,
    activeItem,
    activeStatus,
    activeTitle,
    createItem,
    endMemory,
    getItem,
    refreshCollection,
    setActiveItem,
    toggleBotContainers,
    togglePopup,
    unsetActiveItem,
    updateActiveItemTitle,
    updateItem,
    updateItemSummary,
    updateItemTitle,
    updateTitle,
    /* members.mjs */
    addInput,
    addMessage,
    addMessages,
    clearSystemChat,
    decorateActiveBot,
    enactInstruction,
    experiences,
    expunge,
    globals,
    hide,
    introduction,
    mainContent,
    overlays,
    privacyPolicy,
    seedInput,
    replaceElement,
    routine,
    setActiveAction,
    show,
    startDrag,
    startExperience,
    submit,
    toggleMemberInput,
    toggleVisibility,
    unsetActiveAction,
}