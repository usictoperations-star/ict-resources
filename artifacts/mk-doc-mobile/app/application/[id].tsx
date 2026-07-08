import { useGetApplication } from "@workspace/api-client-react";
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

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string | null;
}) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.primary + "18" }]}>
        <Feather name={icon} size={14} color={colors.primary} />
      </View>
      <View style={styles.infoTextWrap}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
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
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function ApplicationDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const id = Number(params.id);
  const isValidId = Number.isFinite(id);

  const { data: app, isLoading, isError } = useGetApplication(id, {
    query: { enabled: isValidId, queryKey: ["/api/applications", id] },
  });

  const infraFields = app
    ? [
        { icon: "server" as const, label: "Hosting Provider", value: app.hostingProvider },
        { icon: "globe" as const, label: "Domain", value: app.domain },
        { icon: "database" as const, label: "Database", value: app.database },
        { icon: "code" as const, label: "Frontend", value: app.frontend },
        { icon: "terminal" as const, label: "Backend", value: app.backend },
        { icon: "box" as const, label: "Framework", value: app.framework },
        { icon: "hash" as const, label: "Language", value: app.language },
      ].filter((f) => !!f.value)
    : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: app?.name ?? "Application" }} />

      {isLoading || !isValidId ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: 40 }}
        />
      ) : isError || !app ? (
        <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="alert-triangle" size={32} color={colors.critical} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Application Not Found
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            We couldn&apos;t load details for this application.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.header, { backgroundColor: colors.header }]}>
            <View style={[styles.avatar, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
              <Text style={styles.avatarText}>{app.name?.[0]?.toUpperCase() ?? "?"}</Text>
            </View>
            <Text style={styles.headerTitle}>{app.name}</Text>
            {app.category && (
              <Text style={styles.headerSub}>
                {app.category}
                {app.currentVersion ? ` • v${app.currentVersion}` : ""}
              </Text>
            )}
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: statusColor(app.status, colors) }]}>
                <Text style={styles.badgeText}>{app.status ?? "Unknown"}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: envColor(app.environment, colors) }]}>
                <Text style={styles.badgeText}>{app.environment ?? "N/A"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.body}>
            {app.description && (
              <SectionCard title="Description">
                <Text style={[styles.description, { color: colors.foreground }]}>
                  {app.description}
                </Text>
              </SectionCard>
            )}

            <SectionCard title="Ownership">
              <InfoRow icon="user" label="Business Owner" value={app.businessOwner} />
              <InfoRow icon="tool" label="Technical Owner" value={app.technicalOwner} />
              <InfoRow icon="briefcase" label="Product Owner" value={app.productOwner} />
              <InfoRow icon="phone" label="Support Contact" value={app.supportContact} />
              {!app.businessOwner && !app.technicalOwner && !app.productOwner && !app.supportContact && (
                <Text style={[styles.emptySectionText, { color: colors.mutedForeground }]}>
                  No ownership information on record
                </Text>
              )}
            </SectionCard>

            <SectionCard title="Classification">
              <InfoRow icon="layers" label="Classification" value={app.classification} />
              <InfoRow icon="flag" label="Priority" value={app.priority} />
              <InfoRow icon="alert-circle" label="Criticality" value={app.criticality} />
              <InfoRow icon="home" label="Ministry" value={app.ministry} />
              <InfoRow icon="grid" label="Department" value={app.department} />
            </SectionCard>

            <SectionCard title="Linked Infrastructure">
              {infraFields.length > 0 ? (
                infraFields.map((f) => (
                  <InfoRow key={f.label} icon={f.icon} label={f.label} value={f.value} />
                ))
              ) : (
                <Text style={[styles.emptySectionText, { color: colors.mutedForeground }]}>
                  No infrastructure details on record
                </Text>
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
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    textAlign: "center",
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  badge: {
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
  description: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
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
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
