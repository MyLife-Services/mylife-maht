/**
 * Movement 01 — Login and Stage Setting
 * Suite: Overture
 *
 * Purpose: Establish that a synthetic consumer can authenticate, survey the
 * instrument, and verify the personal-avatar is operational — renamed and
 * greeted. The last three sections confirm the avatar bot can be explicitly
 * activated, personalized with a name, and that its routine substitutes both
 * the member name and bot name correctly.
 *
 * A synthetic passing this movement understands:
 *   - It has an authenticated session
 *   - Which teams are available and what each governs
 *   - Which bots are active, which type holds the active session
 *   - What additional bot types can be created within each team
 *   - Which collection types are queryable from the current state
 *   - The personal-avatar responds to explicit activation
 *   - Bot renaming via PUT reflects immediately in the response
 *   - The avatar routine interpolates member name and bot name into dialog
 */
import { authenticate, context, request, } from '../lib/session.mjs'
import { section, movementReport, } from '../lib/report.mjs'
export const movement = {
    name: 'Login and Stage Setting',
    number: '01',
    suite: 'overture',
}
/* avatar names — each run uses a different one so personalization is observable */
const mAvatarNames = ['Aria', 'Nova', 'Echo', 'Atlas', 'Lyra', 'Zephyr', 'Orion', 'Beacon']
export async function play(){
    console.log(`\nMovement ${ movement.number }: ${ movement.name }`)
    const sections = []
    /* movement 1 — authenticate */
    let authResult
    try {
        authResult = await authenticate()
    } catch(error) {
        authResult = error.message
    }
    sections.push(section(
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
    if(!sections[0].passed)
        return movementReport(movement.name, sections)
    /* movement 2 — survey teams */
    const teams = await request('/members/teams')
    sections.push(section(
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
    sections.push(section(
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
    /* section 4 — explicitly activate personal-avatar */
    const avatar = context.bots?.find(b=>b.type==='personal-avatar')
    const avatarId = avatar?.id
    if(!avatarId){
        console.log('  ✗ Cannot continue — personal-avatar id missing from context.bots')
        return movementReport(movement.name, sections)
    }
    const activateResponse = await request(`/members/bots/activate/${ avatarId }`, { method: 'POST', })
    sections.push(section(
        'Activate personal-avatar',
        activateResponse,
        result => {
            const botId = result?.id ?? result?.bot_id
            const passed = result?.success === true && !!botId
            if(passed)
                context.activeBotId = botId
            return {
                passed,
                learned: passed ? {
                    activeBotId: botId,
                    firstAccess: result.firstAccess,
                    version: result.version,
                } : {},
                notes: passed
                    ? `Personal-avatar confirmed active. Version ${ result.version }. First access: ${ result.firstAccess }`
                    : `Expected { success: true, id }. Got: ${ JSON.stringify(result) }`,
            }
        }
    ))
    if(!sections[3].passed)
        return movementReport(movement.name, sections)
    /* section 5 — rename personal-avatar */
    const chosenName = mAvatarNames[Math.floor(Math.random() * mAvatarNames.length)]
    const renameResponse = await request(`/members/bots/${ avatarId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: avatarId, bot_name: chosenName, }),
    })
    sections.push(section(
        `Rename personal-avatar to "${ chosenName }"`,
        renameResponse,
        result => {
            const passed = result?.name === chosenName || result?.bot_name === chosenName
            if(passed)
                context.avatarName = chosenName
            return {
                passed,
                learned: passed ? { avatarName: chosenName, } : {},
                notes: passed
                    ? `Avatar renamed to "${ chosenName }"`
                    : `Expected name "${ chosenName }". Got: ${ JSON.stringify(result) }`,
            }
        }
    ))
    /* section 6 — run avatar routine and verify personalization */
    const routineResponse = await request('/routine/avatar')
    sections.push(section(
        'Run avatar greeting routine',
        routineResponse,
        result => {
            const { routine, success, } = result ?? {}
            const passed = success === true && !!routine?.events?.length
            if(passed)
                context.avatarRoutine = routine
            const fullDialog = passed
                ? routine.events.map(e=>e.dialog?.message ?? '').join(' ').replace(/<[^>]+>/g, '')
                : ''
            /* template vars must be substituted — neither literal placeholder should remain */
            const memberVarSubstituted = !fullDialog.includes('<-mN->')
            const botVarSubstituted    = !fullDialog.includes('<-bN->')
            const botNamePresent       = passed && fullDialog.includes(chosenName)
            return {
                passed,
                learned: passed ? {
                    routineTitle: routine.title,
                    eventCount: routine.events.length,
                    opening: routine.events[0]?.dialog?.message?.replace(/<[^>]+>/g, '').trim().substring(0, 100),
                    personalization: { memberVarSubstituted, botVarSubstituted, botNamePresent, },
                } : {},
                notes: passed
                    ? `Routine "${ routine.title }" — ${ routine.events.length } events. memberVar=${ memberVarSubstituted }, botVar=${ botVarSubstituted }, botName="${ chosenName }" present=${ botNamePresent }`
                    : `Expected { success, routine: { events[] } }. Got: ${ JSON.stringify(result) }`,
            }
        }
    ))
    return movementReport(movement.name, sections)
}
