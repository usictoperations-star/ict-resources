import {
  useGetDashboardAlerts,
  useGetDashboardStats,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState, getErrorMessage } from "@/components/ErrorState";
import { useAuth } from "@/contexts/auth";
import { useColors } from "@/hooks/useColors";

const DISMISSED_ALERTS_KEY = "mk_dismissed_alerts";

async function loadDismissedIds(): Promise<number[]> {
  if (Platform.OS === "web") return [];
  try {
    const raw = await SecureStore.getItemAsync(DISMISSED_ALERTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveDismissedIds(ids: number[]): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.setItemAsync(DISMISSED_ALERTS_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

type KPI = {
  label: string;
  value: string | number;
  icon: string;
  colorKey: "primary" | "critical" | "high" | "low" | "info";
  subtitle?: string;
};

type Alert = {
  id: number;
  type: string;
  severity: string;
  title: string;
  message: string;
  dueDate?: string | null;
  createdAt: string;
};

function KPICard({ kpi }: { kpi: KPI }) {
  const colors = useColors();
  const accent = colors[kpi.colorKey] ?? colors.primary;
  return (
    <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.kpiIconWrap, { backgroundColor: accent + "18" }]}>
        <Feather name={kpi.icon as never} size={18} color={accent} />
      </View>
      <Text style={[styles.kpiValue, { color: colors.foreground }]}>{kpi.value}</Text>
      <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{kpi.label}</Text>
      {kpi.subtitle ? (
        <Text style={[styles.kpiSubtitle, { color: accent }]}>{kpi.subtitle}</Text>
      ) : null}
    </View>
  );
}

function AlertRow({
  alert,
  onDismiss,
}: {
  alert: Alert;
  onDismiss: (id: number) => void;
}) {
  const colors = useColors();
  const isCritical = alert.severity === "critical";
  const dotColor = isCritical ? colors.critical : colors.high;
  return (
    <View style={[styles.alertRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.alertDot, { backgroundColor: dotColor }]} />
      <View style={styles.alertContent}>
        <Text style={[styles.alertTitle, { color: colors.foreground }]} numberOfLines={1}>
          {alert.title}
        </Text>
        <Text style={[styles.alertMessage, { color: colors.mutedForeground }]} numberOfLines={2}>
          {alert.message}
        </Text>
      </View>
      <View style={styles.alertRight}>
        <View style={[styles.alertBadge, { backgroundColor: dotColor + "20" }]}>
          <Text style={[styles.alertBadgeText, { color: dotColor }]}>
            {alert.severity.toUpperCase()}
          </Text>
        </View>
        <Pressable
          onPress={() => onDismiss(alert.id)}
          hitSlop={10}
          style={[styles.dismissBtn, { backgroundColor: colors.background }]}
        >
          <Feather name="x" size={12} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { logout } = useAuth();

  const [dismissedIds, setDismissedIds] = useState<number[]>([]);

  useEffect(() => {
    loadDismissedIds().then(setDismissedIds).catch(() => {});
  }, []);

  const handleDismiss = useCallback((id: number) => {
    setDismissedIds((prev) => {
      const next = [...prev, id];
      void saveDismissedIds(next);
      return next;
    });
  }, []);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsIsError,
    error: statsError,
    refetch: refetchStats,
    isRefetching: statsRefetching,
  } = useGetDashboardStats();

  const {
    data: alerts,
    isLoading: alertsLoading,
    isError: alertsIsError,
    error: alertsError,
    refetch: refetchAlerts,
    isRefetching: alertsRefetching,
  } = useGetDashboardAlerts();

  const onRefresh = useCallback(() => {
    refetchStats();
    refetchAlerts();
  }, [refetchStats, refetchAlerts]);

  const isRefreshing = statsRefetching || alertsRefetching;

  const visibleAlerts = (alerts ?? []).filter((a) => !dismissedIds.includes(a.id));

  const kpis: KPI[] = [
    {
      label: "Total Apps",
      value: stats?.totalApplications ?? "—",
      icon: "layers",
      colorKey: "primary",
    },
    {
      label: "Open Incidents",
      value: stats?.openIncidents ?? "—",
      icon: "alert-circle",
      colorKey: "critical",
    },
    {
      label: "Critical Vulns",
      value: stats?.criticalVulnerabilities ?? "—",
      icon: "shield-off",
      colorKey: "high",
    },
    {
      label: "Security Score",
      value: stats?.securityScore ? `${stats.securityScore}%` : "—",
      icon: "shield",
      colorKey: "low",
      subtitle:
        stats?.securityScore != null
          ? stats.securityScore >= 80
            ? "Good"
            : stats.securityScore >= 60
              ? "Fair"
              : "Poor"
          : undefined,
    },
  ];

  const topPadding = isWeb ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.header,
            paddingTop: topPadding + 12,
          },
        ]}
      >
        <View style={styles.headerInner}>
          <View>
            <Text style={styles.headerTitle}>Mahibere Kidusan</Text>
            <Text style={styles.headerSub}>Digital System Operations Center</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.headerBadge, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
              <Feather name="activity" size={14} color="#fff" />
              <Text style={styles.headerBadgeText}>Live</Text>
            </View>
            <Pressable
              onPress={logout}
              style={[styles.headerBadge, { backgroundColor: "rgba(255,255,255,0.15)" }]}
              hitSlop={8}
            >
              <Feather name="log-out" size={14} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: isWeb ? 34 : insets.bottom + 90 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          KEY METRICS
        </Text>
        {statsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : statsIsError ? (
          <ErrorState
            message={getErrorMessage(statsError)}
            onRetry={refetchStats}
            retrying={statsRefetching}
          />
        ) : (
          <View style={styles.kpiGrid}>
            {kpis.map((k) => (
              <KPICard key={k.label} kpi={k} />
            ))}
          </View>
        )}

        {!statsLoading && stats && (
          <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.servers ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Servers</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.databases ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Databases</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.domains ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Domains</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.upcomingRenewals ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Renewals</Text>
            </View>
          </View>
        )}

        <View style={styles.alertsHeader}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            ACTIVE ALERTS
          </Text>
          {visibleAlerts.length > 0 && (
            <View style={[styles.alertCount, { backgroundColor: colors.critical }]}>
              <Text style={styles.alertCountText}>{visibleAlerts.length}</Text>
            </View>
          )}
        </View>

        {alertsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : alertsIsError ? (
          <ErrorState
            message={getErrorMessage(alertsError)}
            onRetry={refetchAlerts}
            retrying={alertsRefetching}
          />
        ) : visibleAlerts.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="check-circle" size={32} color={colors.low} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All Clear</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No active alerts at this time
            </Text>
          </View>
        ) : (
          <View style={styles.alertList}>
            {visibleAlerts.map((a) => (
              <AlertRow key={a.id} alert={a} onDismiss={handleDismiss} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#ffffff",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  headerBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  kpiCard: {
    width: "47.5%",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 4,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kpiValue: { fontSize: 26, fontFamily: "Inter_700Bold", lineHeight: 30 },
  kpiLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  kpiSubtitle: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statsRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  statDivider: { width: 1 },
  alertsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  alertCount: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  alertCountText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  alertList: { gap: 8 },
  alertRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    flexShrink: 0,
  },
  alertContent: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  alertMessage: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  alertRight: { alignItems: "flex-end", gap: 6 },
  alertBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  alertBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  dismissBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
