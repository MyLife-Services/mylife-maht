/**
 * Score 07 — Cleanup
 *
 * Purpose: Delete the journal entry created in Score 05 and retire the
 * journaler bot. Verifies both removals are reflected in subsequent
 * collection and bot list refreshes. Wipes all traces of the journaler
 * session from the account.
 *
 * Depends on: Score 05 (context.createdEntryId, context.journalerBotId)
 *
 * A synthetic passing this score understands:
 *   - How to delete an item via DELETE /members/item/:id
 *   - What a successful removeItem instruction looks like
 *   - How to retire a bot via DELETE /members/bots/:bid
 *   - What a successful removeBot + setActiveBot instruction pair looks like
 *   - How to confirm removal via collections and bots list refresh
 */
import { context, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Cleanup',
    number: '07',
}
function extractInstruction(instructions=[], command){
    return instructions.find(i=>i?.command===command) ?? null
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    const entryId = context.createdEntryId
    const botId = context.journalerBotId
    if(!entryId && !botId){
        console.log('  ✗ Cannot run — no entryId or journalerBotId in context. Run Scores 05-06 first.')
        return { passed: false, tally: '0/4' }
    }
    /* ── movement 1 — delete the journal entry ── */
    if(!entryId){
        movements.push({ name: 'Delete journal entry', passed: false, learned: {}, notes: 'Skipped — no createdEntryId in context' })
    } else {
        const deleteEntryResponse = await request(`/members/item/${ entryId }`, {
            method: 'DELETE',
        })
        movements.push(movement(
            `Delete journal entry (${ entryId.substring(0, 8) }...)`,
            deleteEntryResponse,
            result => {
                const { instructions=[], success, } = result ?? {}
                const removeInstr = extractInstruction(instructions, 'removeItem')
                const passed = success === true && !!removeInstr
                console.log(`\n    ── Movement 1: Delete Entry ──`)
                console.log(`    Success: ${ success }`)
                console.log(`    Instruction: ${ removeInstr ? JSON.stringify(removeInstr) : '(none)' }`)
                console.log(`    ──────────────────────────────`)
                if(passed)
                    context.entryDeleted = true
                return {
                    passed,
                    learned: {
                        entryId,
                        success,
                        instruction: removeInstr,
                    },
                    notes: passed
                        ? `Entry deleted. removeItem instruction received for ${ removeInstr?.itemId }`
                        : `Delete failed. success=${ success }, instruction=${ JSON.stringify(removeInstr) }`,
                }
            }
        ))
    }
    /* ── movement 2 — verify entry absent from collections ── */
    const collectionsResponse = await request('/members/collections/entry')
    movements.push(movement(
        'Verify entry absent from collections',
        collectionsResponse,
        result => {
            if(!Array.isArray(result))
                return {
                    passed: false,
                    learned: {},
                    notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
                }
            const stillPresent = result.some(item=>item.id===entryId)
            const passed = !stillPresent
            console.log(`\n    ── Movement 2: Entry Removal Verification ──`)
            console.log(`    Collection size after delete: ${ result.length }`)
            console.log(`    Entry still present: ${ stillPresent } — ${ passed ? '✓ clean' : '✗ not removed' }`)
            console.log(`    ────────────────────────────────────────────`)
            return {
                passed,
                learned: {
                    collectionSizeAfterDelete: result.length,
                    entryStillPresent: stillPresent,
                },
                notes: passed
                    ? `Entry confirmed absent from collections (${ result.length } entries remain)`
                    : `Entry ${ entryId } still appears in collection after delete`,
            }
        }
    ))
    /* ── movement 3 — retire the journaler bot ── */
    if(!botId){
        movements.push({ name: 'Retire journaler bot', passed: false, learned: {}, notes: 'Skipped — no journalerBotId in context' })
    } else {
        const retireResponse = await request(`/members/bots/${ botId }`, {
            method: 'DELETE',
        })
        movements.push(movement(
            `Retire journaler bot (${ botId.substring(0, 8) }...)`,
            retireResponse,
            result => {
                const { instructions=[], success, } = result ?? {}
                const removeBotInstr = extractInstruction(instructions, 'removeBot')
                const setActiveBotInstr = extractInstruction(instructions, 'setActiveBot')
                const removedCorrectBot = removeBotInstr?.id === botId
                const passed = success === true && !!removeBotInstr
                console.log(`\n    ── Movement 3: Retire Journaler ──`)
                console.log(`    Success: ${ success }`)
                console.log(`    removeBot instruction: ${ removeBotInstr ? '✓' : '✗' }${ removedCorrectBot ? ' (correct id)' : removeBotInstr ? ' ⚠ wrong id' : '' }`)
                console.log(`    setActiveBot instruction: ${ setActiveBotInstr ? `✓ → ${ setActiveBotInstr.id?.substring(0, 8) }...` : '✗ (none — may already be active)' }`)
                console.log(`    ──────────────────────────────────`)
                if(passed)
                    context.journalerRetired = true
                return {
                    passed,
                    learned: {
                        botId,
                        success,
                        removeBotInstruction: removeBotInstr,
                        setActiveBotInstruction: setActiveBotInstr,
                        removedCorrectBot,
                        successorBotId: setActiveBotInstr?.id ?? null,
                    },
                    notes: passed
                        ? `Bot retired. removeBot ✓${ setActiveBotInstr ? `, successor: ${ setActiveBotInstr.id?.substring(0, 8) }...` : '' }`
                        : `Retire failed. success=${ success }, removeBot=${ JSON.stringify(removeBotInstr) }`,
                }
            }
        ))
    }
    /* ── movement 4 — verify journaler absent from bots list ── */
    const botsResponse = await request('/members/bots')
    movements.push(movement(
        'Verify journaler absent from bots list',
        botsResponse,
        result => {
            const bots = Array.isArray(result) ? result : (result?.bots ?? [])
            const stillPresent = bots.some(b=>b.id===botId || b.type==='journaler')
            const passed = !stillPresent
            console.log(`\n    ── Movement 4: Bot Removal Verification ──`)
            console.log(`    Bots remaining: ${ bots.length }`)
            console.log(`    Journaler still present: ${ stillPresent } — ${ passed ? '✓ clean' : '✗ not removed' }`)
            bots.forEach(b=>console.log(`      ${ b.type } (${ b.id?.substring(0, 8) }...) active=${ b.active ?? '?' }`))
            console.log(`    ────────────────────────────────────────────`)
            return {
                passed,
                learned: {
                    botsRemaining: bots.length,
                    journalerStillPresent: stillPresent,
                    remainingBotTypes: bots.map(b=>b.type),
                },
                notes: passed
                    ? `Journaler confirmed absent. ${ bots.length } bot(s) remain: ${ bots.map(b=>b.type).join(', ') }`
                    : `Journaler (id: ${ botId }) still appears in bots list after retire`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
