/**
 * Score 07 — Journaler Item Management
 *
 * Purpose: Put the created journal entry through a full editorial lifecycle:
 * activate it, change title directly and via chat, update summary directly
 * and via chat (remove and add content), then verify all mutations persisted.
 * Parallel structure to Score 04 (biographer item management) but for entry.
 *
 * Depends on: Score 06 (context.createdEntryId, context.journalerBotId,
 *                        context.journalerActiveBotId, context.verifiedEntry)
 *
 * A synthetic passing this score understands:
 *   - All item management patterns from Score 04 apply equally to journal entries
 *   - Journaler uses the same instruction commands (updateItemTitle, updateItemSummary)
 *   - Entry summary updates are cognitively evaluated for coherence and accuracy
 */
import { context, logTurn, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Journaler Item Management',
    number: '07',
}
const SCORE_ID = '07'
const mTitlesA = [
    'A Rainy Sunday in April',
    'Two Cold Coffees',
    'The Glass and the Rain',
    'Sister, Tired but Fine',
    'What I Did Not Figure Out',
]
const mTitlesB = [
    'April and Nana Bea',
    'The Apartment Holds Me',
    'Page Forty',
    'Neither Cup Finished',
    'Small and Sufficient',
]
const mSummaryAppend = `\n\nPostscript: Remembered later that I had meant to water the plants. Did not. They are probably fine.`
const mRemovalRequest = `Please remove the mention of Nana Bea from the summary — I'd rather keep that reference out of the journal entry and save it for the memory instead.`
const mAdditionRequest = `Please add to the summary that by evening the rain had stopped and I sat outside for exactly eleven minutes before it got too cold.`
function stripHtml(str){ return str.replace(/<[^>]+>/g, '').trim() }
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)] }
function extractInstruction(instructions=[], command){
    return instructions.find(i=>i?.command===command) ?? null
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    const entryId = context.createdEntryId
    const botId = context.journalerBotId
    if(!entryId || !botId){
        console.log('  ✗ Cannot run — missing createdEntryId or journalerBotId. Run Score 05 first.')
        return { passed: false, tally: '0/7' }
    }
    const chosenTitleA = pick(mTitlesA)
    const chosenTitleB = pick(mTitlesB)
    let currentSummary = context.verifiedEntry?.summary ?? ''
    /* ── movement 1 — activate entry in journaler context ── */
    const activateMessage = `I'd like to revisit the entry we just saved. Can you give me a quick summary of what I wrote?`
    logTurn(SCORE_ID, 'synthetic', activateMessage, { movement: 1, note: 'activate entry via itemId param' })
    const activateResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: activateMessage, itemId: entryId, }),
    })
    const { responses: m1Responses=[], } = activateResponse ?? {}
    const m1Text = m1Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'journaler', m1Text, { movement: 1 })
    movements.push(movement(
        'Activate entry in journaler context',
        activateResponse,
        result => {
            const { responses=[], success, } = result ?? {}
            const text = responses.map(r=>stripHtml(r.message)).join('\n')
            const passed = success === true && text.length > 0
            const referencesEntry = /rain|coffee|sister|apartment|book|april|nana/i.test(text)
            console.log(`\n    ── Movement 1: Entry Activation ──`)
            console.log(`    Response (${ text.length } chars): "${ text.substring(0, 180) }${ text.length > 180 ? '...' : '' }"`)
            console.log(`    References entry content: ${ referencesEntry }`)
            console.log(`    ──────────────────────────────────`)
            return {
                passed,
                learned: { activated: passed, referencesEntry, responseLength: text.length, },
                notes: passed
                    ? `Journaler acknowledged entry. References content: ${ referencesEntry }`
                    : `Activation failed or empty response`,
            }
        }
    ))
    /* ── movement 2 — direct title change via PUT ── */
    const directTitleResponse = await request(`/members/item/${ entryId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: entryId, title: chosenTitleA, }),
    })
    const { instructions: m2Instr=[], item: m2Item, success: m2Success, } = directTitleResponse ?? {}
    const m2ItemData = m2Item ?? directTitleResponse
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
    /* ── movement 3 — chat title change ── */
    const chatTitleMessage = `Please change the title of this entry to "${ chosenTitleB }"`
    logTurn(SCORE_ID, 'synthetic', chatTitleMessage, { movement: 3, itemId: entryId })
    const chatTitleResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: chatTitleMessage, itemId: entryId, }),
    })
    const { instructions: m3Instr=[], responses: m3Responses=[], } = chatTitleResponse ?? {}
    const m3Text = m3Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'journaler', m3Text, { movement: 3, instructions: m3Instr })
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
            const passed = success === true && !!titleInstr && instrTitle.length > 0
            console.log(`\n    ── Movement 3: Chat Title Change ──`)
            console.log(`    Requested: "${ chosenTitleB }"`)
            console.log(`    Instruction title: "${ instrTitle }" — matches: ${ titleMatches }`)
            console.log(`    ────────────────────────────────────`)
            context.journalerFinalTitle = instrTitle || chosenTitleB
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
    const directSummaryResponse = await request(`/members/item/${ entryId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: entryId, summary: updatedSummary, }),
    })
    const { instructions: m4Instr=[], item: m4Item, success: m4Success, } = directSummaryResponse ?? {}
    const m4ItemData = m4Item ?? directSummaryResponse
    movements.push(movement(
        'Direct summary append ("Postscript: plants...")',
        directSummaryResponse,
        result => {
            const { instructions=[], item, success, } = result ?? {}
            const itemData = item ?? result
            const updateInstr = extractInstruction(instructions, 'updateItem')
            const summaryHasAppend = (itemData?.summary ?? '').includes('Postscript')
            const passed = success === true && !!updateInstr
            console.log(`\n    ── Movement 4: Direct Summary Append ──`)
            console.log(`    Success: ${ success } | Instruction: ${ updateInstr ? '✓ updateItem' : '✗ none' }`)
            console.log(`    Postscript present: ${ summaryHasAppend }`)
            console.log(`    ────────────────────────────────────────`)
            if(itemData?.summary?.length)
                currentSummary = itemData.summary
            return {
                passed,
                learned: { summaryLength: itemData?.summary?.length, appendConfirmed: summaryHasAppend, },
                notes: passed
                    ? `Summary appended. Postscript confirmed: ${ summaryHasAppend }`
                    : `Direct summary PUT failed`,
            }
        }
    ))
    /* ── movement 5 — chat: remove Nana Bea reference ── */
    logTurn(SCORE_ID, 'synthetic', mRemovalRequest, { movement: 5, itemId: entryId })
    const removalResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mRemovalRequest, itemId: entryId, }),
    })
    const { instructions: m5Instr=[], responses: m5Responses=[], } = removalResponse ?? {}
    const m5Text = m5Responses.map(r=>stripHtml(r.message)).join('\n')
    const m5SummaryInstr = extractInstruction(m5Instr, 'updateItemSummary')
    logTurn(SCORE_ID, 'journaler', m5Text, { movement: 5, instructions: m5Instr })
    movements.push(movement(
        'Chat: remove Nana Bea reference from entry',
        removalResponse,
        result => {
            const { instructions=[], success, } = result ?? {}
            const summaryInstr = extractInstruction(instructions, 'updateItemSummary')
            const newSummary = summaryInstr?.summary ?? ''
            const passed = success === true && !!summaryInstr && newSummary.length > 0
            const detailRemoved = !/nana|bea/i.test(newSummary)
            const coherent = newSummary.length > 60 && !newSummary.includes('undefined')
            console.log(`\n    ── Movement 5: Chat Summary Removal ──`)
            console.log(`    Instruction received: ${ !!summaryInstr } | Length: ${ newSummary.length }`)
            console.log(`    Nana Bea removed: ${ detailRemoved } | Coherent: ${ coherent }`)
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
    /* ── movement 6 — chat: add evening detail ── */
    logTurn(SCORE_ID, 'synthetic', mAdditionRequest, { movement: 6, itemId: entryId })
    const additionResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mAdditionRequest, itemId: entryId, }),
    })
    const { instructions: m6Instr=[], responses: m6Responses=[], } = additionResponse ?? {}
    const m6Text = m6Responses.map(r=>stripHtml(r.message)).join('\n')
    const m6SummaryInstr = extractInstruction(m6Instr, 'updateItemSummary')
    logTurn(SCORE_ID, 'journaler', m6Text, { movement: 6, instructions: m6Instr })
    movements.push(movement(
        'Chat: add "eleven minutes outside" detail',
        additionResponse,
        result => {
            const { instructions=[], success, } = result ?? {}
            const summaryInstr = extractInstruction(instructions, 'updateItemSummary')
            const newSummary = summaryInstr?.summary ?? ''
            const passed = success === true && !!summaryInstr && newSummary.length > 0
            const detailAdded = /eleven|outside|evening|cold|rain.*stop|stop.*rain/i.test(newSummary)
            const coherent = newSummary.length > 60 && !newSummary.includes('undefined')
            console.log(`\n    ── Movement 6: Chat Summary Addition ──`)
            console.log(`    Instruction received: ${ !!summaryInstr } | Length: ${ newSummary.length }`)
            console.log(`    Evening detail added: ${ detailAdded } | Coherent: ${ coherent }`)
            console.log(`    Preview: "${ newSummary.substring(0, 200) }${ newSummary.length > 200 ? '...' : '' }"`)
            console.log(`    ──────────────────────────────────────`)
            if(newSummary.length)
                currentSummary = newSummary
            context.journalerExpectedSummaryFragment = 'eleven'
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
            const expectedTitle = context.journalerFinalTitle ?? chosenTitleB
            const titleCorrect = finalTitle.toLowerCase() === expectedTitle.toLowerCase()
                || finalTitle.toLowerCase().includes(expectedTitle.toLowerCase().substring(0, 10))
            const summaryHasAddition = /eleven|outside|evening|cold/i.test(finalSummary)
            const summaryNanaBeaGone = !/nana|bea/i.test(finalSummary)
            const summaryAdequate = finalSummary.length > 60
            console.log(`\n    ── Movement 7: Final Collection State ──`)
            console.log(`    Collection size: ${ result.length }`)
            console.log(`\n    Title:`)
            console.log(`      Expected:  "${ expectedTitle }"`)
            console.log(`      Persisted: "${ finalTitle }"`)
            console.log(`      Matches:   ${ titleCorrect }`)
            console.log(`\n    Summary (${ finalSummary.length } chars):`)
            console.log(`      Addition ("eleven minutes") present: ${ summaryHasAddition }`)
            console.log(`      Removal ("Nana Bea") honored:        ${ summaryNanaBeaGone }`)
            console.log(`      Adequate length:                     ${ summaryAdequate }`)
            console.log(`\n    Final summary preview:`)
            console.log(`      "${ finalSummary.substring(0, 300) }${ finalSummary.length > 300 ? '...' : '' }"`)
            console.log(`    ─────────────────────────────────────────`)
            const passed = !!found && titleCorrect && summaryAdequate
            context.finalEntry = found
            return {
                passed,
                learned: {
                    finalTitle,
                    expectedTitle,
                    titleCorrect,
                    summaryLength: finalSummary.length,
                    summaryHasAddition,
                    removalHonored: summaryNanaBeaGone,
                    summaryAdequate,
                },
                notes: passed
                    ? `All mutations verified. Title: ${ titleCorrect ? '✓' : '✗' } | Addition: ${ summaryHasAddition ? '✓' : '✗' } | Removal: ${ summaryNanaBeaGone ? '✓' : '✗' }`
                    : `Verification failed. Title: ${ titleCorrect }, adequate: ${ summaryAdequate }`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
