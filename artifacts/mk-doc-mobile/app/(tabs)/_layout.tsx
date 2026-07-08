import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="applications">
        <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        <Label>Apps</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="domains">
        <Icon sf={{ default: "lock.shield", selected: "lock.shield.fill" }} />
        <Label>Domains</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="security">
        <Icon sf={{ default: "shield", selected: "shield.fill" }} />
        <Label>Security</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          paddingBottom: isWeb ? 0 : insets.bottom,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="bar-chart-2" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: "Apps",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="square.grid.2x2.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="grid" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="domains"
        options={{
          title: "Domains",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="lock.shield.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="globe" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="security"
        options={{
          title: "Security",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="shield.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="shield" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
