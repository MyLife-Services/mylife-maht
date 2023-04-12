//	ai - create sub-file to include
import { OpenAIApi, Configuration } from 'openai'
import fs from 'fs'
import ai_dotenv from 'dotenv'
import EventEmitter from 'events'
//	module variables
const emitter = new EventEmitter()
const config = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
const openai = new OpenAIApi(config)
//	pseudo-constructors
ai_dotenv.config()
//	TEMP functions
function triggerEmissions(_data) {
// Emit a request with data to the parent, containing any datatype, including a function; perhaps also any x# of params, but irrelevant for now
	emitter.emit('commit',_data)
}
//	PUBLIC functions
function getAssistant(){
	return process.env.MYLIFE_MBR_ID.split('|')[0]	//	first object is system name
}
async function processRequest(_question,_agent='me'){
	//	pre-vet, trim, approve(?) input
	
	// assign histories and roles
	//	assignHistory(_question)
	const aQuestion = assignRoles(_agent)	//	returns array of objects
		.push(assignQuestion(_question))
		.push(assignSummary(_question))	//	ask gpt-engine to self-summarize
	console.log(aQuestion)
	const _response = await openai.createChatCompletion({
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
	challengeResponse(_response) //	insertion point: human reviewable
	return formatResponse(_response)
}
//	PRIVATE functions
function assignHistory(_question){
	//	assignSessionHistory
	//	assignPersonalHistory
}
function assignQuestion(_question){
	return {
			role: 'user',
			content: _question
		}
}
function assignRoles(_agent){
	switch(_agent){
		case 'opera':
			return getOpera()
		case 'question':
			return getQuestion()
		default:
			//	or instead consider personal assistant to be default?
			return getMe()
	}
}
function assignSummary(_question){
	return {
		role: 'assistant',
		content: _question
	}
}
function challengeResponse(){

}
function formatResponse(_response){
	//	insert routines for emphasis
	_response=_response.data.choices[0].message.content
	_response=_response.replace(/(\s|^)mylife(\s|$)/gi, "$1<em>MyLife</em>$2")
	return _response
}
function getMe(oMember){
	oMember = oMember.privacy.member
	return [
		{
			role: 'system',
			content: `I am ${getAssistant()}, ai-assistant to: ${oMember.contact.name}. ${oMember.personality.bio}, interests: ${oMember.personality.interests.toString()}. His focused passion is now developing MyLife, founded in 2021. MyLife is a nonprofit member-based organization aiming to protect and preserve the authentic and genuine 21st-century human experience. It offers a free, secure, and equitable network for personal archives and narrative legacies, helping individuals create and curate their Digital Selves.`
		},
		{
			role: "user",
			content: "Summarize our conversation"
		},
		{
			role: "assistant",
			content: "Exploring the role and potential of AI in enhancing human well-being and personal growth while being mindful of potential risks and ethical considerations. Our discussions have touched on topics such as privacy, data security, algorithmic bias, and the use of AI models to represent individuals in the digital sphere. We have considered the potential benefits and challenges of using AI technology in various contexts and have emphasized the importance of responsible development and use of AI."
		}
	]
}
export {
	//	public functions
	getAssistant,
	processRequest,
	emitter,
}