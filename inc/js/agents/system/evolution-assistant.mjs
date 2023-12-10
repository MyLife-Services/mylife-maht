//	imports
import { EventEmitter } from 'events'
//	modular constants
//	modular variables
//	modular class definition
// evolution-assistant.mjs
export class EvolutionAssistant extends EventEmitter {
    #avatar //  would it make sense for _this_ to be the agent that updates the avatar, since it has access to its factory etc.?
    #contributions = [] //  self-managed aray of contributions on behalf of embedded avatar; could postdirectly to avatar when required
    constructor(_avatar) { //  receive parent object ref
        super()
        this.#avatar = _avatar
    }
    /**
     * Initialize the Evolution Assistant, generating and assigning three Contributions available to the avatar to complete.
     * @returns {Array} An array of three categories most in need of member Contributions.
     */
    async init() {  //  initialize routine populates this.#contributions
        const _contributions = 
            this.#assessData()  //  returns array(3) of categories
                .map(_category => this.#getContribution({
                    category: _contribution,
                    content: this.#avatar?.[_contribution]??false,
                }))
        //  post to avatar?
    }
    /**
     * Reviews properties of avatar and returns an array of three categories most in need of member Contributions.
     * @param {number} _numCategories - The number of categories to return. Defaults to 3. minimum 1, maximum 6.
     * @returns {Array} The top number categories requiring Contributions.
     */
    #assessData(_numCategories) {
        return [
            ...this.#avatar.categories
                .filter(_category => !this.#avatar?.[_category]),
            ...this.#avatar.categories
            .filter(_category => this.#avatar?.[_category])
            .sort((a, b) => this.#avatar[a].length - this.#avatar[b].length)
            .slice(0, 3)
        ].slice(0, Math.min(_numCategories || 3, 6))
    }
    /**
     * Convert category spaces to underscores and request questions from MyLife Factory.
     * @param {string} category - The category to process.
     * @returns {Array} An array of three questions.
     */
    async getCategoryQuestions(category) {
        const formattedCategory = category.replace(/\s+/g, '_')
        // Request questions from MyLife Factory
        // Replace this with actual call to MyLife Factory
        return this.#avatar.requestQuestionsFromMyLifeFactory(formattedCategory)
    }
    //  private functions
    /**
     * Digest a request to generate a new Contribution.
     * @private
     * @param {object} _request - The request to process.
     * @returns {Contribution} A new Contribution object.
     */
    #getContribution(_request) {
        // Process question and map to `new Contribution` class
        const _contribution = new (this.#avatar.factory.contribution)({
            avatar_id: this.#avatar.id,
            context: `I am a contribution object in MyLife, comprising data and functionality around a data evolution request to my associated avatar [${this.#avatar.id}]`,
            purpose: `Contribute to evolution of underlying avatar by providing data for a category [${_request.category}]`,
            request: _request,
        })
        // Emit event if necessary (assuming EventEmitter is used)
        this.emit('newContribution', _contribution)
        return _contribution
    }
}
// exports
export default EvolutionAssistant