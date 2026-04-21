/**
 * Score 09 — Diary Cleanup
 *
 * Purpose: Delete the diary entry and retire the diary bot. Destructive
 * actions run first, then both verifications run last via collections(entry)
 * and bots() — same pattern as Score 07 (journaler cleanup).
 *
 * Depends on: Score 08 (context.diaryEntryId, context.diaryBotId)
 */
import { context, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Diary Cleanup',
    number: '09',
}
function extractInstruction(instructions=[], command){
    return instructions.find(i=>i?.command===command) ?? null
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    const entryId = context.diaryEntryId
    const botId = context.diaryBotId
    if(!entryId && !botId){
        console.log('  ✗ Cannot run — no diaryEntryId or diaryBotId in context. Run Score 08 first.')
        return { passed: false, tally: '0/4' }
    }
    /* ── movement 1 — delete the diary entry ── */
    if(!entryId){
        movements.push({ name: 'Delete diary entry', passed: false, learned: {}, notes: 'Skipped — no diaryEntryId in context' })
    } else {
        const deleteResponse = await request(`/members/item/${ entryId }`, { method: 'DELETE', })
        movements.push(movement(
            `Delete diary entry (${ entryId.substring(0, 8) }...)`,
            deleteResponse,
            result => {
                const { instructions=[], success, } = result ?? {}
                const removeInstr = extractInstruction(instructions, 'removeItem')
                const passed = success === true && !!removeInstr
                console.log(`\n    ── Movement 1: Delete Diary Entry ──`)
                console.log(`    Success: ${ success } | Instruction: ${ removeInstr ? JSON.stringify(removeInstr) : '(none)' }`)
                console.log(`    ────────────────────────────────────`)
                if(passed) context.diaryEntryDeleted = true
                return {
                    passed,
                    learned: { entryId, success, instruction: removeInstr, },
                    notes: passed ? `Entry deleted. removeItem received for ${ removeInstr?.itemId }` : `Delete failed. success=${ success }`,
                }
            }
        ))
    }
    /* ── movement 2 — retire the diary bot ── */
    if(!botId){
        movements.push({ name: 'Retire diary bot', passed: false, learned: {}, notes: 'Skipped — no diaryBotId in context' })
    } else {
        const retireResponse = await request(`/members/bots/${ botId }`, { method: 'DELETE', })
        movements.push(movement(
            `Retire diary bot (${ botId.substring(0, 8) }...)`,
            retireResponse,
            result => {
                const { instructions=[], success, } = result ?? {}
                const removeBotInstr = extractInstruction(instructions, 'removeBot')
                const setActiveBotInstr = extractInstruction(instructions, 'setActiveBot')
                const removedCorrectBot = removeBotInstr?.id === botId
                const passed = success === true && !!removeBotInstr
                console.log(`\n    ── Movement 2: Retire Diary Bot ──`)
                console.log(`    Success: ${ success }`)
                console.log(`    removeBot: ${ removeBotInstr ? '✓' : '✗' }${ removedCorrectBot ? ' (correct id)' : removeBotInstr ? ' ⚠ wrong id' : '' }`)
                console.log(`    setActiveBot: ${ setActiveBotInstr ? `✓ → ${ setActiveBotInstr.id?.substring(0, 8) }...` : '✗ none' }`)
                console.log(`    ──────────────────────────────────`)
                if(passed) context.diaryRetired = true
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
    /* ── movement 3 — verify entry absent from collections(entry) ── */
    const collectionsResponse = await request('/members/collections/entry')
    movements.push(movement(
        'Verify entry absent from collections(entry)',
        collectionsResponse,
        result => {
            if(!Array.isArray(result)) return { passed: false, learned: {}, notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }` }
            const stillPresent = result.some(item=>item.id===entryId)
            const passed = !stillPresent
            console.log(`\n    ── Movement 3: collections(entry) ──`)
            console.log(`    Entries remaining: ${ result.length }`)
            console.log(`    Entry still present: ${ stillPresent } — ${ passed ? '✓ clean' : '✗ not removed' }`)
            console.log(`    ────────────────────────────────────`)
            return {
                passed,
                learned: { collectionSizeAfterDelete: result.length, entryStillPresent: stillPresent, },
                notes: passed ? `Entry confirmed absent (${ result.length } entries remain)` : `Entry still present after delete`,
            }
        }
    ))
    /* ── movement 4 — verify diary absent from bots() ── */
    const botsResponse = await request('/members/bots')
    movements.push(movement(
        'Verify diary absent from bots()',
        botsResponse,
        result => {
            const bots = Array.isArray(result) ? result : (result?.bots ?? [])
            const stillPresent = bots.some(b=>b.id===botId || b.type==='diary')
            const passed = !stillPresent
            console.log(`\n    ── Movement 4: bots() ──`)
            console.log(`    Bots remaining: ${ bots.length }`)
            console.log(`    Diary still present: ${ stillPresent } — ${ passed ? '✓ clean' : '✗ not removed' }`)
            bots.forEach(b=>console.log(`      · ${ b.type } (${ b.id?.substring(0, 8) }...)`))
            console.log(`    ────────────────────────`)
            return {
                passed,
                learned: { botsRemaining: bots.length, diaryStillPresent: stillPresent, remainingBotTypes: bots.map(b=>b.type), },
                notes: passed
                    ? `Diary confirmed absent. Remaining: ${ bots.map(b=>b.type).join(', ') }`
                    : `Diary still in bots list after retire`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
