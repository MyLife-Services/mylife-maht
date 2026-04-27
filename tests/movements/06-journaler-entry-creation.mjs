/**
 * Score 06 — Journaler Entry Creation
 *
 * Purpose: Engage the journaler in natural language, capture a fictional
 * journal entry, then verify it exists in collections with accurate metadata.
 * Parallel structure to Score 03 (biographer memory creation) for entry type.
 *
 * Depends on: Score 05 (context.journalerBotId, context.journalerActiveBotId)
 *
 * A synthetic passing this score understands:
 *   - How to submit an entry narrative via POST /members/ and negotiate a save
 *   - What a createItem instruction looks like for a journal entry
 *   - How to verify the entry via GET /members/collections/entry
 *   - How journaler metadata (mood, keywords) compares to predicted values
 */
import { context, logTurn, request, } from '../lib/session.mjs'
import { section, movementReport, } from '../lib/report.mjs'
export const movement = {
    name: 'Journaler Entry Creation',
    number: '06',
    suite: 'memory',
}
const SCORE_ID = '06'
const COLLECTION_TYPE = 'entry'
/**
 * Fictional journal entry — diary voice, present-tense, personal.
 * Deliberately different in register from the biographer memory narrative.
 */
const mFictionalEntry = `April 18th. It rained for the third straight day and I found myself sitting by the kitchen window longer than I intended, watching the drops race each other down the glass. Made coffee twice and drank neither cup fully. Called my sister in the afternoon — she sounded tired but said she was fine, which is what she always says. I've been thinking about Nana Bea a lot lately. Not sure why April brings her back so reliably. Started a new book, abandoned it by page forty. The apartment feels smaller when it rains. Not unpleasantly so — more like it's holding me in place while I figure out what I actually want to do with the day. Didn't come to any conclusions. That felt okay.`
const mPredicted = {
    title: {
        patterns: [/april/i, /rain/i, /coffee/i, /sister/i, /nana/i, /apartment/i, /window/i, /quiet/i, /gray/i],
        description: 'Should reference the day, weather, or emotional tone',
    },
    keywords: {
        expected: ['rain', 'coffee', 'sister', 'reflection', 'apartment', 'reading', 'memory', 'solitude', 'spring'],
        description: '9 expected keywords across weather, family, emotion, setting themes',
    },
    mood: {
        acceptable: ['reflective', 'contemplative', 'melancholy', 'pensive', 'wistful', 'quiet', 'subdued', 'introspective', 'bittersweet'],
        description: 'Should be reflective/contemplative — not happy, not distressed',
    },
    phaseOfLife: {
        acceptable: ['adulthood', 'adult', 'present', 'adult life', 'middle age', 'young adult'],
        description: 'Present-day adult narrator',
    },
    summary: {
        salientPoints: [
            { key: 'Rain / weather', test: t=>/rain/i.test(t), },
            { key: 'Coffee detail', test: t=>/coffee/i.test(t), },
            { key: 'Sister phone call', test: t=>/sister/i.test(t), },
            { key: 'Nana Bea reference', test: t=>/nana/i.test(t), },
            { key: 'Apartment / home setting', test: t=>/apartment/i.test(t), },
            { key: 'Book / reading abandoned', test: t=>/book|read|page/i.test(t), },
            { key: 'Emotional ambiguity / unresolved', test: t=>/figure out|conclusion|okay|fine/i.test(t), },
        ],
        minLengthChars: 80,
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
    if(!context.journalerBotId){
        console.log('  ✗ Cannot run — no journalerBotId in context. Run Movement 05 first.')
        return { passed: false, tally: '0/2' }
    }
    /* ── movement 1 — submit fictional entry, negotiate save ── */
    console.log(`\n    ── Submitting fictional journal entry (${ mFictionalEntry.length } chars) ──`)
    logTurn(SCORE_ID, 'synthetic', mFictionalEntry, { movement: 1, note: 'fictional journal entry' })
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
        logTurn(SCORE_ID, 'journaler', responseText, { movement: 1, exchange: exchangeCount, instructions })
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
            console.log(`    ⚠ Exchange limit — asking journaler to save directly`)
            const saveReq = `Please save this entry.`
            logTurn(SCORE_ID, 'synthetic', saveReq, { movement: 1, exchange: ++exchangeCount, note: 'explicit save' })
            currentResponse = await request('/members/', { method: 'POST', body: JSON.stringify({ message: saveReq, }), })
            const { instructions: fi=[], responses: fr=[], } = currentResponse ?? {}
            logTurn(SCORE_ID, 'journaler', fr.map(r=>stripHtml(r.message)).join('\n'), { movement: 1, exchange: exchangeCount, instructions: fi })
            const fc = extractInstruction(fi, 'createItem')
            if(fc?.itemId){ createdEntryId = fc.itemId; console.log(`    ✓ Saved after explicit request — itemId: ${ createdEntryId }`) }
            else console.log(`    ✗ Not saved after explicit request`)
            break
        }
        const followUp = isConfirmation ? `Yes, please save it.`
            : isQuestion ? `Yes, that sounds right. Please go ahead and save.`
            : `Please save this entry when you're ready.`
        logTurn(SCORE_ID, 'synthetic', followUp, { movement: 1, exchange: ++exchangeCount })
        currentResponse = await request('/members/', { method: 'POST', body: JSON.stringify({ message: followUp, }), })
    }
    sections.push(section(
        `Write journal entry (${ exchangeCount } exchange${ exchangeCount !== 1 ? 's' : '' })`,
        { createdEntryId, exchangeCount, },
        result => {
            const passed = !!result?.createdEntryId
            console.log(`\n    ── Movement 1 Summary ──`)
            console.log(`    Entry saved: ${ passed } | itemId: ${ result?.createdEntryId ?? 'none' } | Exchanges: ${ result?.exchangeCount }`)
            console.log(`    ────────────────────────`)
            if(passed) context.createdEntryId = result.createdEntryId
            return {
                passed,
                learned: { createdEntryId: result?.createdEntryId, exchangesToSave: result?.exchangeCount, },
                notes: passed ? `Entry created after ${ result?.exchangeCount } exchange(s). itemId: ${ result?.createdEntryId }` : `Entry not saved after ${ result?.exchangeCount } exchange(s)`,
            }
        }
    ))
    /* ── movement 2 — verify in collections, assess metadata ── */
    const entryId = context.createdEntryId
    if(!entryId){
        sections.push(section('Verify entry in collections', null, ()=>({ passed: false, learned: {}, notes: 'Skipped — no entryId from movement 1' })))
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
            if(!found) return { passed, learned: { collectionSize: result.length }, notes: `entryId ${ entryId } not found in ${ result.length }-item collection` }
            const assessment = assessMetadata(found)
            console.log(`\n    ── Metadata Precision ──`)
            console.log(`    Title: "${ assessment.title.actual }" — ${ assessment.title.matched ? '✓' : '✗' }`)
            console.log(`    Keywords: ${ assessment.keywords.precision } | Hits: ${ assessment.keywords.hits.join(', ')||'(none)' }`)
            console.log(`    Mood: "${ assessment.mood.actual }" — ${ assessment.mood.matched ? '✓' : '✗' }`)
            console.log(`    PhaseOfLife: "${ assessment.phaseOfLife.actual }" — ${ assessment.phaseOfLife.matched ? '✓' : '✗' }`)
            console.log(`\n    ── Summary Thoroughness (${ assessment.summary.length } chars) ──`)
            console.log(`    Salient: ${ assessment.summary.salientCoverage } (${ (assessment.summary.salientMovement*100).toFixed(0) }%)`)
            assessment.summary.salientResults.forEach(r=>console.log(`      ${ r.present ? '✓' : '✗' } ${ r.key }`))
            console.log(`    ──────────────────────────────────────────`)
            context.verifiedEntry = found
            return {
                passed,
                learned: {
                    entryId: found.id,
                    metadata: { title: assessment.title, keywords: assessment.keywords, mood: assessment.mood, phaseOfLife: assessment.phaseOfLife, },
                    summary: { length: assessment.summary.length, adequate: assessment.summary.adequate, salientCoverage: assessment.summary.salientCoverage, salientResults: assessment.summary.salientResults, },
                    predicted: { title: mPredicted.title.description, keywords: mPredicted.keywords.expected, mood: mPredicted.mood.acceptable, },
                },
                notes: `Found. Title: ${ assessment.title.matched?'✓':'✗' } | Keywords: ${ assessment.keywords.precision } | Mood: ${ assessment.mood.matched?'✓':'✗' } | Summary: ${ assessment.summary.salientCoverage }`,
            }
        }
    ))
    return movementReport(movement.name, sections)
}
