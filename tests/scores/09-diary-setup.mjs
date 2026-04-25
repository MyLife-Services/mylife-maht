/**
 * Score 09 — Diary Setup
 *
 * Purpose: Create (or locate) the diary bot, rename it, activate it,
 * verify its routine personalization, and select random interests.
 * Parallel structure to Score 05 (journaler setup).
 *
 * Depends on: Score 01 (context.teams, context.bots, context.creatableTypes)
 */
import { context, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Diary Setup',
    number: '09',
}
const BOT_TYPE = 'diary'
const ROUTINE_TYPE = 'diary'
const mNames = [
    'Folio', 'Vesper', 'Rue', 'Pax', 'Lumen',
    'Calder', 'Maren', 'Sable', 'Rook', 'Finch',
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
    /* ── movement 1 — create diary or locate existing ── */
    const isCreatable = context.creatableTypes?.includes(BOT_TYPE)
    let diaryBotId = null
    if(isCreatable){
        const createResponse = await request('/members/bots/create', {
            method: 'POST',
            body: JSON.stringify({ type: BOT_TYPE, }),
        })
        diaryBotId = createResponse?.id ?? createResponse?.bot_id ?? null
        movements.push(movement(
            `Create diary bot (type: ${ BOT_TYPE })`,
            createResponse,
            result => {
                const id = result?.id ?? result?.bot_id
                const passed = !!id && (result?.type === BOT_TYPE || result?.being === 'bot')
                console.log(`\n    ── Movement 1: Bot Creation ──`)
                console.log(`    Created: ${ passed } | id: ${ id ?? '(none)' } | type: ${ result?.type ?? '?' }`)
                console.log(`    ────────────────────────────────`)
                if(passed) context.diaryBotId = id
                return {
                    passed,
                    learned: { created: true, botId: id, type: result?.type, },
                    notes: passed ? `Diary created. id: ${ id }` : `Create failed. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
                }
            }
        ))
    } else {
        const existing = Object.values(context.bots ?? {}).find(b=>b.type===BOT_TYPE)
        diaryBotId = existing?.id ?? null
        movements.push(movement(
            `Locate existing diary bot`,
            existing,
            result => {
                const passed = !!result?.id
                console.log(`\n    ── Movement 1: Locate Existing Diary ──`)
                console.log(`    Found: ${ passed } | id: ${ result?.id ?? '(none)' }`)
                console.log(`    ───────────────────────────────────────`)
                if(passed) context.diaryBotId = result.id
                return {
                    passed,
                    learned: { created: false, botId: result?.id, type: result?.type, },
                    notes: passed ? `Existing diary found. id: ${ result.id }` : `No diary found and type not creatable`,
                }
            }
        ))
    }
    const botId = context.diaryBotId ?? diaryBotId
    if(!botId){
        ;['Rename diary', 'Activate diary', 'Verify routine personalization', 'Set diary interests']
            .forEach(name=>movements.push({ name, passed: false, learned: {}, notes: 'Skipped — no diary bot id' }))
        return scoreReport(score.name, movements)
    }
    /* ── movement 2 — rename ── */
    const renameResponse = await request(`/members/bots/${ botId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: botId, bot_name: chosenName, }),
    })
    movements.push(movement(
        `Rename diary → "${ chosenName }"`,
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
        'Activate diary',
        activateResponse,
        result => {
            const id = result?.id ?? result?.bot_id
            const passed = !!id && result?.success === true
            console.log(`\n    ── Movement 3: Activate ──`)
            console.log(`    Success: ${ result?.success } | id: ${ id ?? '?' } | firstAccess: ${ result?.firstAccess }`)
            console.log(`    ──────────────────────────`)
            if(passed) context.diaryActiveBotId = id
            return {
                passed,
                learned: { botId: id, firstAccess: result?.firstAccess, version: result?.version, },
                notes: passed ? `Diary activated. id: ${ id }` : `Activation failed. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
            }
        }
    ))
    /* ── movement 4 — routine ── */
    const routineResponse = await request(`/routine/${ ROUTINE_TYPE }`)
    movements.push(movement(
        'Verify routine personalization',
        routineResponse,
        result => {
            const { routine, success, } = result ?? {}
            const { events=[], } = routine ?? {}
            const passed = success === true && !!events.length
            if(!passed) return { passed, learned: {}, notes: `Routine failed or empty` }
            const dialog = events.flatMap(e=>e.cast ?? []).map(c=>c.dialog ?? '').join('\n').replace(/<[^>]+>/g, '')
            const memberName = context.memberFirstName ?? ''
            const humanNamePresent = memberName.length > 0 && dialog.toLowerCase().includes(memberName.toLowerCase())
            const botNamePresent = dialog.toLowerCase().includes(chosenName.toLowerCase())
            const isDiaryVoice = /diary|thought|private|reflect|feel|safe/i.test(dialog)
            console.log(`\n    ── Movement 4: Routine ──`)
            console.log(`    Events: ${ events.length } | Human name: ${ humanNamePresent } | Bot name (${ chosenName }): ${ botNamePresent } | Diary voice: ${ isDiaryVoice }`)
            console.log(`    Preview: "${ dialog.substring(0, 200) }${ dialog.length > 200 ? '...' : '' }"`)
            console.log(`    ────────────────────────`)
            return {
                passed,
                learned: { eventCount: events.length, humanNamePresent, botNamePresent, isDiaryVoice, },
                notes: `Routine OK. Human name: ${ humanNamePresent }, bot name: ${ botNamePresent }, diary voice: ${ isDiaryVoice }`,
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
        `Set diary interests: ${ interestsString }`,
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
            if(passed) context.diaryInterests = interestsString
            return {
                passed,
                learned: { interestsSelected: interestsString, interestsReturned: savedStr, allConfirmed: allPresent, },
                notes: passed ? `Interests set: ${ interestsString }` : `Interests PUT failed`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
