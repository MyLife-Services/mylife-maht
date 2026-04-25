/**
 * Movement reporter for MyLife synthetic testing harness.
 * Each section produces a result: what was checked, did it pass,
 * what was learned, and what a synthetic consumer should now understand.
 */
/**
 * Evaluates a single section within a movement.
 * @param {string} name - Section name
 * @param {object} response - Raw API response
 * @param {Function} understand - Evaluator: receives response, returns { passed, learned, notes }
 * @returns {object} - { name, passed, learned, notes }
 */
export function section(name, response, understand){
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
 * Prints the full movement report after all sections complete.
 * Documents what the synthetic consumer has learned from the performance.
 * @param {string} name - Movement name
 * @param {object[]} sections - Array of section results
 * @returns {object} - { passed, tally, sections }
 */
export function movementReport(name, sections){
    const passed = sections.filter(s=>s.passed).length
    const total = sections.length
    const allPassed = passed === total
    console.log(`\n${ '═'.repeat(52) }`)
    console.log(`Movement: ${ name }`)
    console.log(`Performance: ${ passed }/${ total } sections`)
    console.log(`\nWhat the synthetic now understands:`)
    sections.forEach(s=>{
        if(Object.keys(s.learned).length)
            console.log(`  [${ s.name }]\n${ JSON.stringify(s.learned, null, 4) }`)
    })
    if(!allPassed){
        console.log(`\nGaps:`)
        sections.filter(s=>!s.passed).forEach(s=>console.log(`  ✗ ${ s.name }: ${ s.notes }`))
    }
    console.log(`${ '═'.repeat(52) }\n`)
    return { passed: allPassed, tally: `${ passed }/${ total }`, sections }
}
