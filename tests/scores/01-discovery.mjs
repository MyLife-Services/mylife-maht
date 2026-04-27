/**
 * Score 01 — Login and Stage Setting
 *
 * Purpose: Establish that a synthetic consumer can authenticate, then survey
 * the instrument to understand what is available to play — which teams exist,
 * what bots are active and creatable, and which collections are accessible.
 * No content is created. This score is pure discovery.
 *
 * A synthetic passing this score understands:
 *   - It has an authenticated session
 *   - Which teams are available and what each governs
 *   - Which bots are active, which type holds the active session
 *   - What additional bot types can be created within each team
 *   - Which collection types are queryable from the current state
 */
import { authenticate, context, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Login and Stage Setting',
    number: '01',
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    /* movement 1 — authenticate */
    let authResult
    try {
        authResult = await authenticate()
    } catch(error) {
        authResult = error.message
    }
    movements.push(movement(
        'Authenticate synthetic account',
        authResult,
        result => ({
            passed: result === true,
            learned: result === true ? { authenticated: true } : {},
            notes: result === true
                ? 'Session established. Cookie active for subsequent movements.'
                : `Authentication failed: ${ result }`,
        })
    ))
    if(!movements[0].passed)
        return scoreReport(score.name, movements)
    /* movement 2 — survey teams */
    const teams = await request('/members/teams')
    movements.push(movement(
        'Survey available teams',
        teams,
        result => {
            const isArray = Array.isArray(result)
            const hasMemory = isArray && result.some(t=>t.name==='memory')
            const passed = isArray && !!result.length && hasMemory
            const learned = passed ? {
                teams: result.map(t=>({
                    name: t.name,
                    title: t.title,
                    allowedBotTypes: t.allowedBotTypes,
                    allowedItemTypes: t.allowedItemTypes,
                    primaryCollectionTypes: t.primaryCollectionTypes,
                    defaultActiveType: t.defaultActiveType,
                }))
            } : {}
            if(passed)
                context.teams = result
            return {
                passed,
                learned,
                notes: passed
                    ? `${ result.length } team(s) available. Collections accessible: ${ [...new Set(result.flatMap(t=>t.primaryCollectionTypes))].join(', ') }`
                    : `Expected teams array with at least a memory team. Got: ${ JSON.stringify(result) }`,
            }
        }
    ))
    /* movement 3 — survey bots */
    const botsResponse = await request('/members/bots')
    movements.push(movement(
        'Survey active bots and creatable types',
        botsResponse,
        result => {
            const { activeBotId, bots, } = result ?? {}
            const isArray = Array.isArray(bots)
            const activeBot = isArray && bots.find(b=>b.id===activeBotId)
            const isAvatarActive = activeBot?.type==='personal-avatar'
            const passed = isArray && !!bots.length && !!activeBotId && isAvatarActive
            /* derive what bot types can still be created from team config */
            const existingTypes = isArray ? bots.map(b=>b.type) : []
            const creatableTypes = context.teams
                ? [...new Set(context.teams.flatMap(t=>t.allowedBotTypes))].filter(t=>!existingTypes.includes(t))
                : []
            const learned = passed ? {
                activeBotId,
                activeBotType: activeBot.type,
                activeBotName: activeBot.name,
                existingBots: bots.map(b=>({ id: b.id, type: b.type, name: b.name, itemForms: b.itemForms, })),
                creatableTypes,
            } : {}
            if(passed){
                context.activeBotId = activeBotId
                context.bots = bots
                context.creatableTypes = creatableTypes
            }
            return {
                passed,
                learned,
                notes: passed
                    ? `${ bots.length } bot(s) active. personal-avatar holds session. ${ creatableTypes.length } additional type(s) creatable: ${ creatableTypes.join(', ') }`
                    : `Expected bots array with personal-avatar as active. Got activeBotId: ${ activeBotId }, activeBot type: ${ activeBot?.type }`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
