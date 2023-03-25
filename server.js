const openai = require('openai')
const apiKey = 'YOUR_API_KEY_HERE'
// Set up a GPT-3 instance
const instance = new openai.GPT3({
	apiKey,
})
// Call the GPT-3 API
instance.complete({
		prompt: 'How do I train you on MyLife corporate materials?',
		maxTokens: 5,
})
	.then(res => {
		console.log(res.data.choices[0].text)
	})
	.catch((err) => {
		console.error(err)
	})