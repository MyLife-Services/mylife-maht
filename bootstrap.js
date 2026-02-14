const aiConnectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
const aiClient = aiConnectionString?.trim() && aiConnectionString.trim() !== 'disabled'
    ? await importMSAI(aiConnectionString.trim())
    : null
if(aiClient){
    aiClient.trackEvent({ name: 'ai-startup-probe' })
    aiClient.flush({ isAppCrashing: false })
}
wireAIFlush(aiClient)
await import('./server.js')
/**
 * Imports and initializes Microsoft Application Insights for telemetry and monitoring.
 * @param {string} connectionString - application insights connection string from Azure
 * @returns {Promise<object|null>} - Returns the default client when initialized.
 */
async function importMSAI(connectionString) {
    try {
        const ai = await import('applicationinsights')
        const aiSdk = ai.default
        const aiSetup = aiSdk.setup(connectionString)
        if(process.env.APPLICATIONINSIGHTS_INTERNAL_LOGGING === 'true'){
            if(typeof aiSetup.setInternalLogging === 'function'){
                aiSetup.setInternalLogging(true, true)
                console.log('🔎 Application Insights internal logging enabled')
            } else
                console.log('⚠️ Application Insights internal logging not supported by this SDK version')
        }
        aiSetup
            .setAutoCollectRequests(true)
            .setAutoCollectPerformance(true, true)
            .setAutoCollectExceptions(true)
            .setAutoCollectDependencies(true)
            .setAutoCollectConsole(true, true)
            .setUseDiskRetryCaching(true)
            .setSendLiveMetrics(false)
            .start()
        console.log('✅ Application Insights initialized successfully')
        console.log('   Connection String:', connectionString.substring(0, 50) + '...')
        return ai.default.defaultClient
    } catch(e) {
        console.error('❌ Failed to initialize Application Insights. Telemetry will be disabled.')
        console.error('Error:', e.message)
        console.error('Stack:', e.stack)
        return null
    }
}
/**
 * Sets up listeners to flush Application Insights telemetry on process exit signals to ensure graceful shutdown and that telemetry is sent before the application exits.
 * @param {object} aiClient - The Application Insights client instance to flush on exit signals.
 * @returns {void}
 */
function wireAIFlush(aiClient) {
    if(!aiClient)
        return
    const flushAndExit = (signal) => {
        aiClient.trackEvent({ name: 'ai-shutdown-probe', properties: { signal } })
        aiClient.flush({ isAppCrashing: false })
    }
    process.once('SIGINT', () => flushAndExit('SIGINT'))
    process.once('SIGTERM', () => flushAndExit('SIGTERM'))
}
