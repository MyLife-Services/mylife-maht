/* imports */
/* class definitions */
class Globals {
    constructor(){}
    /* public functions */
    /**
     * Returns the avatar object if poplated by on-page EJS script.
     * @todo - refactor to api call
     * @returns {object} - The avatar object.
     */
    getAvatar(){
        const avatar = window?.mylifeAvatar
            ?? window?.mylifeAvatarData
            ?? window?.avatar
        console.log('getAvatar::avatar', avatar)
        return avatar
    }
    /**
     * Returns the handle of a given MyLife member composite string.
     * @param {string} str - String to get handle of.
     * @returns {string} - The handle of the string.
     */
    getHandle(str){
        if(typeof str !== 'string')
            return str
        return this.variableIze(str).split('|')[0]
    }
    /**
     * Returns the id of a given MyLife member composite string. **Note**: must return a guid
     * @param {string} str - String to get id of.
     * @returns {string|Guid} - The id of the string.
     */
    getId(str){
        try{
            return this.isGuid(this.variableIze(str).split('|').pop())
        } catch(e){
            return false
        }
    }
    /**
     * Hides an element, pre-executing any included callback function.
     * @public
     * @param {HTMLElement} element - The element to hide.
     * @param {function} callbackFunction - The callback function to execute after the element is hidden.
     * @returns {void}
     */
    hide(element, callbackFunction){
        if(!element){
            console.log('mHide::element not found', element, document.getElementById('chat-member'))
            return
        }
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
     * Determines whether the argument is a valid guid.
     * @param {string} str - String (or other) to check.
     * @returns {boolean} - Whether the argument is a valid guid.
     */
    isGuid(str){
        try{
            return str.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        } catch(e){
            return false
        }
    }
    /**
     * Last stop before Showing an element and kicking off animation chain. Adds universal run-once animation-end listener, which may include optional callback functionality.
     * @public
     * @param {HTMLElement} element - The element to show.
     * @param {function} listenerFunction - The listener function, defaults to `mAnimationEnd`.
     * @returns {void}
     */
    show(element, listenerFunction){
        element.addEventListener(
            'animationend',
            animationEvent=>mAnimationEnd(animationEvent, listenerFunction),
            { once: true },
        )
        if(!element.classList.contains('show')){
            element.classList.remove('hide')
            element.classList.add('show')
        }
    }
    /**
     * Variable-izes (for js) a given string.
     * @param {string} undashedString - String to variable-ize.
     * @returns {string} - The variable-ized string.
     */
    variableIze(undashedString=''){
        if(typeof undashedString !== 'string')
            return ''
        return undashedString.replace(/ /g, '-').toLowerCase()
    }
}
/* private functions */
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
}
/* export */
export default Globals
/*
getHandle
getId
hide
isGuid
show
variableIze
*/