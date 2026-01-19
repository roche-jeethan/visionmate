import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import Collapsible from "react-native-collapsible";

// Hooks & Context
import { useTranslation, SUPPORTED_LANGUAGES } from "../context/TranslationContext";
import { useSpeech } from "../hooks/useSpeech";
import { useScreenAnnounce } from "../hooks/useScreenAnnounce";

// Services
import {
  addEmergencyContact,
  deleteEmergencyContact,
  getEmergencyContacts,
  saveDefaultContact,
} from "../services/userService";

export default function SettingsScreen() {
  useScreenAnnounce("Settings");

  const auth = getAuth();
  const { targetLanguage, setTargetLanguage, translateText } = useTranslation();
  const speakText = useSpeech();

  // UI state
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isLangExpanded, setIsLangExpanded] = useState(false);
  const [isContactsCollapsed, setIsContactsCollapsed] = useState(true);

  // Auth inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Contacts
  const [contactInput, setContactInput] = useState("");
  const [contacts, setContacts] = useState<string[]>([]);
  const [isAddingContact, setIsAddingContact] = useState(false);

  const [translations, setTranslations] = useState<Record<string, string>>({});

  // UI strings
  const uiStrings = {
    settings: "Settings",
    langSettings: "Language Settings",
    loginRegister: "Login or Register",
    email: "Email",
    password: "Password",
    login: "Login",
    register: "Register",
    logout: "Logout",
    yourContacts: "Emergency Contacts",
    addContact: "Add Contact",
    addNumber: "Enter 10 digit number",
    noContacts: "No contacts found.",
    cancel: "Cancel",
    deleteContact: "Delete Contact",
    deleteConfirmation: "Are you sure you want to delete",
    loggedIn: "Logged in",
    loginInError: "Login Error",
    rgSuccess: "Registered successfully",
    rgError: "Registration Error",
  };

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) loadContacts();
    });
    return unsubscribe;
  }, []);

  // Translate UI
  useEffect(() => {
    const translateUI = async () => {
      if (targetLanguage === "en") {
        setTranslations(uiStrings);
        return;
      }

      setIsTranslating(true);
      try {
        const translated: Record<string, string> = {};
        for (const key in uiStrings) {
          translated[key] = await translateText(
            uiStrings[key as keyof typeof uiStrings]
          );
        }
        setTranslations(translated);
      } catch {
        setTranslations(uiStrings);
      } finally {
        setIsTranslating(false);
      }
    };

    translateUI();
  }, [targetLanguage]);

  const loadContacts = async () => {
    try {
      const data = await getEmergencyContacts();
      setContacts(data);
    } catch (e) {
      console.error(e);
    }
  };

  // ---------- AUTH HANDLERS ----------
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      Alert.alert(translations.loggedIn);
      await speakText(translations.loggedIn);
    } catch (error: any) {
      Alert.alert(translations.loginInError, error.message);
    }
  };

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      Alert.alert(translations.rgSuccess);
      await speakText(translations.rgSuccess);
    } catch (error: any) {
      Alert.alert(translations.rgError, error.message);
    }
  };

  // ---------- CONTACTS ----------
  const handleAddContact = async () => {
    if (!contactInput.trim()) return;

    try {
      const formatted = `+91${contactInput.trim()}`;
      await addEmergencyContact(formatted);
      setContactInput("");
      setIsAddingContact(false);

      Alert.alert("Set as default?", "", [
        { text: "Yes", onPress: () => saveDefaultContact(formatted) },
        { text: "No" },
      ]);

      loadContacts();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const confirmDelete = (contact: string) => {
    Alert.alert(
      translations.deleteContact,
      `${translations.deleteConfirmation} ${contact}?`,
      [
        { text: translations.cancel, style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteEmergencyContact(contact);
            loadContacts();
          },
        },
      ]
    );
  };

  const handleLanguageSelect = async (lang: string) => {
    await setTargetLanguage(lang);
    await speakText("Language changed");
  };

  const formatName = (email: string) =>
    email.split("@")[0].charAt(0).toUpperCase() +
    email.split("@")[0].slice(1);

  if (loading || isTranslating) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={25}
    >
      {!user ? (
        <View style={styles.loginContainer}>
          <MaterialIcons name="account-circle" size={80} color="#007AFF" />
          <Text style={styles.loginTitle}>{translations.loginRegister}</Text>

          <TextInput
            placeholder={translations.email}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.loginInput}
          />
          <TextInput
            placeholder={translations.password}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.loginInput}
          />

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.btnText}>{translations.login}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: "#34C759" }]}
            onPress={handleRegister}
          >
            <Text style={styles.btnText}>{translations.register}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.mainTitle}>{translations.settings}</Text>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.profileHeader}>
              <View>
                <Text style={styles.greeting}>Hello,</Text>
                <Text style={styles.userName}>{formatName(user.email)}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
              <MaterialIcons name="account-circle" size={70} color="#007AFF" />
            </View>

            {/* CONTACTS */}
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.rowBetween}
                onPress={() => setIsContactsCollapsed(!isContactsCollapsed)}
              >
                <Text style={styles.cardTitle}>
                  {translations.yourContacts}
                </Text>
                <MaterialIcons
                  name={
                    isContactsCollapsed
                      ? "keyboard-arrow-down"
                      : "keyboard-arrow-up"
                  }
                  size={24}
                  color="#007AFF"
                />
              </TouchableOpacity>

              <Collapsible collapsed={isContactsCollapsed}>
                {contacts.length === 0 ? (
                  <Text style={styles.noContacts}>
                    {translations.noContacts}
                  </Text>
                ) : (
                  contacts.map((c, i) => (
                    <View key={i} style={styles.contactRow}>
                      <Text>{c}</Text>
                      <TouchableOpacity onPress={() => confirmDelete(c)}>
                        <MaterialIcons
                          name="delete-outline"
                          size={22}
                          color="crimson"
                        />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {isAddingContact ? (
                  <>
                    <TextInput
                      placeholder={translations.addNumber}
                      keyboardType="numeric"
                      value={contactInput}
                      onChangeText={setContactInput}
                      style={styles.loginInput}
                      maxLength={10}
                    />
                    <TouchableOpacity
                      style={styles.loginButton}
                      onPress={handleAddContact}
                    >
                      <Text style={styles.btnText}>Save</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.btnOutline}
                    onPress={() => setIsAddingContact(true)}
                  >
                    <Text style={styles.btnOutlineText}>
                      + {translations.addContact}
                    </Text>
                  </TouchableOpacity>
                )}
              </Collapsible>
            </View>

            {/* LANGUAGE */}
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.rowBetween}
                onPress={() => setIsLangExpanded(!isLangExpanded)}
              >
                <Text style={styles.cardTitle}>
                  {translations.langSettings}
                </Text>
                <Ionicons
                  name={isLangExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                />
              </TouchableOpacity>

              <Collapsible collapsed={!isLangExpanded}>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <TouchableOpacity
                    key={l.code}
                    style={styles.langItem}
                    onPress={() => handleLanguageSelect(l.code)}
                  >
                    <Text>{l.name}</Text>
                  </TouchableOpacity>
                ))}
              </Collapsible>
            </View>

            <TouchableOpacity
              style={styles.btnLogout}
              onPress={() => signOut(auth)}
            >
              <Text style={styles.btnText}>{translations.logout}</Text>
            </TouchableOpacity>
          </ScrollView>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E6E6FA" },
  loader: { flex: 1, justifyContent: "center" },
  mainTitle: { fontSize: 30, fontWeight: "bold", margin: 20 },
  scrollContainer: { padding: 20 },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  greeting: { fontSize: 16, color: "#666" },
  userName: { fontSize: 24, fontWeight: "bold" },
  userEmail: { fontSize: 14, color: "#666" },
  card: { backgroundColor: "#fff", padding: 15, borderRadius: 15, marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: "bold" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  contactRow: { flexDirection: "row", justifyContent: "space-between", padding: 10 },
  noContacts: { textAlign: "center", color: "#888" },
  btnOutline: {
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnOutlineText: { color: "#2f43fa" },
  btnLogout: {
    backgroundColor: "crimson",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "bold" },
  langItem: { padding: 10 },
  loginContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loginTitle: { fontSize: 24, fontWeight: "bold", marginVertical: 20 },
  loginInput: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  loginButton: {
    width: "100%",
    backgroundColor: "#2f43fa",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
});
