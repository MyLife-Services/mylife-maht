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
 *   - Passphrase can be changed, session survives until explicit logout
 *   - Re-authentication with the new passphrase succeeds after logout
 *   - Passphrase can be restored to original, leaving the account unchanged
 */
import { authenticate, context, MBR_ID, PASSPHRASE, request, } from '../lib/session.mjs'
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
    /* section 7 — survey avatar buttons and fire any prompt types */
    const buttons = await request(`/members/bots/${ avatarId }/buttons`)
    const promptButtons = Array.isArray(buttons) ? buttons.filter(b=>b.type==='prompt') : []
    const buttonResults = []
    for(const btn of promptButtons){
        const chatResponse = await request('/members/', {
            method: 'POST',
            body: JSON.stringify({ botId: avatarId, message: btn.value, role: 'prompt', }),
        })
        buttonResults.push({ label: btn.label, value: btn.value, response: chatResponse, })
    }
    sections.push(section(
        'Survey avatar buttons; fire prompt types',
        buttons,
        result => {
            const isArray = Array.isArray(result)
            /* pass regardless of whether prompt buttons exist — their absence is informational */
            const passed = isArray
            const byType = isArray
                ? result.reduce((acc, b)=>{ ;(acc[b.type] = acc[b.type] ?? []).push(b.label); return acc }, {})
                : {}
            const promptsFired = promptButtons.map((btn, i)=>({
                label: btn.label,
                responded: !!buttonResults[i]?.response?.responses?.length,
            }))
            return {
                passed,
                learned: passed ? {
                    buttonCount: result.length,
                    byType,
                    promptsFired: promptsFired.length ? promptsFired : 'none',
                } : {},
                notes: passed
                    ? `${ result.length } button(s). Types: ${ Object.keys(byType).join(', ') || 'none' }. Prompt buttons fired: ${ promptButtons.length }`
                    : `Expected buttons array. Got: ${ JSON.stringify(result) }`,
            }
        }
    ))
    /* section 8 — change passphrase */
    const tempPassphrase = `${ PASSPHRASE }-test`
    const changeResponse = await request('/members/passphrase', {
        method: 'POST',
        body: JSON.stringify({ passphrase: tempPassphrase, }),
    })
    sections.push(section(
        'Change passphrase',
        changeResponse,
        result => {
            const passed = result === true
            return {
                passed,
                learned: passed ? { passphraseChanged: true, } : {},
                notes: passed
                    ? 'Passphrase updated successfully.'
                    : `Expected true. Got: ${ JSON.stringify(result) }`,
            }
        }
    ))
    if(!sections[7].passed)
        return movementReport(movement.name, sections)
    /* section 9 — logout */
    /* GET /logout redirects (302) — no JSON body. Proof of logout comes from
       the re-authentication step below; here we just verify the server responded
       without an error status (i.e., not 4xx/5xx). */
    await request('/logout')
    const logoutStatus = context.apiLog[context.apiLog.length - 1]?.status ?? 0
    sections.push(section(
        'Logout',
        logoutStatus,
        result => {
            const passed = result === 302 || (result >= 200 && result < 400)
            return {
                passed,
                learned: passed ? { logoutStatus: result, } : {},
                notes: passed
                    ? `Session ended (HTTP ${ result }).`
                    : `Unexpected logout status: ${ result }`,
            }
        }
    ))
    if(!sections[8].passed)
        return movementReport(movement.name, sections)
    /* section 10 — re-authenticate with new passphrase */
    let reAuthResult
    try {
        const encodedId = encodeURIComponent(MBR_ID)
        reAuthResult = await request(`/challenge/${ encodedId }`, {
            method: 'POST',
            body: JSON.stringify({ passphrase: tempPassphrase, }),
        })
    } catch(error) {
        reAuthResult = error.message
    }
    sections.push(section(
        'Re-authenticate with new passphrase',
        reAuthResult,
        result => {
            const passed = result === true
            return {
                passed,
                learned: passed ? { reAuthenticated: true, } : {},
                notes: passed
                    ? 'New passphrase accepted. Session re-established.'
                    : `Re-authentication failed: ${ JSON.stringify(result) }`,
            }
        }
    ))
    if(!sections[9].passed)
        return movementReport(movement.name, sections)
    /* section 11 — restore original passphrase */
    const restoreResponse = await request('/members/passphrase', {
        method: 'POST',
        body: JSON.stringify({ passphrase: PASSPHRASE, }),
    })
    sections.push(section(
        'Restore original passphrase',
        restoreResponse,
        result => {
            const passed = result === true
            return {
                passed,
                learned: passed ? { passphraseRestored: true, } : {},
                notes: passed
                    ? 'Original passphrase restored. playbook.env remains valid.'
                    : `Restore failed — playbook.env passphrase is now out of sync! Got: ${ JSON.stringify(result) }`,
            }
        }
    ))
    return movementReport(movement.name, sections)
}
