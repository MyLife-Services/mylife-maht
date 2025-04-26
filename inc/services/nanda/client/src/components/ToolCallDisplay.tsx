// client/src/components/ToolCallDisplay.tsx
import React from "react";
import {
  Box,
  Text,
  Icon,
  Flex,
  Badge,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from "@chakra-ui/react";
import { FaTools, FaCheckCircle, FaTimesCircle } from "react-icons/fa";

interface ToolCallProps {
  toolCall: {
    id: string;
    name: string;
    input: any;
    serverId?: string;
    serverName?: string;
    result?: {
      content: any[];
      isError?: boolean;
    };
  };
}

const ToolCallDisplay: React.FC<ToolCallProps> = ({ toolCall }) => {
  const { name, input, result, serverId, serverName } = toolCall;
  const hasResult = !!result;
  const isError = result?.isError;

  return (
    <Box
      mt={2}
      borderRadius="lg"
      overflow="hidden"
    >
      <Accordion allowToggle>
        <AccordionItem 
          border="none"
          bg="rgba(0, 0, 0, 0.2)"
          borderRadius="lg"
          overflow="hidden"
          boxShadow="0 2px 8px rgba(0, 0, 0, 0.15)"
          mb={1}
        >
          <AccordionButton
            p={3}
            _hover={{ bg: "rgba(90, 26, 255, 0.1)" }}
            borderRadius="lg"
          >
            <Flex flex="1" alignItems="center">
              <Flex
                alignItems="center"
                justifyContent="center"
                bg="rgba(90, 26, 255, 0.2)"
                p={2}
                borderRadius="md"
                mr={3}
              >
                <Icon as={FaTools} color="primary.300" />
              </Flex>
              <Box>
                <Flex alignItems="center">
                  <Text fontWeight="bold" mr={2}>
                    Using tool: {name}
                  </Text>
                  {hasResult && (
                    <Badge
                      colorScheme={isError ? "red" : "green"}
                      variant="subtle"
                      borderRadius="full"
                      px={2}
                      display="flex"
                      alignItems="center"
                    >
                      <Icon
                        as={isError ? FaTimesCircle : FaCheckCircle}
                        mr={1}
                        fontSize="xs"
                      />
                      {isError ? "Failed" : "Success"}
                    </Badge>
                  )}
                </Flex>
                {!hasResult && (
                  <Text fontSize="xs" color="whiteAlpha.700">
                    Click to see details
                  </Text>
                )}
              </Box>
            </Flex>
            <AccordionIcon />
          </AccordionButton>

          <AccordionPanel 
            bg="rgba(0, 0, 0, 0.3)" 
            p={4} 
            borderTop="1px solid rgba(255, 255, 255, 0.05)"
          >
            {/* Input */}
            <Box mb={hasResult ? 4 : 0}>
              <Text 
                fontWeight="600" 
                mb={2} 
                fontSize="sm" 
                color="whiteAlpha.800"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                Input Parameters:
              </Text>
              <Box
                as="pre"
                p={3}
                borderRadius="md"
                bg="rgba(0, 0, 0, 0.4)"
                fontSize="xs"
                overflowX="auto"
                fontFamily="monospace"
                border="1px solid rgba(255, 255, 255, 0.05)"
                boxShadow="inset 0 2px 4px rgba(0, 0, 0, 0.2)"
                color="whiteAlpha.800"
              >
                {JSON.stringify(input, null, 2)}
              </Box>
            </Box>

            {/* Result */}
            {hasResult && (
              <Box>
                <Text
                  fontWeight="600"
                  mb={2}
                  fontSize="sm"
                  color="whiteAlpha.800"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  Result:
                </Text>
                <Box
                  p={3}
                  borderRadius="md"
                  bg={isError ? "rgba(220, 38, 38, 0.1)" : "rgba(72, 187, 120, 0.1)"}
                  fontSize="sm"
                  borderLeft="3px solid"
                  borderLeftColor={isError ? "red.500" : "green.400"}
                  position="relative"
                  _before={{
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: "100%",
                    bg: isError ? "rgba(220, 38, 38, 0.03)" : "rgba(72, 187, 120, 0.03)",
                    borderRadius: "md",
                  }}
                >
                  {result.content.map((item, idx) => (
                    <Text 
                      key={idx} 
                      position="relative" 
                      zIndex={1}
                      color={isError ? "red.200" : "green.200"}
                      fontWeight={isError ? "medium" : "normal"}
                    >
                      {item.type === "text" ? item.text : JSON.stringify(item)}
                    </Text>
                  ))}
                </Box>
              </Box>
            )}

            {/* Server info if available */}
            {serverId && serverName && (
              <Box mt={2}>
                <Text 
                  fontWeight="600" 
                  fontSize="xs" 
                  color="whiteAlpha.700"
                >
                  Server: {serverName} ({serverId.substring(0, 8)}...)
                </Text>
              </Box>
            )}
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </Box>
  );
};

export default ToolCallDisplay;
