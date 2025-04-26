// client/src/components/MessageInput.tsx
import React, { useState, useRef } from "react";
import { 
  Flex, 
  Textarea, 
  Button, 
  Icon, 
  useToast, 
  Box,
  Tooltip
} from "@chakra-ui/react";
import { FaPaperPlane, FaSpinner, FaMicrophone } from "react-icons/fa";
import { useChatContext } from "../contexts/ChatContext";
import { useSettingsContext } from "../contexts/SettingsContext";

const MessageInput: React.FC = () => {
  const [message, setMessage] = useState("");
  const { sendMessage, isLoading } = useChatContext();
  const { apiKey } = useSettingsContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const handleSubmit = () => {
    if (!message.trim()) return;

    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "Please set your Anthropic API key in the settings.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top",
        variant: "solid",
      });
      return;
    }

    sendMessage(message);
    setMessage("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto resize
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  return (
    <Flex position="relative">
      <Box
        position="absolute"
        top="-40px"
        left="0"
        right="0"
        height="40px"
        pointerEvents="none"
        bgGradient="linear(to-t, rgba(26, 27, 38, 1), rgba(26, 27, 38, 0))"
        zIndex="1"
      />
      <Textarea
        ref={textareaRef}
        value={message}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        resize="none"
        rows={1}
        mr={2}
        flexGrow={1}
        disabled={isLoading}
        maxLength={3000}
        bg="rgba(255, 255, 255, 0.05)"
        borderColor="rgba(255, 255, 255, 0.1)"
        borderRadius="xl"
        _hover={{
          borderColor: "primary.400",
        }}
        _focus={{
          borderColor: "primary.500",
          boxShadow: "0 0 0 1px var(--chakra-colors-primary-500)",
        }}
        p={3}
        minH="50px"
        sx={{
          "&::-webkit-scrollbar": {
            width: "6px",
            borderRadius: "3px",
          },
          "&::-webkit-scrollbar-track": {
            backgroundColor: `rgba(255, 255, 255, 0.05)`,
            borderRadius: "3px",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: `rgba(255, 255, 255, 0.1)`,
            borderRadius: "3px",
            "&:hover": {
              backgroundColor: `rgba(255, 255, 255, 0.15)`,
            },
          },
        }}
      />
      <Flex direction="column" justify="flex-end">
        <Tooltip label="Send message" placement="top" hasArrow>
          <Button
            colorScheme="primary"
            onClick={handleSubmit}
            isDisabled={!message.trim() || isLoading}
            height="50px"
            width="50px"
            alignSelf="flex-end"
            borderRadius="xl"
            p={0}
            bg="primary.500"
            _hover={{
              bg: "primary.600",
            }}
            boxShadow="0 4px 10px rgba(90, 26, 255, 0.3)"
          >
            {isLoading ? (
              <Icon as={FaSpinner} className="spin" animation="spin 1s linear infinite" />
            ) : (
              <Icon as={FaPaperPlane} />
            )}
            <style>
              {`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}
            </style>
          </Button>
        </Tooltip>
      </Flex>
    </Flex>
  );
};

export default MessageInput;
