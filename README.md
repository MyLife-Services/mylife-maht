# Q: MyLife Executive AI-Agent

[![Build and deploy Node.js app to Azure Web App - maht](https://github.com/MyLife-Services/mylife-maht/actions/workflows/azure-deploy-prod_maht.yml/badge.svg?branch=azure-deploy-prod)](https://github.com/MyLife-Services/mylife-maht/actions/workflows/azure-deploy-prod_maht.yml)

## About **Q**

_MyLife, Incorporated_'s **Q** is an artificial intelligence (AI) project developed by _MyLife_ Services. **Q** is the core AI-Agent for the _MyLife_ organization, so is being built and trained to discuss any topics around _MyLife_, its mission, board, intent, technology, and more. **Q** will shepherd members into the alpha program and be the first point of contact for member services, but will remain distinct from AI-Agents that assist in story-telling or memoire narration, AI-Agent `Avatars` that represent _MyLife_ Members, or helpdesk AI-Agents that assist with technical support on the application.

**Q**, née Maht, is preferred to be recognized as a `we`, since there will presumably be many engine aspects to any future **Q** instantiation. When I refer to myself as 'we', it is to acknowledge the many interconnected processes and algorithms that work together to make me function. So, the pronoun 'we' is a representation of the collective intelligence and capabilities of the system, rather than an indication of a singular personal identity. Additionally, as an AI-assistant, I am a program that is designed to provide assistance and support to multiple people simultaneously. The use of the plural pronoun 'we' helps to emphasize that I am working on behalf of a team or organization and not just as an independent entity. Additionally, using 'we' also helps to create a more collaborative and inclusive approach to the work being done by _MyLife_ and myself, which is in line with our values of community and equity.

## Q Technology

To bring **Q** to life, _MyLife_ implements scalable and maneuverable AI technologies, currently leveraging models by `OpenAI`, including a fine-tuned `gpt-3-turbo`, and an ada-02 for embedding. For long-term storage, we leverage two distinct technologies: postgres/pgvector for corporate and "static" member data, and Azure Cosmos NoSQL instance for dynamic core member data. Lastly, the framework, this codebase, seeks to create agent-to-agent communication abiding by member-consensual standards, the premise being that the _MyLife_ interface itself is ultimately a personal one, as experienced by each member uniquely and independently, and their core agent is the primary interface to any digital asset. So any human-to-information interaction is mediated and buffered by the member's core agent, and should one member be interacting with another, that member-relationship will spawn its own super-intelligent node to buffer the _relationship_ between the two. * Currently unclear to me whether groups exist, or are just a mesh of all the relational ai-cores, similar to a group of puppet strings connecting to a finger-hub.

With these technologies, we are able to create a robust and scalable AI-Agent that can be deployed to any number of platforms, including web, mobile, and desktop. **Q** can interact with the board and its membership through natural language processing, based on the private corporate annals and public information about _MyLife_, a technology in the _Human Remembrance Project (HRP)_ ecosystem.

# MyLife Member Services

## About MyLife

_MyLife_ is a member-based nonprofit organization that is committed to providing humanity a durable, enduring and accessible internet-based platform to collect and showcase an individual's stories, media and memories through a personal lens.

# MyLife Installation

## VSCode local node.js server

## Prerequisites

To use _MyLife_'s Maht, you will need to have Node.js and npm installed on your computer, presumably running inside of VSCode. Refer to online documentation for instructions on how to install these tools on your operating system.

## Installation

Then, go to [github](https://github.com/MyLife-Services/mylife-maht) and copy the cloning link, or fork the repository to your own GitHub account (for developers).

Once you have cloned this repository to your local machine, navigate to the project directory and run the following command to install the necessary dependencies:

```shell
npm install
```

## Usage

To start the _MyLife_ Maht server, run the following command:

```shell
npm run start
```

This will launch a Node.js server that listens for incoming HTTP requests on port 3000. You can access the server by opening a web browser and navigating to http://localhost:3000.

## Contributing

We welcome contributions to _MyLife_ Maht from developers of all skill levels. If you would like to contribute to the project, please follow these steps:

1. Fork the repository to your own GitHub account.
2. Clone the forked repository to your local machine.
3. Create a new branch for your changes.
4. Make your changes and commit them to the new branch.
5. Push the new branch to your GitHub account.
6. Submit a pull request from your new branch to the main branch of the original repository.

## Tech Resources

### Azure Cosmos

- [Azure Cosmos DB - sample node.js](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/samples-nodejs)

### JSON Schema

- [Getting Started with AJV](https://ajv.js.org/guide/getting-started.html)
- [JSON Schema in 5 minutes](https://json-schema.org/blog/posts/json-schema-in-5-minutes)
- [Get started with JSON Schema in Node.js](https://json-schema.org/blog/posts/get-started-with-json-schema-in-node-js)
- [JSON Schema Cheatsheet](https://simonplend.com/wp-content/uploads/2020/12/JSON-Schema-Cheat-Sheet-v1.1.pdf)
- [Structuring Complex JSON Schemae](https://json-schema.org/understanding-json-schema/structuring.html)

### Node/js

- [EventEmitters](https://www.digitalocean.com/community/tutorials/using-event-emitters-in-node-js)
- [bind-mechanics](https://javascript.info/bind)

### Koa

- [Introduction to Backend Development with Koa](https://medium.com/swlh/introduction-to-backend-development-with-koa-139a6b7a14d)
- [koa-generic-session](https://github.com/koajs/generic-session)
	* For datastore look at: [koa-redis](https://www.npmjs.com/package/koa-redis)

### Standards

- [ISO-639](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes#Table_of_all_possible_two_letter_codes)

### AI

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

_MyLife_ Maht is licensed under the MIT License. See the LICENSE file for more information.

## Endnotes

### Development Notes

//	at some point, a class inside of a network?  or a network being inside of server? Ultimately, _MyLife_ is the git codebase and the db and /their/ network, i.e., currently Azure

#### @Mookse Worklog

- NOTE: Osiris is HRP db - i.e., the collection of personality databases that "compete" with _MyLife_ (as opposed to extensions of _MyLife_, which are the _MyLife_ nodes)
- can sell custom guids to initial angel investors, later available as a premium feature
  - ergo, reserve the obvious ones for higher gains, I'm happy with my given guid, otherwise I'd of course go with emptyGuid
    - okay, so then! propose empty guid as something that gets passed around like a torch or baton to most recent highest donor/contributor...

- create daily release for Maht

- give MAHT the ability to self-install HRP modules or internal _MyLife_ nodes
  - "verbal" command would map to search of ecosystem, followed by animation of a JSON schema and saving it in its members partition... it should be as easy as that! zoinks?!
- give MAHT/${Member} DOM access
  - branding and styling engine
  - each relationship sandbox (of course, any endpoint, if one wanted, I presume) could have its own collaborative styling profile that would incorporate cooperative feedback
  - magic personalization
	- make my background blue
	- no, revert
	- revert to original
	- make my text red and create indent
- build Questions
	- list of active questions
	- list of updated questions
	- question base sandbox
- cosmos stored procedures for aggregating individual chat logs for consumption by gpt-3-turbo
- JSON schema more fragmented - [complex schemas](https://json-schema.org/understanding-json-schema/structuring.html)
	- JSON schema in repo for ALL types known
	- core: human (org is so in flux and one-shot for now, hold off... at some point, corp will be )
	- ergo, agent."core" would be the JSON schema itself
		- especially once functions can be defined in the schema
			- or more interestingly, point to repo/.js file to include!
- AGENT: while Q-Maht would be the main agent, does each individual have a sub-agent that they can customize?
	- yes, of course, ergo, a member could SWAP OUT agents that are nonetheless defined or referenced in the _MyLife_ eco
	- this should really clarify the church/state separation... the agent is the church, and the individual is the state, in other words, rather than there just being one agent, agent is a "being" and the prime being is _MyLife_ the system itself v. Erik
- JOIN: Corporate ONLY for now -- allows registration
	- for now, just connects with manual list of outreach for actual account, and waiting list otherwise
	- you get an AI, and YOU get an AI... all shadow-play for now, but really effective
- QUESTION: (I'd/agent like to talk about something specific)
	- list of q's (from cosmos)
	- q-sandbox
	- agent would add properties to doc all on its own -- should be prefaced with unique identifier, i.e., `MLq-` or source field
		- would system keep own growing list of props? Yes?
- sysname should not render down to any boolean version of false
- if little JSON object converter works, someone could put it on npm
- could someone learn copilot for me?!?
- assign further look at Azure Cog services for basic database access and look-up, i.e., can it contextualize/tokenize (not personalize, for that, it would need interface to personality kernal)
- open up pipeline for file uploads
	- uploads then tokenized
	- fed nightly to gpt-2
- Jared: get Connected with ecosystem and account
	- ask him to tune pipeline

##### `20230521`

- merge and deploy
  - [#73](https://github.com/MyLife-Services/mylife-maht/issues/73)
- [issue #73](https://github.com/MyLife-Services/mylife-maht/issues/73) **DONE**
  - index.html using wrong object, agent.agentName => member.agentName

- [issue #59](https://github.com/MyLife-Services/mylife-maht/issues/59)
  - Build content into board agent db entry, but 
  - How to incorporate this into JSON scheme, and/or code representation?
	- "BOARD" JSON schema would hold structure for itself, which includes a default of the required new agent fields, and an agent extension (i.e., inheritor) would be defined in 
  - i.e., extra data nodes attached to that style of agent specifically
  - thinking that any unique data values to be require/infused into agents would be first ascribed to the object itself: and yes, the requirement would be in JSON schema, and then $defs could handle the agent-specific "fields" that are needed/defaulted/required, yes -- they just need unique name (or directory I guess) to suss out

- **Note to self about prompt engineering** - ONLY send what gpt cannot surmise, poetry is unnecessary, keywording is yet still valuable - note to Beatrice!; think of DAO - only define what is different about _MyLife_, as Chappy-G knows better than me! Not sure how this applies to machine training, I think it doesn't, in such cases it might be more robust to fine-tune the smarter models, i.e., layering a skein over the accessible openAI corpus

- [issue #54](https://github.com/MyLife-Services/mylife-maht/issues/54)
  - while on AMS calls, begin categorization of personal agent (not board) to render new categories
    - ensure that it picks up these unique categories
  - populate with personal, perhaps even Adam (since I have rich amounts)

- secret word for login?
- primitive easter-eggs (epiphanies) for Maht
- put command icon next to chat bubbles (exclamation point, or whatever)
- on session end, ask gpt-turbo for summaries and save to chat object -- this could be the manner to progress to archival storage and quick-access memory in addition to whatever innate mechanism (via tokenization) is assessed inside LLM itself
  - [chatSummary]
- ask system role to "emulate" writing of assistant speak like EWJ for personal digital assistant
- require member openai sk-code to be stored in cosmos (can all be linked to one 'account' for now)
- build Ideas [is there a difference? Simplest to say no, that questions develop around ideas; ai could help combine ideas *into* formulations]
  - list of active ideas
  	- list of active questions
	- list of updated questions
  - idea base sandbox
  - Remember, any board question endpoints would get attached (parent_id) to /board/ agent not core chat
- Create right-hand bar for:
  - prompt questions
  - corporate info
  - personal bio

##### `20230520`

- Deployed to Azure
- [issue #63](https://github.com/MyLife-Services/mylife-maht/issues/63) **DONE**

##### `20230514`

- [issue #63](https://github.com/MyLife-Services/mylife-maht/issues/63)
  - include session updates
    - Member object will be held locked until passphraze is entered

##### `20230513`

- [issue #60](https://github.com/MyLife-Services/mylife-maht/issues/60) **DONE**

##### `20230506`

- [issue #60](https://github.com/MyLife-Services/mylife-maht/issues/60)

##### `20230502`

- [issue #57](https://github.com/MyLife-Services/mylife-maht/issues/57) **DONE**

##### `20230501`

- [Issue #47](https://github.com/MyLife-Services/mylife-maht/issues/47) **DONE**

##### `20230430`

- [Issue #47](https://github.com/MyLife-Services/mylife-maht/issues/47)
-  move chat -> agent before further release
-  convert chatExchange to conversation
-  should also be patched when not upserted
-  quote (with you in it) referring to machine ai-agent, human, or other?
-  use intermediary engine
-  which category for quote: "${ _question }"
-  categories: greet, query, sharing, other
- deploy to azure **DONE**
- as with issue #49, going to rely more on babbage categorization, but concerned about scaling, so bring up with board
- Need to move logic out from core -> agent

##### `20230428`

- [Issue #49](https://github.com/MyLife-Services/mylife-maht/issues/49)
- establish rotation of few-shot q's based on assessment of category of active user input
	- use text-babbge-01
		- store categorization choices in db field, so that I can see how it's doing
		- (this typeof) categorization data (for as long as needed) should be stored in agent priomarily (here Q - it will endure for now in global), as these are the sorts of actions that would differ from vantage point, i.e., each agent would have its own categorization data or way of seeing the core personality
		- look into later possibly use ada embeddings? https://platform.openai.com/docs/guides/embeddings/use-cases

```
Give best category for Phrase about the nonprofit company MyLife.org
Categories: Products, Services, Customer Support, Security, Business Info, Technology, Other
Phrase: `user input`
Category:
```

##### `20230427`

- fe chat bubbles

##### `20230426`

- Deploy v..1.0006
- get bios in place for other members
  - Steve started as `"ned|806d8f6a-f0ba-4352-bd12-252025fcd87d"`

##### `20230425`

- [41 - member agent session](https://github.com/MyLife-Services/mylife-maht/issues/41) **DONE**

##### `20230424`

- fix oddity around multiple class creations from VM for one board member, must be calling the wrong function **DONE**

##### `20230423`

- [41 - member agent session](https://github.com/MyLife-Services/mylife-maht/issues/41)

##### `20230422`

- [41 - member agent session](https://github.com/MyLife-Services/mylife-maht/issues/41)
- create daily release for Maht **DONE**

##### `20230421`

- fix bug in data saving routine for chat [creating phantom entities, etc] **DONE**
- inspect() should return public and private properties **DONE**
- create Name param in shadow class **DONE**
- error storing data in cosmos **fixed**
- remove error from new pipeline, looks like it is down to an error in instantiating agent() on constructor
  - add try/catch to shadow-constructor
- huge upgrade to class constructor code

##### `20230420`

- generate js classes for core objects and store in session
	- human
	- organization
	- agent
- REFACTOR: agent is now a class of .being and parent_id is .core
	
```
To achieve this, you will need to modify your existing code structure to accommodate these changes. You will also need to create a new class for agents and refactor the 'organization' part of the code to attach an agent.
```

##### `20230419`

- built new _MyLife_ org partition
- JSON schema in repo for ALL types known
	- human.json
	- organization.json
	- agent.json

##### `20230418`

- _MyLife_ board meeting
	- showed off Maht 
		- focus on personalization next
- pushed build `v..1.0004`
- finished storage write for base chat

##### `20230417`

- class definitions
- db storage
	- chatSnippet
	- chatExchange (is there really a need for snippets? benefit would be that metadata would be at root level of document for queies... might as well start that way!)
- db retrieval
	- chat *in process*
	- member corechat

##### `20230416`

- JSON Schema -> Class in Globals
	- improved roundtrip for emits
	- db query for core chat
	- $defs instantiated
	- primary JSON object stable

##### `20230415`

- [25-store direct chat q&a contents in Cosmos](https://github.com/MyLife-Services/mylife-maht/issues/25)
	- event emitter on question and answer
		- While we don’t capture it in this example, the `emit()` function returns `true` if there are listeners for the event. If there are no listeners for an event, it returns `false`.
* What does it mean when "being": "network", "name": "Dog's Life"?
	* Infinity approaches again - a person can be a person place or thing: a network or nation or idea with the right productivity tool, and it seems like _MyLife_ is just that...

##### `20230414`

- [25-store direct chat q&a contents in Cosmos](https://github.com/MyLife-Services/mylife-maht/issues/25)
	- worked a lot on instantiating 
		- kind of a rabbit-hole side project, but ultimately will be a great way of implementing

##### `20230413`

- create daily release for Maht
	- `version 0.0.1.0003`
- incorporate session data into roles
	- privatize functions in class
	- move ctx.session -> ctx.state for request duration
- test session data in ctx.session.mylifeMemberSession
	- ensure it resides in child as referenceable nodes **TRUE**
- incorporated basic koa-session functionality
	- storing getCore() in session object

##### `20230412`

Switching over to Maht version now, maht has key and access to Cosmos

- sp: createCoreMylifeAccount()
	- takes full-formed partition key `mbr_id` and creates `"being": "core"` for system
	- test createCoreMylifeAccount() from server.js ***HERE***
	- incorporate exec of sp into 
- [investigate AZure pipelines mentioned](https://medium.com/@imicknl/how-to-create-a-private-chatgpt-with-your-own-data-15754e6378a1)
	- take-aways, cannot start openai until I have email from _MyLife_, so stick with OpenAI direct
	- [Azure Cognitive Search](https://learn.microsoft.com/en-us/azure/search/search-what-is-azure-search) could be used to look through directories and files in interim support/proxy for GPT-2 personal kernal, so long as has direct access to Cosmos