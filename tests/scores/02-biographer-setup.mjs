/**
 * Score 02 — Biographer Setup
 *
 * Purpose: Activate the biographer bot, personalize it with a name and
 * interests. Demonstrates that a synthetic can configure the instrument
 * before playing it — selecting the right voice, tuning it to a persona.
 *
 * Depends on: Score 01 (context.bots, context.activeBotId must be set)
 *
 * A synthetic passing this score understands:
 *   - How to switch the active bot by id
 *   - The shape of the activation response (greeting, version, success)
 *   - How to rename a bot via PUT with bot_name
 *   - How to set interests (variable-keyed options) via PUT
 *   - That the same PUT endpoint handles both name and options updates
 */
import { context, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Biographer Setup',
    number: '02',
}
/* random names and interest sets so each run feels like a different synthetic operator */
const mNames = ['Chronicler', 'Archivist', 'Narrator', 'Scribe', 'Lumen', 'Vance', 'Quill', 'Sage']
const mInterestPool = [
    'academics', 'art', 'business/career', 'culture', 'entertainment',
    'family', 'fashion', 'food/drink', 'health/wellness', 'hobbies',
    'ideas/philosophy', 'literature', 'music', 'pets', 'politics/current events',
    'relationships', 'religion/spirituality', 'science/technology',
    'causes/volunteering', 'sports', 'travel',
]
function pickRandom(arr, count){
    const shuffled = [...arr].sort(()=>Math.random()-0.5)
    return shuffled.slice(0, count)
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    /* resolve biographer id from context set by score 01 */
    const biographer = context.bots?.find(b=>b.type==='personal-biographer')
    if(!biographer){
        console.log('  ✗ Cannot run — biographer not found in context. Run Score 01 first.')
        return { passed: false, tally: '0/3' }
    }
    const biographerId = biographer.id
    const chosenName = mNames[Math.floor(Math.random() * mNames.length)]
    const chosenInterests = pickRandom(mInterestPool, 4)
    /* movement 1 — rename biographer */
    const renameResponse = await request(`/members/bots/${ biographerId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: biographerId, bot_name: chosenName, }),
    })
    movements.push(movement(
        `Rename biographer to "${ chosenName }"`,
        renameResponse,
        result => {
            const passed = result?.name === chosenName || result?.bot_name === chosenName
            return {
                passed,
                learned: passed ? { biographerName: chosenName, } : {},
                notes: passed
                    ? `Biographer renamed to "${ chosenName }"`
                    : `Expected name "${ chosenName }". Got: ${ JSON.stringify(result) }`,
            }
        }
    ))
    /* movement 2 — activate biographer */
    const activateResponse = await request(`/members/bots/activate/${ biographerId }`, { method: 'POST', })
    movements.push(movement(
        'Activate biographer bot',
        activateResponse,
        result => {
            const passed = result?.success === true && !!( result?.id ?? result?.bot_id )
            const botId = result?.id ?? result?.bot_id
            if(passed)
                context.activeBotId = botId
            return {
                passed,
                learned: passed ? {
                    activeBotId: botId,
                    firstAccess: result.firstAccess,
                    version: result.version,
                    versionUpdate: result.versionUpdate,
                } : {},
                notes: passed
                    ? `Biographer active. Version ${ result.version }. First access: ${ result.firstAccess }`
                    : `Expected { success: true, id }. Got: ${ JSON.stringify(result) }`,
            }
        }
    ))
    /* movement 3 — run biographer greeting routine */
    const routineResponse = await request('/routine/biographer')
    movements.push(movement(
        'Run biographer greeting routine',
        routineResponse,
        result => {
            const { routine, success, } = result ?? {}
            const passed = success === true && !!routine?.events?.length
            if(passed)
                context.biographerRoutine = routine
            const strippedDialog = passed
                ? routine.events.map(e=>e.dialog?.message ?? '').join(' ').replace(/<[^>]+>/g, '')
                : ''
            const humanNamePresent = strippedDialog.includes('Alex')
            const botNamePresent = strippedDialog.includes(chosenName)
            return {
                passed,
                learned: passed ? {
                    routineTitle: routine.title,
                    eventCount: routine.events.length,
                    cast: routine.cast?.map(c=>c.role),
                    opening: routine.events[0]?.dialog?.message?.replace(/<[^>]+>/g, '').trim().substring(0, 80),
                    personalization: { humanNamePresent, botNamePresent, },
                } : {},
                notes: passed
                    ? `Routine "${ routine.title }" — ${ routine.events.length } events. Personalization: human=${ humanNamePresent }, bot=${ botNamePresent }`
                    : `Expected { success, routine: { events[] } }. Got: ${ JSON.stringify(result) }`,
            }
        }
    ))
    /* movement 4 — set interests */
    const interestsResponse = await request(`/members/bots/${ biographerId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: biographerId, interests: chosenInterests, }),
    })
    movements.push(movement(
        `Set interests: ${ chosenInterests.join(', ') }`,
        interestsResponse,
        result => {
            const savedInterests = result?.interests ?? []
            const passed = chosenInterests.every(i=>savedInterests.includes(i))
            if(passed)
                context.biographerInterests = savedInterests
            return {
                passed,
                learned: passed ? { interests: savedInterests, } : {},
                notes: passed
                    ? `Interests saved: ${ savedInterests.join(', ') }`
                    : `Expected interests ${ JSON.stringify(chosenInterests) }. Got: ${ JSON.stringify(savedInterests) }`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
