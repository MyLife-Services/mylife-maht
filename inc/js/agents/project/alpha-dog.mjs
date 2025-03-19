/* module constants */
import EventEmitter from 'events'
/* classes */
/**
 * @class - AlphaDog
 * @description - The AlphaDog class manages interface missions available to the member or visitor.
 */
class AlphaDog extends EventEmitter{
    #availableMissions // array of missions by guid available to the user
    #missions // array of missions
    #factory
    #llm
    constructor(llm, factory){
        super()
        this.#availableMissions = []
        this.#factory = factory
        this.#llm = llm
        this.#missions = []
    }
    /* public functions */
    async init(missionId){
        // initialize the mission object with the factory
        const missions = await this.#factory.availableMissions()
        this.#availableMissions.push(...missions)
        return this

    }
    /**
     * Takes a structured call for AlphaDog functionality and returns a response.
     * @param {object} data - the data to process
     * @param {string} method - the http method used to make the request
     * @returns {Promise<object>} - the correct response object
     */
    async input(data, method='get'){
        // @todo = determine of this.#factory.isMyLife) is useful here
        switch(method.toLowerCase()){
            case 'delete':
            case 'patch':
            case 'post':
            case 'put':
                throw new Error(`AlphaDog: ${method} not implemented`)
            case 'get':
            default:
                const { missionId, } = data
                Mission = await this.mission(missionId)
                break
        }
        return Mission
    }
    /**
     * Creates or finds a Mission by id.
     * @param {Guid} missionId - The Mission id; optional
     * @returns {Promise<Mission>} - The Mission object
     */
    async mission(missionId){
        const Mission = this.#missions.find(m=>m.id===missionId)
            ?? await this.missionCreate(missionId)
        return Mission
    }
    async missionAvailable(missionId){
        return this.#availableMissions.find(m=>m===missionId)
    }
    async missionCreate(){
        const missionId = this.#availableMissions?.[0]
        if(!this.missionAvailable(missionId))
            return
        const mission = this.missionFind(missionId)
            ?? await new Mission(this.#llm, this.#factory)
        if(!this.missionFind(missionId)){
            await mission.init(missionId)
            this.#missions.push(mission)
        }
        return mission.mission
    }
    missionFind(missionId){
        return this.#missions.find(m=>m.id===missionId)
    }
    /**
     * Indicates an interactive event has occurred inside the identified step of the mission.
     * @async
     * @param {string} missionId - The Mission id
     * @param {string} stepId - The Step id
     * @param {object} eventData - The event data to process
     */
    async missionEngage(missionId, stepId, eventData){
        // get and populate mission object from factory
        const mission = await this.#factory.missionEngage(missionId, stepId, eventData)
        return mission

    }
    async missionsPossible(){
        return this.#factory.missionsPossible()
    }
    /* getters and setters */
    get currentStep(){
        return this
    }
    get missions(){
        return this.#missions
    }
    get newGuid(){
        return this.#factory.newGuid
    }
}
/**
 * @class - Mission
 * @description - The Mission class manages a single instance of a member or visitor mission.
 */
class Mission extends EventEmitter {
    #currentStep
    #factory
    #llm
    #steps
    constructor(llm, factory){
        super()
        this.#factory = factory
        this.#llm = llm
        this.#steps = []
    }
    async init(missionId){
        const data = await this.#factory.mission(missionId)
        Object.assign(this, data)
        return this
    }
    /* getters and setters */
    get currentStep(){
        return this.#currentStep
    }
    get mission(){
        const { id, steps, title, type, } = this
        return {
            id,
            steps,
            title,
            type,
        }
    }
}
/* module exports */
export default AlphaDog