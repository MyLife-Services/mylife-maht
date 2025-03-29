/* bot functionality */
/* imports */
import {
    addInput,
    addMessage,
    addMessages,
    clearSystemChat,
    decorateActiveBot,
    experiences,
    expunge,
    getActiveItemId,
    globals,
    hide,
    introduction,
    enactInstruction,
    privacyPolicy,
    seedInput,
    setActiveAction,
    setActiveItem,
    updateActiveItemTitle,
    routine,
    show,
    startExperience,
    submit,
    toggleMemberInput,
    toggleVisibility,
    unsetActiveAction,
    unsetActiveItem,
} from './members.mjs'
const mAvailableCollections = ['entry', 'experience', 'file', 'memory'], // ['chat', 'conversation'],
    mAvailableMimeTypes = [],
    mAvailableUploaderTypes = ['collections', 'personal-avatar'],
    botBar = document.getElementById('bot-bar'),
    mCollections = document.getElementById('collections-collections'),
    mCollectionsContainer = document.getElementById('collections-container'),
    mCollectionsUpload = document.getElementById('collections-upload'),
    mDefaultReliveMemoryButtonText = 'Next',
    mDefaultTeam = 'memory',
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
    mRelivingMemory,
    mShadows
/* onDomContentLoaded */
document.addEventListener('DOMContentLoaded', async event=>{
    mShadows = await globals.datamanager.shadows()
    const { bots, activeBotId: id } = await globals.datamanager.bots()
    if(!bots?.length)
        throw new Error(`ERROR: No bots returned from server`)
    updatePageBots(bots)
    await mCreateCollections()
    await setActiveBot(id, true)
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
 * Creates a new collection item from server item object data, and activates the new summary.
 * @param {object} item - The collection item data
 * @returns {void}
 */
function createItem(item){
    const { id, type, } = item
    if(getItem(id))
        removeItem(id) // already exists, expunge
    item = mCreateCollectionItem(item)
    const collectionList = document.getElementById(`collection-list-${ type }`)
    if(collectionList){
        collectionList.insertBefore(item, collectionList.firstChild)
        setActiveItem(id)
    }
}
/**
 * Ends the memory reliving process.
 * @param {Guid} id - The collection item id
 * @param {boolean} server - Whether or not to update the server, default: `false`
 * @returns {void}
 */
async function endMemory(id, server=false){
    await mStopRelivingMemory(id, server)
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
 * Get collection item by id.
 * @param {Guid} id - The collection item id.
 * @returns {object} - The collection item object.
 */
function getItem(id){
    const item = document.getElementById(`collection-item_${ id }`)
    return item
}
/**
 * Refresh designated collection from server. **note**: external calls denied option to identify collectionList parameter, ergo must always be of same type.
 * @param {string} type - The collection type.
 * @returns {void}
 */
async function refreshCollection(type){
    return await mRefreshCollection(type)
}
/**
 * Removes a collection item from the DOM, does not update server.
 * @param {Guid} id - The collection item id
 * @returns {void}
 */
function removeItem(id){
    expunge(getItem(id))
}
/**
 * Set active bot on server and update page bots.
 * @requires mActiveBot
 * @requires mBots
 * @param {Event} event - The event object.
 * @param {boolean} dynamic - Whether or not to add dynamic greeting, only triggered from source code.
 * @returns {void}
 */
async function setActiveBot(event, displayGreeting=true){
    const botId = globals.isGuid(event)
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
    const { id, type, } = mActiveBot
    const { bot_id, responses=[], routine: botRoutine, success=false, version, versionUpdate, } = await globals.datamanager.botActivate(id)
    if(!success)
        throw new Error(`Server unsuccessful at setting active bot.`)
    /* update page bot data */
    const { activated=[], activatedFirst=Date.now(), } = mActiveBot
    mActiveBot.activatedFirst = activatedFirst
    activated.push(Date.now()) // newest date is last to .pop()
    mActiveBot.activated = activated
    mActiveBot.routines = mActiveBot.routines
        ?? []
    if(versionUpdate!==version){
        const botVersion = document.getElementById(`${ type }-title-version`)
        if(botVersion){
            botVersion.classList.add('update-available')
            botVersion.dataset.botId = bot_id
            botVersion.dataset.currentVersion = version
            botVersion.dataset.type = type
            botVersion.dataset.updateVersion = versionUpdate
            botVersion.addEventListener('click', mUpdateBotVersion, { once: true })
        }
    }
    /* update page */
    mSpotlightBotStatus()
    if(botRoutine?.length && !mActiveBot.routines.includes(botRoutine)){
        routine(botRoutine)
        mActiveBot.routines.push(botRoutine)
    }
    else if(displayGreeting && responses.length)
        addMessages(responses, type)
    else if(displayGreeting)
        addMessage(mActiveBot.purpose, type)
    decorateActiveBot(mActiveBot)
}
/**
 * Exposed method to allow externalities to toggle a specific item popup.
 * @param {string} id - Id for HTML div element to toggle.
 */
function togglePopup(id, bForceState=null){
    if(globals.isGuid(id))
        id = `popup-container_${ id }`
    const popup = document.getElementById(id)
    if(!popup)
        throw new Error(`No popup found for id: ${ id }`)
    toggleVisibility(popup, bForceState)
}
/**
 * Pulls and creates/refreshes member collections from the server.
 * @returns {void}
 */
async function updateCollections(){
    await mUpdateCollections()
}
/**
 * Update collection item.
 * @todo - determine whether more nuance is needed, or recreating is sufficient
 * @param {object} item - The collection item fields to update, requires `{ id, }`
 * @returns {void}
 */
function updateItem(item){
    if(!item?.id)
        return
    createItem(item)
}
function updateItemSummary(id, summary){
    const popupContent = document.getElementById(`popup-content_${ id }`)
    if(popupContent){
        popupContent.dataset.lastUpdatedContent = summary
        popupContent.value = summary
    } else {
        const item = document.getElementById(`collection-item_${ id }`)
        const collectionItem = item?.collectionItem
        if(collectionItem)
            collectionItem.summary = summary
    }
}
/**
 * Sets an item's changed title in all locations.
 * @param {Guid} itemId - The collection item id
 * @param {String} title - The title to set for the item
 */
function updateItemTitle(itemId, title){
    const titleSpan = document.getElementById(`collection-item-title_${ itemId }`)
    const titleInput = document.getElementById(`collection-item-title-input__${ itemId }`)
    const popupTitle = document.getElementById(`popup-header-title_${ itemId }`)
    if(titleSpan)
        titleSpan.textContent = title
    if(titleInput)
        titleInput.value = title
    if(popupTitle)
        popupTitle.textContent = title
    updateActiveItemTitle(itemId, title)
}
/**
 * Allows for member to update title to item or other.
 * @param {Event} event - The event object
 * @returns {void}
 */
function updateTitle(event){
    mUpdateCollectionItemTitle(event)
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
    await mUpdateTeams() // sets `mActiveBot`
    mUpdateBotContainers()
    if(includeGreeting)
        addMessage(mActiveBot.greeting, mActiveBot.type)
}
/* private functions */
/**
 * Find bot in mBots by id.
 * @requires mBots
 * @param {string} type - The bot type or id.
 * @returns {object} - The bot object.
 */
function mBot(type){
    const heritageType = type.replace('personal-', '')
    return mBots.find(bot=>bot.type===type)
        ?? mBots.find(bot=>bot.type===heritageType)
        ?? mBots.find(bot=>bot.type===`personal-${ type }`)
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
/**
 * Create a functional collection item HTML div for the specified collection type.
 * @example - collectionItem: { assistantType, filename, form, id, keywords, name, summary, title, type, }
 * @param {object} collectionItem - The collection item object, requires type.
 * @returns {HTMLDivElement} - The collection item.
 */
function mCreateCollectionItem(collectionItem){
    /* collection item container */
    const { assistantType, filename, form, id, name, title, type, } = collectionItem
    const iconType = assistantType
        ?? form
        ?? type
    const item = document.createElement('div')
    item.id = `collection-item_${ id }`
    item.name = `collection-item-${ type }`
    item.classList.add('collection-item', `${ type }-collection-item`)
    item.collectionItem = collectionItem
    /* icon */
    const itemIcon = document.createElement('img')
    itemIcon.id = `collection-item-icon_${ id }`
    itemIcon.classList.add('collection-item-icon', `${ type }-collection-item-icon`)
    itemIcon.src = mBotIcon(iconType)
    item.appendChild(itemIcon)
    /* name */
    const itemTitle = document.createElement('span')
    itemTitle.id = `collection-item-title_${ id }`
    itemTitle.name = `collection-item-title-${ type }`
    itemTitle.classList.add('collection-item-title', `${ type }-collection-item-title`)
    itemTitle.textContent = title
        ?? name
        ?? filename
        ?? `unknown ${ type } item`
    item.appendChild(itemTitle)
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
            /* file-summary popup */
            break
        default:
            item.addEventListener('click', e=>mTogglePopup(e, item.collectionItem))
            itemTitle.addEventListener('dblclick', mUpdateCollectionItemTitle, { once: true })
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
    const { itemId, lastResponse, shadowId, } = this.dataset
    const shadow = mShadows.find(shadow=>shadow.id===shadowId)
    if(!shadow)
        return
    const { categories, id, text, type, } = shadow // type enum: [agent, member]
    switch(type){
        case 'agent': /* agent shadows go directly to server for answer */
            addMessage(text, 'member')
            const response = await submit(text) /* proxy submission, use endpoint: /shadow */
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
            addMessages(messages, mActiveBot.type) // print to screen
            break
        case 'member': /* member shadows populate main chat input */
            const seedText = text.replace(/(\.\.\.|…)\s*$/, '').trim() + ' '
            seedInput(itemId, shadowId, seedText, text)
            break
        default:
            throw new Error(`Unimplemented shadow type: ${ type }`)
    }
    /* close popup */
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
    if(!dataset)
        throw new Error(`No dataset found for summary request.`)
    const { fileId, fileName, type, } = dataset
    if(type!=='file')
        throw new Error(`Unimplemented type for summary request.`)
    /* visibility triggers */
    this.classList.remove('summarize-error', 'fa-file-circle-exclamation', 'fa-file-circle-question', 'fa-file-circle-xmark')
    this.classList.add('fa-compass', 'spin')
    /* fetch summary */
    const { instruction, responses, success, } = await globals.datamanager.summary(fileId, fileName)
    /* visibility triggers */
    this.classList.remove('fa-compass', 'spin')
    if(success)
        this.classList.add('fa-file-circle-xmark')
    else
        this.classList.add('fa-file-circle-exclamation', 'summarize-error')
    /* print response */
    if(instruction?.length)
        console.log('mSummarize::instruction', instruction)
    addMessages(responses, mActiveBot.type)
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
    const { id, name, type, } = bot
    /* bot-thumb container */
    const botThumbContainer = document.createElement('div')
    botThumbContainer.id = `bot-bar-container_${ id }`
    botThumbContainer.name = `bot-bar-container-${ type }`
    botThumbContainer.title = name
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
async function mCreateCollections(){
    /* scrapbook (collections) */
    if(!mCollections || !mCollections.children.length)
        return
    for(let collection of mCollections.children){
        const { id, } = collection
        const type = id.split('-').pop()
        if(!mAvailableCollections.includes(type))
            continue
        const associatedBot = ( type==='entry' && mBots.some(bot=>bot.type==='journaler' || bot.type==='diary') )
            || ( type==='memory' && mBots.some(bot=>bot.type==='biographer' || bot.type==='personal-biographer') )
        if(!associatedBot && !['file', 'files'].includes(type)){
            expunge(collection)
            continue
        }
        const collectionBar = document.getElementById(`collection-bar-${ type }`)
        if(collectionBar){
            const { dataset, } = collectionBar
            dataset.id = id
            dataset.type = type
            const itemList = document.getElementById(`collection-list-${ type }`)
            dataset.init = itemList.querySelectorAll(`.${ type }-collection-item`).length > 0
                    ? 'true' // externally refreshed
                    : dataset.init // tested empty
                        ?? 'false'
            /* update collection list */
            const refresh = document.getElementById(`collection-refresh-${ type }`)
            if(dataset.init!=='true' && refresh)
                hide(refresh)
            collectionBar.addEventListener('click', mToggleCollectionItems)
        }
    }
    mCollectionsContainer.addEventListener('click', mToggleBotContainers)
    if(mCollectionsUpload)
        mCollectionsUpload.addEventListener('click', mUploadFiles)
}
/**
 * Create a popup for viewing collection item.
 * @param {object} collectionItem - The collection item object.
 * @returns {HTMLDivElement} - The collection popup.
 */
function mCreateCollectionPopup(collectionItem){
    const { complete=false, form, id, name, shares=[], summary, title, type, version=1, } = collectionItem
    const collectionPopup = document.createElement('div')
    collectionPopup.classList.add('collection-popup', 'popup-container')
    collectionPopup.dataset.complete = complete
    collectionPopup.dataset.id = id
    collectionPopup.dataset.name = name
    collectionPopup.dataset.title = title
    collectionPopup.dataset.type = type
    collectionPopup.dataset.version = version
    collectionPopup.id = `popup-container_${ id }`
    collectionPopup.name = `collection-popup_${ type }`
    collectionPopup.addEventListener('click', (e)=>e.stopPropagation()) /* Prevent event bubbling to collection-bar */
    /* popup header */
    const popupHeader = document.createElement('div')
    popupHeader.classList.add('popup-header', 'collection-popup-header')
    popupHeader.id = `popup-header_${ id }`
    popupHeader.name = `popup-header-${ type }`
    const popupHeaderTitle = document.createElement('span')
    popupHeaderTitle.classList.add('collection-popup-header-title')
    popupHeaderTitle.id = `popup-header-title_${ id }`
    popupHeaderTitle.textContent = title
        ?? `${ type } Item`
    popupHeaderTitle.name = `popup-header-title-${ type }`
    popupHeaderTitle.addEventListener('dblclick', mUpdateCollectionItemTitle, { once: true })
    popupHeader.appendChild(popupHeaderTitle)
    /* create popup close button */
    const popupClose = document.createElement('button')
    popupClose.classList.add('fa-solid', 'fa-close', 'popup-close', 'collection-popup-close')
    popupClose.id = `popup-close_${ id }`
    popupClose.setAttribute('aria-label', 'Close')
    popupClose.addEventListener('click', _=>globals.expunge(collectionPopup), { once: true })
    document.addEventListener('keydown', event=>{
        if(event.key==='Escape')
            popupClose.click()
    }, { once: true })
    popupHeader.appendChild(popupClose)
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
    /* create popup body/container */
    const popupBody = document.createElement('div')
    popupBody.classList.add('popup-body', 'collection-popup-body')
    popupBody.id = `popup-body_${ id }`
    popupBody.name = `popup-body-${ type }`
    /* create popup content */
    const content = summary
        ?? JSON.stringify(collectionItem)
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
    popupSave.addEventListener('click', async event=>{
        popupSave.classList.remove('fa-save')
        popupSave.classList.add('fa-spinner', 'spin')
        const success = await mUpdateCollectionItem(event)
        popupSave.classList.remove('fa-spinner', 'spin')
        popupSave.classList.add(success ? 'fa-check' : 'fa-times')
        setTimeout(_=>{
            popupSave.classList.remove('fa-check', 'fa-times')
            popupSave.classList.add('fa-save')
        }, 2000)
    })
    /* toggle-edit listeners */
    popupEdit.addEventListener('click', (event)=>{
        _toggleEditable()
    })
    popupContent.addEventListener('dblclick', (event)=>{
        _toggleEditable()
    })
    popupContent.addEventListener('blur', (event) => {
        _toggleEditable(false)
    })
    popupContent.addEventListener('keydown', (event) => {
        if(event.key==='Escape')
            _toggleEditable(false)
    })
    /* inline function to toggle editable state */
    function _toggleEditable(isEditable=true){
        popupContent.dataset.lastCursorPosition = popupContent.selectionStart
        popupContent.readOnly = !isEditable
        popupEdit.classList.toggle('popup-sidebar-icon-active', isEditable)
        popupContent.focus()
    }
    sidebar.appendChild(popupEdit)
    sidebar.appendChild(popupSave)
    /* create emoticon bar */
    const emoticons = ['😀', '😢', '😡', '😍', '😱'] // Add more emoticons as needed
    emoticons.forEach(emoticon => {
        const emoticonButton = document.createElement('span')
        emoticonButton.classList.add('popup-sidebar-emoticon')
        emoticonButton.textContent = emoticon
        emoticonButton.addEventListener('click', (event)=>{
            event.stopPropagation()
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
            const entryType = form
                ?? type
            /* improve entry container */
            const improveEntry = document.createElement('div')
            improveEntry.classList.add(`collection-popup-${ type }`)
            improveEntry.id = `popup-${ entryType }_${ id }`
            improveEntry.name = 'improve-entry-container'
            /* improve entry lane */
            const improveEntryLane = document.createElement('div')
            improveEntryLane.classList.add('improve-entry-lane')
            const improveEntryWidgetLeft = document.createElement('div')
            improveEntryWidgetLeft.classList.add('improve-panel')
            const improveEntryWidgetRight = document.createElement('div')
            improveEntryWidgetRight.classList.add('improve-panel')
            improveEntryLane.appendChild(improveEntryWidgetLeft)
            improveEntryLane.appendChild(improveEntryWidgetRight)
            /* entry complete */
            const entryComplete = document.createElement('div')
            entryComplete.classList.add('entry-complete-container')
            entryComplete.id = `entry-complete_${ id }`
            const entryCompleteLabel = document.createElement('label')
            entryCompleteLabel.classList.add('entry-complete-label')
            entryCompleteLabel.htmlFor = `entry-complete-checkbox_${ id }`
            entryCompleteLabel.textContent = `${ entryType } Entry Incomplete`
            const entryCompleteCheckbox = document.createElement('input')
            entryCompleteCheckbox.type = 'checkbox'
            entryCompleteCheckbox.id = `entry-complete-checkbox_${ id }`
            entryCompleteCheckbox.name = 'entry-complete-checkbox'
            entryCompleteCheckbox.checked = !complete
            entryComplete.appendChild(entryCompleteLabel)
            entryComplete.appendChild(entryCompleteCheckbox)
            improveEntryWidgetLeft.appendChild(entryComplete)
            // @stub - add event listener to update entry completed status
            /* obscure entry */
            const obscureEntry = document.createElement('button')
            obscureEntry.classList.add('obscure-button', 'button')
            obscureEntry.dataset.id = id /* required for mObscureEntry */
            obscureEntry.id = `button-obscure-${ entryType }_${ id }`
            obscureEntry.name = 'obscure-button'
            obscureEntry.textContent = 'Obscure Entry'
            obscureEntry.addEventListener('click', mObscureEntry, { once: true })
            improveEntryWidgetLeft.appendChild(obscureEntry)
            /* evaluate entry */
            const evaluateEntry = document.createElement('button')
            evaluateEntry.classList.add('evaluate-button', 'button')
            evaluateEntry.dataset.id = id /* required for mObscureEntry */
            evaluateEntry.id = `button-evaluate-${ entryType }_${ id }`
            evaluateEntry.name = 'evaluate-button'
            evaluateEntry.textContent = 'Evaluate'
            evaluateEntry.addEventListener('click', mEvaluate, { once: true })
            improveEntryWidgetLeft.appendChild(evaluateEntry)
            /* experience entry panel */
            const experienceEntry = document.createElement('div')
            experienceEntry.classList.add('experience-entry-container')
            experienceEntry.id = `experience_${ id }`
            experienceEntry.name = 'experience-entry-container'
            /* entry version */
            const entryVersion = document.createElement('div')
            entryVersion.classList.add('entry-version')
            entryVersion.textContent = `Version: ${ version }`
            experienceEntry.appendChild(entryVersion)
            /* experience entry explanation */
            const experienceExplanation = document.createElement('div')
            experienceExplanation.classList.add('experience-entry-explanation')
            experienceExplanation.id = `experience-explanation_${ id }`
            experienceExplanation.name = 'experience-entry-explanation'
            experienceExplanation.textContent = 'Experience an entry by clicking the button below.'
            /* experience entry button */
            const experienceButton = document.createElement('button')
            experienceButton.classList.add('experience-entry-button', 'button')
            experienceButton.dataset.id = id /* required for triggering PATCH */
            experienceButton.id = `experience-entry-button_${ id }`
            experienceButton.name = 'experience-entry-button'
            experienceButton.textContent = 'Experience Entry'
            experienceButton.addEventListener('click', _=>{
                alert('Experience Entry: Coming soon')
            }, { once: true })
            experienceEntry.appendChild(experienceExplanation)
            experienceEntry.appendChild(experienceButton)
            improveEntryWidgetRight.appendChild(experienceEntry)
            /* memory media-carousel */
            const entryCarousel = document.createElement('div')
            entryCarousel.classList.add('media-carousel')
            entryCarousel.id = `media-carousel_${ id }`
            entryCarousel.name = 'media-carousel'
            entryCarousel.textContent = 'Coming soon: media file uploads to Enhance and Improve entries'
            /* append elements */
            improveEntry.appendChild(improveEntryLane)
            improveEntry.appendChild(entryCarousel)
            typePopup = improveEntry
            break
        case 'experience':
        case 'file':
            break
        case 'memory':
        case 'story':
            /* improve memory container */
            const improveMemory = document.createElement('div')
            improveMemory.classList.add(`collection-popup-${ type }`)
            improveMemory.id = `popup-${ type }_${ id }`
            improveMemory.name = 'improve-memory-container'
            const improveMemoryLane = document.createElement('div')
            improveMemoryLane.classList.add('improve-memory-lane')
            const improveMemoryLaneLeft = document.createElement('div')
            improveMemoryLaneLeft.classList.add('improve-panel')
            const improveMemoryLaneRight = document.createElement('div')
            improveMemoryLaneRight.classList.add('improve-panel')
            improveMemoryLane.appendChild(improveMemoryLaneLeft)
            improveMemoryLane.appendChild(improveMemoryLaneRight)
            improveMemory.appendChild(improveMemoryLane)
            /* memory version */
            const memoryVersion = document.createElement('div')
            memoryVersion.classList.add('memory-version')
            memoryVersion.textContent = `Version: ${ version }`
            improveMemoryLaneLeft.appendChild(memoryVersion)
            /* memory complete */
            const memoryComplete = document.createElement('div')
            memoryComplete.classList.add('memory-complete-container')
            memoryComplete.id = `memory-complete_${ id }`
            const memoryCompleteLabel = document.createElement('label')
            memoryCompleteLabel.classList.add('memory-complete-label')
            memoryCompleteLabel.htmlFor = `memory-complete-checkbox_${ id }`
            memoryCompleteLabel.textContent = `Memory Incomplete`
            const memoryCompleteCheckbox = document.createElement('input')
            memoryCompleteCheckbox.type = 'checkbox'
            memoryCompleteCheckbox.id = `memory-complete-checkbox_${ id }`
            memoryCompleteCheckbox.name = 'memory-complete-checkbox'
            memoryCompleteCheckbox.checked = !complete
            memoryComplete.appendChild(memoryCompleteLabel)
            memoryComplete.appendChild(memoryCompleteCheckbox)
            improveMemoryLaneLeft.appendChild(memoryComplete)
            /* memory prompts */
            if(mShadows?.length)
                improveMemoryLaneLeft.appendChild(mCreateMemoryShadows(id))
            /* evaluate memory */
            const evaluateMemory = document.createElement('button')
            evaluateMemory.classList.add('evaluate-button', 'button')
            evaluateMemory.dataset.id = id
            evaluateMemory.id = `button-evaluate-memory_${ id }`
            evaluateMemory.name = 'evaluate-button'
            evaluateMemory.textContent = 'Evaluate'
            evaluateMemory.addEventListener('click', mEvaluate, { once: true })
            improveMemoryLaneLeft.appendChild(evaluateMemory)
            /* relive memory button */
            const reliveButton = document.createElement('button')
            reliveButton.classList.add('relive-memory-button', 'button')
            reliveButton.dataset.id = id /* required for triggering PATCH */
            reliveButton.id = `relive-memory-button_${ id }`
            reliveButton.name = 'relive-memory-button'
            reliveButton.textContent = 'Relive Memory'
            reliveButton.addEventListener('click', mReliveMemory, { once: true })
            improveMemoryLaneRight.appendChild(reliveButton)
            /* relive memory explanation */
            const reliveExplanation = document.createElement('div')
            reliveExplanation.classList.add('relive-memory-explanation')
            reliveExplanation.id = `relive-memory-explanation_${ id }`
            reliveExplanation.name = 'relive-memory-explanation'
            reliveExplanation.textContent = 'Reliving will bring up your memory in chat presented as a story. You can add to it, or simply enjoy reliving it!'
            improveMemoryLaneRight.appendChild(reliveExplanation)
            /* share memory */
            improveMemoryLaneRight.appendChild(mCreateSharePanel(id, shares, summary, title))
            /* memory media-carousel */
            const memoryCarousel = document.createElement('div')
            memoryCarousel.classList.add('media-carousel')
            memoryCarousel.id = `media-carousel_${ id }`
            memoryCarousel.name = 'media-carousel'
            memoryCarousel.textContent = 'Coming soon: media file uploads to Enhance and Improve memories'
            improveMemory.appendChild(memoryCarousel)
            typePopup = improveMemory
            break
        default:
            break
    }
    /* append elements */
    collectionPopup.appendChild(popupHeader)
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
function mCreateShareLink(itemId, shares, summary, title, shareId, shareListIndex){
    /* share item container */
    const shareItemContainer = document.createElement('div')
    shareItemContainer.classList.add('share-item-container')
    shareItemContainer.id = `share-item-container_${ shareId }`
    shareItemContainer.name = shareItemContainer.id
    /* share item descriptor */
    const shareItem = document.createElement('div')
    shareItem.classList.add('share-item')
    shareItem.id = `share-item_${ shareId }_${ shareListIndex }`
    shareItem.name = `share-item_${ shareId }`
    shareItem.textContent = `${ title.substring(0, 24) }`
    shareItem.addEventListener('click', async _=>mShareModal(itemId, shares, summary, title, shareId))
    shareItemContainer.appendChild(shareItem)
    /* share item link */
    const shareLink = document.createElement('div')
    shareLink.classList.add('fas', 'fa-link', 'share-link')
    shareLink.id = `share-link_${ shareId }_${ shareListIndex }`
    shareLink.name = `share-link_${ shareId }`
    shareLink.addEventListener('click', async _=>mShareLink(shareId))
    shareItemContainer.appendChild(shareLink)
    /* share item edit */
    const shareEdit = document.createElement('div')
    shareEdit.classList.add('fas', 'fa-edit', 'share-edit')
    shareEdit.id = `share-edit_${ shareId }_${ shareListIndex }`
    shareEdit.name = `share-edit_${ shareId }`
    shareEdit.addEventListener('click', async _=>mShareModal(itemId, shares, summary, title, shareId))
    shareItemContainer.appendChild(shareEdit)
    /* share item delete */
    const shareDelete = document.createElement('div')
    shareDelete.classList.add('fas', 'fa-trash', 'share-delete')
    shareDelete.id = `share-delete_${ shareId }_${ shareListIndex }`
    shareDelete.name = `share-delete_${ shareId }`
    shareDelete.addEventListener('click', async _=>mShareDelete(shareId, shareItemContainer), { once: true })
    shareItemContainer.appendChild(shareDelete)
    return shareItemContainer
}
/**
 * Create a share panel for a collection item where member can add, update or remove shares.
 * @param {ItemId} itemId - The collection item id
 * @param {Array} shares - The collection item current share list
 * @param {String} title - The collection item title
 */
function mCreateSharePanel(itemId, shares, summary, title){
    /* share panel */
    const sharePanel = document.createElement('div')
    sharePanel.classList.add('share-panel')
    sharePanel.id = `share-panel_${ itemId }`
    sharePanel.name = sharePanel.id
    /* share header */
    const shareHeaderContainer = document.createElement('div') /* container */
    shareHeaderContainer.classList.add('share-header-container')
    shareHeaderContainer.id = `share-header-container_${ itemId }`
    shareHeaderContainer.name = shareHeaderContainer.id
    const shareHeader = document.createElement('div') /* header */
    shareHeader.classList.add('share-header')
    shareHeader.id = `share-header_${ itemId }`
    shareHeader.name = shareHeader.id
    shareHeader.textContent = `Share Station`
    shareHeaderContainer.appendChild(shareHeader)
    const addShare = document.createElement('button') /* add button */
    addShare.classList.add('share-add', 'button')
    addShare.id = `share-add_${ itemId }`
    addShare.name = addShare.id
    addShare.textContent = `+ New Share`
    addShare.addEventListener('click', async _=>mShareModal(itemId, shares, summary, title))
    shareHeaderContainer.appendChild(addShare)
    sharePanel.appendChild(shareHeaderContainer)
    /* share list */
    const shareList = document.createElement('div')
    shareList.classList.add('share-list')
    shareList.id = `share-list_${ itemId }`
    shareList.name = shareList.id
    if(shares?.length){
        let shareListIndex = 0
        shares.forEach(shareId=>{ // **note** share is a string indicating share.id
            shareListIndex++
            const shareItem = mCreateShareLink(itemId, shares, summary, title, shareId, shareListIndex)
            shareList.appendChild(shareItem)
        })
    }
    sharePanel.appendChild(shareList)
    return sharePanel
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
    const data = {
        id: mActiveTeam.id,
        type,
    }
    const bot = await globals.datamanager.botCreate(data)
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
            memberOption.textContent = 'Select a team member to add...'
            memberOption.selected = true
            memberOption.value = ''
            memberSelect.appendChild(memberOption)
            allowedTypes.forEach(type=>{
                if(mBots.find(bot=>bot.type===type)) // no duplicates currently
                    return
                const memberOption = document.createElement('option')
                memberOption.textContent = type
                memberOption.value = type
                memberSelect.appendChild(memberOption)
            })
            if(allowCustom){
                const divider = document.createElement('optgroup')
                divider.label = "-----------------"
                memberSelect.appendChild(divider)
                const memberOptionCustom = document.createElement('option')
                memberOptionCustom.value = 'custom'
                memberOptionCustom.textContent = 'Create a custom team member...'
                memberSelect.appendChild(memberOptionCustom)
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
                const { name, } = team
                const teamOption = document.createElement('option')
                teamOption.value = name
                teamOption.textContent = name
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
    const collectionItemDelete = event.target
    const id = collectionItemDelete.id.split('_').pop()
    const item = document.getElementById(`collection-item_${ id }`)
    const userConfirmed = confirm("Are you sure you want to delete this item?") /* confirmation dialog */
    if(getActiveItemId()===id)
        unsetActiveItem()
    if(userConfirmed){
        const { instruction, responses, success, } = await globals.datamanager.itemDelete(id)
        if(!!instruction)
            enactInstruction(instruction, 'chat', { removeItem, })
        if(success){
            expunge(item)
            if(responses?.length)
                addMessages(responses, 'avatar')
        }
    } else
        collectionItemDelete.addEventListener('click', mDeleteCollectionItem, { once: true })
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
    if(event.key==='Enter')
        passphraseSubmitButton.click()
    else if(event.key==='Escape')
        passphraseCancelButton.click()
    if(( passphraseInput?.value?.length ?? 0 )>2)
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
async function mEvaluate(event){
    event.preventDefault()
    event.stopPropagation()
    /* set active item */
    const { id: itemId, } = this.dataset
    if(itemId)
        setActiveItem(itemId)
    toggleMemberInput(false)
    const awaitBar = globals.await(`${ mActiveBot.name } is evaluating your summary...`)
    globals.addChatElement(awaitBar)
    const popupClose = document.getElementById(`popup-close_${ itemId }`)
    if(popupClose)
        popupClose.click()
    const { responses, success, } = await globals.datamanager.evaluate(itemId)
    if(responses?.length)
        addMessages(responses, mActiveBot.type)
    globals.expunge(awaitBar)
    toggleMemberInput(true)
}
async function mObscureEntry(event){
    event.preventDefault()
    event.stopPropagation()
    /* set active item */
    const { id: itemId, } = this.dataset
    if(itemId)
        setActiveItem(itemId)
    const awaitBar = globals.await(`${ mActiveBot.name } is obscuring your content...`)
    globals.addChatElement(awaitBar)
    toggleMemberInput(false)
    const popupClose = document.getElementById(`popup-close_${ itemId }`)
    if(popupClose)
        popupClose.click()
    const { instruction, responses, success, } = await globals.datamanager.obscure(itemId)
    if(responses?.length)
        addMessages(responses, mActiveBot.type)
    if(instruction)
        enactInstruction(instruction, 'chat', { updateItemSummary, })
    globals.expunge(awaitBar)
    toggleMemberInput(true)
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
 * Refresh designated collection from server.
 * @this - collection-refresh
 * @param {string} type - The collection type.
 * @param {HTMLDivElement} collectionList - The collection list, defaults to `collection-list-${ type }`.
 * @returns {void}
 */
async function mRefreshCollection(type, collectionList){
    if(!mAvailableCollections.includes(type))
        throw new Error(`Library collection not implemented.`)
    collectionList = collectionList
        ?? document.getElementById(`collection-list-${ type }`)
    if(!collectionList)
        throw new Error(`No collection list found for refresh request.`)
    const collection = await globals.datamanager.collections(type)
    mUpdateCollection(type, collectionList, collection)
}
async function mReliveMemory(event){
    event.preventDefault()
    event.stopPropagation()
    const { id, inputContent, } = this.dataset
    const previousInput = document.getElementById(`relive-memory-input-container_${id}`)
    if(previousInput)
        expunge(previousInput)
    const popupClose = document.getElementById(`popup-close_${ id }`)
    if(popupClose)
        popupClose.click()
    if(!mRelivingMemory){
        mRelivingMemory = id
        clearSystemChat()
    }
    globals.removeDisappearingElements()
    const awaitBar = globals.await(`Reliving memory with ${ mActiveBot.name }...`)
    globals.addChatElement(awaitBar)
    toggleMemberInput(false)
    unsetActiveItem()
    const { instruction, item, responses, success, } = await globals.datamanager.memoryRelive(id, inputContent)
    globals.expunge(awaitBar)
    if(success){
        const interrupts = ['endMemory', 'endReliving']
        const haltMemory = interrupts.includes(instruction?.command)
        addMessages(responses, haltMemory ? 'system' : 'relive', undefined, 0)
        if(!!instruction){
            const functions = {
                addMessages,
                endMemory,
            }
            enactInstruction(instruction, 'chat', functions)
            if(haltMemory)
                return
        }
        /* direct relive structure */
        const input = document.createElement('div')
        input.classList.add('relive-progress', 'input-disappear')
        input.id = `relive-memory-input-container_${ id }`
        input.name = `input_${ id }`
        const inputClose = document.createElement('button')
        inputClose.classList.add('relive-cancel')
        inputClose.textContent = 'Cancel'
        const inputContent = document.createElement('textarea')
        inputContent.classList.add('relive-input')
        inputContent.name = `memory-input_${ id }`
        inputContent.placeholder = `What did I get wrong? What important details were missed? Click 'Next' to just continue...`
        const inputSubmit = document.createElement('button')
        inputSubmit.classList.add('relive-next')
        inputSubmit.dataset.id = id
        inputSubmit.textContent = mDefaultReliveMemoryButtonText
        input.appendChild(inputClose)
        input.appendChild(inputContent)
        input.appendChild(inputSubmit)
        inputClose.addEventListener('click', async event=>{
            event.preventDefault()
            event.stopPropagation()
            await mStopRelivingMemory(id, true)
        }, { once: true })
        inputContent.addEventListener('input', event=>{
            const { value, } = event.target
            inputSubmit.dataset.inputContent = value
            inputSubmit.textContent = value.length > 2
                ? 'update'
                : mDefaultReliveMemoryButtonText
        })
        inputSubmit.addEventListener('click', mReliveMemory, { once: true })
        addInput(input)
    } else {
        toggleMemberInput(true)
        throw new Error(`Failed to fetch memory for relive request.`)
    }
}
/**
 * Request to retire an identified bot.
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mRetireBot(event){
    event.preventDefault()
    event.stopPropagation()
    try {
        const { dataset, id, } = event.target
        const { botId, type, } = dataset
        /* reset active bot */
        if(mActiveBot.id===botId)
            setActiveBot()
        const response = await globals.datamanager.botRetire(botId)
        addMessages(response.responses, 'avatar')
    } catch(err) {
        console.log('Error posting bot data:', err)
        addMessage(`Error posting bot data: ${err.message}`, 'error')
    }
}
/**
 * Retires chat thread on server and readies for a clean one.
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mRetireChat(event){
    event.preventDefault()
    event.stopPropagation()
    try {
        const { dataset, id, } = event.target
        const { botId, type, } = dataset
        const reponse = await globals.datamanager.chatRetire(botId)
        addMessages(response.responses, mActiveBot.type)
    } catch(err) {
        console.log('Error posting bot data:', err)
        addMessage(`Error posting bot data: ${err.message}`, 'error')
    }
}
/**
 * Sets bot attributes on bot container.
 * @private
 * @requires mActiveBot
 * @requires globals
 * @param {object} bot - The bot object.
 * @param {HTMLDivElement} botContainer - The bot container.
 * @returns {void}
 */
function mSetAttributes(bot=mActiveBot, botContainer){
    const {
        activated=[],
        activeFirst,
        bot_name='Anonymous',
        dob,
        flags,
        id: bot_id,
        interests,
        name,
        narrative,
        privacy,
        type,
        updates,
        version
    } = bot
    /* attributes */
    const botName = name
        ?? bot_name
    const attributes = [
        { name: 'activated', value: activated },
        { name: 'active', value: mBotActive(bot_id) },
        { name: 'activeFirst', value: activeFirst },
        { name: 'bot_id', value: bot_id },
        { name: 'bot_name', value: botName },
        { name: 'id', value: bot_id },
        { name: 'initialized', value: Date.now() },
        { name: 'type', value: type },
        { name: 'version', value: version },
    ]
    if(dob)
        attributes.push({ name: 'dob', value: dob })
    if(flags)
        attributes.push({ name: 'flags', value: flags })
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
 * Sets bot container status bar based on bot, thread, and assistant population.
 * @private
 * @requires mActiveBot - active bot object, but can be undefined without error.
 * @param {object} bot - The bot object.
 * @returns {void}
 */
function mSetStatusBar(bot, botContainer){
    const { dataset, } = botContainer
    const { id, type, version, } = dataset
    const { id: botId, name, type: botType, version: botVersion, } = bot
    const botStatusBar = document.getElementById(`${ type }-status`)
    if(!type || !botType==type || !botStatusBar)
        return
    const response = {
        name,
        status: 'unknown',
        type: type.split('-').pop(),
    }
    /* status icon */
    const botIcon = document.getElementById(`${ type }-icon`)
    const botThumb = document.getElementById(`${ type }-thumb`)
    switch(true){
        case ( mActiveBot?.id==id ): // activated
            botIcon.classList.remove('online', 'offline', 'error')
            botIcon.classList.add('active')
            response.status = 'active'
            break
        case ( name?.length>0 ): // online
            botIcon.classList.remove('active', 'offline', 'error')
            botIcon.classList.add('online')
            response.status = 'online'
            break
        default: // error
            botIcon.classList.remove('active', 'online', 'offline')
            botIcon.classList.add('error')
            response.status = 'error'
            break
    }
    botContainer.dataset.status = response.status
    /* title-type */
    const botTitleType = document.getElementById(`${ type }-title-type`)
    if(botTitleType){
        response.type = response.type.charAt(0).toUpperCase()
            + response.type.slice(1)
        botTitleType.textContent = response.type
    }
    /* title-name */
    const botTitleName = document.getElementById(`${ type }-title-name`)
    if(botTitleName)
        botTitleName.textContent = response.name
    /* version */
    const botVersionElement = document.getElementById(`${ type }-title-version`)
    if(botVersionElement)
        botVersionElement.textContent = mVersion(version)
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
                mSetStatusBar(bot, botContainer)
            }
        })
}
/**
 * Deletes the share from the server, from the item and from the DOM.
 * @param {Guid} shareId - The share id
 * @param {HTMLElement} shareElement - The share HTML element to erase
 */
async function mShareDelete(shareId, shareElement){
    await globals.datamanager.shareDelete(shareId)
    shareElement.remove()
}
async function mShareLink(shareId, autoCopy=true){
    const rootUrl = window.location.origin
    const link = `${ rootUrl }/?sid=${ shareId }`
    if(autoCopy)
        navigator.clipboard.writeText(link)
            .then(()=>alert("Link copied to clipboard"))
            .catch(err => console.log("Error copying link:", err))
    return link
}
/**
 * Creates a screen-blocking set of share options for this item. Member can add or update this form.
 * @param {Guid} itemId - The item id
 * @param {String} summary - The item summary
 * @param {String} title - The item title
 * @param {Guid} shareId - The share id (optional for create, required for update)
 * @returns {void}
 */
async function mShareModal(itemId, shares, summary, title, shareId){
    expunge(document.getElementById('modal-share'))
    let shareData = {}
    if(globals.isGuid(shareId))
        shareData = await globals.datamanager.getShare(shareId)
    /* create modal */
    const shareModal = document.createElement('div')
    shareModal.classList.add('modal-share')
    shareModal.id = `modal-share`
    shareModal.name = shareModal.id
    /* share header */
    const shareHeader = document.createElement('div')
    shareHeader.classList.add('modal-share-header')
    shareHeader.id = `modal-share-header`
    shareHeader.name = shareHeader.id
    // @todo - Esc not working, not firing on keyDown, propagation stopped elsewhere?
    shareHeader.addEventListener('keydown', event=>{
        console.log('key:', event.key)
        if(event.key==='Escape')
            mCloseSharePanel()
    }, { once: true })
    /* share title */
    const shareTitle = document.createElement('div')
    shareTitle.classList.add('modal-share-title')
    shareTitle.id = `modal-share-title`
    shareTitle.name = shareTitle.id
    shareTitle.textContent = `Sharing Memory: "${ title }"`
    shareHeader.appendChild(shareTitle)
    /* share close */
    const shareClose = document.createElement('div')
    shareClose.classList.add('fas', 'fa-times', 'modal-share-close')
    shareClose.id = `modal-share-close`
    shareClose.name = shareClose.id
    shareClose.addEventListener('click', mCloseSharePanel)
    shareHeader.appendChild(shareClose)
    /* share summary */
    const shareSummary = document.createElement('div')
    shareSummary.classList.add('modal-share-summary')
    shareSummary.disabled = true
    shareSummary.id = `modal-share-summary`
    shareSummary.name = shareSummary.id
    shareSummary.textContent = summary
    /* share options row 01 */
    const shareOptionsRow01 = document.createElement('div')
    shareOptionsRow01.classList.add('modal-share-options-row')
    shareOptionsRow01.id = `modal-share-options-row01`
    shareOptionsRow01.name = shareOptionsRow01.id
    /* share options */
    const shareOptions = document.createElement('div')
    shareOptions.classList.add('modal-share-options')
    shareOptions.id = `modal-share-options`
    shareOptions.name = shareOptions.id
    /* share title */
    const shareTitleContainer = document.createElement('div')
    shareTitleContainer.classList.add('modal-share-label')
    shareTitleContainer.id = `modal-share-title`
    shareTitleContainer.name = shareTitleContainer.id
    shareTitleContainer.textContent = 'Share Title'
    const shareTitleInput = document.createElement('input')
    shareTitleInput.classList.add('modal-share-title-input')
    shareTitleInput.id = `modal-share-title-input`
    shareTitleInput.name = shareTitleInput.id
    shareTitleInput.placeholder = 'Enter a title for this share...'
    shareTitleInput.type = 'text'
    shareTitleInput.value = shareData.title ?? title
    shareTitleContainer.appendChild(shareTitleInput)
    /* anonymous share */
    const anonymousContainer = document.createElement('div')
    anonymousContainer.classList.add('modal-share-anonymous')
    anonymousContainer.id = `modal-share-anonymous`
    anonymousContainer.name = anonymousContainer.id
    const shareAnonymous = document.createElement('input')
    shareAnonymous.checked = shareData.anonymous ?? false
    shareAnonymous.id = `modal-share-anonymous-checkbox`
    shareAnonymous.name = shareAnonymous.id
    shareAnonymous.type = 'checkbox'
    shareAnonymous.value = 'anonymous'
    anonymousContainer.appendChild(shareAnonymous)
    const shareAnonymousLabel = document.createElement('label')
    shareAnonymousLabel.classList.add('modal-share-checkbox-label')
    shareAnonymousLabel.id = `modal-share-anonymous-label`
    shareAnonymousLabel.name = shareAnonymousLabel.id
    shareAnonymousLabel.textContent = 'Share Anonymously'
    shareAnonymousLabel.htmlFor = shareAnonymous.id
    anonymousContainer.appendChild(shareAnonymousLabel)
    /* guessable share */
    const guessableContainer = document.createElement('div')
    guessableContainer.classList.add('modal-share-guessable')
    guessableContainer.id = `modal-share-guessable`
    guessableContainer.name = guessableContainer.id
    const shareGuessable = document.createElement('input')
    shareGuessable.checked = shareData.guessable ?? false
    shareGuessable.id = `modal-share-guessable-checkbox`
    shareGuessable.name = shareGuessable.id
    shareGuessable.type = 'checkbox'
    shareGuessable.value = 'guessable'
    guessableContainer.appendChild(shareGuessable)
    const shareGuessableLabel = document.createElement('label')
    shareGuessableLabel.classList.add('modal-share-checkbox-label')
    shareGuessableLabel.id = `modal-share-guessable-label`
    shareGuessableLabel.name = shareGuessableLabel.id
    shareGuessableLabel.textContent = 'Allow Recipient to Guess Your Identity'
    shareGuessableLabel.htmlFor = shareGuessable.id
    guessableContainer.appendChild(shareGuessableLabel)
    /* share options row 02 */
    const shareOptionsRow02 = document.createElement('div')
    shareOptionsRow02.classList.add('modal-share-options-row')
    shareOptionsRow02.id = `modal-share-options-row02`
    shareOptionsRow02.name = shareOptionsRow02.id
    /* share scope */
    const shareScope = document.createElement('div')
    shareScope.classList.add('modal-share-scope')
    shareScope.id = `modal-share-scope`
    shareScope.name = shareScope.id
    const shareScopeLabel = document.createElement('label')
    shareScopeLabel.classList.add('modal-share-dropdown-label')
    shareScopeLabel.id = `modal-share-scope-label`
    shareScopeLabel.name = shareScopeLabel.id
    shareScopeLabel.textContent = 'Share Scope'
    shareScope.appendChild(shareScopeLabel)
    const shareScopeDropdown = document.createElement('select')
    shareScopeDropdown.classList.add('modal-share-scope-dropdown')
    shareScopeDropdown.id = `modal-share-scope-dropdown`
    shareScopeDropdown.name = shareScopeDropdown.id
    const shareScopeOption = document.createElement('option')
    shareScopeOption.textContent = 'Select Share Scope...'
    shareScopeOption.value = ''
    shareScopeDropdown.appendChild(shareScopeOption)
    const shareScopeOptions = ['public', 'private', 'team']
    shareScopeOptions.forEach(option=>{
        const shareScopeOption = document.createElement('option')
        shareScopeOption.textContent = option.charAt(0).toUpperCase() + option.slice(1)
        shareScopeOption.value = option
        if(option===shareData.scope)
            shareScopeOption.selected = true
        shareScopeDropdown.appendChild(shareScopeOption)
    })
    shareScope.appendChild(shareScopeDropdown)
    /* share pov */
    const sharePov = document.createElement('div')
    sharePov.classList.add('modal-share-scope')
    sharePov.id = `modal-share-scope`
    sharePov.name = sharePov.id
    const sharePovLabel = document.createElement('label')
    sharePovLabel.classList.add('modal-share-dropdown-label')
    sharePovLabel.id = `modal-share-pov-label`
    sharePovLabel.name = sharePovLabel.id
    sharePovLabel.textContent = 'Share Point of View'
    sharePov.appendChild(sharePovLabel)
    const sharePovDropdown = document.createElement('select')
    sharePovDropdown.classList.add('modal-share-scope-dropdown')
    sharePovDropdown.id = `modal-share-scope-dropdown`
    sharePovDropdown.name = sharePovDropdown.id
    const sharePovOption = document.createElement('option')
    sharePovOption.textContent = 'Select Point of View...'
    sharePovOption.value = ''
    sharePovDropdown.appendChild(sharePovOption)
    const sharePovOptions = ['first', 'second', 'third', 'first plural (we)']
    sharePovOptions.forEach((option, index)=>{
        const sharePovOption = document.createElement('option')
        sharePovOption.textContent = option.charAt(0).toUpperCase() + option.slice(1)
        sharePovOption.value = index + 1
        if(sharePovOption.value===shareData.pov)
            sharePovOption.selected = true
        sharePovDropdown.appendChild(sharePovOption)
    })
    sharePov.appendChild(sharePovDropdown)
    /* share voice */
    const shareVoiceContainer = document.createElement('div')
    shareVoiceContainer.classList.add('modal-share-voice')
    shareVoiceContainer.id = `modal-share-voice`
    shareVoiceContainer.name = shareVoiceContainer.id
    const shareVoiceLabel = document.createElement('label')
    shareVoiceLabel.classList.add('modal-share-textarea-label')
    shareVoiceLabel.id = `modal-share-voice-label`
    shareVoiceLabel.name = shareVoiceLabel.id
    shareVoiceLabel.textContent = 'What mood or voice should the memory have?'
    shareVoiceContainer.appendChild(shareVoiceLabel)
    const shareVoiceInput = document.createElement('textarea')
    shareVoiceInput.classList.add('modal-share-textarea', 'modal-share-voice-input')
    shareVoiceInput.id = `modal-share-voice-input`
    shareVoiceInput.name = shareVoiceInput.id
    shareVoiceInput.placeholder = 'Ex. dark poetry a la Edgar Allan Poe...'
    shareVoiceInput.value = shareData.voice ?? null
    shareVoiceContainer.appendChild(shareVoiceInput)
    /* share options row 03 */
    const shareOptionsRow03 = document.createElement('div')
    shareOptionsRow03.classList.add('modal-share-options-row')
    shareOptionsRow03.id = `modal-share-options-row03`
    shareOptionsRow03.name = shareOptionsRow03.id
    /* Share Link */
    const shareLink = document.createElement('div')
    shareLink.classList.add('modal-share-link')
    shareLink.id = `modal-share-link`
    shareLink.name = shareLink.id
    const shareLinkLabel = document.createElement('div')
    shareLinkLabel.classList.add('modal-share-label')
    shareLinkLabel.id = `modal-share-link-label`
    shareLinkLabel.name = shareLinkLabel.id
    shareLinkLabel.textContent = 'Share Link'
    if(shareData.id)
        shareLinkLabel.addEventListener('click', async _=>mShareLink(shareData.id))
    shareLink.appendChild(shareLinkLabel)
    const shareLinkInput = document.createElement('input')
    shareLinkInput.classList.add('modal-share-link-link')
    shareLinkInput.disabled = true
    shareLinkInput.id = `modal-share-link-link`
    shareLinkInput.name = shareLinkInput.id
    shareLinkInput.placeholder = 'Save share for link...'
    shareLinkInput.type = 'text'
    if(shareData.id)
        shareLinkInput.value = await mShareLink(shareData.id, false)
    shareLink.appendChild(shareLinkInput)
    if(shareData.id){
        const shareLinkCopy = document.createElement('div')
        shareLinkCopy.classList.add('modal-share-copy', 'fas', 'fa-link')
        shareLinkCopy.id = `modal-share-link-button`
        shareLinkCopy.name = shareLinkCopy.id
        shareLinkCopy.addEventListener('click', async _=>mShareLink(shareData.id))
        shareLink.appendChild(shareLinkCopy)
    }
    /* share conclusion */
    const shareConclusionContainer = document.createElement('div')
    shareConclusionContainer.classList.add('modal-share-conclusion')
    shareConclusionContainer.id = `modal-share-conclusion`
    shareConclusionContainer.name = shareConclusionContainer.id
    const shareConclusionLabel = document.createElement('label')
    shareConclusionLabel.classList.add('modal-share-textarea-label')
    shareConclusionLabel.id = `modal-share-conclusion-label`
    shareConclusionLabel.name = shareConclusionLabel.id
    shareConclusionLabel.textContent = 'What question would you pose to your audience?'
    shareConclusionContainer.appendChild(shareConclusionLabel)
    const shareConclusionInput = document.createElement('textarea')
    shareConclusionInput.classList.add('modal-share-textarea', 'modal-share-conclusion-input')
    shareConclusionInput.id = `modal-share-conclusion-input`
    shareConclusionInput.name = shareConclusionInput.id
    shareConclusionInput.placeholder = 'Ex. What would you do in this situation?'
    shareConclusionInput.value = shareData.conclusion ?? null
    shareConclusionContainer.appendChild(shareConclusionInput)
    /* share submit */
    const shareSubmit = document.createElement('div')
    shareSubmit.classList.add('modal-share-submit')
    shareSubmit.id = `modal-share-submit`
    shareSubmit.name = shareSubmit.id
    const shareSubmitCancel = document.createElement('button')
    shareSubmitCancel.classList.add('modal-share-button', 'modal-share-cancel', 'button')
    shareSubmitCancel.id = `modal-share-cancel`
    shareSubmitCancel.name = shareSubmitCancel.id
    shareSubmitCancel.textContent = 'Cancel'
    shareSubmitCancel.addEventListener('click', mCloseSharePanel)
    shareSubmit.appendChild(shareSubmitCancel)
    const shareSubmitSpacer = document.createElement('div')
    shareSubmitSpacer.classList.add('modal-share-spacer')
    shareSubmit.appendChild(shareSubmitSpacer)
    const shareSubmitPreview = document.createElement('button')
    shareSubmitPreview.classList.add('modal-share-button', 'modal-share-preview', 'button')
    shareSubmitPreview.id = `modal-share-preview`
    shareSubmitPreview.name = shareSubmitPreview.id
    shareSubmitPreview.textContent = 'Preview'
    shareSubmit.appendChild(shareSubmitPreview)
    const shareSubmitButton = document.createElement('button')
    shareSubmitButton.classList.add('modal-share-button', 'modal-share-submit-button', 'button')
    shareSubmitButton.id = `modal-share-submit-button`
    shareSubmitButton.name = shareSubmitButton.id
    shareSubmitButton.textContent = 'Share'
    shareSubmitButton.addEventListener('click', async _=>{
        const shareData = {
            anonymous: shareAnonymous.checked,
            conclusion: shareConclusionInput.value,
            guessable: shareGuessable.checked,
            id: shareId,
            itemId: itemId,
            pov: sharePovDropdown.value,
            scope: shareScopeDropdown.value,
            title: shareTitleInput.value,
            voice: shareVoiceInput.value,
        }
        const response = globals.isGuid(shareId)
            ? await globals.datamanager.shareUpdate(shareData)
            : await globals.datamanager.shareCreate(shareData)
        if(!shareId){
            shareId = response.id
            shares.push(shareId)
            const shareItem = mCreateShareLink(itemId, shares, summary, title, shareId, 1)
            const shareList = document.getElementById(`share-list_${ itemId }`)
            if(shareList)
                shareList.appendChild(shareItem)
        }
        mCloseSharePanel()
    })
    // shareSubmitButton.addEventListener('click', mShareSubmit)
    shareSubmit.appendChild(shareSubmitButton)
    /* append */
    shareModal.appendChild(shareHeader)
    shareModal.appendChild(shareSummary)
    shareModal.appendChild(shareOptions)
    shareOptions.appendChild(shareOptionsRow01)
    shareOptionsRow01.appendChild(shareTitleContainer)
    shareOptionsRow01.appendChild(anonymousContainer)
    shareOptionsRow01.appendChild(guessableContainer)
    shareOptions.appendChild(shareOptionsRow02)
    shareOptionsRow02.appendChild(shareScope)
    shareOptionsRow02.appendChild(sharePov)
    shareOptionsRow02.appendChild(shareVoiceContainer)
    shareOptions.appendChild(shareOptionsRow03)
    shareOptionsRow03.appendChild(shareLink)
    shareOptionsRow03.appendChild(shareConclusionContainer)
    shareModal.appendChild(shareSubmit)
    globals.page.appendChild(shareModal)
    show(shareModal)
}
function mCloseSharePanel(){
    const shareModal = document.getElementById('modal-share')
    if(shareModal)
        expunge(shareModal)
}
/**
 * Click event to trigger server explanation of how to begin a diary.
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mStartDiary(event){
    event.preventDefault()
    event.stopPropagation()
    const submitButton = event.target
    const diaryBot = getBot('diary')
    if(!diaryBot)
        return
    hide(submitButton)
    unsetActiveItem()
    await setActiveBot(diaryBot.id)
    const response = await submit(`How do I get started?`, true)
    addMessages(response.responses, 'diary')
}
/**
 * Stop reliving memory and clean up memory input.
 * @param {Guid} id - The memory id
 * @param {Boolean} server - Whether or not to execute server response, defaults to `true`
 * @returns {void}
 */
async function mStopRelivingMemory(id, server=true){
    globals.removeDisappearingElements()
    if(server){
        const { instruction, responses, success} = await globals.datamanager.memoryReliveEnd(id)
        if(success){
            addMessages(responses, 'system', 3)
            if(!!instruction){
                enactInstruction(instruction)
            }
        }
    }
    mRelivingMemory = null
    unsetActiveItem()
    toggleMemberInput(true)
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
    const botContainer = this
    const element = event.target
    const { dataset, id, } = botContainer
    const itemIdSnippet = element.id.split('-').pop()
    switch(itemIdSnippet){
        case 'name':
        case 'title':
        case 'titlebar':
            mOpenStatusDropdown(this)
            break
        case 'icon':
        case 'image':
        case 'thumb':
        case 'type':
            if(dataset?.status && !(['error', 'offline', 'unknown'].includes(dataset.status)))
                await setActiveBot(dataset?.id ?? id, true)
            break
        case 'status':
        case 'type':
        case 'dropdown':
            mOpenStatusDropdown(this)
            break
        case 'update':
        case 'upload':
            break
        case 'version':
            console.log('Version:', dataset.version, 'check version against server', mTeams)
            break
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
    const type = id.split('-').pop()
    const refreshTrigger = document.getElementById(`collection-refresh-${ type }`)
    const isRefresh = target.id===refreshTrigger.id
    const itemList = document.getElementById(`collection-list-${ type }`)
    /* validation */
    if(!itemList)
        throw new Error(`Collection list not found for toggle.`)
    /* functionality */
    if(dataset.init!=='true' || isRefresh){ // first click or refresh
        show(refreshTrigger)
        refreshTrigger.classList.add('spin')
        await mRefreshCollection(type)
        dataset.init = 'true'
        refreshTrigger.classList.remove('spin')
        show(target)
        show(itemList) // even if `none`
    } else
        toggleVisibility(itemList)
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
    if(event?.target===passphraseResetButton){
        event.stopPropagation()
        console.log('resetting', event.target)
        passphraseInput.focus()
        passphraseInput.disabled = false
        // passphraseInput.addEventListener('input', mInputPassphrase)
        passphraseCancelButton.addEventListener('click', mTogglePassphrase, { once: true })
        passphraseSubmitButton.classList.add('fa-circle-arrow-right')
        passphraseSubmitButton.classList.remove('fa-check')
        passphraseSubmitButton.addEventListener('click', mUpdatePassphrase);
        passphraseInput.addEventListener('keydown', mInputPassphrase)
        passphraseSubmitButton.classList.add('fa-circle-arrow-right')
        hide(passphraseResetButton)
        show(passphraseCancelButton)
        show(passphraseInputContainer)
    } else {
        console.log('toggling', event)
        passphraseInput.blur()
        passphraseInput.removeEventListener('input', mInputPassphrase)
        passphraseSubmitButton.removeEventListener('click', mUpdatePassphrase)
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
function mTogglePopup(event, collectionItem){
    event.stopPropagation()
    const item = event.target.parentElement
    const { id, } = item
    const popupId = id.split('_').pop()
    let popup = document.getElementById(`popup-container_${ popupId }`)
    if(!!popup){
        globals.expunge(popup)
        return
    }
    popup = mCreateCollectionPopup(collectionItem)
    item.appendChild(popup)
    /* calculate desired position */
    popup.style.position = 'fixed'
    popup.style.right = '80vw'
    show(popup)
    setActiveItem(popupId)
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
    id = globals.HTMLIdToType(id)
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
    const type = globals.HTMLIdToType(id)
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
 * @requires mBots
 * @param {boolean} includePersonalAvatar - Include personal avatar, use false when switching teams.
 * @returns {void}
 */
function mUpdateBotContainers(includePersonalAvatar=true){
    if(!mBots?.length)
        throw new Error(`mBots not populated.`)
    const botContainers = Array.from(document.querySelectorAll('.bot-container'))
    if(!botContainers.length)
        throw new Error(`No bot containers found on page`)
    botContainers
        .forEach(botContainer=>mUpdateBotContainer(botContainer, includePersonalAvatar))
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
    mSetStatusBar(bot, botContainer)
    mUpdateInterests(botContainer)
    /* type-specific logic */
    mUpdateBotContainerAddenda(botContainer, bot)
}
/**
 * Updates the bot container with specifics based on `type`.
 * @param {HTMLDivElement} botContainer - The bot container.
 * @returns {void}
 */
function mUpdateBotContainerAddenda(botContainer){
        if(!botContainer)
            return
        /* type-specific logic */
        const { dataset, id: type } = botContainer
        const { id, } = dataset
        const localVars = {}
        if(dataset) // assign dataset to localVars for state manipulation and rollback
            Object.keys(dataset).forEach(key=>localVars[key] = dataset[key])
        const botNameInput = document.getElementById(`${ type }-input-bot_name`)
        /* attach bot name listener */
        if(botNameInput){
            botNameInput.addEventListener('change', async _=>{
                botNameInput.blur()
                botNameInput.disabled = true
                dataset.bot_name = botNameInput.value
                const { bot_name, } = dataset
                const botData = {
                    bot_name,
                    id,
                    type,
                }
                const { name, } = await globals.datamanager.botUpdate(botData)
                botNameInput.disabled = false
                if(name?.length){
                    const botTitleName = document.getElementById(`${ type }-title-name`)
                    if(botTitleName)
                        botTitleName.textContent = bot_name
                    localVars.bot_name = bot_name
                    /* update mBot */
                    const bot = mBot(id)
                    bot.bot_name = bot_name
                    bot.name = bot_name
                    globals.chatInputPlaceholder = `Type a message to ${ bot_name }...`
                } else {
                    dataset.bot_name = localVars.bot_name
                }
            })
        }
        /* publicity */
        const publicityToggle = document.getElementById(`${ type }-publicity-toggle`)
        if(publicityToggle){
            publicityToggle.addEventListener('click', mToggleSwitchPrivacy)
            const publicityToggleView = document.getElementById(`${ type }-publicity-toggle-view-icon`)
            if(publicityToggleView){
                const { checked=false, } = document.getElementById(`${ type }-publicity-input`) ?? {}
                mToggleClass(publicityToggleView, !checked ? ['fa-eye-slash'] : ['fa-eye'], checked ? ['fa-eye'] : ['fa-eye-slash'])
                publicityToggleView.addEventListener('click', event=>{
                    // @note - shouldn't be required, but container masters the switch
                    event.stopImmediatePropagation()
                    event.stopPropagation()
                })
            }
        }
        /* retirements */
        const retireChatButton = document.getElementById(`${ type }-retire-chat`)
        if(retireChatButton){
            retireChatButton.dataset.botId = id
            retireChatButton.dataset.type = type
            retireChatButton.addEventListener('click', mRetireChat)
        }
        const retireBotButton = document.getElementById(`${ type }-retire-bot`)
        if(retireBotButton){
            retireBotButton.dataset.botId = id
            retireBotButton.dataset.type = type
            retireBotButton.addEventListener('click', mRetireBot)
        }
        switch(type){
            case 'avatar':
            case 'personal-avatar':
                /* attach avatar listeners */
                /* set additional data attributes */
                mTogglePassphrase(false) /* passphrase */
                const tutorialButton = document.getElementById('personal-avatar-tutorial')
                if(tutorialButton){
                    if(experiences().length){
                        show(tutorialButton)
                        tutorialButton.addEventListener('click', async event=>{
                            hide(tutorialButton)
                            const tutorialId = 'aae28fe4-30f9-4c29-9174-a0616569e762'
                            startExperience(tutorialId) // no await
                        }, { once: true })
                    } else
                        hide(tutorialButton)
                }
                const introductionButton = document.getElementById('personal-avatar-introduction')
                if(introductionButton)
                    introductionButton.addEventListener('click', introduction)
                const privacyPolicyButton = document.getElementById('personal-avatar-privacy')
                if(privacyPolicyButton)
                    privacyPolicyButton.addEventListener('click', privacyPolicy)
                const greetingRoutineAvatarButton = document.getElementById('personal-avatar-routine')
                if(greetingRoutineAvatarButton)
                    greetingRoutineAvatarButton.addEventListener('click', _=>routine('avatar'))
                break
            case 'biographer':
            case 'journaler':
            case 'personal-biographer':
                const greetingRoutineBiographerButton = document.getElementById('personal-biographer-routine')
                if(greetingRoutineBiographerButton)
                    greetingRoutineBiographerButton.addEventListener('click', _=>routine('biographer'))
                break
            case 'diary':
                // add listener on `diary-start` button
                const diaryStart = document.getElementById('diary-start')
                if(diaryStart)
                    diaryStart.addEventListener('click', mStartDiary)
                break
            default:
                break
        }
}
/**
 * Updates bot version on server.
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mUpdateBotVersion(event){
    event.stopPropagation()
    const updater = event.target
    const { classList, dataset,} = updater
    const { botId, currentVersion, updateVersion, } = dataset
    if(currentVersion==updateVersion)
        return
    const updatedVersion = await globals.datamanager.botVersion(botId)
    if(updatedVersion?.success){
        const { version, } = updatedVersion.bot
        dataset.currentVersion = version
        updater.textContent = mVersion(version)
        classList.remove('update-available')
    } else
        updater.addEventListener('click', mUpdateBotVersion, { once: true })
}
/**
 * Update the identified collection with provided specifics.
 * @param {string} type - The collection type.
 * @param {HTMLDivElement} collectionList - The collection container.
 * @param {Array} collection - The collection items.
 * @returns {void}
 */
function mUpdateCollection(type, collectionList, collection){
    collectionList.innerHTML = ''
    collection
        .map(item=>({
            ...item,
            being: item.being,
            name: item.title
                ?? item.filename
                ?? item.name
                ?? type,
            type: item.type
                ?? type
                ?? item.being,
        }))
        .filter(item=>item.type===type)
        .sort((a, b)=>a.name.localeCompare(b.name))
        .forEach(item=>collectionList.appendChild(mCreateCollectionItem(item)))
}
/**
 * Sets collection item content.
 * @private
 * @async
 * @param {Event} event - The event object
 * @returns {Boolean} - Whether or not the content was updated
 */
async function mUpdateCollectionItem(event){
    event.stopPropagation()
    const { contentId, id, } = event.target.dataset
    const contentElement = document.getElementById(contentId)
    if(!contentElement)
        throw new Error(`No content found for collection item update.`)
    const { dataset, } = contentElement
    const { emoticons=[], lastUpdatedContent, } = dataset
    const { value: content, } = contentElement
    if(content==lastUpdatedContent)
        return true
    const { success, } = await globals.datamanager.itemUpdate(id, content, emoticons)
    if(success){
        contentElement.dataset.lastUpdatedContent = content
        const item = document.getElementById(`collection-item_${ id }`)
        if(item?.collectionItem)
            item.collectionItem.summary = content
    } else 
        contentElement.value = lastUpdatedContent
    return success
}
/**
 * Updates the collection item title and assigns data and listeners as required.
 * @param {Event} event - The event object
 * @returns {void}
 */
function mUpdateCollectionItemTitle(event){
    const span = event.target
    const { id, textContent, } = span
    let idType = id.split('_')
    const itemId = idType.pop()
    idType = idType.join('_')
    /* create input */
    const input = document.createElement('input')
    const inputName = `${ idType }-input`
    input.id = `${ inputName }_${ itemId }`
    input.name = inputName
    input.type = 'text'
    input.value = textContent
    input.className = inputName
    /* replace span with input */
    span.replaceWith(input)
    /* add listeners */
    input.addEventListener('keydown', event=>{
        if(event.key==='Enter')
            input.blur()
        else if(event.key==='Escape'){
            input.value = textContent
            input.blur()
        }
    })
    input.addEventListener('blur', async event=>{
        input.replaceWith(span)
        input.remove()
        const title = input.value
        if(title?.length && title!==textContent){
            if(await globals.datamanager.itemUpdateTitle(itemId, title))
                updateItemTitle(itemId, title)
        }
        span.addEventListener('dblclick', mUpdateCollectionItemTitle, { once: true })
    }, { once: true })
    input.focus()
}
/**
 * Update the bot interests checkbox structure with specifics.
 * @param {string} interests - The member's interests.
 * @param {HTMLElement} botContainer - The bot container.
 * @returns {void}
 */
function mUpdateInterests(botContainer){
    const { dataset, } = botContainer
    const { id, interests, type, } = dataset
    const interestsList = document.getElementById(`${ type }-interests`)
    if(!interestsList)
        return
    const checkboxes = interestsList.querySelectorAll('input[type="checkbox"]')
    if(interests?.length){
        dataset.interests = interests
        const interestsArray = interests.split('; ')
        checkboxes.forEach(checkbox=>{
            if(interestsArray.includes(checkbox.value)){
                checkbox.checked = true
            }
        })
    }
    /* add listeners to checkboxes */
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const { dataset, } = botContainer
            /* concatenate checked values */
            const checkedValues = Array.from(checkboxes)
                .filter(cb => cb.checked) // Filter only checked checkboxes
                .map(cb => cb.value) // Map to their values
                .join('; ')
            dataset.interests = checkedValues
            const { id, interests, type, } = dataset
            const bot = {
                id,
                interests,
                type,
            }
            globals.datamanager.botUpdate(bot) // no `await
        })
    })
}
/**
 * Update the bot labels with specifics.
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
 * Submit updated passphrase for MyLife via avatar.
 * @private
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mUpdatePassphrase(event){
    const { value, } = passphraseInput
    if(!value?.length)
        return
    const success = await globals.datamanager.passphraseUpdate(value)
    if(success){
        hide(passphraseCancelButton)
        passphraseInput.disabled = true
        passphraseInput.value = 'Passphrase updated!'
        passphraseSubmitButton.classList.remove('fa-circle-arrow-right')
        passphraseSubmitButton.classList.add('fa-check')
        setTimeout(_=>{
            mTogglePassphrase()
        }, 2000)
    } else
        passphraseSubmitButton.classList.add('fa-circle-arrow-right')
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
        mTeams.push(...await globals.datamanager.teams())
    const team = mTeams
        .find(team=>team.name===identifier || team.id===identifier)
    if(!team)
        throw new Error(`Team "${ identifier }" not available at this time.`)
    if(mActiveTeam!==team){
        const { id: teamId, } = team
        const activeTeam = await globals.datamanager.teamActivate(teamId)
        if(activeTeam)
            mActiveTeam = activeTeam
    }
    const { allowedTypes, description, id, name, title, } = team
    mTeamName.dataset.id = id
    mTeamName.dataset.description = description
    mTeamName.textContent = `${ title ?? name } Team`
    mTeamName.title = description
    // @stub mTeamName.addEventListener('click', mCreateTeamSelect)
    mTeamAddMemberIcon.addEventListener('click', mCreateTeamMemberSelect)
    hide(mTeamPopup)
    show(mTeamHeader)
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
    createItem,
    endMemory,
    getAction,
    getBot,
    getBotIcon,
    getItem,
    refreshCollection,
    setActiveBot,
    togglePopup,
    updateItem,
    updateItemSummary,
    updateItemTitle,
    updateTitle,
    updatePageBots,
}