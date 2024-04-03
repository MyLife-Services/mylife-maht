/* constants */
const backstage = document.getElementById('experience-backstage'),
    breadcrumb = document.getElementById('experience-breadcrumb'),
    cast = document.getElementById('experience-cast'),
    closeButton = document.getElementById('experience-close'),
    description = document.getElementById('experience-description'),
    footer = document.getElementById('experience-footer'),
    inputLane = document.getElementById(`experience-input`),
    mainstage = document.getElementById('experience-mainstage'),
    moderator = document.getElementById('experience-moderator'),
    moderatorIcon = document.getElementById('experience-moderator-icon'),
    moderatorDialog = document.getElementById('experience-moderator-dialog'),
    moderatorProps = document.getElementById('experience-moderator-props'),
    navigation = document.getElementById('experience-navigation'),
    sceneContinue = document.getElementById('experience-continue'),
    sceneContinueText = document.getElementById('experience-continue-text'),
    sceneStage = document.getElementById('experience-scenestage'),
    screen = document.getElementById('experience-modal'),
    skip = document.getElementById('experience-skip'),
    stage = document.getElementById('experience-stage'),
    start = document.getElementById('experience-start'),
    startButton = document.getElementById('experience-start-button'),
    startSpinner = document.getElementById('experience-start-spinner'),
    title = document.getElementById('experience-title'),
    transport = document.getElementById('experience-transport')
/* variables */
let mBackdrop, // enum: [chat, interface, full]; default: full
    mBackdropDefault = 'full',
    mEvent,
    mExperience,
    mLoading = true,
    mMainstagePrepared = false,
    mModerator,
    mWelcome = true
/* public functions */
/**
 * End experience on server and onscreen.
 * @public
 * @async
 * @returns {Promise<void>} - The return is its own success, having cleared all active experience data.
 */
async function experienceEnd(){
    /* end experience on server */
    const endExperience = await mEndServerExperience()
    console.log('experienceEnd::endExperience', endExperience)
    if(!endExperience)
        throw new Error("Could not end experience on server!")
    console.log('experienceEnd::experience ended', mExperience)
    mExperience = null
    /* end experience onscreen */
    mExperienceClose()
}
/**
 * Play experience onscreen, mutates `mExperience` object.
 * @public
 * @async
 * @requires mExperience
 * @param {Object} memberInput - Member Input in form of object.
 * @returns {Promise<void>} - The return is its own success.
 */
async function experiencePlay(memberInput){
    if(!mExperience)
        throw new Error("Experience not found!")
    let events
    if(!mWelcome){
        events = await mEvents(memberInput)
    } else {
        mStageTransition()
        events = mExperience.events
            ?? await mEvents() // use any pre-filled defaults from fetch
        console.log('experiencePlay::mExperience', mExperience)
        mWelcome = false
    }
    /* prepare mainstage */
    if(!events?.length)
        throw new Error("No events found")
    mExperience.events = mExperience.events
        .map(event=>{
            return events.find(_event => _event.id === event.id)
                ?? event
        })
    const newEvents = events.filter(incEvent=>!mExperience.events.some(event => event.id === incEvent.id))
    mExperience.events = [...mExperience.events, ...newEvents]
    const characters = [...new Set(events.map(event=>event.character?.characterId).filter(Boolean))] // unique characters over current events
    mUpdateCharacters(characters)
    /* mainstage action */
    const animationSequence = []
    events
        .sort((eA, eB)=>eA.order - eB.order)
        .forEach(event=>{
            mEvent = event
            animationSequence.push(
                ...mEventStage(),
                ...mEventCharacter(),
                ...mEventDialog(),
                ...mEventInput()
            )
        })
    /* play experience */
    mShow(stage) // brute force
    switch(mBackdrop){
        case 'interface':
            // interface keeps all elements of the interface, and full control given to experience
        case 'chat':
            // chat refers to control over system-chat window experience only
        case 'full':
        default:
            if(!await mAnimateEvents(animationSequence))
                throw new Error("Animation sequence failed!")
            break
    }
}
/**
 * Skips a skippable scene in Experience.
 * @public
 * @returns {void}
 */
function experienceSkip(){
    console.log('experienceSkip::skipping experience', mExperience)
}
/**
 * Start experience onscreen, displaying welcome ande loading remaining data.
 * @public
 * @param {Guid} experience - The Experience object.
 * @returns {Promise<void>} - The return is its own success.
 */
async function experienceStart(experience){
    /* load experience data */
    mExperience = experience
    /* present stage */
    mStageWelcome()
    mInitListeners()
    const { description, events: _events=[], id, name, purpose, title, skippable=false } = mExperience
    mExperience.events = (_events.length) ? _events : await mEvents()
    /* experience manifest */
    const manifest = await mManifest(id)
    if(!manifest)
        throw new Error("Experience not found")
    if(!Array.isArray(manifest.cast)) // cast required, navigation not required
        throw new Error("Experience cast not found")
    mExperience = { ...mExperience, ...manifest }
    mLoading = false
    /* welcome complete */
    /* display experience-start-button */
    mUpdateStartButton()
}
/* private functions */
/**
 * Animate an element based on the animation event object.
 * @todo - remove requirement for `animationend` specifically, to allow for non animation-based events to have callbacks.
 * @private
 * @param {Object} animationEvent - The animation event data object.
 * @param {HTMLElement} element - The element to animate.
 * @returns {Promise} - The return is the promise that requires resolution in order to fire.
 */
function mAnimateElement(animationEvent, element) {
    return new Promise((resolve, reject) => {
        const { action, animation, dismissable, elementId, halt, type, } = animationEvent
        if(!element)
            return reject(new Error(`Element not found: ${animationEvent.elementId}`))
        const { animationClass, animationDelay, animationDirection, animationDuration, animationIterationCount } = animation ?? { animationClass: 'animate' }
        element.classList.add(animationClass)
        element.style.animationFillMode = 'forwards'; // Ensure final state is kept
        if(animationDelay)
            element.style.animationDelay = `${animationDelay}s`
        if(animationDirection)
            element.style.animationDirection = animationDirection
        if(animationDuration)
            element.style.animationDuration = `${animationDuration}s`
        if(animationIterationCount)
            element.style.animationIterationCount = animationIterationCount
        const handleAnimationEnd = ()=>{
            element.removeEventListener('animationend', handleAnimationEnd)
            resolve()
        }
        element.addEventListener('animationend', handleAnimationEnd)
        if(dismissable){
            const fastForwardAnimation = () => { // Skip to the end of the animation
                element.removeEventListener('animationend', handleAnimationEnd)
                element.classList.remove(animationClass)
                element.classList.add(`${animationClass}-final`)
                resolve()
            }
            // Add event listeners for dismissible actions
            document.addEventListener('click', fastForwardAnimation, { once: true })
            document.addEventListener('keydown', event=>{
                const { code } = event
                if(['space', 'escape', 'esc', 'enter'].includes(code.toLowerCase()))
                    fastForwardAnimation()
            }, { once: true })
        }
        mShow(element)
    })
}
/**
 * Callback function for ending an animation. Currently only stops propagation.
 * @private
 * @param {Animation} animation - The animation object.
 * @param {function} callbackFunction - The listener function, defaults to `mAnimationEnd`.
 * @returns {void}
 */
function mAnimationEnd(animation, callbackFunction){
    animation.stopPropagation()
    if(callbackFunction)
        callbackFunction(animation)
    // @stub - add animation sequence alterations? rewind?
}
/**
 * Animate a sequence of elements based on the incoming array of animation instructions.
 * @param {Object[]} animationSequence - Array of animation events to be played.
 * @returns {Promise<boolean>} - Success or failure of the animation sequence.
 */
async function mAnimateEvents(animationSequence){
    for(const animationEvent of animationSequence){
        const { elementId } = animationEvent
        const element = document.getElementById(elementId)
        if(!element){
            console.log('experiencePlay::ERROR::element not found', elementId)
            continue
        }
        try {
            if( // skip if already shown or hidden, move variants or other animations, may have more than one
                    animationEvent.action==='appear' && element.classList.contains('show')
                ||  animationEvent.action==='disappear' && !element.classList.contains('show')
            )
                continue
            await mAnimateElement(animationEvent, element)
            if(animationEvent.halt && !animationEvent.dismissable){
                await mWaitForUserAction() // This function would also return a Promise
            }
        } catch(error) {
            console.error('experiencePlay::animation error:', error)
            return false
        }
    }
    return true
}
/**
 * Assigns icon image for Character/Avatar/Moderator.
 * @todo - add click event listener to icon
 * @todo - Character type implementation
 * @private
 * @param {string} character - The character object.
 * @param {HTMLDivElement} element - The HTML element to assign icon to.
 * @returns {void}
 */
function mAssignIcon(character, element=document.getElementById(`experience-moderator-icon`)){
    if(!element)
        throw new Error(`Element not found!`)
    const { bot_id, icon, id: characterId, role, type, url, } = character
    const existingImage = element.querySelector('img')
    const iconId = `icon-image-${characterId}`
    if(existingImage && existingImage.id===iconId)
        return
    if(existingImage)
        element.removeChild(existingImage)
    // Create a new image and set its properties
    const newImage = document.createElement('img')
    let errorTriggered = false
    newImage.onerror = err=>{
        if (!errorTriggered) {
            newImage.src = `../png/experience-icons/system/icon.png`
            errorTriggered = true
        }
    }
    newImage.alt = `Icon for avatar (or moderator), requesting: ${icon}`
    newImage.id = iconId
    newImage.src = mImageSource(icon, type)
    newImage.title = `Avatar Icon`
    return newImage
}
/**
 * Create a dialog box for event and assign to character.
 * @private
 * @returns 
 */
function mCreateCharacterDialog(){
    const dialogDiv = document.createElement('div')
    dialogDiv.id = `char-dialog-${mEvent.id}`
    dialogDiv.name = `dialog-${mEvent.id}`
    // set random type (max 3)
    const dialogType = Math.floor(Math.random() * 3) + 1
    dialogDiv.textContent = mEvent.dialog.dialog
    dialogDiv.classList.add('char-dialog-box')
    dialogDiv.classList.add(`dialog-type-${dialogType}`)
    return dialogDiv
}
/**
 * Create a lane for a character. Note: might not even in the end need background to be delivered from server, icon, role, all of this character data can be modified EVENT BY EVENT in order for thrillers, etc. in other words, cast data updates as the play goes on, should event data contain it. Love it!
 * @todo - props as per stub below.
 * @stub - props are clickables related to an character - essentially can be anywhere from nonsentient -> intelligenced by bot
 * @private
 * @param {Object} character - The character object.
 * @property {Guid} bot_id - The bot id from Cosmos, _not_ LLM.
 * @property {string} icon - The character's icon.
 * @property {Guid} id - The character's id in cast.
 * @property {string} role - The character's role.
 * @property {string} type - The character's type.
 * @returns {HTMLDivElement} - The character lane div to be attached where it must.
 */
function mCreateCharacterLane(character){
    const { bot_id: actorBotId, id: characterId, role, type, } = character
    let { icon, url, } = character
    const characterDiv = document.createElement('div')
    characterDiv.id = `char-lane-${characterId}`
    characterDiv.name = `${role}-${characterId}`
    if(url?.length){
        if(!url.includes('http://')){
            const imageType = url.includes('.')
                ? url.split('.').pop()
                : 'png'
            url = url.includes('.')
                ? url
                : `${url}.${imageType}`
            url = `../${imageType}/experience-art/` + url
        }
        // any below can be overidden by event
        characterDiv.style.backgroundImage = `url(${url})`
        characterDiv.style.backgroundSize = '100% auto'
        characterDiv.style.backgroundRepeat = 'space'
        characterDiv.style.backgroundPosition = 'right'
    }
    characterDiv.classList.add('char-lane')
    const characterIconDiv = document.createElement('div'),
        characterIconImageDiv = document.createElement('div'),
        characterIconTextDiv = document.createElement('div')
    characterIconDiv.id = `char-icon-${characterId}`
    characterIconDiv.name = `char-icon-${characterId}`
    characterIconDiv.classList.add('char-icon')
    characterIconImageDiv.id = `icon-image-${characterId}`
    characterIconImageDiv.name = `icon-image-${characterId}`
    characterIconImageDiv.classList.add('char-icon-image')
    characterIconTextDiv.id = `icon-text-${characterId}`
    characterIconTextDiv.name = `icon-text-${characterId}`
    characterIconTextDiv.classList.add('char-icon-text')
    /* assign image and text */
    const newImage = mAssignIcon(character, characterIconImageDiv)
    characterIconImageDiv.appendChild(newImage)
    characterIconTextDiv.textContent = role
    characterIconDiv.appendChild(characterIconImageDiv)
    characterIconDiv.appendChild(characterIconTextDiv)
    console.log('characterIconDiv::before append', characterIconDiv)
    characterDiv.appendChild(characterIconDiv)
    let characterDialogDiv = document.createElement('div')
    characterDialogDiv.id = `char-dialog-${characterId}`
    characterDialogDiv.name = `dialog-${characterId}`
    characterDialogDiv.classList.add('char-dialog')
    characterDiv.appendChild(characterDialogDiv)
    console.log('characterIconDiv::after append', characterDiv, characterIconDiv)
/* props
    @stub
    let characterPropsDiv = document.createElement('div')
    characterPropsDiv.id = `char-props-${characterId}`
    characterPropsDiv.classList.add('char-props')
    characterDiv.appendChild(characterPropsDiv)
*/
    return characterDiv
}
/**
 * Create a moderator prompt to elicit member input.
 * @todo - incorporate a `.prop` function (answering machine?) that allows for auto-answering on member behalf.
 * @private
 * @requires mEvent - Event object.
 * @returns {HTMLDivElement} - The moderator input prompt div.
 */
function mCreateModeratorInputPrompt(){
    const { inputId: id, inputPlaceholder, inputShadow, inputType: type } = mEvent.input
    const inputPromptDiv = document.createElement('div')
    inputPromptDiv.id = `prompt-${id}`
    inputPromptDiv.classList.add('char-dialog-box')
    inputPromptDiv.classList.add('dialog-type-moderator')
    inputPromptDiv.textContent = inputShadow ?? inputPlaceholder ?? `Type in your response below.`
    const spinnerDiv = document.createElement('div')
    spinnerDiv.id = `spinner-${id}`
    spinnerDiv.classList.add('spinner')
    inputPromptDiv.appendChild(spinnerDiv)
    return inputPromptDiv
}
/**
 * End experience on server.
 * @private
 * @async
 * @returns {Promise<boolean>} - Success or failure of the server request.
 */
async function mEndServerExperience(){
    const response = await fetch(`/members/experience/${mExperience.id}/end`, {
        method: 'PATCH',
    })
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    return await response.json()
}
/**
 * Reads character data for an event and prepares animation sequence.
 * @private
 * @requires mEvent - The current event object.
 * @returns {Object[]} - Array of animation objects.
 */
function mEventCharacter(){
    const { character: characterData, } = mEvent
    console.log('mEventCharacter::characterData', characterData)
    const animationSequence = []
    if(characterData){
        const { animation, animationDirection, animationDelay, animationDuration, animationIterationCount, characterId, name, prompt, role, sfx, stageDirection, type, } = characterData
        const character = mExperience.cast.find(character=>character.id === characterId)
        if(!character)
            throw new Error(`Character not found in cast! ${characterId}`)
        /* update `name` and `role` */
        if(role){
            character.role = role
            document.getElementById(`icon-text-${characterId}`).textContent = role
        }
        if(name)
            character.name = name
        /* animate character */
        const characterLane = document.getElementById(`char-lane-${characterId}`)
        if(!characterLane)
            throw new Error(`Character lane not found! ${characterId}`)
        const animationDetails = {
            animationClass: animation ?? 'slide-in',
            animationDelay: animationDelay ?? 0,
            animationDirection: animationDirection ?? 'forwards',
            animationDuration: animationDuration ?? 1,
            animationIterationCount: animationIterationCount ?? 1,
        }
        /* execute stage Direction */
        switch(stageDirection){
            case 'action':
            case 'move':
                throw new Error(`Stage direction not implemented: ${stageDirection}`) // @stub - add dynamic css stage direction
            case 'disappear':
                mHide(characterLane)
                break
            case 'appear':
            default:
                // push appearance/animation of character lane
                animationSequence.push({
                    action: 'appear',
                    // class: '', /* @stub - add dynamic css stage direction */
                    animation: animationDetails,
                    dismissable: false, /* click will dismiss animation */
                    elementId: `char-lane-${characterId}`,
                    halt: false, /* requires next in animationSequence to await for this completion, default=true */
                    type: 'character',
                })
                break
        }
        /* character sfx (and ultimately a/v+?) */
        if(sfx?.length){
            // @stub - add special effects to icon
            // @todo - push char-icon animation (sfx)
            // @todo - push char-text animation
        }
    }
    return animationSequence
}
/**
 * Reads dialog data for an event and prepares animation sequence.
 * @private
 * @requires mEvent - The current event object.
 * @returns {Object[]} - Array of animation objects.
 */
function mEventDialog(){
    const { character, dialog, } = mEvent
    const animationSequence = []
    if(!dialog || !Object.keys(dialog).length)
        return animationSequence
    const { characterId } = character
    const characterDialog = document.getElementById(`char-dialog-${characterId}`)
    if(!characterDialog)
        throw new Error(`Character dialog not found! ${characterId}`)
    const dialogDiv = mCreateCharacterDialog()
    characterDialog.prepend(dialogDiv)
    const { animationDirection, animationDelay, animationDuration, animationIterationCount, effect, } = dialog
    let { animation, } = dialog
    if(animation)
        animation = {
            animationClass: animation,
            animationDelay: animationDelay ?? 0,
            animationDirection: animationDirection ?? 'forwards',
            animationDuration: animationDuration ?? 1,
            animationIterationCount: animationIterationCount ?? 1,
        }
    else animation = { animationClass: 'dialog-fade' }
    animationSequence.push({
        action: 'appear',
        animation,
        dismissable: true, /* click will fast-forward animation */
        effect,
        elementId: dialogDiv.id,
        halt: true, /* requires next in animationSequence to await its completion */
        type: 'dialog',
    })
    return animationSequence
}
/**
 * Reads input data for an event and prepares animation sequence.
 * @todo - create subfunctions for much of this below, in stage painting for hard-objects like moderator and input
 * @private
 * @requires mEvent - The current event object.
 * @returns {Object[]} - Array of animation objects.
 */
function mEventInput(){
    const { id: eventId, input, } = mEvent
    const animationSequence = []
    if(!input)
        return animationSequence
    const { complete, failure, followup, inputId: id, inputPlaceholder, inputType: type, variables, } = input
    if(complete) // @stub - if complete, do not re-render? determine reaction; is it replay?
        return
    let { variable, } = input
    /* moderator lane is puppeteer, must become visible */
    moderatorDialog.prepend(mCreateModeratorInputPrompt())
    /* remove all sub-nodes on inputLane */
    while(inputLane.firstChild)
        inputLane.removeChild(inputLane.firstChild)
    /* add input to inputLane */
    switch(type){
        case 'text':
        default:
            const inputField = document.createElement('textarea')
            inputField.classList.add('input-text')
            inputField.id = `input-${id}`
            inputField.name = `input-${id}`
            inputField.placeholder = inputPlaceholder ?? `What do _you_ think?`
            inputField.rows = 3 // for textarea calculations
            inputLane.appendChild(inputField)
            // @todo - change submit button to prop?
            const submitButton = document.createElement('button')
            submitButton.id = `submit-${id}`
            submitButton.name = `submit-${id}`
            submitButton.textContent = 'Reply'
            submitButton.type = 'button' // Change type to 'button'
            submitButton.classList.add('input-submit')
            submitButton.addEventListener('click', (event) => {
                event.preventDefault() // Prevent the default form submission
                mHide(submitButton) // Hide the submit button (if not already hidden)
                const eventContinue = mSubmitInput(inputField)
                if(!eventContinue)
                    mShow(submitButton) // Show the submit button again
                else
                    mHide(moderator) // Hide the moderator element entirely
            }, { once: true })
            inputLane.appendChild(submitButton)
            inputField.addEventListener('input', ()=>{ // Show the submit button when the user starts typing
                inputField.value.trim()
                    ? mShow(submitButton)
                    : mHide(submitButton)
            })
            break
    }
    // @stub - variables are not yet implemented, but could be used for internal fills, checks/balances, like cast
    animationSequence.push({ /* moderator */
        action: 'appear',
        animation: {
            animationClass: 'slide-up',
            animationDelay: 0,
            animationDirection: 'forwards',
            animationDuration: 1,
            animationIterationCount: 1,
        },
        dismissable: true, /* click will fast-forward animation */
        effect: undefined,
        elementId: moderator.id,
        halt: false, /* requires next in animationSequence to await its completion */
        type: 'moderator',
    },{ /* moderatorDialog */
        action: 'appear',
        animation: undefined,
        dismissable: true, /* click will fast-forward animation */
        effect: undefined,
        elementId: `prompt-${eventId}`,
        halt: false, /* next in animationSequence must await its completion */
        type: 'moderator',
    },{ /* moderatorIcon */
        action: 'appear',
        animation: undefined,
        dismissable: true, /* click will fast-forward animation */
        effect: undefined,
        elementId: `experience-moderator-icon`,
        halt: false, /* requires next in animationSequence to await its completion */
        type: 'moderator',
    },{ /* input elements */
        action: 'appear',
        animation: { animationClass: 'slide-up' },
        dismissable: false, /* click will fast-forward animation */
        effect: undefined,
        elementId: inputLane.id,
        halt: false, /* requires next in animationSequence to await its completion */
        type: 'input',
    })
    return animationSequence
}
/**
 * Initialize experience events.
 * @private
 * @async
 * @param {object} memberInput - Member Input in form of object.
 * @returns {void}
 */
async function mEvents(memberInput){
    const response = await fetch(`/members/experience/${mExperience.id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: memberInput ? JSON.stringify(memberInput) : null,
    })
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    const { events } = await response.json()
    return events ?? []
}
/**
 * Reads stage data for an event and prepares animation sequence.
 * @todo - deprecated, heritage check.
 * @private
 * @requires mEvent - The current event object.
 * @returns {Object[]} - Array of animation objects.
 */
function mEventStage(){
    const { action, stage, type, } = mEvent
    const animationSequence = []
    if(stage && Object.keys(stage).length){
        const { backdrop=mBackdropDefault, click, type: stageType } = stage
        /* animate stage */
        if((stageType ?? 'script')!==`script`) // enum: [script, prompt, ...?]
            throw new Error(`Stage type not implemented: ${stageType}`) // @stub - add dynamic css stage direction
        if(!mBackdrop || backdrop !== mBackdrop){
            // may need to revisit experience start and route it through here
            console.log('mEventStage::backdrop', backdrop, mBackdrop)
            mBackdrop = backdrop
            mSceneTransition() // hide mainstage
            mHide(stage)
            // @todo - push backdrop animation
        }
        if(click){
            animationSequence.push({
                action: 'click',
                // class: '', /* @stub - add dynamic css stage direction */
                // animation: '', /* @stub - add dynamic css stage direction */
                dismissable: true, /* click will dismiss animation */
                elementId: 'experience-continue',
                halt: true, /* requires next in animationSequence to await its completion */
                type: 'stage',
            })
        }
    }
    if(action==='end'){
        const { type, } = mEvent
        console.log('mEventStage::end', mEvent)
        sceneContinueText.textContent = `End of ${ type }: ` + mEvent.title
        sceneContinue.classList.add('slide-down')
        mShow(sceneContinue, ()=>{
            console.log('mEventStage::end::show', sceneContinue)
            mWaitForUserAction()
                .then(response=>{
                    console.log('mEventStage::end', response)
                    sceneContinue.classList.add('slide-up')
                    mHide(sceneContinue)
                    switch(type){
                        case 'experience':
                            /* close show */
                            experienceEnd()
                            return
                        case 'scene':
                            /* play next scene */
                            experiencePlay() // next scene should be auto-loaded on server
                            return [] // @todo - unclear if should not return or put case in ePlay to avoid? [i.e., it has now been handed off to a _different_ instantion of ePlay]
                    }
                })
                .catch(err=>{
                    console.log('mEventStage::end ERROR', err.stack)
                })
        })

    }
    return animationSequence
}
/**
 * Close experience onscreen.
 * @private
 * @returns {void}
 */
function mExperienceClose(){
    mHide(screen)
    /* remove listeners */
    closeButton.removeEventListener('click', mExperienceClose)
    skip.removeEventListener('click', experienceSkip)
    startButton.removeEventListener('click', experiencePlay)
}
/**
 * Hides an element, pre-executing any included callback function.
 * @private
 * @param {HTMLElement} element - The element to hide.
 * @param {function} callbackFunction - The callback function to execute after the element is hidden.
 */
function mHide(element, callbackFunction){
    element.classList.remove('show')
    if(element.getAnimations().length){
        element.addEventListener('animationend', function() {
            element.classList.add('hide')
        }, { once: true }) // The listener is removed after it's invoked
    }
    // element.style.animation = 'none' /* stop/rewind all running animations */
    if(callbackFunction)
        callbackFunction()
    element.classList.add('hide')
}
/**
 * Returns the presumed source of an image based on type and icon data.
 * @private
 * @param {string} icon - The character icon link text.
 * @param {string} type - The character type.
 * @returns 
 */
function mImageSource(icon, type){
    if(icon.includes('http')) return icon
    let iconFile = icon.split('/').pop()
    const iconName = iconFile.split('.').shift().toLowerCase() ?? type
    const iconExtension = iconFile.split('.').length > 1
        ? iconFile.split('.').pop().toLowerCase()
        : 'png'
    iconFile = `../${iconExtension}/experience-icons/system/${iconName}.${iconExtension}` // @stub - add path to individual contributions or uploaded files
    return iconFile
}
/**
 * Initialize experience listeners.
 * @private
 * @returns {void}
 */
function mInitListeners(){
    if(mExperience.skippable)
        closeButton.addEventListener('click', experienceEnd)
    skip.addEventListener('click', experienceSkip)
    startButton.addEventListener('click', experiencePlay)
    return
}
/**
 * Whether the character is the personal-avatar.
 * @private
 * @param {string} type - The character type.
 * @returns {boolean} - Whether the character is the personal-avatar.
 */
function mIsAvatar(type){
    const avatarList = ['avatar', 'personal-avatar', 'member-ai', 'member-bot']
    return avatarList.some(item => item === type.trim().toLowerCase()) 
}
/**
 * Whether the character is a member.
 * @private
 * @param {string} type - The character type.
 * @returns {boolean} - Whether the character is a member.
 */
function mIsMember(type){
    const memberList = ['member', 'user']
    return memberList.some(item => item === type.trim().toLowerCase())
}
/**
 * Gets the manifest of the Experience.
 * @private
 * @async
 * @param {Guid} id - The Experience object id.
 * @returns {Promise<Experience>} - The Experience object.
 */
async function mManifest(id) {
    try {
        const response = await fetch(`/members/experience/${id}/manifest`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            // body: JSON.stringify({}),
        })
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`)
        }

        return await response.json()
    } catch (error) {
        console.log('mManifest::Error()', error)
        return null
    }
}
/**
 * Scene-end transition(s). Currently just hide.
 * @private
 * @returns {void}
 */
function mSceneTransition(){
    switch(mBackdrop){
        case 'interface':
            // keep experience bar, overlay main menu
            mHide(stage) // brute force
            // in interface mode, icons and characters are no longer lanes, but instead objects that get painted to the chat portion of the window, they can still maintain iconography and color for dialog
            // disable or send back data back to main interface
            break
        case 'full':
        default:
            mMainstagePrepared = false
            mHide(mainstage) // brute force
            break
    }
    console.log('mSceneTransition::scene transition', mBackdrop)
}
/**
 * Last stop before Showing an element and kicking off animation chain. Adds universal run-once animation-end listener, which may include optional callback functionality.
 * @private
 * @param {HTMLElement} element - The element to show.
 * @param {function} listenerFunction - The listener function, defaults to `mAnimationEnd`.
 * @returns {void}
 */
function mShow(element, listenerFunction){
    element.addEventListener('animationend', animationEvent=>mAnimationEnd(animationEvent, listenerFunction), { once: true })
    if(!element.classList.contains('show')){
        element.classList.remove('hide') // courtesy, shouldn't exist
        /* **note**: do not remove or rewind animations, as classList additions fail to fire */
        element.classList.add('show')
    }
}
/**
 * Introduces the concept of an Experience to the member.
 * @private
 * @requires mExperience - The Experience object.
 * @returns {void}
 */
function mStageWelcome(){
    const { description: experienceDescription, name: experienceName, title: experienceTitle, } = mExperience
    breadcrumb.innerHTML = `Experience: ${experienceName}`
    title.textContent = experienceTitle ?? experienceName ?? `Untitled Production`
    if(experienceDescription?.length)
        description.textContent = experienceDescription
    mShow(transport)
    mShow(footer)
    screen.addEventListener('animationend', animation=>{
        animation.stopPropagation()
        mShow(backstage, animation=>{
            mShow(start)
        })
    }, { once: true })
    screen.classList.add('modal-screen')
}
/**
 * Closes the welcome stage (backstage) and opens mainstage.
 * @private
 * @returns {void}
 */
function mStageTransition(){
    // @stub - add property or 'prop' to moderator as a button that says: `answer for me`
    const characters = mExperience.cast.filter(character=>{
        const { type, } = character
        return !(mIsAvatar(type) || mIsMember(type))
    })
    /* set initial moderator */
    mUpdateModerator()
    /* add character lanes */
    characters.forEach(character=>{
        const characterLane = mCreateCharacterLane(character)
        if(characterLane){
            // mHide(characterLane)
            sceneStage.appendChild(characterLane)
        }
    })
    /* animate backstage removal */
    mHide(backstage)
    mainstage.classList.add('appear') // requires animation to trigger others
    mShow(mainstage, mainstageAnimation=>{
        mainstageAnimation.stopPropagation()
        /* final mainstage preparations */
        console.log('mStageTransition::mainstageAnimation', mainstageAnimation)
        mMainstagePrepared = true
    })
}
/**
 * Submits experience member input to the server. **Note**: This function is not yet implemented.
 * @todo - deprecate `variable` in favor of `inputVariableName` on backend.
 * @todo - case for click-reponse only to forward (scene end) [although that should be in stage directions?]
 * @private
 * @requires mEvent - The current event object.
 * @param {HTMLInputElement} input - The member input element.
 */
function mSubmitInput(input){
    const { id: eventId, input: eventInput, } = mEvent
    const { value, } = input
    const { inputVariableName, variable } = eventInput
    let eventContinue = false
    if(value.length){
        const memberInput = { [inputVariableName ?? variable]: value }
        experiencePlay(memberInput)
            .catch(err=> console.log('mSubmitInput::experiencePlay independent fire ERROR', err.stack, err, memberInput))
        eventContinue = true
    }
    return eventContinue
}
/**
 * Receives a list of characters and performs any updates upon the char-lane objects required, show, hide, effects, icon-change, name-change, etc.
 * @modular
 * @requires mExperience - populated, not undefined; create prior to this function.
 * @param {Object[]} characters - Array of character objects.
 * @returns {void}
 */
function mUpdateCharacters(characters){
    const { cast, } = mExperience
    characters.forEach(characterId=>{
        const character = cast.find(member=>member.id === characterId)
        if(!character)
            throw new Error(`Character not found in cast! ${characterId}`)
        const { id, type='' } = character
        switch(type.toLowerCase()){
            case 'bot':
                break
            case 'avatar':
            case 'member':
            case 'member-ai':
            case 'member-bot':
            case 'personal-avatar':
                /* update (if not visible, always-extant) moderator lane */
                mUpdateModerator()
                moderator.classList.add('slide-up')
                mShow(moderator)
                // update dialog ?
                break
            case 'actor':
            case 'q':
            case 'system':
            default:
                const characterLane = document.getElementById(`char-lane-${id}`)
                if(!characterLane)
                    throw new Error(`Character lane not found! ${id}`)
                sceneStage.appendChild(characterLane)
                if(!sceneStage.contains(characterLane)) // thanks for generating!
                    sceneStage.appendChild(characterLane)
                break
        }
    })
}
/**
 * Updates the moderator lane.
 * @requires mModerator - populated, not undefined; create prior to this function.
 * @returns {void}
 */
function mUpdateModerator(){
    if(!mModerator)
        mModerator = mExperience.cast.find(character=>mIsAvatar(character.type))
    moderatorIcon.appendChild( mAssignIcon(mModerator) )
    /* initialize member input */
    // @stub - unclear if required or base css is sufficient, as modified on mInput
}
/**
 * Displays the `Welcome` start button, completing instantly all backstage animations.
 * @modular
 */
function mUpdateStartButton(){
    // stop all animations running
    backstage.style.animation = 'none'
    startSpinner.classList.add('fade-out')
    startButton.textContent = 'click me'
    startButton.classList.add('pulse')
    mHide(startSpinner, animation=>{
        console.log('mUpdateStartButton::hide spinner show button', animation, startButton.classList)
        mShow(startButton)
    })
}
/**
 * Waits for user action.
 * @private
 * @returns {Promise<void>} - The return is its own success.
 */
function mWaitForUserAction(){
    return new Promise((resolve)=>{
        // wait for a click event and/or some other condition
        document.addEventListener('click', ()=>{resolve()}, { once: true })
    })
}
/* exports */
export {
    experienceEnd,
    experiencePlay,
    experienceSkip,
    experienceStart,
}
/* end notes
===============================================================================
this module presumes all frontend mode-locking has been done by importer.
*/