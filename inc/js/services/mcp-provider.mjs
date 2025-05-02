/* imports */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
/**
 * MCPProviderLLM class
 * This class is used to connect to a Model Context Protocol (MCP) server and get responses from a language model.
 * It uses the MCP SDK to create a client and connect to the server using Server-Sent Events (SSE).
 */
class mcpProvider {
	#client
	#endpoint
	#toolName
	/**
	 * Constructor for the mcpProvider class.
	 * @param {object} llm_providers - The LLM providers object containing connection type, authentication, endpoint, and type.
	 */
	constructor(llm_provider){
		const { _connectionType, authentication, endpoint, type='system-avatar', } = llm_provider
		if(_connectionType.toLowerCase()!=='mcp')
			throw new Error('Connection type is not defined')
		this.#endpoint = endpoint
		this.#toolName = toolName
		console.log('Connecting to MCP model server...')
		const transport = new SSEClientTransport(new URL(endpoint))
		this.#client = new Client({ name: `mylife-${ type }`, version: '1.0.0' })
		this.#client.connect(transport)
			.then(()=>{
				console.log('Connected to MCP model server')
			})
	}
	async getLLMResponse(_thread, _botId, prompt, factory, avatar) {
		const args = { prompt }  // adapt this to your tool's input schema
		const result = await this.#client.callTool({ name: this.#toolName, arguments: args })
		return [{
			role: 'assistant',
			run_id: `mcp-${ Date.now() }`,
			content: result.content
		}]
	}
}
/* exports */
export {
	mcpProvider,
}