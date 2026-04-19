/**
 * Score 05 — Journaler Setup and Entry Creation
 *
 * Purpose: Create (or locate) the journaler bot, personalize it, verify its
 * routine, write a fictional journal entry, and confirm the entry persists
 * in the collections. Parallel structure to Scores 02 + 03 but for journaler
 * and entry collection type.
 *
 * Depends on: Score 01 (context.teams, context.bots, context.creatableTypes)
 *
 * A synthetic passing this score understands:
 *   - How to determine whether a bot type is creatable vs already instantiated
 *   - How to create a new typed bot via POST /members/bots/create
 *   - How to rename, activate, and verify the journaler's routine
 *   - How to submit a journal entry via NL chat and receive a createItem instruction
 *   - How to verify the entry exists in /members/collections/entry
 *   - How journaler metadata (mood, keywords) differs from biographer memory metadata
 */
import { context, logTurn, request, } from '../lib/session.mjs'
import { movement, scoreReport, } from '../lib/report.mjs'
export const score = {
    name: 'Journaler Setup',
    number: '05',
}
const SCORE_ID = '05'
const BOT_TYPE = 'journaler'
const COLLECTION_TYPE = 'entry'
const ROUTINE_TYPE = 'getting-started'
const mNames = [
    'Quill', 'Iris', 'Sage', 'Penn', 'Echo',
    'Lyra', 'Cedar', 'Wren', 'Atlas', 'Vale',
]
/**
 * Fictional journal entry — diary voice, present-tense, personal.
 * Deliberately different in register from the biographer memory narrative.
 */
const mFictionalEntry = `April 18th. It rained for the third straight day and I found myself sitting by the kitchen window longer than I intended, watching the drops race each other down the glass. Made coffee twice and drank neither cup fully. Called my sister in the afternoon — she sounded tired but said she was fine, which is what she always says. I've been thinking about Nana Bea a lot lately. Not sure why April brings her back so reliably. Started a new book, abandoned it by page forty. The apartment feels smaller when it rains. Not unpleasantly so — more like it's holding me in place while I figure out what I actually want to do with the day. Didn't come to any conclusions. That felt okay.`
/**
 * Predicted metadata for the fictional entry.
 * Used to score journaler's tagging accuracy against what a skilled journaler should generate.
 */
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
        { key: 'Rain / weather', test: t=>/rain/i.test(t), },
        { key: 'Coffee detail', test: t=>/coffee/i.test(t), },
        { key: 'Sister phone call', test: t=>/sister/i.test(t), },
        { key: 'Nana Bea reference', test: t=>/nana/i.test(t), },
        { key: 'Apartment / home setting', test: t=>/apartment/i.test(t), },
        { key: 'Book / reading abandoned', test: t=>/book|read|page/i.test(t), },
        { key: 'Emotional ambiguity / unresolved feeling', test: t=>/figure out|conclusion|okay|fine/i.test(t), },
    ]
    const salientResults = salientPoints.map(p=>({ key: p.key, present: p.test(summaryLower) }))
    const salientHits = salientResults.filter(r=>r.present).length
    return {
        title: { actual: title, matched: titleMatch, },
        keywords: {
            actual: keywords,
            hits: keywordHits,
            misses: keywordMisses,
            precision: `${ keywordHits.length }/${ mPredicted.keywords.expected.length }`,
            score: keywordHits.length / mPredicted.keywords.expected.length,
        },
        mood: { actual: mood, matched: moodMatch, },
        phaseOfLife: { actual: phaseOfLife, matched: phaseMatch, },
        summary: {
            length: summary.length,
            adequate: summary.length >= 80,
            salientCoverage: `${ salientHits }/${ salientPoints.length }`,
            salientScore: salientHits / salientPoints.length,
            salientResults,
        },
    }
}
export async function play(){
    console.log(`\nScore ${ score.number }: ${ score.name }`)
    const movements = []
    if(!context.teams?.length || !context.bots){
        console.log('  ✗ Cannot run — no teams/bots in context. Run Score 01 first.')
        return { passed: false, tally: '0/6' }
    }
    const chosenName = pick(mNames)
    /* ── movement 1 — create journaler or locate existing ── */
    const isCreatable = context.creatableTypes?.includes(BOT_TYPE)
    let journalerBotId = null
    let created = false
    if(isCreatable){
        const createResponse = await request('/members/bots/create', {
            method: 'POST',
            body: JSON.stringify({ type: BOT_TYPE, }),
        })
        journalerBotId = createResponse?.id ?? createResponse?.bot_id ?? null
        created = true
        movements.push(movement(
            `Create journaler bot (type: ${ BOT_TYPE })`,
            createResponse,
            result => {
                const id = result?.id ?? result?.bot_id
                const passed = !!id && (result?.type === BOT_TYPE || result?.being === 'bot')
                console.log(`\n    ── Movement 1: Bot Creation ──`)
                console.log(`    Created: ${ passed } | id: ${ id ?? '(none)' }`)
                console.log(`    Type: ${ result?.type ?? '?' } | Being: ${ result?.being ?? '?' }`)
                console.log(`    ────────────────────────────────`)
                if(passed)
                    context.journalerBotId = id
                return {
                    passed,
                    learned: {
                        created: true,
                        botId: id,
                        type: result?.type,
                        being: result?.being,
                    },
                    notes: passed
                        ? `Journaler created. id: ${ id }`
                        : `Create failed. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
                }
            }
        ))
    } else {
        /* find the existing journaler in context.bots */
        const existing = Object.values(context.bots ?? {}).find(b=>b.type===BOT_TYPE)
        journalerBotId = existing?.id ?? null
        movements.push(movement(
            `Locate existing journaler bot`,
            existing,
            result => {
                const passed = !!result?.id
                console.log(`\n    ── Movement 1: Locate Existing Journaler ──`)
                console.log(`    Found: ${ passed } | id: ${ result?.id ?? '(none)' }`)
                console.log(`    ─────────────────────────────────────────────`)
                if(passed)
                    context.journalerBotId = result.id
                return {
                    passed,
                    learned: { created: false, botId: result?.id, type: result?.type, },
                    notes: passed
                        ? `Existing journaler found. id: ${ result.id }`
                        : `No journaler found in context.bots and type not in creatableTypes`,
                }
            }
        ))
    }
    const botId = context.journalerBotId ?? journalerBotId
    if(!botId){
        ;['Rename journaler', 'Activate journaler', 'Verify routine personalization', 'Write journal entry', 'Verify entry in collections']
            .forEach(name=>movements.push({ name, passed: false, learned: {}, notes: 'Skipped — no journaler bot id' }))
        return scoreReport(score.name, movements)
    }
    /* ── movement 2 — rename ── */
    const renameResponse = await request(`/members/bots/${ botId }`, {
        method: 'PUT',
        body: JSON.stringify({ id: botId, bot_name: chosenName, }),
    })
    movements.push(movement(
        `Rename journaler → "${ chosenName }"`,
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
                notes: passed ? `Renamed to "${ chosenName }"` : `Rename may have failed. Got: ${ JSON.stringify(result)?.substring(0, 150) }`,
            }
        }
    ))
    /* ── movement 3 — activate ── */
    const activateResponse = await request(`/members/bots/activate/${ botId }`, {
        method: 'POST',
        body: JSON.stringify({}),
    })
    movements.push(movement(
        'Activate journaler',
        activateResponse,
        result => {
            const id = result?.id ?? result?.bot_id
            const passed = !!id && result?.success === true
            console.log(`\n    ── Movement 3: Activate ──`)
            console.log(`    Success: ${ result?.success } | id: ${ id ?? '?' }`)
            console.log(`    firstAccess: ${ result?.firstAccess } | version: ${ result?.version }`)
            console.log(`    ──────────────────────────`)
            if(passed)
                context.journalerActiveBotId = id
            return {
                passed,
                learned: {
                    botId: id,
                    firstAccess: result?.firstAccess,
                    version: result?.version,
                    versionUpdate: result?.versionUpdate,
                },
                notes: passed ? `Journaler activated. id: ${ id }` : `Activation failed. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
            }
        }
    ))
    /* ── movement 4 — routine personalization check ── */
    const routineResponse = await request(`/routine/${ ROUTINE_TYPE }`)
    movements.push(movement(
        'Verify routine personalization',
        routineResponse,
        result => {
            const { routine, success, } = result ?? {}
            const { cast=[], events=[], title='', } = routine ?? {}
            const passed = success === true && !!events.length
            if(!passed)
                return {
                    passed,
                    learned: {},
                    notes: `Routine failed or empty. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
                }
            const dialog = events
                .flatMap(e=>e.cast ?? [])
                .map(c=>c.dialog ?? '')
                .join('\n')
            const strippedDialog = dialog.replace(/<[^>]+>/g, '')
            const memberName = context.memberFirstName ?? ''
            const humanNamePresent = memberName.length > 0 && strippedDialog.toLowerCase().includes(memberName.toLowerCase())
            const botNamePresent = chosenName.length > 0 && strippedDialog.toLowerCase().includes(chosenName.toLowerCase())
            const isJournalerVoice = /journal|thought|reflect|feel|entry|private/i.test(strippedDialog)
            console.log(`\n    ── Movement 4: Routine Personalization ──`)
            console.log(`    Events: ${ events.length } | Cast: ${ cast.length }`)
            console.log(`    Human name present: ${ humanNamePresent }`)
            console.log(`    Bot name present (${ chosenName }): ${ botNamePresent }`)
            console.log(`    Journaler voice detected: ${ isJournalerVoice }`)
            console.log(`    Preview: "${ strippedDialog.substring(0, 200) }${ strippedDialog.length > 200 ? '...' : '' }"`)
            console.log(`    ─────────────────────────────────────────`)
            return {
                passed,
                learned: {
                    eventCount: events.length,
                    humanNamePresent,
                    botNamePresent,
                    isJournalerVoice,
                    dialogLength: strippedDialog.length,
                },
                notes: `Routine OK. Personalization — member name: ${ humanNamePresent }, bot name: ${ botNamePresent }, voice: ${ isJournalerVoice }`,
            }
        }
    ))
    /* ── movement 5 — write journal entry via chat ── */
    console.log(`\n    ── Submitting fictional journal entry (${ mFictionalEntry.length } chars) ──`)
    logTurn(SCORE_ID, 'synthetic', mFictionalEntry, { movement: 5, note: 'fictional journal entry' })
    let createdEntryId = null
    let exchangeCount = 0
    const maxExchanges = 4
    let currentResponse = await request('/members/', {
        method: 'POST',
        body: JSON.stringify({ message: mFictionalEntry, }),
    })
    exchangeCount++
    while(true){
        const { instructions=[], responses=[], success, } = currentResponse ?? {}
        const responseText = responses.map(r=>stripHtml(r.message)).join('\n')
        logTurn(SCORE_ID, 'journaler', responseText, { movement: 5, exchange: exchangeCount, instructions })
        const createInstr = extractInstruction(instructions, 'createItem')
        if(createInstr?.itemId){
            createdEntryId = createInstr.itemId
            console.log(`    ✓ Entry saved on exchange ${ exchangeCount } — itemId: ${ createdEntryId }`)
            break
        }
        const isQuestion = responseText.includes('?')
        const isConfirmation = /confirm|correct|save|shall i|should i|would you like/i.test(responseText)
        console.log(`    Exchange ${ exchangeCount }: ${ responseText.length } chars — question: ${ isQuestion }, confirmation: ${ isConfirmation }`)
        if(exchangeCount >= maxExchanges){
            console.log(`    ⚠ Exchange limit — asking journaler to save directly`)
            const saveRequest = `Please save this entry.`
            logTurn(SCORE_ID, 'synthetic', saveRequest, { movement: 5, exchange: ++exchangeCount, note: 'explicit save' })
            currentResponse = await request('/members/', {
                method: 'POST',
                body: JSON.stringify({ message: saveRequest, }),
            })
            const { instructions: finalInstr=[], responses: finalRes=[], } = currentResponse ?? {}
            logTurn(SCORE_ID, 'journaler', finalRes.map(r=>stripHtml(r.message)).join('\n'), { movement: 5, exchange: exchangeCount, instructions: finalInstr })
            const finalCreate = extractInstruction(finalInstr, 'createItem')
            if(finalCreate?.itemId){
                createdEntryId = finalCreate.itemId
                console.log(`    ✓ Entry saved after explicit request — itemId: ${ createdEntryId }`)
            } else {
                console.log(`    ✗ Entry not saved after explicit request`)
            }
            break
        }
        let followUp = isConfirmation
            ? `Yes, please save it.`
            : isQuestion
                ? `Yes, that sounds right. Please go ahead and save this entry.`
                : `Please save this entry when you're ready.`
        logTurn(SCORE_ID, 'synthetic', followUp, { movement: 5, exchange: ++exchangeCount })
        currentResponse = await request('/members/', {
            method: 'POST',
            body: JSON.stringify({ message: followUp, }),
        })
    }
    movements.push(movement(
        `Write journal entry (${ exchangeCount } exchange${ exchangeCount !== 1 ? 's' : '' })`,
        { createdEntryId, exchangeCount, },
        result => {
            const { createdEntryId, exchangeCount, } = result ?? {}
            const passed = !!createdEntryId
            console.log(`\n    ── Movement 5 Summary ──`)
            console.log(`    Entry saved: ${ passed } | itemId: ${ createdEntryId ?? 'none' }`)
            console.log(`    Exchanges: ${ exchangeCount }`)
            console.log(`    ────────────────────────`)
            if(passed)
                context.createdEntryId = createdEntryId
            return {
                passed,
                learned: { createdEntryId, exchangesToSave: exchangeCount, },
                notes: passed
                    ? `Entry created after ${ exchangeCount } exchange(s). itemId: ${ createdEntryId }`
                    : `Entry not saved after ${ exchangeCount } exchange(s)`,
            }
        }
    ))
    /* ── movement 6 — verify entry in collections ── */
    const entryId = context.createdEntryId
    if(!entryId){
        movements.push(movement(
            'Verify entry in collections',
            null,
            () => ({ passed: false, learned: {}, notes: 'Skipped — no entryId from movement 5' })
        ))
        return scoreReport(score.name, movements)
    }
    const collectionsResponse = await request(`/members/collections/${ COLLECTION_TYPE }`)
    movements.push(movement(
        'Verify entry in collections',
        collectionsResponse,
        result => {
            if(!Array.isArray(result))
                return {
                    passed: false,
                    learned: {},
                    notes: `Expected array. Got: ${ JSON.stringify(result)?.substring(0, 200) }`,
                }
            const found = result.find(item=>item.id===entryId)
            const passed = !!found
            console.log(`\n    ── Movement 6: Collections Verification ──`)
            console.log(`    Collection size: ${ result.length } entries`)
            console.log(`    Entry found: ${ passed }`)
            if(!found)
                return {
                    passed,
                    learned: { collectionSize: result.length, },
                    notes: `entryId ${ entryId } not found in ${ result.length }-entry collection`,
                }
            const assessment = assessEntryMetadata(found)
            console.log(`\n    ── Metadata Precision Assessment ──`)
            console.log(`    Predicted title patterns: ${ mPredicted.title.description }`)
            console.log(`    Actual title:    "${ assessment.title.actual }" — ${ assessment.title.matched ? '✓' : '✗' }`)
            console.log(`\n    Predicted keywords: ${ mPredicted.keywords.expected.join(', ') }`)
            console.log(`    Actual keywords: ${ assessment.keywords.actual.join(', ') || '(none)' }`)
            console.log(`    Keyword precision: ${ assessment.keywords.precision } (${ (assessment.keywords.score * 100).toFixed(0) }%)`)
            console.log(`    Hits:   ${ assessment.keywords.hits.join(', ') || '(none)' }`)
            console.log(`    Misses: ${ assessment.keywords.misses.join(', ') || '(none)' }`)
            console.log(`\n    Predicted mood: ${ mPredicted.mood.acceptable.join(' | ') }`)
            console.log(`    Actual mood:    "${ assessment.mood.actual }" — ${ assessment.mood.matched ? '✓' : '✗' }`)
            console.log(`\n    Predicted phaseOfLife: ${ mPredicted.phaseOfLife.acceptable.join(' | ') }`)
            console.log(`    Actual phaseOfLife:    "${ assessment.phaseOfLife.actual }" — ${ assessment.phaseOfLife.matched ? '✓' : '✗' }`)
            console.log(`\n    ── Summary Thoroughness (${ assessment.summary.length } chars) ──`)
            console.log(`    Salient coverage: ${ assessment.summary.salientCoverage } (${ (assessment.summary.salientScore * 100).toFixed(0) }%)`)
            assessment.summary.salientResults.forEach(r=>console.log(`      ${ r.present ? '✓' : '✗' } ${ r.key }`))
            console.log(`    ─────────────────────────────────────────`)
            context.verifiedEntry = found
            context.entryMetadataAssessment = assessment
            return {
                passed,
                learned: {
                    entryId: found.id,
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
                    },
                },
                notes: `Found in collection. Title: ${ assessment.title.matched ? '✓' : '✗' } | Keywords: ${ assessment.keywords.precision } | Mood: ${ assessment.mood.matched ? '✓' : '✗' } | Summary: ${ assessment.summary.salientCoverage }, ${ assessment.summary.length } chars`,
            }
        }
    ))
    return scoreReport(score.name, movements)
}
