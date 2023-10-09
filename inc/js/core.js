//	imports
import EventEmitter from 'events'
import { OpenAIApi, Configuration } from 'openai'
import chalk from 'chalk'
import { abort } from 'process'
//	import { _ } from 'ajv'
//	server-specific imports
import { _ } from 'ajv'
import { assignProperties } from './factory.js'
// config
const config = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
const openai = new OpenAIApi(config)
const _humanCategories = ['Interests','Abilities','Preferences','Artifacts','Beliefs','Facts','Other']
const _organizationCategories = []
/*
const _agent = new Agent()
//	utility functions
	function mixin(target, ...sources) {
	  Object.assign(target, ...sources);
	}
*/
//	define independent export class for Agent
class Agent extends EventEmitter{	//	Agent is a decorator to another object that animates and personifies; is formed through Object.assign
	constructor(_agent){	//	is Member a reference in this case or a copy? If copy, then I can introduce an agent as .Object.assign()
		super()
		assignProperties(_agent,this)	//	construct properties from core
	}
	//	since will be composite object, can reference Factory from Member/MyLife
}
//	conceptually, could I make a combined class for the session that 'inherits' or 'composites' from a member and an agent?
//	define export Classes for Members and MyLife
class Member extends EventEmitter {
	#agent
	#categories = _humanCategories	//	base human categories [may separate into biological?ideological] of personal definitions for inc q's (per agent) for infusion
	#dataservice
	#factory
	#id
	#mbr_id
	#personalityKernal
	constructor(_Dataservice,_Factory){
		super()
		this.#dataservice = _Dataservice	//	individual cosmos dataservice by mbr_id
		this.#personalityKernal = openai	//	alterable, though would require different options and subelements, so should build into utility class
		this.#factory = _Factory
		assignProperties(this.#dataservice.core,this,{ 'id': true, 'mbr_id': true })	//	construct properties from core
		//	ensure foundation
		this.#id = this.#dataservice.core.id
		this.#mbr_id = this.#dataservice.core.mbr_id
	}
	/*
	async init(_id=false){
		if(!this?.agent){
			return this
			try{
				//	find existing dialog or create
				const _dialog = await this.dataservice.getItems('dialog','*',[{ name: '@parent_id', value: this.agent.id }])
				this.agent.dialog = new (this.factory.schema.dialog)(
					( _dialog.length )
					?	_dialog[0]
					:	{
							mbr_id: this.mbr_id,
							name: 'dialog_'+this.agent.name+'_'+this.agent.id,
							parent_id: this.agent.id,
						}
				)
				//	create new conversation (but wait until first chat to save)
				
				console.log(chalk.bgGreenBright('agent-init-succeeded'),chalk.greenBright(this.agent))

				//	add conversation pointer

				//	context curiosity
				//	self-property assignment based upon returns from openai
				if(!this.testEmitters()) console.log(chalk.red('emitter test failed'))
			} catch(e){
				console.log(chalk.bgRedBright('agent-init-failed'),chalk.redBright(e))
			}
		}
		
	}
	*/
	//	getter/setter functions
	get _agent(){	//	introspected agent
		return this.agent.inspect(true)
	}
	get agent(){	//	can only egest versions of its agent
		return async (_session_id,_id=this.id) => {
			return Object.assign({}, this, await( await this.factory.agent( await this.#getAgent(_id) )).init())
		}
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
		return this.tokenize(this.agentName)
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
	get chat(){
		if(!this.agent?.chat){	//	initialize dialog
			console.log(chalk.bgRedBright('agent-chat-not-initialized'),chalk.redBright(this.agent.name))
			throw new Error('agent chat not initialized')
		}
		return this.agent.chat
	}
	get dataservice(){
		return this.#dataservice
	}
	get dialog(){
		return this.agent.dialog
	}
	get factory(){
		return this.#factory
	}
	get id(){
		return this.sysid
	}
	get newid(){
		return this.factory.newGuid
	}
	get personality(){
		return this.#personalityKernal
	}
	get router(){
		return this.factory.router(this.agent)
	}
	get sysname(){
		return this.mbr_id.split('|')[0]
	}	
	get sysid(){
		return this.mbr_id.split('|')[1]
	}
	//	public functions
	async processChatRequest(ctx){
		//	gatekeeper/timekeeper
		let _timer = process.hrtime()
		//	throttle requests
		//	validate input
		//	store question
		let _question = ctx.request.body.message
		const _Exchange = new (this.factory.schema.exchange)({
			id: this.newid,
			input: new  (this.factory.schema.inputDialog)({
					id: this.newid,
					content: _question,
					contributor_mbr_id: ctx.session.MemberSession.mbr_id,
				})
		})	//	Exchange
		//	log input
		console.log(chalk.bgGray('dialog-exchange-input:'),_Exchange.input.inspect(true))
		//	transform input
		const aQuestion = [
			this.agentRole,	//	assign system role
			...await this.assignPrimingQuestions(_question),	//	assign few-shot learning prompts
			await this.formatQuestion(_question)	//	assign user question
		]
		console.log('aQuestion',aQuestion)
		//	insert ai-sniffer/optimizer	//	why won't anyone think of the tokens!?
		const _model = 'gpt-3.5-turbo'
		let _response = 'intercept from GPT-3.5-turbo'
	if(!true){
		_response = await this.personality.createChatCompletion({
			model: _model,
			messages: aQuestion,
		})
			.then(
				(_response)=>{
					//	response insertion/alteration points for approval, validation, storage, pruning
					//	challengeResponse(_response) //	insertion point: human reviewable
					_response = this.formatResponse(_response)
					return _response
				}
			)
			.catch(err=>{
				console.log(err)
				//	emit for server
			})
	}
		console.log(chalk.bgGray('chat-response-received'),_response)
		//	store response
		_timer = process.hrtime(_timer)
		_Exchange.output = new (this.factory.schema.outputDialog)({
			id: this.newid,
			content: _response,
			model: _model,
			processingTime: (_timer[0] * 1000) + (_timer[1] / 1e6),
		})
		//	this.chat.exchanges.unshift(_outputDialog.inspect(true),_inputDialog.inspect(true))	//	add to dialog [reverse chronological order]
		this.#dataservice.patchItem(
			this.chat.id,
			[
				{ op: 'add', path: `/exchanges/0`, value: _Exchange.input.inspect(true) },
				{ op: 'add', path: `/exchanges/0`, value: _Exchange.output.inspect(true) },
			]	//	add array value)
		)
		//	return response
		return _outputDialog.inspect(true)
	}
	//	question/answer functions
	async assignPrimingQuestions(_question){
		return this.buildFewShotQuestions(
			await this.fetchEnquiryMetadata(_question)	//	what question type category is this?
		)
	}
	buildFewShotQuestions(_category){
		const _fewShotQuestions = []
		switch(_category){
			case 'abilities':	//	abilities & skills
				_fewShotQuestions.push(
					this.chatObjectify(`${ this.memberName }'s abilities?`,false),
					this.chatObjectify(this.abilities),
					this.chatObjectify(`${ this.memberName }'s skills?`,false),
					this.chatObjectify(this.skills),
				)
				break
			case 'artifacts':	//	artifacts & possessions
			case 'beliefs':	//	beliefs & values
				_fewShotQuestions.push(
					this.chatObjectify(`${ this.memberName }'s beliefs?`,false),
					this.chatObjectify(this.beliefs),
					this.chatObjectify(`${ this.memberName }'s values?`,false),
					this.chatObjectify(this.values),
				)
				break
			case 'facts':	//	biological and historical facts
				_fewShotQuestions.push(
					this.chatObjectify(`Some of ${ this.memberName }'s biological facts?`,false),
					this.chatObjectify(this.facts.biological),
					this.chatObjectify(`Some of ${ this.memberName }'s historical facts?`,false),
					this.chatObjectify(this.facts.historical),
				)
				break
			case 'interests':	//	interests & hobbies
				_fewShotQuestions.push(
					this.chatObjectify(`${ this.memberName }'s interests?`,false),
					this.chatObjectify(this.interests),
					this.chatObjectify(`${ this.memberName }'s hobbies?`,false),
					this.chatObjectify(this.hobbies),
				)
				break
			case 'preferences':	//	preferences & beliefs
				_fewShotQuestions.push(
					this.chatObjectify(`${ this.memberName }'s preferences?`,false),
					this.chatObjectify(this.preferences),
					this.chatObjectify(`${ this.memberName }'s beliefs?`,false),
					this.chatObjectify(this.beliefs),
				)
				break
			case 'relations':
			case 'other':
			default:	//	motivations & beliefs
				_fewShotQuestions.push(
					this.chatObjectify(`${ this.memberName }'s motivations?`,false),
					this.chatObjectify(this.motivations),
					this.chatObjectify(`${ this.memberName }'s beliefs?`,false),
					this.chatObjectify(this.beliefs),
				)
				break
		}
		return _fewShotQuestions
	}
	chatObjectify(_content,_bAgent=true){
		return {
			role: (_bAgent)?'assistant':'user',
			content: _content
		}
	}
	async encodeQuestion(_question){
		const _model = 'text-davinci-001'
		const _youReference = await this.personality.createCompletion({
			model: _model,
			prompt: `Is "you" in quote likely referring to ai-agent, human, or unknown?\nQuote: "${_question}"\nRefers to:`,
			temperature: 0,
			max_tokens: 60,
			top_p: 1,
			frequency_penalty: 0.5,
			presence_penalty: 0,
		})
			.then(
				(_response)=>{
					//	response insertion/alteration points for approval, validation, storage, pruning
					//	challengeResponse(_response) //	insertion point: human reviewable
					return _response.data.choices[0].text.trim().toLowerCase()
				}
			)
			.catch(err=>{
				console.log(err)
				return 'unknown'	//	emit for server
			})
		//	youReference contains human
		if(_youReference.includes('human')){
			_question = _question.replace(/your/gi,`${this.memberName}'s`)	//	replace your with memberName's
			_question = _question.replace(/you/gi,this.memberName)	//	replace you with memberName
		}
		return _question
	} 
	async fetchEnquiryMetadata(_question){	// human core
		//	what is the best category for this question?
		const _model = 'text-davinci-001'
		const _category = await this.personality.createCompletion({
			model: _model,
			prompt: `What is the best category for this quote?\nCategories: ${ this.categories.toString() }\nQuote: \"${ _question }\"\nCategory:`,	//	user array of human categories
			temperature: 0,
			max_tokens: 60,
			top_p: 1,
			frequency_penalty: 0.5,
			presence_penalty: 0,
		})
			.then(
				(_response)=>{
					//	response insertion/alteration points for approval, validation, storage, pruning
					//	challengeResponse(_response) //	insertion point: human reviewable
					return _response.data.choices[0].text.trim().toLowerCase()
				}
			)
			.catch(err=>{
				console.log(err)
				//	emit for server
			})
		const _categoryModeler = await this.dataservice.getItems('categorization','*')
		if(_categoryModeler.length){	//	if storage easily accessible, use it
			const _update = (_categoryModeler[0]?.[_model])
				?	[{ op: 'add', path: `/${ _model }/-`, value: { [_category]: _question } }]	//	add array value
				:	[{ op: 'add', path: `/${ _model }`, value: [{ [_category]: _question }] }]	//	create array
			this.dataservice.patchItem(	//	temporary log; move to different db and perform async
	//	Error: PartitionKey extracted from document doesn't match the one specified in the header
				_categoryModeler[0].id,
				_update
			)
			console.log(chalk.bold.blueBright(_model,_category))
		}
		return _category
	}
	async formatQuestion(_question){
		if(this.form==='human') _question = await this.encodeQuestion(_question)
		return {
			role: 'user',
			content: _question
		}
	}
	formatResponse(_str){
		//	insert routines for emphasis
		const _response=this.detokenize(_str.data.choices[0].message.content)
			.replace(/(\s|^)mylife(\s|$)/gi, "$1<em>MyLife</em>$2")
		return _response
	}
//	misc functions
	detokenize(_str){
		return _str.replace(/<\|\|/g,'').replace(/\|\|>/g,'')
	}
	async testEmitters(){
		//	test emitters with callbacks
		this.emit('testEmitter',_response=>{
			console.log('callback emitters enabled:',_response)
		})
	}
	tokenize(_str){
		return '<||'+_str+'||>'
	}
	//	private functions
	async #createAgent(){
		const _agentProperties = {
			id: this.newid,
			being: 'agent',
			command_word: this.sysname,
			description: `I am ${ this.sysname }, AI-Agent for ${ this.memberName }`,	//	should ultimately inherit from core agent
			mbr_id: this.mbr_id,
			name: `agent_${ this.sysname }`,
			names: [this.sysname, 'AI-Agent'],
			nickname: this.sysname,
			parent_id: this.sysid,
			purpose: `Be a personal superintelligent digital agent for human ${ this.memberName }`,
		}
		await this.dataservice.pushItem(_agentProperties)
		console.log(chalk.bgCyanBright(`default core agent created for ${ this.mbr_id }`),_agents[0].inspect(true))
		return _agentProperties
	}
	async #getAgent(_id=false){
		//	get agent
		if(_id){	//	id could be for [id] | [parent_id]
			//	1. test for direct agent id
			let _agent = await this.dataservice.getItem(_id)
			if(_agent!==undefined)
				return await this.factory.agent(_agent,this)
			//	2. test for agent parent_id (example: board)
			_agent = (await this.dataservice.getItems('agent','*',[{ name: '@parent_id', value: _id }]))[0]
			if(_agent!==undefined){
				return await this.factory.agent(_agent,this)
			}
			throw new Error(`agent not found for id: ${ _id }`)
		}
		//	3. test for default agent
		if(this?.defaultAgent)
			return this.factory.agent(await this.dataservice.getItem(this.defaultAgent),this)
		const _agents = await this.dataservice.getAgents()	//	retrieve member's available agents from db as array
		if(!_agents.length){	//	create agent
			_agents.push(await this.#createAgent())
		}
		_agent = await this.factory.agent(_agents[0],this)	//	agent
		//	update core
		this.defaultAgent = _agent.id
		this.dataservice.patchItem(this.sysid, [{ op: 'add', path: `/defaultAgent`, value: this.defaultAgent }])	//	no need to await
		return _agent
	}
	#hasAgentAccess(_agent){
		return true	//	is now based on server-hosted objects, owner-member is always presenting the agent, no proxies
	}
}
//=========================================================
//	MyLife Organization
//=========================================================
class MyLife extends Member {	//	form=organization
	#Hosted = JSON.parse(process.env.MYLIFE_HOSTED_MBR_ID)
	#Menu
	#Router
	board
	constructor(_Dataservice,_Factory){	//	inject factory to keep server singleton
		super(_Dataservice,_Factory)
	}
	async processChatRequest(ctx){	//	determine if first submission is question or subjective sentiment [i.e., something you care about]
		if(!ctx.session?.bInitialized){
			ctx.request.body.message = await this.#isQuestion(ctx.request.body.message)
			ctx.session.bInitialized = true
		}
		return await super.processChatRequest(ctx)
	}
	async assignPrimingQuestions(_question){	//	corporate version
		return this.buildFewShotQuestions(
			await this.fetchEnquiryType(_question)	//	what question type is this?
		)
	}
	buildFewShotQuestions(_questionType){
		//	cascade through, only apply other if no length currently [either failed in assigned case or was innately other]
		const _fewShotQuestions = []
		switch(_questionType){
			case 'products': case 'services':	//	 services & roadmap 
				_fewShotQuestions.push(
					this.chatObjectify(`${ this.name }'s services?`,false),
					this.chatObjectify(this.services),
					this.chatObjectify(`${ this.name }'s technical roadmap?`,false),
					this.chatObjectify(this.roadmap),
				)
				break
			case 'customer': case 'support':	//	membership & services
				_fewShotQuestions.push(
					this.chatObjectify(`${ this.name }'s registration?`,false),
					this.chatObjectify(this.membership),
					this.chatObjectify(`${ this.name }'s services?`,false),
					this.chatObjectify(this.services),
				)
				break
			case 'security':	//	security & privacy
				_fewShotQuestions.push(
					this.chatObjectify(`${ this.name }'s security?`,false),
					this.chatObjectify(this.security),
					this.chatObjectify(`${ this.name }'s privacy policy?`,false),
					this.chatObjectify(this.privacy),
				)
				break
			case 'business': case 'info':	//	governance & vision
				_fewShotQuestions.push(
					this.chatObjectify(`${ this.name }'s governance?`,false),
					this.chatObjectify(this.governance),
					this.chatObjectify(`${ this.name }'s vision?`,false),
					this.chatObjectify(this.vision),
				)
				break
			case 'values':	//	values & philosophy
				_fewShotQuestions.push(
					this.chatObjectify(`${ this.name }'s values?`,false),
					this.chatObjectify(this.values),
					this.chatObjectify(`${ this.name }'s philosophy?`,false),
					this.chatObjectify(this.philosophy),
				)
				break
			case 'technology':	//	roadmap & security
				_fewShotQuestions.push(
					this.chatObjectify(`${ this.name }'s technical roadmap?`,false),
					this.chatObjectify(this.roadmap),
					this.chatObjectify(`${ this.name }'s security?`,false),
					this.chatObjectify(this.security),
				)
				break
			case 'other':
			default:
				if(_fewShotQuestions.length <= 2){	//	if populated, requires user<->agent interaction
					_fewShotQuestions.push(
						this.chatObjectify(`${ this.name }'s mission?`,false),
						this.chatObjectify(this.mission),
						this.chatObjectify(`${ this.name }'s vision?`,false),
						this.chatObjectify(this.vision),
					)
				}
		}
		return _fewShotQuestions
	}
	async challengeAccess(_mbr_id,_passphrase){	//	if possible (async) injected into session object
		//	ask global data service (stored proc) for passphrase
		return await this.dataservice.challengeAccess(_mbr_id,_passphrase)
	}
	async fetchEnquiryType(_question){	//	categorize, log and return
		const _model = 'text-babbage-001'
		const _category = await this.personality.createCompletion({
			model: _model,
			prompt: `Give best category for Phrase about the nonprofit company MyLife.org\nCategories: ${ this.categories.toString() }\nPhrase: \"${ _question }\"\nCategory:`,
			temperature: 0,
			max_tokens: 32,
			top_p: 1,
			frequency_penalty: 0.5,
			presence_penalty: 0,
		})
			.then(
				(_response)=>{
					//	response insertion/alteration points for approval, validation, storage, pruning
					//	challengeResponse(_response) //	insertion point: human reviewable
					return _response.data.choices[0].text.trim().toLowerCase()
				}
			)
			.catch(err=>{
				console.log(err)
				return 'other'
				//	emit for server
			})
		const _categoryModeler = await this.dataservice.getItems('categorization','*')
		if(_categoryModeler.length){	//	if storage easily accessible, use it
			const _update = (_categoryModeler[0]?.[_model])
				?	[{ op: 'add', path: `/${ _model }/-`, value: { [_category]: _question } }]	//	add array value
				:	[{ op: 'add', path: `/${ _model }`, value: [{ [_category]: _question }] }]	//	create array
			this.dataservice.patchItem(	//	temporary log; move to different db and perform async
	//	Error: PartitionKey extracted from document doesn't match the one specified in the header
				_categoryModeler[0].id,
				_update
			)
			console.log(chalk.bold.blueBright(_model,_category))
		}
		return _category
	}
	async formatQuestion(_question){
		//	question formatting
		return super.formatQuestion(_question)
	}
	//	getters/setters
	get #Board(){
		return this.factory.board
	}
	get board(){
		//	board requires db call to .board (async) to populate
		this.board ??= new (this.#Board)()
		this.factory.board = this.board(await this.dataservice.getBoard())
		console.log(this.board)
		return async ()=>{	//	Board object
			this.#Board ??= await this.#Board
		}
		return this.board 
	}
	get boardListing(){
		return this.boardMembers.map(_boardMember=>{ return _boardMember.memberName })
	}
	get boardMembers(){
		return this.board.members	//	board.members is an ordered array of Member objects
	}
	get hosted(){	//	returns array of members hosted on this instance
		return this.#Hosted
	}
	get menu(){
		this.#Menu ??= this.factory.menu(this).menu
		return this.#Menu
	}
	//	private functions
	async #isQuestion(_question){	//	question or statement?
		const _model = 'curie-instruct-beta'
		await openai.createCompletion({
			model: _model,
			prompt: `Is the phrase: \"${_question}\", a question (yes/no)?`,
			temperature: 0,
			max_tokens: 12,
			top_p: 0.52,
			best_of: 3,
			frequency_penalty: 0,
			presence_penalty: 0,
		})
			.then(
				(_response)=>{
					//	response insertion/alteration points for approval, validation, storage, pruning
					//	challengeResponse(_response) //	insertion point: human reviewable
					//	add relevence question
					if(_response.data.choices[0].text.trim().toLowerCase().replace('\n','').includes('no')) _question += ', how can MyLife help?'
				})
		return _question
	}
}
//	exports
export {
	Agent,
	Member,
	MyLife,
}