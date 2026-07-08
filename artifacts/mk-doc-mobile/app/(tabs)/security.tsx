import {
  useGetSecuritySummary,
  useListVulnerabilities,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState, getErrorMessage } from "@/components/ErrorState";
import { useColors } from "@/hooks/useColors";

type Vuln = {
  id: number;
  title: string;
  severity?: string | null;
  status?: string | null;
  applicationName?: string | null;
  cveId?: string | null;
  description?: string | null;
  discoveredAt?: string | null;
};

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";

function severityColor(sev: string | null | undefined, colors: ReturnType<typeof useColors>) {
  switch (sev?.toLowerCase()) {
    case "critical": return colors.critical;
    case "high": return colors.high;
    case "medium": return colors.medium;
    case "low": return colors.low;
    default: return colors.info;
  }
}

function statusColor(status: string | null | undefined, colors: ReturnType<typeof useColors>) {
  switch (status?.toLowerCase()) {
    case "resolved": return colors.low;
    case "in_progress": return colors.info;
    case "open": return colors.high;
    default: return colors.mutedForeground;
  }
}

function VulnCard({ vuln }: { vuln: Vuln }) {
  const colors = useColors();
  const sc = severityColor(vuln.severity, colors);
  const stc = statusColor(vuln.status, colors);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: sc }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.vulnTitle, { color: colors.foreground }]} numberOfLines={2}>
            {vuln.title}
          </Text>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: sc }]}>
          <Text style={styles.severityText}>{(vuln.severity ?? "?").toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        {vuln.applicationName && (
          <View style={styles.metaItem}>
            <Feather name="layers" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {vuln.applicationName}
            </Text>
          </View>
        )}
        {vuln.cveId && (
          <View style={styles.metaItem}>
            <Feather name="hash" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{vuln.cveId}</Text>
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: stc + "18" }]}>
          <Text style={[styles.statusText, { color: stc }]}>
            {(vuln.status ?? "open").replace(/_/g, " ")}
          </Text>
        </View>
      </View>
    </View>
  );
}

const FILTERS: { key: SeverityFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

export default function SecurityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [filter, setFilter] = useState<SeverityFilter>("all");

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryIsError,
    error: summaryError,
    refetch: refetchSummary,
    isRefetching: summaryRefetching,
  } = useGetSecuritySummary();

  const {
    data: vulns,
    isLoading: vulnsLoading,
    isError: vulnsIsError,
    error: vulnsError,
    refetch: refetchVulns,
    isRefetching: vulnsRefetching,
  } = useListVulnerabilities(filter !== "all" ? { severity: filter } : {});

  const onRefresh = useCallback(() => {
    refetchSummary();
    refetchVulns();
  }, [refetchSummary, refetchVulns]);

  const isRefreshing = summaryRefetching || vulnsRefetching;
  const topPadding = isWeb ? 67 : insets.top;

  const scoreColor =
    (summary?.securityScore ?? 0) >= 80
      ? colors.low
      : (summary?.securityScore ?? 0) >= 60
        ? colors.medium
        : colors.critical;

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
            <Text style={styles.headerTitle}>Security</Text>
            <Text style={styles.headerSub}>Vulnerability Tracker</Text>
          </View>
          {!summaryLoading && summary && (
            <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
              <Text style={[styles.scoreValue, { color: scoreColor }]}>
                {summary.securityScore ?? 0}
              </Text>
              <Text style={[styles.scorePct, { color: scoreColor }]}>%</Text>
            </View>
          )}
        </View>

        {/* Summary counts */}
        {!summaryLoading && summary && (
          <View style={styles.summaryRow}>
            {[
              { label: "Critical", value: summary.critical ?? 0, color: colors.critical },
              { label: "High", value: summary.high ?? 0, color: colors.high },
              { label: "Medium", value: summary.medium ?? 0, color: colors.medium },
              { label: "Low", value: summary.low ?? 0, color: colors.low },
            ].map((s) => (
              <View key={s.label} style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.summaryLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {summaryIsError && (
          <View style={[styles.summaryError, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
            <Feather name="wifi-off" size={14} color="#fff" />
            <Text style={styles.summaryErrorText} numberOfLines={1}>
              {getErrorMessage(summaryError)}
            </Text>
            <Pressable onPress={() => refetchSummary()} hitSlop={8}>
              <Feather name="refresh-cw" size={14} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.filterPill,
                  active
                    ? { backgroundColor: "#ffffff" }
                    : { backgroundColor: "rgba(255,255,255,0.15)" },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    active ? { color: colors.header } : { color: "rgba(255,255,255,0.8)" },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {vulnsLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : vulnsIsError ? (
        <ErrorState
          message={getErrorMessage(vulnsError)}
          onRetry={refetchVulns}
          retrying={vulnsRefetching}
        />
      ) : (
        <FlatList
          data={vulns ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <VulnCard vuln={item} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: isWeb ? 34 : insets.bottom + 90 },
          ]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(vulns && vulns.length > 0)}
          ListEmptyComponent={
            <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="shield" size={32} color={colors.low} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {filter !== "all" ? `No ${filter} vulnerabilities` : "No Vulnerabilities"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {filter !== "all"
                  ? `No ${filter} severity issues found`
                  : "Your systems are clean"}
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
    paddingBottom: 14,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: "#ffffff",
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  scoreCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 1,
  },
  scoreValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  scorePct: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    paddingVertical: 8,
  },
  summaryValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  summaryLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  summaryError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  summaryErrorText: {
    flex: 1,
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  filterRow: { flexDirection: "row", gap: 6 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  list: { padding: 16 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    gap: 8,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardTitleRow: { flex: 1 },
  vulnTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  severityText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
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
