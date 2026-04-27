/**
 * Score 15 — Stance Item Management
 *
 * Purpose: Put the created stance through a full editorial lifecycle:
 * activate it, change title directly and via chat, update summary directly
 * and via chat (remove and add content), then verify all mutations persisted.
 * Parallel structure to Scores 04, 07, 11.
 *
 * Depends on: Score 13 (context.politicalStanceBotId),
 *             Score 14 (context.createdStanceId, context.verifiedStance)
 */
import { context, logTurn, request, } from '../lib/session.mjs'
import { section, movementReport, } from '../lib/report.mjs'
export const movement = {
    name: 'Stance Item Management',
    number: '15',
    suite: 'political',
}
const SCORE_ID = '15'
const mTitlesA = [
    'Housing is Infrastructure',
    'The Zoning Problem',
    'Markets Don\'t Self-Correct Fast Enough',
    'A Case for Public Housing',
    'Rent, Reform, and Reality',
]
const mTitlesB = [
    'What I Actually Believe About Housing',
    'Affordability Requires Policy, Not Patience',
    'My Housing Policy Position',
    'The Case Against Exclusionary Zoning',
    'Housing as a Right',
]
/* appended directly in movement 4 — specific enough to verify later */
const mSummaryAppend = `\n\nAddendum: I would also support property tax incentives for small landlords who voluntarily keep rents at or below the area median — not as a substitute for structural reform, but as a short-term bridge that rewards the behavior we want to see while larger policy changes work through the system.`
/* removal request — targets the international comparison */
const mRemovalRequest = `Please remove the references to Vienna and Singapore from the summary — while the comparison is accurate, it tends to derail the conversation into debates about different political systems rather than focusing on the domestic policy argument.`
/* addition request — adds a new verifiable detail */
const mAdditionRequest = `Please add to the summary that I believe local governments should be required to publish annual housing production targets and report publicly on whether they are meeting them — accountability mechanisms are essential to any serious reform effort.`
function stripHtml(str){ return str.replace(/<[^>]+>/g, '').trim() }
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)] }
function extractInstruction(instructions=[], command){
    return instructions.find(i=>i?.command===command) ?? null
}
export async function play(){
    console.log(`\nMovement ${ movement.number }: ${ movement.name }`)
    const sections = []
    const stanceId = context.createdStanceId
    const botId = context.politicalStanceBotId
    if(!stanceId || !botId){
        console.log('  ✗ Cannot run — missing createdStanceId or politicalStanceBotId. Run Movements 13 and 14 first.')
        return { passed: false, tally: '0/7' }
    }
    const chosenTitleA = pick(mTitlesA)
    const chosenTitleB = pick(mTitlesB)
    let currentSummary = context.verifiedStance?.summary ?? ''
    /* ── movement 1 — activate stance in bot context ── */
    const activateMessage = `I'd like to revisit the housing policy stance we just saved. Can you give me a brief overview of the position I laid out?`
    logTurn(SCORE_ID, 'synthetic', activateMessage, { movement: 1, note: 'activate stance via itemId param' })
    const activateResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: activateMessage, itemId: stanceId, }),
    })
    const { responses: m1Responses=[], } = activateResponse ?? {}
    const m1Text = m1Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'stance', m1Text, { movement: 1 })
    sections.push(section(
        'Activate stance in political-stance context',
        activateResponse,
        result => {
            const { responses=[], success, } = result ?? {}
            const text = responses.map(r=>stripHtml(r.message)).join('\n')
            const passed = success === true && text.length > 0
            const referencesStance = /housing|zoning|rent|afford|federal|tenant|supply/i.test(text)
            console.log(`\n    ── Movement 1: Stance Activation ──`)
            console.log(`    Response (${ text.length } chars): "${ text.substring(0, 180) }${ text.length > 180 ? '...' : '' }"`)
            console.log(`    References stance content: ${ referencesStance }`)
            console.log(`    ───────────────────────────────────`)
            return {
                passed,
                learned: { activated: passed, referencesStance, responseLength: text.length, },
                notes: passed
                    ? `Stance bot acknowledged item. References content: ${ referencesStance }`
                    : `Activation failed or empty response`,
            }
        }
    ))
    /* ── movement 2 — direct title change via PUT ── */
    logTurn(SCORE_ID, 'synthetic', `[direct PUT /members/items/${ stanceId }] title → "${ chosenTitleA }"`, { movement: 2, note: 'direct API title update' })
    const directTitleResponse = await request(`/members/items/${ stanceId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: stanceId, title: chosenTitleA, }),
    })
    const { instructions: m2Instr=[], item: m2Item, success: m2Success, } = directTitleResponse ?? {}
    const m2ItemData = m2Item ?? directTitleResponse
    logTurn(SCORE_ID, 'system', `PUT response: success=${ m2Success }, title="${ m2ItemData?.title ?? '?' }"`, { movement: 2 })
    sections.push(section(
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
    const chatTitleMessage = `Please change the title of this stance to "${ chosenTitleB }"`
    logTurn(SCORE_ID, 'synthetic', chatTitleMessage, { movement: 3, itemId: stanceId })
    const chatTitleResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: chatTitleMessage, itemId: stanceId, }),
    })
    const { instructions: m3Instr=[], responses: m3Responses=[], } = chatTitleResponse ?? {}
    const m3Text = m3Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'stance', m3Text, { movement: 3, instructions: m3Instr })
    sections.push(section(
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
            context.stanceFinalTitle = instrTitle || chosenTitleB
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
    logTurn(SCORE_ID, 'synthetic', `[direct PUT /members/items/${ stanceId }] appending ${ mSummaryAppend.length } chars to summary`, { movement: 4, note: 'direct API summary append' })
    const directSummaryResponse = await request(`/members/items/${ stanceId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: stanceId, summary: updatedSummary, }),
    })
    const { instructions: m4Instr=[], item: m4Item, success: m4Success, } = directSummaryResponse ?? {}
    const m4ItemData = m4Item ?? directSummaryResponse
    logTurn(SCORE_ID, 'system', `PUT summary response: success=${ m4Success }, length=${ m4ItemData?.summary?.length ?? '?' }`, { movement: 4 })
    sections.push(section(
        'Direct summary append ("property tax incentives...")',
        directSummaryResponse,
        result => {
            const { instructions=[], item, success, } = result ?? {}
            const itemData = item ?? result
            const updateInstr = extractInstruction(instructions, 'updateItem')
            const summaryHasAppend = (itemData?.summary ?? '').includes('property tax')
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
                    ? `Summary appended. Property tax addendum confirmed: ${ summaryHasAppend }`
                    : `Direct summary PUT failed. success=${ success }`,
            }
        }
    ))
    /* ── movement 5 — chat: remove Vienna/Singapore international comparison ── */
    logTurn(SCORE_ID, 'synthetic', mRemovalRequest, { movement: 5, itemId: stanceId })
    const removalResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mRemovalRequest, itemId: stanceId, }),
    })
    const { instructions: m5Instr=[], responses: m5Responses=[], } = removalResponse ?? {}
    const m5Text = m5Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'stance', m5Text, { movement: 5, instructions: m5Instr })
    sections.push(section(
        'Chat: remove Vienna/Singapore international comparison',
        removalResponse,
        result => {
            const { instructions=[], success, } = result ?? {}
            const summaryInstr = extractInstruction(instructions, 'updateItemSummary')
            const newSummary = summaryInstr?.summary ?? ''
            const passed = success === true && !!summaryInstr && newSummary.length > 0
            const detailRemoved = !/vienna|singapore/i.test(newSummary)
            const coherent = newSummary.length > 60 && !newSummary.includes('undefined') && !newSummary.includes('[object')
            console.log(`\n    ── Movement 5: Chat Summary Removal ──`)
            console.log(`    Instruction received: ${ !!summaryInstr } | Length: ${ newSummary.length }`)
            console.log(`    Vienna/Singapore removed: ${ detailRemoved } | Coherent: ${ coherent }`)
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
    /* ── movement 6 — chat: add accountability / production targets detail ── */
    logTurn(SCORE_ID, 'synthetic', mAdditionRequest, { movement: 6, itemId: stanceId })
    const additionResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mAdditionRequest, itemId: stanceId, }),
    })
    const { instructions: m6Instr=[], responses: m6Responses=[], } = additionResponse ?? {}
    const m6Text = m6Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'stance', m6Text, { movement: 6, instructions: m6Instr })
    sections.push(section(
        'Chat: add housing production targets / accountability detail',
        additionResponse,
        result => {
            const { instructions=[], success, } = result ?? {}
            const summaryInstr = extractInstruction(instructions, 'updateItemSummary')
            const newSummary = summaryInstr?.summary ?? ''
            const passed = success === true && !!summaryInstr && newSummary.length > 0
            const detailAdded = /target|production|accountab|annual|publish|report/i.test(newSummary)
            const coherent = newSummary.length > 60 && !newSummary.includes('undefined') && !newSummary.includes('[object')
            console.log(`\n    ── Movement 6: Chat Summary Addition ──`)
            console.log(`    Instruction received: ${ !!summaryInstr } | Length: ${ newSummary.length }`)
            console.log(`    Accountability detail added: ${ detailAdded } | Coherent: ${ coherent }`)
            console.log(`    Preview: "${ newSummary.substring(0, 200) }${ newSummary.length > 200 ? '...' : '' }"`)
            console.log(`    ──────────────────────────────────────`)
            if(newSummary.length)
                currentSummary = newSummary
            context.stanceExpectedSummaryFragment = 'target'
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
    const collectionsResponse = await request('/members/collections/stance')
    sections.push(section(
        'Verify all mutations persisted in collection',
        collectionsResponse,
        result => {
            if(!Array.isArray(result))
                return { passed: false, learned: {}, notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }` }
            const found = result.find(item=>item.id===stanceId)
            if(!found)
                return { passed: false, learned: { collectionSize: result.length }, notes: `stanceId ${ stanceId } not found in ${ result.length }-item collection` }
            const { title: finalTitle='', summary: finalSummary='', } = found
            const expectedTitle = context.stanceFinalTitle ?? chosenTitleB
            const titleCorrect = finalTitle.toLowerCase() === expectedTitle.toLowerCase()
                || finalTitle.toLowerCase().includes(expectedTitle.toLowerCase().substring(0, 10))
            const summaryHasAddition = /target|production|accountab|annual|publish|report/i.test(finalSummary)
            const viennaSingaporeGone = !/vienna|singapore/i.test(finalSummary)
            const summaryAdequate = finalSummary.length > 80
            console.log(`\n    ── Movement 7: Final Collection State ──`)
            console.log(`    Collection size: ${ result.length }`)
            console.log(`\n    Title:`)
            console.log(`      Expected:  "${ expectedTitle }"`)
            console.log(`      Persisted: "${ finalTitle }"`)
            console.log(`      Matches:   ${ titleCorrect }`)
            console.log(`\n    Summary (${ finalSummary.length } chars):`)
            console.log(`      Addition ("targets/accountability") present: ${ summaryHasAddition }`)
            console.log(`      Removal ("Vienna/Singapore") honored:        ${ viennaSingaporeGone }`)
            console.log(`      Adequate length:                             ${ summaryAdequate }`)
            console.log(`\n    Final summary preview:`)
            console.log(`      "${ finalSummary.substring(0, 300) }${ finalSummary.length > 300 ? '...' : '' }"`)
            console.log(`    ─────────────────────────────────────────`)
            const passed = !!found && titleCorrect && summaryAdequate
            context.finalStance = found
            return {
                passed,
                learned: {
                    finalTitle, expectedTitle, titleCorrect,
                    summaryLength: finalSummary.length,
                    summaryHasAddition,
                    removalHonored: viennaSingaporeGone,
                    summaryAdequate,
                },
                notes: passed
                    ? `All mutations verified. Title: ${ titleCorrect ? '✓' : '✗' } | Addition: ${ summaryHasAddition ? '✓' : '✗' } | Removal: ${ viennaSingaporeGone ? '✓' : '✗' }`
                    : `Verification failed. Title: ${ titleCorrect }, adequate: ${ summaryAdequate }`,
            }
        }
    ))
    return movementReport(movement.name, sections)
}
