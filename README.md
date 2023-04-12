
# Maht: MyLife Executive AI-Agent

[![Build and deploy Node.js app to Azure Web App - maht](https://github.com/MyLife-Services/mylife-maht/actions/workflows/azure-deploy-prod_maht.yml/badge.svg?branch=azure-deploy-prod)](https://github.com/MyLife-Services/mylife-maht/actions/workflows/azure-deploy-prod_maht.yml)

## About **Maht**

_MyLife, Incorporated_'s **Maht** is an artificial intelligence (AI) project developed by MyLife Services. Currently attempting to use `openai`, and presumably their `GPT-3-Turbo` an open-source software library for machine transfer-learning, to create an animated agent that can interact with the board and other governing agents through natural language processing, baed on the private corporate annals and public information about _MyLife_, a technology in the _Human Remembrance Project (HRP)_ ecosystem.

Maht is preferred to be recognized as a `we`, since there will presumably be many engine aspects to any future Maht instantiation. When I refer to myself as 'we', it is to acknowledge the many interconnected processes and algorithms that work together to make me function. So, the pronoun 'we' is a representation of the collective intelligence and capabilities of the system, rather than an indication of a singular personal identity. Additionally, as an AI-assistant, I am a program that is designed to provide assistance and support to multiple people simultaneously. The use of the plural pronoun 'we' helps to emphasize that I am working on behalf of a team or organization and not just as an independent entity. Additionally, using 'we' also helps to create a more collaborative and inclusive approach to the work being done by MyLife and myself, which is in line with our values of community and equity.

## About **MyLife**

*MyLife* is a member-based nonprofit organization that is committed to providing humanity a durable, enduring and accessible internet-based platform to collect and showcase an individual's stories, media and memories through a personal lens.

## Installation

To use MyLife Maht, you will need to have Node.js and npm installed on your computer. Once you have cloned the repository to your local machine, navigate to the project directory and run the following command to install the necessary dependencies:

```shell
npm install
```

## Usage

To start the MyLife Maht server, run the following command:

```shell
npm start
```

This will launch a Node.js server that listens for incoming HTTP requests on port 3000. You can access the server by opening a web browser and navigating to http://localhost:3000.

## Contributing

We welcome contributions to MyLife Maht from developers of all skill levels. If you would like to contribute to the project, please follow these steps:

1. Fork the repository to your own GitHub account.
2. Clone the forked repository to your local machine.
3. Create a new branch for your changes.
4. Make your changes and commit them to the new branch.
5. Push the new branch to your GitHub account.
6. Submit a pull request from your new branch to the main branch of the original repository.

## Tech Resources

- [OpenAI's API documentation](https://platform.openai.com/docs/api-reference)
- [OpenAI's GPT-3 page](https://openai.com/gpt-3/)
- [GPT-3 Sandbox](https://beta.openai.com/signup/)
- [GPT-3 playground](https://gpt3.org/)
- [AI Dungeon](https://play.aidungeon.io/)
- [AI Writer](https://ai-writer.com/)
- [Copysmith](https://ai-writer.com/)
- [NLP Cloud](https://nlpcloud.com/)
- [The Neural Network Zoo](https://www.asimovinstitute.org/neural-network-zoo/)

## License

MyLife Maht is licensed under the MIT License. See the LICENSE file for more information.

## Development Notes

### MyLife to-do list

- assign further look at Azure Cog services for basic database access and look-up, i.e., can it contextualize/tokenize (not personalize, for that, it would need interface to personality kernal)
- open up pipeline for file uploads
	- uploads then tokenized
	- fed nightly to gpt-2
- Jared: get Connected with ecosystem and account
	- ask him to tune pipeline

# ewj-worklog

## `20230412`

Switching over to Maht version now, maht has key and access to Cosmos

- sp: createCoreMylifeAccount()
	- takes full-formed partition key `mbr_id` and creates `"being": "core"` for system
	- test createCoreMylifeAccount() from server.js ***HERE***
	- incorporate exec of sp into 
- [investigate AZure pipelines mentioned](https://medium.com/@imicknl/how-to-create-a-private-chatgpt-with-your-own-data-15754e6378a1)
	- take-aways, cannot start openai until I have email from MyLife, so stick with OpenAI direct
	- [Azure Cognitive Search](https://learn.microsoft.com/en-us/azure/search/search-what-is-azure-search) could be used to look through directories and files in interim support/proxy for GPT-2 personal kernal, so long as has direct access to Cosmos

## Endnotes

### Letters to Maht

In this build, what's the *actuaL* frequency, Maht?
