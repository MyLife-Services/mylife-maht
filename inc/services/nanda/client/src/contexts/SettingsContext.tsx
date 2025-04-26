// client/src/contexts/SettingsContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { v4 as uuidv4 } from "uuid";

// Define the types locally instead of importing from a non-existent file
interface ServerConfig {
  id: string;
  name: string;
  url: string;
}

interface CredentialRequirement {
  id: string;
  name: string;
  description?: string;
  acquisition?: {
    url?: string;
    instructions?: string;
  };
}

interface ToolCredentialInfo {
  toolName: string;
  serverName: string;
  serverId: string;
  credentials: CredentialRequirement[];
}

interface ToolCredentialRequest {
  toolName: string;
  serverId: string;
  credentials: Record<string, string>;
}

// Fix for undefined environment variables
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";
const STORAGE_KEY_API_KEY = "nanda-host-api-key";
const STORAGE_KEY_SERVERS = "nanda-mcp-servers"; // Key for storing servers in localStorage
const STORAGE_KEY_SESSION_ID = "nanda-session-id"; // Key for storing session ID

interface SettingsContextProps {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  nandaServers: ServerConfig[];
  registerNandaServer: (server: ServerConfig) => void;
  removeNandaServer: (id: string) => void;
  refreshRegistry: (searchQuery?: string) => Promise<any>;
  getToolsWithCredentialRequirements: () => Promise<ToolCredentialInfo[]>;
  setToolCredentials: (
    toolName: string,
    serverId: string,
    credentials: Record<string, string>
  ) => Promise<boolean>;
  sessionId: string | null;
}

const SettingsContext = createContext<SettingsContextProps>({
  apiKey: null,
  setApiKey: () => {},
  nandaServers: [],
  registerNandaServer: () => {},
  removeNandaServer: () => {},
  refreshRegistry: async () => ({ servers: [] }),
  getToolsWithCredentialRequirements: async () => [],
  setToolCredentials: async () => false,
  sessionId: null,
});

export const useSettingsContext = () => useContext(SettingsContext);

interface SettingsProviderProps {
  children: React.ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
}: SettingsProviderProps) => {
  const [apiKey, setInternalApiKey] = useState<string | null>(null);
  const [nandaServers, setNandaServers] = useState<ServerConfig[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const fallbackSessionId = useRef<string>(uuidv4());

  // Initialize API key from localStorage
  useEffect(() => {
    const storedKey = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (storedKey) {
      setInternalApiKey(storedKey);
    }
    
    // Initialize MCP servers from localStorage
    const storedServers = localStorage.getItem(STORAGE_KEY_SERVERS);
    if (storedServers) {
      try {
        const parsedServers = JSON.parse(storedServers);
        setNandaServers(parsedServers);
      } catch (error) {
        console.error("Error parsing stored servers:", error);
        // If parsing fails, initialize with empty array
        setNandaServers([]);
      }
    }
  }, []);

  // Set API key and store in localStorage
  const setApiKey = useCallback((key: string) => {
    setInternalApiKey(key);
    localStorage.setItem(STORAGE_KEY_API_KEY, key);
  }, []);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      try {
        // Check for stored session ID
        const storedSessionId = localStorage.getItem(STORAGE_KEY_SESSION_ID);
        
        if (storedSessionId) {
          console.log("Using stored session ID:", storedSessionId);
          setSessionId(storedSessionId);
          return;
        }
        
        // Create new session
        try {
          const response = await fetch(`${API_BASE_URL}/api/session`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          console.log("Created new session with ID:", data.sessionId);
          
          // Save session ID
          localStorage.setItem(STORAGE_KEY_SESSION_ID, data.sessionId);
          setSessionId(data.sessionId);
        } catch (error) {
          // Use fallback ID if API call fails
          const fallbackId = fallbackSessionId.current;
          console.log("Using fallback session ID:", fallbackId);
          localStorage.setItem(STORAGE_KEY_SESSION_ID, fallbackId);
          setSessionId(fallbackId);
        }
        
      } catch (error) {
        console.error("Error initializing session:", error);
      }
    };

    initSession();
  }, [apiKey]);

  // Register servers with backend when they change
  useEffect(() => {
    if (nandaServers.length > 0 && sessionId) {
      // Save servers to localStorage whenever they change
      localStorage.setItem(STORAGE_KEY_SERVERS, JSON.stringify(nandaServers));
      
      const registerAllServers = async () => {
        for (const server of nandaServers) {
          try {
            const response = await fetch(
              `${API_BASE_URL}/api/servers`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(server),
              }
            );

            if (!response.ok) {
              const errorData = await response.json();
              console.error(`Failed to register server ${server.id}:`, errorData);
              // Continue with other servers even if one fails
            } else {
              const data = await response.json();
              console.log(`Server ${server.id} registered successfully:`, data);
            }
          } catch (error) {
            console.error(`Error registering server ${server.id}:`, error);
            // Continue with other servers even if one fails
          }
        }
      };

      registerAllServers();
    }
  }, [nandaServers, sessionId]);

  // Register Nanda server
  const registerNandaServer = useCallback((server: ServerConfig) => {
    setNandaServers((prevServers) => {
      // Check if server with this ID already exists
      const existingIndex = prevServers.findIndex((s) => s.id === server.id);
      
      if (existingIndex !== -1) {
        // Update existing server
        const updatedServers = [...prevServers];
        updatedServers[existingIndex] = server;
        return updatedServers;
      } else {
        // Add new server
        return [...prevServers, server];
      }
    });
  }, []);

  // Remove Nanda server
  const removeNandaServer = useCallback((id: string) => {
    setNandaServers((prevServers) => {
      // Filter out the server with the matching ID
      return prevServers.filter((server) => server.id !== id);
    });
  }, []);

  // Get tools that require credentials
  const getToolsWithCredentialRequirements = useCallback(async (): Promise<ToolCredentialInfo[]> => {
    if (!sessionId) {
      console.warn("Cannot get tools: No session ID available");
      return [];
    }
    
    console.log(`Fetching tools requiring credentials using session ID: ${sessionId}`);
    console.log(`Using API base URL: ${API_BASE_URL}`);
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tools/credentials`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": sessionId,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get tools: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Received non-JSON response:", contentType);
        return [];
      }

      const data = await response.json();
      console.log("Tools with credential requirements:", data);
      return data.tools || [];
    } catch (error) {
      console.error("Error getting tools with credential requirements:", error);
      return [];
    }
  }, [sessionId]);

  // Set credentials for a tool
  const setToolCredentials = useCallback(
    async (
      toolName: string,
      serverId: string,
      credentials: Record<string, string>
    ): Promise<boolean> => {
      if (!sessionId) {
        console.warn("Cannot set credentials: No session ID available");
        return false;
      }
      
      console.log(`Setting credentials for tool ${toolName} from server ${serverId}`);
      
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/tools/credentials`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-ID": sessionId,
            },
            body: JSON.stringify({
              toolName,
              serverId,
              credentials,
            } as ToolCredentialRequest),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to set credentials: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Credentials set successfully:", data);
        return data.success || false;
      } catch (error) {
        console.error(`Error setting credentials for tool ${toolName}:`, error);
        return false;
      }
    },
    [sessionId]
  );

  // Refresh servers from registry
  const refreshRegistry = useCallback(async (searchQuery?: string) => {
    try {
      // If there's a search query, use the search endpoint
      const endpoint = searchQuery 
        ? `${API_BASE_URL}/api/registry/search?q=${encodeURIComponent(searchQuery)}`
        : `${API_BASE_URL}/api/registry/refresh`;
      
      const method = searchQuery ? "GET" : "POST";
      console.log(`Fetching servers from ${endpoint} with method ${method}`);
      
      const response = await fetch(
        endpoint,
        {
          method,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to fetch servers from registry"
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching servers from registry:", error);
      throw error;
    }
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        apiKey,
        setApiKey,
        nandaServers,
        registerNandaServer,
        removeNandaServer,
        refreshRegistry,
        getToolsWithCredentialRequirements,
        setToolCredentials,
        sessionId,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
