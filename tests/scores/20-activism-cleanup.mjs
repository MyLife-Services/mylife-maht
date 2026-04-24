/**
 * Score 20 — Activism Cleanup
 *
 * Purpose: Delete the civic action item and retire the activism bot. Destructive
 * actions run first, then both verifications run last via collections(action)
 * and bots() — same 4-movement pattern as Scores 08, 12.
 *
 * Note: Unlike Score 16 (political-stance/values which are retirable:false),
 * the activism bot IS retirable — it was user-created, not a team default.
 *
 * Depends on: Score 17 (context.activismBotId),
 *             Score 18 (context.createdActionId)
 */
import { context, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Activism Cleanup',
    number: '20',
}
function extractInstruction(instructions=[], command){
    return instructions.find(i=>i?.command===command) ?? null
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    const actionId = context.createdActionId
    const botId = context.activismBotId
    if(!actionId && !botId){
        console.log('  ✗ Cannot run — no createdActionId or activismBotId in context. Run Scores 17 and 18 first.')
        return { passed: false, tally: '0/4' }
    }
    /* ── movement 1 — delete the action item ── */
    if(!actionId){
        movements.push({ name: 'Delete action item', passed: false, learned: {}, notes: 'Skipped — no createdActionId in context' })
    } else {
        const deleteResponse = await request(`/members/items/${ actionId }`, { method: 'DELETE', })
        movements.push(movement(
            `Delete action item (${ actionId.substring(0, 8) }...)`,
            deleteResponse,
            result => {
                const { instructions=[], success, } = result ?? {}
                const removeInstr = extractInstruction(instructions, 'removeItem')
                const passed = success === true && !!removeInstr
                console.log(`\n    ── Movement 1: Delete Action Item ──`)
                console.log(`    Success: ${ success } | Instruction: ${ removeInstr ? '✓ removeItem' : '✗ none' }`)
                console.log(`    removeItem.itemId: ${ removeInstr?.itemId?.substring(0, 8) ?? '(none)' }...`)
                console.log(`    ────────────────────────────────────`)
                if(passed) context.actionDeleted = true
                return {
                    passed,
                    learned: { actionId, success, instruction: removeInstr, },
                    notes: passed ? `Action deleted. removeItem received for ${ removeInstr?.itemId?.substring(0, 8) }...` : `Delete failed. success=${ success }`,
                }
            }
        ))
    }
    /* ── movement 2 — retire the activism bot ── */
    if(!botId){
        movements.push({ name: 'Retire activism bot', passed: false, learned: {}, notes: 'Skipped — no activismBotId in context' })
    } else {
        const retireResponse = await request(`/members/bots/${ botId }`, { method: 'DELETE', })
        movements.push(movement(
            `Retire activism bot (${ botId.substring(0, 8) }...)`,
            retireResponse,
            result => {
                const { instructions=[], success, } = result ?? {}
                const removeBotInstr = extractInstruction(instructions, 'removeBot')
                const setActiveBotInstr = extractInstruction(instructions, 'setActiveBot')
                const removedCorrectBot = removeBotInstr?.id === botId
                const passed = success === true && !!removeBotInstr
                console.log(`\n    ── Movement 2: Retire Activism Bot ──`)
                console.log(`    Success: ${ success }`)
                console.log(`    removeBot: ${ removeBotInstr ? '✓' : '✗' }${ removedCorrectBot ? ' (correct id)' : removeBotInstr ? ' ⚠ wrong id' : '' }`)
                console.log(`    setActiveBot: ${ setActiveBotInstr ? `✓ → ${ setActiveBotInstr.id?.substring(0, 8) }...` : '✗ none' }`)
                console.log(`    ──────────────────────────────────────`)
                if(passed) context.activismRetired = true
                return {
                    passed,
                    learned: {
                        botId, success,
                        removeBotInstruction: removeBotInstr,
                        setActiveBotInstruction: setActiveBotInstr,
                        removedCorrectBot,
                        successorBotId: setActiveBotInstr?.id ?? null,
                    },
                    notes: passed
                        ? `Bot retired. removeBot ✓${ setActiveBotInstr ? `, successor: ${ setActiveBotInstr.id?.substring(0, 8) }...` : '' }`
                        : `Retire failed. success=${ success }`,
                }
            }
        ))
    }
    /* ── movement 3 — verify action absent from collections(action) ── */
    const collectionsResponse = await request('/members/collections/action')
    movements.push(movement(
        'Verify action absent from collections(action)',
        collectionsResponse,
        result => {
            if(!Array.isArray(result)) return { passed: false, learned: {}, notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }` }
            const stillPresent = result.some(item=>item.id===actionId)
            const passed = !stillPresent
            console.log(`\n    ── Movement 3: collections(action) ──`)
            console.log(`    Actions remaining: ${ result.length }`)
            console.log(`    Action still present: ${ stillPresent } — ${ passed ? '✓ clean' : '✗ not removed' }`)
            console.log(`    ─────────────────────────────────────`)
            return {
                passed,
                learned: { collectionSizeAfterDelete: result.length, actionStillPresent: stillPresent, },
                notes: passed ? `Action confirmed absent (${ result.length } action(s) remain)` : `Action still present after delete`,
            }
        }
    ))
    /* ── movement 4 — verify activism bot absent from bots() ── */
    const botsResponse = await request('/members/bots')
    movements.push(movement(
        'Verify activism bot absent from bots()',
        botsResponse,
        result => {
            const bots = Array.isArray(result) ? result : (result?.bots ?? [])
            const stillPresent = bots.some(b=>b.id===botId || b.type==='activism')
            const passed = !stillPresent
            console.log(`\n    ── Movement 4: bots() ──`)
            console.log(`    Bots remaining: ${ bots.length }`)
            console.log(`    Activism bot still present: ${ stillPresent } — ${ passed ? '✓ clean' : '✗ not removed' }`)
            bots.forEach(b=>console.log(`      · ${ b.type } (${ b.id?.substring(0, 8) }...)`))
            console.log(`    ────────────────────────`)
            return {
                passed,
                learned: { botsRemaining: bots.length, activismStillPresent: stillPresent, remainingBotTypes: bots.map(b=>b.type), },
                notes: passed
                    ? `Activism bot confirmed absent. Remaining: ${ bots.map(b=>b.type).join(', ') }`
                    : `Activism bot still in bots list after retire`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
