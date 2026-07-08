import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export type ErrorStateProps = {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
};

function describeError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    if (error.name === "TimeoutError") {
      return "The server took too long to respond.";
    }
    if (
      error.message.includes("Network request failed") ||
      error.message.includes("Failed to fetch")
    ) {
      return "Couldn't reach the server. Check your connection.";
    }
    return error.message;
  }
  return String(error);
}

export function getErrorMessage(error: unknown): string {
  return describeError(error) ?? "Something went wrong while loading data.";
}

export function ErrorState({ message, onRetry, retrying }: ErrorStateProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.critical + "18" }]}>
        <Feather name="wifi-off" size={28} color={colors.critical} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>
        Unable to load data
      </Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>
        {message ?? "Something went wrong while loading data."}
      </Text>
      <Pressable
        onPress={onRetry}
        disabled={retrying}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.primary,
            opacity: pressed || retrying ? 0.7 : 1,
          },
        ]}
      >
        <Feather name="refresh-cw" size={14} color="#fff" />
        <Text style={styles.buttonText}>{retrying ? "Retrying…" : "Retry"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    padding: 28,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    margin: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  message: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  buttonText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
