/**
 * MyLife Synthetic Testing Harness
 *
 * Runs all movements in sequence against a live MyLife server.
 * Designed to be operated by a synthetic intelligence — each movement
 * documents what the system demonstrated, not just whether it passed.
 *
 * Usage:
 *   node tests/harness.mjs
 *
 * Environment (optional — defaults to synthetic test account):
 *   MYLIFE_BASE_URL       defaults to https://mylife.ngrok.app
 *   SYNTHETIC_MBR_ID      member id for synthetic test account
 *   SYNTHETIC_PASSPHRASE  passphrase for synthetic test account
 *
 * Structure:
 *   Overture  — 01: Discovery (teams, bots, creatableTypes, member info)
 *
 *   Memory Suite
 *     02 — Biographer Setup (create/locate, rename, activate, routine, interests)
 *     03 — Memory Creation (fictional Nana Bea memory, collections verify + metadata)
 *     04 — Memory Item Management (activate, title×2, summary×3, verify)
 *     05 — Journaler Setup (create/locate, rename, activate, routine, interests)
 *     06 — Journaler Entry Creation (fictional rainy-day entry, collections verify + metadata)
 *     07 — Journaler Item Management (activate, title×2, summary×3, verify)
 *     08 — Journaler Cleanup (delete entry, retire bot, verify collections, verify bots)
 *     09 — Diary Setup (create/locate, rename, activate, routine, interests)
 *     10 — Diary Entry Creation (fictional Thursday/manager entry, collections verify + metadata)
 *     11 — Diary Item Management (activate, title×2, summary×3, verify)
 *     12 — Diary Cleanup (delete entry, retire bot, verify collections, verify bots)
 *
 *   Political Suite
 *     13 — Political Team Setup (activate team, implicit setActiveBot, routine if firstAccess, verify bots)
 *     14 — Stance Creation (fictional housing policy stance, collections verify + metadata)
 *     15 — Stance Item Management (activate, title×2, summary append/remove/add, verify)
 *     16 — Political Cleanup (delete stance item, verify collections — no bot retirement, retirable:false)
 *
 *   Activism Suite
 *     17 — Activism Setup (create, rename, activate, routine, preferences — retirable:true)
 *     18 — Action Creation (fictional housing civic action plan, collections verify + metadata)
 *     19 — Action Item Management (activate, title×2, summary append/remove/add, verify)
 *     20 — Activism Cleanup (delete action, retire bot, verify collections, verify bots)
 */
import { mkdir, writeFile, } from 'node:fs/promises'
import { context, } from './lib/session.mjs'
import { play as play01, movement as movement01, } from './movements/01-discovery.mjs'
import { play as play02, movement as movement02, } from './movements/02-biographer-setup.mjs'
import { play as play03, movement as movement03, } from './movements/03-memory-creation.mjs'
import { play as play04, movement as movement04, } from './movements/04-item-management.mjs'
import { play as play05, movement as movement05, } from './movements/05-journaler-setup.mjs'
import { play as play06, movement as movement06, } from './movements/06-journaler-entry-creation.mjs'
import { play as play07, movement as movement07, } from './movements/07-journaler-item-management.mjs'
import { play as play08, movement as movement08, } from './movements/08-journaler-cleanup.mjs'
import { play as play09, movement as movement09, } from './movements/09-diary-setup.mjs'
import { play as play10, movement as movement10, } from './movements/10-diary-entry-creation.mjs'
import { play as play11, movement as movement11, } from './movements/11-diary-item-management.mjs'
import { play as play12, movement as movement12, } from './movements/12-diary-cleanup.mjs'
import { play as play13, movement as movement13, } from './movements/13-political-team-setup.mjs'
import { play as play14, movement as movement14, } from './movements/14-stance-creation.mjs'
import { play as play15, movement as movement15, } from './movements/15-stance-item-management.mjs'
import { play as play16, movement as movement16, } from './movements/16-political-cleanup.mjs'
import { play as play17, movement as movement17, } from './movements/17-activism-setup.mjs'
import { play as play18, movement as movement18, } from './movements/18-action-creation.mjs'
import { play as play19, movement as movement19, } from './movements/19-action-item-management.mjs'
import { play as play20, movement as movement20, } from './movements/20-activism-cleanup.mjs'
const movements = [
    { meta: movement01, play: play01, },
    { meta: movement02, play: play02, },
    { meta: movement03, play: play03, },
    { meta: movement04, play: play04, },
    { meta: movement05, play: play05, },
    { meta: movement06, play: play06, },
    { meta: movement07, play: play07, },
    { meta: movement08, play: play08, },
    { meta: movement09, play: play09, },
    { meta: movement10, play: play10, },
    { meta: movement11, play: play11, },
    { meta: movement12, play: play12, },
    { meta: movement13, play: play13, },
    { meta: movement14, play: play14, },
    { meta: movement15, play: play15, },
    { meta: movement16, play: play16, },
    { meta: movement17, play: play17, },
    { meta: movement18, play: play18, },
    { meta: movement19, play: play19, },
    { meta: movement20, play: play20, },
]
const runAt = new Date().toISOString()
console.log(`\nMyLife Synthetic Testing Harness`)
console.log(`Run: ${ runAt }`)
console.log(`Movements to perform: ${ movements.length }`)
console.log(`${ '─'.repeat(52) }`)
const results = []
for(const { meta, play } of movements){
    const result = await play()
    results.push({ ...meta, ...result })
}
/* terminal summary */
console.log(`\nFinal Report`)
console.log(`${ '═'.repeat(52) }`)
results.forEach(r=>{
    const icon = r.passed ? '✓' : '✗'
    console.log(`  ${ icon }  Movement ${ r.number }: ${ r.name } — ${ r.tally }`)
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
    movements: results.map(r=>({
        number: r.number,
        name: r.name,
        suite: r.suite,
        passed: r.passed,
        tally: r.tally,
        sections: r.sections ?? [],
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
