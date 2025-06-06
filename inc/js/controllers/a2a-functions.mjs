/* imports */
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { challenge, } from './functions.mjs'
/* constants */
const mA2AProviders = [
    {
        description: 'The NANDA metaprotocol supports A2A providers for MyLife',
        id: 'nanda',
        name: 'NANDA',
        priority: 1,
        transport: {
            type: 'http',
            method: 'POST',
            endpoint: 'https://nanda-agent.org/a2a/',
            auth: {
                scheme: 'bearer',
                token: process.env.MYLIFE_NANDA_SHARED_TOKEN ?? null,
                scope: 'interests.read'
            }
        }
    },
    {
        id: 'mylife',
        name: 'MyLife',
        priority: 2,
        transport: {
            type: 'internal',
            endpoint: 'https://mylife.services/a2a/'
        }
    }
]
/* public functions */
/* private functions */
/* exports */