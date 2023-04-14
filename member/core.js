//	imports
import { OpenAIApi, Configuration } from 'openai'
// config
const config = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
const openai = new OpenAIApi(config)
//	define export Classes
class MemberAgent {
	constructor(ctx){	//	receive koa context payload
		this.aiAgent = openai
		this.mylifeMemberCoreData = ctx.state.mylifeMemberCoreData
	}
	//	pseudo-constructor
	
	//	PUBLIC functions
	async processChatRequest(_question){
		console.log('chat-request-received',_question)	//	turn into emitter for server
		//	pre-vet, trim, approve(?) input
		
		//	assign histories and roles
		//	assignHistory(_question)
		const aQuestion = [
			this._assignSystemRole(),
			...this._assignPrimingQuestions(),
			this._assignQuestion(_question)
		]
		const _response = await this.aiAgent.createChatCompletion({
			model: "gpt-3.5-turbo",
			messages: aQuestion,
	//		git: { repo: 'https://github.com/MyLife-Services/mylife-maht' },
		})
			.then()
			.catch(err=>{
				console.log(err)
	//			throw(err)
			})
		//	response insertion/alteration points for approval, validation, storage, pruning
		//	challengeResponse(_response) //	insertion point: human reviewable
		return this._formatResponse(_response)
	}
	//	PRIVATE functions
	//	question/answer functions
	_assignPrimingQuestions(){
		return [{
			role: 'user',
			content: `What is ${this._getOrganizationName()}'s mission?`
		},
		{
			role: 'assistant',
			content: this._getOrganizationMission()
		},
		{
			role: 'user',
			content: `What are ${this._getOrganizationName()}'s values and how do they plan to do it?`
		},
		{
			role: 'assistant',
			content: this._getOrganizationValues()+' '+this._getOrganizationVision()
		}]
	}
	_assignQuestion(_question){
		return {
			role: 'user',
			content: _question
		}
	}
	_assignSystemRole(){
		switch(this.mylifeMemberCoreData.being){
//			case 'agent':
			default:	//	core
				return {
						role: "system",
						content: this._getAgentSystemRole()
					}
		}
	}
	_formatResponse(_str){
		//	insert routines for emphasis
		const _response=this._detokenize(_str.data.choices[0].message.content)
			.replace(/(\s|^)mylife(\s|$)/gi, "$1<em>MyLife</em>$2")
		return _response
	}
	_getMemberBio(){
		return [
			{
				role: "user",
				content: `Who is ${this.mylifeMemberCoreData?.agent_name}`
			},
		]
	}
	//	agent functions
	_getAgentDescriptor(){
		return this.mylifeMemberCoreData.agent_descriptor
	}
	_getAgentGender(){
		//	https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining
		return	this.mylifeMemberCoreData?.agent_gender
			?	Array.isArray(this.mylifeMemberCoreData.agent_gender)
				?	' '+this.mylifeMemberCoreData.agent_gender.join(this.mylifeMemberCoreData?.agent_gender_separatora?this.mylifeMemberCoreData.agent_gender_separator:'/')
				:	this.mylifeMemberCoreData.agent_gender
			:	''
	}
	_getAgentPronunciation(){
		return	this.mylifeMemberCoreData?.agent_name_pronunciation
			?	', pronounced "'+this.mylifeMemberCoreData.agent_name_pronunciation+'", '
			:	''
	}
	_getAgentProxyInformation(){
		switch(this.mylifeMemberCoreData.form){
			case 'organization':
				return this._getOrganizationDescription()
			default:
				return this._getMemberBio()
		}
	}
	_getAgentSystemRole(){
		return `I am ${this._getAgentName(true)}${this._getAgentPronunciation()}${this._getAgentGender()}, ${this._getAgentDescriptor()}. ${this._getAgentProxyInformation()}`
	}
	_getAgentName(bTokenize=false){
		return (bTokenize)
			?	this._tokenize(this.mylifeMemberCoreData.agent_name)
			:	this.mylifeMemberCoreData.agent_name
	}
	//	member functions
	_getMemberBio(){
		return 'not yet implemented'
	}
	//	organization functions
	_getOrganizationDescription(){
		return this.mylifeMemberCoreData.organization_description
	}
	_getOrganizationMission(){
		return this.mylifeMemberCoreData.organization_mission
	}
	_getOrganizationName(){
		return this.mylifeMemberCoreData.organization_name[0]
	}
	_getOrganizationValues(){
		return this.mylifeMemberCoreData.organization_values
	}
	_getOrganizationVision(){
		return this.mylifeMemberCoreData.organization_vision
	}
//	misc
	_detokenize(_str){
		return _str.replace(/<\|\|/g,'').replace(/\|\|>/g,'')
	}
	_tokenize(_str){
		return '<||'+_str+'||>'
	}
}
/*
function assignHistory(_question){
	//	assignSessionHistory
	//	assignPersonalHistory
}
function challengeResponse(){

}
*/
//	exports
export default MemberAgent