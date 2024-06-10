/* bot functionality */
/* imports */
import {
    addInput,
    addMessage,
    addMessages,
    decorateActiveBot,
    fetchSummary,
    hide,
    seedInput,
    show,
    submit,
    toggleMemberInput,
    toggleVisibility,
} from './members.mjs'
import Globals from './globals.mjs'
/* constants; DOM exists? */
// @todo - placeholder, get from server
const mAvailableMimeTypes = [],
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
    mTeamPopup = document.getElementById('team-popup'),
    mTeams = []
/* variables */
let mActiveBot,
    mActiveTeam,
    mBots,
    mShadows
/* onDomContentLoaded */
document.addEventListener('DOMContentLoaded', async event=>{
    mShadows = await mGlobals.fetchShadows()
    const { bots, activeBotId: id } = await fetchBots()
    if(!bots?.length)
        throw new Error(`ERROR: No bots returned from server`)
    updatePageBots(bots) // includes p-a
    await setActiveBot(id, true)
    console.log('bots.mjs::DOMContentLoaded()::mBots', mBots, mShadows)
})
/* public functions */
/**
 * Get active bot.
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
async function fetchTeam(teamId){
    const url = window.location.origin + '/members/teams/' + teamId
    const method = 'POST'
    const response = await fetch(url, { method, })
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    return await response.json()
}
/**
 * Fetch MyLife Teams from server.
 * @returns {Object[Array]} - The list of available team objects.
 */
async function fetchTeams(){
    const url = window.location.origin + '/members/teams'
    const response = await fetch(url)
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    return await response.json()
}
/**
 * Get specific bot by id (first) or type.
 * @param {string} type - The bot type, optional.
 * @param {Guid} id - The bot id, optional.
 * @returns {object} - The bot object.
 */
function getBot(type='personal-avatar', id){
    return mBot(id ?? type)
}
/**
 * Set active bot on server and update page bots.
 * @requires mActiveBot
 * @requires mBots
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
 * Proxy to update bot-bar, bot-containers, and bot-greeting, if desired. Requirements should come from including module, here `members.mjs`.
 * @public
 * @requires mBots
 * @param {Array} bots - The bot objects to update page with.
 * @param {boolean} includeGreeting - Include bot-greeting.
 * @returns {void}
 */
async function updatePageBots(bots=mBots, includeGreeting=false, dynamic=false){
    if(!bots?.length)
        throw new Error(`No bots provided to update page.`)
    if(mBots!==bots)
        mBots = bots
    await mUpdateTeams()
    await mUpdateBotContainers()
    mUpdateBotBar()
    if(includeGreeting)
        mGreeting(dynamic)
}
/* private functions */
/**
 * Find bot in mBots by id.
 * @requires mBots
 * @param {string} type - The bot type or id.
 * @returns {object} - The bot object.
 */
function mBot(type){
    return mBots.find(bot=>bot.type===type)
        ?? mBots.find(bot=>bot.id===type)
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
 * @requires mActiveTeam
 * @param {string} type - bot type
 * @returns {object} - bot object from server.
 */
async function mCreateBot(type){
    const { id: teamId, } = mActiveTeam
    const url = window.location.origin + '/members/bots/create'
    const method = 'POST'
    const body = JSON.stringify({ teamId, type, })
    const headers = { 'Content-Type': 'application/json' }
    let response = await fetch(url, { body, headers, method, })
    if(!response.ok)
        throw new Error(`server unable to create bot.`)
    response = await response.json()
    return response
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
            /* file-summary icon */
            const itemSummary = mCreateCollectionItemSummarize(type, id, filename)
            item.appendChild(itemSummary)
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
            item.addEventListener('click', mTogglePopup)
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
    itemDelete.classList.add('fas', 'fa-trash', 'collection-item-delete', `${ type }-collection-item-delete`)
    itemDelete.addEventListener('click', mDeleteCollectionItem, { once: true })
    return itemDelete
}
function mCreateCollectionItemSummarize(type, id, name){
    const itemSummarize = document.createElement('span')
    itemSummarize.classList.add('fas', 'fa-file-circle-question', 'collection-item-summary', `${ type }-collection-item-summary`)
    itemSummarize.dataset.fileId = id /* raw openai file id */
    itemSummarize.dataset.fileName = name
    itemSummarize.dataset.id= `collection-item-summary-${ id }`
    itemSummarize.dataset.type = type
    itemSummarize.id = itemSummarize.dataset.id
    itemSummarize.name = `collection-item-summary-${ type }`
    itemSummarize.addEventListener('click', mSummarize, { once: true })
    return itemSummarize
}
/**
 * A memory shadow is a scrolling text members can click to get background (to include) or create content to bolster the memory. Goes directly to chat, and should minimize, or close for now, the story/memory popup.
 * @requires mShadows
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mMemoryShadow(event){
    event.stopPropagation()
    const { itemId, lastResponse, shadowId, } = this.dataset // type enum: [agent, member]
    const shadow = mShadows.find(shadow=>shadow.id===shadowId)
    if(!shadow)
        return
    const { categories, id, proxy='/shadow', text, type, } = shadow
    switch(type){
        case 'agent': /* agent shadows go directly to server for answer */
            addMessage(text, { role: 'member', })
            const response = await submit(text, { itemId, proxy, shadowId, }) /* proxy submission, use endpoint: /shadow */
            const { error, errors: _errors, itemId: responseItemId, messages, processingBotId, success=false, } = response
            const errors = error?.length ? [error] : _errors
            if(!success || !messages?.length)
                throw new Error(`No response from server for shadow request.`)
            const botId = processingBotId
                ?? messages[0].activeBotId
                ?? mActiveBot?.id
            if(mActiveBot?.id===botId)
                setActiveBot(botId)
            this.dataset.lastResponse = JSON.stringify(messages)
            addMessages(messages) // print to screen
            break
        case 'member': /* member shadows populate main chat input */
            const action = `update-memory`
            const seedText = text.replace(/(\.\.\.|…)\s*$/, '').trim() + ' '
            seedInput(proxy, action, itemId, shadowId, seedText, text)
            break
        default:
            throw new Error(`Unimplemented shadow type: ${ type }`)
    }
    /* close popup */
    // @stub - minimize to header instead?
    const popupClose = document.getElementById(`popup-close_${ itemId }`)
    if(popupClose)
        popupClose.click()
}
/**
 * Processes a document summary request.
 * @this - collection-item-summary (HTMLSpanElement)
 * @private
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mSummarize(event){
    event.preventDefault()
    event.stopPropagation()
    const { dataset, } = this
    console.log('mSummarize::dataset', dataset, this)
    if(!dataset)
        throw new Error(`No dataset found for summary request.`)
    const { fileId, fileName, type, } = dataset
    if(type!=='file')
        throw new Error(`Unimplemented type for summary request.`)
    /* visibility triggers */
    this.classList.remove('summarize-error', 'fa-file-circle-exclamation', 'fa-file-circle-question', 'fa-file-circle-xmark')
    this.classList.add('fa-compass', 'spin')
    /* fetch summary */
    const { messages, success, } = await fetchSummary(fileId, fileName) // throws on console.error
    /* visibility triggers */
    this.classList.remove('fa-compass', 'spin')
    if(success)
        this.classList.add('fa-file-circle-xmark')
    else
        this.classList.add('fa-file-circle-exclamation', 'summarize-error')
    /* print response */
    addMessages(messages)
    setTimeout(_=>{
        this.addEventListener('click', mSummarize, { once: true })
        this.classList.add('fa-file-circle-question')
        this.classList.remove('summarize-error', 'fa-file-circle-exclamation', 'fa-file-circle-xmark', 'fa-compass') // jic
        show(this)
    }, 20*60*1000)
}
/**
 * Closes the team popup.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mCloseTeamPopup(event){
    event.preventDefault()
    event.stopPropagation()
    const { ctrlKey, key, target, } = event
    if((key && key!='Escape') && !(ctrlKey && key=='w'))
        return
    document.removeEventListener('keydown', mCloseTeamPopup)
    hide(mTeamPopup)
}
/**
 * Creates bot thumb container.
 * @param {object} bot - The bot object, defaults to personal-avatar.
 * @returns {HTMLDivElement} - The bot thumb container.
 */
function mCreateBotThumb(bot=getBot()){
    const { bot_name, id, type, } = bot
    /* bot-thumb container */
    const botThumbContainer = document.createElement('div')
    botThumbContainer.id = `bot-bar-container_${ id }`
    botThumbContainer.name = `bot-bar-container-${ type }`
    botThumbContainer.title = bot_name
    botThumbContainer.addEventListener('click', setActiveBot)
    botThumbContainer.classList.add('bot-thumb-container')
    /* bot-thumb */
    const botIconImage = document.createElement('img')
    botIconImage.classList.add('bot-thumb')
    botIconImage.src = mBotIcon(type)
    botIconImage.alt = type
    botIconImage.id = `bot-bar-icon_${ id }`
    botIconImage.dataset.bot_id = id
    botThumbContainer.appendChild(botIconImage)
    return botThumbContainer
}
/**
 * Create a popup for viewing collection item.
 * @param {object} collectionItem - The collection item object.
 * @returns {HTMLDivElement} - The collection popup.
 */
function mCreateCollectionPopup(collectionItem) {
    const { id, name, summary, title, type } = collectionItem
    const collectionPopup = document.createElement('div')
    collectionPopup.classList.add('collection-popup', 'popup-container')
    collectionPopup.dataset.active = 'false'
    collectionPopup.dataset.id = id
    collectionPopup.dataset.title = title
    collectionPopup.dataset.type = type
    collectionPopup.id = `popup-container_${ id }`
    collectionPopup.name = `collection-popup_${ type }`
    collectionPopup.addEventListener('click', (e)=>e.stopPropagation()) /* Prevent event bubbling to collection-bar */
    /* popup header */
    const popupHeader = document.createElement('div')
    popupHeader.classList.add('popup-header', 'collection-popup-header')
    popupHeader.id = `popup-header_${ id }`
    popupHeader.innerText = title ?? `${ type } Item`
    /* Variables for dragging */
    let isDragging = false
    let offsetX, offsetY
    /* Mouse down event to initiate drag */
    popupHeader.addEventListener('mousedown', (e)=>{
        isDragging = true
        offsetX = e.clientX - collectionPopup.offsetLeft
        offsetY = e.clientY - collectionPopup.offsetTop
        e.stopPropagation()
    })
    /* Mouse move event to drag the element */
    popupHeader.addEventListener('mousemove', (e)=>{
        if(isDragging){
            collectionPopup.style.left = `${e.clientX - offsetX}px`
            collectionPopup.style.position = 'absolute'
            collectionPopup.style.top = `${e.clientY - offsetY}px`
        }
    })
    /* Mouse up event to end drag */
    popupHeader.addEventListener('mouseup', ()=>{
        isDragging = false
        collectionPopup.dataset.offsetX = collectionPopup.offsetLeft
        collectionPopup.dataset.offsetY = collectionPopup.offsetTop
    })
    /* create popup close button */
    const popupClose = document.createElement('button')
    popupClose.classList.add('fa-solid', 'fa-close', 'popup-close', 'collection-popup-close')
    popupClose.id = `popup-close_${ id }`
    popupClose.setAttribute('aria-label', 'Close')
    popupClose.addEventListener('click', mTogglePopup)
    /* create popup body/container */
    const popupBody = document.createElement('div')
    popupBody.classList.add('popup-body', 'collection-popup-body')
    popupBody.id = `popup-body_${ id }`
    popupBody.name = `popup-body-${ type }`
    /* create popup content */
    const content = summary ?? JSON.stringify(collectionItem)
    const popupContent = document.createElement('textarea')
    popupContent.classList.add('popup-content', 'collection-popup-content')
    popupContent.dataset.lastUpdatedContent = content
    popupContent.id = `popup-content_${id}`
    popupContent.readOnly = true
    popupContent.value = content
    /* create popup sidebar */
    const sidebar = document.createElement('div')
    sidebar.classList.add('popup-sidebar')
    sidebar.id = `popup-sidebar_${ id }`
    /* create edit toggle button */
    const popupEdit = document.createElement('span')
    popupEdit.classList.add('fas', 'fa-edit', 'popup-sidebar-icon')
    popupEdit.id = `popup-edit_${ id }`
    popupEdit.dataset.id = id
    popupEdit.dataset.contentId = popupContent.id
    /* create save button */
    const popupSave = document.createElement('span')
    popupSave.classList.add('fas', 'fa-save', 'popup-sidebar-icon')
    popupSave.id = `popup-save_${ id }`
    popupSave.dataset.id = id
    popupSave.dataset.contentId = popupContent.id
    popupSave.addEventListener('click', mSetCollectionItem)
    /* toggle-edit listeners */
    popupEdit.addEventListener('click', (event)=>{
        const { target: editIcon,} = event
        const content = document.getElementById(editIcon.dataset?.contentId)
        if(!content)
            throw new Error(`No content found for edit request.`)        
        _toggleEditable(event, false, content)
    })
    popupContent.addEventListener('dblclick', (event)=>{
        const { target: contentElement, } = event
        _toggleEditable(event, false, contentElement)
    }) /* double-click to toggle edit */
    popupContent.addEventListener('blur', (event) => {
        const { target: contentElement, } = event
        _toggleEditable(event, true, contentElement)
        // @stub - update content on server call if dynamic
    })
    popupContent.addEventListener('keydown', (event) => {
        const { target: contentElement, } = event
        if(event.key==='Escape')
            _toggleEditable(event, true, contentElement)
    })
    /* inline function to toggle editable state */
    function _toggleEditable(event, state, contentElement){
        event.stopPropagation()
        contentElement.dataset.lastCursorPosition = contentElement.selectionStart
        contentElement.readOnly = state
            ?? !contentElement.readOnly
            ?? true
        contentElement.focus()
    }
    sidebar.appendChild(popupEdit)
    sidebar.appendChild(popupSave)
    /* create emoticon bar */
    const emoticons = ['😀', '😢', '😡', '😍', '😱'] // Add more emoticons as needed
    emoticons.forEach(emoticon => {
        const emoticonButton = document.createElement('span')
        emoticonButton.classList.add('popup-sidebar-emoticon')
        emoticonButton.innerText = emoticon
        emoticonButton.addEventListener('click', (event)=>{
            event.stopPropagation()
            console.log('Emoticon:write', emoticon, popupContent.readOnly, popupContent)
            const { lastCursorPosition, } = popupContent.dataset
            const insert = ` ${ emoticon }`
            if(lastCursorPosition){
                const textBeforeCursor = popupContent.value.substring(0, lastCursorPosition)
                const textAfterCursor = popupContent.value.substring(popupContent.selectionEnd)
                popupContent.value = textBeforeCursor + insert + textAfterCursor
                popupContent.selectionStart = popupContent.selectionEnd = lastCursorPosition + emoticon.length + 1
            } else
                popupContent.value += insert
        })
        sidebar.appendChild(emoticonButton)
    })
    /* append to body */
    popupBody.appendChild(popupContent)
    popupBody.appendChild(sidebar)
    /* create type-specific elements */
    let typePopup
    switch (type) {
        case 'entry':
        case 'experience':
        case 'file':
        case 'story': // memory
            /* improve memory container */
            const improveMemory = document.createElement('div')
            improveMemory.classList.add(`collection-popup-${ type }`)
            improveMemory.id = `popup-${ type }_${ id }`
            improveMemory.name = 'improve-memory-container'
            /* shadows, share-memory panel */
            const improveMemoryLane = document.createElement('div')
            improveMemoryLane.classList.add('improve-memory-lane')
            /* story shadows */
            if(mShadows?.length)
                improveMemoryLane.appendChild(mCreateMemoryShadows(id))
            /* share memory panel */
            const shareMemory = document.createElement('div')
            shareMemory.classList.add('share-memory-container')
            shareMemory.id = `share-memory_${ id }`
            shareMemory.name = 'share-memory-container'
            const shareMemoryActorSelect = document.createElement('div')
            shareMemoryActorSelect.classList.add('share-memory-select')
            shareMemoryActorSelect.title = `Select the actor or narrator for the story. Who should tell your story? Or who will play "you"?`
            /* actor */
            const actorList = ['Biographer', 'My Avatar', 'Member avatar', 'Q', 'MyLife Professional Actor', 'Custom']
            const actor = document.createElement('select')
            actor.classList.add('share-memory-actor-select')
            actor.dataset.id = id
            actor.dataset.type = `actor`
            actor.id = `share-memory-actor-select_${ id }`
            actor.name = 'share-memory-actor-select'
            /* actor/narrator label; **note**: for instance if member has tuned a specific bot of theirs to have an outgoing voice they like */
            const actorLabel = document.createElement('label')
            actorLabel.classList.add('share-memory-actor-select-label')
            actorLabel.htmlFor = actor.id
            actorLabel.id = `share-memory-actor-select-label_${ id }`
            actorLabel.textContent = 'Actor/Narrator:'
            shareMemoryActorSelect.appendChild(actorLabel)
            const actorOption = document.createElement('option')
            actorOption.disabled = true
            actorOption.selected = true
            actorOption.value = ''
            actorOption.textContent = 'Select narrator...'
            actor.appendChild(actorOption)
            actorList.forEach(option=>{
                const actorOption = document.createElement('option')
                actorOption.selected = false
                actorOption.textContent = option
                actorOption.value = option
                actor.appendChild(actorOption)
            })
            actor.addEventListener('change', mStory)
            shareMemoryActorSelect.appendChild(actor)
            shareMemory.appendChild(shareMemoryActorSelect)
            /* pov */
            const shareMemoryPovSelect = document.createElement('div')
            shareMemoryPovSelect.classList.add('share-memory-select')
            shareMemoryPovSelect.title = `This refers to the position of the "listener" in the story. Who is the listener? Are they referred to as the protagonist? Antagonist? A particular person or character in your story?`
            const povList = ['Me', 'Protagonist', 'Antagonist', 'Character',]
            const pov = document.createElement('select')
            pov.classList.add('share-memory-pov-select')
            pov.dataset.id = id
            pov.dataset.type = `pov`
            pov.id = `share-memory-pov-select_${ id }`
            pov.name = 'share-memory-pov-select'
            /* pov label */
            const povLabel = document.createElement('label')
            povLabel.classList.add('share-memory-pov-select-label')
            povLabel.htmlFor = pov.id
            povLabel.id = `share-memory-pov-select-label_${ id }`
            povLabel.textContent = 'Point of View:'
            shareMemoryPovSelect.appendChild(povLabel)
            const povOption = document.createElement('option')
            povOption.disabled = true
            povOption.selected = true
            povOption.value = ''
            povOption.textContent = 'Select listener vantage...'
            pov.appendChild(povOption)
            povList.forEach(option=>{
                const povOption = document.createElement('option')
                povOption.value = option
                povOption.textContent = option
                pov.appendChild(povOption)
            })
            pov.addEventListener('change', mStory)
            shareMemoryPovSelect.appendChild(pov)
            shareMemory.appendChild(shareMemoryPovSelect)
            /* narrative context */
            const narrativeContext = document.createElement('textarea')
            narrativeContext.classList.add('share-memory-context')
            narrativeContext.dataset.id = id
            narrativeContext.dataset.previousValue = ''
            narrativeContext.dataset.type = `narrative`
            narrativeContext.id = `share-memory-context_${ id }`
            narrativeContext.name = 'share-memory-context'
            narrativeContext.placeholder = 'How should the story be told? Should it be scary? humorous? choose your own adventure?'
            narrativeContext.title = `How should the story be told? Should it be scary? humorous? Will it be a choose your own adventure that deviates from the reality of your memory?`
            narrativeContext.value = narrativeContext.dataset.previousValue
            narrativeContext.addEventListener('blur', mStoryContext)
            shareMemory.appendChild(narrativeContext)
            /* play memory */
            const memoryPlay = document.createElement('button')
            memoryPlay.classList.add('relive-memory')
            memoryPlay.dataset.id = id
            memoryPlay.id = `relive-memory_${ id }`
            memoryPlay.name = 'relive-memory'
            memoryPlay.textContent = 'Relive Memory'
            memoryPlay.addEventListener('click', mReliveMemory, { once: true })
            shareMemory.appendChild(memoryPlay)
            improveMemoryLane.appendChild(shareMemory)
            // play memory
            /* memory media-carousel */
            const memoryCarousel = document.createElement('div')
            memoryCarousel.classList.add('memory-carousel')
            memoryCarousel.id = `memory-carousel_${ id }`
            memoryCarousel.name = 'memory-carousel'
            memoryCarousel.textContent = 'Coming soon: media file uploads to Enhance and Improve memories'
            /* append elements */
            improveMemory.appendChild(improveMemoryLane)
            improveMemory.appendChild(memoryCarousel)
            typePopup = improveMemory
            break
        default:
            break
    }
    /* append elements */
    collectionPopup.appendChild(popupHeader)
    collectionPopup.appendChild(popupClose)
    collectionPopup.appendChild(popupBody)
    if(typePopup)
        collectionPopup.appendChild(typePopup)
    return collectionPopup
}
/**
 * Create a memory shadow `HTMLDivElement`.
 * @requires mShadows
 * @param {Guid} itemId - The collection item id.
 * @returns {HTMLDivElement} - The shadowbox <div>.
 */
function mCreateMemoryShadows(itemId){
    let currentIndex = Math.floor(Math.random() * mShadows.length)
    const shadow = mShadows[currentIndex]
    const shadowBox = document.createElement('div')
    shadowBox.classList.add('memory-shadow')
    shadowBox.dataset.itemId = itemId
    shadowBox.id = `memory-shadow_${ itemId }`
    shadowBox.name = 'memory-shadow'
    // @stub - add mousewheel event listener to scroll through shadows
    // shadowBox.addEventListener('wheel', _=>console.log('wheel', _.deltaMode)) // no scroll
    /* shadow vertical carousel */
    // @stub - include vertical carousel with more visible prompts, as if on a cylinder
    /* single shadow text */
    const { categories, id, text, type, } = shadow
    const shadowText = document.createElement('div')
    shadowText.classList.add('memory-shadow-text')
    shadowText.dataset.itemId = itemId
    shadowText.dataset.lastResponse = '' // array of messages, will need to stringify/parse
    shadowText.dataset.shadowId = id
    shadowText.textContent = text
    shadowText.addEventListener('click', mMemoryShadow)
    shadowBox.appendChild(shadowText)
    // @stub - add mousewheel event listener to scroll through shadows
    /* pagers */
    const shadowPagers = document.createElement('div')
    shadowPagers.classList.add('memory-shadow-pagers')
    shadowPagers.id = `memory-shadow-pagers_${ itemId }`
    /* back pager */
    const backPager = document.createElement('div')
    backPager.dataset.direction = 'back'
    backPager.id = `memory-shadow-back_${ itemId }`
    backPager.classList.add('caret', 'caret-up')
    backPager.addEventListener('click', _pager)
    /* next pager */
    const nextPager = document.createElement('div')
    nextPager.dataset.direction = 'next'
    nextPager.id = `memory-shadow-next_${ itemId }`
    nextPager.classList.add('caret', 'caret-down')
    nextPager.addEventListener('click', _pager)
    /* inline function _pager */
    function _pager(event){
        event.stopPropagation()
        const { direction, } = this.dataset
        currentIndex = direction==='next'
            ? (currentIndex + 1) % mShadows.length
            : (currentIndex - 1 + mShadows.length) % mShadows.length
        const { text, } = mShadows[currentIndex]
        shadowText.dataset.shadowId = mShadows[currentIndex].id
        shadowText.textContent = text
    }
    shadowPagers.appendChild(backPager)
    shadowPagers.appendChild(nextPager)
    shadowBox.appendChild(shadowPagers)
    /* loop */
    const seconds = 20 * 1000
    let intervalId
    startShadows()
    function startShadows(){
        stopShadows()
        intervalId = setInterval(_=>nextPager.click(), seconds)
    }
    function stopShadows(){
        clearInterval(intervalId)
    }
    return shadowBox
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
    // const { description, id, teams, } = await mCreateBot(type)
    const bot = await mCreateBot(type)
    if(!bot)
        throw new Error(`no bot created for team member`)
    const { description, id, teams, } = bot
    mBots.push(bot)
    setActiveBot(id)
    updatePageBots(mBots, true, true)
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
    const { allowCustom, allowedTypes, } = mActiveTeam
    mTeamPopup.style.visibility = 'hidden'
    mTeamPopup.innerHTML = '' // clear existing
    const teamPopup = document.createElement('div')
    teamPopup.classList.add(`team-popup-${ type }`, 'team-popup-content')
    teamPopup.id = `team-popup-${ type }`
    teamPopup.name = `team-popup-${ type }`
    let popup
    let offsetX = 0
    let listener
    switch(type){
        case 'addTeamMember':
            const memberSelect = document.createElement('select')
            memberSelect.id = `team-member-select`
            memberSelect.name = `team-member-select`
            memberSelect.classList.add('team-member-select')
            const memberOption = document.createElement('option')
            memberOption.disabled = true
            memberOption.innerText = 'Select a team member to add...'
            memberOption.selected = true
            memberOption.value = ''
            memberSelect.appendChild(memberOption)
            allowedTypes.forEach(type=>{
                if(mBots.find(bot=>bot.type===type)) // no duplicates currently
                    return
                const memberOption = document.createElement('option')
                memberOption.innerText = type
                memberOption.value = type
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
            memberSelect.addEventListener('click', (e)=>e.stopPropagation()) // stops from closure onClick
            memberSelect.addEventListener('change', mCreateTeamMember, { once: true })
            listener = mTeamMemberSelect
            popup = memberSelect
            break
        case 'selectTeam':
            console.log('Create team select popup:', mTeams, mActiveTeam)
            const teamSelect = document.createElement('select')
            teamSelect.id = `team-select`
            teamSelect.name = `team-select`
            teamSelect.classList.add('team-select')
            const teamOption = document.createElement('option')
            teamOption.disabled = true
            teamOption.innerText = `MyLife's pre-defined agent teams...`
            teamOption.selected = true
            teamOption.value = ''
            teamSelect.appendChild(teamOption)
            mTeams.forEach(team=>{
                const { name, } = team
                const teamOption = document.createElement('option')
                teamOption.value = name
                teamOption.innerText = name
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
async function mReliveMemory(event){
    event.preventDefault()
    event.stopPropagation()
    const { id, } = this.dataset
    const popupClose = document.getElementById(`popup-close_${ id }`)
    if(popupClose)
        popupClose.click()
    const { messages, success, } = await mReliveMemoryRequest(id)
    if(success){
        addMessages(messages)
        // create input - create this function in member, as it will display it in chat and pipe it back here as below
        const input = document.createElement('button')
        input.addEventListener('click', mReliveMemory, { once: true })
        input.textContent = 'next'
        addInput(input)
    } else
        throw new Error(`Failed to fetch memory for relive request.`)
}
async function mReliveMemoryRequest(id){
    try {
        const url = window.location.origin + '/members/memory/relive/' + id
        let response = await fetch(url, { method: 'PATCH' })
        if(!response.ok)
            throw new Error(`HTTP error! Status: ${response.status}`)
        response = await response.json()
        return response
    } catch (error) {
        console.log('Error fetching memory for relive:', error)
    }
}
/**
 * Set Bot data on server.
 * @param {Object} bot - bot object
 * @returns {void}
 */
async function mSetBot(bot){
    try {
        const { id, } = bot
        const url = window.location.origin + '/members/bots/' + id
        const method = id?.length
            ? 'PUT' // update
            : 'POST' // create
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
 * Sets collection item content.
 * @private
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mSetCollectionItem(event){
    event.stopPropagation()
    const { contentId, id, } = this.dataset
    const contentElement = document.getElementById(contentId)
    if(!contentElement)
        throw new Error(`No content found for collection item update.`)
    const { dataset, } = contentElement
    const { emoticons=[], lastUpdatedContent, } = dataset
    const { value: content, } = contentElement
    if(content!=lastUpdatedContent && await mSetCollectionItemOnServer(id, content, emoticons))
        contentElement.dataset.lastUpdatedContent = content
    else
        contentElement.value = lastUpdatedContent
}
/**
 * Sets collection item content on server.
 * @private
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mSetCollectionItemOnServer(id, content, emoticons){
    const summary = content
    const url = window.location.origin + '/members/item/' + id
    const method = 'PUT'
    let response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emoticons, summary, })
    })
    if(!response.ok)
        return false
    response = await response.json()
    return response?.success
        ?? false
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
    mBots
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
 * Submit updated `story` data. No need to return unless an error, which is currently thrown.
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mStory(event){
    event.stopPropagation()
    const { dataset, value, } = this
    const { id, type: field, } = dataset
    if(!value?.length)
        throw new Error(`No value provided for story update.`)
    const url = window.location.origin + '/members/item/' + id
    const method = 'PUT'
    let response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [`${ field }`]: value })
    })
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    response = await response.json()
    if(!response.success)
        throw new Error(`Narrative "${ value }" not accepted.`)
}
async function mStoryContext(event){
    const { dataset, value, } = this
    const { previousValue, } = dataset
    if(previousValue==value)
        return
    mStory.bind(this)(event) // no need await
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
 * @requires mActiveTeam
 * @param {Event} event - The event object. 
 * @returns {void}
 */
function mTeamSelect(event){
    const { value, } = this
    mUpdateTeams(value) // `change` requires that value not be the same
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
            if(!mSetBot(updateBot))
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
        await mRefreshCollection(collectionType, collectionList)
        show(target)
        show(collectionList) // even if `none`
    } else
        toggleVisibility(collectionList)
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
 * @this - collection-item
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mTogglePopup(event){
    event.stopPropagation()
    const { id, } = this
    const popupId = id.split('_').pop()
    const popup = document.getElementById(`popup-container_${ popupId }`)
    if(!popup)
        throw new Error(`Popup not found: ${ popupId }`)
    const { active, } = popup.dataset
    if(active==='true'){ /* close */
        console.log('mTogglePopup::closing:', popupId, popup.dataset, active)
        popup.dataset.active = 'false'
        hide(popup)
    } else { /* open */
        const { title, type, } = popup.dataset
        let { offsetX, offsetY, } = popup.dataset
        if(!offsetX || !offsetY){ // initial placement onscreen
            const item = popup.parentElement // collection-item
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
            const leftPosition = item.offsetLeft - popup.offsetWidth - 10 // hard-coded 10px to the left
            /* set dataset */
            offsetX = `${ leftPosition }px`
            offsetY = `${ topPosition }px`
            popup.dataset.offsetY = offsetY
            popup.dataset.offsetX = offsetX
        }
        /* position */
        popup.style.left = offsetX
        popup.style.right = 'auto'
        popup.style.top = offsetY
        show(popup)
        popup.dataset.active = 'true'
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
 * @requires mBots
 * @returns {void}
 */
function mUpdateBotBar(){
    const botBarBots = []
    botBar.innerHTML = ''
    if(!mBots?.length)
        throw new Error(`No bots found for bot bar.`)
    const avatarThumb = mCreateBotThumb(getBot())
    botBar.appendChild(avatarThumb) // avatar
    botBar.appendChild(_thumbDivider())
    botBarBots.push(getBot().id) // active bot
    mActiveTeam?.bots // active team bots
        .forEach(bot=>{
            botBar.appendChild(mCreateBotThumb(bot))
            botBarBots.push(bot.id)
        })
    botBar.appendChild(_thumbDivider())
    // create remaining bots
    mBots
        .filter(bot=>!botBarBots.includes(bot.id))
        .forEach(bot=>{
            botBar.appendChild(mCreateBotThumb(bot))
            botBarBots.push(bot.id)
        })
    function _thumbDivider(){
        const divider = document.createElement('div')
        divider.classList.add('bot-bar-divider')
        return divider
    }
}
/**
 * Updates bot-widget containers for whom there is data. If no bot data exists, ignores container.
 * @todo - creation mechanism for new bots or to `reinitialize` or `reset` current bots, like avatar.
 * @todo - architect  better mechanic for populating and managing bot-specific options
 * @async
 * @requires mBots
 * @param {boolean} includePersonalAvatar - Include personal avatar, use false when switching teams.
 * @returns {void}
 */
async function mUpdateBotContainers(includePersonalAvatar=true){
    if(!mBots?.length)
        throw new Error(`mBots not populated.`)
    const botContainers = Array.from(document.querySelectorAll('.bot-container'))
    if(!botContainers.length)
        throw new Error(`No bot containers found on page`)
    botContainers
        .forEach(async botContainer=>mUpdateBotContainer(botContainer, includePersonalAvatar))
}
/**
 * Updates the bot container with specifics.
 * @todo - will need to refactor to allow for on-demand containers; could still come from HTML fragments, but cannot be "hard-coded" by type as they are, given that different teams will have different bots of the _same_ `type`.
 * @param {HTMLDivElement} botContainer - The bot container.
 * @param {boolean} includePersonalAvatar - Include personal avatar.
 * @returns {void}
 */
function mUpdateBotContainer(botContainer, includePersonalAvatar=true) {
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
 * Requests update of bot instructions and functions on LLM model.
 * @public
 * @async
 * @requires mActiveBot
 * @returns {void} - presumes success or failure, but beyond control of front-end.
 */
async function updateBotInstructions(){
    const { id, } = mActiveBot
    const url = window.location.origin + '/members/bots/system-update/' + id
    const method = 'PUT'
    const response = await fetch(url, { method: method })
    const { success, } = await response.json()
    console.log(`Bot instructions update success: ${ success ?? false }`)
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
 * @requires mActiveTeam
 * @requires mAvailableTeams
 * @requires mDefaultTeam
 * @requires mTeams
 * @param {string} identifier - The name or id of active team.
 * @returns {void}
 */
async function mUpdateTeams(identifier=mDefaultTeam){
    if(!mTeams?.length)
        mTeams.push(...await fetchTeams())
    const team = mTeams
        .find(team=>team.name===identifier || team.id===identifier)
    if(!team)
        throw new Error(`Team "${ identifier }" not available at this time.`)
    if(mActiveTeam!==team){
        const { id: teamId, } = team
        const activeTeam = await fetchTeam(teamId) // set team on server and receive bot ids in `bots`
        if(activeTeam)
            mActiveTeam = activeTeam
    }
    const { allowedTypes, description, id, name, title, } = team
    mTeamName.dataset.id = id
    mTeamName.dataset.description = description
    mTeamName.innerText = `${ title ?? name } Team`
    mTeamName.title = description
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
/* exports */
// @todo - export combine of fetchBots and updatePageBots
export {
    activeBot,
    fetchBots,
    fetchCollections,
    fetchTeam,
    fetchTeams,
    getBot,
    setActiveBot,
    updatePageBots,
}