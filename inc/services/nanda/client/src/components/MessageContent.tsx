// client/src/components/MessageContent.tsx
import React from "react";
import {
  Box,
  Text,
  Code,
  Image,
  Flex,
  Icon,
  Divider,
} from "@chakra-ui/react";
import { FaTools, FaCode, FaImage, FaInfoCircle } from "react-icons/fa";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MessageContentProps {
  content: any;
}

const MessageContent: React.FC<MessageContentProps> = ({ content }) => {
  // Debug log to help identify unhandled content types
  console.log("MessageContent received:", content);
  
  // If content is null or undefined, show a placeholder
  if (content == null) {
    return <Text color="whiteAlpha.700">No content available</Text>;
  }
  
  // If content is already a string, return it wrapped in a Text component
  if (typeof content === "string") {
    return <Text whiteSpace="pre-wrap">{content}</Text>;
  }

  // If content has a "text" property, return it wrapped in a Text component
  if (content && typeof content.text === "string") {
    return <Text whiteSpace="pre-wrap">{content.text}</Text>;
  }
  
  // Handle Claude's response format with type property at the top level
  if (content && content.type === "text" && typeof content.text === "string") {
    return <Text whiteSpace="pre-wrap">{content.text}</Text>;
  }

  // If content is an array, map through and display each item
  if (Array.isArray(content)) {
    // If it's an empty array, show a placeholder
    if (content.length === 0) {
      return <Text color="whiteAlpha.700">No content available</Text>;
    }
    
    return (
      <Box>
        {content.map((item, index) => {
          // Handle string items
          if (typeof item === "string") {
            return <Text key={index} whiteSpace="pre-wrap">{item}</Text>;
          } 
          
          // Handle null or undefined items
          if (item == null) {
            return null;
          }
          
          // Handle object items
          if (typeof item === "object") {
            // Handle text type
            if (item.type === "text" && item.text) {
              return <Text key={index} whiteSpace="pre-wrap">{item.text}</Text>;
            } 
            // Handle code type
            else if (item.type === "code" && item.code) {
              return (
                <Box
                  key={index}
                  mt={2}
                  mb={2}
                  borderRadius="md"
                  overflow="hidden"
                  boxShadow="0 3px 10px rgba(0, 0, 0, 0.2)"
                >
                  <Flex 
                    bg="rgba(0, 0, 0, 0.6)" 
                    p={2} 
                    pl={3}
                    alignItems="center"
                    borderBottom="1px solid rgba(255, 255, 255, 0.1)"
                  >
                    <Icon as={FaCode} size="sm" color="primary.300" mr={2} />
                    <Text fontWeight="medium" fontSize="sm" color="whiteAlpha.800">
                      {item.language || "Code"}
                    </Text>
                  </Flex>
                  <SyntaxHighlighter
                    language={item.language || "text"}
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: "1rem",
                      borderRadius: "0 0 0.375rem 0.375rem",
                      fontSize: "0.8rem",
                      backgroundColor: "#0d1117",
                    }}
                  >
                    {item.code}
                  </SyntaxHighlighter>
                </Box>
              );
            }
            
            // For any object with text property but no type
            else if (typeof item.text === 'string') {
              return <Text key={index} whiteSpace="pre-wrap">{item.text}</Text>;
            }
            
            // For any other object, convert to string if possible
            else if (item.toString && item.toString() !== '[object Object]') {
              return <Text key={index} whiteSpace="pre-wrap">{item.toString()}</Text>;
            }
            
            // For remaining objects, show as JSON
            else {
              return (
                <Box
                  key={index}
                  p={2}
                  mt={1}
                  mb={1}
                  fontSize="sm"
                  bg="rgba(0, 0, 0, 0.2)"
                  borderRadius="md"
                  whiteSpace="pre-wrap"
                  fontFamily="monospace"
                >
                  {JSON.stringify(item, null, 2)}
                </Box>
              );
            }
          }
          
          // For primitive values (number, boolean)
          return <Text key={index}>{String(item)}</Text>;
        })}
      </Box>
    );
  }

  // Handle the Claude response format directly - if content has a role and content properties
  if (content && content.role && content.content) {
    // The content field could be an array or an object
    return <MessageContent content={content.content} />;
  }

  // If we got here, it's an object that didn't match our known patterns
  // Show it as JSON for debugging
  return (
    <Box p={3} bg="rgba(0, 0, 0, 0.2)" borderRadius="md" mt={2}>
      <Text color="whiteAlpha.700" fontStyle="italic" mb={2}>
        Content received in unknown format
      </Text>
      <Box
        as="pre"
        p={2}
        fontSize="xs"
        bg="rgba(0, 0, 0, 0.3)"
        borderRadius="md"
        overflowX="auto"
        color="whiteAlpha.800"
      >
        {JSON.stringify(content, null, 2)}
      </Box>
    </Box>
  );
};

export default MessageContent;
