// client/src/contexts/ChatContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useSettingsContext } from "./SettingsContext";
import { v4 as uuidv4 } from "uuid";
import { socketService } from "../services/socketService";

// Fix for undefined environment variables
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'server-selection' | 'tool-execution' | 'error' | 'info';
  message: string;
  details?: any;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: any;
  timestamp: Date;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: any;
    result?: {
      content: any[];
      isError?: boolean;
    };
    serverId?: string;
    serverName?: string;
  }>;
  isIntermediate?: boolean;
}

interface ChatContextProps {
  messages: Message[];
  isLoading: boolean;
  activityLogs: LogEntry[];
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  clearLogs: () => void;
  addLogEntry: (type: LogEntry['type'], message: string, details?: any) => void;
}

const ChatContext = createContext<ChatContextProps>({
  messages: [],
  isLoading: false,
  activityLogs: [],
  sendMessage: async () => {},
  clearMessages: () => {},
  clearLogs: () => {},
  addLogEntry: () => {},
});

export const useChatContext = () => useContext(ChatContext);

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activityLogs, setActivityLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { apiKey } = useSettingsContext();
  const settingsContext = useSettingsContext();
  const fallbackSessionId = useRef<string>(uuidv4());
  
  // Get the session ID - use from settings context if available, fallback if not
  const getSessionId = useCallback(() => {
    return settingsContext.sessionId || fallbackSessionId.current;
  }, [settingsContext.sessionId]);

  // Add log entry
  const addLogEntry = useCallback((type: LogEntry['type'], message: string, details?: any) => {
    const newEntry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      type,
      message,
      details,
    };
    
    setActivityLogs(prevLogs => [...prevLogs, newEntry]);
  }, []);

  // Set up socket.io handler for tool execution updates
  useEffect(() => {
    const handleToolExecution = (data: {
      toolName: string;
      serverId: string;
      serverName: string;
      result: {
        content: any[];
        isError?: boolean;
      }
    }) => {
      console.log('Tool execution handler called with data:', data);
      const { toolName, serverId, serverName, result } = data;
      
      // Update message with tool call result
      setMessages(prevMessages => {
        console.log('Current messages:', prevMessages);
        // Find the message with the matching tool call
        const updatedMessages = prevMessages.map(message => {
          // Only update assistant messages with tool calls
          if (message.role === 'assistant' && message.toolCalls) {
            // Find the tool call that matches this execution
            const hasMatchingTool = message.toolCalls.some(tc => tc.name === toolName && !tc.result);
            
            if (hasMatchingTool) {
              console.log(`Found message with matching tool: ${toolName}`, message);
              // Update the tool calls with results
              const updatedToolCalls = message.toolCalls.map(tc => {
                if (tc.name === toolName && !tc.result) {
                  console.log(`Updating tool call with result: ${toolName}`, result);
                  // Update this tool call with the result
                  return {
                    ...tc,
                    result: {
                      content: result.content || [],
                      isError: result.isError || false
                    },
                    serverId,
                    serverName
                  };
                }
                return tc;
              });
              
              return {
                ...message,
                toolCalls: updatedToolCalls
              };
            }
          }
          return message;
        });
        
        console.log('Updated messages:', updatedMessages);
        return updatedMessages;
      });
      
      addLogEntry('tool-execution', `Tool executed: ${toolName}`, {
        serverName,
        serverId,
        resultSummary: result.content ? JSON.stringify(result.content).substring(0, 100) + '...' : 'No content'
      });
    };
    
    console.log('Setting up tool execution handler');
    // Register handler
    socketService.addToolExecutionHandler(handleToolExecution);
    
    return () => {
      console.log('Cleaning up tool execution handler');
      // Clean up
      socketService.removeToolExecutionHandler(handleToolExecution);
    };
  }, [addLogEntry]);

  // Process assistant response to extract tool calls
  const processAssistantResponse = useCallback((response: any) => {
    console.log("Raw response from API:", response);
    
    const toolCalls = [];

    // Check for tool_use items in the content array
    if (response.content && Array.isArray(response.content)) {
      for (const item of response.content) {
        if (item.type === "tool_use") {
          // Get server info from cache if available
          const serverInfo = socketService.getServerInfo(item.name);
          
          toolCalls.push({
            id: item.id,
            name: item.name,
            input: item.input,
            serverId: serverInfo?.serverId,
            serverName: serverInfo?.serverName,
            result: item.result
          });
          
          // Log tool usage
          addLogEntry('tool-execution', `Tool selected: ${item.name}`, {
            toolId: item.id,
            toolName: item.name,
            inputSummary: JSON.stringify(item.input).substring(0, 100) + (JSON.stringify(item.input).length > 100 ? '...' : '')
          });
        }
      }
    }

    // Log MCP server information if available
    if (response.serverInfo) {
      addLogEntry('server-selection', `MCP Server: ${response.serverInfo.id || 'Unknown'}`, response.serverInfo);
    }

    // If the content isn't already an array, convert it to one
    const processedContent = Array.isArray(response.content) 
      ? response.content 
      : [{ type: "text", text: typeof response.content === "string" 
            ? response.content 
            : "Response received in unexpected format" }];

    return {
      content: processedContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }, [addLogEntry]);

  // Send a message to the assistant
  const sendMessage = useCallback(
    async (messageText: string) => {
      if (!apiKey) {
        console.error("API key not set");
        // Add error message about missing API key
        const errorMessage: Message = {
          id: uuidv4(),
          role: "assistant",
          content: {
            type: "text",
            text: "Error: Please set your Anthropic API key in the settings (gear icon) before sending messages."
          },
          timestamp: new Date(),
        };
        
        addLogEntry('error', 'Missing API key', { requiredSetting: 'API Key' });
        setMessages((prevMessages) => [...prevMessages, errorMessage]);
        return;
      }

      setIsLoading(true);
      addLogEntry('info', 'Processing message', { messageText: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : '') });

      try {
        // Add user message
        const userMessage: Message = {
          id: uuidv4(),
          role: "user",
          content: { type: "text", text: messageText },
          timestamp: new Date(),
        };

        setMessages((prevMessages) => [...prevMessages, userMessage]);

        // Prepare messages for API
        const apiMessages = [...messages, userMessage].map((msg) => ({
          role: msg.role,
          content: Array.isArray(msg.content) ? msg.content : [msg.content],
        }));

        console.log(`Sending message to ${API_BASE_URL}/api/chat/completions with session ID: ${getSessionId()}`);
        addLogEntry('info', 'Sending request to API', { 
          endpoint: `${API_BASE_URL}/api/chat/completions`,
          sessionId: getSessionId()
        });
        
        // Send request to our backend
        const response = await fetch(
          `${API_BASE_URL}/api/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": apiKey,
              "X-Session-Id": getSessionId() || "",
            },
            body: JSON.stringify({
              messages: apiMessages,
              tools: true,
            }),
          }
        );

        // Check the content type before trying to parse JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          // Handle non-JSON response (like HTML error pages)
          const text = await response.text();
          console.error("Received non-JSON response:", text.substring(0, 200) + "...");
          addLogEntry('error', 'Invalid response format', { 
            contentType,
            statusCode: response.status,
            previewText: text.substring(0, 100) + '...'
          });
          throw new Error(`Invalid response from server: Not JSON (${response.status} ${response.statusText})`);
        }

        if (!response.ok) {
          const errorData = await response.json();
          addLogEntry('error', `Server error: ${response.status}`, errorData);
          throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
        }

        const responseData = await response.json();
        addLogEntry('info', 'Response received', { 
          statusCode: response.status,
          hasTools: responseData.toolsUsed || responseData.content?.some((item: any) => item.type === 'tool_use') || false,
          serverInfo: responseData.serverInfo || 'Not provided'
        });

        // Process the response to extract tool calls
        const { content, toolCalls } = processAssistantResponse(responseData);

        // Process intermediate responses first
        if (responseData.intermediateResponses && Array.isArray(responseData.intermediateResponses)) {
          for (const intermediateResponse of responseData.intermediateResponses) {
            const { content: intermediateContent } = processAssistantResponse(intermediateResponse);
            const intermediateMessage: Message = {
              id: uuidv4(),
              role: "assistant",
              content: intermediateContent,
              timestamp: new Date(intermediateResponse.timestamp || Date.now()),
              isIntermediate: true
            };
            setMessages((prevMessages) => [...prevMessages, intermediateMessage]);
          }
        }

        // Add assistant message
        const assistantMessage: Message = {
          id: uuidv4(),
          role: "assistant",
          content,
          timestamp: new Date(),
          toolCalls,
        };

        setMessages((prevMessages) => [...prevMessages, assistantMessage]);
      } catch (error) {
        console.error("Error sending message:", error);
        addLogEntry('error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { error });

        // Add error message
        const errorMessage: Message = {
          id: uuidv4(),
          role: "assistant",
          content: {
            type: "text",
            text: `Error: ${
              error instanceof Error
                ? error.message
                : "Failed to communicate with the assistant"
            }`,
          },
          timestamp: new Date(),
        };

        setMessages((prevMessages) => [...prevMessages, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, messages, processAssistantResponse, getSessionId, addLogEntry]
  );

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Clear all logs
  const clearLogs = useCallback(() => {
    setActivityLogs([]);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isLoading,
        activityLogs,
        sendMessage,
        clearMessages,
        clearLogs,
        addLogEntry,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
