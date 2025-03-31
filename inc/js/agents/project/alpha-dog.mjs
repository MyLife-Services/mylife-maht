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
        this.#factory = factory
        this.#llm = llm
    }
    /* public functions */
    async init(missionId){
        const missions = await this.#factory.missions()
        this.#missions = await Promise.all(
            missions.map(async m => {
                m = this.#factory.globals.sanitize(m)
                const mission = new Mission(this.#llm, this.#factory)
                await mission.init(m.id, m)
                return mission
            }))
        const missionsAvailable = await this.#factory.availableMissions()
        this.#availableMissions = missionsAvailable.map(m=>({
            description: m.description,
            goals: m.goals,
            group: m.group,
            id: m.id,
            title: m.title,
            type: m.type,
            version: m.version=1,
        }))
        if(!this.missionFind(missionId)){
            const Mission = await this.mission(missionId)
            this.#missions.push(Mission)
        }
        return this
    }
    /**
     * Creates or finds a Mission by id.
     * @todo - should Avatar (@mookse default) be in charge of parsing play()?
     * @param {Guid} missionId - The Mission id; optional
     * @returns {Promise<Mission>} - The Mission object
     */
    async mission(missionId, play=false){
        const Mission = this.missionFind(missionId)
            ?? await this.missionCreate(missionId)
        if(!Mission)
            throw new Error(`AlphaDog: mission ${ missionId } not created`)
        if(play)
            this.missionPlay(missionId)
        return Mission
    }
    missionAvailable(missionId){
        return this.#availableMissions.find(m=>m.id===missionId)
    }
    async missionCreate(missionId=this.#availableMissions?.[0]?.id){
        if(!this.missionAvailable(missionId))
            throw new Error(`AlphaDog: mission ${ missionId } not available`)
        let mission
        mission = this.missionFind(missionId)
        if(!mission){
            mission = await new Mission(this.#llm, this.#factory)
            await mission.init(missionId)
            this.#missions.push(mission)
        }
        return mission
    }
    missionFind(missionId){
        return this.#missions.find(m=>m.id===missionId)
    }
    missionPlay(missionId, eventData){
        // @todo - ensure Mission has not ended (and hidden properties)
        const Mission = this.missionFind(missionId)
        if(!Mission)
            throw new Error(`AlphaDog: mission ${ missionId } not found`)
        Mission.play(eventData)
        return Mission.currentStep
    }
    /* getters and setters */
    get missions(){
        const missions = this.#missions.map(m=>m.mission)
        return missions
    }
    get missionsAvailable(){
        return this.#availableMissions
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
    #id
    #isActive
    #isComplete
    #llm
    #steps
    constructor(llm, factory){
        super()
        this.#factory = factory
        this.#llm = llm
    }
    async init(missionId, data){
        missionId = missionId
            ?? data?.id
        data = data
            ?? await this.#factory.mission(missionId)
        const { currentStep, id, isComplete=false, steps, ..._data } = data
        Object.assign(this, _data)
        if(!steps || !steps.length)
            throw new Error('AlphaDog: mission steps not found')
        this.#currentStep = currentStep
        this.#isComplete = isComplete
        this.#isActive = true // @todo - always true?
        this.#steps = steps
            .map(step=>new Step(this.#llm, this.#factory, step))
            .sort((a, b)=>( a.order ?? 100 ) - ( b.order ?? 100 ))
        this.#currentStep =  this.#steps[currentStep]
        return this
    }
    async end(){
        this.#currentStep = null
        this.#isComplete = true
        this.#isActive = false
    }
    async next(){
        console.log('next not yet implemented')
    }
    /**
     * Indicates an interactive event has occurred inside the identified step of the mission.
     * @async
     * @param {string} missionId - The Mission id
     * @param {string} stepId - The Step id
     * @param {object} eventData - The event data to process
     */
    async play(eventData){
        const { done=false, id, message, } = eventData
        if(id!==this.#currentStep.id)
            throw new Error(`AlphaDog: mission ${ this.#id } step ${ id } not found`)
        const stepResponse = await this.#currentStep.play(eventData)
        if(stepResponse.isComplete){
            this.#currentStep = this.#steps[this.#currentStep+1]
            if(!this.#currentStep)
                this.end()
        }
        return this.#currentStep.step

    }
    // next mission
    // type: 'alpha-01' - alpha dog mission
    // this is the grouping that the mission belongs to, may want to call on instantiation
    async previous(){
        if(this.#currentStep>0)
            this.#currentStep--
        return this.mission
    }
    /* getters and setters */
    get active(){
        return this.#isActive
    }
    set active(isActive=true){
        if(typeof isActive!=='boolean' || isActive===null)
            throw new Error('AlphaDog: isActive must be a boolean')
        this.#isActive = isActive
    }
    get complete(){
        return this.#isComplete
    }
    get currentStep(){
        return this.#currentStep.step
    }
    get id(){
        return this.#id
    }
    get mission(){
        const { active, complete, currentStep, description, goals, group, id, steps, title, type, } = this
        return {
            active: this.active,
            complete: this.complete,
            currentStep,
            description,
            goals,
            group,
            id,
            steps,
            title,
            type,
        }
    }
}
/**
 * @class - Step
 * @description - The Step class manages the steps of activity
 */
class Step extends EventEmitter {
    #factory
    #isCurrent
    #isComplete
    #llm
    constructor(llm, factory, step){
        super()
        this.#isCurrent = false
        this.#factory = factory
        this.#llm = llm
        step = this.#factory.globals.sanitize(step)
        Object.assign(this, step)
    }
    async play(eventData){
        const { id, } = eventData
        if(!this.#isComplete){
            this.#isCurrent = true
            if(!eventData) // starting

            if(complete){
                this.#isComplete = true
                this.#isCurrent = false
            }
        }
        return this.step
    }
    /* getters and setters */
    get complete(){
        return this.#isComplete
    }
    get isCurrent(){
        return this.#isCurrent
    }
    set isCurrent(isCurrent){
        if(typeof isCurrent!=='boolean' || ( isCurrent ?? null )===null)
            throw new Error('AlphaDog: isCurrent must be a boolean')
        this.#isCurrent = isCurrent
    }
    get step(){
        const step = {
            action: this.action,
            id: this.id,
            isCurrent: this.isCurrent,
            isComplete: this.isComplete,
            type: this.type,
        }
        return step
    }
}
/* module exports */
export default AlphaDog