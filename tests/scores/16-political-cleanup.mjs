/**
 * Score 16 — Political Cleanup
 *
 * Purpose: Delete the created stance item and verify it is absent from
 * collections. Note: political-stance and political-values bots are
 * retirable: false (team-anchored defaults), so no bot retirement here —
 * only the stance item is destroyed.
 * Parallel structure to Scores 08, 12 but with 2 movements instead of 4.
 *
 * Depends on: Score 14 (context.createdStanceId)
 */
import { context, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Political Cleanup',
    number: '16',
}
function extractInstruction(instructions=[], command){
    return instructions.find(i=>i?.command===command) ?? null
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    const stanceId = context.createdStanceId
    if(!stanceId){
        console.log('  ✗ Cannot run — no createdStanceId in context. Run Score 14 first.')
        return { passed: false, tally: '0/2' }
    }
    /* ── movement 1 — delete the stance item ── */
    const deleteResponse = await request(`/members/item/${ stanceId }`, { method: 'DELETE', })
    movements.push(movement(
        `Delete stance item (${ stanceId.substring(0, 8) }...)`,
        deleteResponse,
        result => {
            const { instructions=[], success, } = result ?? {}
            const removeInstr = extractInstruction(instructions, 'removeItem')
            const passed = success === true && !!removeInstr
            console.log(`\n    ── Movement 1: Delete Stance Item ──`)
            console.log(`    Success: ${ success } | Instruction: ${ removeInstr ? '✓ removeItem' : '✗ none' }`)
            console.log(`    removeItem.itemId: ${ removeInstr?.itemId?.substring(0, 8) ?? '(none)' }...`)
            console.log(`    ────────────────────────────────────`)
            if(passed) context.stanceDeleted = true
            return {
                passed,
                learned: { stanceId, success, instruction: removeInstr, },
                notes: passed
                    ? `Stance deleted. removeItem received for ${ removeInstr?.itemId?.substring(0, 8) }...`
                    : `Delete failed. success=${ success }, instruction=${ JSON.stringify(removeInstr) }`,
            }
        }
    ))
    /* ── movement 2 — verify stance absent from collections/stance ── */
    const collectionsResponse = await request('/members/collections/stance')
    movements.push(movement(
        'Verify stance absent from collections(stance)',
        collectionsResponse,
        result => {
            if(!Array.isArray(result)) return { passed: false, learned: {}, notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }` }
            const stillPresent = result.some(item=>item.id===stanceId)
            const passed = !stillPresent
            console.log(`\n    ── Movement 2: collections(stance) ──`)
            console.log(`    Stances remaining: ${ result.length }`)
            console.log(`    Stance still present: ${ stillPresent } — ${ passed ? '✓ clean' : '✗ not removed' }`)
            console.log(`    ─────────────────────────────────────`)
            return {
                passed,
                learned: { collectionSizeAfterDelete: result.length, stanceStillPresent: stillPresent, },
                notes: passed
                    ? `Stance confirmed absent (${ result.length } stance(s) remain)`
                    : `Stance still present in collection after delete`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
