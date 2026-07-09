import {
  useGetApplication,
  useGetDomain,
  useGetDomainHistory,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Urgency = "expired" | "critical" | "warning" | "ok" | "unknown";

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function expiryUrgency(dateStr: string | null | undefined): Urgency {
  if (!dateStr) return "unknown";
  const days = getDaysUntil(dateStr);
  if (days < 0) return "expired";
  if (days < 7) return "critical";
  if (days < 30) return "warning";
  return "ok";
}

function expiryColor(
  urgency: Urgency,
  colors: ReturnType<typeof useColors>,
): string {
  switch (urgency) {
    case "expired":
    case "critical":
      return colors.critical;
    case "warning":
      return colors.medium;
    case "ok":
      return colors.low;
    default:
      return colors.mutedForeground;
  }
}

function formatExpiry(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const days = getDaysUntil(dateStr);
  const formatted = new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (days < 0)
    return `${formatted} (expired ${Math.abs(days)}d ago)`;
  return `${formatted} (${days}d remaining)`;
}

function sslStatusColor(
  status: string | null | undefined,
  colors: ReturnType<typeof useColors>,
): string {
  switch (status?.toLowerCase()) {
    case "valid":
    case "active":
      return colors.low;
    case "expiring":
    case "expiring soon":
      return colors.medium;
    case "expired":
    case "invalid":
      return colors.critical;
    default:
      return colors.mutedForeground;
  }
}

function domainStatusColor(
  status: string | null | undefined,
  colors: ReturnType<typeof useColors>,
): string {
  switch (status?.toLowerCase()) {
    case "active":
      return colors.low;
    case "inactive":
      return colors.mutedForeground;
    case "expired":
      return colors.critical;
    default:
      return colors.info;
  }
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string | null;
  valueColor?: string;
}) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.primary + "18" }]}>
        <Feather name={icon} size={14} color={colors.primary} />
      </View>
      <View style={styles.infoTextWrap}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <Text
          style={[
            styles.infoValue,
            { color: valueColor ?? colors.foreground },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function LinkedApplication({ appId }: { appId: number }) {
  const colors = useColors();
  const { data: app, isLoading } = useGetApplication(appId, {
    query: { queryKey: ["/api/applications", appId] },
  });

  if (isLoading) {
    return (
      <View style={styles.infoRow}>
        <View
          style={[
            styles.infoIcon,
            { backgroundColor: colors.primary + "18" },
          ]}
        >
          <Feather name="layers" size={14} color={colors.primary} />
        </View>
        <View style={styles.infoTextWrap}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
            Linked Application
          </Text>
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{ alignSelf: "flex-start", marginTop: 2 }}
          />
        </View>
      </View>
    );
  }

  if (!app) return null;

  return (
    <InfoRow icon="layers" label="Linked Application" value={app.name} />
  );
}

export default function DomainDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const id = Number(params.id);
  const isValidId = Number.isFinite(id) && id > 0;

  const {
    data: domain,
    isLoading,
    isError,
  } = useGetDomain(id, {
    query: { enabled: isValidId, queryKey: ["/api/domains", id] },
  });

  const {
    data: history,
    isLoading: historyLoading,
  } = useGetDomainHistory(id, {
    query: { enabled: isValidId, queryKey: ["/api/domains", id, "history"] },
  });

  const registrationUrgency = expiryUrgency(domain?.registrationExpiry);
  const sslUrgency = expiryUrgency(domain?.sslExpiry);

  const overallUrgency: Urgency = (() => {
    const order: Record<Urgency, number> = {
      expired: 0,
      critical: 1,
      warning: 2,
      ok: 3,
      unknown: 4,
    };
    if (order[registrationUrgency] < order[sslUrgency])
      return registrationUrgency;
    return sslUrgency;
  })();

  const headerAccentColor = expiryColor(overallUrgency, colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: domain?.name ?? "Domain" }} />

      {!isValidId ? (
        <View
          style={[
            styles.empty,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Feather name="alert-triangle" size={32} color={colors.critical} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Invalid Domain
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            The domain ID in this link is not valid.
          </Text>
        </View>
      ) : isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : isError || !domain ? (
        <View
          style={[
            styles.empty,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Feather name="alert-triangle" size={32} color={colors.critical} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Domain Not Found
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            We couldn&apos;t load details for this domain.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              { backgroundColor: colors.header, borderBottomColor: headerAccentColor },
            ]}
          >
            <View
              style={[
                styles.avatar,
                { backgroundColor: headerAccentColor + "33" },
              ]}
            >
              <Feather name="globe" size={24} color={headerAccentColor} />
            </View>
            <Text style={styles.headerTitle}>{domain.name}</Text>

            <View style={styles.badgeRow}>
              {/* Domain status badge */}
              <View
                style={[
                  styles.badge,
                  { backgroundColor: domainStatusColor(domain.status, colors) },
                ]}
              >
                <Text style={styles.badgeText}>{domain.status}</Text>
              </View>
              {/* SSL status badge */}
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: sslStatusColor(domain.sslStatus, colors),
                  },
                ]}
              >
                <Feather
                  name="lock"
                  size={10}
                  color="#fff"
                  style={{ marginRight: 3 }}
                />
                <Text style={styles.badgeText}>SSL {domain.sslStatus}</Text>
              </View>
              {/* Cloudflare badge */}
              {domain.cloudflarEnabled && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: "#f38020" },
                  ]}
                >
                  <Text style={styles.badgeText}>Cloudflare</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.body}>
            {/* Registration */}
            <SectionCard title="Registration">
              <InfoRow
                icon="user"
                label="Registrar"
                value={domain.registrar}
              />
              <InfoRow
                icon="calendar"
                label="Registration Expiry"
                value={formatExpiry(domain.registrationExpiry)}
                valueColor={expiryColor(registrationUrgency, colors)}
              />
              {!domain.registrar && !domain.registrationExpiry && (
                <Text
                  style={[
                    styles.emptySectionText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  No registration details on record
                </Text>
              )}
            </SectionCard>

            {/* SSL */}
            <SectionCard title="SSL Certificate">
              <InfoRow
                icon="shield"
                label="SSL Provider"
                value={domain.sslProvider}
              />
              <InfoRow
                icon="calendar"
                label="SSL Expiry"
                value={formatExpiry(domain.sslExpiry)}
                valueColor={expiryColor(sslUrgency, colors)}
              />
              <InfoRow
                icon="check-circle"
                label="SSL Status"
                value={domain.sslStatus}
                valueColor={sslStatusColor(domain.sslStatus, colors)}
              />
              {!domain.sslProvider && !domain.sslExpiry && (
                <Text
                  style={[
                    styles.emptySectionText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  No SSL details on record
                </Text>
              )}
            </SectionCard>

            {/* DNS & Hosting */}
            <SectionCard title="DNS & Hosting">
              <InfoRow
                icon="server"
                label="DNS Provider"
                value={domain.dnsProvider}
              />
              {!domain.dnsProvider && !domain.cloudflarEnabled && (
                <Text
                  style={[
                    styles.emptySectionText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  No DNS details on record
                </Text>
              )}
              {domain.cloudflarEnabled && (
                <InfoRow
                  icon="zap"
                  label="Cloudflare"
                  value="Enabled"
                  valueColor={colors.low}
                />
              )}
            </SectionCard>

            {/* Linked Application */}
            {domain.applicationId != null && (
              <SectionCard title="Linked Application">
                <LinkedApplication appId={domain.applicationId} />
              </SectionCard>
            )}

            {/* Notes */}
            {domain.notes && (
              <SectionCard title="Notes">
                <Text
                  style={[
                    styles.notesText,
                    { color: colors.foreground },
                  ]}
                >
                  {domain.notes}
                </Text>
              </SectionCard>
            )}

            {/* Renewal / Change History */}
            <SectionCard title="Renewal & Change History">
              {historyLoading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ alignSelf: "flex-start" }}
                />
              ) : !history || history.length === 0 ? (
                <Text
                  style={[
                    styles.emptySectionText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  No history recorded yet
                </Text>
              ) : (
                history.map((entry, idx) => (
                  <View key={entry.id} style={styles.historyEntry}>
                    {idx > 0 && (
                      <View
                        style={[
                          styles.historyDivider,
                          { backgroundColor: colors.border },
                        ]}
                      />
                    )}
                    <View style={styles.historyRow}>
                      <View
                        style={[
                          styles.historyDot,
                          {
                            backgroundColor:
                              entry.action === "CREATE"
                                ? colors.low
                                : entry.action === "DELETE"
                                  ? colors.critical
                                  : colors.primary,
                          },
                        ]}
                      />
                      <View style={styles.historyContent}>
                        <View style={styles.historyTopRow}>
                          <Text
                            style={[
                              styles.historyAction,
                              { color: colors.foreground },
                            ]}
                          >
                            {entry.action}
                          </Text>
                          <Text
                            style={[
                              styles.historyDate,
                              { color: colors.mutedForeground },
                            ]}
                          >
                            {new Date(entry.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </Text>
                        </View>
                        {entry.userName && (
                          <Text
                            style={[
                              styles.historyMeta,
                              { color: colors.mutedForeground },
                            ]}
                          >
                            by {entry.userName}
                          </Text>
                        )}
                        {entry.changes && (
                          <Text
                            style={[
                              styles.historyChanges,
                              { color: colors.mutedForeground },
                            ]}
                          >
                            {entry.changes}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </SectionCard>

            {/* Metadata */}
            <SectionCard title="Record Info">
              <InfoRow
                icon="hash"
                label="Domain ID"
                value={String(domain.id)}
              />
              {domain.createdAt && (
                <InfoRow
                  icon="clock"
                  label="Created"
                  value={new Date(domain.createdAt).toLocaleDateString(
                    "en-US",
                    { year: "numeric", month: "short", day: "numeric" },
                  )}
                />
              )}
            </SectionCard>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
    gap: 6,
    borderBottomWidth: 3,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    textAlign: "center",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
    textTransform: "capitalize",
  },
  body: {
    padding: 16,
    gap: 12,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  sectionBody: { gap: 12 },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoTextWrap: { flex: 1, gap: 2 },
  infoLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  notesText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  emptySectionText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  empty: {
    alignItems: "center",
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 40,
    marginHorizontal: 16,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  historyEntry: { gap: 0 },
  historyDivider: { height: 1, marginVertical: 10, marginLeft: 18 },
  historyRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    flexShrink: 0,
  },
  historyContent: { flex: 1, gap: 2 },
  historyTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  historyAction: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  historyDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  historyMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  historyChanges: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginTop: 2,
  },
});
