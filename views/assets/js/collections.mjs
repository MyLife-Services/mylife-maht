import {
    activeBot,
    activeTeam,
    addInput,
    addMessage,
    addMessages,
    clearSystemChat,
    decorateActiveBot,
    enactInstruction,
    expunge,
    getBot,
    getBotIcon,
    getBots,
    getBotsByForm,
    globals,
    hide,
    isAvatar,
    mainContent,
    overlays,
    replaceElement,
    seedInput,
    setActiveAction,
    setActiveBot,
    show,
    startDrag,
    submit,
    toggleBotContainers,
    toggleMemberInput,
    toggleVisibility,
} from './bots.mjs'
const mAvailableMimeTypes = [],
    mActiveButton = document.getElementById('chat-active-item-button'),
    mActiveChat = document.getElementById('chat-active-item'),
    mActiveClose = document.getElementById('chat-active-item-close'),
    mActiveIcon = document.getElementById('chat-active-item-icon'),
    mActiveStatus = document.getElementById('chat-active-item-status'),
    mActiveTitle = document.getElementById('chat-active-item-title'),
    mCollections = document.getElementById('collections-container'),
    mCollectionItems={},
    mDefaultReliveMemoryButtonText = 'Next'
let mActiveItem,
    mAvailableCollections,
    mCollectionsDescription,
    mCollectionHighlights,
    mCollectionsUpload, // document.getElementById('collections-upload')
    mRelivingMemory,
    mShadows
/* public functions */
/**
 * Initializes the collections by creating collection bars and setting up event listeners.
 * @requires mAvailableCollections
 * @requires mCollectionHighlights
 * @returns {Promise<void>}
 */
async function init(){
    if(!mCollections || !activeTeam()?.id?.length)
        return
    mAvailableCollections = ['file'] // ['chat', 'conversation'],
    const { allowedItemTypes, collection, primaryCollectionTypes, } = activeTeam()
    if(Array.isArray(allowedItemTypes) && allowedItemTypes.length)
        mAvailableCollections.push(...allowedItemTypes)
    mCollectionHighlights = activeTeam()?.primaryCollectionTypes ?? []
    mShadows = await globals.datamanager.shadows() // @stub: transition to collection-specific
    /* initilize data for collections */
    for(const collectionType of mAvailableCollections) // populates mCollectionItems
        await mInitializeCollectionData(collectionType, isHighlightedCollection(collectionType))
    mCreateCollections(mAvailableCollections, activeTeam()?.collection ?? 'Scrapbook')
}
/**
 * Gets the active item button HTML element for active item display.
 * @returns {HTMLElement} - The Active Item Button HTML object
 */
function activeButton(){
    return mActiveButton
}
/**
 * Gets the active chat HTML element for active item display.
 * @returns {HTMLElement} - The Active Chat HTML object
 */
function activeChat(){
    return mActiveChat
}
/**
 * Gets the active item close button HTML element for active item display.
 * @returns {HTMLElement} - The Active Item Close Button HTML object
 */
function activeClose(){
    return mActiveClose
}
/**
 * Gets the active item icon HTML element for active item display.
 * @returns {HTMLElement} - The Active Item Icon HTML object
 */
function activeIcon(){
    return mActiveIcon
}
/**
 * Gets the active item object.
 * @returns {object} - The active item object.
 */
function activeItem(){
    return mActiveItem ?? {}
}
/**
 * Gets the active item status HTML element for active item display.
 * @returns {HTMLElement} - The Active Item Status HTML object
 */
function activeStatus(){
    return mActiveStatus
}
/**
 * Gets the active item title HTML element for active item display.
 * @returns {HTMLElement} - The Active Item Title HTML object
 */
function activeTitle(){
    return mActiveTitle
}
/**
 * Creates a new collection item from server item object data, and activates the new summary.
 * @param {object} item - The collection item data
 * @returns {void}
 */
function createItem(item){
    if(typeof item==='string')
        if(globals.isGuid(item))
            item = getItem(item)
    const { container, id, popup, type, } = item
    if(id && getItem(id)?.id!==id)
        mCollectionItems[type].items.push(item)
    if(!container)
        item.container = mCreateCollectionItem(item)
    const collectionList = document.getElementById(`collection-list-${ type }`)
    if(collectionList){
        collectionList.appendChild(item.container)
        setActiveItem(id)
    }
}
/**
 * Deletes a collection item from the local collection items array, as requested by server deletion.
 * @requires mCollectionItems
 * @param {Guid} id - The collection item id
 * @returns {void}
 */
function deleteItem(id, type){
    if(!globals.isGuid(id))
        return
    const typeItems = mCollectionItems[type ?? getItem(id)?.type]?.items ?? []
    const index = typeItems.findIndex(i =>i.id===id)
    if(index!==-1)
        typeItems.splice(index, 1)
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
 * Returns the collection object (includes items) for the specified collection type.
 * @requires mCollectionItems
 * @param {string} type - The collection type to find
 * @returns {object} - The collection object { associatedBots, container, id, items, type, }
 */
function getCollection(type){
    return mCollectionItems[type]
        ?? {}
}
/**
 * Get collection item by id.
 * @requires mCollectionItems
 * @param {Guid} id - The collection item id
 * @returns {object} - The collection item object { assistantType, container, filename, form, id, keywords, name, popup, summary, title, type, version, }
 */
function getItem(id) {
    for(const collection of Object.values(mCollectionItems)){
        const match = collection.items
            ?.find(item=>item.id === id)
        if(match)
            return match
    }
    return {}
}
/**
 * Reveals whether the supplied type is a highlighted collection, meaning it is preloaded and shown in priority order.
 * @requires mCollectionHighlights
 * @param {string} type - Type of collection
 * @returns {boolen} - `true` if highlighted by team
 */
function isHighlightedCollection(type){
    return mCollectionHighlights.includes(type)
}
/**
 * Obscures an entry item, removing it from view and updating the server. **note**: currently only used for entries, but could be used for other item types in the future, ergo is located in collections module.
 * @async
 * @param {Event} event - The event object
 * @return {void}
 */
async function mObscureEntry(event){
    event.stopPropagation()
    const { id, } = event.target
    const itemId = getItem(globals.extractId(id))?.id
    if(!globals.isGuid(itemId))
        return
    setActiveItem(itemId)
    const awaitBar = globals.await(`${ activeBot().name } is obscuring your content...`)
    globals.addChatElement(awaitBar)
    toggleMemberInput(false)
    const popupClose = document.getElementById(`popup-close-${ itemId }`)
    if(popupClose)
        popupClose.click()
    const { instruction, responses, success, } = await globals.datamanager.obscure(itemId)
    if(responses?.length)
        addMessages(responses, activeBot().type)
    if(instruction)
        enactInstruction(instruction, 'chat', { updateItemSummary, })
    expunge(awaitBar)
    toggleMemberInput(true)
}
/**
 * Refresh designated collection from server. **note**: external calls denied option to identify collectionList parameter, ergo must always be of same type.
 * @param {string} type - The collection type
 * @returns {void}
 */
async function refreshCollection(type){
    return await mRefreshCollection(type)
}
/**
 * Removes a collection item and its popup from the DOM, does not update server.
 * @param {Guid} id - The collection item id
 * @returns {void}
 */
function removeItem(id){
    const item = getItem(id)
    if(item?.container instanceof HTMLElement)
        expunge(item.container)
    if(item?.popup instanceof HTMLElement)
        expunge(item.popup)
}
/**
 * Sets the active item, ex. `memory`, `entry` in the chat system for member operation(s).
 * @public
 * @requires activeChat
 * @param {Guid} itemId - The item id to set as active
 * @returns {void}
 */
function setActiveItem(itemId){
    if(!globals.isGuid(itemId))
        return
    const item = getItem(itemId)
    const { form, popup, title, type, } = item
    if(!popup)
        return
    if(activeButton())
        hide(activeButton())
    if(activeClose()){
        activeClose().className = 'fas fa-times chat-active-item-close'
        activeClose().addEventListener('click', unsetActiveItem, { once: true })
    }
    if(activeIcon()){
        activeIcon().className = 'fas fa-square chat-active-item-icon'
    }
    if(activeStatus()){
        activeStatus().className = 'chat-active-item-status'
        activeStatus().textContent = 'Active: '
        activeStatus().removeEventListener('click', mTogglePopup)
        activeStatus().addEventListener('click', mTogglePopup)
    }
    if(activeTitle()){
        activeTitle().textContent = ''
        const activeText = document.createElement('div')
        activeText.classList.add('chat-active-item-title-text')
        activeText.id = `chat-active-item-title-text-${ itemId }`
        activeText.textContent = title
        /* append activeTitle */
        activeTitle().appendChild(activeText)
        activeTitle().className = 'chat-active-item-title'
        activeTitle().addEventListener('dblclick', updateTitle, { once: true })
    }
    mActiveItem = { form, id: itemId, inAction: false, type }
    function getBotType(itemType){
        switch(itemType){
            case 'memory':
                return 'biographer'
            case 'entry':
                return form==='journal'
                    ? 'journaler'
                    : 'diary'
            default:
                return 'avatar'
        }
    }
    const botType = getBotType(type)
    const { id, } = getBot(botType)
    if(id)
        setActiveBot(id, false)
    show(activeChat())
}

/**
 * Exposed method to allow externalities to toggle a specific item popup.
 * @param {string} id - Id for HTML div element to toggle
 * @param {boolean} bForceState - Optional boolean to force open (true) or close (false)
 * @returns {void}
 */
function togglePopup(id, bForceState){
    const { container, } = getItem(id) // @stub: can get by id or title?
    container?.click() // force click on itemContainer, triggers `mTogglePopup`
}
/**
 * Unsets the active item in the chat system.
 * @public
 * @requires mActiveItem
 * @returns {void}
 */
function unsetActiveItem(){
    const { popup, } = activeItem()
    mActiveItem = null
    hide(activeChat())
    if(popup)
        hide(popup)
}
/**
 * Updates the active item title in the chat system, display-only.
 * @public
 * @param {Guid} itemId - The item ID
 * @param {string} title - The title to set
 * @returns {void}
 */
function updateActiveItemTitle(itemId, title){
    const activeChatTitle = document.getElementById(`chat-active-item-title-text-${ itemId }`)
    const id = mActiveItem?.id
    if(id!==itemId)
        throw new Error('updateActiveItemTitle::Error()::`itemId`\'s do not match')
    activeChatTitle.innerHTML = title
}
/**
 * Update collection item.
 * @param {object} item - The collection item fields to update, requires `{ id, }`
 * @returns {void}
 */
function updateItem(item){
    if(!item?.id)
        return
    createItem(item)
}
function updateItemSummary(id, updatedSummary){
    const item = getItem(id)
    const { container, popup, summary, } = item
    if(updatedSummary==summary)
        return
    const popupContent = popup.querySelector(`#popup-content-${ id }`)
    item.summary = updatedSummary
    item.lastUpdatedContent = updatedSummary
    item.lastUpdate = Date.now()
    if(popupContent)
        popupContent.value = updatedSummary
}
/**
 * Sets an item's changed title in all locations.
 * @param {Guid} itemId - The collection item id
 * @param {String} title - The title to set for the item
 */
function updateItemTitle(itemId, title){
    const titleSpan = document.getElementById(`collection-item-title-${ itemId }`)
    const titleInput = document.getElementById(`collection-item-title-input-${ itemId }`)
    const popupTitle = document.getElementById(`popup-header-title-${ itemId }`)
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
/* private functions */
/**
 * Gets collection items data from server for the specified collection type.
 * @requires globals
 * @param {string} type - The collection type to retrieve items for
 * @returns {Promise<Array>} - An array of collection item objects
 */
async function mCollectionItemsData(type){
    return await globals.datamanager.collections(type)
}
/**
 * Create a functional collection item HTML div for the specified collection type.
 * @example - collectionItem: { assistantType, container, complete, emoticons, filename, form, id, keywords, lastCursorPosition, lastUpdatedContent, name, popup, shares, summary, title, type, version, }
 * @param {object} collectionItem - The collection item data object
 * @returns {HTMLDivElement} - The collection item
 */
function mCreateCollectionItem(item){
    /* collection item container */
    const { assistantType, container, filename, form, id, name, title, type, } = item
    if(!!container)
        return // @stub: would still be inclined to update data or delete and recreate?
    const iconType = assistantType
        ?? form
        ?? type
    const itemContainer = document.createElement('div')
    itemContainer.id = `collection-item-${ id }`
    itemContainer.item = item // **note**: synthetic variable to point to reference data
    itemContainer.name = `collection-item-${ type }`
    itemContainer.classList.add('collection-item', `${ type }-collection-item`)
    item.container = itemContainer
    /* icon */
    const itemIcon = document.createElement('img')
    itemIcon.classList.add('collection-item-icon', `${ type }-collection-item-icon`)
    itemIcon.id = `collection-item-icon-${ id }`
    itemIcon.src = getBotIcon(iconType)
    itemContainer.appendChild(itemIcon)
    /* name */
    const itemTitle = document.createElement('span')
    itemTitle.classList.add('collection-item-title', `${ type }-collection-item-title`)
    itemTitle.id = `collection-item-title-${ id }`
    itemTitle.name = `collection-item-title-${ type }`
    itemTitle.textContent = title
        ?? name
        ?? filename
        ?? `unknown ${ type } item`
    itemContainer.appendChild(itemTitle)
    /* buttons */
    switch(type){
        case 'file':
            /* file-summary icon */
            const itemSummary = mCreateCollectionItemSummarize(type, id, filename)
            itemContainer.appendChild(itemSummary)
            break
        default:
            const itemDelete = mCreateCollectionItemDelete(type, id)
            itemContainer.appendChild(itemDelete)
            break
    }
    /* popup */
    switch(type){
        case 'file':
            /* file-summary popup */
            break
        default:
            item.popup = mCreateCollectionItemPopup(item)
            overlays().appendChild(item.popup)
            itemContainer.addEventListener('click', mTogglePopup)
            itemTitle.addEventListener('dblclick', mUpdateCollectionItemTitle, { once: true })
            break
    }
    return itemContainer
}
/**
 * Creates collection items for a specified collection type and appends them to the collection container.
 * @param {string} type - The collection type
 * @param {Array} items - The collection items
 * @param {HTMLElement} container - The container to append the collection items to
 * @returns {Promise<void>}
 */
async function mCreateCollectionItems(type, items, container){
    if(!container)
        container = mCollectionItems[type]?.itemContainer
    if(!container || !Array.isArray(items))
        return
    container.replaceChildren()
    for(const item of items)
        container.appendChild(mCreateCollectionItem(item))
}
/**
 * Create a collection item delete button.
 * @requires mDeleteCollectionItem
 * @param {string} type - The collection type
 * @param {Guid} id - The collection id
 * @returns {HTMLSpanElement} - The collection item delete button
 */
function mCreateCollectionItemDelete(type, id){
    const itemDelete = document.createElement('span')
    itemDelete.id = `collection-item-delete-${ id }`
    itemDelete.name = `collection-item-delete-${ type }`
    itemDelete.classList.add('fas', 'fa-trash', 'collection-item-delete', `${ type }-collection-item-delete`)
    itemDelete.addEventListener('click', mDeleteCollectionItem, { once: true })
    return itemDelete
}
/**
 * Create a popup for viewing collection item.
 * @param {object} item - The collection item object: { assistantType, container, complete, emoticons, filename, form, id, keywords, lastCursorPosition, lastUpdatedContent, name, popup, shares, summary, title, type, version, }
 * @returns {HTMLDivElement} - The collection popup
 */
function mCreateCollectionItemPopup(item){
    const { container, complete=false, emoticons, form, id, lastCursorPosition, lastUpdatedContent, name, popup, shares=[], summary, title, type, version=1, } = item
    if(popup instanceof HTMLElement)
        return popup
    const collectionPopup = document.createElement('div')
    collectionPopup.classList.add('collection-popup')
    collectionPopup.id = `popup-container-${ id }`
    collectionPopup.name = `collection-popup-${ type }`
    collectionPopup.addEventListener('click', (e)=>e.stopPropagation()) /* Prevent event bubbling to collection-bar */
    /* popup header */
    const popupHeader = document.createElement('div')
    popupHeader.classList.add('popup-header', 'collection-popup-header')
    popupHeader.id = `popup-header-${ id }`
    popupHeader.name = `popup-header-${ type }`
    const popupHeaderTitle = document.createElement('span')
    popupHeaderTitle.classList.add('collection-popup-header-title')
    popupHeaderTitle.id = `popup-header-title-${ id }`
    popupHeaderTitle.textContent = title
        ?? `${ type } Item`
    popupHeaderTitle.name = `popup-header-title-${ type }`
    popupHeaderTitle.addEventListener('dblclick', mUpdateCollectionItemTitle, { once: true })
    popupHeader.appendChild(popupHeaderTitle)
    /* popup close button */
    const popupClose = document.createElement('button')
    popupClose.classList.add('fa-solid', 'fa-close', 'popup-close', 'collection-popup-close')
    popupClose.id = `popup-close-${ id }`
    popupClose.setAttribute('aria-label', 'Close')
    popupClose.addEventListener('click', _=>hide(collectionPopup))
    document.addEventListener('keydown', event=>{
        if(event.key==='Escape' && collectionPopup.classList.contains('show'))
            hide(collectionPopup)
    })
    popupHeader.appendChild(popupClose)
    popupHeader.addEventListener('mousedown', mStartDrag)
    /* popup body/container */
    const popupBody = document.createElement('div')
    popupBody.classList.add('popup-body', 'collection-popup-body')
    popupBody.id = `popup-body-${ id }`
    popupBody.name = `popup-body-${ type }`
    /* popup content */
    const content = summary
    if(!content)
        console.log(`Warning: collection item with id "${ id }" has no content to display in popup.`, item)
    const popupContent = document.createElement('textarea')
    popupContent.classList.add('popup-content', 'collection-popup-content')
    item.lastUpdatedContent = content
    popupContent.id = `popup-content-${ id }`
    popupContent.readOnly = true
    popupContent.value = content
    /* popup sidebar */
    const sidebar = document.createElement('div')
    sidebar.classList.add('popup-sidebar')
    sidebar.id = `popup-sidebar-${ id }`
    /* edit toggle button */
    const popupEdit = document.createElement('span')
    popupEdit.classList.add('fas', 'fa-edit', 'popup-sidebar-icon')
    popupEdit.id = `popup-edit-${ id }`
    /* save button */
    const popupSave = document.createElement('span')
    popupSave.classList.add('fas', 'fa-save', 'popup-sidebar-icon')
    popupSave.id = `popup-save-${ id }`
    popupSave.addEventListener('click', async ()=>{
        popupSave.classList.remove('fa-save')
        popupSave.classList.add('fa-spinner', 'spin')
        const success = await mUpdateCollectionItem(item, popupContent)
        popupSave.classList.remove('fa-spinner', 'spin')
        popupSave.classList.add(success ? 'fa-check' : 'fa-times')
        setTimeout(_=>{
            popupSave.classList.remove('fa-check', 'fa-times')
            popupSave.classList.add('fa-save')
        }, 2000)
    })
    /* toggle-edit listeners */
    popupEdit.addEventListener('click', ()=>{
        _toggleEditable()
    })
    popupContent.addEventListener('dblclick', ()=>{
        _toggleEditable()
    })
    popupContent.addEventListener('blur', () => {
        _toggleEditable(false)
    })
    popupContent.addEventListener('keydown', (event) => {
        if(event.key==='Escape')
            _toggleEditable(false)
    })
    /* inline function to toggle editable state */
    function _toggleEditable(isEditable=true){
        item.lastCursorPosition = popupContent.selectionStart
        popupContent.readOnly = !isEditable
        popupEdit.classList.toggle('popup-sidebar-icon-active', isEditable)
        popupContent.focus()
    }
    sidebar.appendChild(popupEdit)
    sidebar.appendChild(popupSave)
    /* create emoticon bar */
    const emoticonButtons = ['😀', '😢', '😡', '😍', '😱'] // Add more emoticons as needed
    emoticonButtons.forEach(emoticon => {
        const emoticonButton = document.createElement('span')
        emoticonButton.classList.add('popup-sidebar-emoticon')
        emoticonButton.textContent = emoticon
        emoticonButton.addEventListener('click', (e)=>{
            e.stopPropagation()
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
    switch(type){
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
            obscureEntry.id = `button-obscure-${ id }`
            obscureEntry.name = 'obscure-button'
            obscureEntry.textContent = 'Obscure Entry'
            obscureEntry.addEventListener('click', mObscureEntry, { once: true })
            improveEntryWidgetLeft.appendChild(obscureEntry)
            /* evaluate entry */
            const evaluateEntry = document.createElement('button')
            evaluateEntry.classList.add('evaluate-button', 'button')
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
                improveMemoryLaneLeft.appendChild(mCreateShadows(id))
            /* evaluate memory */
            const evaluateMemory = document.createElement('button')
            evaluateMemory.classList.add('evaluate-button', 'button')
            evaluateMemory.id = `button-evaluate-memory_${ id }`
            evaluateMemory.name = 'evaluate-button'
            evaluateMemory.textContent = 'Evaluate'
            evaluateMemory.addEventListener('click', mEvaluate, { once: true })
            improveMemoryLaneLeft.appendChild(evaluateMemory)
            /* relive memory button */
            const reliveButton = document.createElement('button')
            reliveButton.classList.add('relive-memory-button', 'button')
            reliveButton.id = `relive-memory-button-${ id }`
            reliveButton.name = 'relive-memory-button'
            reliveButton.textContent = 'Relive Memory'
            reliveButton.addEventListener('click', mReliveStory, { once: true })
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
 * Create a collection item summarize button.
 * @requires mSummarize
 * @param {string} type - The collection type
 * @param {Guid} id - The collection id
 * @param {string} name - The collection item name, used for summary popup title
 * @returns {HTMLSpanElement} - The collection item summarize button
 */
function mCreateCollectionItemSummarize(type, id, name){
    const itemSummarize = document.createElement('span')
    itemSummarize.classList.add('fas', 'fa-file-circle-question', 'collection-item-summary', `${ type }-collection-item-summary`)
    itemSummarize.id = `collection-item-summary-${ id }`
    itemSummarize.name = `collection-item-summary-${ type }`
    itemSummarize.addEventListener('click', mSummarize, { once: true })
    return itemSummarize
}
/**
 * Initializes the collections by creating collection bars and setting up event listeners.
 * It checks for available collections and associated bots, and updates the collection list accordingly.
 * @private
 * @requires mCollections
 * @requires mCollectionItems (populated)
 * @param {Array} collections - list of collection types (string) to initialize (e.g., ['memory', 'entry'])
 * @param {string} title - title for the collections section (default: 'Scrapbook')
 * @param {Array} primaryCollectionTypes - list of primary collection types to highlight and download
 * @returns {Promise<void>}
 */
function mCreateCollections(collections, title){
    /* checks */
    if(!mCollections) // container must exist to create collections
        return
    mCollections.removeEventListener('click', toggleBotContainers) // prevent stacking
    mCollections.addEventListener('click', toggleBotContainers)
    mCollections.innerHTML = '' // clear existing collections
    /* header */
    const collectionBar = document.createElement('div')
    collectionBar.className = 'collections-titlebar'
    collectionBar.id = 'collections-titlebar'
    collectionBar.name = 'collections-titlebar'
    /* title */
    const collectionTitle = document.createElement('div')
    collectionTitle.className = 'collections-title'
    collectionTitle.id = 'collections-title'
    collectionTitle.name = 'collections-title'
    collectionTitle.textContent = title
    collectionBar.appendChild(collectionTitle)
    /* spacer */
    const collectionSpacer = document.createElement('div')
    collectionSpacer.className = 'collections-spacer'
    collectionSpacer.id = 'collections-titlebar-spacer'
    collectionSpacer.name = 'collections-titlebar-spacer'
    collectionBar.appendChild(collectionSpacer)
    /* options dropdown */
    const collectionOptionsDropdown = document.createElement('div')
    collectionOptionsDropdown.className = 'bot-options-dropdown'
    collectionOptionsDropdown.id = 'collections-options-dropdown'
    collectionBar.appendChild(collectionOptionsDropdown)
    mCollections.appendChild(collectionBar)
    /* collection description */
    const collectionsOptions = document.createElement('div')
    collectionsOptions.className = 'bot-options collections-options hidden'
    collectionsOptions.id = 'collections-options'
    collectionsOptions.name = 'collections-options'
    const collectionsDescription = document.createElement('div')
    collectionsDescription.className = 'collections-description show'
    collectionsDescription.id = 'collections-description'
    collectionsDescription.textContent = 'Click on a category to browse entries'
    mCollectionsDescription = collectionsDescription
    collectionsOptions.appendChild(collectionsDescription)
    /* scrapbook (collections) */
    const collectionsContainer = document.createElement('div')
    collectionsContainer.id = 'collections-collections'
    collectionsContainer.className = 'collections'
    collectionsOptions.appendChild(collectionsContainer)
    /* sort collections */
    collections.sort((a, b)=>{
        const aH = mCollectionHighlights.includes(a)
        const bH = mCollectionHighlights.includes(b)
        return (bH - aH) || (a < b ? -1 : 1)
    })
    for(let type of collections){
        /* collection container */
        const collectionContainer = document.createElement('div')
        collectionContainer.className = `collection ${ type }-collection`
        collectionContainer.id = `collection-${ type }`
        collectionContainer.name = `collection-${ type }`
        mCollectionItems[type].container = collectionContainer
        collectionContainer.addEventListener('click', mToggleCollectionItems)
        collectionsOptions.appendChild(collectionContainer)
        /* collection bar */
        const collectionBar = document.createElement('div')
        collectionBar.className = 'collection-bar'
        collectionBar.id = `collection-bar-${ type }`
        collectionBar.name = `collection-bar-${ type }`
        // @stub: addlistener
        collectionContainer.append(collectionBar)
        /* collection icon */
        const collectionIcon = document.createElement('div')
        collectionIcon.className = `collection-icon collection-icon ${ type }-icon`
        collectionIcon.id = `collection-icon-${ type }`
        collectionIcon.name = `collection-icon-${ type }`
        collectionBar.appendChild(collectionIcon)
        /* collection title */
        const collectionTitle = document.createElement('div')
        collectionTitle.className = `collection-title ${ type }-title`
        collectionTitle.id = `collection-title-${ type }`
        collectionTitle.name = `collection-title-${ type }`
        collectionTitle.textContent = globals.pluralize(type)
        collectionBar.appendChild(collectionTitle)
        /* associated bots */
        for(const bot of mCollectionItems[type].associatedBots){
            const { id, type: botType, } = getBot(bot)
            /* bot container */
            const collectionBot = document.createElement('div')
            collectionBot.className = `collection-bot ${ type }-bot-${ id }`
            collectionBot.id = `collection-bot-${ type }-${ id }`
            collectionBot.name = `collection-bot-${ type }-${ id }`
            /* icon */
            const itemIcon = document.createElement('img')
            itemIcon.id = `collection-bot-icon-${ type }-${ id }`
            itemIcon.classList.add('collection-bot-icon', `collection-bot-icon-${ botType }`)
            itemIcon.src = getBotIcon(botType)
            collectionBot.appendChild(itemIcon)
            collectionBar.appendChild(collectionBot)
        }
        /* collection refresh */
        const refresh = document.createElement('span')
        refresh.className = `fa-solid fa-refresh collection-refresh ${ type }-refresh`
        refresh.id = `collection-refresh-${ type }`
        refresh.name = `collection-refresh-${ type }` // **note**: refresh functionality dealth as sub-function in `mToggleCollectionItems`
        collectionBar.appendChild(refresh)
        /* collection list */
        const collectionList = document.createElement('div')
        collectionList.className = `collection-list ${ type }-list`
        collectionList.id = `collection-list-${ type }`
        collectionList.name = `collection-list-${ type }`
        mCollectionItems[type].itemContainer = collectionList
        collectionContainer.appendChild(collectionList)
        /* collection items */
        // item (formal): { assistantType, being, id, form, keywords, relationships, shares, summary, title, *type, version, }
        // **note**: `type` is indeed the same as collection type, `form` is the subordinate nuance (ex. journal, diary, biographer, etc.)
        const items = mCollectionItems[type].items // @stub: sort by chron or name
        // **note**: item HTML are constructed from the return of data; below is a placeholder for not yet occurred or not yet refreshed
        if(!items.length){ // create empty item of no items, refresh from server
            const emptyItem = document.createElement('div')
            emptyItem.className = `collection-item ${ type }-item`
            emptyItem.id = `collection-item-${ globals.newGuid }`
            emptyItem.textContent = 'None'
            collectionList.appendChild(emptyItem)
        }
        // mCollectionsUpload.addEventListener('click', mUploadFiles)
    }
    mCollections.appendChild(collectionsOptions)
}
/**
 * Create a memory shadow `HTMLDivElement`.
 * @requires mShadows
 * @param {Guid} itemId - The collection item id.
 * @returns {HTMLDivElement} - The shadowbox <div>.
 */
function mCreateShadows(itemId){
    let currentIndex = Math.floor(Math.random() * mShadows.length)
    const shadow = mShadows[currentIndex]
    const shadowBox = document.createElement('div')
    shadowBox.classList.add('memory-shadow')
    shadowBox.id = `memory-shadow-${ itemId }`
    shadowBox.name = 'memory-shadow'
    /* single shadow text */
    const { categories, id: shadowId, text, type, } = shadow
    const shadowText = document.createElement('div')
    shadowText.classList.add('memory-shadow-text')
    shadowText.id = `memory-shadow-text-${ itemId }_${ shadowId}`
    shadowText.textContent = text
    shadowText.addEventListener('click', mShadow)
    // @stub - add mousewheel event listener to scroll through shadows
    shadowBox.appendChild(shadowText)
    /* pagers */
    const shadowPagers = document.createElement('div')
    shadowPagers.classList.add('memory-shadow-pagers')
    shadowPagers.id = `memory-shadow-pagers_${ itemId }`
    /* back pager */
    const backPager = document.createElement('div')
    backPager.direction = 'back'
    backPager.id = `memory-shadow-back-${ itemId }`
    backPager.classList.add('caret', 'caret-up')
    backPager.addEventListener('click', _pager)
    /* next pager */
    const nextPager = document.createElement('div')
    nextPager.direction = 'next'
    nextPager.id = `memory-shadow-next-${ itemId }`
    nextPager.classList.add('caret', 'caret-down')
    nextPager.addEventListener('click', _pager)
    /* inline function _pager */
    function _pager(event){
        event.stopPropagation()
        const { direction, } = event.target
        currentIndex = direction==='next'
            ? (currentIndex + 1) % mShadows.length
            : (currentIndex - 1 + mShadows.length) % mShadows.length
        const { text, } = mShadows[currentIndex]
        shadowText.id = `memory-shadow-text-${ itemId }_${ mShadows[currentIndex].id }`
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
 * Delete collection item.
 * @async
 * @requires unsetActiveItem
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mDeleteCollectionItem(event){
    event.stopPropagation()
    const collectionItemDelete = event.target
    const id = globals.extractId(collectionItemDelete.id)
    const { id: itemId, type, } = getItem(id)
    const userConfirmed = confirm("Are you sure you want to delete this item?") /* confirmation dialog */
    if(activeItem()?.id && activeItem().id===id)
        unsetActiveItem()
    if(userConfirmed){
        const { instruction, responses, success, } = await globals.datamanager.itemDelete(id)
        if(!!instruction)
            enactInstruction(instruction, 'chat', { removeItem, })
        if(success){
            deleteItem(itemId, type)
            if(responses?.length)
                addMessages(responses, 'avatar')
        }
    } else
        collectionItemDelete.addEventListener('click', mDeleteCollectionItem, { once: true })
}
/**
 * Evaluates item with server intelligence for substance, breadth, depth and errors, conceptually, factually or grammatically, with the active bot providing feedback and suggestions for improvement.
 * @async
 * @requires globals
 * @param {Event} e - The event object
 * @returns {void}
 */
async function mEvaluate(e){
    e.stopPropagation()
    const { id: itemId, } = this.item
    if(itemId)
        setActiveItem(itemId)
    toggleMemberInput(false)
    const awaitBar = globals.await(`${ activeBot().name } is evaluating your summary...`)
    globals.addChatElement(awaitBar)
    const popupClose = document.getElementById(`popup-close-${ itemId }`)
    if(popupClose)
        popupClose.click()
    const { responses, success, } = await globals.datamanager.evaluate(itemId)
    if(responses?.length)
        addMessages(responses, activeBot().type)
    globals.expunge(awaitBar)
    toggleMemberInput(true)
}
/**
 * Initializes `mCollectionItems` with basics, including (or not) server calls to procure and populate.
 * @async
 * @requires mAvailableCollections
 * @requires mCollectionItems
 * @param {string} type - The collection type/name
 * @param {boolean} retrieve - Whether or not to retrieve data immediately from server
 * @returns {Promise<void>}
 */
async function mInitializeCollectionData(type, retrieve=false){
    if(!mAvailableCollections.includes(type))
        throw new Error(`Library collection not implemented.`)
    mCollectionItems[type] = {
        associatedBots: getBotsByForm(type).map(bot=>bot.id),
        container: null,
        default: isHighlightedCollection(type),
        id: globals.newGuid,
        init: false,
        itemContainer: null,
        items: [],
        type,
    }
    if(retrieve)
        refreshCollection(type) // no need await
}
/**
 * Refresh designated collection from server.
 * @requires mAvailableCollections
 * @requires mCollectionItems
 * @requires mCollectionItemsData
 * @param {string} type - The collection type
 * @returns {void}
 */
async function mRefreshCollection(type){
    if(!mAvailableCollections.includes(type) || !mCollectionItems[type])
        throw new Error(`Library collection not implemented.`)
    const items = await mCollectionItemsData(type)
    const collection = mCollectionItems[type]
    collection.items = items ?? []
    collection.init = true
    const { itemContainer, } = collection
    if(itemContainer instanceof HTMLElement && items.length)
        mCreateCollectionItems(type, items, itemContainer)
}
/**
 * Relive memory for an identified memory item, with optional input content to guide the relive.
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mReliveStory(event){
    event.stopPropagation()
    const { id: targetId, } = event.target
    const id = globals.extractId(targetId)
    const previousInput = document.getElementById(`relive-memory-input-container-${id}`)
    const memberInputContent = previousInput?.value
    if(previousInput)
        expunge(previousInput)
    const popupClose = document.getElementById(`popup-close-${ id }`)
    if(popupClose)
        popupClose.click()
    if(!mRelivingMemory){
        mRelivingMemory = id
        clearSystemChat()
    }
    globals.removeDisappearingElements()
    const awaitBar = globals.await(`Reliving memory with ${ activeBot().name }...`)
    globals.addChatElement(awaitBar)
    toggleMemberInput(false)
    unsetActiveItem()
    const { instruction, item, responses, success, } = await globals.datamanager.memoryRelive(id, memberInputContent)
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
        input.id = `relive-memory-input-container-${ id }`
        input.name = `input-${ id }`
        const inputClose = document.createElement('button')
        inputClose.classList.add('relive-cancel')
        inputClose.textContent = 'Cancel'
        const inputContent = document.createElement('textarea')
        inputContent.classList.add('relive-input')
        inputContent.id = `relive-memory-input-${ id }`
        inputContent.name = `relive-memory-input-${ id }`
        inputContent.placeholder = `What did I get wrong? What important details were missed? Click 'Next' to just continue...`
        const inputSubmit = document.createElement('button')
        inputSubmit.classList.add('relive-next')
        inputSubmit.id = `relive-memory-submit-${ id }`
        inputSubmit.name = `relive-memory-submit-${ id }`
        inputSubmit.textContent = mDefaultReliveMemoryButtonText
        input.appendChild(inputClose)
        input.appendChild(inputContent)
        input.appendChild(inputSubmit)
        inputClose.addEventListener('click', async e=>{
            e.stopPropagation()
            await mStopRelivingMemory(id, true)
        }, { once: true })
        inputContent.addEventListener('input', e=>{
            const value = e.target.value
            inputSubmit.textContent = (value?.length ?? 0) > 2
                ? 'update'
                : mDefaultReliveMemoryButtonText
        })
        inputSubmit.addEventListener('click', mReliveStory, { once: true })
        addInput(input)
    } else {
        toggleMemberInput(true)
        throw new Error(`Failed to fetch memory for relive request.`)
    }
}
/**
 * A memory shadow is a scrolling text members can click to get background (to include) or create content to bolster the memory. Goes directly to chat, and should minimize, or close for now, the story/memory popup.
 * @requires mShadows
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mShadow(event){
    event.stopPropagation()
    let { id: targetId, } = event.target
    const itemId = globals.extractId(targetId),
        shadowId = globals.extractId(targetId, 1)
    const item = getItem(itemId)
    const shadow = mShadows.find(shadow=>shadow.id===shadowId)
    if(!shadow || !item)
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
            addMessages(messages, activeBot().type) // print to screen
            break
        case 'member': /* member shadows populate main chat input */
            const seedText = text.replace(/(\.\.\.|…)\s*$/, '').trim() + ' '
            seedInput(itemId, shadowId, seedText, text)
            break
        default:
            throw new Error(`Unimplemented shadow type: ${ type }`)
    }
    /* close popup */
    const popupClose = document.getElementById(`popup-close-${ itemId }`)
    if(popupClose)
        popupClose.click()
}
/**
 * Closes the share panel.
 * @returns {void}
 */
function mShareClose(){
    const shareModal = document.getElementById('modal-share')
    if(shareModal)
        expunge(shareModal)
}
/**
 * Deletes the share from the server, from the item and from the DOM.
 * @param {Guid} shareId - The share id
 * @param {HTMLElement} shareElement - The share HTML element to erase
 * @returns {void}
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
        if(event.key==='Escape')
            mShareClose()
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
    shareClose.addEventListener('click', mShareClose)
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
    shareSubmitCancel.addEventListener('click', mShareClose)
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
        mShareClose()
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
function mStartDrag(event){
    event.preventDefault()
    event.stopPropagation()
    startDrag(this.closest('.collection-popup'), event)
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
 * Processes a document summary request.
 * @private
 * @async
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mSummarize(event){
    event.stopPropagation()
    const { id, } = event.target
    const itemId = globals.extractId(id)
    const item = getItem(itemId)
    if(!item)
        throw new Error(`No item found for summary request.`)
    const { id: fileId, fileName, type, } = item
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
        console.log('mSummarize::instruction::not yet implemented', instruction) // @stub - implement instruction handling
    addMessages(responses, mActiveBot.type)
    setTimeout(_=>{
        this.addEventListener('click', mSummarize, { once: true })
        this.classList.add('fa-file-circle-question')
        this.classList.remove('summarize-error', 'fa-file-circle-exclamation', 'fa-file-circle-xmark', 'fa-compass') // jic
        show(this)
    }, 20 * 60 * 1000)
}
/**
 * Toggles collection item visibility.
 * @this - collection-bar
 * @private
 * @async
 * @requires mCollectionItems
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mToggleCollectionItems(event){
    event.stopPropagation()
    /* constants */
    const { id, } = event.target
    const type = id.split('-').pop()
    const collection = mCollectionItems[type]
    const { associatedBots, container, id: collectionId, init, itemContainer, } = collection
    if(!itemContainer)
        throw new Error(`No item container found for toggle request`)
    const refreshTrigger = document.getElementById(`collection-refresh-${ type }`)
    const isRefresh = id===`collection-refresh-${ type }`
    /* functionality */
    let forceOpen
    if(!init || isRefresh){ // first click or refresh
        show(refreshTrigger)
        refreshTrigger.classList.add('spin')
        await refreshCollection(type)
            .catch(err=>{
                console.error(`Failed to refresh collection: ${ type }`, err)
                alert(`Failed to refresh collection: ${ type }`)
            })
        refreshTrigger.classList.remove('spin')
        forceOpen = true
    }
    mToggleCollections(type, forceOpen)
}
/**
 * Toggles collection visibility, closing all others if opening.
 * @private
 * @requires globals
 * @requires mCollectionItems
 * @param {string} type - The collection type to toggle
 * @param {boolean} forceOpen - Whether or not to force open the collection, defaults to `false`
 * @returns {void}
 */
function mToggleCollections(type, forceOpen=false){
    const { itemContainer, } = mCollectionItems[type]
    hide(mCollectionsDescription)
    if(globals.isHidden(itemContainer) || forceOpen) // close all others and open this
        for(const collection of Object.values(mCollectionItems))
            collection.type!==type
                ? hide(collection.itemContainer)
                : show(itemContainer)
    else {
        hide(itemContainer)
        show(mCollectionsDescription)
    }
}
/**
 * Toggles popup visibility.
 * @this - collection-item
 * @param {Event|string} event - The event object (when listener) or string (itemId when forced)
 * @returns {void}
 */
function mTogglePopup(event){
    event.stopPropagation()
    const { id: targetId, item=this.item ?? activeItem(), } = event.target
    if(!item)
        throw new Error(`No item found for popup toggle`)
    const { id, popup: populatedPopup, } = item
    if(!globals.isGuid(id))
        throw new Error(`No item found to create popup`)
    const popup = populatedPopup
        ?? document.getElementById(`popup-container-${ id }`)
        ?? mCreateCollectionItemPopup(item)
    if(!popup)
        throw new Error(`No popup created for toggle`)
    item.popup = popup
    if(popup.classList.contains('show')){
        hide(popup)
        const activeClick = targetId.includes('chat-active') && !targetId.includes('close')
        if(!activeClick) // do not deactive if clicked from active item itself
            unsetActiveItem()
    } else if(popup){
        popup.classList.add('show', 'popup-active')
        setActiveItem(id)
    }
}
/**
 * Sets collection item content.
 * @async
 * @param {Event} event - The event object
 * @returns {Boolean} - Whether or not the content was updated
 */
async function mUpdateCollectionItem(item, summaryContent){
    const { emoticons=[], id, lastUpdatedContent, } = item
    const { value: content, } = summaryContent
    if(content==lastUpdatedContent)
        return true
    const { success, } = await globals.datamanager.itemUpdate(id, content, emoticons)
    if(success)
        item.lastUpdatedContent = content
    else
        summaryContent.value = lastUpdatedContent
    return success
}
/**
 * Updates the collection item title and assigns data and listeners as required.
 * @param {Event} event - The event object
 * @returns {void}
 */
function mUpdateCollectionItemTitle(event){
    const span = event.target
    const { id: spanId, textContent, } = span
    const itemId = globals.extractId(spanId)
    /* create input */
    const input = document.createElement('input')
    const inputName = `collection-item-title-input`
    input.id = `${ inputName }-${ itemId }`
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
    input.addEventListener('blur', async ()=>{
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
export {
    activeButton,
    activeChat,
    activeClose,
    activeIcon,
    activeItem,
    activeStatus,
    activeTitle,
    createItem,
    endMemory,
    getCollection,
    getItem,
    init,
    refreshCollection,
    setActiveItem,
    togglePopup,
    unsetActiveItem,
    updateActiveItemTitle,
    updateItem,
    updateItemSummary,
    updateItemTitle,
    updateTitle,
}