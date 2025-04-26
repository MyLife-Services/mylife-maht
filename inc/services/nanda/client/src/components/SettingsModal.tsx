// client/src/components/SettingsModal.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  VStack,
  FormHelperText,
  Box,
  Heading,
  Text,
  Divider,
  Flex,
  Link,
  useToast,
  IconButton,
  InputGroup,
  InputRightElement,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Spinner,
  Center,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Badge,
  HStack,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  InputLeftElement,
} from "@chakra-ui/react";
import { FaEye, FaEyeSlash, FaPlus, FaExternalLinkAlt, FaSync, FaTrash, FaSearch } from "react-icons/fa";
import { useSettingsContext } from "../contexts/SettingsContext";
import { debounce } from "lodash";

// Define the types locally instead of importing from a non-existent file
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

// Define the ServerConfig interface for registry servers
interface ServerConfig {
  id: string;
  name: string;
  url: string;
  description?: string;
  types?: string[];
  tags?: string[];
  verified?: boolean;
  rating?: number;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Component for a single tool credential form
interface ToolCredentialFormProps {
  tool: ToolCredentialInfo;
  onSave: (
    toolName: string,
    serverId: string,
    credentials: Record<string, string>
  ) => Promise<boolean>;
}

const ToolCredentialForm: React.FC<ToolCredentialFormProps> = ({ 
  tool, 
  onSave 
}) => {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const handleInputChange = (id: string, value: string) => {
    setCredentials((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSave = async () => {
    // Check that all required fields are filled
    const missingFields = tool.credentials
      .map(cred => cred.id)
      .filter(id => !credentials[id]);

    if (missingFields.length > 0) {
      toast({
        title: "Missing credentials",
        description: `Please fill in all required fields: ${missingFields.join(", ")}`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsSaving(true);
    try {
      const success = await onSave(tool.toolName, tool.serverId, credentials);
      
      if (success) {
        toast({
          title: "Credentials saved",
          description: `Credentials for ${tool.toolName} have been saved`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error("Failed to save credentials");
      }
    } catch (error) {
      toast({
        title: "Error saving credentials",
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box 
      p={4} 
      mb={4} 
      borderRadius="md" 
      borderLeft="3px solid" 
      borderLeftColor="crimson.500"
      bg="rgba(0, 0, 0, 0.2)"
    >
      <Heading size="sm" mb={2}>
        {tool.toolName}
      </Heading>
      <Text fontSize="sm" color="gray.400" mb={3}>
        Server: {tool.serverName}
      </Text>

      <VStack spacing={3} align="stretch">
        {tool.credentials.map((cred) => (
          <FormControl key={cred.id} isRequired>
            <FormLabel>{cred.name || cred.id}</FormLabel>
            <InputGroup>
              <Input
                type={showPasswords[cred.id] ? "text" : "password"}
                value={credentials[cred.id] || ""}
                onChange={(e) => handleInputChange(cred.id, e.target.value)}
                placeholder={`Enter ${cred.name || cred.id}`}
              />
              <InputRightElement>
                <IconButton
                  aria-label={
                    showPasswords[cred.id] ? "Hide credential" : "Show credential"
                  }
                  icon={showPasswords[cred.id] ? <FaEyeSlash /> : <FaEye />}
                  size="sm"
                  variant="ghost"
                  onClick={() => togglePasswordVisibility(cred.id)}
                />
              </InputRightElement>
            </InputGroup>
            {cred.description && (
              <FormHelperText>{cred.description}</FormHelperText>
            )}
          </FormControl>
        ))}

        {tool.credentials.some(cred => cred.acquisition?.url) && (
          <Box mt={2} mb={3}>
            <Text fontSize="sm" fontWeight="bold">
              Where to get credentials:
            </Text>
            {tool.credentials
              .filter(cred => cred.acquisition?.url)
              .map(cred => (
                <Flex key={`acq-${cred.id}`} mt={1} alignItems="center">
                  <Link 
                    href={cred.acquisition?.url}
                    isExternal
                    color="crimson.400"
                    fontSize="sm"
                    mr={1}
                  >
                    {cred.name} credentials
                  </Link>
                  <FaExternalLinkAlt size="0.6em" color="gray" />
                </Flex>
              ))}
          </Box>
        )}

        <Button 
          colorScheme="crimson" 
          onClick={handleSave}
          isLoading={isSaving}
        >
          Save Credentials
        </Button>
      </VStack>
    </Box>
  );
};

// New component for displaying a registry server card
interface ServerCardProps {
  server: ServerConfig;
  onAdd: (server: ServerConfig) => void;
  isAlreadyAdded: boolean;
}

const ServerCard: React.FC<ServerCardProps> = ({ server, onAdd, isAlreadyAdded }) => {
  return (
    <Card 
      variant="outline" 
      borderWidth="1px" 
      borderColor="gray.700"
      bg="rgba(0, 0, 0, 0.2)"
      mb={4}
    >
      <CardHeader pb={2}>
        <Flex justify="space-between" align="center">
          <Heading size="sm" color="white">{server.name}</Heading>
          {server.verified && (
            <Badge colorScheme="green" variant="solid" fontSize="0.7em">
              Verified
            </Badge>
          )}
        </Flex>
      </CardHeader>
      
      <CardBody pt={0} pb={2}>
        <Text fontSize="sm" mb={2} color="gray.300">
          {server.description || "No description provided"}
        </Text>
        
        <HStack spacing={2} mb={2} wrap="wrap">
          {server.types?.map((type: string, index: number) => (
            <Badge key={`type-${index}`} colorScheme="blue" variant="subtle">
              {type}
            </Badge>
          ))}
          {server.tags?.map((tag: string, index: number) => (
            <Badge key={`tag-${index}`} colorScheme="purple" variant="subtle">
              {tag}
            </Badge>
          ))}
        </HStack>
        
        {server.rating && (
          <Text fontSize="sm" color="yellow.400">
            Rating: {server.rating.toFixed(1)}/5.0
          </Text>
        )}
      </CardBody>
      
      <CardFooter pt={1}>
        <Button
          size="sm"
          colorScheme={isAlreadyAdded ? "gray" : "crimson"}
          onClick={() => onAdd(server)}
          isDisabled={isAlreadyAdded}
          width="full"
        >
          {isAlreadyAdded ? "Already Added" : "Add Server"}
        </Button>
      </CardFooter>
    </Card>
  );
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [tempApiKey, setTempApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [newServer, setNewServer] = useState<ServerConfig>({
    id: "",
    name: "",
    url: "",
  });
  const [toolsWithCredentials, setToolsWithCredentials] = useState<ToolCredentialInfo[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountCount = useRef<number>(0);
  
  const [registryServers, setRegistryServers] = useState<ServerConfig[]>([]);
  const [isLoadingRegistry, setIsLoadingRegistry] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const {
    apiKey,
    setApiKey,
    nandaServers,
    registerNandaServer,
    removeNandaServer,
    refreshRegistry,
    getToolsWithCredentialRequirements,
    setToolCredentials: saveToolCredentials,
  } = useSettingsContext();
  
  const toast = useToast();
  
  // Increment mount count on component mount
  useEffect(() => {
    mountCount.current += 1;
    console.log(`Settings modal mounted ${mountCount.current} times`);
    
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  // Reset temp values when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempApiKey(apiKey || "");
      setShowApiKey(false);
      loadToolsWithCredentials();
    } else {
      // Cancel loading and clear timer if modal closes
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setIsLoadingTools(false);
    }
  }, [isOpen, apiKey]);

  // Reload tools when servers change
  useEffect(() => {
    if (isOpen && nandaServers.length > 0) {
      // Reset load attempts when server list changes
      setLoadAttempts(0);
      loadToolsWithCredentials();
    }
  }, [nandaServers, isOpen]);

  // Add debug info to assist with troubleshooting
  const debugToolCredentials = () => {
    if (toolsWithCredentials.length > 0) {
      const serverIds = Array.from(new Set(toolsWithCredentials.map(tool => tool.serverId)));
      console.log(`Found tools from ${serverIds.length} servers:`, serverIds);
      
      serverIds.forEach(serverId => {
        const serverTools = toolsWithCredentials.filter(tool => tool.serverId === serverId);
        console.log(`Server ${serverId} has ${serverTools.length} tools:`, 
          serverTools.map(t => t.toolName));
      });
    } else {
      console.log("No tools with credentials found");
    }
  };

  const loadToolsWithCredentials = async () => {
    // Re-enabled credential functionality now that backend is fixed
    // Clear any pending retries
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    
    // Avoid redundant requests when already loading
    if (isLoadingTools) {
      console.log("Already loading tools, skipping duplicate request");
      return;
    }
    
    setIsLoadingTools(true);
    
    try {
      console.log("Fetching tools with credential requirements...");
      const tools = await getToolsWithCredentialRequirements();
      
      if (tools.length > 0) {
        console.log("Found tools with credentials:", tools);
      setToolsWithCredentials(tools);
        // Debug information to help troubleshoot
        setTimeout(debugToolCredentials, 100);
        setLoadAttempts(0); // Reset load attempts on success
        setIsLoadingTools(false);
      } else if (loadAttempts < 2 && nandaServers.length > 0) { // Reduced from 3 to 2 attempts
        // If no tools found but servers exist, try again after delay - but only once
        console.log(`No tools found on attempt ${loadAttempts + 1}, retrying...`);
        setLoadAttempts(prev => prev + 1);
        
        // Use reference to store timeout ID
        retryTimerRef.current = setTimeout(() => {
          // Don't recursively call the function - this creates multiple connections
          // Instead, just reset the loading state and increment the attempt counter
          setIsLoadingTools(false);
          // Only schedule another attempt if we haven't mounted too many times
          if (mountCount.current < 3) {
            console.log(`Scheduling retry attempt ${loadAttempts + 1}`);
            loadToolsWithCredentials();
          } else {
            console.log("Too many mount attempts, abandoning tool loading");
          }
        }, 5000); // Increased from 2000ms to 5000ms to reduce frequency
      } else {
        // If max attempts reached or no servers, just set empty array
        console.log("Max retry attempts reached or no servers configured");
        setToolsWithCredentials([]);
        setIsLoadingTools(false);
      }
    } catch (error) {
      console.error("Failed to load tools with credential requirements:", error);
      toast({
        title: "Error",
        description: "Failed to load tools that require credentials",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      setToolsWithCredentials([]);
      setIsLoadingTools(false);
    }

    // Safety mechanism: ensure loading state is reset after 10 seconds at most
    setTimeout(() => {
      if (isLoadingTools) {
        console.log("Safety timeout triggered - forcing loading state to false");
        setIsLoadingTools(false);
      }
    }, 10000);
  };

  const handleSaveApiKey = () => {
    setApiKey(tempApiKey);
    toast({
      title: "API Key Saved",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };

  const toggleShowApiKey = () => {
    setShowApiKey(!showApiKey);
  };

  const handleAddServer = async () => {
    // Validate server info
    if (!newServer.id || !newServer.name || !newServer.url) {
      toast({
        title: "Validation Error",
        description: "All server fields are required",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Validate URL format
  try {
    new URL(newServer.url);
  } catch (error) {
    toast({
      title: "Invalid URL",
      description:
        "Please enter a valid URL (e.g., http://localhost:3001/sse)",
      status: "error",
      duration: 3000,
      isClosable: true,
      position: "top",
    });
    return;
  }

    // 🌐 Send request to backend to actually register the server
  try {
    const res = await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: newServer.id,
        name: newServer.name,
        url: newServer.url,
      }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      // Register new server 
      registerNandaServer({
        id: newServer.id,
        name: newServer.name,
        url: newServer.url,
      });

      setNewServer({ id: "", name: "", url: "" });

      toast({
        title: "Server Added",
        description: `Server "${newServer.name}" was successfully registered.`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } else {
      // Backend responded with failure
      toast({
        title: "Server Registration Failed",
        description: data.message || "Failed to register server.",
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
    }
  } catch (error) {
    console.error("Error adding server:", error);
    toast({
      title: "Network Error",
      description: "Could not connect to server. Check the URL.",
      status: "error",
      duration: 4000,
      isClosable: true,
    });
  }
};

  // Handle removing a server
  const handleRemoveServer = (serverId: string) => {
    // Remove the server using the context function
    removeNandaServer(serverId);
    
    // Show success message
    toast({
      title: "Server Removed",
      description: "The server has been removed successfully",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    
    // Optionally, refresh tools to update credentials UI
    loadToolsWithCredentials();
  };

  // Add a function to load registry servers
  const loadRegistryServers = async () => {
    setIsLoadingRegistry(true);
    try {
      // If there's a search query, pass it to refreshRegistry
      const result = await refreshRegistry(searchQuery);
      if (result && result.servers) {
        setRegistryServers(result.servers);
        
        // Only show green success notification for popular servers (not for search)
        if (!searchQuery) {
          toast({
            title: "Registry servers loaded",
            description: result.message || `Found ${result.servers.length} servers in the registry`,
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        } else {
          // For search results, just update UI without success toast
          console.log(`Found ${result.servers.length} servers matching "${searchQuery}"`);
        }
      }
    } catch (error) {
      toast({
        title: "Error loading registry servers",
        description: error instanceof Error ? error.message : "Failed to load registry servers",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoadingRegistry(false);
    }
  };

  // Debounced search handler
  const debouncedSearchHandler = useCallback(
    debounce(() => {
      if (searchQuery && searchQuery.length >= 2) {
        loadRegistryServers();
      }
    }, 500),
    [searchQuery]
  );

  // Effect to trigger search when query changes
  useEffect(() => {
    if (searchQuery && searchQuery.length >= 2) {
      debouncedSearchHandler();
    }
  }, [searchQuery, debouncedSearchHandler]);

  // Check if a server is already added
  const isServerAdded = (serverId: string) => {
    return nandaServers.some(server => server.id === serverId);
  };

  // Add server from registry
  const handleAddRegistryServer = (server: ServerConfig) => {
    if (isServerAdded(server.id)) return;
    
    // Make sure the URL has /sse at the end if not already
    let url = server.url;
    if (!url.endsWith("/sse")) {
      url = url.endsWith("/") ? `${url}sse` : `${url}/sse`;
    }
    
    const serverToAdd = {
      ...server,
      url
    };
    
    registerNandaServer(serverToAdd);
    
    toast({
      title: "Server added",
      description: `${server.name} has been added to your servers`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };

  // Filter registry servers based on search query
  const filteredRegistryServers = registryServers.filter(server => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      server.name.toLowerCase().includes(query) ||
      server.description?.toLowerCase().includes(query) ||
      server.tags?.some((tag: string) => tag.toLowerCase().includes(query)) ||
      server.types?.some((type: string) => type.toLowerCase().includes(query))
    );
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay backdropFilter="blur(15px)" bg="rgba(0, 0, 0, 0.6)" />
      <ModalContent 
        bg="linear-gradient(135deg, var(--chakra-colors-dark-200) 0%, var(--chakra-colors-dark-300) 100%)" 
        borderRadius="xl" 
        borderColor="rgba(255, 255, 255, 0.08)"
        borderWidth="1px"
        boxShadow="0 20px 50px rgba(0, 0, 0, 0.4)"
      >
        <ModalHeader 
          borderBottomWidth="1px" 
          borderColor="rgba(255, 255, 255, 0.08)" 
          pb={4}
          fontWeight="600"
          color="white"
        >
          Settings
        </ModalHeader>

        <ModalCloseButton color="whiteAlpha.700" _hover={{ color: "white", bg: "rgba(255, 255, 255, 0.1)" }} />
        
        <ModalBody>
          <Tabs 
            variant="soft-rounded" 
            colorScheme="primary" 
            isLazy
          >
            <TabList mb={4}>
              <Tab 
                _selected={{ 
                  bg: "primary.500", 
                  color: "white",
                  fontWeight: "semibold",
                  boxShadow: "0 4px 10px rgba(90, 26, 255, 0.3)",
                }}
                fontWeight="medium"
                px={4}
                py={2}
                color="whiteAlpha.800"
                _hover={{ color: "white" }}
              >
                API
              </Tab>
              <Tab
                _selected={{ 
                  bg: "primary.500", 
                  color: "white",
                  fontWeight: "semibold",
                  boxShadow: "0 4px 10px rgba(90, 26, 255, 0.3)",
                }}
                fontWeight="medium"
                px={4}
                py={2}
                color="whiteAlpha.800"
                _hover={{ color: "white" }}
              >
                Added Servers
              </Tab>
              <Tab
                _selected={{ 
                  bg: "primary.500", 
                  color: "white",
                  fontWeight: "semibold",
                  boxShadow: "0 4px 10px rgba(90, 26, 255, 0.3)",
                }}
                fontWeight="medium"
                px={4}
                py={2}
                color="whiteAlpha.800"
                _hover={{ color: "white" }}
              >
                Tool Credentials
              </Tab>
              <Tab
                _selected={{ 
                  bg: "primary.500", 
                  color: "white",
                  fontWeight: "semibold",
                  boxShadow: "0 4px 10px rgba(90, 26, 255, 0.3)",
                }}
                fontWeight="medium"
                px={4}
                py={2}
                color="whiteAlpha.800"
                _hover={{ color: "white" }}
              >
                Registry
              </Tab>
              <Tab
                _selected={{ 
                  bg: "primary.500", 
                  color: "white",
                  fontWeight: "semibold",
                  boxShadow: "0 4px 10px rgba(90, 26, 255, 0.3)",
                }}
                fontWeight="medium"
                px={4}
                py={2}
                color="whiteAlpha.800"
                _hover={{ color: "white" }}
              >
                About
              </Tab>
            </TabList>

            <TabPanels>
              {/* API Settings Tab */}
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <FormControl isRequired>
                    <FormLabel color="whiteAlpha.800">Anthropic API Key</FormLabel>
                    <InputGroup>
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={tempApiKey}
                        onChange={(e) => setTempApiKey(e.target.value)}
                        placeholder="sk-ant-api03-..."
                        autoComplete="off"
                        variant="filled"
                        bg="rgba(0, 0, 0, 0.2)"
                        borderColor="rgba(255, 255, 255, 0.1)"
                        _hover={{
                          borderColor: "primary.400",
                        }}
                        _focus={{
                          borderColor: "primary.500",
                          bg: "rgba(0, 0, 0, 0.3)",
                        }}
                      />
                      <InputRightElement>
                        <IconButton
                          aria-label={
                            showApiKey ? "Hide API Key" : "Show API Key"
                          }
                          icon={showApiKey ? <FaEyeSlash /> : <FaEye />}
                          size="sm"
                          variant="ghost"
                          onClick={toggleShowApiKey}
                          color="whiteAlpha.700"
                          _hover={{ color: "white", bg: "rgba(255, 255, 255, 0.1)" }}
                        />
                      </InputRightElement>
                    </InputGroup>
                    <FormHelperText color="whiteAlpha.600">
                      You can get your API key from the{" "}
                      <Link
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        color="primary.300"
                        textDecoration="underline"
                        _hover={{ color: "primary.200" }}
                      >
                        Anthropic Console
                      </Link>
                    </FormHelperText>
                  </FormControl>

                  <Button 
                    colorScheme="primary" 
                    onClick={handleSaveApiKey}
                    boxShadow="0 4px 10px rgba(90, 26, 255, 0.3)"
                    _hover={{
                      transform: "translateY(-2px)",
                      boxShadow: "0 6px 15px rgba(90, 26, 255, 0.4)",
                    }}
                    transition="all 0.2s"
                  >
                    Save API Key
                  </Button>
                </VStack>
              </TabPanel>

              {/* Added Servers Tab */}
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Heading size="sm" mb={3} color="whiteAlpha.900">
                      Registered Added Servers
                    </Heading>
                    {nandaServers.length === 0 ? (
                      <Text color="whiteAlpha.600">No servers registered yet</Text>
                    ) : (
                      nandaServers.map((server) => (
                        <Box
                          key={server.id}
                          p={3}
                          mb={3}
                          borderRadius="lg"
                          borderLeft="3px solid"
                          borderLeftColor="primary.500"
                          bg="rgba(0, 0, 0, 0.2)"
                          boxShadow="0 2px 6px rgba(0, 0, 0, 0.2)"
                          _hover={{
                            bg: "rgba(0, 0, 0, 0.25)",
                          }}
                          transition="all 0.2s"
                        >
                          <Flex justify="space-between">
                            <Box>
                              <Text fontWeight="bold" color="white">{server.name}</Text>
                              <Text fontSize="sm" color="whiteAlpha.700">
                            ID: {server.id}
                          </Text>
                              <Text fontSize="sm" color="whiteAlpha.700">
                            URL: {server.url}
                          </Text>
                            </Box>
                            <IconButton
                              aria-label="Remove server"
                              icon={<FaTrash />}
                              size="sm"
                              colorScheme="red"
                              variant="ghost"
                              onClick={() => handleRemoveServer(server.id)}
                            />
                          </Flex>
                        </Box>
                      ))
                    )}
                  </Box>

                  <Divider borderColor="whiteAlpha.200" my={2} />

                  <Box>
                    <Heading size="sm" mb={3} color="whiteAlpha.900">
                      Add New Server
                    </Heading>

                    <VStack spacing={3} align="stretch">
                      <FormControl isRequired>
                        <FormLabel color="whiteAlpha.800">Server ID</FormLabel>
                        <Input
                          value={newServer.id}
                          onChange={(e) =>
                            setNewServer({ ...newServer, id: e.target.value })
                          }
                          placeholder="weather"
                        />
                        <FormHelperText>
                          A unique identifier for this server
                        </FormHelperText>
                      </FormControl>

                      <FormControl isRequired>
                        <FormLabel>Server Name</FormLabel>
                        <Input
                          value={newServer.name}
                          onChange={(e) =>
                            setNewServer({ ...newServer, name: e.target.value })
                          }
                          placeholder="Weather Server"
                        />
                        <FormHelperText>
                          A friendly name for this server
                        </FormHelperText>
                      </FormControl>

                      <FormControl isRequired>
                        <FormLabel>Server URL</FormLabel>
                        <Input
                          value={newServer.url}
                          onChange={(e) =>
                            setNewServer({ ...newServer, url: e.target.value })
                          }
                          placeholder="http://localhost:3001/sse"
                        />
                        <FormHelperText>
                          The SSE endpoint URL of the Nanda server
                        </FormHelperText>
                      </FormControl>

                      <Button
                        leftIcon={<FaPlus />}
                        colorScheme="crimson"
                        onClick={handleAddServer}
                      >
                        Add Server
                      </Button>
                    </VStack>
                  </Box>
                </VStack>
              </TabPanel>

              {/* Tool Credentials Tab */}
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Flex justify="space-between" align="center">
                  <Heading size="sm" mb={2}>
                    Tool API Credentials
                  </Heading>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      leftIcon={<FaSync />} 
                      onClick={loadToolsWithCredentials}
                      isLoading={isLoadingTools}
                    >
                      Refresh
                    </Button>
                  </Flex>
                  <Text fontSize="sm" color="gray.400" mb={4}>
                    Some tools require API keys or other credentials to function. 
                    Configure them here.
                  </Text>
                  
                  {isLoadingTools ? (
                    <Center py={10}>
                      <VStack spacing={4}>
                        <Spinner
                          thickness="4px"
                          speed="0.65s"
                          emptyColor="gray.700"
                          color="primary.500"
                          size="xl"
                        />
                    <Text color="gray.400">
                          {loadAttempts > 0 
                            ? `Loading tools (attempt ${loadAttempts+1}/4)...` 
                            : "Loading tools..."}
                    </Text>
                      </VStack>
                    </Center>
                  ) : toolsWithCredentials.length === 0 ? (
                    <Alert
                      status="info"
                      variant="subtle"
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      textAlign="center"
                              borderRadius="md"
                      bg="rgba(0, 0, 0, 0.2)"
                      borderWidth="1px"
                      borderColor="blue.800"
                    >
                      <AlertIcon boxSize="40px" mr={0} color="blue.300" />
                      <AlertTitle mt={4} mb={1} fontSize="lg">
                        No tools found
                      </AlertTitle>
                      <AlertDescription maxWidth="sm">
                        {nandaServers.length === 0 ? (
                          <>
                            You need to register a Nanda server before tools will appear.
                            Go to the "Added Servers" tab to add a server.
                          </>
                        ) : (
                          <>
                            No tools requiring credentials were found.
                            Try refreshing or check your server configuration.
                          </>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      {/* Group tools by server for better organization */}
                      {(() => {
                        // Create a map of serverId -> tools
                        const serverMap: Record<string, ToolCredentialInfo[]> = {};
                        
                        // Group tools by server
                        toolsWithCredentials.forEach(tool => {
                          if (!serverMap[tool.serverId]) {
                            serverMap[tool.serverId] = [];
                          }
                          serverMap[tool.serverId].push(tool);
                        });
                        
                        // Render each server group
                        return Object.entries(serverMap).map(([serverId, serverTools]) => {
                          const serverName = serverTools[0]?.serverName || serverId;
                          
                          return (
                            <Box key={serverId} mb={6}>
                              <Heading size="xs" color="primary.300" mb={3} p={2} bg="rgba(0,0,0,0.2)" borderRadius="md">
                                Server: {serverName}
                              </Heading>
                              <VStack spacing={4} align="stretch">
                                {serverTools.map((tool) => (
                            <ToolCredentialForm
                                    key={`${tool.serverId}-${tool.toolName}`}
                              tool={tool}
                                    onSave={saveToolCredentials}
                                  />
                                ))}
                              </VStack>
                            </Box>
                          );
                        });
                      })()}
                    </>
                  )}
                </VStack>
              </TabPanel>

              {/* Registry Tab Panel */}
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="sm">Global Nanda Registry</Heading>
                    <Button
                      leftIcon={<FaSync />}
                      colorScheme="primary"
                      size="sm"
                      onClick={loadRegistryServers}
                      isLoading={isLoadingRegistry}
                    >
                      Refresh Servers
                    </Button>
                  </Flex>
                  
                  <Text fontSize="sm" color="gray.400" mb={2}>
                    Browse and add servers from the global Nanda Registry.
                    Added servers will be stored locally in your browser.
                  </Text>
                  
                  {/* Search input */}
                  <InputGroup mb={4}>
                    <InputLeftElement pointerEvents="none">
                      <FaSearch color="gray.300" />
                    </InputLeftElement>
                    <Input
                      placeholder="Search servers by name, description, tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </InputGroup>
                  
                  {isLoadingRegistry ? (
                    <Center py={10}>
                      <VStack spacing={4}>
                        <Spinner
                          thickness="4px"
                          speed="0.65s"
                          emptyColor="gray.700"
                          color="primary.500"
                          size="xl"
                        />
                        <Text color="gray.400">
                          Loading servers from registry...
                        </Text>
                      </VStack>
                    </Center>
                  ) : registryServers.length === 0 ? (
                    <Box textAlign="center" py={10}>
                      <Text color="gray.400" mb={4}>
                        No servers loaded from the registry yet.
                      </Text>
                      <Button
                        colorScheme="primary"
                        onClick={loadRegistryServers}
                      >
                        Load Registry Servers
                      </Button>
                    </Box>
                  ) : filteredRegistryServers.length === 0 ? (
                    <Alert
                      status="info"
                      variant="subtle"
                      borderRadius="md"
                      bg="rgba(0, 0, 0, 0.2)"
                      borderWidth="1px"
                      borderColor="blue.800"
                    >
                      <AlertIcon />
                      <AlertTitle>No matches found</AlertTitle>
                      <AlertDescription>
                        No servers match your search query. Try a different search.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      {filteredRegistryServers.map((server: ServerConfig) => (
                        <ServerCard
                          key={server.id}
                          server={server}
                          onAdd={handleAddRegistryServer}
                          isAlreadyAdded={isServerAdded(server.id)}
                        />
                      ))}
                    </SimpleGrid>
                  )}
                </VStack>
              </TabPanel>

              {/* About Tab */}
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Heading size="md">Nanda Host</Heading>
                  <Text>
                    A beautiful chat interface with Nanda integration for
                    enhanced capabilities through agents, resources, and tools.
                  </Text>

                  <Box p={3} borderRadius="md" bg="rgba(0, 0, 0, 0.2)">
                    <Heading size="sm" mb={2}>
                      What is Nanda?
                    </Heading>
                    <Text fontSize="sm">
                      Nanda is an open standard built on top of MCP for enabling
                      coordination between agents, resources and tools (ARTs).
                      It enables LLMs to discover and execute tools, access
                      resources, and use predefined prompts.
                    </Text>
                  </Box>

                  <Divider />

                  <Text fontSize="sm" color="gray.400">
                    Version 1.0.0 • MIT License
                  </Text>
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SettingsModal;
