/**
 * MyLife Synthetic Testing Harness
 *
 * Runs all scores in sequence against a live MyLife server.
 * Designed to be operated by a synthetic intelligence — each score
 * documents what the system demonstrated, not just whether it passed.
 *
 * Usage:
 *   node tests/harness.mjs
 *
 * Environment (optional — defaults to synthetic test account):
 *   MYLIFE_BASE_URL       defaults to https://mylife.ngrok.app
 *   SYNTHETIC_MBR_ID      defaults to ember|95ade320-e0f7-4cef-a001-9324edcb6e71
 *   SYNTHETIC_PASSPHRASE  defaults to synthetic account passphrase
 *
 * Score map:
 *   01 — Discovery (teams, bots, creatableTypes, member info)
 *   02 — Biographer Setup (create/locate, rename, activate, routine, interests)
 *   03 — Memory Creation (fictional Nana Bea memory, collections verify + metadata)
 *   04 — Item Management / Biographer (activate, title×2, summary×3, verify)
 *   05 — Journaler Setup (create/locate, rename, activate, routine, interests)
 *   06 — Journaler Entry Creation (fictional rainy-day entry, collections verify + metadata)
 *   07 — Journaler Item Management (activate, title×2, summary×3, verify)
 *   08 — Journaler Cleanup (delete entry, retire bot, verify collections, verify bots)
 *   09 — Diary Setup (create/locate, rename, activate, routine, interests)
 *   10 — Diary Entry Creation (fictional Thursday/manager entry, collections verify + metadata)
 *   11 — Diary Item Management (activate, title×2, summary×3, verify)
 *   12 — Diary Cleanup (delete entry, retire bot, verify collections, verify bots)
 *   13 — Political Team Setup (activate team, implicit setActiveBot, routine if firstAccess, verify bots)
 */
import { mkdir, writeFile, } from 'node:fs/promises'
import { context, } from './lib/session.mjs'
import { play as play01, score as score01, } from './scores/01-discovery.mjs'
import { play as play02, score as score02, } from './scores/02-biographer-setup.mjs'
import { play as play03, score as score03, } from './scores/03-memory-creation.mjs'
import { play as play04, score as score04, } from './scores/04-item-management.mjs'
import { play as play05, score as score05, } from './scores/05-journaler-setup.mjs'
import { play as play06, score as score06, } from './scores/06-journaler-entry-creation.mjs'
import { play as play07, score as score07, } from './scores/07-journaler-item-management.mjs'
import { play as play08, score as score08, } from './scores/08-journaler-cleanup.mjs'
import { play as play09, score as score09, } from './scores/09-diary-setup.mjs'
import { play as play10, score as score10, } from './scores/10-diary-entry-creation.mjs'
import { play as play11, score as score11, } from './scores/11-diary-item-management.mjs'
import { play as play12, score as score12, } from './scores/12-diary-cleanup.mjs'
import { play as play13, score as score13, } from './scores/13-political-team-setup.mjs'
const scores = [
    { meta: score01, play: play01, },
    { meta: score02, play: play02, },
    { meta: score03, play: play03, },
    { meta: score04, play: play04, },
    { meta: score05, play: play05, },
    { meta: score06, play: play06, },
    { meta: score07, play: play07, },
    { meta: score08, play: play08, },
    { meta: score09, play: play09, },
    { meta: score10, play: play10, },
    { meta: score11, play: play11, },
    { meta: score12, play: play12, },
    { meta: score13, play: play13, },
]
const runAt = new Date().toISOString()
console.log(`\nMyLife Synthetic Testing Harness`)
console.log(`Run: ${ runAt }`)
console.log(`Scores to perform: ${ scores.length }`)
console.log(`${ '─'.repeat(52) }`)
const results = []
for(const { meta, play } of scores){
    const result = await play()
    results.push({ ...meta, ...result })
}
/* terminal summary */
console.log(`\nFinal Report`)
console.log(`${ '═'.repeat(52) }`)
results.forEach(r=>{
    const icon = r.passed ? '✓' : '✗'
    console.log(`  ${ icon }  Score ${ r.number }: ${ r.name } — ${ r.tally }`)
})
const allPassed = results.every(r=>r.passed)
const verdict = allPassed ? 'INSTRUMENT IN TUNE' : 'REVIEW REQUIRED'
console.log(`\nOverall: ${ verdict }`)
console.log(`${ '═'.repeat(52) }\n`)
/* write JSON report */
const report = {
    runAt,
    overall: verdict,
    allPassed,
    scores: results.map(r=>({
        number: r.number,
        name: r.name,
        passed: r.passed,
        tally: r.tally,
        movements: r.movements ?? [],
    })),
    conversationLog: context.conversationLog,
    apiLog: context.apiLog,
}
const slug = runAt.replace(/:/g, '-').replace(/\..+$/, '')
const outDir = new URL('./results', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') // fix Windows drive letter
const outFile = `${ outDir }/${ slug }.json`
try {
    await mkdir(outDir, { recursive: true })
    await writeFile(outFile, JSON.stringify(report, null, 2), 'utf8')
    console.log(`Results written to ${ outFile }`)
} catch(err){
    console.error(`Could not write results file: ${ err.message }`)
}
