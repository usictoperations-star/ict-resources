import { useWindowDimensions } from "react-native";

export const BREAKPOINTS = {
  phone: 0,
  tablet: 600,
  desktop: 1024,
} as const;

export const MAX_CONTENT_WIDTH = 700;
export const MAX_CARD_WIDTH = 500;

export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= BREAKPOINTS.tablet;
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isLandscape = width > height;
  return { width, height, isTablet, isDesktop, isLandscape };
}
