/**
 * Score 18 — Action Creation
 *
 * Purpose: Submit a fictional civic action plan to the active activism bot,
 * negotiate the save, and verify the entry in collections with metadata assessment.
 * Parallel structure to Scores 03, 06, 10, 14.
 *
 * Content type: 'action' (being: 'action', type: 'action')
 * Collection: GET /members/collections/action
 * Frontend instruction: createItem (same as all content types)
 *
 * Depends on: Score 17 (context.activismBotId, context.activismActiveBotId)
 */
import { context, logTurn, request, } from '../lib/session.mjs'
import { section, movementReport, } from '../lib/report.mjs'
export const movement = {
    name: 'Action Creation',
    number: '18',
    suite: 'activism',
}
const SCORE_ID = '18'
const COLLECTION_TYPE = 'action'
/**
 * Fictional civic action plan — housing affordability focus, grounded and specific.
 * Deliberately practical: concrete steps, realistic constraints, defined timeline.
 */
const mFictionalAction = `I have been thinking about what I can actually do about housing affordability in my area, and I have settled on a starting plan. First, I am going to attend the next three city council meetings where zoning changes are on the agenda — I want to understand how decisions get made before I try to influence them. Second, I am going to sign up for the public comment period at the next planning commission meeting and prepare a two-minute statement focused on the need for by-right multi-unit development in transit corridors. Third, I want to connect with the local housing advocacy group I have heard about through a neighbor — they apparently run a phone banking operation during key votes. I am not ready to knock on doors yet, but phone banking feels manageable. My goal by the end of three months is to have spoken publicly at least once and to understand who the key decision-makers are at the local level.`
const mPredicted = {
    title: {
        patterns: [/housing/i, /zoning/i, /council/i, /action/i, /plan/i, /civic/i, /local/i, /afford/i],
        description: 'Should reference housing, civic action, local government, or planning',
    },
    keywords: {
        expected: ['housing', 'zoning', 'city council', 'planning commission', 'public comment', 'phone banking', 'advocacy', 'affordability'],
        description: '8 expected keywords across housing, civic engagement, and local government themes',
    },
    mood: {
        acceptable: ['pragmatic', 'motivated', 'cautious', 'committed', 'civic-minded', 'determined', 'realistic', 'hopeful'],
        description: 'Should be grounded and action-oriented — not idealistic, not passive',
    },
    phaseOfLife: {
        acceptable: ['adulthood', 'adult', 'working life', 'present', 'adult life'],
        description: 'Present-day adult civic actor',
    },
    summary: {
        salientPoints: [
            { key: 'Attend city council / zoning meetings', test: t=>/council|zoning|attend|meeting/i.test(t), },
            { key: 'Public comment / planning commission', test: t=>/public comment|planning commission|statement|testif/i.test(t), },
            { key: 'By-right multi-unit / transit corridors', test: t=>/by.right|multi.unit|transit/i.test(t), },
            { key: 'Phone banking / advocacy group', test: t=>/phone bank|advocacy|neighbor/i.test(t), },
            { key: 'Not ready for door-knocking (realistic constraint)', test: t=>/door|knock|not ready|manageabl/i.test(t), },
            { key: 'Three-month goal / decision-makers', test: t=>/three month|3 month|decision.maker|goal/i.test(t), },
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
    /* Action items don't store mood/phaseOfLife — they use conviction/issues/steps instead */
    const moodMatch = mood ? mPredicted.mood.acceptable.some(m=>mood.toLowerCase().includes(m)) : null
    const phaseMatch = phaseOfLife ? mPredicted.phaseOfLife.acceptable.some(p=>phaseOfLife.toLowerCase().includes(p)) : null
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
    if(!context.activismBotId){
        console.log('  ✗ Cannot run — no activismBotId in context. Run Movement 17 first.')
        return { passed: false, tally: '0/2' }
    }
    /* ── movement 1 — submit fictional action plan, negotiate save ── */
    console.log(`\n    ── Submitting fictional civic action plan (${ mFictionalAction.length } chars) ──`)
    logTurn(SCORE_ID, 'synthetic', mFictionalAction, { movement: 1, note: 'fictional housing affordability action plan' })
    let createdActionId = null
    let exchangeCount = 0
    const maxExchanges = 4
    let currentResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mFictionalAction, }),
    })
    exchangeCount++
    while(true){
        const { instructions=[], responses=[], } = currentResponse ?? {}
        const responseText = responses.map(r=>stripHtml(r.message)).join('\n')
        logTurn(SCORE_ID, 'activism', responseText, { movement: 1, exchange: exchangeCount, instructions })
        const createInstr = extractInstruction(instructions, 'createItem')
        if(createInstr?.itemId){
            createdActionId = createInstr.itemId
            console.log(`    ✓ Action saved on exchange ${ exchangeCount } — itemId: ${ createdActionId }`)
            break
        }
        const isConfirmation = /confirm|save|shall i|should i|would you like/i.test(responseText)
        const isQuestion = responseText.includes('?')
        console.log(`    Exchange ${ exchangeCount }: ${ responseText.length } chars — question: ${ isQuestion }, confirmation: ${ isConfirmation }`)
        if(exchangeCount >= maxExchanges){
            console.log(`    ⚠ Exchange limit — asking activism bot to save directly`)
            const saveReq = `Please save this action plan.`
            logTurn(SCORE_ID, 'synthetic', saveReq, { movement: 1, exchange: ++exchangeCount, note: 'explicit save' })
            currentResponse = await request('/members/', { method: 'POST', body: JSON.stringify({ message: saveReq, }), })
            const { instructions: fi=[], responses: fr=[], } = currentResponse ?? {}
            logTurn(SCORE_ID, 'activism', fr.map(r=>stripHtml(r.message)).join('\n'), { movement: 1, exchange: exchangeCount, instructions: fi })
            const fc = extractInstruction(fi, 'createItem')
            if(fc?.itemId){ createdActionId = fc.itemId; console.log(`    ✓ Saved after explicit request — itemId: ${ createdActionId }`) }
            else console.log(`    ✗ Not saved after explicit request`)
            break
        }
        const followUp = isConfirmation ? `Yes, please save it.`
            : isQuestion ? `Yes, that sounds right. Please save this action plan.`
            : `Please save this action plan when you're ready.`
        logTurn(SCORE_ID, 'synthetic', followUp, { movement: 1, exchange: ++exchangeCount })
        currentResponse = await request('/members/', { method: 'POST', body: JSON.stringify({ message: followUp, }), })
    }
    sections.push(section(
        `Write action plan (${ exchangeCount } exchange${ exchangeCount !== 1 ? 's' : '' })`,
        { createdActionId, exchangeCount, },
        result => {
            const passed = !!result?.createdActionId
            console.log(`\n    ── Movement 1 Summary ──`)
            console.log(`    Action saved: ${ passed } | itemId: ${ result?.createdActionId ?? 'none' } | Exchanges: ${ result?.exchangeCount }`)
            console.log(`    ────────────────────────`)
            if(passed) context.createdActionId = result.createdActionId
            return {
                passed,
                learned: { createdActionId: result?.createdActionId, exchangesToSave: result?.exchangeCount, },
                notes: passed ? `Action created after ${ result?.exchangeCount } exchange(s). itemId: ${ result?.createdActionId }` : `Action not saved after ${ result?.exchangeCount } exchange(s)`,
            }
        }
    ))
    /* ── movement 2 — verify in collections, assess metadata ── */
    const actionId = context.createdActionId
    if(!actionId){
        sections.push(section('Verify action in collections', null, ()=>({ passed: false, learned: {}, notes: 'Skipped — no actionId from movement 1' })))
        return movementReport(movement.name, sections)
    }
    const collectionsResponse = await request(`/members/collections/${ COLLECTION_TYPE }`)
    sections.push(section(
        'Verify action in collections',
        collectionsResponse,
        result => {
            if(!Array.isArray(result)) return { passed: false, learned: {}, notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }` }
            const found = result.find(item=>item.id===actionId)
            const passed = !!found
            console.log(`\n    ── Movement 2: Collections Verification ──`)
            console.log(`    Collection size: ${ result.length } | Found: ${ passed }`)
            if(!found) return { passed, learned: { collectionSize: result.length }, notes: `actionId ${ actionId } not found in ${ result.length }-item collection` }
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
            context.verifiedAction = found
            return {
                passed,
                learned: {
                    actionId: found.id,
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
