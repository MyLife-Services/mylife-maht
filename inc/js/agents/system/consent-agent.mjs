// NOTE: Determine whether Factory or Avatar own consent agent; preferred Factory
class ConsentAgent {
    #Factory
    #llm
    constructor(Factory, llm){
        this.#Factory = Factory
        this.#llm = llm
    }
}