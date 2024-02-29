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
 * From an event, returns a dialog data package as in `mAvailableEventActionMap`.
 * @modular
 * @public
 * @param {Experience} _experience - Experience class instance.
 * @param {number} iteration - Iteration number, defaults to first (array zero format).
 */
function mDialog(event, iteration=0){
    /* reject */
    if(event?.action!=='dialog')
        throw new Error('mDialog: event.action must be "dialog"')
    /* validate */
    const { action, data: eventData, id, type, maxIterations, minIterations, } = event
    if(!mAvailableEventActionMap.dialog.types.includes(type))
        throw new Error(`mDialog: event.type must be one of ${mAvailableEventActionMap.dialog.types.join(', ')}`)
    // **note**: `prompt` and `dialog` variables can be array or string, here converted to string if array; once iterations pass content limit, it reverts to beginning; avatar will manage iteration _logic_ this only provides its best approximation of the iteration data string content
    /* compile */
    const dialog = Array.isArray(eventData.dialog) ? eventData.dialog?.[iteration]??eventData.dialog[0] : eventData.dialog
    const example = eventData.example
    const prompt = Array.isArray(eventData.prompt) ? eventData.prompt?.[iteration]??eventData.prompt[0] : eventData.prompt
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
        variable: eventData.variable,
        variables: eventData.variables,
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
function mInput(event){
    const { id, type, data: eventData } = event
    return
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