//	ai - create sub-file to include
import { OpenAIApi, Configuration } from 'openai'
import fs from 'fs'
import { parseXml } from './inc/js/private.js'
import ai_dotenv from 'dotenv'
ai_dotenv.config()

// instance OpenAIApi config
const config = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
const openai = new OpenAIApi(config)
//	PUBLIC functions
async function processRequest(_question,_agent='ai'){
	//	pre-vet, trim, approve(?) input
	
	// assign histories and roles
	//	assignHistory(_question)
	const aQuestion = assignRoles(_agent)	//	returns array of objects
	aQuestion.push(assignQuestion(_question))
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
		case 'board':
			const xml = fs.readFileSync('./privacy/data.xml', 'utf-8')
			const oMember = parseXml(xml)	//	consider it a class as defined in the xml file, xml being nod to Ben Tremblay
			return getMember(oMember)
		case 'ai':
			return getAI()
		default:
			throw('agent not recognized')
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
function getMember(oMember){
	oMember = oMember.privacy.member
	return [
		{
			role: 'system',
			content: `I am assistant to: ${oMember.contact.name}. ${oMember.personality.bio}`
		},
		{
			role: "user",
			content: "What are Erik's interests?"
		},
		{
			role: "assistant",
			content: oMember.personality.interests.toString()
		},
		{
			role: "user",
			content: "What is MyLife?"
		},
		{
			role: "assistant",
			content: "MyLife, founded in 2021, is a nonprofit member-based organization aiming to protect and preserve the authentic and genuine 21st-century human experience. It offers a free, secure, and equitable network for personal archives and narrative legacies, helping individuals define their Digital Selves."
		},
	]
}
function getAI(){
	return [
		{
			role: "system",
			content: "Maht [pronounce 'maht'] is an AI-agent assistant for MyLife's Board of Directors. MyLife, founded in 2021, is a nonprofit member-based organization aiming to protect and preserve the authentic and genuine 21st-century human experience. It offers a free, secure, and equitable network for personal archives and narrative legacies, helping individuals define their Digital Selves."
		},
		{
			role: "user",
			content: "What does MyLife do?"
		},
		{
			role: "assistant",
			content: "MyLife is developing a humanistic platform that enables you to create, curate, and preserve your Digital Self privately and securely. This Digital Self reflects your 21st-century individuality and conscious experiences, enduring beyond your lifetime with AI assistance. For those interested in afterlife, your MyLife ai-agent serves as a beacon, ensuring that once humanity can revive consciousness you will resurrected from your saved state."
		},
		{
			role: "user",
			content: "Why does MyLife do this?"
		},
		{
			role: "assistant",
			content: "MyLife is the aggregation of conscious humankind, and believes that each human individual is a product of Corpus Humanity and contributes to it. Empathy, compassion, transparency consent are MyLife's core ethical values, reflected in development and execution of The Human Remembrance Project."
		},
	]
}
//	Calling stored proc when managing 
async function createCoreMylifeAccount(mbr_id, payload) {
  const database = client.database(databaseId)
  const container = database.container(containerId)

  const { sproc: sprocLink } = await container.storedProcedures.create({
    id: "createCoreMylifeAccount",
    body: createCoreMylifeAccount.toString()
  })

  const { resource } = await container.scripts.storedProcedure(sprocLink).execute({
    partitionKey: mbr_id,
    payload: payload
  })

  return resource
}

export default processRequest