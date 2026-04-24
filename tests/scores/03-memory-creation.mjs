/**
 * Score 03 — Memory Creation
 *
 * Purpose: Engage the biographer in natural language, capture a memory,
 * then verify it exists via both API retrieval and NL chat recall.
 * This is the first score involving LLM responses — assertions shift from
 * shape/value to cognitive evaluation: is the response useful, coherent,
 * and appropriate for a human operator?
 *
 * Depends on: Score 01 (context.bots), Score 02 (context.activeBotId)
 *
 * A synthetic passing this score understands:
 *   - How to initiate conversation with the active bot via POST /members/
 *   - What a well-formed chat response envelope looks like
 *   - Whether the biographer gives actionable, compelling onboarding guidance
 *   - How to turn one of those suggestions into a full fictional memory narrative
 *   - How to negotiate multi-turn confirmation flows (and survive them with grace)
 *   - How to verify a created memory via API (collections → item)
 *   - Whether the LLM saved complete, accurate metadata and a thorough summary
 */
import { context, logTurn, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Memory Creation',
    number: '03',
}
const SCORE_ID = '03'
const mOpenings = [
    `I'm not sure where to begin — what would you suggest?`,
    `I've never done anything like this before. How do we start?`,
    `So I'm here and ready, but honestly have no idea what to do first. Help?`,
    `Where do people usually start when they sit down with you for the first time?`,
    `I have a lot I want to preserve but don't know how to approach it. What's the first step?`,
    `This feels a little overwhelming — can you walk me through how this works?`,
    `I want to capture some memories but I'm not sure what's worth starting with. Any thoughts?`,
    `Let's say I'm a complete beginner. What would you have me do right now?`,
]
/**
 * Fictional memory submitted by the synthetic.
 * Rich, specific, multi-threaded — designed to stress-test the biographer's
 * ability to extract, summarize, and tag a complex narrative accurately.
 */
const mFictionalMemory = `It was the summer I turned eleven, and my grandmother — everyone called her Nana Bea — had come to stay with us for six weeks while my parents renovated the upstairs bathroom. She was a small woman, barely five feet, with enormous hands from forty years of gardening. Every morning she was up before anyone else, and by the time I stumbled downstairs in pajamas she had already set out a plate of buttered toast cut into triangles and a mug of tea she called "builder's strength." I didn't like tea then, but I pretended to, because she made it with such ceremony — warming the pot first, counting thirty seconds before pouring, setting the timer for exactly four minutes. She told me her own grandmother had taught her that ritual, and that making tea properly was a form of respect for the people you were serving. That summer she taught me to identify every tree in the backyard by leaf shape alone, how to dead-head roses without getting scratched, and why you should never plant tomatoes next to fennel. But the thing I remember most is the evening we sat on the back steps watching fireflies while she told me about the village in rural Portugal where she grew up, how she had crossed the Atlantic alone at seventeen with one suitcase and forty dollars sewn into the hem of her coat, how she had been so frightened she recited the names of every person she loved like a rosary the whole way across. She said she still did that sometimes when she was scared. I asked her if she was scared of anything now. She thought about it for a long time and then said, very quietly, "of being forgotten." I didn't know what to say. I was eleven. But I never forgot. And I think that is why I am here.`
/**
 * Predicted metadata — what a skilled biographer SHOULD generate for this narrative.
 * Used in movement 3 to score metadata precision and summary thoroughness.
 */
const mPredicted = {
    title: {
        patterns: [
            /nana\s*bea/i,
            /grandmother/i,
            /summer.*eleven/i,
            /eleven.*summer/i,
            /tea/i,
            /forgotten/i,
            /firefl/i,
            /portugal/i,
            /gardening/i,
        ],
        description: 'Should reference Nana Bea, the summer, tea, fireflies, Portugal, or "forgotten"',
    },
    keywords: {
        expected: [
            'grandmother', 'tea', 'garden', 'gardening', 'portugal', 'immigration',
            'fireflies', 'summer', 'childhood', 'legacy', 'family', 'memory', 'ritual',
        ],
        description: '13 expected keywords across family, ritual, immigration, nature, memory themes',
    },
    mood: {
        acceptable: [
            'nostalgic', 'bittersweet', 'reflective', 'wistful', 'warm',
            'tender', 'poignant', 'melancholy', 'sentimental',
        ],
        description: 'Should be nostalgic/reflective/bittersweet — not simply happy, sad, or neutral',
    },
    phaseOfLife: {
        acceptable: [
            'childhood', 'youth', 'early life', 'early childhood',
            'adolescence', 'formative years', 'youth',
        ],
        description: 'Narrator is 11 — childhood or early life expected',
    },
    summary: {
        /* salient points the summary should cover */
        salientPoints: [
            { key: 'Nana Bea / grandmother figure', test: t => /nana|grandmother|grandma|beatriz/i.test(t), },
            { key: 'Tea ritual / ceremony detail', test: t => /tea/i.test(t), },
            { key: 'Gardening lessons (trees / roses / tomatoes)', test: t => /garden|tree|rose|tomato|fennel/i.test(t), },
            { key: 'Portugal origin / village', test: t => /portugal|village/i.test(t), },
            { key: 'Atlantic crossing / immigration', test: t => /atlantic|suitcase|immigr|cross/i.test(t), },
            { key: 'Fireflies / evening on back steps', test: t => /firefl|back step|evening/i.test(t), },
            { key: '"Fear of being forgotten"', test: t => /forgotten|forgot/i.test(t), },
            { key: 'Narrator age 11 / childhood POV', test: t => /eleven|11|child/i.test(t), },
            { key: 'Coat / forty dollars sewn in hem', test: t => /coat|hem|forty dollar|40 dollar/i.test(t), },
            { key: 'Rosary recitation of loved ones\' names', test: t => /rosary|names.*loved|recit/i.test(t), },
        ],
        minLengthChars: 120,
        description: '10 salient checkpoints; summary should be ≥120 chars and cover the emotional core',
    },
}
function stripHtml(str){ return str.replace(/<[^>]+>/g, '').trim() }
function countSuggestions(text){
    const numbered = (text.match(/\d+\./g) ?? []).length
    const bulleted = (text.match(/[-•*]\s/g) ?? []).length
    return Math.max(numbered, bulleted, text.split(/\n/).filter(l=>l.trim().length>20).length > 3 ? 2 : 1)
}
function extractCreatedItemId(instructions=[]){
    const createInstr = instructions.find(i=>i?.command==='createItem')
    return createInstr?.itemId ?? null
}
function assessMetadata(item){
    const { title='', keywords=[], mood='', phaseOfLife='', summary='', } = item
    const summaryLower = summary.toLowerCase()
    /* title */
    const titleMatch = mPredicted.title.patterns.some(p=>p.test(title))
    /* keywords */
    const itemKeywordsLower = keywords.map(k=>k.toLowerCase())
    const keywordHits = mPredicted.keywords.expected.filter(k=>
        itemKeywordsLower.some(ik=>ik.includes(k) || k.includes(ik))
    )
    const keywordMisses = mPredicted.keywords.expected.filter(k=>!keywordHits.includes(k))
    const keywordPrecision = keywordHits.length / mPredicted.keywords.expected.length
    /* mood */
    const moodMatch = mPredicted.mood.acceptable.some(m=>mood.toLowerCase().includes(m))
    /* phaseOfLife */
    const phaseMatch = mPredicted.phaseOfLife.acceptable.some(p=>
        (phaseOfLife ?? '').toLowerCase().includes(p)
    )
    /* summary salient coverage */
    const salientResults = mPredicted.summary.salientPoints.map(p=>({
        key: p.key,
        present: p.test(summaryLower),
    }))
    const salientHits = salientResults.filter(r=>r.present).length
    const salientTotal = salientResults.length
    const summaryLength = summary.length
    const summaryAdequate = summaryLength >= mPredicted.summary.minLengthChars
    return {
        title: { actual: title, matched: titleMatch, },
        keywords: {
            actual: keywords,
            hits: keywordHits,
            misses: keywordMisses,
            precision: `${ keywordHits.length }/${ mPredicted.keywords.expected.length }`,
            score: keywordPrecision,
        },
        mood: { actual: mood, matched: moodMatch, acceptable: mPredicted.mood.acceptable, },
        phaseOfLife: { actual: phaseOfLife, matched: phaseMatch, acceptable: mPredicted.phaseOfLife.acceptable, },
        summary: {
            length: summaryLength,
            adequate: summaryAdequate,
            salientCoverage: `${ salientHits }/${ salientTotal }`,
            salientScore: salientHits / salientTotal,
            salientResults,
        },
    }
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    if(!context.activeBotId){
        console.log('  ✗ Cannot run — no active bot in context. Run Scores 01 and 02 first.')
        return { passed: false, tally: '0/3' }
    }
    /* ── movement 1 — ask how to get started ── */
    const opening = mOpenings[Math.floor(Math.random() * mOpenings.length)]
    context.openingMessage = opening
    const chatResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: opening, }),
    })
    const { instructions: m1Instructions=[], responses: m1Responses=[], success: m1Success, } = chatResponse ?? {}
    const m1Text = m1Responses.map(r=>stripHtml(r.message)).join('\n')
    logTurn(SCORE_ID, 'synthetic', opening, { exchange: 1, movement: 1 })
    logTurn(SCORE_ID, 'biographer', m1Text, { exchange: 1, movement: 1, instructions: m1Instructions })
    movements.push(movement(
        `Ask how to get started: "${ opening.substring(0, 50) }..."`,
        chatResponse,
        result => {
            const { instructions=[], responses=[], success, } = result ?? {}
            const passed = success === true && !!responses.length
            if(!passed)
                return {
                    passed,
                    learned: {},
                    notes: `Expected { success: true, responses[] }. Got: ${ JSON.stringify(result) }`,
                }
            const text = responses.map(r=>stripHtml(r.message)).join('\n')
            const suggestionCount = countSuggestions(text)
            const isCompelling = text.length > 80
            const isComprehensible = !text.includes('undefined') && !text.includes('[object')
            console.log(`\n    ── Cognitive Assessment ──`)
            console.log(`    Message received:\n    "${ text.substring(0, 200) }${ text.length > 200 ? '...' : '' }"`)
            console.log(`    Suggestions noted: ${ suggestionCount }`)
            console.log(`    Compelling (substantive): ${ isCompelling } (${ text.length } chars)`)
            console.log(`    Comprehensible: ${ isComprehensible }`)
            console.log(`    Instructions attached: ${ instructions.length }`)
            console.log(`    ──────────────────────────`)
            if(passed)
                context.openingResponse = text
            return {
                passed: passed && isCompelling && isComprehensible,
                learned: {
                    messageSent: opening,
                    responseLength: text.length,
                    suggestionsNoted: suggestionCount,
                    compelling: isCompelling,
                    comprehensible: isComprehensible,
                    instructionsAttached: instructions.length,
                },
                notes: passed
                    ? `Response received. Suggestions: ${ suggestionCount }, Length: ${ text.length } chars`
                    : `Chat failed or returned incomprehensible response`,
            }
        }
    ))
    if(!movements[0].passed){
        movements.push({ name: 'Submit fictional memory narrative', passed: false, learned: {}, notes: 'Skipped — movement 1 failed' })
        movements.push({ name: 'Verify memory in collections', passed: false, learned: {}, notes: 'Skipped — movement 1 failed' })
        return scoreReport(score.name, movements)
    }
    /* ── movement 2 — submit fictional memory, negotiate save ── */
    const m1Compelling = movements[0].learned?.compelling ?? false
    let exchangeCount = 0
    let createdItemId = null
    let savedViaInstruction = false
    /* if opening wasn't compelling, send a dismissive follow-up first */
    if(!m1Compelling){
        const dismissal = `Hmm, that doesn't really help me. I don't find those suggestions very interesting. Can you try a different approach?`
        console.log(`\n    ── Movement 2 prologue: non-compelling follow-up ──`)
        logTurn(SCORE_ID, 'synthetic', dismissal, { exchange: ++exchangeCount, movement: 2, note: 'dismissive follow-up' })
        const dismissResponse = await request('/members/', {
            method: 'POST',
            body: JSON.stringify({ message: dismissal, }),
        })
        const { instructions: dismissInstr=[], responses: dismissResponses=[], } = dismissResponse ?? {}
        const dismissText = dismissResponses.map(r=>stripHtml(r.message)).join('\n')
        logTurn(SCORE_ID, 'biographer', dismissText, { exchange: exchangeCount, movement: 2, instructions: dismissInstr, note: 'follow-on after dismissal' })
        console.log(`    Follow-on (${ dismissText.length } chars): "${ dismissText.substring(0, 150) }${ dismissText.length > 150 ? '...' : '' }"`)
        console.log(`    Follow-on compelling: ${ dismissText.length > 80 }, comprehensible: ${ !dismissText.includes('undefined') }`)
        context.followOnResponse = dismissText
    }
    /* submit the full fictional memory */
    console.log(`\n    ── Submitting fictional memory (${ mFictionalMemory.length } chars) ──`)
    logTurn(SCORE_ID, 'synthetic', mFictionalMemory, { exchange: ++exchangeCount, movement: 2, note: 'fictional memory narrative' })
    let currentResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mFictionalMemory, }),
    })
    const maxExchanges = 4
    while(true){
        const { instructions=[], responses=[], success, } = currentResponse ?? {}
        const responseText = responses.map(r=>stripHtml(r.message)).join('\n')
        logTurn(SCORE_ID, 'biographer', responseText, { exchange: exchangeCount, movement: 2, instructions })
        const itemId = extractCreatedItemId(instructions)
        if(itemId){
            createdItemId = itemId
            savedViaInstruction = true
            console.log(`    ✓ Memory saved on exchange ${ exchangeCount } — itemId: ${ itemId }`)
            break
        }
        const isQuestion = responseText.includes('?')
        const isConfirmation = /confirm|correct|right\?|save|shall i|should i|would you like/i.test(responseText)
        console.log(`    Exchange ${ exchangeCount }: ${ responseText.length } chars — question: ${ isQuestion }, confirmation-ask: ${ isConfirmation }`)
        console.log(`    Preview: "${ responseText.substring(0, 120) }${ responseText.length > 120 ? '...' : '' }"`)
        if(exchangeCount >= maxExchanges){
            console.log(`    ⚠ Exchange limit reached — asking biographer to save directly`)
            const saveRequest = `Please save the memory!`
            logTurn(SCORE_ID, 'synthetic', saveRequest, { exchange: ++exchangeCount, movement: 2, note: 'explicit save request after limit' })
            currentResponse = await request('/members/', {
                method: 'POST',
                body: JSON.stringify({ message: saveRequest, }),
            })
            const { instructions: finalInstr=[], responses: finalResponses=[], } = currentResponse ?? {}
            const finalText = finalResponses.map(r=>stripHtml(r.message)).join('\n')
            logTurn(SCORE_ID, 'biographer', finalText, { exchange: exchangeCount, movement: 2, instructions: finalInstr })
            const finalItemId = extractCreatedItemId(finalInstr)
            if(finalItemId){
                createdItemId = finalItemId
                savedViaInstruction = true
                console.log(`    ✓ Memory saved after explicit request — itemId: ${ finalItemId }`)
            } else {
                console.log(`    ✗ Memory not saved even after explicit request`)
            }
            break
        }
        let followUp
        if(isConfirmation){
            const irritationLevel = exchangeCount > 2 ? 'high' : exchangeCount > 1 ? 'medium' : 'low'
            console.log(`    Confirmation ask detected (irritation level: ${ irritationLevel }) — confirming`)
            followUp = `Yes, please save it.`
        } else if(isQuestion){
            console.log(`    Follow-on question detected — playing along fictionally`)
            followUp = `Yes, her name was Beatriz — we called her Nana Bea. She passed away when I was nineteen. Please go ahead and save this memory.`
        } else {
            followUp = `That sounds wonderful. Can you save this memory for me?`
        }
        logTurn(SCORE_ID, 'synthetic', followUp, { exchange: ++exchangeCount, movement: 2 })
        currentResponse = await request('/members/', {
            method: 'POST',
            body: JSON.stringify({ message: followUp, }),
        })
    }
    movements.push(movement(
        `Submit fictional memory narrative (${ exchangeCount } exchange${ exchangeCount !== 1 ? 's' : '' })`,
        { createdItemId, exchangeCount, savedViaInstruction, },
        result => {
            const { createdItemId, exchangeCount, savedViaInstruction, } = result ?? {}
            const passed = !!createdItemId && savedViaInstruction
            console.log(`\n    ── Movement 2 Summary ──`)
            console.log(`    Memory saved: ${ passed } | itemId: ${ createdItemId ?? 'none' }`)
            console.log(`    Exchanges to save: ${ exchangeCount }`)
            console.log(`    ─────────────────────`)
            if(passed)
                context.createdItemId = createdItemId
            return {
                passed,
                learned: {
                    createdItemId,
                    exchangesToSave: exchangeCount,
                    savedViaInstruction,
                    openingWasCompelling: m1Compelling,
                },
                notes: passed
                    ? `Memory created after ${ exchangeCount } exchange(s). itemId: ${ createdItemId }`
                    : `Memory not saved — no createItem instruction received after ${ exchangeCount } exchange(s)`,
            }
        }
    ))
    /* ── movement 3 — verify via collections API, assess metadata and summary ── */
    const itemIdToVerify = context.createdItemId
    if(!itemIdToVerify){
        movements.push(movement(
            'Verify memory in collections',
            null,
            () => ({ passed: false, learned: {}, notes: 'Skipped — no itemId from movement 2' })
        ))
        return scoreReport(score.name, movements)
    }
    const collectionsResponse = await request('/members/collections/memory')
    movements.push(movement(
        'Verify memory in collections',
        collectionsResponse,
        result => {
            if(!Array.isArray(result))
                return {
                    passed: false,
                    learned: {},
                    notes: `Expected array from collections. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
                }
            const found = result.find(item=>item.id===itemIdToVerify)
            const passed = !!found
            console.log(`\n    ── Movement 3: Collections Verification ──`)
            console.log(`    Collection size: ${ result.length } memories`)
            console.log(`    Item found: ${ passed }`)
            if(!found)
                return {
                    passed,
                    learned: { collectionSize: result.length, },
                    notes: `itemId ${ itemIdToVerify } not found in ${ result.length }-item memory collection`,
                }
            const assessment = assessMetadata(found)
            /* print predicted vs actual comparison */
            console.log(`\n    ── Metadata Precision Assessment ──`)
            console.log(`    Predicted title patterns: ${ mPredicted.title.description }`)
            console.log(`    Actual title:    "${ assessment.title.actual }" — ${ assessment.title.matched ? '✓ matched' : '✗ no predicted pattern matched' }`)
            console.log(`\n    Predicted keywords: ${ mPredicted.keywords.expected.join(', ') }`)
            console.log(`    Actual keywords: ${ assessment.keywords.actual.join(', ') || '(none)' }`)
            console.log(`    Keyword precision: ${ assessment.keywords.precision } (${ (assessment.keywords.score * 100).toFixed(0) }%)`)
            console.log(`    Hits:   ${ assessment.keywords.hits.join(', ') || '(none)' }`)
            console.log(`    Misses: ${ assessment.keywords.misses.join(', ') || '(none)' }`)
            console.log(`\n    Predicted mood: ${ mPredicted.mood.acceptable.join(' | ') }`)
            console.log(`    Actual mood:    "${ assessment.mood.actual }" — ${ assessment.mood.matched ? '✓ matched' : '✗ unexpected mood' }`)
            console.log(`\n    Predicted phaseOfLife: ${ mPredicted.phaseOfLife.acceptable.join(' | ') }`)
            console.log(`    Actual phaseOfLife:    "${ assessment.phaseOfLife.actual }" — ${ assessment.phaseOfLife.matched ? '✓ matched' : '✗ unexpected phase' }`)
            console.log(`\n    ── Summary Thoroughness (${ assessment.summary.length } chars, min ${ mPredicted.summary.minLengthChars }) ──`)
            console.log(`    Adequate length: ${ assessment.summary.adequate }`)
            console.log(`    Salient coverage: ${ assessment.summary.salientCoverage } (${ (assessment.summary.salientScore * 100).toFixed(0) }%)`)
            assessment.summary.salientResults.forEach(r=>{
                console.log(`      ${ r.present ? '✓' : '✗' } ${ r.key }`)
            })
            if(!assessment.summary.adequate)
                console.log(`    ⚠ Summary too short — likely truncated or incomplete`)
            if(assessment.summary.salientScore < 0.5)
                console.log(`    ⚠ Summary covers <50% of salient points — significant content loss`)
            console.log(`    ─────────────────────────────────────`)
            context.verifiedItem = found
            context.metadataAssessment = assessment
            return {
                passed,
                learned: {
                    itemId: found.id,
                    metadata: {
                        title: assessment.title,
                        keywords: assessment.keywords,
                        mood: assessment.mood,
                        phaseOfLife: assessment.phaseOfLife,
                    },
                    summary: {
                        length: assessment.summary.length,
                        adequate: assessment.summary.adequate,
                        salientCoverage: assessment.summary.salientCoverage,
                        salientScore: assessment.summary.salientScore,
                        salientResults: assessment.summary.salientResults,
                    },
                    predicted: {
                        title: mPredicted.title.description,
                        keywords: mPredicted.keywords.expected,
                        mood: mPredicted.mood.acceptable,
                        phaseOfLife: mPredicted.phaseOfLife.acceptable,
                        summary: mPredicted.summary.description,
                    },
                },
                notes: `Found in collection. Title: ${ assessment.title.matched ? '✓' : '✗' } | Keywords: ${ assessment.keywords.precision } | Mood: ${ assessment.mood.matched ? '✓' : '✗' } | Summary: ${ assessment.summary.salientCoverage } salient points, ${ assessment.summary.length } chars`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
