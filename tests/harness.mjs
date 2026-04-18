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
 */
import { play as play01, score as score01, } from './scores/01-discovery.mjs'
import { play as play02, score as score02, } from './scores/02-biographer-setup.mjs'
import { play as play03, score as score03, } from './scores/03-memory-creation.mjs'
const scores = [
    { meta: score01, play: play01, },
    { meta: score02, play: play02, },
    { meta: score03, play: play03, },
]
console.log(`\nMyLife Synthetic Testing Harness`)
console.log(`Scores to perform: ${ scores.length }`)
console.log(`${ '─'.repeat(52) }`)
const results = []
for(const { meta, play } of scores){
    const result = await play()
    results.push({ ...meta, ...result })
}
console.log(`\nFinal Report`)
console.log(`${ '═'.repeat(52) }`)
results.forEach(r=>{
    const icon = r.passed ? '✓' : '✗'
    console.log(`  ${ icon }  Score ${ r.number }: ${ r.name } — ${ r.tally }`)
})
const allPassed = results.every(r=>r.passed)
console.log(`\nOverall: ${ allPassed ? 'INSTRUMENT IN TUNE' : 'REVIEW REQUIRED' }`)
console.log(`${ '═'.repeat(52) }\n`)
