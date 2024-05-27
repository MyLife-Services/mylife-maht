/* bot functionality */
/* imports */
import {
    addMessage,
    availableExperiences,
    decorateActiveBot,
    hide,
    inExperience,
    show,
    toggleVisibility,
} from './members.mjs'
import Globals from './globals.mjs'
/* constants; DOM exists? */
// @todo - placeholder, get from server
const mAvailableMimeTypes = [],
    mAvailableTeams={
        creative: {
            name: 'Creative',
        },
        health: {
            name: 'Health',
        },
        memoir: {
            allowCustom: true,
            allowedTypes: ['diary','personal-biographer', 'journaler',],
            description: 'The Memoir Team is dedicated to help you document your life stories, experiences, thoughts, and feelings.',
            name: 'Memoir',
        },
        professional: {
            name: 'Job',
        },
        social: {
            name: 'Social',
        },
        spiritual: {
            name: 'Sprituality',
        },
        ubi: {
            name: 'UBI',
        },

    },
    mAvailableUploaderTypes = ['library', 'personal-avatar', 'personal-biographer', 'resume',],
    botBar = document.getElementById('bot-bar'),
    mDefaultTeam = 'memoir',
    mGlobals = new Globals(),
    mLibraries = ['entry', 'experience', 'file', 'story'], // ['chat', 'conversation']
    mLibraryCollections = document.getElementById('library-collections'),
    mLibraryUpload = document.getElementById('library-upload'),
    passphraseCancelButton = document.getElementById(`personal-avatar-passphrase-cancel`),
    passphraseInput = document.getElementById(`personal-avatar-passphrase`),
    passphraseInputContainer = document.getElementById(`personal-avatar-passphrase-container`),
    passphraseResetButton = document.getElementById(`passphrase-reset-button`),
    passphraseSubmitButton = document.getElementById(`personal-avatar-passphrase-submit`),
    mTeamAddMemberIcon = document.getElementById('add-team-member-icon'),
    mTeamHeader = document.getElementById('team-header'),
    mTeamName = document.getElementById('team-name'),
    mTeamPopup = document.getElementById('team-popup')
/* variables */
let mActiveBot,
    mActiveTeam,
    mPageBots
/* onDomContentLoaded */
document.addEventListener('DOMContentLoaded', async event=>{
    const { bots, activeBotId: id } = await fetchBots()
    if(!bots?.length)
        throw new Error(`ERROR: No bots returned from server`)
    updatePageBots(bots) // includes p-a
    await setActiveBot(id, true)

})
/* public functions */
/**
 * Get active bot in memory.
 * @public
 * @returns {object} - The active bot object.
 */
function activeBot(){
    return mActiveBot
}
/**
 * Fetch bots from server, used primarily for initialization of page, though could be requested on-demand.
 * @public
 * @returns {Promise<Object[Array]>} - The bot object array, no wrapper.
 */
async function fetchBots(){
    const url = window.location.origin + '/members/bots'
    const response = await fetch(url)
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    return await response.json()
}
/**
 * Fetch collection(s) requested on-demand.
 * @param {string} type - The type of collections to fetch.
 * @returns {Promise<Object[Array]>} - The collection(s)' items, no wrapper.
 */
async function fetchCollections(type){
    const url = window.location.origin
        + `/members/collections`
        + ( !type ? '' : `/${ type }` )
    let response = await fetch(url)
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    response = await response.json()
    return response
}
/**
 * Set active bot on server and update page bots.
 * @requires mActiveBot
 * @requires mPageBots
 * @param {Event} event - The event object.
 * @param {boolean} dynamic - Whether or not to add dynamic greeting, only triggered from source code.
 * @returns {void}
 */
async function setActiveBot(event, dynamic=false){
    const botId = mGlobals.isGuid(event)
        ? event /* bypassed event, sent id */
        : event.target?.dataset?.bot_id
    if(!botId)
        throw new Error(`Bot data not found in event.`)
    const initialActiveBot = mActiveBot
    mActiveBot = mBot(botId)
        ?? initialActiveBot
    if(!mActiveBot)
        throw new Error(`ERROR: failure to set active bot.`)
    if(initialActiveBot===mActiveBot)
        return // no change, no problem
    const { id, } = mActiveBot
    /* confirm via server request: set active bot */
    const serverActiveId = await fetch(
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
    if(serverActiveId!==id){
        mActiveBot = initialActiveBot
        throw new Error(`ERROR: server failed to set active bot.`)
    }
    /* update page bot data */
    const { activated=[], activatedFirst=Date.now(), } = mActiveBot
    mActiveBot.activatedFirst = activatedFirst
    activated.push(Date.now()) // newest date is last to .pop()
    // dynamic = (Date.now()-activated.pop()) > (20*60*1000)
    mActiveBot.activated = activated
    /* update page */
    mSpotlightBotBar()
    mSpotlightBotStatus()
    mGreeting(dynamic)
    decorateActiveBot(mActiveBot)
}
/**
 * Highlights bot bar icon of active bot.
 * @public
 * @requires mActiveBot
 * @returns {void}
 */
function mSpotlightBotBar(){
    document.querySelectorAll('.bot-thumb')
        .forEach(icon=>{
            if(icon.alt===mActiveBot?.type)
                icon.classList.add('bot-thumb-active')
            else
                icon.classList.remove('bot-thumb-active')
        })
}
/**
 * Highlights bot container of active bot.
 * @public
 * @requires mActiveBot
 * @returns {void}
 */
function mSpotlightBotStatus(){
    mPageBots
        .forEach(bot=>{
            const { id, type, } = bot
            const botContainer = document.getElementById(type)
            if(botContainer){ // exists on-page
                // set data attribute for active bot
                const { dataset, } = botContainer
                if(dataset && id)
                    botContainer.dataset.active = id===mActiveBot?.id
                mSetBotIconStatus(bot)
            }
        })
}
/**
 * Proxy to update bot-bar, bot-containers, and bot-greeting, if desired. Requirements should come from including module, here `members.mjs`.
 * @public
 * @requires mPageBots() - though will default to empty array.
 * @param {Array} bots - The bot objects to update page with.
 * @param {boolean} includeGreeting - Include bot-greeting.
 * @returns {void}
 */
async function updatePageBots(bots=(mPageBots ?? []), includeGreeting=false, dynamic=false){
    if(!bots?.length)
        throw new Error(`No bots provided to update page.`)
    mPageBots = bots
    console.log('updatePageBots::', bots, includeGreeting, dynamic)
    mUpdateTeam()
    mUpdateBotContainers()
    mUpdateBotBar()
    if(includeGreeting)
        mGreeting(dynamic)
}
/* private functions */
/**
 * Find bot in mPageBots by id.
 * @requires mPageBots
 * @param {string} type - The bot type or id.
 * @returns {object} - The bot object.
 */
function mBot(type){
    return mPageBots.find(bot=>bot.type===type)
        ?? mPageBots.find(bot=>bot.id===type)
}
/**
 * Check if bot is active (by id).
 * @param {Guid} id - The bot id to check.
 * @returns 
 */
function mBotActive(id){
    return id===mActiveBot?.id
        ?? false
}
/**
 * Request bot be created on server.
 * @param {string} type - bot type
 * @returns {object} - bot object from server.
 */
async function mBotCreate(type){
    const url = window.location.origin + '/members/bots/create'
    const method = 'POST'
    const body = JSON.stringify({ type, })
    const headers = { 'Content-Type': 'application/json' }
    let response = await fetch(url, { body, headers, method, })
    if(!response.ok)
        throw new Error(`server unable to create bot.`)
    response = await response.json()
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
        case 'biographer':
            image+='biographer-thumb.png'
            break
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
 * Create a functional collection item HTML div for the specified collection type.
 * @param {object} collectionItem - The collection item object, requires type.
 * @returns {HTMLDivElement} - The collection item.
 */
function mCreateCollectionItem(collectionItem){
    /* collection item container */
    const { assistantType, filename, form, id, keywords, library_id, name, summary, title, type, } = collectionItem
    const item = document.createElement('div')
    item.id = `collection-item_${ id }`
    item.name = `collection-item-${ type }`
    item.classList.add('collection-item', `${ type }-collection-item`)
    /* icon */
    const itemIcon = document.createElement('img')
    itemIcon.id = `collection-item-icon_${ id }`
    itemIcon.name = `collection-item-icon-${ type }`
    itemIcon.classList.add('collection-item-icon', `${ type }-collection-item-icon`)
    itemIcon.src = mBotIcon(assistantType)
    item.appendChild(itemIcon)
    /* name */
    const itemName = document.createElement('span')
    itemName.id = `collection-item-name_${ id }`
    itemName.name = `collection-item-name-${ type }`
    itemName.classList.add('collection-item-name', `${ type }-collection-item-name`)
    itemName.innerText = title
        ?? name
        ?? filename
        ?? `unknown ${ type } item`
    item.appendChild(itemName)
    /* buttons */
    switch(type){
        case 'file':
            /* file-summary button */
            break
        default:
            const itemDelete = mCreateCollectionItemDelete(type, id)
            item.appendChild(itemDelete)
            break
    }
    /* popup */
    switch(type){
        case 'file':
            /* file-summary button */
            break
        default:
            const itemPopup = mCreateCollectionPopup(collectionItem)
            item.appendChild(itemPopup)
            item.addEventListener('click', mViewItemPopup)
            break
    }
    return item
}
/**
 * Create a collection item delete button.
 * @param {string} type - The collection type.
 * @param {Guid} id - The collection id.
 * @returns {HTMLSpanElement} - The collection item delete button.
 */
function mCreateCollectionItemDelete(type, id){
    const itemDelete = document.createElement('span')
    itemDelete.id = `collection-item-delete_${ id }`
    itemDelete.name = `collection-item-delete-${ type }`
    itemDelete.classList.add('fa-solid', 'fa-trash', 'collection-item-delete', `${ type }-collection-item-delete`)
    itemDelete.addEventListener('click', mDeleteCollectionItem, { once: true })
    return itemDelete
}
/**
 * Create a popup for viewing collection item.
 * @param {object} collectionItem - The collection item object.
 * @returns {HTMLDivElement} - The collection popup.
 */
function mCreateCollectionPopup(collectionItem){
    const { id, summary, type, } = collectionItem
    const collectionPopup = document.createElement('div')
    collectionPopup.id = `popup-container_${ id }`
    collectionPopup.name = `collection-popup_${ type }`
    collectionPopup.classList.add('collection-popup', 'popup-container')
    /* create popup content */
    const popupContent = document.createElement('div')
    popupContent.classList.add('popup-content', 'collection-popup-content')
    popupContent.innerText = summary ?? JSON.stringify(collectionItem)
    /* create popup close button */
    const popupClose = document.createElement('button')
    popupClose.classList.add('fa-solid', 'fa-close', 'popup-close', 'collection-popup-close')
    popupClose.setAttribute('aria-label', 'Close')
    popupClose.addEventListener('click', mTogglePopup)
    /* append elements */
    collectionPopup.appendChild(popupContent)
    collectionPopup.appendChild(popupClose)
    return collectionPopup
}
/**
 * Create a team new popup.
 * @requires mActiveTeam
 * @requires mTeamPopup
 * @param {string} type - The type of team to create.
 * @param {boolean} showPopup - Whether or not to show the popup.
 * @returns {void}
 */
function mCreateTeamPopup(type, clickX=0, clickY=0, showPopup=true){
    const { allowCustom, allowedTypes, } = mActiveTeam
    mTeamPopup.innerHTML = '' // clear existing
    const teamPopup = document.createElement('div')
    teamPopup.classList.add(`team-popup-${ type }`, 'team-popup-content')
    teamPopup.id = `team-popup-${ type }`
    teamPopup.name = `team-popup-${ type }`
    let popup
    let offsetX = 0
    switch(type){
        case 'addTeamMember':
            const memberSelect = document.createElement('select')
            memberSelect.id = `team-member-select`
            memberSelect.name = `team-member-select`
            memberSelect.classList.add('team-member-select')
            const memberOption = document.createElement('option')
            memberOption.value = ''
            memberOption.innerText = 'Select a team member...'
            memberSelect.appendChild(memberOption)
            allowedTypes.forEach(type=>{
                if(mPageBots.find(bot=>bot.type===type)) // no duplicates currently
                    return
                const memberOption = document.createElement('option')
                memberOption.value = type
                memberOption.innerText = type
                memberSelect.appendChild(memberOption)
            })
            if(allowCustom){
                const divider = document.createElement('optgroup')
                divider.label = "-----------------"
                memberSelect.appendChild(divider)
                const memberOptionCustom = document.createElement('option')
                memberOptionCustom.value = 'custom'
                memberOptionCustom.innerText = 'Create a custom team member...'
                memberSelect.appendChild(memberOptionCustom)
            }
            popup = memberSelect
            break
        case 'teamSelect':
            break
        default:
            break
    }
    mTeamPopup.appendChild(teamPopup)
    if(popup){
        teamPopup.appendChild(popup)
        mTeamPopup.style.position = 'absolute'
        mTeamPopup.style.visibility = 'hidden'
        show(mTeamPopup)
        offsetX = teamPopup.offsetWidth
        mTeamPopup.style.left = `${ clickX - offsetX }px`
        mTeamPopup.style.top = `${ clickY }px`
        mTeamPopup.style.visibility = 'visible'
        popup.focus()
        document.addEventListener('click', mToggleTeamPopup, { once: true })
        document.addEventListener('keydown', mToggleTeamPopup, { once: true })
        popup.addEventListener('change', mToggleTeamPopup, { once: true })
    }
    if(showPopup)
        show(mTeamPopup)
}
/**
 * Create add a team member popup.
 */
function mCreateTeamMemberSelect(event){
    const { clientX, clientY, } = event
    mCreateTeamPopup('addTeamMember', clientX, clientY, true)
}
/**
 * Create a team select popup.
 */
function mCreateTeamSelect(event){
    const { clientX, clientY, } = event
    mCreateTeamPopup('selectTeam', clientX, clientY, true)
}
/**
 * Delete collection item.
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mDeleteCollectionItem(event){
    event.stopPropagation()
    const id = event.target.id.split('_').pop()
    const item = document.getElementById(`collection-item_${ id }`)
    console.log('Delete collection item:', id, event.target, item)
    if(!item)
        throw new Error(`Collection item not found for deletion request.`)
    /* talk to server */
    const url = window.location.origin + '/members/items/' + id
    const method = 'DELETE'
    let response = await fetch(url, { method: method })
    response = await response.json()
    if(response){ // delete item from collection
        hide(item)
        item.remove()
    } else
        item.addEventListener('click', mDeleteCollectionItem, { once: true })
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
 * Paints bot-greeting to column
 * @private
 * @requires mActiveBot
 * @param {boolean} dynamic - Whether or not to add event listeners for dynamic greeting.
 * @returns {void}
 */
function mGreeting(dynamic=false){
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
                addMessage(_greeting)
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
    document.querySelectorAll('.bot-container')
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
        var content = element.querySelector('.bot-options')
        if(content)
            content.classList.toggle('open')
        var dropdown = element.querySelector('.bot-options-dropdown')
        if(dropdown)
            dropdown.classList.toggle('open')
}
/**
 * Refresh collection on click.
 * @this - collection-refresh
 * @param {string} type - The collection type.
 * @param {HTMLDivElement} collectionList - The collection list.
 * @returns {void}
 */
async function mRefreshCollection(type, collectionList){
    if(!mLibraries.includes(type))
        throw new Error(`Library collection not implemented.`)
    const collection = await fetchCollections(type)
    if(collection.length)
        mUpdateCollection(type, collection, collectionList)
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
 * @private
 * @requires mActiveBot
 * @requires mGlobals
 * @param {object} bot - The bot object.
 * @param {HTMLDivElement} botContainer - The bot container.
 * @returns {void}
 */
function mSetAttributes(bot=mActiveBot, botContainer){
    const { activated=[], activeFirst, bot_id: botId, bot_name: botName, dob, id, interests, mbr_id, narrative, privacy, provider, purpose, thread_id: threadId, type, updates, } = bot
    const memberHandle = mGlobals.getHandle(mbr_id)
    const bot_name = botName
        ?? `${ memberHandle + '_' + type }`
    const thread_id = threadId
        ?? ''
    /* attributes */
    const attributes = [
        { name: 'activated', value: activated },
        { name: 'active', value: mBotActive(id) },
        { name: 'activeFirst', value: activeFirst },
        { name: 'bot_id', value: botId },
        { name: 'bot_name', value: bot_name },
        { name: 'id', value: id },
        { name: 'initialized', value: Date.now() },
        { name: 'mbr_handle', value: memberHandle },
        { name: 'mbr_id', value: mbr_id },
        { name: 'thread_id', value: thread_id },
        { name: 'type', value: type },
    ]
    if(dob)
        attributes.push({ name: 'dob', value: dob })
    if(interests)
        attributes.push({ name: 'interests', value: interests })
    if(narrative)
        attributes.push({ name: 'narrative', value: narrative })
    if(privacy)
        attributes.push({ name: 'privacy', value: privacy })
    if(updates)
        attributes.push({ name: 'updates', value: updates })
    attributes.forEach(attribute=>{
        const { name, value, } = attribute
        botContainer.dataset[name] = value
        const element = document.getElementById(`${ type }-${ name }`)
        if(element){
            const botInput = element.querySelector('input')
            if(botInput)
                botInput.value = botContainer.getAttribute(`data-${ name }`)
        }
    })
}
/**
 * Sets bot status based on active bot, thread, and assistant population.
 * @private
 * @requires mActiveBot - active bot object, but can be undefined without error.
 * @param {object} bot - The bot object.
 * @returns {string} - Determined status.
 */
function mSetBotIconStatus(bot){
    const { bot_id, id, thread_id, type, } = bot
    const botIcon = document.getElementById(`${ type }-icon`)
    switch(true){
        case ( mActiveBot?.id==id ): // activated
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
/**
 * Toggles bot containers and checks for various actions on master click of `this` bot-container. Sub-elements appear as targets and are rendered appropriately.
 * @private
 * @async
 * @param {Event} event - The event object, represents entire bot box as `this`.
 * @returns {void}
 */
async function mToggleBotContainers(event){
    event.stopPropagation()
    // add turn for first time clicked on collection header it refreshes from server, then from there you need to click
    const botContainer = this
    const element = event.target
    const itemIdSnippet = element.id.split('-').pop()
    switch(itemIdSnippet){
        case 'name':
        case 'ticker':
            // start/stop ticker
            // @todo: double-click to edit in place
            const _span = this.querySelector('span')
                ? this.querySelector('span')
                : element
            _span.classList.toggle('no-animation')
            break
        case 'icon':
        case 'title':
            const { dataset, id, } = botContainer
            await setActiveBot(dataset?.id ?? id, true)
            // for moment, yes, intentional cascade to open options
        case 'status':
        case 'type':
        case 'dropdown':
            mOpenStatusDropdown(this)
            break
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
/**
 * Toggles collection item visibility.
 * @this - collection-bar
 * @private
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mToggleCollectionItems(event){
    event.stopPropagation()
    /* constants */
    const { target, } = event /* currentTarget=collection-bar, target=interior divs */
    const { dataset, id, } = this
    const collectionType = id.split('-').pop()
    const collectionList = document.getElementById(`collection-list-${ collectionType }`)
    /* validation */
    if(!collectionList)
        throw new Error(`Collection list not found for toggle.`)
    /* functionality */
    if(!dataset?.init){ // first click
        const refreshTrigger = document.getElementById(`collection-refresh-${ collectionType }`)
        if(!refreshTrigger)
            throw new Error(`Collection refresh not found for toggle.`)
        show(refreshTrigger)
        dataset.init = true
        refreshTrigger.click() // retriggers this event, but will bypass this block
        return
    }
    /* toggle */
    if(target.id===`collection-refresh-${ collectionType }`){ // refresh
        const collectionList = document.getElementById(`collection-list-${ collectionType }`)
        if(!collectionList)
            throw new Error(`associated collection list not found for refresh command`)
        // @stub - spin recycle symbol while servering
        const collections = await mRefreshCollection(collectionType, collectionList)
        show(collectionList) // even if `none`
    } else
        toggleVisibility(collectionList)
    console.log('mToggleCollectionItems::', target)
}
/**
 * Toggles team popup visibility and associated functionality.
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mToggleTeamPopup(event){
    const { clientX, clientY, key, target, type, } = event
    const { value, } = this
    let hidePopup = true
    switch(type){
        case 'change':
            hidePopup = !value?.length
            if(value?.length){ // request to server
                /* validate */
                let bot
                try{
                    bot = mBot(value)
                    console.log('mToggleTeamPopup::CHANGE to:', value, bot)
                } catch(error) {
                    console.log('mToggleTeamPopup::ERROR', error)
                }
                if(bot)
                    mUpdateBotContainers()
                hidePopup = true
            }
            break
        case 'click':
            hidePopup = !this.contains(target)
            if(!hidePopup){
                console.log('mToggleTeamPopup::CLICK-redo', hidePopup)
                document.addEventListener('click', mToggleTeamPopup, { once: true })
                return
            }
            break
        case 'input':
        case 'keydown':
            hidePopup = key?.toLowerCase()!=='enter'
            if(!hidePopup)
                document.addEventListener('keydown', mToggleTeamPopup, { once: true })
            break
    }
    if(hidePopup)
        hide(mTeamPopup)
}
/**
 * Toggles passphrase input visibility.
 * @param {Event} event - The event object.
 * @returns {void}
 */
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
 * Toggles popup visibility.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mTogglePopup(event){
    const { activeId, } = event.detail
    let { popup, } = event.detail
    popup = popup ?? event.target
    const popupId = popup.id.split('_').pop()
    if(!popup)
        throw new Error(`Popup not found.`)
    if(popupId!==activeId){ /* close */
        console.log('mTogglePopup::CLOSE', activeId, popupId)
        popup.classList.remove('collection-popup-visible')
        // does this reset the location?
    } else { /* open */
        popup.classList.add('collection-popup-visible')
        const item = popup.parentElement
        /* calculate desired position */
        const popupHalfHeight = popup.offsetHeight / 2
        const itemHalfHeight = item.offsetHeight / 2
        const desiredMiddlePosition = item.offsetTop + itemHalfHeight
        let topPosition = desiredMiddlePosition - popupHalfHeight
        /* screen failsafes */
        if(topPosition < 0){
            topPosition = 0
        } else if (topPosition + popup.offsetHeight > window.innerHeight){
            topPosition = window.innerHeight - popup.offsetHeight
        }
        // Position the popup 20px to the left of the item's left edge
        const leftPosition = item.offsetLeft - popup.offsetWidth - 20
        /* position */
        popup.style.top = `${ topPosition }px`
        popup.style.left = `${ leftPosition }px`
        console.log('mTogglePopup::OPEN', popup.offsetLeft, popup.offsetWidth, item.offsetWidth, item.offsetLeft)
    }
}
/**
 * 
 * @param {HTMLElement} element - The element to toggle classes on.
 * @param {array} add - The classes to add.
 * @param {array} remove - The classes to remove.
 * @returns {void}
 */
function mToggleClass(element, add=[], remove=[]){
    remove.forEach(className=>element.classList.remove(className))
    add.forEach(className=>element.classList.add(className))
}
/**
 * Toggles switch for element.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mToggleSwitch(event){
    let target = this
    if(event){
        event.preventDefault()
        event.stopPropagation()
        target = event.target
    }
    const { children, } = this
    let { id, } = this /* parent toggle id */
    id = mGlobals.HTMLIdToType(id)
    const associatedSwitch = mFindCheckbox(target) /* throws on missing */
    const { checked, } = associatedSwitch
    const { checkedValue=`${ event ? !checked : checked}`, } = target.dataset
    associatedSwitch.checked = checkedValue==='true'
    let labelId
    /* send array children of this */
    const labels = Array.from(children)
        .filter(child=>{
            const { tagName, } = child
            return tagName.toLowerCase()==='label'
        })
    labels.forEach(label=>{
        const { dataset, id: childLabelId, } = label
        const { checked, } = associatedSwitch
        const { checkedValue=`${ checked }`, } = dataset
        if(checkedValue?.toLowerCase()===`${ checked }`)
            labelId = childLabelId
    })
    if(labelId && labels.length)
        mUpdateLabels(labelId, labels)
}
/**
 * Toggles the privacy switch for the bot.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mToggleSwitchPrivacy(event){
    let { id, } = this
    id = id.replace('-toggle', '') // remove toggle
    const type = mGlobals.HTMLIdToType(id)
    const publicityCheckbox = document.getElementById(`${ type }-publicity-input`)
    const viewIcon = document.getElementById(`${ type }-publicity-toggle-view-icon`)
    const { checked=false, } = publicityCheckbox
    mToggleSwitch.bind(this)(event)
    mToggleClass(viewIcon, !checked ? ['fa-eye'] : ['fa-eye-slash'], checked ? ['fa-eye'] : ['fa-eye-slash'])
    this.addEventListener('click', mToggleSwitchPrivacy, { once: true })
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
    mPageBots
        .forEach(bot => {
            // Create a container div for each bot
            const botThumbContainer = document.createElement('div')
            botThumbContainer.addEventListener('click', setActiveBot)
            botThumbContainer.classList.add('bot-thumb-container')
            // Create an icon element for each bot container
            const botIconImage = document.createElement('img')
            botIconImage.classList.add('bot-thumb')
            botIconImage.src = mBotIcon(bot.type)
            botIconImage.alt = bot.type
            botIconImage.id = `bot-bar-icon_${bot.id}`
            botIconImage.dataset.botId = bot.id
            botBar.appendChild(botIconImage)
        })
}
/**
 * Updates bot-widget containers for whom there is data. If no bot data exists, ignores container.
 * @todo - creation mechanism for new bots or to `reinitialize` or `reset` current bots, like avatar.
 * @todo - architect  better mechanic for populating and managing bot-specific options
 * @async
 * @requires mPageBots
 * @param {boolean} includePersonalAvatar - Include personal avatar, use false when switching teams.
 * @returns {void}
 */
async function mUpdateBotContainers(includePersonalAvatar=true){
    if(!mPageBots?.length)
        throw new Error(`mPageBots not populated.`)
    // get array with containers on-page; should be all bots x team + 'p-a'
    const botContainers = Array.from(document.querySelectorAll('.bot-container'))
    if(!botContainers.length)
        throw new Error(`No bot containers found on page`)
    botContainers
        .forEach(async botContainer=>mUpdateBotContainer(botContainer, includePersonalAvatar))
}
/**
 * Updates the bot container with specifics.
 * @param {HTMLDivElement} botContainer - The bot container.
 * @param {boolean} includePersonalAvatar - Include personal avatar.
 * @param {boolean} showContainer - Show the container, if data exists.
 * @returns {void}
 */
function mUpdateBotContainer(botContainer, includePersonalAvatar = true, showContainer = true) {
    const { id: type } = botContainer
    if(type==='personal-avatar' && !includePersonalAvatar)
        return /* skip personal avatar when requested */
    const bot = mBot(type) // @stub - careful of multiples once allowed!
    if(!bot){
        hide(botContainer)
        return /* no problem if not found, likely available different team */
    }
    /* container listeners */
    botContainer.addEventListener('click', mToggleBotContainers)
    /* universal logic */
    mSetAttributes(bot, botContainer) // first, assigns data attributes
    const { bot_id, interests, narrative, privacy, } = botContainer.dataset
    mSetBotIconStatus(bot)
    mUpdateTicker(type, botContainer)
    mUpdateInterests(type, interests, botContainer)
    mUpdateNarrativeSlider(type, narrative, botContainer)
    mUpdatePrivacySlider(type, privacy, botContainer)
    /* type-specific logic */
    mUpdateBotContainerAddenda(botContainer, bot)
    show(botContainer)
}
/**
 * Updates the bot container with specifics based on `type`.
 * @param {HTMLDivElement} botContainer - The bot container.
 * @param {object} bot - The bot object.
 * @returns {void}
 */
function mUpdateBotContainerAddenda(botContainer, bot){
        if(!botContainer)
            return
        /* type-specific logic */
        const { dataset, id: type } = botContainer
        const localVars = {}
        if(dataset) // assign dataset to localVars
            Object.keys(dataset).forEach(key=>localVars[key] = dataset[key])
        switch(type){
            case 'diary':
            case 'journaler':
            case 'personal-biographer':
                break
            case 'library':
                /* attach library collection listeners */
                if(!mLibraryCollections || !mLibraryCollections.children.length)
                    return
                for(let collection of mLibraryCollections.children){
                    let { id, } = collection
                    id = id.split('-').pop()
                    if(!mLibraries.includes(id)){
                        console.log('Library collection not found.', id)
                        continue
                    }
                    const collectionBar = document.getElementById(`collection-bar-${ id }`)
                    if(collectionBar){
                        const { dataset, } = collectionBar
                        const refresh = document.getElementById(`collection-refresh-${ id }`)
                        if(!dataset?.init && refresh) // first click
                            hide(refresh)
                        collectionBar.addEventListener('click', mToggleCollectionItems)
                    }
                }
                if(mLibraryUpload)
                    mLibraryUpload.addEventListener('click', mUploadFiles)
                break
            case 'personal-avatar':
                /* attach avatar listeners */
                /* set additional data attributes */
                const { dob, id, } = localVars /* date of birth (dob) */
                if(dob?.length)
                    dataset.dob = dob.split('T')[0]
                const memberDobInput = document.getElementById(`${ type }-input-dob`)
                if(memberDobInput){
                    memberDobInput.value = dataset.dob
                    memberDobInput.addEventListener('change', event=>{
                        if(memberDobInput.value.match(/^\d{4}-\d{2}-\d{2}$/)){
                            dataset.dob = memberDobInput.value
                            // @stub - update server
                        } else
                            throw new Error(`Invalid date format.`)
                    })
                }
                mTogglePassphrase(false) /* passphrase */
                break
            default:
                break
        }
}
/**
 * Update the identified collection with provided specifics.
 * @param {string} type - The bot type.
 * @param {Array} collection - The collection items.
 * @param {HTMLDivElement} collectionList - The collection container.
 * @returns {void}
 */
function mUpdateCollection(type, collection, collectionList){
    collectionList.innerHTML = ''
    collection
        .map(item=>({
            ...item,
            name: item.name
                ?? item.filename
                ?? type,
            type: item.type
                ?? item.being
                ?? type,
        }))
        .filter(item=>item.type===type)
        .sort((a, b)=>a.name.localeCompare(b.name))
        .forEach(item=>{
            collectionList.appendChild(mCreateCollectionItem(item))
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
 * Update the bot labels with specifics, .
 * @param {string} activeLabel - The active label.
 * @param {Array} labels - The array of possible labels.
 * @returns {void}
 */
function mUpdateLabels(activeLabelId, labels){
    labels.forEach(label=>{
        const { id, name, value, } = label
        if(id===activeLabelId){
            label.classList.remove('label-inactive')
            label.classList.add('label-active')
        } else {
            label.classList.remove('label-active')
            label.classList.add('label-inactive')
        }
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
    const avatarPublicity = document.getElementById(`${ type }-publicity`)
    if(avatarPublicity){ // 0.7 version
        const publicityContainer = document.getElementById(`${ type }-publicity-toggle`)
        mToggleSwitchPrivacy.bind(publicityContainer)()
        // publicityContainer.addEventListener('click', mToggleSwitchPrivacy, { once: true })
        
    } else { // previous versions
        const privacySlider = document.getElementById(`${ type }-privacy`)
        if(privacySlider){
            botContainer.setAttribute('data-privacy', privacy ?? privacySlider.value)
            privacySlider.value = botContainer.getAttribute('data-privacy')
            privacySlider.addEventListener('input', event=>{
                botContainer.setAttribute('data-privacy', privacySlider.value)
            })
        }
    }
}
/**
 * Updates the active team to specific or default.
 * @requires mAvailableTeams
 * @param {string} teamName - The team name.
 * @returns {void}
 */
async function mUpdateTeam(teamName=mDefaultTeam){
    const team = mAvailableTeams[teamName]
    if(!team)
        throw new Error(`Team "${ teamName }" not available at this time.`)
    mActiveTeam = team
    const { description, name, } = team
    mTeamName.innerText = `${ name } Team`
    mTeamName.addEventListener('click', mCreateTeamSelect)
    mTeamAddMemberIcon.addEventListener('click', mCreateTeamMemberSelect)
    hide(mTeamPopup)
    show(mTeamHeader)
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
/**
 * Upload Files to server from any .
 * @async
 * @requires mAvailableMimeTypes
 * @requires mAvailableUploaderTypes
 * @requires mGlobals
 * @requires mLibraryUpload
 * @param {Event} event - The event object.
 */
async function mUploadFiles(event){
    const { id, parentNode: uploadParent, } = this
    const type = mGlobals.HTMLIdToType(id)
    if(!mAvailableUploaderTypes.includes(type))
        throw new Error(`Uploader type not found, upload function unavailable for this bot.`)
    let fileInput
    try{
        console.log('mUploadFiles()::uploader', document.activeElement)
        mLibraryUpload.disabled = true
        fileInput = document.createElement('input')
        fileInput.id = `file-input-${ type }`
        fileInput.multiple = true
        fileInput.name = fileInput.id
        fileInput.type = 'file'
        uploadParent.appendChild(fileInput)
        hide(fileInput)
        fileInput.click()
        window.addEventListener('focus', async event=>{
            await mUploadFilesInput(fileInput, uploadParent, mLibraryUpload)
        }, { once: true })
    } catch(error) {
        mUploadFilesInputRemove(fileInput, uploadParent, mLibraryUpload)
        console.log('mUploadFiles()::ERROR uploading files:', error)
    }
}
async function mUploadFilesInput(fileInput, uploadParent, uploadButton){
    console.log('mUploadFilesInput()::clicked', fileInput, uploadButton)
    const fileTest = document.getElementById(`file-input-library`)
    // try adding listener to fileInput onChange now
    fileInput.addEventListener('change', async event=>{
        const { files, } = fileInput
        if(files?.length){
            /* send to server */
            const formData = new FormData()
            for(let file of files){
                formData.append('files[]', file)
            }
            formData.append('type', mGlobals.HTMLIdToType(uploadParent.id))
            const response = await fetch('/members/upload', {
                method: 'POST',
                body: formData
            })
            const result = await response.json()
        }
    }, { once: true })
    mUploadFilesInputRemove(fileInput, uploadParent, uploadButton)
}
function mUploadFilesInputRemove(fileInput, uploadParent, uploadButton){
    if(fileInput && uploadParent.contains(fileInput))
        uploadParent.removeChild(fileInput)
    uploadButton.disabled = false
}
/**
 * View/toggles collection item popup.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mViewItemPopup(event){
    event.stopPropagation()
    const activeId = event.target.id.split('_').pop()
    /* get all instances of class */
    document.querySelectorAll('.collection-popup')
        .forEach(popup=>{
            const newEvent = new CustomEvent('custom', { detail: { activeId, popup } })
            mTogglePopup(newEvent)
        })
}
/* exports */
// @todo - export combine of fetchBots and updatePageBots
export {
    activeBot,
    fetchBots,
    fetchCollections,
    setActiveBot,
    updatePageBots,
}