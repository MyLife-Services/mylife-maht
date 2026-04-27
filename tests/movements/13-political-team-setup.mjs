/**
 * Score 13 — Political Team Setup
 *
 * Purpose: Activate the political team, read the botResponse to perform the
 * implicit setActiveBot, run the greeting routine if firstAccess, then verify
 * both auto-created bots (political-stance, political-values) exist and are
 * properly configured with their grouped checkbox options.
 *
 * Depends on: Score 01 (context.teams)
 *
 * Key pattern learned here:
 *   POST /members/teams/activate/:tid returns:
 *     { team, botResponse: { id, firstAccess, routine, success, version } }
 *   - botResponse.id     → the bot to setActiveBot (implicit instruction)
 *   - firstAccess===true → fetch GET /routine/:routine and play the greeting
 *   This differs from POST /members/bots/activate/:id which returns
 *   instructions[] with explicit setActiveBot commands.
 */
import { context, request, } from '../lib/session.mjs'
import { section, movementReport, } from '../lib/report.mjs'
export const movement = {
    name: 'Political Team Setup',
    number: '13',
    suite: 'political',
}
const TEAM_NAME = 'political'
const DEFAULT_BOT_TYPES = ['political-stance', 'political-values']
function stripHtml(str){ return str.replace(/<[^>]+>/g, '').trim() }
export async function play(){
    console.log(`\nMovement ${ movement.number }: ${ movement.name }`)
    const sections = []
    const politicalTeam = context.teams?.find(t=>t.name===TEAM_NAME)
    if(!politicalTeam){
        console.log('  ✗ Cannot run — no political team in context.teams. Run Movement 01 first.')
        return { passed: false, tally: '0/3' }
    }
    const teamId = politicalTeam.id
    /* ── movement 1 — activate team, read implicit setActiveBot, run routine if firstAccess ── */
    const activateResponse = await request(`/members/teams/activate/${ teamId }`, {
        method: 'POST',
        body: JSON.stringify({}),
    })
    let routineResponse = null
    const { botResponse, team, } = activateResponse ?? {}
    const activeBotId = botResponse?.id ?? null
    const firstAccess = botResponse?.firstAccess === true
    const routineName = botResponse?.routine ?? null
    /* if firstAccess, fetch the greeting routine immediately */
    if(firstAccess && routineName){
        console.log(`    firstAccess=true → fetching routine: ${ routineName }`)
        routineResponse = await request(`/routine/${ routineName }`)
    }
    sections.push(section(
        'Activate political team (setActiveBot + routine)',
        { activateResponse, routineResponse, },
        result => {
            const { activateResponse: ar, routineResponse: rr, } = result ?? {}
            const { botResponse: br, team: t, } = ar ?? {}
            const botId = br?.id
            const passed = !!t?.active && !!botId && br?.success === true
            /* routine checks — only meaningful if firstAccess fired */
            const routineRan = !!rr?.success
            const routineEvents = rr?.routine?.events ?? []
            const routineText = routineEvents
                .map(e => stripHtml(e?.dialog?.message ?? e?.dialog ?? ''))
                .join('\n')
            const hasPoliticalVoice = /stance|political|belief|issue|value|position/i.test(routineText)
            console.log(`\n    ── Movement 1: Team Activation ──`)
            console.log(`    Team active: ${ t?.active } | success: ${ br?.success }`)
            console.log(`    implicit setActiveBot → ${ botId ?? '(none)' }`)
            console.log(`    firstAccess: ${ br?.firstAccess } | routine: ${ routineName ?? '(none)' }`)
            console.log(`    Routine ran: ${ routineRan } | events: ${ routineEvents.length } | political voice: ${ hasPoliticalVoice }`)
            if(routineText)
                console.log(`    Routine preview: "${ routineText.substring(0, 200) }${ routineText.length > 200 ? '...' : '' }"`)
            console.log(`    ─────────────────────────────────`)
            if(passed) context.politicalActiveBotId = botId
            return {
                passed,
                learned: {
                    teamId: t?.id,
                    teamActive: t?.active,
                    activeBotId: botId,
                    activeBotType: t?.defaultActiveType,
                    firstAccess: br?.firstAccess,
                    routineName,
                    routineRan,
                    routineEventCount: routineEvents.length,
                    hasPoliticalVoice,
                    botVersion: br?.version,
                },
                notes: passed
                    ? `Team activated. setActiveBot → ${ botId?.substring(0, 8) }... | firstAccess: ${ br?.firstAccess } | routine: ${ routineRan ? '✓' : 'skipped' } | political voice: ${ hasPoliticalVoice }`
                    : `Activation failed. team.active=${ t?.active }, botResponse.success=${ br?.success }`,
            }
        }
    ))
    /* ── movement 2 — verify both default bots exist with correct structure ── */
    const botsResponse = await request('/members/bots')
    sections.push(section(
        'Verify political-stance and political-values auto-created',
        botsResponse,
        result => {
            const { activeBotId: currentActive, bots=[], } = result ?? {}
            const stanceBot = bots.find(b=>b.type==='political-stance')
            const valuesBot = bots.find(b=>b.type==='political-values')
            const bothPresent = !!stanceBot && !!valuesBot
            /* check stance has grouped political_interests checkbox */
            const stanceHasInterests = stanceBot?.options?.some(o=>o.variable==='political_interests')
            const stanceInterestCount = stanceBot?.options?.find(o=>o.variable==='political_interests')?.options?.length ?? 0
            /* check values has grouped political_values checkbox */
            const valuesHasValues = valuesBot?.options?.some(o=>o.variable==='political_values')
            const valuesValueCount = valuesBot?.options?.find(o=>o.variable==='political_values')?.options?.length ?? 0
            /* check active bot matches what team activation set */
            const activeMatchesExpected = currentActive === context.politicalActiveBotId
                || currentActive === stanceBot?.id
            const passed = bothPresent && stanceHasInterests && valuesHasValues
            console.log(`\n    ── Movement 2: Bot Verification ──`)
            console.log(`    political-stance: ${ stanceBot ? '✓' : '✗' } (${ stanceBot?.id?.substring(0, 8) ?? 'none' }...)`)
            console.log(`      interests checkbox: ${ stanceHasInterests ? '✓' : '✗' } | options: ${ stanceInterestCount }`)
            console.log(`    political-values: ${ valuesBot ? '✓' : '✗' } (${ valuesBot?.id?.substring(0, 8) ?? 'none' }...)`)
            console.log(`      values checkbox: ${ valuesHasValues ? '✓' : '✗' } | options: ${ valuesValueCount }`)
            console.log(`    Active bot matches expected: ${ activeMatchesExpected }`)
            console.log(`    ────────────────────────────────────`)
            if(bothPresent){
                context.politicalStanceBotId = stanceBot.id
                context.politicalValuesBotId = valuesBot.id
                context.bots = bots
            }
            return {
                passed,
                learned: {
                    stanceBotId: stanceBot?.id,
                    valuesBotId: valuesBot?.id,
                    stanceInterestCount,
                    valuesValueCount,
                    activeMatchesExpected,
                    totalBots: bots.length,
                },
                notes: passed
                    ? `Both bots confirmed. Stance interests: ${ stanceInterestCount } options | Values: ${ valuesValueCount } options`
                    : `Missing bots. stance: ${ !!stanceBot }, values: ${ !!valuesBot }`,
            }
        }
    ))
    /* ── movement 3 — verify routine (if not firstAccess, run it on demand) ── */
    const routineToCheck = routineName ?? 'political-stance'
    const routineCheckResponse = routineResponse ?? await request(`/routine/${ routineToCheck }`)
    sections.push(section(
        `Verify routine personalization (${ routineToCheck })`,
        routineCheckResponse,
        result => {
            const { routine, success, } = result ?? {}
            const { events=[], title='', cast=[], } = routine ?? {}
            const passed = success === true && events.length > 0
            if(!passed) return { passed, learned: {}, notes: `Routine failed or empty` }
            const dialog = events
                .map(e => stripHtml(e?.dialog?.message ?? e?.dialog ?? ''))
                .join('\n')
            const hasPoliticalVoice = /stance|political|belief|issue|value|position|member/i.test(dialog)
            const castTypes = cast.map(c=>c.type)
            console.log(`\n    ── Movement 3: Routine Verification ──`)
            console.log(`    Title: "${ title }"`)
            console.log(`    Events: ${ events.length } | Cast: ${ castTypes.join(', ') }`)
            console.log(`    Political voice: ${ hasPoliticalVoice }`)
            console.log(`    Preview: "${ dialog.substring(0, 200) }${ dialog.length > 200 ? '...' : '' }"`)
            console.log(`    ──────────────────────────────────────`)
            return {
                passed,
                learned: {
                    routineTitle: title,
                    eventCount: events.length,
                    castTypes,
                    hasPoliticalVoice,
                },
                notes: `Routine OK. Events: ${ events.length }, political voice: ${ hasPoliticalVoice }`,
            }
        }
    ))
    return movementReport(movement.name, sections)
}
