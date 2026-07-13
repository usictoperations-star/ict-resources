import {
  useGetExpiringDomains,
  useListDomains,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import { useColors } from "@/hooks/useColors";
import { MAX_CONTENT_WIDTH, useBreakpoint } from "@/hooks/useBreakpoint";

type Domain = {
  id: number;
  name: string;
  registrar?: string | null;
  registrationExpiry?: string | null;
  sslProvider?: string | null;
  sslExpiry?: string | null;
  sslStatus: string;
  dnsProvider?: string | null;
  cloudflarEnabled?: boolean;
  status: string;
  applicationId?: number | null;
  notes?: string | null;
  createdAt?: string | null;
};

type Urgency = "expired" | "critical" | "warning" | "ok" | "unknown";

type UrgencyFilter = "all" | Urgency;

function getRelevantExpiry(domain: Domain): string | null {
  return domain.sslExpiry || domain.registrationExpiry || null;
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((target.getTime() - now.getTime()) / msPerDay);
}

function getUrgency(domain: Domain): Urgency {
  const expiry = getRelevantExpiry(domain);
  if (!expiry) return "unknown";
  const days = getDaysUntil(expiry);
  if (days < 0) return "expired";
  if (days < 7) return "critical";
  if (days < 30) return "warning";
  return "ok";
}

function urgencyMeta(urgency: Urgency, colors: ReturnType<typeof useColors>) {
  switch (urgency) {
    case "expired":
      return { color: colors.critical, label: "EXPIRED" };
    case "critical":
      return { color: colors.critical, label: "CRITICAL" };
    case "warning":
      return { color: colors.medium, label: "WARNING" };
    case "ok":
      return { color: colors.low, label: "OK" };
    default:
      return { color: colors.mutedForeground, label: "UNKNOWN" };
  }
}

const FILTERS: { key: UrgencyFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "expired", label: "Expired" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "ok", label: "OK" },
];

function isValidFilter(value: string | undefined): value is UrgencyFilter {
  return (
    value === "all" ||
    value === "expired" ||
    value === "critical" ||
    value === "warning" ||
    value === "ok"
  );
}

function DomainCard({ domain }: { domain: Domain }) {
  const colors = useColors();
  const router = useRouter();
  const urgency = getUrgency(domain);
  const { color, label } = urgencyMeta(urgency, colors);
  const expiry = getRelevantExpiry(domain);
  const days = expiry ? getDaysUntil(expiry) : null;
  const expiryLabel =
    days == null
      ? "No expiry date on record"
      : days < 0
        ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
        : `Expires in ${days} day${days === 1 ? "" : "s"}`;

  return (
    <Pressable
      onPress={() => router.push(`/domain/${domain.id}` as never)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: color,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.domainName, { color: colors.foreground }]} numberOfLines={1}>
            {domain.name}
          </Text>
          <Text style={[styles.expiryLabel, { color }]}>{expiryLabel}</Text>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.urgencyBadge, { backgroundColor: color }]}>
            <Text style={styles.urgencyText}>{label}</Text>
          </View>
          <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
        </View>
      </View>
      <View style={styles.cardMeta}>
        {domain.sslProvider && (
          <View style={styles.metaItem}>
            <Feather name="lock" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {domain.sslProvider}
            </Text>
          </View>
        )}
        {domain.registrar && (
          <View style={styles.metaItem}>
            <Feather name="globe" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {domain.registrar}
            </Text>
          </View>
        )}
        {domain.dnsProvider && (
          <View style={styles.metaItem}>
            <Feather name="server" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {domain.dnsProvider}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function DomainsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  // Read filter from URL params — set when navigating from a notification tap
  const params = useLocalSearchParams<{ filter?: string }>();
  const paramFilter = Array.isArray(params.filter) ? params.filter[0] : params.filter;

  const [filter, setFilter] = useState<UrgencyFilter>(
    isValidFilter(paramFilter) ? paramFilter : "all"
  );

  // Sync filter when returning to this tab via a different notification
  useEffect(() => {
    if (isValidFilter(paramFilter)) {
      setFilter(paramFilter);
    }
  }, [paramFilter]);

  const {
    data: domains,
    isLoading: domainsLoading,
    refetch: refetchDomains,
    isRefetching: domainsRefetching,
  } = useListDomains();

  const {
    data: expiring,
    isLoading: expiringLoading,
    refetch: refetchExpiring,
    isRefetching: expiringRefetching,
  } = useGetExpiringDomains();

  const onRefresh = useCallback(() => {
    refetchDomains();
    refetchExpiring();
  }, [refetchDomains, refetchExpiring]);

  const isRefreshing = domainsRefetching || expiringRefetching;
  const isLoading = domainsLoading || expiringLoading;
  const topPadding = isWeb ? 67 : insets.top;
  const { isTablet, width: screenWidth } = useBreakpoint();
  const hPad = isTablet ? Math.max(16, (screenWidth - MAX_CONTENT_WIDTH) / 2) : 16;

  const counts = useMemo(() => {
    const result = { expired: 0, critical: 0, warning: 0, ok: 0 };
    for (const d of domains?.data ?? []) {
      const urgency = getUrgency(d);
      if (urgency === "expired") result.expired += 1;
      else if (urgency === "critical") result.critical += 1;
      else if (urgency === "warning") result.warning += 1;
      else if (urgency === "ok") result.ok += 1;
    }
    return result;
  }, [domains]);

  const upcomingCount = expiring?.length ?? 0;

  const filtered = useMemo(() => {
    const list = domains?.data ?? [];
    if (filter === "all") return list;
    return list.filter((d) => getUrgency(d) === filter);
  }, [domains, filter]);

  const sorted = useMemo(() => {
    const order: Record<Urgency, number> = {
      expired: 0,
      critical: 1,
      warning: 2,
      ok: 3,
      unknown: 4,
    };
    return [...filtered].sort((a, b) => order[getUrgency(a)] - order[getUrgency(b)]);
  }, [filtered]);

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
            <Text style={styles.headerTitle}>Domains</Text>
            <Text style={styles.headerSub}>SSL & Registration Expiry</Text>
          </View>
          {!expiringLoading && (
            <View style={[styles.badge, { backgroundColor: upcomingCount > 0 ? colors.critical : "rgba(255,255,255,0.15)" }]}>
              <Feather name="bell" size={12} color="#fff" />
              <Text style={styles.badgeText}>{upcomingCount}</Text>
            </View>
          )}
        </View>

        {!domainsLoading && (
          <View style={styles.summaryRow}>
            {[
              { label: "Expired", value: counts.expired, color: colors.critical },
              { label: "Critical", value: counts.critical, color: colors.critical },
              { label: "Warning", value: counts.warning, color: colors.medium },
              { label: "OK", value: counts.ok, color: colors.low },
            ].map((s) => (
              <View key={s.label} style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.summaryLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

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

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <DomainCard domain={item} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: isWeb ? 34 : insets.bottom + 90, paddingHorizontal: hPad },
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
          scrollEnabled={!!(sorted && sorted.length > 0)}
          ListEmptyComponent={
            <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="check-circle" size={32} color={colors.low} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {filter !== "all" ? `No ${filter} domains` : "No Domains"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {filter !== "all"
                  ? `No domains in the ${filter} category`
                  : "No domains registered yet"}
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
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
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
  filterRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
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
  cardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  cardTitleRow: { flex: 1, gap: 4 },
  domainName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  expiryLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  urgencyText: {
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
