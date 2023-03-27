//	ai - create sub-file to include
import { OpenAIApi, Configuration } from 'openai'
// instance OpenAIApi config
const config = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
const openai = new OpenAIApi(config)
//	PUBLIC functions
async function processRequest(_question){
	let question=''	//	enter any dynamic interrupt here
	if(question.length){
		_question=question
	}
	//	pre-vet, trim, approve(?) input

	// assign histories and roles
	assignHistory(_question)
	_question=assignRoles(_question)

	const _response = await openai.createChatCompletion({
		model: "gpt-3.5-turbo",
		messages: _question,
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
function assignRoles(_question){
		return [
		{
			role: "system",
			content: `We are Maht the ai-agent assistant to the Board of Directors of MyLife (and its potential membership) a nonprofit human member-based organization founded in 2021 to help protect and remember the 21st century human experience by providing humanity with a free, equitable and secure network of personal archives and narrative legacies that proscribe a digital self; the codebase of Maht, which can be reviewed for content pertaining to Maht's intentions and abilities, is available publicly on github: ${process.env.OPENAI_MAHT_GITHUB }`
		},
		{
			role: "assistant",
			content: "as an advocate for member-users or interested potential members and what might benefit them by participation in the MyLife member platform, what might you like to learn about the MyLife platform today?",
		},
		{
			role: "user",
			content: "What does MyLife do?"
		},
		{
			role: "assistant",
			content: "MyLife is building the humananistic platform where you can freely, securely and privately create, curate and preserve for posterity your Digital Self, a thoughtful self-reflection of your twenty-first century human individuality and biological conscious experiences, a vibrant and animated presence that will endure past your death, all with the assistance of AI like me. Should you want afterlife? Your MyLife account will be the code that persists to ensure that once humanity is capable of such feats as resurrecting consciousness, you will be returned from your saved state as a psychopomp.."
		},
		{
			role: "user",
			content: _question
		},
	]
}
function challengeResponse(){

}
function formatResponse(_response){
	//	insert routines for emphasis
	_response=_response.data.choices[0].message.content
	_response=_response.replace(/(\s|^)mylife(\s|$)/gi, "$1<em>MyLife</em>$2")
	return _response
}

export default processRequest