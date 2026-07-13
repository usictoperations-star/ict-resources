import { useListApplications } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState, getErrorMessage } from "@/components/ErrorState";
import { useColors } from "@/hooks/useColors";
import { MAX_CONTENT_WIDTH, useBreakpoint } from "@/hooks/useBreakpoint";

type App = {
  id: number;
  name: string;
  category?: string | null;
  status?: string | null;
  environment?: string | null;
  owner?: string | null;
  version?: string | null;
  description?: string | null;
};

function statusColor(status: string | null | undefined, colors: ReturnType<typeof useColors>) {
  switch (status?.toLowerCase()) {
    case "active": return colors.low;
    case "maintenance": return colors.medium;
    case "inactive":
    case "deprecated": return colors.mutedForeground;
    case "critical": return colors.critical;
    default: return colors.info;
  }
}

function envColor(env: string | null | undefined, colors: ReturnType<typeof useColors>) {
  switch (env?.toLowerCase()) {
    case "production": return colors.primary;
    case "staging": return colors.medium;
    case "development": return colors.mutedForeground;
    case "testing": return colors.info;
    default: return colors.mutedForeground;
  }
}

function AppCard({ app, onPress }: { app: App; onPress: () => void }) {
  const colors = useColors();
  const sc = statusColor(app.status, colors);
  const ec = envColor(app.environment, colors);
  const initial = app.name?.[0]?.toUpperCase() ?? "?";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primary + "18" }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.appName, { color: colors.foreground }]} numberOfLines={1}>
          {app.name}
        </Text>
        <Text style={[styles.appCategory, { color: colors.mutedForeground }]} numberOfLines={1}>
          {app.category ?? "Uncategorized"} {app.version ? `• v${app.version}` : ""}
        </Text>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: sc + "18" }]}>
            <View style={[styles.badgeDot, { backgroundColor: sc }]} />
            <Text style={[styles.badgeText, { color: sc }]}>
              {app.status ?? "Unknown"}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: ec + "18" }]}>
            <Text style={[styles.badgeText, { color: ec }]}>
              {app.environment ?? "N/A"}
            </Text>
          </View>
        </View>
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function ApplicationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === "web";
  const { isTablet, width: screenWidth } = useBreakpoint();
  const hPad = isTablet ? Math.max(16, (screenWidth - MAX_CONTENT_WIDTH) / 2) : 16;
  const [search, setSearch] = useState("");

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useListApplications(search ? { search } : {});

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const topPadding = isWeb ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.header, paddingTop: topPadding + 12 },
        ]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Applications</Text>
            {data && (
              <Text style={styles.headerCount}>{data.total} registered</Text>
            )}
          </View>
          <View style={[styles.headerIcon, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <Feather name="layers" size={18} color="#fff" />
          </View>
        </View>

        {/* Search */}
        <View
          style={[
            styles.searchBar,
            { backgroundColor: "rgba(255,255,255,0.15)" },
          ]}
        >
          <Feather name="search" size={15} color="rgba(255,255,255,0.7)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search applications..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={15} color="rgba(255,255,255,0.7)" />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: 40 }}
        />
      ) : isError ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={refetch}
          retrying={isRefetching}
        />
      ) : (
        <FlatList
          data={data?.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <AppCard
              app={item}
              onPress={() =>
                router.push({
                  pathname: "/application/[id]",
                  params: { id: String(item.id) },
                })
              }
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: isWeb ? 34 : insets.bottom + 90, paddingHorizontal: hPad },
          ]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshing={isRefetching}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(data && data.total > 0)}
          ListEmptyComponent={
            <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="layers" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "No results" : "No Applications"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {search
                  ? `No applications matching "${search}"`
                  : "No applications registered yet"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: "#ffffff",
    fontFamily: "Inter_700Bold",
  },
  headerCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  list: { padding: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  cardContent: { flex: 1, gap: 3 },
  appName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  appCategory: { fontSize: 12, fontFamily: "Inter_400Regular" },
  badges: { flexDirection: "row", gap: 6, marginTop: 4 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  empty: {
    alignItems: "center",
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 24,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
