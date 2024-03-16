/* imports */
/* constants */
const backstage = document.getElementById('experience-backstage')
const breadcrumb = document.getElementById('experience-breadcrumb')
const cast = document.getElementById('experience-cast')
const closeButton = document.getElementById('experience-close')
const description = document.getElementById('experience-description')
let mExperience
const footer = document.getElementById('experience-footer')
const mainstage = document.getElementById('experience-mainstage')
const navigation = document.getElementById('experience-navigation')
const screen = document.getElementById('experience-modal')
const skip = document.getElementById('experience-skip')
const stage = document.getElementById('experience-stage')
const startButton = document.getElementById('experience-start-button')
const title = document.getElementById('experience-title')
let mWelcome
/* public functions */
/**
 * Close experience onscreen.
 * @public
 * @returns {void}
 */
function mExperienceClose(){
    screen.classList.remove('modal-screen')
    screen.style.display = 'none'
    /* remove listeners */
    closeButton.removeEventListener('click', mExperienceClose)
    skip.removeEventListener('click', mExperienceSkip)
    console.log('mExperienceClose::closing experience')
    return
}
function mExperienceEnd(){
    console.log('mExperienceEnd::ending experience', mExperience)
    mExperienceClose()
    mExperience = null
    return
}
function mExperiencePlay(){
    if(mWelcome){
        mStageTransition()
        mWelcome = false
    }
}
/**
 * Skips a skippable scene in Experience.
 * @public
 * @returns {void}
 */
function mExperienceSkip(){
    console.log('mExperienceSkip::skipping experience', mExperience)
}
/**
 * Start experience onscreen.
 * @public
 * @param {Guid} experience - The Experience object.
 * @returns {Promise<void>} - The return is its own success.
 */
async function mExperienceStart(experience){
    /* drop curtains */
    screen.classList.add('modal-screen')
    /* load experience data */
    const { description, id, name, purpose, title, skippable=false } = experience
    /* experience manifest */
    const manifest = await mManifest(id)
    if(!manifest)
        throw new Error("Experience not found")
    const { cast, events, navigation } = manifest
    if(!cast) // cast required, navigation not required
        throw new Error("Experience cast not found")
    experience.cast = cast
    experience.navigation = navigation
    mExperience = experience
    mWelcome = true
    mInitListeners()
    /* present stage */
    mStageWelcome(mExperience)
    return
}
/* private functions */
/**
 * Initialize experience listeners.
 * @public
 * @returns {void}
 */
function mInitListeners(){
    console.log('mExperienceInitListeners::init', mExperience)
    if(mExperience.skippable)
        closeButton.addEventListener('click', mExperienceClose)
    skip.addEventListener('click', mExperienceSkip)
    startButton.addEventListener('click', mExperiencePlay)
    return
}
function mManifest(id){
    return fetch(`/members/experience/${id}/manifest`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        // body: JSON.stringify({}),
    })
    .then(response=>{
        if(!response.ok)
            throw new Error(`HTTP error! Status: ${response.status}`)
        return response.json()
    })
    .catch(error => {
        console.log('mManifest::Error()', error)
        return null
    })
}
/**
 * Introduces the concept of an Experience to the member.
 * @private
 * @param {Experience} experience - The Experience object.
 * @returns {void}
 */
function mStageWelcome(experience){
    // where you can put your friends in the center of your action.
    breadcrumb.innerHTML = `Experience: ${experience.name}`
    title.textContent = experience.title ?? experience.name ?? `Untitled Production`
    if(experience.description?.length)
        description.textContent = experience.description
    return
}
/**
 * Closes the welcome stage (backstage) and opens mainstage.
 * @returns {void}
 */
function mStageTransition(){
    // Trigger fade out for backstage
    backstage.classList.add('fade-out')
    // Wait for the fade out to complete before sliding up mainstage
    backstage.addEventListener('animationend', () => {
        console.log('mStageTransition::transitioning to mainstage')
        mainstage.classList.add('slide-up')
        backstage.style.display = 'none'
    }, { once: true }) // Ensure the event listener is removed after firing
    return
}
/* exports */
export {
    mExperienceClose,
    mExperienceEnd,
    mExperienceSkip,
    mExperienceStart,
}
/* end notes
===============================================================================
this module presumes all frontend mode-locking has been done by importer.
*/