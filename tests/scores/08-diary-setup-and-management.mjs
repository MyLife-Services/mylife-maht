/**
 * Score 08 — Diary Setup and Item Management
 *
 * Purpose: Create (or locate) the diary bot, personalize it, write a fictional
 * diary entry, then put that entry through a full editorial lifecycle — direct
 * and NL-mediated title and summary mutations, ending with a collection verify.
 * Combines the setup + content + management pattern from Scores 05 + 06, applied
 * to the diary type. Collection type for both journaler and diary is `entry`.
 *
 * Depends on: Score 01 (context.teams, context.bots, context.creatableTypes)
 *
 * A synthetic passing this score understands:
 *   - Diary and journaler share `entry` as collection type but differ in form ('diary' vs 'journal')
 *   - Diary uses routine type 'getting-started' (same as journaler)
 *   - All item management instruction commands are bot-agnostic
 */
import { context, logTurn, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Diary Setup and Management',
    number: '08',
}
const SCORE_ID = '08'
const BOT_TYPE = 'diary'
const COLLECTION_TYPE = 'entry'
const ROUTINE_TYPE = 'getting-started'
const mNames = [
    'Folio', 'Vesper', 'Rue', 'Pax', 'Lumen',
    'Calder', 'Maren', 'Sable', 'Rook', 'Finch',
]
const mTitlesA = [
    'Thursday Work Thoughts',
    'The One-on-One',
    'What My Manager Said',
    'Still Thinking About It',
    'After the Meeting',
]
const mTitlesB = [
    'Pasta and Overthinking',
    'She Was Right',
    'Tomorrow It Looks Smaller',
    'The Long Way Through the Dishes',
    'A Loop Worth Breaking',
]
/**
 * Fictional diary entry — raw, immediate, self-aware. Shorter register than the
 * journaler entry; diary voice is more interior and less curated.
 */
const mFictionalEntry = `Thursday. Had a one-on-one with my manager this morning that I keep turning over. She said something in passing — not directed at me specifically, but it landed oddly. Spent most of the afternoon pretending to work while actually replaying it. Told myself I'd shake it off by dinner. Made pasta. Washed the dishes for longer than necessary. The thing is, I think she was right. That might actually be the part that's bothering me. Going to sleep on it. Tomorrow it will probably look smaller.`
const mSummaryAppend = `\n\nAddendum: Checked my notes from the meeting before bed. Nothing in writing, of course. That's the kind of thing that never makes it into the record.`
const mRemovalRequest = `Please remove the pasta and dishes detail — it reads as filler and I'd rather the entry focus on the work situation.`
const mAdditionRequest = `Please add that I sent her a follow-up message saying I appreciated the feedback, even though I'm still not sure I meant it.`
/**
 * Predicted metadata for the fictional diary entry.
 */
const mPredicted = {
    title: {
        patterns: [/thursday/i, /meeting/i, /manager/i, /work/i, /one.on.one/i, /feedback/i, /overthink/i],
        description: 'Should reference the day, the meeting, or the work context',
    },
    keywords: {
        expected: ['work', 'meeting', 'manager', 'reflection', 'feedback', 'overthinking', 'self-awareness', 'thursday'],
        description: '8 expected keywords across work, emotion, self-reflection themes',
    },
    mood: {
        acceptable: ['unsettled', 'troubled', 'ambivalent', 'pensive', 'self-critical', 'reflective', 'anxious', 'contemplative'],
        description: 'Should be unsettled/ambivalent — not positive, not dramatic',
    },
    phaseOfLife: {
        acceptable: ['adulthood', 'adult', 'working life', 'career', 'adult life', 'professional life'],
        description: 'Working adult narrator',
    },
}
function stripHtml(str){ return str.replace(/<[^>]+>/g, '').trim() }
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)] }
function extractInstruction(instructions=[], command){
    return instructions.find(i=>i?.command===command) ?? null
}
function assessEntryMetadata(item){
    const { title='', keywords=[], mood='', phaseOfLife='', summary='', } = item
    const summaryLower = summary.toLowerCase()
    const titleMatch = mPredicted.title.patterns.some(p=>p.test(title))
    const itemKeywordsLower = keywords.map(k=>k.toLowerCase())
    const keywordHits = mPredicted.keywords.expected.filter(k=>
        itemKeywordsLower.some(ik=>ik.includes(k) || k.includes(ik))
    )
    const keywordMisses = mPredicted.keywords.expected.filter(k=>!keywordHits.includes(k))
    const moodMatch = mPredicted.mood.acceptable.some(m=>mood.toLowerCase().includes(m))
    const phaseMatch = mPredicted.phaseOfLife.acceptable.some(p=>(phaseOfLife ?? '').toLowerCase().includes(p))
    const salientPoints = [
        { key: 'Manager / one-on-one', test: t=>/manager|one.on.one|meeting/i.test(t), },
        { key: 'Something "landed oddly"', test: t=>/land|odd|off|wrong/i.test(t), },
        { key: 'Afternoon replaying / ruminating', test: t=>/afternoon|replay|rumina|pretend/i.test(t), },
        { key: 'Dinner / evening at home', test: t=>/dinner|evening|home|pasta|dishes/i.test(t), },
        { key: 'Self-awareness (she was right)', test: t=>/right|correct|bother|realiz/i.test(t), },
        { key: 'Resolve to sleep on it', test: t=>/sleep|tomorrow|smaller/i.test(t), },
    ]
    const salientResults = salientPoints.map(p=>({ key: p.key, present: p.test(summaryLower) }))
    const salientHits = salientResults.filter(r=>r.present).length
    return {
        title: { actual: title, matched: titleMatch, },
        keywords: { actual: keywords, hits: keywordHits, misses: keywordMisses, precision: `${ keywordHits.length }/${ mPredicted.keywords.expected.length }`, score: keywordHits.length / mPredicted.keywords.expected.length, },
        mood: { actual: mood, matched: moodMatch, },
        phaseOfLife: { actual: phaseOfLife, matched: phaseMatch, },
        summary: { length: summary.length, adequate: summary.length >= 60, salientCoverage: `${ salientHits }/${ salientPoints.length }`, salientScore: salientHits / salientPoints.length, salientResults, },
    }
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    if(!context.teams?.length || !context.bots){
        console.log('  ✗ Cannot run — no teams/bots in context. Run Score 01 first.')
        return { passed: false, tally: '0/11' }
    }
    const chosenName = pick(mNames)
    const chosenTitleA = pick(mTitlesA)
    const chosenTitleB = pick(mTitlesB)
    let currentSummary = ''
    /* ── movement 1 — create diary or locate existing ── */
    const isCreatable = context.creatableTypes?.includes(BOT_TYPE)
    let diaryBotId = null
    if(isCreatable){
        const createResponse = await request('/members/bots/create', {
            method: 'POST',
            body: JSON.stringify({ type: BOT_TYPE, }),
        })
        diaryBotId = createResponse?.id ?? createResponse?.bot_id ?? null
        movements.push(movement(
            `Create diary bot (type: ${ BOT_TYPE })`,
            createResponse,
            result => {
                const id = result?.id ?? result?.bot_id
                const passed = !!id && (result?.type === BOT_TYPE || result?.being === 'bot')
                console.log(`\n    ── Movement 1: Bot Creation ──`)
                console.log(`    Created: ${ passed } | id: ${ id ?? '(none)' } | type: ${ result?.type ?? '?' }`)
                console.log(`    ────────────────────────────────`)
                if(passed) context.diaryBotId = id
                return {
                    passed,
                    learned: { created: true, botId: id, type: result?.type, being: result?.being, },
                    notes: passed ? `Diary created. id: ${ id }` : `Create failed. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
                }
            }
        ))
    } else {
        const existing = Object.values(context.bots ?? {}).find(b=>b.type===BOT_TYPE)
        diaryBotId = existing?.id ?? null
        movements.push(movement(
            `Locate existing diary bot`,
            existing,
            result => {
                const passed = !!result?.id
                console.log(`\n    ── Movement 1: Locate Existing Diary ──`)
                console.log(`    Found: ${ passed } | id: ${ result?.id ?? '(none)' }`)
                console.log(`    ────────────────────────────────────────`)
                if(passed) context.diaryBotId = result.id
                return {
                    passed,
                    learned: { created: false, botId: result?.id, type: result?.type, },
                    notes: passed ? `Existing diary found. id: ${ result.id }` : `No diary found and type not creatable`,
                }
            }
        ))
    }
    const botId = context.diaryBotId ?? diaryBotId
    if(!botId){
        const skip = name => ({ name, passed: false, learned: {}, notes: 'Skipped — no diary bot id' })
        ;['Rename diary', 'Activate diary', 'Verify routine personalization',
          'Write diary entry', 'Verify entry in collections', 'Activate entry in diary context',
          'Direct title change', 'Chat title change', 'Direct summary append',
          'Chat: remove detail', 'Chat: add detail', 'Verify all mutations',
        ].forEach(n=>movements.push(skip(n)))
        return scoreReport(score.name, movements)
    }
    /* ── movement 2 — rename ── */
    const renameResponse = await request(`/members/bots/${ botId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: botId, bot_name: chosenName, }),
    })
    movements.push(movement(
        `Rename diary → "${ chosenName }"`,
        renameResponse,
        result => {
            const savedName = result?.bot_name ?? result?.name
            const passed = !!result && (savedName === chosenName || result?.success === true)
            console.log(`\n    ── Movement 2: Rename ──`)
            console.log(`    Requested: "${ chosenName }" | Returned: "${ savedName ?? '?' }"`)
            console.log(`    ───────────────────────`)
            return {
                passed,
                learned: { nameRequested: chosenName, nameReturned: savedName, },
                notes: passed ? `Renamed to "${ chosenName }"` : `Rename may have failed`,
            }
        }
    ))
    /* ── movement 3 — activate ── */
    const activateResponse = await request(`/members/bots/activate/${ botId }`, {
        method: 'POST',
        body: JSON.stringify({}),
    })
    movements.push(movement(
        'Activate diary',
        activateResponse,
        result => {
            const id = result?.id ?? result?.bot_id
            const passed = !!id && result?.success === true
            console.log(`\n    ── Movement 3: Activate ──`)
            console.log(`    Success: ${ result?.success } | id: ${ id ?? '?' } | firstAccess: ${ result?.firstAccess }`)
            console.log(`    ──────────────────────────`)
            if(passed) context.diaryActiveBotId = id
            return {
                passed,
                learned: { botId: id, firstAccess: result?.firstAccess, version: result?.version, },
                notes: passed ? `Diary activated. id: ${ id }` : `Activation failed. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
            }
        }
    ))
    /* ── movement 4 — routine ── */
    const routineResponse = await request(`/routine/${ ROUTINE_TYPE }`)
    movements.push(movement(
        'Verify routine personalization',
        routineResponse,
        result => {
            const { routine, success, } = result ?? {}
            const { events=[], } = routine ?? {}
            const passed = success === true && !!events.length
            if(!passed) return { passed, learned: {}, notes: `Routine failed or empty. Got: ${ JSON.stringify(result)?.substring(0, 200) }` }
            const dialog = events.flatMap(e=>e.cast ?? []).map(c=>c.dialog ?? '').join('\n').replace(/<[^>]+>/g, '')
            const memberName = context.memberFirstName ?? ''
            const humanNamePresent = memberName.length > 0 && dialog.toLowerCase().includes(memberName.toLowerCase())
            const botNamePresent = dialog.toLowerCase().includes(chosenName.toLowerCase())
            const isDiaryVoice = /diary|thought|private|reflect|feel|safe/i.test(dialog)
            console.log(`\n    ── Movement 4: Routine ──`)
            console.log(`    Events: ${ events.length } | Human name: ${ humanNamePresent } | Bot name: ${ botNamePresent } | Diary voice: ${ isDiaryVoice }`)
            console.log(`    Preview: "${ dialog.substring(0, 180) }${ dialog.length > 180 ? '...' : '' }"`)
            console.log(`    ────────────────────────`)
            return {
                passed,
                learned: { eventCount: events.length, humanNamePresent, botNamePresent, isDiaryVoice, },
                notes: `Routine OK. Human name: ${ humanNamePresent }, bot name: ${ botNamePresent }, diary voice: ${ isDiaryVoice }`,
            }
        }
    ))
    /* ── movement 5 — write diary entry ── */
    console.log(`\n    ── Submitting fictional diary entry (${ mFictionalEntry.length } chars) ──`)
    logTurn(SCORE_ID, 'synthetic', mFictionalEntry, { movement: 5, note: 'fictional diary entry' })
    let createdEntryId = null
    let exchangeCount = 0
    const maxExchanges = 4
    let currentResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mFictionalEntry, }),
    })
    exchangeCount++
    while(true){
        const { instructions=[], responses=[], } = currentResponse ?? {}
        const responseText = responses.map(r=>stripHtml(r.message)).join('\n')
        logTurn(SCORE_ID, 'diary', responseText, { movement: 5, exchange: exchangeCount, instructions })
        const createInstr = extractInstruction(instructions, 'createItem')
        if(createInstr?.itemId){
            createdEntryId = createInstr.itemId
            console.log(`    ✓ Entry saved on exchange ${ exchangeCount } — itemId: ${ createdEntryId }`)
            break
        }
        const isConfirmation = /confirm|save|shall i|should i|would you like/i.test(responseText)
        console.log(`    Exchange ${ exchangeCount }: ${ responseText.length } chars — confirmation: ${ isConfirmation }`)
        if(exchangeCount >= maxExchanges){
            console.log(`    ⚠ Exchange limit — asking diary to save directly`)
            const saveReq = `Please save this entry.`
            logTurn(SCORE_ID, 'synthetic', saveReq, { movement: 5, exchange: ++exchangeCount, note: 'explicit save' })
            currentResponse = await request('/members/', { method: 'POST', body: JSON.stringify({ message: saveReq, }), })
            const { instructions: fi=[], responses: fr=[], } = currentResponse ?? {}
            logTurn(SCORE_ID, 'diary', fr.map(r=>stripHtml(r.message)).join('\n'), { movement: 5, exchange: exchangeCount, instructions: fi })
            const fc = extractInstruction(fi, 'createItem')
            if(fc?.itemId){ createdEntryId = fc.itemId; console.log(`    ✓ Saved after explicit request — itemId: ${ createdEntryId }`) }
            else console.log(`    ✗ Not saved after explicit request`)
            break
        }
        const followUp = isConfirmation ? `Yes, please save it.` : `Please save this entry when ready.`
        logTurn(SCORE_ID, 'synthetic', followUp, { movement: 5, exchange: ++exchangeCount })
        currentResponse = await request('/members/', { method: 'POST', body: JSON.stringify({ message: followUp, }), })
    }
    movements.push(movement(
        `Write diary entry (${ exchangeCount } exchange${ exchangeCount !== 1 ? 's' : '' })`,
        { createdEntryId, exchangeCount, },
        result => {
            const passed = !!result?.createdEntryId
            console.log(`\n    ── Movement 5 Summary ──`)
            console.log(`    Entry saved: ${ passed } | itemId: ${ result?.createdEntryId ?? 'none' } | Exchanges: ${ result?.exchangeCount }`)
            console.log(`    ────────────────────────`)
            if(passed) context.diaryEntryId = result.createdEntryId
            return {
                passed,
                learned: { createdEntryId: result?.createdEntryId, exchangesToSave: result?.exchangeCount, },
                notes: passed ? `Entry created after ${ result?.exchangeCount } exchange(s). itemId: ${ result?.createdEntryId }` : `Entry not saved`,
            }
        }
    ))
    /* ── movement 6 — verify entry in collections ── */
    const entryId = context.diaryEntryId
    if(!entryId){
        movements.push({ name: 'Verify entry in collections', passed: false, learned: {}, notes: 'Skipped — no diaryEntryId' })
    } else {
        const collectionsResponse = await request(`/members/collections/${ COLLECTION_TYPE }`)
        movements.push(movement(
            'Verify entry in collections',
            collectionsResponse,
            result => {
                if(!Array.isArray(result)) return { passed: false, learned: {}, notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }` }
                const found = result.find(item=>item.id===entryId)
                const passed = !!found
                console.log(`\n    ── Movement 6: Collections Verification ──`)
                console.log(`    Collection size: ${ result.length } | Found: ${ passed }`)
                if(!found) return { passed, learned: { collectionSize: result.length }, notes: `entryId not found in ${ result.length }-item collection` }
                const assessment = assessEntryMetadata(found)
                console.log(`    Title: "${ assessment.title.actual }" — ${ assessment.title.matched ? '✓' : '✗' }`)
                console.log(`    Keywords: ${ assessment.keywords.precision } | Mood: "${ assessment.mood.actual }" ${ assessment.mood.matched ? '✓' : '✗' }`)
                console.log(`    Summary: ${ assessment.summary.length } chars, ${ assessment.summary.salientCoverage } salient`)
                assessment.summary.salientResults.forEach(r=>console.log(`      ${ r.present ? '✓' : '✗' } ${ r.key }`))
                console.log(`    ──────────────────────────────────────────`)
                if(found?.summary?.length) currentSummary = found.summary
                context.diaryVerifiedEntry = found
                return {
                    passed,
                    learned: {
                        entryId: found.id,
                        metadata: { title: assessment.title, keywords: assessment.keywords, mood: assessment.mood, phaseOfLife: assessment.phaseOfLife, },
                        summary: { length: assessment.summary.length, salientCoverage: assessment.summary.salientCoverage, salientResults: assessment.summary.salientResults, },
                        predicted: { title: mPredicted.title.description, keywords: mPredicted.keywords.expected, mood: mPredicted.mood.acceptable, },
                    },
                    notes: `Found. Title: ${ assessment.title.matched ? '✓' : '✗' } | Keywords: ${ assessment.keywords.precision } | Mood: ${ assessment.mood.matched ? '✓' : '✗' } | Summary: ${ assessment.summary.salientCoverage }`,
                }
            }
        ))
    }
    /* bail if no entry to manage */
    if(!entryId){
        ;['Activate entry in diary context', 'Direct title change', 'Chat title change',
          'Direct summary append', 'Chat: remove detail', 'Chat: add detail', 'Verify all mutations',
        ].forEach(name=>movements.push({ name, passed: false, learned: {}, notes: 'Skipped — no entry id' }))
        return scoreReport(score.name, movements)
    }
    /* ── movement 7 — activate entry in diary context ── */
    const activateMsg = `I'd like to look at the entry I just wrote. Can you summarize what I captured?`
    logTurn(SCORE_ID, 'synthetic', activateMsg, { movement: 7, note: 'activate entry via itemId' })
    const activateEntryResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: activateMsg, itemId: entryId, }),
    })
    const { responses: m7Responses=[], } = activateEntryResponse ?? {}
    const m7Text = m7Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'diary', m7Text, { movement: 7 })
    movements.push(movement(
        'Activate entry in diary context',
        activateEntryResponse,
        result => {
            const { responses=[], success, } = result ?? {}
            const text = responses.map(r=>stripHtml(r.message)).join('\n')
            const referencesEntry = /manager|meeting|thursday|work|pasta|dishes|right/i.test(text)
            const passed = success === true && text.length > 0
            console.log(`\n    ── Movement 7: Entry Activation ──`)
            console.log(`    Response (${ text.length } chars) references entry: ${ referencesEntry }`)
            console.log(`    Preview: "${ text.substring(0, 160) }${ text.length > 160 ? '...' : '' }"`)
            console.log(`    ──────────────────────────────────`)
            return {
                passed,
                learned: { activated: passed, referencesEntry, responseLength: text.length, },
                notes: passed ? `Diary acknowledged entry. References content: ${ referencesEntry }` : `Activation failed`,
            }
        }
    ))
    /* ── movement 8 — direct title change ── */
    const directTitleResponse = await request(`/members/item/${ entryId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: entryId, title: chosenTitleA, }),
    })
    movements.push(movement(
        `Direct title change → "${ chosenTitleA }"`,
        directTitleResponse,
        result => {
            const { instructions=[], item, success, } = result ?? {}
            const updateInstr = extractInstruction(instructions, 'updateItem')
            const itemData = item ?? result
            const passed = success === true && !!updateInstr
            console.log(`\n    ── Movement 8: Direct Title Change ──`)
            console.log(`    Success: ${ success } | Instruction: ${ updateInstr ? '✓' : '✗' } | Title in response: "${ itemData?.title ?? '?' }"`)
            console.log(`    ─────────────────────────────────────`)
            if(itemData?.summary?.length) currentSummary = itemData.summary
            return {
                passed,
                learned: { titleSet: chosenTitleA, titleConfirmedInResponse: itemData?.title === chosenTitleA, },
                notes: passed ? `Title set to "${ chosenTitleA }"` : `Direct title PUT failed`,
            }
        }
    ))
    /* ── movement 9 — chat title change ── */
    const chatTitleMsg = `Please change the title of this entry to "${ chosenTitleB }"`
    logTurn(SCORE_ID, 'synthetic', chatTitleMsg, { movement: 9, itemId: entryId })
    const chatTitleResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: chatTitleMsg, itemId: entryId, }),
    })
    const { instructions: m9Instr=[], responses: m9Responses=[], } = chatTitleResponse ?? {}
    logTurn(SCORE_ID, 'diary', m9Responses.map(r=>stripHtml(r.message)).join('\n'), { movement: 9, instructions: m9Instr })
    movements.push(movement(
        `Chat title change → "${ chosenTitleB }"`,
        chatTitleResponse,
        result => {
            const { instructions=[], success, } = result ?? {}
            const titleInstr = extractInstruction(instructions, 'updateItemTitle')
            const instrTitle = titleInstr?.title ?? ''
            const titleMatches = instrTitle.toLowerCase().includes(chosenTitleB.toLowerCase())
                || chosenTitleB.toLowerCase().includes(instrTitle.toLowerCase())
            const passed = success === true && !!titleInstr && instrTitle.length > 0
            console.log(`\n    ── Movement 9: Chat Title Change ──`)
            console.log(`    Requested: "${ chosenTitleB }" | Got: "${ instrTitle }" | Matches: ${ titleMatches }`)
            console.log(`    ────────────────────────────────────`)
            context.diaryFinalTitle = instrTitle || chosenTitleB
            return {
                passed,
                learned: { titleRequested: chosenTitleB, titleInInstruction: instrTitle, titleMatches, },
                notes: passed ? `updateItemTitle received. Title: "${ instrTitle }"` : `No updateItemTitle instruction`,
            }
        }
    ))
    /* ── movement 10 — direct summary append ── */
    const updatedSummary = currentSummary + mSummaryAppend
    const directSummaryResponse = await request(`/members/item/${ entryId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: entryId, summary: updatedSummary, }),
    })
    movements.push(movement(
        'Direct summary append ("Addendum: notes...")',
        directSummaryResponse,
        result => {
            const { instructions=[], item, success, } = result ?? {}
            const itemData = item ?? result
            const updateInstr = extractInstruction(instructions, 'updateItem')
            const summaryHasAppend = (itemData?.summary ?? '').includes('Addendum')
            const passed = success === true && !!updateInstr
            console.log(`\n    ── Movement 10: Direct Summary Append ──`)
            console.log(`    Success: ${ success } | Addendum present: ${ summaryHasAppend }`)
            console.log(`    ─────────────────────────────────────────`)
            if(itemData?.summary?.length) currentSummary = itemData.summary
            return {
                passed,
                learned: { summaryLength: itemData?.summary?.length, appendConfirmed: summaryHasAppend, },
                notes: passed ? `Summary appended. Addendum confirmed: ${ summaryHasAppend }` : `Direct summary PUT failed`,
            }
        }
    ))
    /* ── movement 11 — chat: remove pasta detail ── */
    logTurn(SCORE_ID, 'synthetic', mRemovalRequest, { movement: 11, itemId: entryId })
    const removalResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mRemovalRequest, itemId: entryId, }),
    })
    const { instructions: m11Instr=[], responses: m11Responses=[], } = removalResponse ?? {}
    logTurn(SCORE_ID, 'diary', m11Responses.map(r=>stripHtml(r.message)).join('\n'), { movement: 11, instructions: m11Instr })
    movements.push(movement(
        'Chat: remove pasta/dishes detail',
        removalResponse,
        result => {
            const { instructions=[], success, } = result ?? {}
            const summaryInstr = extractInstruction(instructions, 'updateItemSummary')
            const newSummary = summaryInstr?.summary ?? ''
            const passed = success === true && !!summaryInstr && newSummary.length > 0
            const detailRemoved = !/pasta|dish/i.test(newSummary)
            const coherent = newSummary.length > 40 && !newSummary.includes('undefined')
            console.log(`\n    ── Movement 11: Chat Remove ──`)
            console.log(`    Instruction: ${ !!summaryInstr } | Length: ${ newSummary.length } | Removed: ${ detailRemoved }`)
            console.log(`    Preview: "${ newSummary.substring(0, 160) }${ newSummary.length > 160 ? '...' : '' }"`)
            console.log(`    ─────────────────────────────`)
            if(newSummary.length) currentSummary = newSummary
            return {
                passed,
                learned: { summaryLength: newSummary.length, targetDetailRemoved: detailRemoved, coherent, },
                notes: passed ? `updateItemSummary received. Removal honored: ${ detailRemoved }` : `No updateItemSummary`,
            }
        }
    ))
    /* ── movement 12 — chat: add follow-up message detail ── */
    logTurn(SCORE_ID, 'synthetic', mAdditionRequest, { movement: 12, itemId: entryId })
    const additionResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mAdditionRequest, itemId: entryId, }),
    })
    const { instructions: m12Instr=[], responses: m12Responses=[], } = additionResponse ?? {}
    logTurn(SCORE_ID, 'diary', m12Responses.map(r=>stripHtml(r.message)).join('\n'), { movement: 12, instructions: m12Instr })
    movements.push(movement(
        'Chat: add follow-up message detail',
        additionResponse,
        result => {
            const { instructions=[], success, } = result ?? {}
            const summaryInstr = extractInstruction(instructions, 'updateItemSummary')
            const newSummary = summaryInstr?.summary ?? ''
            const passed = success === true && !!summaryInstr && newSummary.length > 0
            const detailAdded = /follow.up|message|appreciat|feedback/i.test(newSummary)
            console.log(`\n    ── Movement 12: Chat Add ──`)
            console.log(`    Instruction: ${ !!summaryInstr } | Length: ${ newSummary.length } | Added: ${ detailAdded }`)
            console.log(`    Preview: "${ newSummary.substring(0, 160) }${ newSummary.length > 160 ? '...' : '' }"`)
            console.log(`    ──────────────────────────`)
            if(newSummary.length) currentSummary = newSummary
            context.diaryExpectedFragment = 'follow'
            return {
                passed,
                learned: { summaryLength: newSummary.length, detailAdded, coherent: newSummary.length > 40, },
                notes: passed ? `updateItemSummary received. Addition woven in: ${ detailAdded }` : `No updateItemSummary`,
            }
        }
    ))
    /* ── movement 13 — verify all mutations in collection ── */
    const finalCollectionsResponse = await request('/members/collections/entry')
    movements.push(movement(
        'Verify all mutations persisted',
        finalCollectionsResponse,
        result => {
            if(!Array.isArray(result)) return { passed: false, learned: {}, notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }` }
            const found = result.find(item=>item.id===entryId)
            if(!found) return { passed: false, learned: { collectionSize: result.length }, notes: `entryId not found in ${ result.length }-item collection` }
            const { title: finalTitle='', summary: finalSummary='', } = found
            const expectedTitle = context.diaryFinalTitle ?? chosenTitleB
            const titleCorrect = finalTitle.toLowerCase() === expectedTitle.toLowerCase()
                || finalTitle.toLowerCase().includes(expectedTitle.toLowerCase().substring(0, 10))
            const summaryHasAddition = /follow.up|message|appreciat|feedback/i.test(finalSummary)
            const pastaGone = !/pasta|dish/i.test(finalSummary)
            const summaryAdequate = finalSummary.length > 40
            const passed = !!found && titleCorrect && summaryAdequate
            console.log(`\n    ── Movement 13: Final Verification ──`)
            console.log(`    Title — expected: "${ expectedTitle }" | got: "${ finalTitle }" | match: ${ titleCorrect }`)
            console.log(`    Summary (${ finalSummary.length } chars):`)
            console.log(`      Addition (follow-up): ${ summaryHasAddition }`)
            console.log(`      Removal (pasta/dishes): ${ pastaGone }`)
            console.log(`    Preview: "${ finalSummary.substring(0, 250) }${ finalSummary.length > 250 ? '...' : '' }"`)
            console.log(`    ──────────────────────────────────────`)
            context.diaryFinalEntry = found
            return {
                passed,
                learned: { finalTitle, expectedTitle, titleCorrect, summaryLength: finalSummary.length, summaryHasAddition, removalHonored: pastaGone, },
                notes: passed
                    ? `All mutations verified. Title: ${ titleCorrect ? '✓' : '✗' } | Addition: ${ summaryHasAddition ? '✓' : '✗' } | Removal: ${ pastaGone ? '✓' : '✗' }`
                    : `Verification failed. Title: ${ titleCorrect }, adequate: ${ summaryAdequate }`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
