/**
 * Score 19 — Action Item Management
 *
 * Purpose: Put the created civic action plan through a full editorial lifecycle:
 * activate it, change title directly and via chat, update summary directly
 * and via chat (remove and add content), then verify all mutations persisted.
 * Parallel structure to Scores 04, 07, 11, 15.
 *
 * Depends on: Score 17 (context.activismBotId),
 *             Score 18 (context.createdActionId, context.verifiedAction)
 */
import { context, logTurn, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Action Item Management',
    number: '19',
}
const SCORE_ID = '19'
const mTitlesA = [
    'Housing Action Plan — Phase One',
    'Local Zoning Engagement Plan',
    'Three-Month Civic Commitment',
    'Getting to the Table on Housing',
    'From Belief to Local Action',
]
const mTitlesB = [
    'My Housing Advocacy Starting Point',
    'Show Up, Speak Up, Connect',
    'Beginning with City Council',
    'Local Action on Affordability',
    'The First Three Steps',
]
/* appended directly in movement 4 */
const mSummaryAppend = `\n\nAddendum: I also want to research which local elected officials have the strongest records on housing reform and send each of them a personal letter within the first month — before I show up to any public meeting, I want to know whose ear might be worth seeking.`
/* removal request — targets the door-knocking detail */
const mRemovalRequest = `Please remove the mention of not being ready to knock on doors from the summary — it reads as self-deprecating and I'd rather the plan focus on what I am doing rather than what I'm not.`
/* addition request — adds a verifiable new commitment */
const mAdditionRequest = `Please add to the summary that I plan to bring a friend to at least one of the council meetings — accountability partners make it more likely I will actually follow through.`
function stripHtml(str){ return str.replace(/<[^>]+>/g, '').trim() }
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)] }
function extractInstruction(instructions=[], command){
    return instructions.find(i=>i?.command===command) ?? null
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    const actionId = context.createdActionId
    const botId = context.activismBotId
    if(!actionId || !botId){
        console.log('  ✗ Cannot run — missing createdActionId or activismBotId. Run Scores 17 and 18 first.')
        return { passed: false, tally: '0/7' }
    }
    const chosenTitleA = pick(mTitlesA)
    const chosenTitleB = pick(mTitlesB)
    let currentSummary = context.verifiedAction?.summary ?? ''
    /* ── movement 1 — activate action in activism bot context ── */
    const activateMessage = `I'd like to revisit the housing action plan we just put together. Can you give me a quick overview of what I committed to?`
    logTurn(SCORE_ID, 'synthetic', activateMessage, { movement: 1, note: 'activate action via itemId param' })
    const activateResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: activateMessage, itemId: actionId, }),
    })
    const { responses: m1Responses=[], } = activateResponse ?? {}
    const m1Text = m1Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'activism', m1Text, { movement: 1 })
    movements.push(movement(
        'Activate action in activism bot context',
        activateResponse,
        result => {
            const { responses=[], success, } = result ?? {}
            const text = responses.map(r=>stripHtml(r.message)).join('\n')
            const passed = success === true && text.length > 0
            const referencesAction = /council|zoning|housing|phone|comment|planning|advocacy/i.test(text)
            console.log(`\n    ── Movement 1: Action Activation ──`)
            console.log(`    Response (${ text.length } chars): "${ text.substring(0, 180) }${ text.length > 180 ? '...' : '' }"`)
            console.log(`    References action content: ${ referencesAction }`)
            console.log(`    ──────────────────────────────────`)
            return {
                passed,
                learned: { activated: passed, referencesAction, responseLength: text.length, },
                notes: passed
                    ? `Activism bot acknowledged action. References content: ${ referencesAction }`
                    : `Activation failed or empty response`,
            }
        }
    ))
    /* ── movement 2 — direct title change via PUT ── */
    logTurn(SCORE_ID, 'synthetic', `[direct PUT /members/items/${ actionId }] title → "${ chosenTitleA }"`, { movement: 2, note: 'direct API title update' })
    const directTitleResponse = await request(`/members/items/${ actionId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: actionId, title: chosenTitleA, }),
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
                notes: passed ? `Title set to "${ chosenTitleA }"` : `Direct title PUT failed. success=${ success }`,
            }
        }
    ))
    /* ── movement 3 — chat title change ── */
    const chatTitleMessage = `Please change the title of this action plan to "${ chosenTitleB }"`
    logTurn(SCORE_ID, 'synthetic', chatTitleMessage, { movement: 3, itemId: actionId })
    const chatTitleResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: chatTitleMessage, itemId: actionId, }),
    })
    const { instructions: m3Instr=[], responses: m3Responses=[], } = chatTitleResponse ?? {}
    const m3Text = m3Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'activism', m3Text, { movement: 3, instructions: m3Instr })
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
            context.actionFinalTitle = instrTitle || chosenTitleB
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
    logTurn(SCORE_ID, 'synthetic', `[direct PUT /members/items/${ actionId }] appending ${ mSummaryAppend.length } chars to summary`, { movement: 4, note: 'direct API summary append' })
    const directSummaryResponse = await request(`/members/items/${ actionId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: actionId, summary: updatedSummary, }),
    })
    const { instructions: m4Instr=[], item: m4Item, success: m4Success, } = directSummaryResponse ?? {}
    const m4ItemData = m4Item ?? directSummaryResponse
    logTurn(SCORE_ID, 'system', `PUT summary response: success=${ m4Success }, length=${ m4ItemData?.summary?.length ?? '?' }`, { movement: 4 })
    movements.push(movement(
        'Direct summary append ("research elected officials...")',
        directSummaryResponse,
        result => {
            const { instructions=[], item, success, } = result ?? {}
            const itemData = item ?? result
            const updateInstr = extractInstruction(instructions, 'updateItem')
            const summaryHasAppend = (itemData?.summary ?? '').includes('elected official')
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
    /* ── movement 5 — chat: remove door-knocking reference ── */
    logTurn(SCORE_ID, 'synthetic', mRemovalRequest, { movement: 5, itemId: actionId })
    const removalResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mRemovalRequest, itemId: actionId, }),
    })
    const { instructions: m5Instr=[], responses: m5Responses=[], } = removalResponse ?? {}
    const m5Text = m5Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'activism', m5Text, { movement: 5, instructions: m5Instr })
    movements.push(movement(
        'Chat: remove "not ready to knock on doors" detail',
        removalResponse,
        result => {
            const { instructions=[], success, } = result ?? {}
            const summaryInstr = extractInstruction(instructions, 'updateItemSummary')
            const newSummary = summaryInstr?.summary ?? ''
            const passed = !!summaryInstr && newSummary.length > 0
            const detailRemoved = !/knock|door/i.test(newSummary)
            const coherent = newSummary.length > 60 && !newSummary.includes('undefined') && !newSummary.includes('[object')
            console.log(`\n    ── Movement 5: Chat Summary Removal ──`)
            console.log(`    Instruction received: ${ !!summaryInstr } | Length: ${ newSummary.length }`)
            console.log(`    Door-knocking removed: ${ detailRemoved } | Coherent: ${ coherent }`)
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
    /* ── movement 6 — chat: add accountability partner detail ── */
    logTurn(SCORE_ID, 'synthetic', mAdditionRequest, { movement: 6, itemId: actionId })
    const additionResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mAdditionRequest, itemId: actionId, }),
    })
    const { instructions: m6Instr=[], responses: m6Responses=[], } = additionResponse ?? {}
    const m6Text = m6Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'activism', m6Text, { movement: 6, instructions: m6Instr })
    movements.push(movement(
        'Chat: add "bring a friend / accountability partner" detail',
        additionResponse,
        result => {
            const { instructions=[], success, } = result ?? {}
            const summaryInstr = extractInstruction(instructions, 'updateItemSummary')
            const newSummary = summaryInstr?.summary ?? ''
            const passed = !!summaryInstr && newSummary.length > 0
            const detailAdded = /friend|accountab|partner|follow.through/i.test(newSummary)
            const coherent = newSummary.length > 60 && !newSummary.includes('undefined') && !newSummary.includes('[object')
            console.log(`\n    ── Movement 6: Chat Summary Addition ──`)
            console.log(`    Instruction received: ${ !!summaryInstr } | Length: ${ newSummary.length }`)
            console.log(`    Accountability detail added: ${ detailAdded } | Coherent: ${ coherent }`)
            console.log(`    Preview: "${ newSummary.substring(0, 200) }${ newSummary.length > 200 ? '...' : '' }"`)
            console.log(`    ──────────────────────────────────────`)
            if(newSummary.length)
                currentSummary = newSummary
            context.actionExpectedSummaryFragment = 'friend'
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
    const collectionsResponse = await request('/members/collections/action')
    movements.push(movement(
        'Verify all mutations persisted in collection',
        collectionsResponse,
        result => {
            if(!Array.isArray(result))
                return { passed: false, learned: {}, notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }` }
            const found = result.find(item=>item.id===actionId)
            if(!found)
                return { passed: false, learned: { collectionSize: result.length }, notes: `actionId ${ actionId } not found in ${ result.length }-item collection` }
            const { title: finalTitle='', summary: finalSummary='', } = found
            const expectedTitle = context.actionFinalTitle ?? chosenTitleB
            const titleCorrect = finalTitle.toLowerCase() === expectedTitle.toLowerCase()
                || finalTitle.toLowerCase().includes(expectedTitle.toLowerCase().substring(0, 10))
            const summaryHasAddition = /friend|accountab|partner|follow.through/i.test(finalSummary)
            const doorKnockingGone = !/knock|door/i.test(finalSummary)
            const summaryAdequate = finalSummary.length > 80
            console.log(`\n    ── Movement 7: Final Collection State ──`)
            console.log(`    Collection size: ${ result.length }`)
            console.log(`\n    Title:`)
            console.log(`      Expected:  "${ expectedTitle }"`)
            console.log(`      Persisted: "${ finalTitle }"`)
            console.log(`      Matches:   ${ titleCorrect }`)
            console.log(`\n    Summary (${ finalSummary.length } chars):`)
            console.log(`      Addition ("friend/accountability") present: ${ summaryHasAddition }`)
            console.log(`      Removal ("door-knocking") honored:          ${ doorKnockingGone }`)
            console.log(`      Adequate length:                            ${ summaryAdequate }`)
            console.log(`\n    Final summary preview:`)
            console.log(`      "${ finalSummary.substring(0, 300) }${ finalSummary.length > 300 ? '...' : '' }"`)
            console.log(`    ─────────────────────────────────────────`)
            const passed = !!found && titleCorrect && summaryAdequate
            context.finalAction = found
            return {
                passed,
                learned: {
                    finalTitle, expectedTitle, titleCorrect,
                    summaryLength: finalSummary.length,
                    summaryHasAddition,
                    removalHonored: doorKnockingGone,
                    summaryAdequate,
                },
                notes: passed
                    ? `All mutations verified. Title: ${ titleCorrect ? '✓' : '✗' } | Addition: ${ summaryHasAddition ? '✓' : '✗' } | Removal: ${ doorKnockingGone ? '✓' : '✗' }`
                    : `Verification failed. Title: ${ titleCorrect }, adequate: ${ summaryAdequate }`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
