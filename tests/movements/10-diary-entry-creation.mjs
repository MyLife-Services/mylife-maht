/**
 * Score 10 — Diary Entry Creation
 *
 * Purpose: Submit a fictional diary entry to the active diary bot,
 * negotiate the save, and verify the entry in collections with metadata assessment.
 * Parallel structure to Score 06 (journaler entry creation).
 *
 * Depends on: Score 09 (context.diaryBotId, context.diaryActiveBotId)
 */
import { context, logTurn, request, } from '../lib/session.mjs'
import { section, movementReport, } from '../lib/report.mjs'
export const movement = {
    name: 'Diary Entry Creation',
    number: '10',
    suite: 'memory',
}
const SCORE_ID = '10'
const COLLECTION_TYPE = 'entry'
/**
 * Fictional diary entry — raw, interior, work-stress register.
 * Deliberately shorter and more immediate than the journaler entry.
 */
const mFictionalEntry = `Thursday. Had a one-on-one with my manager this morning that I keep turning over. She said something in passing — not directed at me specifically, but it landed oddly. Spent most of the afternoon pretending to work while actually replaying it. Told myself I'd shake it off by dinner. Made pasta. Washed the dishes for longer than necessary. The thing is, I think she was right. That might actually be the part that's bothering me. Going to sleep on it. Tomorrow it will probably look smaller.`
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
    summary: {
        salientPoints: [
            { key: 'Manager / one-on-one', test: t=>/manager|one.on.one|meeting/i.test(t), },
            { key: 'Something "landed oddly"', test: t=>/land|odd|off|wrong/i.test(t), },
            { key: 'Afternoon replaying', test: t=>/afternoon|replay|rumina|pretend/i.test(t), },
            { key: 'Dinner / home', test: t=>/dinner|evening|home|pasta|dishes/i.test(t), },
            { key: 'Self-awareness (she was right)', test: t=>/right|correct|bother|realiz/i.test(t), },
            { key: 'Resolve to sleep on it', test: t=>/sleep|tomorrow|smaller/i.test(t), },
        ],
        minLengthChars: 60,
    },
}
function stripHtml(str){ return str.replace(/<[^>]+>/g, '').trim() }
function extractInstruction(instructions=[], command){
    return instructions.find(i=>i?.command===command) ?? null
}
function assessMetadata(item){
    const { title='', keywords=[], mood='', phaseOfLife='', summary='', } = item
    const summaryLower = summary.toLowerCase()
    const titleMatch = mPredicted.title.patterns.some(p=>p.test(title))
    const itemKeywordsLower = keywords.map(k=>k.toLowerCase())
    const keywordHits = mPredicted.keywords.expected.filter(k=>itemKeywordsLower.some(ik=>ik.includes(k)||k.includes(ik)))
    const keywordMisses = mPredicted.keywords.expected.filter(k=>!keywordHits.includes(k))
    const moodMatch = mPredicted.mood.acceptable.some(m=>mood.toLowerCase().includes(m))
    const phaseMatch = mPredicted.phaseOfLife.acceptable.some(p=>(phaseOfLife??'').toLowerCase().includes(p))
    const salientResults = mPredicted.summary.salientPoints.map(p=>({ key: p.key, present: p.test(summaryLower) }))
    const salientHits = salientResults.filter(r=>r.present).length
    return {
        title: { actual: title, matched: titleMatch, },
        keywords: { actual: keywords, hits: keywordHits, misses: keywordMisses, precision: `${ keywordHits.length }/${ mPredicted.keywords.expected.length }`, score: keywordHits.length / mPredicted.keywords.expected.length, },
        mood: { actual: mood, matched: moodMatch, },
        phaseOfLife: { actual: phaseOfLife, matched: phaseMatch, },
        summary: { length: summary.length, adequate: summary.length >= mPredicted.summary.minLengthChars, salientCoverage: `${ salientHits }/${ mPredicted.summary.salientPoints.length }`, salientScore: salientHits / mPredicted.summary.salientPoints.length, salientResults, },
    }
}
export async function play(){
    console.log(`\nMovement ${ movement.number }: ${ movement.name }`)
    const sections = []
    if(!context.diaryBotId){
        console.log('  ✗ Cannot run — no diaryBotId in context. Run Movement 09 first.')
        return { passed: false, tally: '0/2' }
    }
    /* ── movement 1 — submit fictional entry, negotiate save ── */
    console.log(`\n    ── Submitting fictional diary entry (${ mFictionalEntry.length } chars) ──`)
    logTurn(SCORE_ID, 'synthetic', mFictionalEntry, { movement: 1, note: 'fictional diary entry' })
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
        logTurn(SCORE_ID, 'diary', responseText, { movement: 1, exchange: exchangeCount, instructions })
        const createInstr = extractInstruction(instructions, 'createItem')
        if(createInstr?.itemId){
            createdEntryId = createInstr.itemId
            console.log(`    ✓ Entry saved on exchange ${ exchangeCount } — itemId: ${ createdEntryId }`)
            break
        }
        const isConfirmation = /confirm|save|shall i|should i|would you like/i.test(responseText)
        const isQuestion = responseText.includes('?')
        console.log(`    Exchange ${ exchangeCount }: ${ responseText.length } chars — question: ${ isQuestion }, confirmation: ${ isConfirmation }`)
        if(exchangeCount >= maxExchanges){
            console.log(`    ⚠ Exchange limit — asking diary to save directly`)
            const saveReq = `Please save this entry.`
            logTurn(SCORE_ID, 'synthetic', saveReq, { movement: 1, exchange: ++exchangeCount, note: 'explicit save' })
            currentResponse = await request('/members/', { method: 'POST', body: JSON.stringify({ message: saveReq, }), })
            const { instructions: fi=[], responses: fr=[], } = currentResponse ?? {}
            logTurn(SCORE_ID, 'diary', fr.map(r=>stripHtml(r.message)).join('\n'), { movement: 1, exchange: exchangeCount, instructions: fi })
            const fc = extractInstruction(fi, 'createItem')
            if(fc?.itemId){ createdEntryId = fc.itemId; console.log(`    ✓ Saved after explicit request — itemId: ${ createdEntryId }`) }
            else console.log(`    ✗ Not saved after explicit request`)
            break
        }
        const followUp = isConfirmation ? `Yes, please save it.`
            : isQuestion ? `Yes, that sounds right. Please save this entry.`
            : `Please save this entry when you're ready.`
        logTurn(SCORE_ID, 'synthetic', followUp, { movement: 1, exchange: ++exchangeCount })
        currentResponse = await request('/members/', { method: 'POST', body: JSON.stringify({ message: followUp, }), })
    }
    sections.push(section(
        `Write diary entry (${ exchangeCount } exchange${ exchangeCount !== 1 ? 's' : '' })`,
        { createdEntryId, exchangeCount, },
        result => {
            const passed = !!result?.createdEntryId
            console.log(`\n    ── Movement 1 Summary ──`)
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
    /* ── movement 2 — verify in collections, assess metadata ── */
    const entryId = context.diaryEntryId
    if(!entryId){
        sections.push(section('Verify entry in collections', null, ()=>({ passed: false, learned: {}, notes: 'Skipped — no entryId' })))
        return movementReport(movement.name, sections)
    }
    const collectionsResponse = await request(`/members/collections/${ COLLECTION_TYPE }`)
    sections.push(section(
        'Verify entry in collections',
        collectionsResponse,
        result => {
            if(!Array.isArray(result)) return { passed: false, learned: {}, notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }` }
            const found = result.find(item=>item.id===entryId)
            const passed = !!found
            console.log(`\n    ── Movement 2: Collections Verification ──`)
            console.log(`    Collection size: ${ result.length } | Found: ${ passed }`)
            if(!found) return { passed, learned: { collectionSize: result.length }, notes: `entryId not found` }
            const assessment = assessMetadata(found)
            console.log(`    Title: "${ assessment.title.actual }" — ${ assessment.title.matched?'✓':'✗' }`)
            console.log(`    Keywords: ${ assessment.keywords.precision } | Mood: "${ assessment.mood.actual }" ${ assessment.mood.matched?'✓':'✗' }`)
            console.log(`    Summary: ${ assessment.summary.length } chars, ${ assessment.summary.salientCoverage } salient`)
            assessment.summary.salientResults.forEach(r=>console.log(`      ${ r.present?'✓':'✗' } ${ r.key }`))
            console.log(`    ──────────────────────────────────────────`)
            context.diaryVerifiedEntry = found
            return {
                passed,
                learned: {
                    entryId: found.id,
                    metadata: { title: assessment.title, keywords: assessment.keywords, mood: assessment.mood, phaseOfLife: assessment.phaseOfLife, },
                    summary: { length: assessment.summary.length, adequate: assessment.summary.adequate, salientCoverage: assessment.summary.salientCoverage, salientResults: assessment.summary.salientResults, },
                    predicted: { keywords: mPredicted.keywords.expected, mood: mPredicted.mood.acceptable, },
                },
                notes: `Found. Title: ${ assessment.title.matched?'✓':'✗' } | Keywords: ${ assessment.keywords.precision } | Mood: ${ assessment.mood.matched?'✓':'✗' } | Summary: ${ assessment.summary.salientCoverage }`,
            }
        }
    ))
    return movementReport(movement.name, sections)
}
