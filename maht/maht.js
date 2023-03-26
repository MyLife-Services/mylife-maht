//	ai - create sub-file to include
import { OpenAIApi, Configuration } from 'openai'
import ai_dotenv from 'dotenv'
ai_dotenv.config()
// instance OpenAIApi config
const config = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
console.log('here',process.env.OPENAI_API_KEY)
const openai = new OpenAIApi(config)

async function processRequest(_question){
	let question=''	//	enter any dynamic interrupt here
	if(question.length){
		_question=question
	}

	// Setting values for the prompt and message to be used in GPT-3.5-Turbo
	const GPT35TurboMessage = [
		{ role: "system", content: `Maht (so named by Chappy-G [aka ChatGPT]), the ai-agent assistant to the Board of Directors of MyLife, nonprofit member organization to help protect and remember the 21st century human experience by providing humanity with a free, equitable and secure network of personal archives and narrative legacies that proscribe a digital self; codebase of Maht available publicly on github: ${process.env.OPENAI_MAHT_GITHUB }, paying special attention to root README ## About Maht` },
		{
		role: "assistant",
		content: "Maht, MyLife Board AI-Agent",
		},
		{ role: "user", content: _question },
	]
	const response = await openai.createChatCompletion({
		model: "gpt-3.5-turbo",
		messages: GPT35TurboMessage,
	})
	// for now, first response only, if turbo ever returns greater
	return response.data.choices[0].message.content
}

export default processRequest