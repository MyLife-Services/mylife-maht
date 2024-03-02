/* experience modular constants */
const mAvailableEventActionMap = {
    appear: {
        effects: ['fade', 'spotlight'],
    },
    dialog: {
        effects: ['spotlight'],
        types: ['script', 'prompt'],
    },
    input: {},
}
/* experience modular functions */
function mAppear(event){
    const { id, type, data: eventData } = event
    return
}
/**
 * From an event, returns a `synthetic` Dialog data package, see JSDoc properties.
 * @modular
 * @public
 * @param {Experience} _experience - Experience class instance.
 * @param {number} iteration - Iteration number, defaults to first (array zero format).
 * @returns {Dialog} - `synthetic` Dialog data package.
 * @property {number} currentIteration - Current iteration number.
 * @property {string} dialog - Dialog string.
 * @property {string} example - Example string.
 * @property {Guid} id - Event id.
 * @property {string} type - Dialog type.
 * @property {number} maxIterations - Maximum iterations.
 * @property {number} minIterations - Minimum iterations.
 * @property {string} prompt - Prompt string.
 * @property {string} variable - Variable name.
 * @property {array} variables - Variable names.
 */
function mDialog(event, iteration=0){
    /* validate */
    const { data: eventData, id, type, maxIterations, minIterations, variable, variables=[] } = event
    if(!mAvailableEventActionMap.dialog.types.includes(type))
        throw new Error(`mDialog: event.type must be one of ${mAvailableEventActionMap.dialog.types.join(', ')}`)
    // **note**: `prompt` and `dialog` variables can be array or string, here converted to string if array; once iterations pass content limit, it reverts to beginning; avatar will manage iteration _logic_ this only provides its best approximation of the iteration data string content
    /* compile */
    const dialog = Array.isArray(eventData.dialog) ? eventData.dialog?.[iteration]??eventData.dialog[0] : eventData.dialog
    const example = eventData.example
    const prompt = Array.isArray(eventData.prompt) ? eventData.prompt?.[iteration]??eventData.prompt[0] : eventData.prompt
    const localVariableArray = eventData.variables??[]
    localVariableArray
        .forEach(_var=>{
            if(!variables.includes(_var)) variables.push(_var)
        })
    if(variable && !variables.includes(variable))
        variables.push(variable)
    /* return */
    return { 
        currentIteration: iteration++,
        dialog,
        example,
        id,
        type,
        maxIterations: maxIterations??1,
        minIterations: minIterations??1,
        prompt,
        variable: variable,
        variables: variables,
    }
}
/**
 * From an array of scenes, returns an event object given a specific eventId.
 * @param {array} scenes - Array of scenes to pull event from.
 * @param {string} eventId - Event id to search for.
 * @returns {Event} - Event object.
 */
function mGetEvent(scenes, eventId){
    // loop scenes and then events to find event_id
    let event
    scenes.find(scene=>{
        const _event = scene.events.find(event=>event.id===eventId)
        if(_event){
            event = _event
            return true
        }
    })
    if(event)
        return event
    throw new Error(`mGetEvent: event_id "${eventId}" not found in scenes`)
}
/**
 * From an event, returns a `synthetic` Dialog data package, above and an .
 * @modular
 * @public
 * @param {ExperienceEvent} event - Experience class instance.
 * @param {number} iteration - Iteration number, defaults to first (array zero format).
 * @returns {Input} - `synthetic` Input data package.
 * @property {number} currentIteration - Current iteration number.
 * @property {string} inputFailure - Input failure string.
 * @property {Guid} inputId - Input id.
 * @property {string} inputPlaceholder - Input placeholder string.
 * @property {string} inputSuccess - Input success string.
 * @property {string} inputType - Input type.
 * @property {any} variable - Variable name, only one allowed per `input` event, but could be any type.
 */
function mInput(event, iteration=0){
    const { failure, inputFailure, inputId, inputPlaceholder, inputSuccess, inputType, placeholder, success, type, variable, variables } = event
    // add synthetic input object
    const input = {
        currentIteration: iteration++,
        inputFailure: inputFailure ?? failure ?? 'Input failed, please try again.',
        inputId: inputId ?? event.id,
        inputPlaceholder: inputPlaceholder ?? placeholder ?? 'Type here...',
        inputSuccess: inputSuccess ?? success ?? true, // true would indicate that any input is successful, presume to trime etc
        inputType: inputType ?? type ?? 'text',
        variable: variable ?? variables?.[0] ?? 'input',
    }
    return input
}
function mGetScene(scenes, sceneId){
    const scene = scenes.find(_scene=>_scene.id===sceneId)
    if(!scene)
        throw new Error(`mGetScene: scene_id "${sceneId}" not found in scenes`)
    return scene
}
/* exports */
export {
    mAppear,
    mDialog,
    mGetEvent,
    mInput,
    mGetScene,
}