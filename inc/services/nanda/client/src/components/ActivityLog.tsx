import React from 'react';
import {
  Box,
  VStack,
  Text,
  Heading,
  Flex,
  Icon,
  Badge,
  Divider,
  Collapse,
  Button,
  useDisclosure,
  Tooltip,
} from '@chakra-ui/react';
import { FaServer, FaTools, FaExclamationTriangle, FaInfo, FaAngleDown, FaAngleUp, FaTrash } from 'react-icons/fa';
import { useChatContext } from '../contexts/ChatContext';
import type { LogEntry } from '../contexts/ChatContext';

const getLogIcon = (type: LogEntry['type']) => {
  switch (type) {
    case 'server-selection':
      return FaServer;
    case 'tool-execution':
      return FaTools;
    case 'error':
      return FaExclamationTriangle;
    case 'info':
    default:
      return FaInfo;
  }
};

const getLogColor = (type: LogEntry['type']) => {
  switch (type) {
    case 'server-selection':
      return '#547AA5';
    case 'tool-execution':
      return '#4A6B52';
    case 'error':
      return '#8B3A4A';
    case 'info':
    default:
      return '#7E5A8E';
  }
};

const LogEntryItem: React.FC<{ log: LogEntry }> = ({ log }) => {
  const { isOpen, onToggle } = useDisclosure();
  const colorMap = {
    'server-selection': { icon: '#7EAFD8', bg: '#1A2A3A', border: '#3B5D7D' },
    'tool-execution': { icon: '#6CAC70', bg: '#1A2A20', border: '#3E5A43' },
    'error': { icon: '#BC6C78', bg: '#2A1F24', border: '#8B3A4A' },
    'info': { icon: '#B79EC0', bg: '#25202A', border: '#6C5A78' }
  };
  
  const style = colorMap[log.type] || colorMap.info;
  
  return (
    <Box
      p={3}
      borderRadius="md"
      bg={style.bg}
      borderLeft={`3px solid ${style.border}`}
      mb={2}
      opacity={0.9}
      _hover={{ opacity: 1, bg: `${style.bg}` }}
      transition="all 0.2s"
    >
      <Flex justify="space-between" align="center" onClick={onToggle} cursor="pointer">
        <Flex align="center">
          <Icon as={getLogIcon(log.type)} color={style.icon} mr={2} />
          <Text fontSize="sm" fontWeight="medium">
            {log.message}
          </Text>
        </Flex>
        <Flex align="center">
          <Text fontSize="xs" color="whiteAlpha.700" mr={2}>
            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Text>
          <Icon as={isOpen ? FaAngleUp : FaAngleDown} color={style.icon} />
        </Flex>
      </Flex>
      
      <Collapse in={isOpen} animateOpacity>
        <Box mt={3} fontSize="xs" bg="rgba(0,0,0,0.5)" p={2} borderRadius="sm">
          {log.details && (
            <VStack align="stretch" spacing={1}>
              {Object.entries(log.details).map(([key, value]) => (
                <Flex key={key}>
                  <Text fontWeight="bold" mr={1}>{key}:</Text>
                  <Text overflowX="auto" maxW="100%">
                    {typeof value === 'object' 
                      ? JSON.stringify(value, null, 2)
                      : String(value)
                    }
                  </Text>
                </Flex>
              ))}
            </VStack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

const ActivityLog: React.FC = () => {
  const { activityLogs, clearLogs } = useChatContext();
  const { isOpen, onToggle } = useDisclosure({ defaultIsOpen: true });

  return (
    <Box
      width="100%"
      borderRadius="md"
      overflow="hidden"
      background="linear-gradient(to bottom, rgba(30, 20, 20, 0.9), rgba(20, 15, 15, 0.95))"
      borderColor="#583030"
      borderWidth="1px"
    >
      <Flex 
        p={3} 
        justify="space-between" 
        align="center" 
        borderBottomWidth="1px" 
        borderBottomColor="#583030"
        bg="#2A1F21"
      >
        <Flex align="center" onClick={onToggle} cursor="pointer">
          <Heading size="sm" fontWeight="medium" color="#AA5C5C">
            Activity Log
          </Heading>
          <Badge ml={2} colorScheme="red" bg="#8B3A4A" color="white">
            {activityLogs.length}
          </Badge>
          <Icon ml={2} as={isOpen ? FaAngleUp : FaAngleDown} color="#AA5C5C" />
        </Flex>
        <Tooltip label="Clear logs">
          <Button 
            size="xs" 
            variant="ghost" 
            color="#BC6C78"
            _hover={{ bg: "rgba(139, 58, 74, 0.2)" }}
            leftIcon={<Icon as={FaTrash} />}
            onClick={clearLogs}
          >
            Clear
          </Button>
        </Tooltip>
      </Flex>
      
      <Collapse in={isOpen} animateOpacity>
        <Box 
          maxH="300px" 
          overflowY="auto" 
          p={3} 
          css={{
            "&::-webkit-scrollbar": {
              width: "6px",
            },
            "&::-webkit-scrollbar-track": {
              background: "rgba(0, 0, 0, 0.2)",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "rgba(139, 58, 74, 0.3)",
              borderRadius: "3px",
              "&:hover": {
                background: "rgba(139, 58, 74, 0.5)",
              },
            },
          }}
        >
          {activityLogs.length === 0 ? (
            <Text color="#AA5C5C" fontSize="sm" textAlign="center" p={4}>
              No activity logged yet
            </Text>
          ) : (
            <VStack spacing={2} align="stretch">
              {activityLogs.map((log) => (
                <LogEntryItem key={log.id} log={log} />
              ))}
            </VStack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

export default ActivityLog; 