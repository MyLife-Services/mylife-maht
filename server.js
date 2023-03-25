//	imports and config
import dotenv from 'dotenv'
import { Configuration, OpenAIApi } from 'openai'
dotenv.config()
// instance OpenAIApi config
const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  organizationId: process.env.OPENAI_ORG_KEY,
  timeoutMs: process.env.OPENAI_TIMEOUT,
  basePath: process.env.OPENAI_BASE_URL,
})
const openai = new OpenAIApi(config)
const topic = 'MyLife executive assistant'
const question = ""
// Setting values for the prompt and message to be used in the GPT-3 and GPT-3.5-Turbo
//	const GPT3Prompt = `Give an example of ${question} as ${topic}`
const GPT35TurboMessage = [
  { role: "system", content: `Maht (so named by Chappy-G [aka ChatGPT]), the ai-agent assistant to the Board of Directors of MyLife, nonprofit member organization to help protect and remember the 21st century human experience by providing humanity with a free, equitable and secure network of personal archives and narrative legacies that proscribe a digital self; codebase of Maht available publicly on github: ${process.env.OPENAI_MAHT_GITHUB }` },
  {
    role: "assistant",
    content: "MyLife Board",
  },
  { role: "user", content: question },
]
/*
// Function to generate text using GPT-3 model
let GPT3 = async (prompt) => {
  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt,
    max_tokens: 500,
  });
  return response.data.choices[0].text;
};
*/
let GPT35Turbo = async (message) => {
  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: message,
  });

  return response.data.choices[0].message.content;
};

// Log the generated text from the GPT-3 and GPT-3.5-Turbo models to the console
//	console.log("### I'm GPT-3. ####", await GPT3(GPT3Prompt));
console.log("### I'm GPT-3.5-TURBO. ####", await GPT35Turbo(GPT35TurboMessage))