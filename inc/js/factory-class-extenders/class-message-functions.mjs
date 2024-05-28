/* public module functions */
/**
 * Assigns content (from _message.message) to message object.
 * @module
 * @public
 * @param {any} obj - Element to assign to `content` property
 * @returns {string} - message text content
 */
function assignContent(obj){
    const contentErrorMessage = 'No content found.'
    const keyIncludes = ['category', 'content', 'input', 'message', 'text', 'value']
    switch(typeof obj){
        case 'undefined':
            throw new Error(contentErrorMessage)
        case 'object':
            if(Array.isArray(obj)){
                if(!obj.length)
                    throw new Error(contentErrorMessage)
                for(const element of obj){
                    try{
                        const content = assignContent(element)
                        return content
                    } catch(e){
                        if(e.message===contentErrorMessage)
                            continue
                    }
                }
                throw new Error(contentErrorMessage)
            }
            for(const key in obj){
                try{
                    if(keyIncludes.includes(key)){
                        const content = assignContent(obj[key])
                        return content
                    }
                } catch(e){
                    if(e.message===contentErrorMessage)
                        continue
                }
            }
            throw new Error(contentErrorMessage)
        case 'string':
            if(!obj.trim().length)
                throw new Error(contentErrorMessage)
            return obj.trim()
        default:
            return `${obj}`
    }
}
/* private module functions */
/**
 * Checks if content is a non-empty string.
 * @module
 * @private - not exposed via export
 * @param {string} content - message content 
 * @returns {boolean} - true if content is a non-empty string
 */
function mIsNonEmptyString(content){
    return (typeof content==='string' && content.trim().length)
}
/* exports */
export {
	assignContent,
}