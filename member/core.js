//	imports
import EventEmitter from 'events'
import { OpenAIApi, Configuration } from 'openai'
import chalk from 'chalk'
import { abort } from 'process'
import { _ } from 'ajv'
// core
import Dataservices from '../inc/js/mylife-data-service.js'
//	import { _ } from 'ajv'
// config
const config = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
const openai = new OpenAIApi(config)
//	define export Classes for Members and MyLife
class Member extends EventEmitter {
	#agent
	#chat
	#core
	#dataservice
	#excludeProperties = { '_none':true }
	#mbr_id
	#personalityKernal
	#globals
	constructor(_dataservice){
		super()
		this.#dataservice = _dataservice	//	individual cosmos dataservice by mbr_id
		this.#personalityKernal = openai
		this.#globals = global.Globals
		this.#core = Object.entries(this.#dataservice.core)	//	array of arrays
			.filter((_prop)=>{	//	filter out excluded properties
				const _charExlusions = ['_','@','$','%','!','*',' ']
				return !(
						(_prop[0] in this.#excludeProperties)
					||	!(_charExlusions.indexOf(_prop[0].charAt()))
				)
				})
			.map(_prop=>{	//	map to object
				return { [_prop[0]]:_prop[1] }
			})
		this.#core = Object.assign({},...this.#core)	//	merge to single object
		this.#mbr_id = this.#core.mbr_id
	}
	//	initialize
	async init(_agent_parent_id=this.#globals.extractId(this.mbr_id)){
		if(!this.#agent) {
			const _agentProperties = await this.#dataservice.getAgent(_agent_parent_id)	//	retrieve agent from db
			this.#agent = await new (this.#globals.schema.agent)(_agentProperties)	//	agent
			this.#agent.name = `agent_${ this.agentName }_${ this.#mbr_id }`
		}
		if(!this.#chat){
			const _chatProperties = await this.#dataservice.getChat()
			this.#chat = await new (this.#globals.schema.chat)(_chatProperties)	//	chat
			this.#chat.name = `${ this.#chat.being }_${ this.#mbr_id }`
		}
		if(!this.#testEmitters()) {
			throw new Error('emitters not initialized')
		}
		return this
	}
	//	getter/setter functions
	get _agent(){	//	introspected agent
		return this.agent.inspect(true)
	}
	get agent(){
		return this.#agent
	}
	set agent(_){
		throw new Error(`agent is read-only: ${_}`)
	}
	get agentCommand(){
		return this.agent.command_word
	}
	get agentDescription(){	//	agent description (not required)
		if(!this.agent?.description) this.#agent.description = `I am ${ this.agentName }, AI-Agent for ${ this.name }`
		return this.agent.description
	}
	get agentName(){
		return this.agent.names[0]
	}
	get agentName_tokenized(){
		return this.#tokenize(this.agentName)
	}
	get agentProxy(){
		switch(this.form){	//	need switch because I could not overload class function
			case 'organization':
				return this.description
			default:
				return this.bio
		}
	}
	get agentRole(){
		switch(this.being){
//			case 'agent':
			default:	//	core
				const regex = new RegExp(this.agentName, 'g')
				const replacedDescription = this.agentDescription.replace(regex, this.agentName_tokenized)
				return {
						role: "system",
						content: replacedDescription + ' ' + this.agentProxy
					}
		}
	}
	get being(){
		return this.core.being
	}
	get bio(){
		return this.core.bio
	}
	get chat(){
		return this.#chat
	}
	set chat(_chat){	//	assign chat object
		this.#chat = new (this.#globals.schema.chat)(_chat)
		this.#chat.id = _chat.id	//	must assign
	}
	set chatExchange(_exchange) { // assign chat exchange via shift()
		if (!(_exchange instanceof this.#globals.schema.classExchange)) {
			throw new Error('_exchange must be an instance of classExchange')
		}
		this.#chat.chatExchange.shift(_exchange)	//	add to chatExchange array
	}
	get core(){
		return this.#core
	}
	get dataservice(){
		return this.#dataservice
	}
	get description(){
		return this.core.description
	}
	get email(){
		return this.core.email
	}
	get form(){
		return this.core.form
	}
	get globals(){
		return this.#globals
	}
	get humanQuestions(){
		return [{
			role: 'user',
			content: `Why is ${ this.memberName } interested in MyLife?`
		},
		{
			role: 'assistant',
			content: this.agent.participation
		},
		{
			role: 'user',
			content: `How has ${ this.memberName } contributed to MyLife?`
		},
		{
			role: 'assistant',
			content: this.agent.contribution
		}]
	}
	get mbr_id(){
		return this.core.mbr_id
	}
	get member(){
		return this.core
	}
	get memberName(){
		return this.core.names[0]
	}
	get name(){
		return this.core.name
	}
	get sysname(){
		return mbr_id.split('|')[0]
	}	
	get sysid(){
		return mbr_id.split('|')[1]
	}
	//	public functions
	async processChatRequest(ctx){
		//	gatekeeper
		//	throttle requests
		//	validate input
		const _question = ctx.request.body.message
		//	log input
		console.log(chalk.bgGray('chat-request-received:'),chalk.bgWhite(` ${_question}`))
		//	transform input
		const aQuestion = [
			this.agentRole,	//	assign system role
			...this.#assignPrimingQuestions(),	//	assign few-shot learning prompts
			this.#formatQuestion(_question)	//	assign user question
		]
		console.log(aQuestion)
		//	why won't anyone think of the tokens!?
		//	insert ai-sniffer/optimizer
		const _response = await this.#personalityKernal.createChatCompletion({
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
		return _response
		//	store chat
		const _chatExchange = new (this.globals.schema.chatExchange)({ 
			mbr_id: this.mbr_id,
			parent_id: this.chat.id,
			chatSnippets: [],
		})
		_chatExchange.id = this.#globals.newGuid	//	otherwise it reverts to specific, must always provide
		_chatExchange.name = `${ _chatExchange.being }_${ this.#mbr_id }`
		const _chatSnippetQuestion = new (this.#globals.schema.chatSnippet)({	//	no trigger to set
			mbr_id: this.mbr_id,
			parent_id: _chatExchange.id,
			content: _question,
			role: 'user',
			contributor: this.mbr_id,
		})
		_chatSnippetQuestion.id = this.#globals.newGuid	//	otherwise it reverts to specific, must always provide
		_chatSnippetQuestion.name = `${ _chatSnippetQuestion.being }_${ this.#mbr_id }`
		const _chatSnippetResponse = new (this.#globals.schema.chatSnippet)({	//	no trigger to set
			mbr_id: this.mbr_id,
			parent_id: _chatExchange.id,
			content: _response,
		})
		_chatSnippetResponse.id = this.#globals.newGuid	//	otherwise it reverts to specific, must always provide
		_chatSnippetResponse.name = `${ _chatSnippetResponse.being }_${ this.#mbr_id }`
		//	store response [reverse chronological order]
		_chatExchange.chatSnippets.unshift(_chatSnippetResponse.id)	//	add to exchange
		await this.#dataservice.pushItem(_chatSnippetResponse.inspect(true))
		//	store question
		_chatExchange.chatSnippets.unshift(_chatSnippetQuestion.id)	//	add to exchange
		await this.#dataservice.pushItem(_chatSnippetQuestion.inspect(true))
		//	store exchange
		this.chat.chatExchanges.unshift(_chatExchange.id)	//	add to chat
		await this.#dataservice.pushItem(_chatExchange.inspect(true))
//		this.chat.chatExchanges = [].unshift(_chatExchange.id)	//	still fails with type is not array..?
		//	store chat
		await this.#dataservice.pushItem(this.chat.inspect(true))
		//	return response
		return _response
	}
	//	PRIVATE functions
	//	question/answer functions
	#assignPrimingQuestions(){
		switch (this.form) {
			case 'organization':
				return this.corporateQuestions
			default:
				return this.humanQuestions
		}
		//	note: even if I just rotated 3 from a group of similarly worded questions (to elicit different vocab etc)
	}
	#formatQuestion(_question){
		return {
			role: 'user',
			content: _question
		}
	}
	#formatResponse(_str){
		//	insert routines for emphasis
		const _response=this.#detokenize(_str.data.choices[0].message.content)
			.replace(/(\s|^)mylife(\s|$)/gi, "$1<em>MyLife</em>$2")
		return _response
	}
/*
	#getAgentGender(){
		//	https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining
		return	this.core?.agent_gender
			?	Array.isArray(this.core.agent_gender)
				?	' '+this.core.agent_gender.join(this.core?.agent_gender_separatora?this.core.agent_gender_separator:'/')
				:	this.core.agent_gender
			:	''
	}
*/
//	misc functions
	#detokenize(_str){
		return _str.replace(/<\|\|/g,'').replace(/\|\|>/g,'')
	}
	async #testEmitters(){
		//	test emitters with callbacks
		this.emit('testEmitter',_response=>{
			console.log('callback emitters enabled:',_response)
		})
	}
	#tokenize(_str){
		return '<||'+_str+'||>'
	}
}
class MyLife extends Member {
	#board
	constructor(_dataservice){
		super(_dataservice)
	}
	async init(){
		//	assign board array
		//this.board.push( await this.#dataservice.getBoard() )
		await super.init()
		const _board = await this.dataservice.getBoard()	//	get current list of mbr_id
		this.#board = await new (this.globals.schema.board)(_board)
		this.#board.members = await this.#populateBoard(_board)	//	should convert board.members to array of Member objects
		return this
	}
	//	organization functions
	get board(){	//	#board is array of Member objects
		return this.#board
	}
	get boardListing(){
		return this.board.members.map(_boardMember=>{ return _boardMember.memberName })
	}
	get boardMembers(){
		return this.board.members	//	#board.members is an ordered array of Member objects
	}
	get corporateQuestions(){
		return [{
			role: 'user',
			content: `What is ${ this.name }'s mission?`
		},
		{
			role: 'assistant',
			content: this.mission
		},
		{
			role: 'user',
			content: `What are ${ this.name }'s values and how do they plan to do it?`
		},
		{
			role: 'assistant',
			content: this.values+' '+this.vision
		}]
	}
	get description(){
		return this.core.description
	}
	get mission(){
		return this.core.mission
	}
	get name(){
		return this.core.names[0]
	}
	get values(){
		return this.core.values
	}
	get vision(){
		return this.core.vision
	}
	//	private functions
	async #populateBoard(_board){
		//	convert promises to array of agents
		const _boardAgents = await Promise.all(
			await _board.members
				.map(async _boardMemberMbr_id=>{	//	find agent in board -- search for parent_id = board.id
					return await new Member( (await new Dataservices(_boardMemberMbr_id).init()) )	//	init service with mbr_id
						.init(_board.id)	//	request parent_id agent
				})
		)
		return _boardAgents	//	returns filterable array of member.agent(s)
	}
	//	had wanted to overload assignPrimingQuestions, but there is no true overload in js
}
//	exports
export {
	Member,
	MyLife,
}