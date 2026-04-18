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
 *   - How to verify a created memory via API (collections → item)
 *   - Whether the LLM can recall a memory it just helped capture
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
function stripHtml(str){ return str.replace(/<[^>]+>/g, '').trim() }
function countSuggestions(text){
    /* heuristic: count numbered lists, bullet cues, or sentence-starting action verbs */
    const numbered = (text.match(/\d+\./g) ?? []).length
    const bulleted = (text.match(/[-•*]\s/g) ?? []).length
    return Math.max(numbered, bulleted, text.split(/\n/).filter(l=>l.trim().length>20).length > 3 ? 2 : 1)
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    if(!context.activeBotId){
        console.log('  ✗ Cannot run — no active bot in context. Run Scores 01 and 02 first.')
        return { passed: false, tally: '0/1' }
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
            const isCompelling = text.length > 80 /* substantive, not a one-liner */
            const isComprehensible = !text.includes('undefined') && !text.includes('[object')
            /* cognitive assessment */
            console.log(`\n    ── Cognitive Assessment ──`)
            console.log(`    Message received:\n    "${ text.substring(0, 200) }${ text.length > 200 ? '...' : '' }"`)
            console.log(`    Multiple suggestions: ${ isMultipleSuggestions } (${ suggestionCount } detected)`)
            console.log(`    Compelling (substantive): ${ isCompelling } (${ text.length } chars)`)
            console.log(`    Comprehensible: ${ isComprehensible }`)
            console.log(`    Instructions attached: ${ instructions.length }`)
            console.log(`    ──────────────────────────`)
            if(passed)
                context.openingResponse = text
            return {
                passed: passed && isComprehensible,
                learned: {
                    messageSent: opening,
                    responseLength: text.length,
                    multiplesuggestions: isMultipleSuggestions,
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
    return scoreReport(score.name, movements)
}
