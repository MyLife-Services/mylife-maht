// client/src/App.tsx
import React, { useState } from "react";
import { ChakraProvider, Box, Flex } from "@chakra-ui/react";
import { theme } from "./theme";
import { ChatProvider } from "./contexts/ChatContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import ChatInterface from "./components/ChatInterface";
import SettingsModal from "./components/SettingsModal";
import Header from "./components/Header";

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  return (
    <ChakraProvider theme={theme}>
      <SettingsProvider>
        <ChatProvider>
          <Box
            minH="100vh"
            bgGradient="linear(to-b, #16161e, #1e1e2f)"
            bgImage="radial-gradient(circle at 10% 20%, rgba(90, 26, 255, 0.1) 0%, transparent 20%), radial-gradient(circle at 90% 80%, rgba(0, 201, 255, 0.1) 0%, transparent 20%)"
            bgSize="cover"
            bgPosition="center"
            bgRepeat="no-repeat"
            display="flex"
            flexDirection="column"
            position="relative"
            overflow="hidden"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              bg: "linear-gradient(180deg, rgba(22, 22, 30, 0.5) 0%, rgba(26, 27, 38, 0.2) 100%)",
              zIndex: 0,
            }}
          >
            <Header onOpenSettings={handleOpenSettings} />

            <Flex
              flex="1"
              direction="column"
              align="center"
              justify="center"
              p={4}
              position="relative"
              zIndex={1}
            >
              <ChatInterface />
            </Flex>

            <SettingsModal
              isOpen={isSettingsOpen}
              onClose={handleCloseSettings}
            />
          </Box>
        </ChatProvider>
      </SettingsProvider>
    </ChakraProvider>
  );
}

export default App;
