require('dotenv').config()
const openai = require('openai')
const api_key = process.env.OPENAI_API_KEY
const api_endpoint = 'https://api.openai.com/v1/models/text-davinci-002'
const prompt = 'How do I train you on MyLife corporate materials?'
const max_tokens = process.env.OPENAI_MAX_TOKENS
const temperature = process.env.OPENAI_TEMP
// Set up a GPT-3 turbo instance
const openai_instance = new openai(
	api_key,
	{
		apiKey: api_key,
		model: api_endpoint,
	},
)
openai_instance.complete({
		prompt: prompt,
		maxTokens: max_tokens,
		temperature: temperature,
})
	.then(res => {
		console.log(res.data.choices[0].text)
	})
	.catch((err) => {
		console.error(err)
	})