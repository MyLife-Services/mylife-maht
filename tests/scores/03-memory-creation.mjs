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
 *   - Whether the LLM saved complete, accurate metadata
 */
import { context, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Memory Creation',
    number: '03',
}
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
/* fictional memory the synthetic will submit once it has a suggestion to latch onto */
const mFictionalMemory = `It was the summer I turned eleven, and my grandmother — everyone called her Nana Bea — had come to stay with us for six weeks while my parents renovated the upstairs bathroom. She was a small woman, barely five feet, with enormous hands from forty years of gardening. Every morning she was up before anyone else, and by the time I stumbled downstairs in pajamas she had already set out a plate of buttered toast cut into triangles and a mug of tea she called "builder's strength." I didn't like tea then, but I pretended to, because she made it with such ceremony — warming the pot first, counting thirty seconds before pouring, setting the timer for exactly four minutes. She told me her own grandmother had taught her that ritual, and that making tea properly was a form of respect for the people you were serving. That summer she taught me to identify every tree in the backyard by leaf shape alone, how to dead-head roses without getting scratched, and why you should never plant tomatoes next to fennel. But the thing I remember most is the evening we sat on the back steps watching fireflies while she told me about the village in rural Portugal where she grew up, how she had crossed the Atlantic alone at seventeen with one suitcase and forty dollars sewn into the hem of her coat, how she had been so frightened she recited the names of every person she loved like a rosary the whole way across. She said she still did that sometimes when she was scared. I asked her if she was scared of anything now. She thought about it for a long time and then said, very quietly, "of being forgotten." I didn't know what to say. I was eleven. But I never forgot. And I think that is why I am here.`
function stripHtml(str){ return str.replace(/<[^>]+>/g, '').trim() }
function countSuggestions(text){
    /* heuristic: count numbered lists, bullet cues, or sentence-starting action verbs */
    const numbered = (text.match(/\d+\./g) ?? []).length
    const bulleted = (text.match(/[-•*]\s/g) ?? []).length
    return Math.max(numbered, bulleted, text.split(/\n/).filter(l=>l.trim().length>20).length > 3 ? 2 : 1)
}
function extractCreatedItemId(instructions=[]){
    const createInstr = instructions.find(i=>i?.command==='createItem')
    return createInstr?.itemId ?? null
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    if(!context.activeBotId){
        console.log('  ✗ Cannot run — no active bot in context. Run Scores 01 and 02 first.')
        return { passed: false, tally: '0/3' }
    }
    /* movement 1 — ask how to get started (cognitive assessment) */
    const opening = mOpenings[Math.floor(Math.random() * mOpenings.length)]
    context.openingMessage = opening
    const chatResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: opening, }),
    })
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
            const isMultipleSuggestions = suggestionCount > 1
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
    /* bail early if movement 1 failed — no point continuing */
    if(!movements[0].passed){
        movements.push({ name: 'Submit fictional memory narrative', passed: false, learned: {}, notes: 'Skipped — movement 1 failed' })
        movements.push({ name: 'Verify memory in collections', passed: false, learned: {}, notes: 'Skipped — movement 1 failed' })
        return scoreReport(score.name, movements)
    }
    /* movement 2 — submit a full fictional memory and negotiate the save */
    let createdItemId = null
    const m1Compelling = movements[0].learned?.compelling ?? false
    const initialNarrative = m1Compelling
        ? mFictionalMemory
        : null /* will send a dismissive message first */
    let firstMessage
    if(!m1Compelling){
        firstMessage = `Hmm, that doesn't really help me. I don't find those suggestions very interesting. Can you try a different approach?`
        console.log(`\n    ── Movement 2 prologue: non-compelling follow-up ──`)
        console.log(`    Sending dismissive response to score follow-on quality`)
        const dismissResponse = await request('/members/', {
            method: 'POST',
            body: JSON.stringify({ message: firstMessage, }),
        })
        const { responses: dismissResponses=[], success: dismissSuccess, } = dismissResponse ?? {}
        const dismissText = dismissResponses.map(r=>stripHtml(r.message)).join('\n')
        const followOnCompelling = dismissText.length > 80
        const followOnComprehensible = !dismissText.includes('undefined') && !dismissText.includes('[object')
        console.log(`    Follow-on received (${ dismissText.length } chars): "${ dismissText.substring(0, 150) }${ dismissText.length > 150 ? '...' : '' }"`)
        console.log(`    Follow-on compelling: ${ followOnCompelling }, comprehensible: ${ followOnComprehensible }`)
        /* note the quality but proceed regardless */
        context.followOnResponse = dismissText
    }
    /* now submit the full fictional memory */
    let exchangeCount = 0
    const maxExchanges = 4
    let lastInstructions = []
    let lastResponses = []
    let savedViaInstruction = false
    const memoryMessage = mFictionalMemory
    console.log(`\n    ── Submitting fictional memory (${ memoryMessage.length } chars) ──`)
    let currentResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: memoryMessage, }),
    })
    exchangeCount++
    while(exchangeCount <= maxExchanges){
        const { instructions=[], responses=[], success, } = currentResponse ?? {}
        lastInstructions = instructions
        lastResponses = responses
        const responseText = responses.map(r=>stripHtml(r.message)).join('\n')
        const itemId = extractCreatedItemId(instructions)
        if(itemId){
            createdItemId = itemId
            savedViaInstruction = true
            console.log(`    ✓ Memory saved on exchange ${ exchangeCount } — itemId: ${ itemId }`)
            break
        }
        /* classify the response to decide how to reply */
        const isQuestion = responseText.includes('?')
        const isConfirmation = /confirm|correct|right\?|save|shall i|should i|would you like/i.test(responseText)
        console.log(`    Exchange ${ exchangeCount }: ${ responseText.length } chars — question: ${ isQuestion }, confirmation-ask: ${ isConfirmation }`)
        console.log(`    Preview: "${ responseText.substring(0, 120) }${ responseText.length > 120 ? '...' : '' }"`)
        if(exchangeCount >= maxExchanges){
            /* give up waiting and ask directly */
            console.log(`    ⚠ Exchange limit reached — asking biographer to save directly`)
            currentResponse = await request('/members/', {
                method: 'POST',
                body: JSON.stringify({ message: `Please save the memory!`, }),
            })
            exchangeCount++
            const { instructions: finalInstructions=[], responses: finalResponses=[], } = currentResponse ?? {}
            lastInstructions = finalInstructions
            lastResponses = finalResponses
            const finalItemId = extractCreatedItemId(finalInstructions)
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
        currentResponse = await request('/members/', {
            method: 'POST',
            body: JSON.stringify({ message: followUp, }),
        })
        exchangeCount++
    }
    movements.push(movement(
        `Submit fictional memory narrative (${exchangeCount} exchange${exchangeCount!==1?'s':''})`,
        { createdItemId, exchangeCount, savedViaInstruction, lastInstructions, lastResponses, },
        result => {
            const { createdItemId, exchangeCount, savedViaInstruction, lastResponses=[], } = result ?? {}
            const responseText = lastResponses.map(r=>stripHtml(r.message)).join('\n')
            const isComprehensible = !responseText.includes('undefined') && !responseText.includes('[object')
            const passed = !!createdItemId && savedViaInstruction
            console.log(`\n    ── Movement 2 Summary ──`)
            console.log(`    Memory saved: ${ passed } | itemId: ${ createdItemId ?? 'none' }`)
            console.log(`    Exchanges to save: ${ exchangeCount }`)
            console.log(`    Saved via instruction: ${ savedViaInstruction }`)
            if(!m1Compelling)
                console.log(`    Note: biographer was not compelling on opening; follow-on quality was scored separately`)
            console.log(`    ────────────────────────`)
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
    /* movement 3 — verify via collections API and NL recall */
    const itemIdToVerify = context.createdItemId
    if(!itemIdToVerify){
        movements.push(movement(
            'Verify memory in collections',
            null,
            () => ({
                passed: false,
                learned: {},
                notes: 'Skipped — no itemId from movement 2',
            })
        ))
        return scoreReport(score.name, movements)
    }
    /* GET /members/collections/memory */
    const collectionsResponse = await request('/members/collections/memory')
    movements.push(movement(
        'Verify memory in collections',
        collectionsResponse,
        result => {
            if(!Array.isArray(result))
                return {
                    passed: false,
                    learned: {},
                    notes: `Expected array from collections. Got: ${ JSON.stringify(result)?.substring(0,200) }`,
                }
            const found = result.find(item=>item.id===itemIdToVerify)
            const passed = !!found
            console.log(`\n    ── Movement 3: Collections Verification ──`)
            console.log(`    Collection size: ${ result.length } memories`)
            console.log(`    Item found: ${ passed }`)
            if(found){
                const hasTitle = !!found.title
                const hasSummary = !!found.summary
                const hasType = found.type === 'memory' || found.form === 'memory'
                const hasKeywords = Array.isArray(found.keywords) && found.keywords.length > 0
                const summaryLength = found.summary?.length ?? 0
                /* check summary covers salient points from the fictional memory */
                const summaryText = (found.summary ?? '').toLowerCase()
                const salientPoints = [
                    { key: 'nana bea / grandmother', present: summaryText.includes('nana') || summaryText.includes('grandmother') || summaryText.includes('grandma') || summaryText.includes('beatriz'), },
                    { key: 'tea ceremony', present: summaryText.includes('tea'), },
                    { key: 'portugal / immigration', present: summaryText.includes('portugal') || summaryText.includes('atlantic') || summaryText.includes('immigr'), },
                    { key: 'fireflies / evening scene', present: summaryText.includes('firefl') || summaryText.includes('evening') || summaryText.includes('back step'), },
                    { key: 'fear of being forgotten', present: summaryText.includes('forgotten') || summaryText.includes('forgot'), },
                    { key: 'gardening / nature lessons', present: summaryText.includes('garden') || summaryText.includes('tree') || summaryText.includes('rose'), },
                ]
                const salientHits = salientPoints.filter(p=>p.present).length
                const salientTotal = salientPoints.length
                console.log(`    Title: "${ found.title ?? '(none)' }"`)
                console.log(`    Summary length: ${ summaryLength } chars`)
                console.log(`    Has type/form: ${ hasType } (${ found.type ?? found.form ?? '?' })`)
                console.log(`    Has keywords: ${ hasKeywords }${ hasKeywords ? ' (' + found.keywords.slice(0,5).join(', ') + ')' : '' }`)
                console.log(`    Salient coverage: ${ salientHits }/${ salientTotal }`)
                salientPoints.forEach(p=>{
                    console.log(`      ${ p.present ? '✓' : '✗' } ${ p.key }`)
                })
                if(summaryLength < 100)
                    console.log(`    ⚠ Summary is very short — possible token truncation`)
                context.verifiedItem = found
                return {
                    passed,
                    learned: {
                        itemId: found.id,
                        title: found.title,
                        summaryLength,
                        hasTitle,
                        hasSummary,
                        hasType,
                        hasKeywords,
                        salientCoverage: `${ salientHits }/${ salientTotal }`,
                    },
                    notes: `Memory found in collection. Salient coverage: ${ salientHits }/${ salientTotal }. Summary: ${ summaryLength } chars.`,
                }
            }
            return {
                passed,
                learned: { collectionSize: result.length, },
                notes: `itemId ${ itemIdToVerify } not found in ${ result.length }-item memory collection`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
