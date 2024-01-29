# AI Agent Communication

## Providers

### OpenAI

This folder contains `.yaml` files for communicating with AI agents at OpenAI using a token-bearing schema. Each `.yaml` file represents

## Action Schematas

The following action schematas are available for external bots:

- `mylife_openai.yaml`: This is the original action that maps to the openai gpt [`MyLife`](https://chat.openai.com/g/g-rEjoOt9hN-mylife).
- `mylife_biog-bot_openai.yaml`: This action is associated with the abilities of the [`MyLife Biographer Bot`](https://chat.openai.com/g/g-QGzfgKj6I-mylife-biographer-bot) to identify user, and 

## Structure

The folder structure is as follows:

.
├── mylife_openai.yaml
├── mylife_biog-bot_openai.yaml
└── README.md

## Versioning

Currently schemas are using `openapi v.3.0.0`, and each `.yaml` will be individually versioned, actual changes maintained in git repository.
