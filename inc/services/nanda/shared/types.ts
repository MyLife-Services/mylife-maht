// shared/types.ts
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

// New interfaces for tool credential management
export interface CredentialRequirement {
  id: string;
  name: string;
  description?: string;
  acquisition?: {
    url: string;
    instructions?: string;
  };
}

export interface ToolCredentialInfo {
  toolName: string;
  serverName: string;
  serverId: string;
  credentials: CredentialRequirement[];
}

export interface ToolCredentialRequest {
  toolName: string;
  serverId: string;
  credentials: Record<string, string>;
}

export interface ToolCredentialResponse {
  success: boolean;
  error?: string;
}

export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema: any;
  credentialRequirements?: CredentialRequirement[];
}

export interface ToolsListResponse {
  tools: ToolInfo[];
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
