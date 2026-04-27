/**
 * Score 07 — Journaler Cleanup
 *
 * Purpose: Delete the journal entry and retire the journaler bot.
 * All destructive actions run first, then both verifications run last —
 * so the final state of entry collection and bots list is always visible
 * regardless of which deletions succeeded.
 *
 * Depends on: Score 05 (context.createdEntryId, context.journalerBotId)
 *
 * A synthetic passing this score understands:
 *   - How to delete an item via DELETE /members/items/:id
 *   - What a successful removeItem instruction looks like
 *   - How to retire a bot via DELETE /members/bots/:bid
 *   - What a successful removeBot + setActiveBot instruction pair looks like
 *   - How to confirm removal via collections(entry) and bots() refresh
 */
import { context, request, } from '../lib/session.mjs'
import { section, movementReport, } from '../lib/report.mjs'
export const movement = {
    name: 'Journaler Cleanup',
    number: '08',
    suite: 'memory',
}
function extractInstruction(instructions=[], command){
    return instructions.find(i=>i?.command===command) ?? null
}
export async function play(){
    console.log(`\nMovement ${ movement.number }: ${ movement.name }`)
    const sections = []
    const entryId = context.createdEntryId
    const botId = context.journalerBotId
    if(!entryId && !botId){
        console.log('  ✗ Cannot run — no entryId or journalerBotId in context. Run Movements 05-06 first.')
        return { passed: false, tally: '0/4' }
    }
    /* ── movement 1 — delete the journal entry ── */
    if(!entryId){
        sections.push({ name: 'Delete journal entry', passed: false, learned: {}, notes: 'Skipped — no createdEntryId in context' })
    } else {
        const deleteEntryResponse = await request(`/members/items/${ entryId }`, {
            method: 'DELETE',
        })
        sections.push(section(
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
                    learned: { entryId, success, instruction: removeInstr, },
                    notes: passed
                        ? `Entry deleted. removeItem received for ${ removeInstr?.itemId }`
                        : `Delete failed. success=${ success }, instruction=${ JSON.stringify(removeInstr) }`,
                }
            }
        ))
    }
    /* ── movement 2 — retire the journaler bot ── */
    if(!botId){
        sections.push({ name: 'Retire journaler bot', passed: false, learned: {}, notes: 'Skipped — no journalerBotId in context' })
    } else {
        const retireResponse = await request(`/members/bots/${ botId }`, {
            method: 'DELETE',
        })
        sections.push(section(
            `Retire journaler bot (${ botId.substring(0, 8) }...)`,
            retireResponse,
            result => {
                const { instructions=[], success, } = result ?? {}
                const removeBotInstr = extractInstruction(instructions, 'removeBot')
                const setActiveBotInstr = extractInstruction(instructions, 'setActiveBot')
                const removedCorrectBot = removeBotInstr?.id === botId
                const passed = success === true && !!removeBotInstr
                console.log(`\n    ── Movement 2: Retire Journaler ──`)
                console.log(`    Success: ${ success }`)
                console.log(`    removeBot: ${ removeBotInstr ? '✓' : '✗' }${ removedCorrectBot ? ' (correct id)' : removeBotInstr ? ' ⚠ wrong id' : '' }`)
                console.log(`    setActiveBot: ${ setActiveBotInstr ? `✓ → ${ setActiveBotInstr.id?.substring(0, 8) }...` : '✗ none' }`)
                console.log(`    ──────────────────────────────────`)
                if(passed)
                    context.journalerRetired = true
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
                        : `Retire failed. success=${ success }, removeBot=${ JSON.stringify(removeBotInstr) }`,
                }
            }
        ))
    }
    /* ── movement 3 — verify entry absent from collections ── */
    const collectionsResponse = await request('/members/collections/entry')
    sections.push(section(
        'Verify entry absent from collections',
        collectionsResponse,
        result => {
            if(!Array.isArray(result))
                return { passed: false, learned: {}, notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }` }
            const stillPresent = result.some(item=>item.id===entryId)
            const passed = !stillPresent
            console.log(`\n    ── Movement 3: collections(entry) ──`)
            console.log(`    Entries remaining: ${ result.length }`)
            console.log(`    Entry still present: ${ stillPresent } — ${ passed ? '✓ clean' : '✗ not removed' }`)
            console.log(`    ────────────────────────────────────`)
            return {
                passed,
                learned: { collectionSizeAfterDelete: result.length, entryStillPresent: stillPresent, },
                notes: passed
                    ? `Entry confirmed absent (${ result.length } entries remain)`
                    : `Entry ${ entryId } still present after delete`,
            }
        }
    ))
    /* ── movement 4 — verify journaler absent from bots() ── */
    const botsResponse = await request('/members/bots')
    sections.push(section(
        'Verify journaler absent from bots()',
        botsResponse,
        result => {
            const bots = Array.isArray(result) ? result : (result?.bots ?? [])
            const stillPresent = bots.some(b=>b.id===botId || b.type==='journaler')
            const passed = !stillPresent
            console.log(`\n    ── Movement 4: bots() ──`)
            console.log(`    Bots remaining: ${ bots.length }`)
            console.log(`    Journaler still present: ${ stillPresent } — ${ passed ? '✓ clean' : '✗ not removed' }`)
            bots.forEach(b=>console.log(`      · ${ b.type } (${ b.id?.substring(0, 8) }...)`))
            console.log(`    ────────────────────────`)
            return {
                passed,
                learned: {
                    botsRemaining: bots.length,
                    journalerStillPresent: stillPresent,
                    remainingBotTypes: bots.map(b=>b.type),
                },
                notes: passed
                    ? `Journaler confirmed absent. Remaining: ${ bots.map(b=>b.type).join(', ') }`
                    : `Journaler still in bots list after retire`,
            }
        }
    ))
    return movementReport(movement.name, sections)
}
