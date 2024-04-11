/* imports */
import Globals from './globals.mjs'
/* variables */
const mGlobals = new Globals()
/* page div variables */
let mainContent,
    memberSelect
document.addEventListener('DOMContentLoaded', async ()=>{
    /* assign page div variables */
    mainContent = document.getElementById('main-content')
    memberSelect = document.getElementById('member-select')
    /* assign listeners */
    mInitializeListeners()
    /* display page */
    mGlobals.show(mainContent)
})
/* public functions */
/**
 * Redirects to the login page with a selected member id.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function selectLoginId(event){
    event.preventDefault()
    const memberId = memberSelect.value
    if(!memberId?.length)
        return
    window.location = `/login/${memberId}`
}
/* private functions */
/**
 * Initializes event listeners.
 * @returns {void}
 */
function mInitializeListeners(){
    if(memberSelect)
        memberSelect.addEventListener('change', selectLoginId)
}
/* exports */
export {
    selectLoginId,
}