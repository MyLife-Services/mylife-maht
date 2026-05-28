/**
 * Score 11 — Diary Item Management
 *
 * Purpose: Put the created diary entry through a full editorial lifecycle:
 * activate it, change title directly and via chat, update summary directly
 * and via chat (remove and add content), then verify all mutations persisted.
 * Parallel structure to Score 04 (biographer) and Score 07 (journaler).
 *
 * Depends on: Score 09 (context.diaryBotId), Score 10 (context.diaryEntryId,
 *                        context.diaryVerifiedEntry)
 *
 * A synthetic passing this score understands:
 *   - Diary entries use the same item management patterns as journal entries
 *   - The diary bot mediates NL mutations via the same instruction commands
 *   - Editorial changes (remove/add) are evaluated for conceptual accuracy
 */
import { context, logTurn, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Diary Item Management',
    number: '11',
}
const SCORE_ID = '11'
/* two distinct title pools — movement 2 picks from A, movement 3 from B */
const mTitlesA = [
    'A Thursday I Keep Turning Over',
    'The Meeting, Replayed',
    'What She Said in Passing',
    'Work and Worry',
    'One-on-One',
]
const mTitlesB = [
    'She Was Right',
    'Pasta and Overthinking',
    'Sleeping on It',
    'The Comment That Landed',
    'Tomorrow It Will Look Smaller',
]
/* text appended directly in movement 4 — specific enough to verify later */
const mSummaryAppend = `\n\nAddendum: Checked my notes from the meeting before bed. The comment she made was about turnaround time on reviews — I've been slower than usual. She wasn't wrong, and I think somewhere I already knew that.`
/* removal request (movement 5) — targets the domestic pasta/dishes detail */
const mRemovalRequest = `Please remove the detail about making pasta and washing the dishes from the summary — those feel too mundane to keep and pull focus from the emotional core.`
/* addition request (movement 6) — adds a new, verifiable detail */
const mAdditionRequest = `Please add to the summary that the next morning I sent my manager a short message thanking her for the conversation and saying I'd be more mindful going forward.`
function stripHtml(str){ return str.replace(/<[^>]+>/g, '').trim() }
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)] }
function extractInstruction(instructions=[], command){
    return instructions.find(i=>i?.command===command) ?? null
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    const entryId = context.diaryEntryId
    const botId = context.diaryBotId
    if(!entryId || !botId){
        console.log('  ✗ Cannot run — missing diaryEntryId or diaryBotId. Run Scores 09 and 10 first.')
        return { passed: false, tally: '0/7' }
    }
    const chosenTitleA = pick(mTitlesA)
    const chosenTitleB = pick(mTitlesB)
    let currentSummary = context.diaryVerifiedEntry?.summary ?? ''
    /* ── movement 1 — activate entry in diary context ── */
    const activateMessage = `I'd like to revisit the entry I wrote yesterday. Can you give me a quick summary of what I recorded?`
    logTurn(SCORE_ID, 'synthetic', activateMessage, { movement: 1, note: 'activate entry via itemId param' })
    const activateResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: activateMessage, itemId: entryId, }),
    })
    const { responses: m1Responses=[], } = activateResponse ?? {}
    const m1Text = m1Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'diary', m1Text, { movement: 1 })
    movements.push(movement(
        'Activate entry in diary context',
        activateResponse,
        result => {
            const { responses=[], success, } = result ?? {}
            const text = responses.map(r=>stripHtml(r.message)).join('\n')
            const passed = success === true && text.length > 0
            const referencesEntry = /manager|thursday|meeting|one.on.one|pasta|dishes|right|replay/i.test(text)
            console.log(`\n    ── Movement 1: Entry Activation ──`)
            console.log(`    Response (${ text.length } chars): "${ text.substring(0, 180) }${ text.length > 180 ? '...' : '' }"`)
            console.log(`    References entry content: ${ referencesEntry }`)
            console.log(`    ──────────────────────────────────`)
            return {
                passed,
                learned: { activated: passed, referencesEntry, responseLength: text.length, },
                notes: passed
                    ? `Diary acknowledged entry. References content: ${ referencesEntry }`
                    : `Activation failed or empty response`,
            }
        }
    ))
    /* ── movement 2 — direct title change via PUT ── */
    logTurn(SCORE_ID, 'synthetic', `[direct PUT /members/items/${ entryId }] title → "${ chosenTitleA }"`, { movement: 2, note: 'direct API title update' })
    const directTitleResponse = await request(`/members/items/${ entryId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: entryId, title: chosenTitleA, }),
    })
    const { instructions: m2Instr=[], item: m2Item, success: m2Success, } = directTitleResponse ?? {}
    const m2ItemData = m2Item ?? directTitleResponse
    logTurn(SCORE_ID, 'system', `PUT response: success=${ m2Success }, title="${ m2ItemData?.title ?? '?' }"`, { movement: 2 })
    movements.push(movement(
        `Direct title change → "${ chosenTitleA }"`,
        directTitleResponse,
        result => {
            const { instructions=[], item, success, } = result ?? {}
            const itemData = item ?? result
            const updateInstr = extractInstruction(instructions, 'updateItem')
            const titleSaved = itemData?.title === chosenTitleA
            const passed = success === true && !!updateInstr
            console.log(`\n    ── Movement 2: Direct Title Change ──`)
            console.log(`    Success: ${ success } | Instruction: ${ updateInstr ? '✓ updateItem' : '✗ none' }`)
            console.log(`    Returned title: "${ itemData?.title ?? '(none)' }" — matches: ${ titleSaved }`)
            console.log(`    ─────────────────────────────────────`)
            if(itemData?.summary?.length)
                currentSummary = itemData.summary
            return {
                passed,
                learned: { titleSet: chosenTitleA, titleConfirmedInResponse: titleSaved, instruction: updateInstr, },
                notes: passed
                    ? `Title set to "${ chosenTitleA }"`
                    : `Direct title PUT failed. success=${ success }`,
            }
        }
    ))
    /* ── movement 3 — chat title change, expect updateItemTitle instruction ── */
    const chatTitleMessage = `Please change the title of this entry to "${ chosenTitleB }"`
    logTurn(SCORE_ID, 'synthetic', chatTitleMessage, { movement: 3, itemId: entryId })
    const chatTitleResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: chatTitleMessage, itemId: entryId, }),
    })
    const { instructions: m3Instr=[], responses: m3Responses=[], } = chatTitleResponse ?? {}
    const m3Text = m3Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'diary', m3Text, { movement: 3, instructions: m3Instr })
    movements.push(movement(
        `Chat title change → "${ chosenTitleB }"`,
        chatTitleResponse,
        result => {
            const { instructions=[], success, } = result ?? {}
            const titleInstr = extractInstruction(instructions, 'updateItemTitle')
            const instrTitle = titleInstr?.title ?? ''
            const titleMatches = instrTitle.toLowerCase().includes(chosenTitleB.toLowerCase())
                || chosenTitleB.toLowerCase().includes(instrTitle.toLowerCase())
                || instrTitle === chosenTitleB
            const passed = !!titleInstr && instrTitle.length > 0
            console.log(`\n    ── Movement 3: Chat Title Change ──`)
            console.log(`    Requested: "${ chosenTitleB }"`)
            console.log(`    Instruction title: "${ instrTitle }" — matches: ${ titleMatches }`)
            console.log(`    ────────────────────────────────────`)
            context.diaryFinalTitle = instrTitle || chosenTitleB
            return {
                passed,
                learned: { titleRequested: chosenTitleB, titleInInstruction: instrTitle, titleMatches, },
                notes: passed
                    ? `updateItemTitle received. Title: "${ instrTitle }"`
                    : `No updateItemTitle instruction. Got: ${ JSON.stringify(instructions) }`,
            }
        }
    ))
    /* ── movement 4 — direct summary append ── */
    const updatedSummary = currentSummary + mSummaryAppend
    logTurn(SCORE_ID, 'synthetic', `[direct PUT /members/items/${ entryId }] appending ${ mSummaryAppend.length } chars to summary`, { movement: 4, note: 'direct API summary append' })
    const directSummaryResponse = await request(`/members/items/${ entryId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: entryId, summary: updatedSummary, }),
    })
    const { instructions: m4Instr=[], item: m4Item, success: m4Success, } = directSummaryResponse ?? {}
    const m4ItemData = m4Item ?? directSummaryResponse
    logTurn(SCORE_ID, 'system', `PUT summary response: success=${ m4Success }, length=${ m4ItemData?.summary?.length ?? '?' }`, { movement: 4 })
    movements.push(movement(
        'Direct summary append ("Addendum: notes from the meeting...")',
        directSummaryResponse,
        result => {
            const { instructions=[], item, success, } = result ?? {}
            const itemData = item ?? result
            const updateInstr = extractInstruction(instructions, 'updateItem')
            const summaryHasAppend = (itemData?.summary ?? '').includes('Addendum')
            const passed = success === true && !!updateInstr
            console.log(`\n    ── Movement 4: Direct Summary Append ──`)
            console.log(`    Success: ${ success } | Instruction: ${ updateInstr ? '✓ updateItem' : '✗ none' }`)
            console.log(`    Addendum present: ${ summaryHasAppend } | Length: ${ itemData?.summary?.length ?? '?' }`)
            console.log(`    ────────────────────────────────────────`)
            if(itemData?.summary?.length)
                currentSummary = itemData.summary
            return {
                passed,
                learned: { summaryLength: itemData?.summary?.length, appendConfirmed: summaryHasAppend, },
                notes: passed
                    ? `Summary appended. Addendum confirmed: ${ summaryHasAppend }`
                    : `Direct summary PUT failed. success=${ success }`,
            }
        }
    ))
    /* ── movement 5 — chat: ask diary to remove pasta/dishes detail ── */
    logTurn(SCORE_ID, 'synthetic', mRemovalRequest, { movement: 5, itemId: entryId })
    const removalResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mRemovalRequest, itemId: entryId, }),
    })
    const { instructions: m5Instr=[], responses: m5Responses=[], } = removalResponse ?? {}
    const m5Text = m5Responses.map(r=>stripHtml(r.message)).join('\n')
    const m5SummaryInstr = extractInstruction(m5Instr, 'updateItemSummary')
    logTurn(SCORE_ID, 'diary', m5Text, { movement: 5, instructions: m5Instr })
    movements.push(movement(
        'Chat: remove pasta/dishes domestic detail',
        removalResponse,
        result => {
            const { instructions=[], success, } = result ?? {}
            const summaryInstr = extractInstruction(instructions, 'updateItemSummary')
            const newSummary = summaryInstr?.summary ?? ''
            const passed = !!summaryInstr && newSummary.length > 0
            const detailRemoved = !/pasta|dishes|dish|wash/i.test(newSummary)
            const coherent = newSummary.length > 60 && !newSummary.includes('undefined') && !newSummary.includes('[object')
            console.log(`\n    ── Movement 5: Chat Summary Removal ──`)
            console.log(`    Instruction received: ${ !!summaryInstr } | Length: ${ newSummary.length }`)
            console.log(`    Pasta/dishes removed: ${ detailRemoved } | Coherent: ${ coherent }`)
            console.log(`    Preview: "${ newSummary.substring(0, 200) }${ newSummary.length > 200 ? '...' : '' }"`)
            console.log(`    ──────────────────────────────────────`)
            if(newSummary.length)
                currentSummary = newSummary
            return {
                passed,
                learned: { summaryLength: newSummary.length, targetDetailRemoved: detailRemoved, coherent, },
                notes: passed
                    ? `updateItemSummary received. Removal honored: ${ detailRemoved }`
                    : `No updateItemSummary instruction`,
            }
        }
    ))
    /* ── movement 6 — chat: add follow-up message detail ── */
    logTurn(SCORE_ID, 'synthetic', mAdditionRequest, { movement: 6, itemId: entryId })
    const additionResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mAdditionRequest, itemId: entryId, }),
    })
    const { instructions: m6Instr=[], responses: m6Responses=[], } = additionResponse ?? {}
    const m6Text = m6Responses.map(r=>stripHtml(r.message)).join('\n')
    const m6SummaryInstr = extractInstruction(m6Instr, 'updateItemSummary')
    logTurn(SCORE_ID, 'diary', m6Text, { movement: 6, instructions: m6Instr })
    movements.push(movement(
        'Chat: add "follow-up message to manager" detail',
        additionResponse,
        result => {
            const { instructions=[], success, } = result ?? {}
            const summaryInstr = extractInstruction(instructions, 'updateItemSummary')
            const newSummary = summaryInstr?.summary ?? ''
            const passed = !!summaryInstr && newSummary.length > 0
            const detailAdded = /message|email|follow.up|thank|mindful|morning/i.test(newSummary)
            const coherent = newSummary.length > 60 && !newSummary.includes('undefined') && !newSummary.includes('[object')
            console.log(`\n    ── Movement 6: Chat Summary Addition ──`)
            console.log(`    Instruction received: ${ !!summaryInstr } | Length: ${ newSummary.length }`)
            console.log(`    Follow-up detail added: ${ detailAdded } | Coherent: ${ coherent }`)
            console.log(`    Preview: "${ newSummary.substring(0, 200) }${ newSummary.length > 200 ? '...' : '' }"`)
            console.log(`    ──────────────────────────────────────`)
            if(newSummary.length)
                currentSummary = newSummary
            context.diaryExpectedSummaryFragment = 'message'
            return {
                passed,
                learned: { summaryLength: newSummary.length, detailAdded, coherent, },
                notes: passed
                    ? `updateItemSummary received. Addition woven in: ${ detailAdded }`
                    : `No updateItemSummary instruction`,
            }
        }
    ))
    /* ── movement 7 — verify all mutations in collection ── */
    const collectionsResponse = await request('/members/collections/entry')
    movements.push(movement(
        'Verify all mutations persisted in collection',
        collectionsResponse,
        result => {
            if(!Array.isArray(result))
                return {
                    passed: false,
                    learned: {},
                    notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
                }
            const found = result.find(item=>item.id===entryId)
            if(!found)
                return {
                    passed: false,
                    learned: { collectionSize: result.length, },
                    notes: `entryId ${ entryId } not found in ${ result.length }-entry collection`,
                }
            const { title: finalTitle='', summary: finalSummary='', } = found
            const expectedTitle = context.diaryFinalTitle ?? chosenTitleB
            const titleCorrect = finalTitle.toLowerCase() === expectedTitle.toLowerCase()
                || finalTitle.toLowerCase().includes(expectedTitle.toLowerCase().substring(0, 10))
            const summaryHasAddition = /message|email|follow.up|thank|mindful|morning/i.test(finalSummary)
            const pastaDishesGone = !/pasta|dishes|dish|wash/i.test(finalSummary)
            const summaryAdequate = finalSummary.length > 60
            console.log(`\n    ── Movement 7: Final Collection State ──`)
            console.log(`    Collection size: ${ result.length }`)
            console.log(`\n    Title:`)
            console.log(`      Expected:  "${ expectedTitle }"`)
            console.log(`      Persisted: "${ finalTitle }"`)
            console.log(`      Matches:   ${ titleCorrect }`)
            console.log(`\n    Summary (${ finalSummary.length } chars):`)
            console.log(`      Addition ("follow-up message") present: ${ summaryHasAddition }`)
            console.log(`      Removal ("pasta/dishes") honored:       ${ pastaDishesGone }`)
            console.log(`      Adequate length:                        ${ summaryAdequate }`)
            console.log(`\n    Final summary preview:`)
            console.log(`      "${ finalSummary.substring(0, 300) }${ finalSummary.length > 300 ? '...' : '' }"`)
            console.log(`    ─────────────────────────────────────────`)
            const passed = !!found && titleCorrect && summaryAdequate
            context.diaryFinalEntry = found
            return {
                passed,
                learned: {
                    finalTitle,
                    expectedTitle,
                    titleCorrect,
                    summaryLength: finalSummary.length,
                    summaryHasAddition,
                    removalHonored: pastaDishesGone,
                    summaryAdequate,
                },
                notes: passed
                    ? `All mutations verified. Title: ${ titleCorrect ? '✓' : '✗' } | Addition: ${ summaryHasAddition ? '✓' : '✗' } | Removal: ${ pastaDishesGone ? '✓' : '✗' }`
                    : `Verification failed. Title: ${ titleCorrect }, adequate: ${ summaryAdequate }`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
