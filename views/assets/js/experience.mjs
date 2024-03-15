/* public functions */
/**
 * Start experience onscreen.
 * @param {Guid} experienceId - Experience id.
 * @param {String} mbr_id - Member id string.
 */
async function mStartExperience(experienceId, mbr_id){
    /* drop curtains */
    console.log("Starting experience:", experienceId)
    const modal = document.getElementById('experienceModal')
    modal.style.display = 'block'
    /* load experience data */
    /* experience manifest */
    const experienceObject = await fetch(`/members/experience/${experienceId}/manifest`)
        .then(response=>{
            if(!response.ok)
                throw new Error(`HTTP error! Status: ${response.status}`)
            return response.json()
        })
        .catch(error => {
            console.log('Error:', error)
            return null
        })
    if(!experienceObject){
        throw new Error("Experience not found")
    }
    const { cast, manifest, events } = experienceObject
    console.log("Experience manifest:", manifest, experienceObject)
    /* present stage */
}
/* modular functions */
/* exports */
export {
    mStartExperience,
}