//	imports
import EventEmitter from 'events'
import { OpenAIApi, Configuration } from 'openai'
import Globals from '../inc/js/globals.js'
import chalk from 'chalk'
// config
const config = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
const openai = new OpenAIApi(config)
const globals = await new Globals().init()
console.log(chalk.yellow('global schema classes created:'),globals.schema)
//	define export Classes
class MemberAgent extends EventEmitter {
	#ctx
	#memberCore
	#memberChat
	constructor(_core){	//	receive koa context payload
		super()
		this.aiAgent = openai
		this.#memberCore = _core
		this.#memberChat = ''
	}
	//	getter/setter functions
	get ctx(){
		return this.#ctx
	}
	get memberCore(){
		return this.#memberCore
	}
	//	public functions
	async processChatRequest(ctx){
		//	gatekeeper
		//	throttle requests
		//	validate input
		this.#setCtx(ctx)
		const _question = ctx.request.body.message
		//	log input
		console.log(chalk.bgGray('chat-request-received:'),chalk.bgWhite(` ${_question}`))
		const aQuestion = [
			this.#assignSystemRole(),	//	assign system role
			...this.#assignPrimingQuestions(),	//	assign few-shot learning prompts
			this.#assignQuestion(_question)	//	assign user question
		]
		//	why won't anyone think of the tokens!?
		//	insert ai-sniffer/optimizer
		const _response = await this.aiAgent.createChatCompletion({
			model: "gpt-3.5-turbo",
			messages: aQuestion,
	//		git: { repo: 'https://github.com/MyLife-Services/mylife-maht' },
		})
			.then(
				(_response)=>{
					//	response insertion/alteration points for approval, validation, storage, pruning
					//	challengeResponse(_response) //	insertion point: human reviewable
					_response = this.#formatResponse(_response)
					return _response
				}
			)
			.catch(err=>{
				console.log(err)
				//	emit for server
			})
		console.log(chalk.bgGray('chat-response-received'),_response)
		this.#setChatExchange(_question,_response)
		return _response
	}
	//	PRIVATE functions
	//	question/answer functions
	#assignPrimingQuestions(){
		return [{
			role: 'user',
			content: `What is ${this.#getOrganizationName()}'s mission?`
		},
		{
			role: 'assistant',
			content: this.#getOrganizationMission()
		},
		{
			role: 'user',
			content: `What are ${this.#getOrganizationName()}'s values and how do they plan to do it?`
		},
		{
			role: 'assistant',
			content: this.#getOrganizationValues()+' '+this.#getOrganizationVision()
		}]
	}
	#assignQuestion(_question){
		return {
			role: 'user',
			content: _question
		}
	}
	#assignSystemRole(){
		switch(this.#memberCore.being){
//			case 'agent':
			default:	//	core
				return {
						role: "system",
						content: this.#getAgentSystemRole()
					}
		}
	}
	#formatResponse(_str){
		//	insert routines for emphasis
		const _response=this.#detokenize(_str.data.choices[0].message.content)
			.replace(/(\s|^)mylife(\s|$)/gi, "$1<em>MyLife</em>$2")
		return _response
	}
	//	agent functions
	#getAgentDescriptor(){
		return this.#memberCore.agent_descriptor
	}
	#getAgentGender(){
		//	https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining
		return	this.#memberCore?.agent_gender
			?	Array.isArray(this.#memberCore.agent_gender)
				?	' '+this.#memberCore.agent_gender.join(this.#memberCore?.agent_gender_separatora?this.#memberCore.agent_gender_separator:'/')
				:	this.#memberCore.agent_gender
			:	''
	}
	#getAgentPronunciation(){
		return	this.#memberCore?.agent_name_pronunciation
			?	', pronounced "'+this.#memberCore.agent_name_pronunciation+'", '
			:	''
	}
	#getAgentProxyInformation(){
		switch(this.#memberCore.form){
			case 'organization':
				return this.#getOrganizationDescription()
			default:
				return this.#getMemberBio()
		}
	}
	#getAgentSystemRole(){
		return `I am ${this.#getAgentName(true)}${this.#getAgentPronunciation()}${this.#getAgentGender()}, ${this.#getAgentDescriptor()}. ${this.#getAgentProxyInformation()}`
	}
	#getAgentName(bTokenize=false){
		return (bTokenize)
			?	this.#tokenize(this.#memberCore.agent_name)
			:	this.#memberCore.agent_name
	}
	//	member functions
	#getMemberBio(){
		return 'not yet implemented'
		return [
			{
				role: "user",
				content: `Who is ${this.#memberCore?.agent_name}`
			},
		]
	}
	//	organization functions
	#getOrganizationDescription(){
		return this.#memberCore.organization_description
	}
	#getOrganizationMission(){
		return this.#memberCore.organization_mission
	}
	#getOrganizationName(){
		return this.#memberCore.organization_name[0]
	}
	#getOrganizationValues(){
		return this.#memberCore.organization_values
	}
	#getOrganizationVision(){
		return this.#memberCore.organization_vision
	}
	async #setChatExchange(_question,_response){
		//	emit to server for storage after validation
		console.log('chatExchange',await globals.schemas)
		return
		const _chat = globals.schemas
			.then(_oSchemas=>{ return _oSchemas.chat })	//	chat
			.catch(err=>{ console.log(err) })
	}
	async #setChatSnippet(_role,_content){
		//	emit to server for storage after validation
		const _chatSnippet = await globals.schemas
			.then(_oSchemas=>{ return _oSchemas.chatSnippet })
			.catch(err=>{ console.log(err) })
		_chatSnippet.content = _content
		_chatSnippet.contributor = this.#getAgentName()
		_chatSnippet.role = _role
		//	emit to server for storage
		this.emit('storeBeing',_chatSnippet)
	}
//	misc
	#detokenize(_str){
		return _str.replace(/<\|\|/g,'').replace(/\|\|>/g,'')
	}
	#setCtx(ctx){
		this.#ctx = ctx
	}
	#tokenize(_str){
		return '<||'+_str+'||>'
	}
}
//	exports
export default MemberAgent