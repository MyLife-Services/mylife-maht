# Application Insights Configuration

This document explains how to configure and troubleshoot Microsoft Application Insights for the C4RG Intelligent Platform.

## Overview

Application Insights is Azure's application performance management (APM) service that helps monitor the live application. It automatically collects:
- Request rates, response times, and failure rates
- Dependency rates, response times, and failure rates
- Exceptions
- Page views and load performance
- Custom events and metrics

## Configuration

### 1. Environment Variables

The application supports two environment variable names for the connection string:

- `APPLICATIONINSIGHTS_CONNECTION_STRING` (recommended - Azure standard)
- `MS_APPLICATIONINSIGHTS_CONNECTION_STRING` (legacy support)

The application will check for `APPLICATIONINSIGHTS_CONNECTION_STRING` first, then fall back to `MS_APPLICATIONINSIGHTS_CONNECTION_STRING`.

### 2. Setting Up in Azure

1. Create an Application Insights resource in Azure Portal
2. Navigate to your Application Insights resource
3. Go to "Overview" → "Essentials" → Copy the "Connection String"
4. Set the connection string in your environment:

```bash
# For production (Azure App Service)
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...;IngestionEndpoint=...

# For local development (.env file)
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...;IngestionEndpoint=...
```

### 3. Disabling Application Insights

To disable Application Insights, set the environment variable to:
- `disabled`
- Empty string
- Don't set the variable at all

Example:
```bash
APPLICATIONINSIGHTS_CONNECTION_STRING=disabled
```

## Features Enabled

The application is configured to automatically collect:

- ✅ HTTP Requests - All incoming HTTP requests to the Koa server
- ✅ Performance Metrics - CPU, memory, and other performance counters
- ✅ Exceptions - Unhandled exceptions and errors
- ✅ Dependencies - Outgoing HTTP requests, database calls, etc.
- ✅ Console Logs - Console output (errors and warnings)
- ✅ Disk Retry Caching - Retries failed telemetry sends

Live Metrics streaming is disabled by default to reduce costs.

## Troubleshooting

### No Data Appearing in Azure Portal

If you're not seeing data in Application Insights:

1. **Check the Connection String**
   - Verify the connection string is correctly set in Azure
   - Ensure it's not set to 'disabled'
   - Check for typos or extra whitespace

2. **Check Server Logs**
   - Look for: `✅ Application Insights initialized successfully`
   - If you see errors, check the error message and stack trace

3. **Verify Network Connectivity**
   - Ensure your server can reach Azure endpoints
   - Check firewall rules if running in a restricted environment

4. **Wait for Data**
   - It can take 2-5 minutes for telemetry to appear in Azure Portal
   - Try the "Live Metrics" view for real-time data (if enabled)

5. **Check Azure Portal**
   - Go to Application Insights resource
   - Navigate to "Live Metrics" to see real-time data
   - Navigate to "Transaction search" to find specific requests
   - Navigate to "Failures" to see errors

### Common Issues

#### Issue: "Failed to initialize Application Insights"
**Solution**: Check the error message in the logs. Common causes:
- Invalid connection string format
- Network connectivity issues
- Missing or incompatible npm package version

#### Issue: "No telemetry after several minutes"
**Solution**: 
- Verify the connection string is correct
- Check that the server is receiving traffic
- Ensure the Application Insights resource is in the same Azure region (or closest)
- Check for any network proxies or firewalls blocking Azure endpoints

#### Issue: "ESM import errors"
**Solution**: The application uses ES modules. Ensure you're using Node.js v18+ and that the application insights package is v3.13.0+

## Verifying Setup

### 1. Check Initialization
When the server starts, you should see:
```
✅ Application Insights initialized successfully
   Connection String: InstrumentationKey=12345678-1234-...
```

### 2. Send Test Traffic
Make a few requests to your server:
```bash
curl http://localhost:3000/
```

### 3. Check Azure Portal
After 2-5 minutes, visit your Application Insights resource:
- Go to "Transaction search"
- Filter by last 30 minutes
- You should see requests appearing

## Additional Resources

- [Application Insights for Node.js](https://docs.microsoft.com/azure/azure-monitor/app/nodejs)
- [Azure Monitor Documentation](https://docs.microsoft.com/azure/azure-monitor/)
- [Application Insights npm package](https://www.npmjs.com/package/applicationinsights)

## Version Information

- **Application Insights SDK**: v3.13.0
- **Node.js**: v18+ (required for ES modules)
- **Platform**: Linux (Azure App Service)
