//	imports
import { _ } from 'ajv'
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
    //  public functions
    /**
     * Initialize the Evolution Assistant, generating and assigning three Contributions available to the avatar to complete.
     * @async
     * @emits {onInitBegin} - Emitted when the initialization process begins.
     * @emits {onInitEnd} - Emitted when the initialization process ends.
     * @returns {Array} An array of three categories most in need of member Contributions.
     */
    async init() {  //  initialize routine populates this.#contributions
        this.emit('onInitBegin')
        this.#contributions = 
            this.#assessData()  //  returns array(3) of categories
                //  TODO: does not necessarily need to be async, can arrive and emit in any order
                .map(async _category => await this.#getContribution(_category)) //  returns array(3) of newly populated Contribution objects
        //  post to avatar?
        this.emit('onInitEnd')
    }
    //  getters and setters
    /**
     * Get the contributions array.
     * @returns {Array} The contributions array.
    */
   get contributions() {
       return this.#contributions
    }
    get factory() {
        return this.#avatar.factory
    }
    get mbr_id() {
        return this.#avatar.mbr_id
    }
    //  private functions
    /**
     * Reviews properties of avatar and returns an array of three categories most in need of member Contributions.
     * @private
     * @param {number} _numCategories - The number of categories to return. Defaults to 3. minimum 1, maximum 6.
     * @returns {Array} The top number categories requiring Contributions.
     */
    #assessData(_numCategories) {
        return [
            ...this.#avatar.categories
                .filter(_category => !this.#avatar?.[this.#formatCategory(_category)])
                .map(_category => this.#formatCategory(_category)),
            ...this.#avatar.categories
                .filter(_category => this.#avatar?.[this.#formatCategory(_category)])
                .map(_category => this.#formatCategory(_category))
                .sort((a, b) => this.#avatar[a].length - this.#avatar[b].length)
                .slice(0, 3)
        ].slice(0, Math.min(_numCategories || 3, 6))
    }
    /**
     * Formats a category string to a format consistent with Cosmos key structure: all lowercase, underscores for spaces, limit of 64-characters.
     * @private
     * @param {string} _category - The category to format.
     * @returns {string} The formatted category.
     */
    #formatCategory(_category) {
        return _category
            .replace(/\s+/g, '_')
            .toLowerCase()
            .trimStart()
            .slice(0, 64)
    }
    /**
     * Digest a request to generate a new Contribution.
     * @private
     * @emits {onNewContribution} - Emitted when a new Contribution is generated.
     * @param {string} _category - The category to process.
     * @returns {Contribution} A new Contribution object.
    */
    async #getContribution(_category) {
        _category = this.#formatCategory(_category)
        // Process question and map to `new Contribution` class
        const _contribution = new (this.#avatar.factory.contribution)({
            avatar_id: this.#avatar.id,
            context: `I am a contribution object in MyLife, comprising data and functionality around a data evolution request to my associated avatar [${this.#avatar.id}]`,
            mbr_id: this.mbr_id,    //  Contributions are system objects
            purpose: `Contribute to the data evolution of underlying avatar for category [${_category}]`,
            request: {
                category: _category,
                content: this.#avatar?.[_category]??false,
                impersonation: this.#avatar.object_being,
            },
            response: {
                category: _category,
            },
        })
        //  assign listeners
        _contribution.emitter.on(
            'onNewContribution',
            _contribution => this.#log(_contribution,'onNewContribution')
        )
        return await _contribution.init()   //  fires emitters
    }
    /**
     * Log an object to the console and emit it to the parent.
     * @private
     * @emits {_emit_text} - Emitted when an object is logged.
     * @param {object} _object - The object to log.
     * @param {string} _emit_text - The text to emit.
     */
    #log(_object,_emit_text) {
        if(_emit_text) this.emit(_emit_text, _object)
        console.log(`new ${_object.being}`, _object?.inspect(true)??_object)
    } 
}
// exports
export default EvolutionAssistant