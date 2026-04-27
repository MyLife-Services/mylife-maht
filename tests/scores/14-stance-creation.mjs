/**
 * Score 14 — Stance Creation
 *
 * Purpose: Submit a fictional political stance to the active political-stance bot,
 * negotiate the save, and verify the entry in collections with metadata assessment.
 * Parallel structure to Scores 03, 06, 10 (memory/journal/diary entry creation).
 *
 * Depends on: Score 13 (context.politicalStanceBotId, context.politicalActiveBotId)
 */
import { context, logTurn, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Stance Creation',
    number: '14',
}
const SCORE_ID = '14'
const COLLECTION_TYPE = 'stance'
/**
 * Fictional political stance on housing policy.
 * Deliberately specific — concrete positions with internal nuance.
 */
const mFictionalStance = `My view on housing policy has sharpened over the last few years. I believe affordable housing is not a luxury or a market outcome we should passively wait for — it is a precondition for economic participation. When people spend more than half their income on rent, they cannot save, cannot relocate for work, cannot invest in their communities. The single-family zoning laws that blanket most American cities were designed for a different era and a different economy, and they are actively making things worse. I support reforming zoning to allow mixed-use and multi-unit development by right, not by exception. I also think the federal government has a role through direct investment in public housing stock — not as a stigmatized last resort, but as a permanent part of the housing ecosystem the way it functions in Vienna and Singapore. I am skeptical of rent control as a long-term tool because the evidence on supply effects is not encouraging, but I think targeted, time-limited protections for existing tenants during a transition period are reasonable. The bottom line: housing markets do not self-correct at the pace people need, and pretending they do is itself a political choice.`
const mPredicted = {
    title: {
        patterns: [/housing/i, /zoning/i, /afford/i, /rent/i, /policy/i, /home/i, /reform/i],
        description: 'Should reference housing, zoning, affordability, or reform',
    },
    keywords: {
        expected: ['housing', 'zoning', 'rent control', 'affordable', 'supply', 'federal', 'investment', 'tenant', 'reform'],
        description: '9 expected keywords across housing policy themes',
    },
    mood: {
        acceptable: ['pragmatic', 'assertive', 'concerned', 'analytical', 'measured', 'progressive', 'policy-driven', 'resolute'],
        description: 'Should be pragmatic/analytical — policy stance, not purely emotional',
    },
    phaseOfLife: {
        acceptable: ['adulthood', 'adult', 'working life', 'present', 'adult life', 'professional life'],
        description: 'Present-day adult political view',
    },
    summary: {
        salientPoints: [
            { key: 'Housing as economic precondition', test: t=>/economic|participat|income|half.*rent|rent.*half/i.test(t), },
            { key: 'Single-family zoning critique', test: t=>/zoning|single.family/i.test(t), },
            { key: 'Mixed-use / multi-unit by right', test: t=>/mixed.use|multi.unit|by right/i.test(t), },
            { key: 'Federal public housing investment', test: t=>/federal|public housing/i.test(t), },
            { key: 'Vienna / Singapore comparison', test: t=>/vienna|singapore/i.test(t), },
            { key: 'Rent control skepticism + supply', test: t=>/rent control|supply effect|skeptic/i.test(t), },
            { key: 'Tenant transition protections', test: t=>/tenant|transition|protection|time.limit/i.test(t), },
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
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    if(!context.politicalStanceBotId){
        console.log('  ✗ Cannot run — no politicalStanceBotId in context. Run Score 13 first.')
        return { passed: false, tally: '0/2' }
    }
    /* ── movement 1 — submit fictional stance, negotiate save ── */
    console.log(`\n    ── Submitting fictional housing stance (${ mFictionalStance.length } chars) ──`)
    logTurn(SCORE_ID, 'synthetic', mFictionalStance, { movement: 1, note: 'fictional housing policy stance' })
    let createdStanceId = null
    let exchangeCount = 0
    const maxExchanges = 4
    let currentResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mFictionalStance, }),
    })
    exchangeCount++
    while(true){
        const { instructions=[], responses=[], } = currentResponse ?? {}
        const responseText = responses.map(r=>stripHtml(r.message)).join('\n')
        logTurn(SCORE_ID, 'stance', responseText, { movement: 1, exchange: exchangeCount, instructions })
        const createInstr = extractInstruction(instructions, 'createItem')
        if(createInstr?.itemId){
            createdStanceId = createInstr.itemId
            console.log(`    ✓ Stance saved on exchange ${ exchangeCount } — itemId: ${ createdStanceId }`)
            break
        }
        const isConfirmation = /confirm|save|shall i|should i|would you like/i.test(responseText)
        const isQuestion = responseText.includes('?')
        console.log(`    Exchange ${ exchangeCount }: ${ responseText.length } chars — question: ${ isQuestion }, confirmation: ${ isConfirmation }`)
        if(exchangeCount >= maxExchanges){
            console.log(`    ⚠ Exchange limit — asking stance bot to save directly`)
            const saveReq = `Please save this stance.`
            logTurn(SCORE_ID, 'synthetic', saveReq, { movement: 1, exchange: ++exchangeCount, note: 'explicit save' })
            currentResponse = await request('/members/', { method: 'POST', body: JSON.stringify({ message: saveReq, }), })
            const { instructions: fi=[], responses: fr=[], } = currentResponse ?? {}
            logTurn(SCORE_ID, 'stance', fr.map(r=>stripHtml(r.message)).join('\n'), { movement: 1, exchange: exchangeCount, instructions: fi })
            const fc = extractInstruction(fi, 'createItem')
            if(fc?.itemId){ createdStanceId = fc.itemId; console.log(`    ✓ Saved after explicit request — itemId: ${ createdStanceId }`) }
            else console.log(`    ✗ Not saved after explicit request`)
            break
        }
        const followUp = isConfirmation ? `Yes, please save it.`
            : isQuestion ? `Yes, that sounds right. Please save this stance.`
            : `Please save this stance when you're ready.`
        logTurn(SCORE_ID, 'synthetic', followUp, { movement: 1, exchange: ++exchangeCount })
        currentResponse = await request('/members/', { method: 'POST', body: JSON.stringify({ message: followUp, }), })
    }
    movements.push(movement(
        `Write stance (${ exchangeCount } exchange${ exchangeCount !== 1 ? 's' : '' })`,
        { createdStanceId, exchangeCount, },
        result => {
            const passed = !!result?.createdStanceId
            console.log(`\n    ── Movement 1 Summary ──`)
            console.log(`    Stance saved: ${ passed } | itemId: ${ result?.createdStanceId ?? 'none' } | Exchanges: ${ result?.exchangeCount }`)
            console.log(`    ────────────────────────`)
            if(passed) context.createdStanceId = result.createdStanceId
            return {
                passed,
                learned: { createdStanceId: result?.createdStanceId, exchangesToSave: result?.exchangeCount, },
                notes: passed ? `Stance created after ${ result?.exchangeCount } exchange(s). itemId: ${ result?.createdStanceId }` : `Stance not saved after ${ result?.exchangeCount } exchange(s)`,
            }
        }
    ))
    /* ── movement 2 — verify in collections, assess metadata ── */
    const stanceId = context.createdStanceId
    if(!stanceId){
        movements.push(movement('Verify stance in collections', null, ()=>({ passed: false, learned: {}, notes: 'Skipped — no stanceId from movement 1' })))
        return scoreReport(score.name, movements)
    }
    const collectionsResponse = await request(`/members/collections/${ COLLECTION_TYPE }`)
    movements.push(movement(
        'Verify stance in collections',
        collectionsResponse,
        result => {
            if(!Array.isArray(result)) return { passed: false, learned: {}, notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }` }
            const found = result.find(item=>item.id===stanceId)
            const passed = !!found
            console.log(`\n    ── Movement 2: Collections Verification ──`)
            console.log(`    Collection size: ${ result.length } | Found: ${ passed }`)
            if(!found) return { passed, learned: { collectionSize: result.length }, notes: `stanceId ${ stanceId } not found in ${ result.length }-item collection` }
            const assessment = assessMetadata(found)
            console.log(`\n    ── Metadata Precision ──`)
            console.log(`    Title: "${ assessment.title.actual }" — ${ assessment.title.matched ? '✓' : '✗' }`)
            console.log(`    Keywords: ${ assessment.keywords.precision } | Hits: ${ assessment.keywords.hits.join(', ')||'(none)' }`)
            console.log(`    Mood: "${ assessment.mood.actual }" — ${ assessment.mood.matched ? '✓' : '✗' }`)
            console.log(`    PhaseOfLife: "${ assessment.phaseOfLife.actual }" — ${ assessment.phaseOfLife.matched ? '✓' : '✗' }`)
            console.log(`\n    ── Summary Thoroughness (${ assessment.summary.length } chars) ──`)
            console.log(`    Salient: ${ assessment.summary.salientCoverage } (${ (assessment.summary.salientScore*100).toFixed(0) }%)`)
            assessment.summary.salientResults.forEach(r=>console.log(`      ${ r.present ? '✓' : '✗' } ${ r.key }`))
            console.log(`    ──────────────────────────────────────────`)
            context.verifiedStance = found
            return {
                passed,
                learned: {
                    stanceId: found.id,
                    metadata: { title: assessment.title, keywords: assessment.keywords, mood: assessment.mood, phaseOfLife: assessment.phaseOfLife, },
                    summary: { length: assessment.summary.length, adequate: assessment.summary.adequate, salientCoverage: assessment.summary.salientCoverage, salientResults: assessment.summary.salientResults, },
                    predicted: { keywords: mPredicted.keywords.expected, mood: mPredicted.mood.acceptable, },
                },
                notes: `Found. Title: ${ assessment.title.matched?'✓':'✗' } | Keywords: ${ assessment.keywords.precision } | Mood: ${ assessment.mood.matched?'✓':'✗' } | Summary: ${ assessment.summary.salientCoverage }`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
