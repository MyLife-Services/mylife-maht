/* experience modular constants */
const mAvailableEventActionMap = {
    appear: {
        effects: ['spotlight'],
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
 * @param {number} _iteration - Iteration number, defaults to first (array zero format).
 */
function mDialog(event, _iteration=0){
    const { action, id, type, data: eventData } = event
    if(action!=='dialog')
        throw new Error('mDialog: event.action must be "dialog"')
    if(!mAvailableEventActionMap.dialog.types.includes(type))
        throw new Error(`mDialog: event.type must be one of ${mAvailableEventActionMap.dialog.types.join(', ')}`)
    // **note**: `prompt` and `dialog` variables can be array or string, here converted to string if array 
    const prompt = eventData.prompt?.[_iteration]??eventData.prompt
    const dialog = eventData.dialog?.[_iteration]??eventData.dialog
    // check iterations
    return { dialog, id, type, prompt, }
}
/**
 * From an array of scenes, returns an event object given a specific eventId.
 * @param {array} scenes - Array of scenes to pull event from.
 * @param {string} eventId - Event id to search for.
 * @returns {Event} - Event object.
 */
function mGetEvent(scenes, eventId){
    // loop scenes and then events to find event_id
    scenes.forEach(scene=>{
        const event = scene.events.find(_event=>_event.id===eventId)
        if(event)
            return event
    })
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