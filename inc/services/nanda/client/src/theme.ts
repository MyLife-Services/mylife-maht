// client/src/theme.ts
import { extendTheme, ThemeConfig } from "@chakra-ui/react";

// Color scheme configuration
const config: ThemeConfig = {
  initialColorMode: "dark",
  useSystemColorMode: false,
};

// Custom theme for the application
export const theme = extendTheme({
  config,
  colors: {
    // Crimson/red color palette
    primary: {
      50: "#ffe5e9",
      100: "#ffccd3",
      200: "#ffabbd",
      300: "#ff8ca6",
      400: "#ff6a8a",
      500: "#dc143c", // Primary accent color - Crimson
      600: "#c41236",
      700: "#a81030",
      800: "#8c0d29",
      900: "#710a22",
    },
    // Secondary accent color (gold-like for complementary effect)
    secondary: {
      50: "#fef8e7",
      100: "#fcefc0",
      200: "#fbe799",
      300: "#f9de72",
      400: "#f6d54b",
      500: "#f3cc24", // Secondary accent
      600: "#deb51b",
      700: "#b89214",
      800: "#93740f",
      900: "#6e560b",
    },
    // Dark theme background gradients
    dark: {
      100: "#2a2429", // Lighter background with slight red tint
      200: "#22202a", // Container background
      300: "#1c1921", // Main background
      400: "#16151a", // Darker background
      500: "#100e12", // Deepest background
    },
  },
  styles: {
    global: {
      body: {
        bg: "linear-gradient(135deg, #1c1921 0%, #2a1a20 100%)", // Darker crimson gradient
        color: "white",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      },
      "*::placeholder": {
        color: "whiteAlpha.400",
      },
      "*, *::before, &::after": {
        borderColor: "whiteAlpha.200",
      },
    },
  },
  fonts: {
    heading: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: "600",
        borderRadius: "md",
      },
      variants: {
        solid: {
          bg: "primary.500",
          color: "white",
          _hover: {
            bg: "primary.600",
            _disabled: {
              bg: "primary.500",
            },
          },
          _active: {
            bg: "primary.700",
          },
        },
        outline: {
          borderColor: "primary.500",
          color: "primary.500",
          _hover: {
            bg: "rgba(220, 20, 60, 0.1)", // Transparent crimson
          },
        },
        ghost: {
          color: "whiteAlpha.900",
          _hover: {
            bg: "whiteAlpha.100",
          },
        },
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            borderColor: "whiteAlpha.300",
            bg: "whiteAlpha.50",
            _hover: {
              borderColor: "primary.300",
            },
            _focus: {
              borderColor: "primary.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-primary-500)",
            },
          },
        },
      },
    },
    Textarea: {
      variants: {
        outline: {
          borderColor: "whiteAlpha.300",
          bg: "whiteAlpha.50",
          _hover: {
            borderColor: "primary.300",
          },
          _focus: {
            borderColor: "primary.500",
            boxShadow: "0 0 0 1px var(--chakra-colors-primary-500)",
          },
        },
      },
    },
    Modal: {
      baseStyle: {
        dialog: {
          bg: "dark.200",
          boxShadow: "xl",
          borderRadius: "lg",
          border: "1px solid",
          borderColor: "whiteAlpha.100",
        },
        header: {
          borderBottomWidth: "1px",
          borderColor: "whiteAlpha.100",
        },
      },
    },
  },
  layerStyles: {
    card: {
      bg: "rgba(42, 36, 41, 0.7)", // Slightly reddish tint
      borderRadius: "xl",
      boxShadow: "lg",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
    },
  },
  glassmorphism: {
    card: {
      bg: "rgba(42, 36, 41, 0.7)", // Slightly reddish tint
      backdropFilter: "blur(10px)",
      borderRadius: "xl",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
    },
  },
});
