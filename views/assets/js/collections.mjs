import {
    addInput,
    addMessage,
    addMessages,
    clearSystemChat,
    decorateActiveBot,
    expunge,
    globals,
    hide,
    enactInstruction,
    replaceElement,
    seedInput,
    setActiveAction,
    setActiveBot,
    show,
    submit,
    toggleBotContainers,
    toggleVisibility,
} from './members.mjs'
const mAvailableCollections = ['file'], // ['chat', 'conversation'],
    mAvailableMimeTypes = [],
    mChatActiveItem = document.getElementById('chat-active-item'),
    mChatActiveThumb = document.getElementById('chat-active-item-thumb'),
    mCollections = document.getElementById('collections-container'),
    mItems=[]
let mActiveItem,
    mCollectionsDescription, // document.getElementById('collections-description'),
    mCollectionsUpload // document.getElementById('collections-upload')
/* public functions */
/**
 * Initializes the collections by creating collection bars and setting up event listeners.
 * @param {Array} collections - list of collection types (string) to initialize (e.g., ['memory', 'entry'])
 * @param {string} title - title for the collections section (default: 'Scrapbook')
 * @returns {Promise<void>}
 */
async function init(collections, title='Scrapbook'){
    if(!mCollections)
        return
    if(Array.isArray(collections) && collections.length)
        mAvailableCollections.push(...collections)
    await mCreateCollections(mAvailableCollections, title)
}
/**
 * Gets the active item object.
 * @public
 * @returns {object} - The active item object.
 */
function activeItem(){
    return mActiveItem
}
function chatActiveItem(){
    return mChatActiveItem
}
function chatActiveThumb(){
    return mChatActiveThumb
}
/**
 * Creates a new collection item from server item object data, and activates the new summary.
 * @param {object} item - The collection item data
 * @returns {void}
 */
function createItem(itemData){
    const { id, type, } = itemData
    if(getItem(id))
        removeItem(id) // already exists, expunge
    console.log('createItem()::start', item)
    const lineItem = mCreateCollectionItem(itemData)
    const popup = mCreateCollectionPopup(itemData)
    hide(popup)
    lineItem.appendChild(popup)
    console.log('createItem()::end', item)
    const collectionList = document.getElementById(`collection-list-${ type }`)
    if(collectionList){
        collectionList.insertBefore(lineItem, collectionList.firstChild)
        registerItem(itemData, lineItem, popup)
        setActiveItem(id)
    }
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
 * Sets the active item, ex. `memory`, `entry` in the chat system for member operation(s).
 * @public
 * @requires chatActiveItem
 * @param {Guid} itemId - The item id to set as active
 * @returns {void}
 */
function setActiveItem(itemId){
    console.log('setActiveItem()::itemId', itemId)
    if(!globals.isGuid(itemId))
        return
    const popup = document.getElementById(`popup-container_${ itemId }`)
    if(!popup)
        return
    const { form='journal', title, type, } = popup.dataset
    const activeButton = document.getElementById('chat-active-item-button')
    const activeClose = document.getElementById('chat-active-item-close')
    const activeIcon = document.getElementById('chat-active-item-icon')
    const activeStatus = document.getElementById('chat-active-item-status')
    const activeTitle = document.getElementById('chat-active-item-title')
    if(activeButton)
        hide(activeButton)
    if(activeClose){
        activeClose.className = 'fas fa-times chat-active-item-close'
        activeClose.addEventListener('click', unsetActiveItem, { once: true })
    }
    if(activeIcon){
        activeIcon.className = 'fas fa-square chat-active-item-icon'
    }
    if(activeStatus){
        activeStatus.className = 'chat-active-item-status'
        activeStatus.textContent = 'Active: '
        activeStatus.addEventListener('click', mToggleItemPopup)
    }
    if(activeTitle){
        activeTitle.innerHTML = ''
        const activeText = document.createElement('div')
        activeText.classList.add('chat-active-item-title-text')
        activeText.id = `chat-active-item-title-text_${ itemId }`
        activeText.innerHTML = title
        /* append activeTitle */
        activeTitle.appendChild(activeText)
        activeTitle.className = 'chat-active-item-title'
        activeTitle.addEventListener('dblclick', updateTitle, { once: true })
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
    show(chatActiveItem)
}

/**
 * Exposed method to allow externalities to toggle a specific item popup.
 * @param {string} id - Id for HTML div element to toggle.
 
function togglePopup(id, bForceState=null){
    if(globals.isGuid(id))
        id = `popup-container_${ id }`
    const popup = document.getElementById(id)
    if(!popup)
        throw new Error(`No popup found for id: ${ id }`)
    toggleVisibility(popup, bForceState)
}*/
function togglePopup(event, collectionItem, bForceState=null){
    const item = getItem(
        globals.isGuid(event)
           ? event
           : event.target.parentElement?.id ?? event.target.id
    )
    console.log('togglePopup()::item', item, collectionItem)
    const { id, } = item
    const popupId = id.split('_').pop()
    const popup = document.getElementById(`popup-container_${ popupId }`)
    if(!popup) return
    if(popup.classList.contains('show')){
        hide(popup)
        unsetActiveItem()
        return
    }
    show(popup)
    setActiveItem(popupId)
}
/**
 * Unsets the active item in the chat system.
 * @public
 * @requires mChatActiveItem
 * @returns {void}
 */
function unsetActiveItem(){
    mActiveItem = null
    hide(mChatActiveItem)
}
/**
 * Updates the active item title in the chat system, display-only.
 * @public
 * @param {Guid} itemId - The item ID
 * @param {string} title - The title to set
 * @returns {void}
 */
function updateActiveItemTitle(itemId, title){
    const chatActiveItemTitle = document.getElementById(`chat-active-item-title-text_${ itemId }`)
    const id = mActiveItem?.id
    if(id!==itemId)
        throw new Error('updateActiveItemTitle::Error()::`itemId`\'s do not match')
    chatActiveItemTitle.innerHTML = title
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
/* private functions */
/**
 * Initializes the collections by creating collection bars and setting up event listeners.
 * It checks for available collections and associated bots, and updates the collection list accordingly.
 * @private
 * @requires mCollections
 * @param {Array} collections - list of collection types (string) to initialize (e.g., ['memory', 'entry'])
 * @param {string} title - title for the collections section (default: 'Scrapbook')
 * @returns {Promise<void>}
 */
async function mCreateCollections(collections, title){
    /* container */
    if(!mCollections)
        return
    /* header */
    mCollections.addEventListener('click', toggleBotContainers)
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
    collectionsOptions.appendChild(collectionsDescription)
    const collectionsContainer = document.createElement('div')
    collectionsContainer.id = 'collections-collections'
    collectionsContainer.className = 'collections'
    collectionsOptions.appendChild(collectionsContainer)
    /* scrapbook (collections) */
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
    if(mCollectionsUpload)
        mCollectionsUpload.addEventListener('click', mUploadFiles)
    mCollections.appendChild(collectionsOptions)
}
export {
    activeItem,
    chatActiveItem,
    chatActiveThumb,
    createItem,
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