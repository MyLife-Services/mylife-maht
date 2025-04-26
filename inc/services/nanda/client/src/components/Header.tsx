// client/src/components/Header.tsx
import React from "react";
import { Box, Flex, IconButton, Heading, Icon, Image } from "@chakra-ui/react";
import { FaCog, FaCode, FaNetworkWired } from "react-icons/fa";

interface HeaderProps {
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  return (
    <Flex
      as="header"
      width="100%"
      justifyContent="space-between"
      alignItems="center"
      py={3}
      px={6}
      bg="rgba(0, 0, 0, 0.2)"
      backdropFilter="blur(10px)"
      borderBottom="1px solid rgba(255, 255, 255, 0.05)"
      position="relative"
      zIndex={2}
      boxShadow="0 1px 10px rgba(0, 0, 0, 0.2)"
    >
      <Flex alignItems="center">
        <Icon 
          as={FaNetworkWired}
          boxSize="40px"
          color="#ff4d4d"
          mr={3}
        />
        <Heading 
          size="lg" 
          fontWeight="700"
          bgGradient="linear(to-r, #ff4d4d, #ff9966)"
          bgClip="text"
          letterSpacing="tight"
          lineHeight="40px"
          display="inline-flex"
          alignItems="center"
          textShadow="0 0 10px rgba(255, 77, 77, 0.3)"
          transform="translateY(6px)"
          mt="-4px"
          pb="6px"
        >
          NANDA Host
        </Heading>
      </Flex>
      <IconButton
        aria-label="Settings"
        icon={<FaCog />}
        onClick={onOpenSettings}
        variant="ghost"
        size="md"
        color="whiteAlpha.800"
        _hover={{
          bg: "rgba(255, 255, 255, 0.1)",
          transform: "rotate(30deg)",
        }}
        transition="all 0.3s ease"
      />
    </Flex>
  );
};

export default Header;
