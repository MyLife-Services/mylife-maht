/**
 * Score 17 — Activism Setup
 *
 * Purpose: Create (or locate) the activism bot, rename it, activate it,
 * verify its routine personalization, and select random activism preferences.
 * Parallel structure to Scores 02, 05, 09 (biographer/journaler/diary setup).
 *
 * Depends on: Score 01 (context.teams, context.bots, context.creatableTypes)
 *
 * Key differences from other setup scores:
 *   - activism bot is retirable: true (user-created, not team default)
 *   - routine type: 'activism'
 *   - options variable: activism_preferences (24 civic engagement forms)
 *   - belongs to the political team (must be active)
 */
import { context, request, } from '../lib/session.mjs'
import { section, movementReport, } from '../lib/report.mjs'
export const movement = {
    name: 'Activism Setup',
    number: '17',
    suite: 'activism',
}
const BOT_TYPE = 'activism'
const ROUTINE_TYPE = 'activism'
const mNames = [
    'Civic', 'Praxis', 'Ember', 'Rally', 'Accord',
    'Vance', 'Stride', 'Common', 'Orion', 'Quorum',
]
const mPreferencePool = [
    'voting_turnout_support',
    'contacting_elected_officials',
    'attending_public_meetings',
    'public_comment_testimony',
    'community_organizing',
    'coalition_building',
    'writing_letters_opeds',
    'educational_events',
    'research_policy_support',
    'one_on_one_political_conversation',
]
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)] }
export async function play(){
    console.log(`\nMovement ${ movement.number }: ${ movement.name }`)
    const sections = []
    if(!context.teams?.length || !context.bots){
        console.log('  ✗ Cannot run — no teams/bots in context. Run Movement 01 first.')
        return { passed: false, tally: '0/5' }
    }
    const chosenName = pick(mNames)
    const chosenPreferences = [...mPreferencePool].sort(()=>Math.random()-0.5).slice(0, 4)
    /* ── movement 1 — create activism bot or locate existing ── */
    const isCreatable = context.creatableTypes?.includes(BOT_TYPE)
    let activismBotId = null
    if(isCreatable){
        const createResponse = await request('/members/bots/create', {
            method: 'POST',
            body: JSON.stringify({ type: BOT_TYPE, }),
        })
        activismBotId = createResponse?.id ?? createResponse?.bot_id ?? null
        sections.push(section(
            `Create activism bot (type: ${ BOT_TYPE })`,
            createResponse,
            result => {
                const id = result?.id ?? result?.bot_id
                const passed = !!id && (result?.type === BOT_TYPE || result?.being === 'bot')
                console.log(`\n    ── Movement 1: Bot Creation ──`)
                console.log(`    Created: ${ passed } | id: ${ id ?? '(none)' } | type: ${ result?.type ?? '?' }`)
                console.log(`    ────────────────────────────────`)
                if(passed) context.activismBotId = id
                return {
                    passed,
                    learned: { created: true, botId: id, type: result?.type, },
                    notes: passed ? `Activism bot created. id: ${ id }` : `Create failed. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
                }
            }
        ))
    } else {
        const existing = Object.values(context.bots ?? {}).find(b=>b.type===BOT_TYPE)
            ?? (Array.isArray(context.bots) ? context.bots.find(b=>b.type===BOT_TYPE) : null)
        activismBotId = existing?.id ?? null
        sections.push(section(
            `Locate existing activism bot`,
            existing,
            result => {
                const passed = !!result?.id
                console.log(`\n    ── Movement 1: Locate Existing Activism Bot ──`)
                console.log(`    Found: ${ passed } | id: ${ result?.id ?? '(none)' }`)
                console.log(`    ─────────────────────────────────────────────`)
                if(passed) context.activismBotId = result.id
                return {
                    passed,
                    learned: { created: false, botId: result?.id, type: result?.type, },
                    notes: passed ? `Existing activism bot found. id: ${ result.id }` : `No activism bot found and type not creatable`,
                }
            }
        ))
    }
    const botId = context.activismBotId ?? activismBotId
    if(!botId){
        ;['Rename activism bot', 'Activate activism bot', 'Verify routine personalization', 'Set activism preferences']
            .forEach(name=>sections.push({ name, passed: false, learned: {}, notes: 'Skipped — no activism bot id' }))
        return movementReport(movement.name, sections)
    }
    /* ── movement 2 — rename ── */
    const renameResponse = await request(`/members/bots/${ botId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: botId, bot_name: chosenName, }),
    })
    sections.push(section(
        `Rename activism bot → "${ chosenName }"`,
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
    sections.push(section(
        'Activate activism bot',
        activateResponse,
        result => {
            const id = result?.id ?? result?.bot_id
            const passed = !!id && result?.success === true
            console.log(`\n    ── Movement 3: Activate ──`)
            console.log(`    Success: ${ result?.success } | id: ${ id ?? '?' } | firstAccess: ${ result?.firstAccess }`)
            console.log(`    ──────────────────────────`)
            if(passed) context.activismActiveBotId = id
            return {
                passed,
                learned: { botId: id, firstAccess: result?.firstAccess, version: result?.version, },
                notes: passed ? `Activism bot activated. id: ${ id }` : `Activation failed. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
            }
        }
    ))
    /* ── movement 4 — routine ── */
    const routineResponse = await request(`/routine/${ ROUTINE_TYPE }`)
    sections.push(section(
        'Verify routine personalization',
        routineResponse,
        result => {
            const { routine, success, } = result ?? {}
            const { events=[], } = routine ?? {}
            const passed = success === true && !!events.length
            if(!passed) return { passed, learned: {}, notes: `Routine failed or empty` }
            const dialog = events.flatMap(e=>e.cast ?? []).map(c=>c.dialog ?? '').join('\n').replace(/<[^>]+>/g, '')
                || events.map(e => {
                    const d = e?.dialog
                    return typeof d === 'string' ? d : (d?.message ?? '')
                }).join('\n').replace(/<[^>]+>/g, '')
            const memberName = context.memberFirstName ?? ''
            const humanNamePresent = memberName.length > 0 && dialog.toLowerCase().includes(memberName.toLowerCase())
            const botNamePresent = dialog.toLowerCase().includes(chosenName.toLowerCase())
            const isActivismVoice = /action|civic|activism|belief|value|engage|political/i.test(dialog)
            console.log(`\n    ── Movement 4: Routine ──`)
            console.log(`    Events: ${ events.length } | Human name: ${ humanNamePresent } | Bot name (${ chosenName }): ${ botNamePresent } | Activism voice: ${ isActivismVoice }`)
            console.log(`    Preview: "${ dialog.substring(0, 200) }${ dialog.length > 200 ? '...' : '' }"`)
            console.log(`    ────────────────────────`)
            return {
                passed,
                learned: { eventCount: events.length, humanNamePresent, botNamePresent, isActivismVoice, },
                notes: `Routine OK. Human name: ${ humanNamePresent }, bot name: ${ botNamePresent }, activism voice: ${ isActivismVoice }`,
            }
        }
    ))
    /* ── movement 5 — set activism preferences ── */
    const preferencesResponse = await request(`/members/bots/${ botId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: botId, activism_preferences: chosenPreferences, }),
    })
    sections.push(section(
        `Set activism preferences: ${ chosenPreferences.join(', ') }`,
        preferencesResponse,
        result => {
            const saved = result?.activism_preferences ?? []
            const allSaved = chosenPreferences.every(p=>saved.includes(p))
            const passed = !!result && (allSaved || result?.success === true)
            console.log(`\n    ── Movement 5: Activism Preferences ──`)
            console.log(`    Selected: ${ chosenPreferences.join(', ') }`)
            console.log(`    Returned: ${ saved.length ? saved.join(', ') : '(none in response)' }`)
            console.log(`    All confirmed: ${ allSaved }`)
            console.log(`    ──────────────────────────────────────`)
            if(passed) context.activismPreferences = chosenPreferences
            return {
                passed,
                learned: { preferencesSelected: chosenPreferences, preferencesReturned: saved, allConfirmed: allSaved, },
                notes: passed ? `Preferences set: ${ chosenPreferences.join(', ') }` : `Preferences PUT failed`,
            }
        }
    ))
    return movementReport(movement.name, sections)
}
