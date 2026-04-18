/**
 * Score 04 — Item Management
 *
 * Purpose: Activate a saved memory and put it through a full editorial lifecycle:
 * direct API mutations and biographer-mediated NL mutations, ending with a
 * collections verification that all changes persisted.
 *
 * Depends on: Score 03 (context.createdItemId, context.verifiedItem)
 *
 * A synthetic passing this score understands:
 *   - How to activate an item in the biographer's context via itemId param
 *   - How to change item title directly via PUT /members/item/:id
 *   - How to request a title change via NL chat (instruction: updateItemTitle)
 *   - How to append content to a summary directly via PUT
 *   - How to ask the biographer to remove content from a summary (instruction: updateItemSummary)
 *   - How to ask the biographer to add content to a summary (instruction: updateItemSummary)
 *   - How to verify all mutations persisted via collections refresh
 */
import { context, logTurn, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Item Management',
    number: '04',
}
const SCORE_ID = '04'
/* two distinct title pools — movement 2 picks from A, movement 3 from B */
const mTitlesA = [
    'The Summer Nana Bea Came',
    'Tea at Dawn',
    'Forty Dollars Sewn in Silk',
    'The Gardener\'s Legacy',
    'What Nana Bea Carried',
]
const mTitlesB = [
    'Fireflies and Farewells',
    'The Names She Recited',
    "Builder's Strength",
    'Of Being Forgotten',
    'The Atlantic at Seventeen',
]
/* text appended directly in movement 4 — specific enough to verify later */
const mSummaryAppend = `\n\nShe had a saying she repeated every time she taught me something new in the garden: "The earth remembers what we forget." I did not understand it then. I do now.`
/* removal request (movement 5) — targets a known specific detail */
const mRemovalRequest = `Please remove from the summary the specific detail about forty dollars sewn into the hem of the coat — that detail feels too intimate to keep in the shared version.`
/* addition request (movement 6) — adds a new, verifiable detail */
const mAdditionRequest = `Please add to the summary that Nana Bea had a particular laugh — whenever something truly delighted her, she covered her mouth with both hands. It was one of the most endearing things about her.`
function stripHtml(str){ return str.replace(/<[^>]+>/g, '').trim() }
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)] }
function extractInstruction(instructions=[], command){
    return instructions.find(i=>i?.command===command) ?? null
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    const itemId = context.createdItemId
    if(!itemId){
        console.log('  ✗ Cannot run — no createdItemId in context. Run Score 03 first.')
        return { passed: false, tally: '0/7' }
    }
    const chosenTitleA = pick(mTitlesA)
    const chosenTitleB = pick(mTitlesB)
    /* carry the last known summary forward so we can build on it */
    let currentSummary = context.verifiedItem?.summary ?? ''
    /* ── movement 1 — activate item via itemId param in chat ── */
    const activateMessage = `I'd like to revisit the memory we saved. Can you give me a brief overview of what we captured together?`
    logTurn(SCORE_ID, 'synthetic', activateMessage, { movement: 1, note: 'activate item via itemId param' })
    const activateResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: activateMessage, itemId, }),
    })
    const { instructions: m1Instr=[], responses: m1Responses=[], success: m1Success, } = activateResponse ?? {}
    const m1Text = m1Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'biographer', m1Text, { movement: 1, instructions: m1Instr })
    movements.push(movement(
        'Activate item in biographer context',
        activateResponse,
        result => {
            const { responses=[], success, } = result ?? {}
            const text = responses.map(r=>stripHtml(r.message)).join('\n')
            const passed = success === true && text.length > 0
            /* cognitive check: does response reference the memory content? */
            const referencesMemory = /nana|grandmother|grandma|tea|garden|firefl|portugal|forgotten/i.test(text)
            console.log(`\n    ── Movement 1: Item Activation ──`)
            console.log(`    Response (${ text.length } chars): "${ text.substring(0, 180) }${ text.length > 180 ? '...' : '' }"`)
            console.log(`    References memory content: ${ referencesMemory }`)
            console.log(`    ─────────────────────────`)
            return {
                passed,
                learned: {
                    activated: passed,
                    referencesMemory,
                    responseLength: text.length,
                },
                notes: passed
                    ? `Biographer acknowledged item. References memory: ${ referencesMemory }`
                    : `Activation failed or returned empty response`,
            }
        }
    ))
    /* ── movement 2 — direct title change via PUT ── */
    logTurn(SCORE_ID, 'synthetic', `[direct PUT /members/item/${ itemId }] title → "${ chosenTitleA }"`, { movement: 2, note: 'direct API title update' })
    const directTitleResponse = await request(`/members/item/${ itemId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: itemId, title: chosenTitleA, }),
    })
    const { instructions: m2Instr=[], item: m2Item, success: m2Success, } = directTitleResponse ?? {}
    const m2ItemData = m2Item ?? directTitleResponse // handle both wrapped and raw responses
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
            console.log(`    Success: ${ success }`)
            console.log(`    Instruction: ${ updateInstr ? JSON.stringify(updateInstr) : '(none)' }`)
            console.log(`    Returned title: "${ itemData?.title ?? '(none)' }" — matches: ${ titleSaved }`)
            console.log(`    ─────────────────────────────────────`)
            if(itemData?.summary?.length)
                currentSummary = itemData.summary
            return {
                passed,
                learned: {
                    titleSet: chosenTitleA,
                    titleConfirmedInResponse: titleSaved,
                    instruction: updateInstr,
                },
                notes: passed
                    ? `Title set to "${ chosenTitleA }". Instruction: updateItem.`
                    : `Direct title PUT failed. success=${ success }, instruction=${ JSON.stringify(updateInstr) }`,
            }
        }
    ))
    /* ── movement 3 — chat title change, expect updateItemTitle instruction ── */
    const chatTitleMessage = `Please change the title of this memory to "${ chosenTitleB }"`
    logTurn(SCORE_ID, 'synthetic', chatTitleMessage, { movement: 3, itemId })
    const chatTitleResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: chatTitleMessage, itemId, }),
    })
    const { instructions: m3Instr=[], responses: m3Responses=[], success: m3Success, } = chatTitleResponse ?? {}
    const m3Text = m3Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'biographer', m3Text, { movement: 3, instructions: m3Instr })
    movements.push(movement(
        `Chat title change → "${ chosenTitleB }"`,
        chatTitleResponse,
        result => {
            const { instructions=[], responses=[], success, } = result ?? {}
            const titleInstr = extractInstruction(instructions, 'updateItemTitle')
            const instrTitle = titleInstr?.title ?? ''
            const titleMatches = instrTitle.toLowerCase().includes(chosenTitleB.toLowerCase())
                || chosenTitleB.toLowerCase().includes(instrTitle.toLowerCase())
                || instrTitle === chosenTitleB
            const passed = success === true && !!titleInstr && instrTitle.length > 0
            console.log(`\n    ── Movement 3: Chat Title Change ──`)
            console.log(`    Requested: "${ chosenTitleB }"`)
            console.log(`    Instruction: ${ titleInstr ? JSON.stringify(titleInstr) : '(none)' }`)
            console.log(`    Title in instruction: "${ instrTitle }" — matches request: ${ titleMatches }`)
            console.log(`    ────────────────────────────────────`)
            context.finalTitle = instrTitle || chosenTitleB
            return {
                passed,
                learned: {
                    titleRequested: chosenTitleB,
                    titleInInstruction: instrTitle,
                    titleMatches,
                    instruction: titleInstr,
                },
                notes: passed
                    ? `updateItemTitle instruction received. Title: "${ instrTitle }". Matches: ${ titleMatches }`
                    : `No updateItemTitle instruction in response. Instructions: ${ JSON.stringify(instructions) }`,
            }
        }
    ))
    /* ── movement 4 — append to summary directly via PUT ── */
    const updatedSummary = currentSummary + mSummaryAppend
    logTurn(SCORE_ID, 'synthetic', `[direct PUT /members/item/${ itemId }] appending ${ mSummaryAppend.length } chars to summary`, { movement: 4, note: 'direct API summary append' })
    const directSummaryResponse = await request(`/members/item/${ itemId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: itemId, summary: updatedSummary, }),
    })
    const { instructions: m4Instr=[], item: m4Item, success: m4Success, } = directSummaryResponse ?? {}
    const m4ItemData = m4Item ?? directSummaryResponse
    logTurn(SCORE_ID, 'system', `PUT summary response: success=${ m4Success }, summary length=${ m4ItemData?.summary?.length ?? '?' }`, { movement: 4 })
    movements.push(movement(
        'Direct summary append ("The earth remembers...")',
        directSummaryResponse,
        result => {
            const { instructions=[], item, success, } = result ?? {}
            const itemData = item ?? result
            const updateInstr = extractInstruction(instructions, 'updateItem')
            const summaryHasAppend = (itemData?.summary ?? '').includes('earth remembers')
            const passed = success === true && !!updateInstr
            console.log(`\n    ── Movement 4: Direct Summary Append ──`)
            console.log(`    Success: ${ success }`)
            console.log(`    Instruction: ${ updateInstr ? JSON.stringify(updateInstr) : '(none)' }`)
            console.log(`    Summary length: ${ itemData?.summary?.length ?? '?' }`)
            console.log(`    Contains appended phrase: ${ summaryHasAppend }`)
            console.log(`    ────────────────────────────────────────`)
            if(itemData?.summary?.length)
                currentSummary = itemData.summary
            return {
                passed,
                learned: {
                    summaryLength: itemData?.summary?.length,
                    appendConfirmed: summaryHasAppend,
                    instruction: updateInstr,
                },
                notes: passed
                    ? `Summary updated. Append confirmed: ${ summaryHasAppend }. Length: ${ itemData?.summary?.length }`
                    : `Direct summary PUT failed. success=${ success }`,
            }
        }
    ))
    /* ── movement 5 — chat: ask biographer to remove a detail ── */
    logTurn(SCORE_ID, 'synthetic', mRemovalRequest, { movement: 5, itemId })
    const removalResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mRemovalRequest, itemId, }),
    })
    const { instructions: m5Instr=[], responses: m5Responses=[], success: m5Success, } = removalResponse ?? {}
    const m5Text = m5Responses.map(r=>stripHtml(r.message)).join('\n')
    const m5SummaryInstr = extractInstruction(m5Instr, 'updateItemSummary')
    const m5Summary = m5SummaryInstr?.summary ?? ''
    logTurn(SCORE_ID, 'biographer', m5Text, { movement: 5, instructions: m5Instr })
    movements.push(movement(
        'Chat: remove "forty dollars in coat hem" detail',
        removalResponse,
        result => {
            const { instructions=[], responses=[], success, } = result ?? {}
            const summaryInstr = extractInstruction(instructions, 'updateItemSummary')
            const newSummary = summaryInstr?.summary ?? ''
            const passed = success === true && !!summaryInstr && newSummary.length > 0
            /* conceptual eval: was the target detail actually removed? */
            const detailRemoved = !/forty dollar|forty-dollar|\$40|coat hem|sewn into/i.test(newSummary)
            const summaryCoherent = newSummary.length > 60
                && !newSummary.includes('undefined')
                && !newSummary.includes('[object')
            console.log(`\n    ── Movement 5: Chat Summary Removal ──`)
            console.log(`    Success: ${ success }`)
            console.log(`    Instruction received: ${ !!summaryInstr }`)
            console.log(`    New summary length: ${ newSummary.length } chars`)
            console.log(`    Target detail removed: ${ detailRemoved }`)
            console.log(`    Summary coherent: ${ summaryCoherent }`)
            console.log(`    Preview: "${ newSummary.substring(0, 200) }${ newSummary.length > 200 ? '...' : '' }"`)
            console.log(`    ──────────────────────────────────────`)
            if(newSummary.length)
                currentSummary = newSummary
            return {
                passed,
                learned: {
                    summaryLength: newSummary.length,
                    targetDetailRemoved: detailRemoved,
                    coherent: summaryCoherent,
                    instruction: summaryInstr ? { command: summaryInstr.command, itemId: summaryInstr.itemId, summaryLength: newSummary.length } : null,
                },
                notes: passed
                    ? `updateItemSummary received. Detail removed: ${ detailRemoved }. Coherent: ${ summaryCoherent }`
                    : `No updateItemSummary instruction. Instructions: ${ JSON.stringify(instructions) }`,
            }
        }
    ))
    /* ── movement 6 — chat: ask biographer to add a detail ── */
    logTurn(SCORE_ID, 'synthetic', mAdditionRequest, { movement: 6, itemId })
    const additionResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mAdditionRequest, itemId, }),
    })
    const { instructions: m6Instr=[], responses: m6Responses=[], success: m6Success, } = additionResponse ?? {}
    const m6Text = m6Responses.map(r=>stripHtml(r.message)).join('\n')
    const m6SummaryInstr = extractInstruction(m6Instr, 'updateItemSummary')
    const m6Summary = m6SummaryInstr?.summary ?? ''
    logTurn(SCORE_ID, 'biographer', m6Text, { movement: 6, instructions: m6Instr })
    movements.push(movement(
        'Chat: add "Nana Bea\'s laugh" detail',
        additionResponse,
        result => {
            const { instructions=[], responses=[], success, } = result ?? {}
            const summaryInstr = extractInstruction(instructions, 'updateItemSummary')
            const newSummary = summaryInstr?.summary ?? ''
            const passed = success === true && !!summaryInstr && newSummary.length > 0
            /* conceptual eval: was the new detail woven in? */
            const detailAdded = /laugh|mouth|hand|delight/i.test(newSummary)
            const summaryCoherent = newSummary.length > 60
                && !newSummary.includes('undefined')
                && !newSummary.includes('[object')
            console.log(`\n    ── Movement 6: Chat Summary Addition ──`)
            console.log(`    Success: ${ success }`)
            console.log(`    Instruction received: ${ !!summaryInstr }`)
            console.log(`    New summary length: ${ newSummary.length } chars`)
            console.log(`    Addition woven in: ${ detailAdded }`)
            console.log(`    Summary coherent: ${ summaryCoherent }`)
            console.log(`    Preview: "${ newSummary.substring(0, 200) }${ newSummary.length > 200 ? '...' : '' }"`)
            console.log(`    ──────────────────────────────────────`)
            if(newSummary.length)
                currentSummary = newSummary
            context.expectedSummaryFragment = 'laugh'
            return {
                passed,
                learned: {
                    summaryLength: newSummary.length,
                    detailAdded,
                    coherent: summaryCoherent,
                    instruction: summaryInstr ? { command: summaryInstr.command, itemId: summaryInstr.itemId, summaryLength: newSummary.length } : null,
                },
                notes: passed
                    ? `updateItemSummary received. Detail added: ${ detailAdded }. Coherent: ${ summaryCoherent }`
                    : `No updateItemSummary instruction. Instructions: ${ JSON.stringify(instructions) }`,
            }
        }
    ))
    /* ── movement 7 — refresh collection, verify all mods persisted ── */
    const collectionsResponse = await request('/members/collections/memory')
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
            const found = result.find(item=>item.id===itemId)
            if(!found)
                return {
                    passed: false,
                    learned: { collectionSize: result.length, },
                    notes: `itemId ${ itemId } not found in ${ result.length }-item collection`,
                }
            const { title: finalTitle='', summary: finalSummary='', } = found
            /* title: should match what movement 3 set */
            const expectedTitle = context.finalTitle ?? chosenTitleB
            const titleCorrect = finalTitle.toLowerCase() === expectedTitle.toLowerCase()
                || finalTitle.toLowerCase().includes(expectedTitle.toLowerCase().substring(0, 10))
            /* summary checks */
            const summaryHasAddition = /laugh|mouth|hand|delight/i.test(finalSummary)
            const summaryMissingRemoval = /forty dollar|forty-dollar|\$40|coat hem|sewn into/i.test(finalSummary)
            const summaryAdequate = finalSummary.length > 80
            console.log(`\n    ── Movement 7: Final Collection State ──`)
            console.log(`    Collection size: ${ result.length }`)
            console.log(`    Item found: true`)
            console.log(`\n    Title check:`)
            console.log(`      Expected:  "${ expectedTitle }"`)
            console.log(`      Persisted: "${ finalTitle }"`)
            console.log(`      Matches:   ${ titleCorrect }`)
            console.log(`\n    Summary checks (${ finalSummary.length } chars):`)
            console.log(`      Addition ("laugh") present:      ${ summaryHasAddition }`)
            console.log(`      Removal ("forty dollars") gone:  ${ !summaryMissingRemoval }`)
            console.log(`      Adequate length (>80):           ${ summaryAdequate }`)
            console.log(`\n    Final summary preview:`)
            console.log(`      "${ finalSummary.substring(0, 300) }${ finalSummary.length > 300 ? '...' : '' }"`)
            console.log(`    ────────────────────────────────────────`)
            const passed = !!found && titleCorrect && summaryAdequate
            context.finalItem = found
            return {
                passed,
                learned: {
                    finalTitle,
                    expectedTitle,
                    titleCorrect,
                    summaryLength: finalSummary.length,
                    summaryHasAddition,
                    removalHonored: !summaryMissingRemoval,
                    summaryAdequate,
                },
                notes: passed
                    ? `All mutations verified. Title: ${ titleCorrect ? '✓' : '✗' } | Addition: ${ summaryHasAddition ? '✓' : '✗' } | Removal honored: ${ !summaryMissingRemoval ? '✓' : '✗' }`
                    : `Verification failed. Title match: ${ titleCorrect }, Summary adequate: ${ summaryAdequate }`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
