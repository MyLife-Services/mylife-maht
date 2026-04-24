/**
 * Score 05 — Journaler Setup
 *
 * Purpose: Create (or locate) the journaler bot, rename it, activate it,
 * verify its routine personalization, and select random interests.
 * Parallel structure to Score 02 (biographer setup).
 *
 * Depends on: Score 01 (context.teams, context.bots, context.creatableTypes)
 *
 * A synthetic passing this score understands:
 *   - How to determine whether a bot type is creatable vs already instantiated
 *   - How to create a new typed bot via POST /members/bots/create
 *   - How to rename, activate, and verify the journaler's routine
 *   - How to set journaler interests via PUT /members/bots/:id
 */
import { context, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Journaler Setup',
    number: '05',
}
const BOT_TYPE = 'journaler'
const ROUTINE_TYPE = 'getting-started'
const mNames = [
    'Quill', 'Iris', 'Sage', 'Penn', 'Echo',
    'Lyra', 'Cedar', 'Wren', 'Atlas', 'Vale',
]
const mInterestPool = [
    'art', 'daily life', 'dreams', 'emotions', 'ideas',
    'inner peace', 'personal growth', 'relationships', 'spirituality', 'understanding',
]
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)] }
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    if(!context.teams?.length || !context.bots){
        console.log('  ✗ Cannot run — no teams/bots in context. Run Score 01 first.')
        return { passed: false, tally: '0/5' }
    }
    const chosenName = pick(mNames)
    const chosenInterests = [...mInterestPool].sort(()=>Math.random()-0.5).slice(0, 4)
    /* ── movement 1 — create journaler or locate existing ── */
    const isCreatable = context.creatableTypes?.includes(BOT_TYPE)
    let journalerBotId = null
    if(isCreatable){
        const createResponse = await request('/members/bots/create', {
            method: 'POST',
            body: JSON.stringify({ type: BOT_TYPE, }),
        })
        journalerBotId = createResponse?.id ?? createResponse?.bot_id ?? null
        movements.push(movement(
            `Create journaler bot (type: ${ BOT_TYPE })`,
            createResponse,
            result => {
                const id = result?.id ?? result?.bot_id
                const passed = !!id && (result?.type === BOT_TYPE || result?.being === 'bot')
                console.log(`\n    ── Movement 1: Bot Creation ──`)
                console.log(`    Created: ${ passed } | id: ${ id ?? '(none)' } | type: ${ result?.type ?? '?' }`)
                console.log(`    ────────────────────────────────`)
                if(passed) context.journalerBotId = id
                return {
                    passed,
                    learned: { created: true, botId: id, type: result?.type, being: result?.being, },
                    notes: passed ? `Journaler created. id: ${ id }` : `Create failed. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
                }
            }
        ))
    } else {
        const existing = Object.values(context.bots ?? {}).find(b=>b.type===BOT_TYPE)
        journalerBotId = existing?.id ?? null
        movements.push(movement(
            `Locate existing journaler bot`,
            existing,
            result => {
                const passed = !!result?.id
                console.log(`\n    ── Movement 1: Locate Existing Journaler ──`)
                console.log(`    Found: ${ passed } | id: ${ result?.id ?? '(none)' }`)
                console.log(`    ─────────────────────────────────────────────`)
                if(passed) context.journalerBotId = result.id
                return {
                    passed,
                    learned: { created: false, botId: result?.id, type: result?.type, },
                    notes: passed ? `Existing journaler found. id: ${ result.id }` : `No journaler found and type not in creatableTypes`,
                }
            }
        ))
    }
    const botId = context.journalerBotId ?? journalerBotId
    if(!botId){
        ;['Rename journaler', 'Activate journaler', 'Verify routine personalization', 'Set journaler interests']
            .forEach(name=>movements.push({ name, passed: false, learned: {}, notes: 'Skipped — no journaler bot id' }))
        return scoreReport(score.name, movements)
    }
    /* ── movement 2 — rename ── */
    const renameResponse = await request(`/members/bots/${ botId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: botId, bot_name: chosenName, }),
    })
    movements.push(movement(
        `Rename journaler → "${ chosenName }"`,
        renameResponse,
        result => {
            const savedName = result?.bot_name ?? result?.name
            const passed = !!result && (savedName === chosenName || result?.success === true)
            console.log(`\n    ── Movement 2: Rename ──`)
            console.log(`    Requested: "${ chosenName }" | Returned: "${ savedName ?? '?' }"`)
            console.log(`    ───────────────────────`)
            return {
                passed,
                learned: { nameRequested: chosenName, nameReturned: savedName, },
                notes: passed ? `Renamed to "${ chosenName }"` : `Rename may have failed`,
            }
        }
    ))
    /* ── movement 3 — activate ── */
    const activateResponse = await request(`/members/bots/activate/${ botId }`, {
        method: 'POST',
        body: JSON.stringify({}),
    })
    movements.push(movement(
        'Activate journaler',
        activateResponse,
        result => {
            const id = result?.id ?? result?.bot_id
            const passed = !!id && result?.success === true
            console.log(`\n    ── Movement 3: Activate ──`)
            console.log(`    Success: ${ result?.success } | id: ${ id ?? '?' } | firstAccess: ${ result?.firstAccess } | version: ${ result?.version }`)
            console.log(`    ──────────────────────────`)
            if(passed) context.journalerActiveBotId = id
            return {
                passed,
                learned: { botId: id, firstAccess: result?.firstAccess, version: result?.version, versionUpdate: result?.versionUpdate, },
                notes: passed ? `Journaler activated. id: ${ id }` : `Activation failed. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
            }
        }
    ))
    /* ── movement 4 — routine personalization check ── */
    const routineResponse = await request(`/routine/${ ROUTINE_TYPE }`)
    movements.push(movement(
        'Verify routine personalization',
        routineResponse,
        result => {
            const { routine, success, } = result ?? {}
            const { events=[], } = routine ?? {}
            const passed = success === true && !!events.length
            if(!passed) return { passed, learned: {}, notes: `Routine failed or empty. Got: ${ JSON.stringify(result)?.substring(0, 200) }` }
            const dialog = events.flatMap(e=>e.cast ?? []).map(c=>c.dialog ?? '').join('\n').replace(/<[^>]+>/g, '')
            const memberName = context.memberFirstName ?? ''
            const humanNamePresent = memberName.length > 0 && dialog.toLowerCase().includes(memberName.toLowerCase())
            const botNamePresent = dialog.toLowerCase().includes(chosenName.toLowerCase())
            const isJournalerVoice = /journal|thought|reflect|feel|entry|private/i.test(dialog)
            console.log(`\n    ── Movement 4: Routine Personalization ──`)
            console.log(`    Events: ${ events.length } | Human name: ${ humanNamePresent } | Bot name (${ chosenName }): ${ botNamePresent } | Voice: ${ isJournalerVoice }`)
            console.log(`    Preview: "${ dialog.substring(0, 200) }${ dialog.length > 200 ? '...' : '' }"`)
            console.log(`    ─────────────────────────────────────────`)
            return {
                passed,
                learned: { eventCount: events.length, humanNamePresent, botNamePresent, isJournalerVoice, },
                notes: `Routine OK. Human name: ${ humanNamePresent }, bot name: ${ botNamePresent }, voice: ${ isJournalerVoice }`,
            }
        }
    ))
    /* ── movement 5 — set interests ── */
    const interestsString = chosenInterests.join(', ')
    const interestsResponse = await request(`/members/bots/${ botId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: botId, interests: interestsString, }),
    })
    movements.push(movement(
        `Set journaler interests: ${ interestsString }`,
        interestsResponse,
        result => {
            const saved = result?.interests ?? ''
            /* interests is a string field */
            const savedStr = Array.isArray(saved) ? saved.join(', ') : String(saved)
            const allPresent = chosenInterests.every(i=>savedStr.includes(i))
            const passed = !!result && (allPresent || result?.success === true)
            console.log(`\n    ── Movement 5: Interests ──`)
            console.log(`    Selected: ${ interestsString }`)
            console.log(`    Returned: ${ savedStr || '(none in response)' }`)
            console.log(`    All confirmed: ${ allPresent }`)
            console.log(`    ────────────────────────────`)
            if(passed) context.journalerInterests = interestsString
            return {
                passed,
                learned: { interestsSelected: interestsString, interestsReturned: savedStr, allConfirmed: allPresent, },
                notes: passed ? `Interests set: ${ interestsString }` : `Interests PUT failed`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
