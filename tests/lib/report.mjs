/**
 * Score reporter for MyLife synthetic testing harness.
 * Each movement produces a result: what was checked, did it pass,
 * what was learned, and what a synthetic consumer should now understand.
 */
/**
 * Evaluates a single movement within a score.
 * @param {string} name - Movement name
 * @param {object} response - Raw API response
 * @param {Function} understand - Evaluator: receives response, returns { passed, learned, notes }
 * @returns {object} - { name, passed, learned, notes }
 */
export function movement(name, response, understand){
    const { passed, learned={}, notes='' } = understand(response)
    const icon = passed ? '✓' : '✗'
    console.log(`  ${ icon } ${ name }`)
    if(notes)
        console.log(`    → ${ notes }`)
    if(!passed)
        console.log(`    FAILED`)
    return { name, passed, learned, notes }
}
/**
 * Prints the full score report after all movements complete.
 * Documents what the synthetic consumer has learned from the performance.
 * @param {string} name - Score name
 * @param {object[]} movements - Array of movement results
 * @returns {object} - { passed, tally }
 */
export function scoreReport(name, movements){
    const passed = movements.filter(m=>m.passed).length
    const total = movements.length
    const allPassed = passed === total
    console.log(`\n${ '═'.repeat(52) }`)
    console.log(`Score: ${ name }`)
    console.log(`Performance: ${ passed }/${ total } movements`)
    console.log(`\nWhat the synthetic now understands:`)
    movements.forEach(m=>{
        if(Object.keys(m.learned).length)
            console.log(`  [${ m.name }]\n${ JSON.stringify(m.learned, null, 4) }`)
    })
    if(!allPassed){
        console.log(`\nGaps:`)
        movements.filter(m=>!m.passed).forEach(m=>console.log(`  ✗ ${ m.name }: ${ m.notes }`))
    }
    console.log(`${ '═'.repeat(52) }\n`)
    return { passed: allPassed, tally: `${ passed }/${ total }` }
}
