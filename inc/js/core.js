//	imports
import EventEmitter from 'events'
import { OpenAIApi, Configuration } from 'openai'
import chalk from 'chalk'
import { abort } from 'process'
//	import { _ } from 'ajv'
import Dataservices from './mylife-data-service.js'
//	server-specific imports
import initRouter from './routes.js'
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
	agentBeacons = []
	#categories = ['Interests','Abilities','Preferences','Artifacts','Beliefs','Facts','Other']	//	base human categories [may separate into biological?ideological] of personal definitions for inc q's (per agent) for infusion
	#core
	#dataservice
	#excludeProperties = { '_none':true }
	#globals
	#mbr_id
	#personalityKernal
	constructor(_Dataservice,_Globals){
		super()
		this.#dataservice = _Dataservice	//	individual cosmos dataservice by mbr_id
		this.#personalityKernal = openai	//	alterable, though would require different options and subelements, so should build into utility class
		this.#globals = _Globals
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
		this.agentBeacons.push(this.id)
	}
	//	initialize
	async init(_agent_parent_id=this.globals.extractId(this.mbr_id)){
		if(!this?.agent) {	//	create agent
			const _agentProperties = await this.dataservice.getAgent(_agent_parent_id)	//	retrieve agent from db
			this.agent = await new (this.globals.schema.agent)(_agentProperties)	//	agent
			this.agent.name = `agent_${ this.agentName }_${ this.mbr_id }`
			this.agent.categories = this.agent?.categories??this.#categories	//	assign categories
			console.log(chalk.bgCyanBright('agent-chat-init'),chalk.cyanBright(this.agent.description))
			const _conversation = await this.dataservice.getChat(this.agent.id)	//	send in agent id for pull
			this.agent.chat = await new (this.globals.schema.conversation)(_conversation)	//	agent chat assignment
			if(!this.testEmitters()) console.log(chalk.red('emitter test failed'))
		}
		return this
	}
	//	getter/setter functions
	get _agent(){	//	introspected agent
		return this.agent.inspect(true)
	}
	get abilities(){
		return this.core.abilities
	}
	get agent(){
		return this.#agent
	}
	set agent(_agent){	//	must be instance of agent already
		if(!this.#hasAgentAccess(_agent)) throw new Error('agent not known or not available to member')
		this.#agent = _agent
	}
	get agentCategories(){
		return this.agent.categories
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
				const replacedDescription = 'I am <||Q||>, AI-Agent for the nonprofit member organization MyLife'
				return {
						role: "system",
						content: replacedDescription
					}
/*
				const regex = new RegExp(this.agentName, 'g')
				const replacedDescription = this.agentDescription.replace(regex, this.agentName_tokenized)
				return {
						role: "system",
						content: replacedDescription + ' ' + this.agentProxy
					}
*/					
		}
	}
	get being(){
		return this.core.being
	}
	get beliefs(){
		return this.core.beliefs
	}
	get bio(){
		return this.core.bio
	}
	get categories(){
		return this.agent.categories
	}
	get chat(){
		return this.agent.chat
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
	get facts(){
		return this.core.facts
	}
	get form(){
		return this.core.form
	}
	get globals(){
		return this.#globals
	}
	get hobbies(){
		return this.core.hobbies
	}
	get interests(){
		return this.core.interests
	}
	get id(){
		return this.sysid
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
	get personality(){
		return this.#personalityKernal
	}
	get preferences(){
		return this.core.preferences
	}
	get skills(){
		return this.core.skills
	}
	get sysname(){
		return this.mbr_id.split('|')[0]
	}	
	get sysid(){
		return this.mbr_id.split('|')[1]
	}
	get values(){
		return this.core.values
	}
	//	public functions
	async processChatRequest(ctx){
		//	gatekeeper
		//	throttle requests
		//	validate input
		//	store question
		let _question = ctx.request.body.message
		const _chatSnippetQuestion = new (this.globals.schema.chatSnippet)({	//	no trigger to set
			content: _question,
			contributor: this.mbr_id,
			role: 'user',
			timestamp: new Date().toISOString(),
		})
		//	log input
		console.log(chalk.bgGray('chat-request-received:'),chalk.bgWhite(` ${_question}`),_chatSnippetQuestion)
		//	transform input
		const aQuestion = [
			this.agentRole,	//	assign system role
//			...await this.assignPrimingQuestions(_question),	//	assign few-shot learning prompts
			await this.formatQuestion(_question)	//	assign user question
		]
		console.log('aQuestion',aQuestion)
		//	insert ai-sniffer/optimizer	//	why won't anyone think of the tokens!?
		const _model = process.env.OPENAI_MODEL_MAHT
		console.log('model=', process.env.OPENAI_MODEL_MAHT)
		const _response = await this.personality.createChatCompletion({
			model: _model,
			messages: aQuestion,
	//		git: { repo: 'https://github.com/MyLife-Services/mylife-maht' },
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
		console.log(chalk.bgGray('chat-response-received'),_response)
		//	store response
		const _chatSnippetResponse = new (this.globals.schema.chatSnippet)({	//	no trigger to set
			content: _response,
			timestamp: new Date().toISOString(),
		})
		//	this.chat.exchanges.unshift(_chatSnippetResponse.inspect(true),_chatSnippetQuestion.inspect(true))	//	add to conversation [reverse chronological order]
		this.#dataservice.patchItem(
			this.chat.id,
			[
				{ op: 'add', path: `/exchanges/0`, value: _chatSnippetQuestion.inspect(true) },
				{ op: 'add', path: `/exchanges/0`, value: _chatSnippetResponse.inspect(true) },
			]	//	add array value)
		)
		//	return response
		return _response
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
	#hasAgentAccess(_agent){
		return (
			this.agentBeacons	//	agent must be on beacon list
				.filter(_=>{
					return _===_agent?.parent_id || this.mbr_id===_agent.mbr_id 
				})	//	member must have rights to agent, cooperative or core
				.length
		)	
	}
}
class MyLife extends Member {	//	form=organization
	#Menu
	#Router
	board
	constructor(_Dataservice,_Globals){
		super(_Dataservice,_Globals)
	}
	//	public functions
	async init(){
		//	assign board array
		await super.init()
		const _board = await this.dataservice.getBoard()	//	get current list of mbr_id
		this.board = await new (this.globals.schema.board)(_board)
		this.agentBeacons.push(this.board.id)	//	board can host agents
		this.board.members = await this.#populateBoard(_board)	//	convert board.members to array of Member objects
		return this
	}
	async processChatRequest(ctx){	//	determine if first submission is question or subjective sentiment [i.e., something you care about]
/* testing fine-tuned model, remove priming questions
		if(!ctx.session?.bInitialized){
			ctx.request.body.message = await this.#isQuestion(ctx.request.body.message)
			ctx.session.bInitialized = true
		}
*/
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
	get board(){	//	board is array of Member objects
		return this.board 
	}
	get boardListing(){
		return this.boardMembers.map(_boardMember=>{ return _boardMember.memberName })
	}
	get boardMembers(){
		return this.board.members	//	board.members is an ordered array of Member objects
	}
	get description(){
		return this.core.description
	}
	get governance(){
		return this.core.governance
	}
	get membership(){
		return this.core.membership
	}
	get menu(){
		if(!this.#Menu){
			this.#Menu = new (this.globals.schemas.menu)(this).menu
		}
		return this.#Menu
	}
	get mission(){
		return this.core.mission
	}
	get name(){
		return this.core.names[0]
	}
	get philosophy(){
		return this.core.philosophy
	}
	get privacy(){
		return this.core.privacy
	}
	get roadmap(){
		return this.core.roadmap
	}
	get router(){
		if(!this.#Router){
			this.#Router = initRouter(this, new (this.globals.schemas.menu)(this))
		}
		return this.#Router
	}
	get security(){
		return this.core.security
	}
	get services(){
		return this.core.services
	}
	get values(){
		return this.core.values
	}
	get vision(){
		return this.core.vision
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
	async #populateBoard(_board){
		//	convert promises to array of agents
		const _boardAgents = await Promise.all(
			await _board.members
				.map(async _boardMemberMbr_id=>{	//	find agent in board -- search for parent_id = board.id
					return await new Member( (await new Dataservices(_boardMemberMbr_id).init()),this.globals )	//	init service with mbr_id
						.init(_board.id)	//	request parent_id agent
				})
		)
		return _boardAgents	//	returns filterable array of member.agent(s)
	}
}
//	exports
export {
	Member,
	MyLife,
}