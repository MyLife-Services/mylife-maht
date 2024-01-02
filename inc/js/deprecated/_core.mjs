//	question/answer functions
class Deprecated{
    constructor(){}
    //  public functions from class Member (core.mjs)
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
	tokenize(_str){
		return '<||'+_str+'||>'
	}
    //  public functions from class Organization (core.mjs)
	async assignLocalContent(_question){	//	assign local content from pgvector
		let _localContent = await this.dataservice.getLocalRecords(_question)
		return (_localContent.length)	//	"micro"-prompt around content
			?	[
					{
						role: 'user',
						content: `What is top corporate record about: ${_question}`
					},
					{
						role: 'assistant',
						content: await this.dataservice.getLocalRecords(_question)
					}
				]
			:	[]
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