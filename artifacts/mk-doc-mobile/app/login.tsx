import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/auth";
import { useColors } from "@/hooks/useColors";

function BiometricGate({
  onUnlock,
  onFallback,
}: {
  onUnlock: () => void;
  onFallback: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerBiometric = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Mahibere Kidusan DOC",
        cancelLabel: "Use Password",
        disableDeviceFallback: false,
      });
      if (result.success) {
        onUnlock();
      } else if (result.error === "user_cancel" || result.error === "system_cancel") {
        onFallback();
      } else {
        setError("Authentication failed. Try your password.");
      }
    } catch {
      setError("Biometric authentication unavailable.");
    } finally {
      setIsAuthenticating(false);
    }
  }, [onUnlock, onFallback]);

  useEffect(() => {
    void triggerBiometric();
  }, [triggerBiometric]);

  return (
    <View style={[bgateStyles.root, { backgroundColor: colors.background }]}>
      <View style={[bgateStyles.inner, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]}>
        <View style={[bgateStyles.logo, { backgroundColor: colors.primary }]}>
          <Feather name="activity" size={28} color="#fff" />
        </View>
        <Text style={[bgateStyles.name, { color: colors.foreground }]}>Mahibere Kidusan</Text>
        <Text style={[bgateStyles.sub, { color: colors.mutedForeground }]}>Digital System Operations Center</Text>

        <View style={[bgateStyles.lockCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[bgateStyles.lockIcon, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="lock" size={32} color={colors.primary} />
          </View>
          <Text style={[bgateStyles.lockTitle, { color: colors.foreground }]}>App Locked</Text>
          <Text style={[bgateStyles.lockSub, { color: colors.mutedForeground }]}>
            Authenticate to continue
          </Text>

          {error ? (
            <View style={[bgateStyles.errorBox, { backgroundColor: colors.critical + "18", borderColor: colors.critical + "44" }]}>
              <Feather name="alert-circle" size={14} color={colors.critical} />
              <Text style={[bgateStyles.errorText, { color: colors.critical }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[bgateStyles.biometricBtn, { backgroundColor: colors.primary }]}
            onPress={triggerBiometric}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name={Platform.OS === "ios" ? "cpu" : "fingerprint" as never} size={18} color="#fff" />
                <Text style={bgateStyles.biometricBtnText}>
                  {Platform.OS === "ios" ? "Use Face ID / Touch ID" : "Use Fingerprint"}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={onFallback} hitSlop={8}>
            <Text style={[bgateStyles.fallbackText, { color: colors.mutedForeground }]}>
              Use password instead
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, needsBiometricUnlock, unlockBiometric, enableBiometric, isBiometricEnabled } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showBiometricGate, setShowBiometricGate] = useState(false);

  useEffect(() => {
    if (needsBiometricUnlock) {
      setShowBiometricGate(true);
    }
  }, [needsBiometricUnlock]);

  const handleBiometricUnlock = useCallback(() => {
    unlockBiometric();
    router.replace("/(tabs)");
  }, [unlockBiometric, router]);

  const handleBiometricFallback = useCallback(() => {
    setShowBiometricGate(false);
  }, []);

  async function handleLogin() {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Email and password are required.");
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await login(trimmedEmail, trimmedPassword);

      if (Platform.OS !== "web" && !isBiometricEnabled) {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (compatible && enrolled) {
          Alert.alert(
            "Enable Biometric Login",
            `Use ${Platform.OS === "ios" ? "Face ID / Touch ID" : "fingerprint"} to unlock the app on next launch?`,
            [
              { text: "Not Now", style: "cancel", onPress: () => router.replace("/(tabs)") },
              {
                text: "Enable",
                onPress: async () => {
                  try {
                    await enableBiometric();
                  } catch {
                    // silently skip
                  }
                  router.replace("/(tabs)");
                },
              },
            ]
          );
          return;
        }
      }

      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (showBiometricGate) {
    return (
      <BiometricGate
        onUnlock={handleBiometricUnlock}
        onFallback={handleBiometricFallback}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerWrap}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <Feather name="activity" size={28} color="#fff" />
          </View>
          <Text style={[styles.appName, { color: colors.foreground }]}>Mahibere Kidusan</Text>
          <Text style={[styles.appSub, { color: colors.mutedForeground }]}>
            Digital System Operations Center
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Sign in</Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
            Enter your credentials to continue
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.critical + "18", borderColor: colors.critical + "44" }]}>
              <Feather name="alert-circle" size={14} color={colors.critical} />
              <Text style={[styles.errorText, { color: colors.critical }]}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="mail" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!isLoading}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[
              styles.button,
              { backgroundColor: isLoading ? colors.primary + "99" : colors.primary },
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="log-in" size={16} color="#fff" />
                <Text style={styles.buttonText}>Sign in</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          Mahibere Kidusan Digital System Operations Center · Internal Use Only
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const bgateStyles = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  sub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  lockCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    marginTop: 16,
    alignItems: "center",
    gap: 12,
  },
  lockIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  lockTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  lockSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    width: "100%",
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  biometricBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
    marginTop: 4,
  },
  biometricBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  fallbackText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "underline",
  },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 24,
  },
  headerWrap: {
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  appName: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  appSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  cardSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: -8,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  fieldWrap: { gap: 6 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  inputIcon: { flexShrink: 0 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    minHeight: 24,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
    marginTop: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
