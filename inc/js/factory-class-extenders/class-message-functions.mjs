/* public modular functions */
/**
 * Assigns content (from _message.message) to message object.
 * @modular
 * @public
 * @param {any} obj - Element to assign to `content` property
 * @returns {string} - message text content
 */
function mAssignContent(obj){
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
                        const content = mAssignContent(element)
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
                        const content = mAssignContent(obj[key])
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
/* private modular functions */
/**
 * When incoming text is too large for a single message, generate dynamic text file and attach/submit.
 * @modular
 * @private
 * @param {string} _file - The file to construct.
 * @returns 
 */
async function mConstructFile(_file){
    //  construct file object
    const __file = new (this.factory.file)({
        name: `file_message_${this.id}`,
        type: 'text',
        contents: _file,
    })
    //  save to embedder
    return {
        name: __file.name,
        type: __file.type,
        contents: await __file.arrayBuffer(),
    }
}
/**
 * Checks if content is a non-empty string.
 * @modular
 * @private - not exposed via export
 * @param {string} content - message content 
 * @returns {boolean} - true if content is a non-empty string
 */
function mIsNonEmptyString(content){
    return (typeof content==='string' && content.trim().length)
}
/* exports */
export {
	mAssignContent,
}