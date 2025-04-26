export interface ServerConfig {
    id: string;
    name: string;
    url: string;
}
export interface MessageContent {
    type: string;
    text?: string;
    data?: string;
    [key: string]: any;
}
export interface Message {
    role: "user" | "assistant";
    content: MessageContent | MessageContent[];
}
export interface ToolCall {
    id: string;
    name: string;
    input: any;
    result?: {
        content: MessageContent[];
        isError?: boolean;
    };
}
export interface ChatCompletionRequest {
    messages: Message[];
    tools?: boolean;
}
export interface ChatCompletionResponse {
    id: string;
    model: string;
    content: MessageContent[];
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}
export interface ToolExecutionRequest {
    toolName: string;
    args: any;
}
export interface ToolExecutionResponse {
    content: MessageContent[];
    isError?: boolean;
}
export interface ApiKeyRequest {
    apiKey: string;
}
export interface ApiKeyResponse {
    success: boolean;
}
export interface ToolsListResponse {
    tools: Array<{
        name: string;
        description?: string;
        inputSchema: any;
    }>;
}
export interface ServersListResponse {
    servers: ServerConfig[];
}
export interface SessionResponse {
    sessionId: string;
}
export interface ErrorResponse {
    error: string;
}
