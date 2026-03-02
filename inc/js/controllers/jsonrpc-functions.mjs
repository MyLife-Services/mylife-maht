/* imports */
/* constants */
const mJsonRpcProtocolVersion = '2.0'
/* public functions */
/**
 * Returns a well-formatted JSON-RPC 2.0 object.
 * @param {Guid|null} id - The task/message ID
 * @param {string|null} method - The method to call
 * @param {object|null} params - The parameters to pass
 * @returns {object} - The JSON-RPC 2.0 formatted object
 */
function jsonrpcWrapper(id, method, params){
    return {
        jsonrpc: mJsonRpcProtocolVersion,
        id,
        method,
        params,
    }
}
/* private functions */
/* exports */
export { 
    jsonrpcWrapper,
}