/* module constants */
/* classes */
/**
 * @class - Bot
 * @private
 * @todo - are private vars for factory and llm necessary, or passable?
 */
class AlphaDog {
    #factory
    #llm
    constructor(llm, factory){
        this.#factory = factory
        this.#llm = llm
    }
}
/* module exports */
export default AlphaDog