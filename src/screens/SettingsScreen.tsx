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
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import Collapsible from "react-native-collapsible";

// Hooks & Context
import { useTranslation, SUPPORTED_LANGUAGES } from "../context/TranslationContext";
import { useSpeech } from "../hooks/useSpeech";
import { useScreenAnnounce } from "../hooks/useScreenAnnounce";

// Services
import { addEmergencyContact, deleteEmergencyContact, getEmergencyContacts, saveDefaultContact } from "../services/userService";

export default function SettingsScreen() {
  const auth = getAuth();
  const { targetLanguage, setTargetLanguage, translateText } = useTranslation();
  const speakText = useSpeech();
  useScreenAnnounce("Settings");

  // UI State
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false); // Added from Profile
  const [isLangExpanded, setIsLangExpanded] = useState(false);
  const [isContactsCollapsed, setIsContactsCollapsed] = useState(true);
  
  // Input State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contactInput, setContactInput] = useState("");
  const [contacts, setContacts] = useState<string[]>([]);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});

  const uiStrings = {
    settings: "Settings",
    profile: "Profile",
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
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) loadContacts();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const translateUI = async () => {
      setIsTranslating(true); // Show loader during translation
      try {
        const translated: Record<string, string> = {};
        for (const key in uiStrings) {
          translated[key] = await translateText(uiStrings[key as keyof typeof uiStrings]);
        }
        setTranslations(translated);
      } catch (error) {
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
    } catch (error: any) { console.error(error.message); }
  };

  const handleLanguageSelect = async (langCode: string) => {
    await setTargetLanguage(langCode);
    const msg = langCode === "en" ? "Language changed" : "भाषा बदल दी गई है";
    await speakText(msg);
  };

  const handleAddContact = async () => {
    if (!contactInput.trim()) return;
    try {
      const formattedNumber = `+91${contactInput.trim()}`;
      await addEmergencyContact(formattedNumber);
      setContactInput("");
      setIsAddingContact(false);
      Alert.alert("Set as default?", "", [
        { text: "Yes", onPress: () => saveDefaultContact(formattedNumber) },
        { text: "No" }
      ]);
      loadContacts();
    } catch (error: any) { Alert.alert("Error", error.message); }
  };

  // Improved Delete Logic with Alert Confirmation
  const confirmDelete = (contact: string) => {
    Alert.alert(
      translations.deleteContact || "Delete Contact",
      `${translations.deleteConfirmation || "Are you sure?"} ${contact}?`,
      [
        { text: translations.cancel || "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            await deleteEmergencyContact(contact);
            loadContacts();
          } 
        }
      ]
    );
  };

  const formatName = (email: string) => {
    const name = email.split("@")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  if (loading || isTranslating) return <ActivityIndicator size="large" style={styles.loader} color="#007AFF" />;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 25}
    >
      {!user ? (
        /* UPDATED: Matches ProfileScreen Login UI */
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

          <TouchableOpacity style={styles.loginButton} onPress={() => signInWithEmailAndPassword(auth, email, password)}>
            <Text style={styles.btnText}>{translations.login}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: "#34C759" }]}
            onPress={() => createUserWithEmailAndPassword(auth, email, password)}
          >
            <Text style={styles.btnText}>{translations.register}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.mainTitle}>{translations.settings}</Text>
          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            
            {/* Profile Header */}
            <View style={styles.profileHeader}>
              <View style={styles.userInfo}>
                <Text style={styles.greeting}>Hello,</Text>
                <Text style={styles.userName}>{formatName(user.email)}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
              <MaterialIcons name="account-circle" size={70} color="#007AFF" />
            </View>

            {/* Emergency Contacts Card */}
            <View style={styles.card}>
              <TouchableOpacity style={styles.rowBetween} onPress={() => setIsContactsCollapsed(!isContactsCollapsed)}>
                <Text style={styles.cardTitle}>{translations.yourContacts}</Text>
                <MaterialIcons name={isContactsCollapsed ? "keyboard-arrow-down" : "keyboard-arrow-up"} size={24} color="#007AFF" />
              </TouchableOpacity>

              <Collapsible collapsed={isContactsCollapsed}>
                {contacts.length === 0 ? (
                  <Text style={styles.noContacts}>{translations.noContacts}</Text>
                ) : (
                  contacts.map((c, i) => (
                    <View key={i} style={styles.contactRow}>
                      <Text style={styles.contactText}>{c}</Text>
                      <TouchableOpacity onPress={() => confirmDelete(c)}>
                        <MaterialIcons name="delete-outline" size={22} color="crimson" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {isAddingContact ? (
                  <View style={styles.addBox}>
                    <View style={styles.phoneInputRow}>
                       <Text style={styles.prefix}>+91</Text>
                       <TextInput 
                          placeholder={translations.addNumber} 
                          keyboardType="numeric" 
                          value={contactInput} 
                          onChangeText={setContactInput} 
                          style={styles.phoneInput} 
                          maxLength={10}
                        />
                    </View>
                    <View style={styles.buttonRow}>
                      <TouchableOpacity style={styles.saveButton} onPress={handleAddContact}>
                        <Text style={styles.btnText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelButton} onPress={() => setIsAddingContact(false)}>
                        <Text style={styles.btnText}>{translations.cancel}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.btnOutline} onPress={() => setIsAddingContact(true)}>
                    <Text style={styles.btnOutlineText}>+ {translations.addContact}</Text>
                  </TouchableOpacity>
                )}
              </Collapsible>
            </View>

            <View style={styles.card}>
              <TouchableOpacity style={styles.rowBetween} onPress={() => setIsLangExpanded(!isLangExpanded)}>
                <View style={styles.row}>
                  <Ionicons name="language" size={22} color="#007AFF" />
                  <Text style={[styles.cardTitle, { marginLeft: 10, marginBottom: 0 }]}>{translations.langSettings}</Text>
                </View>
                <Ionicons name={isLangExpanded ? "chevron-up" : "chevron-down"} size={20} color="#007AFF" />
              </TouchableOpacity>

              <Collapsible collapsed={!isLangExpanded}>
                <View style={{ marginTop: 10 }}>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <TouchableOpacity
                      key={lang.code}
                      style={[styles.langItem, targetLanguage === lang.code && styles.langSelected]}
                      onPress={() => handleLanguageSelect(lang.code)}
                    >
                      <Text style={[styles.langText, targetLanguage === lang.code && styles.whiteText]}>{lang.name}</Text>
                      {targetLanguage === lang.code && <Ionicons name="checkmark" size={20} color="white" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </Collapsible>
            </View>

            <TouchableOpacity style={styles.btnLogout} onPress={() => signOut(auth)}>
              <MaterialIcons name="logout" size={20} color="white" />
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
  mainTitle: { fontSize: 30, fontWeight: "bold", margin: 20, marginBottom: 5 },
  scrollContainer: { padding: 20 },
  profileHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "white", padding: 20, borderRadius: 15, marginBottom: 20,
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4,
  },
  userInfo: { flex: 1 },
  greeting: { fontSize: 16, color: "#666" },
  userName: { fontSize: 24, fontWeight: "bold", color: "#333", marginVertical: 4 },
  userEmail: { fontSize: 14, color: "#666" },
  card: { backgroundColor: "#fff", borderRadius: 15, padding: 15, marginBottom: 15, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: '#f9f9f9' },
  phoneInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 12, marginBottom: 10, backgroundColor: '#f9f9f9' },
  prefix: { fontSize: 16, color: '#333', marginRight: 5 },
  phoneInput: { flex: 1, height: 45 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  btnPrimary: { backgroundColor: "#2f43fa", padding: 12, borderRadius: 8, flex: 1, alignItems: "center", marginHorizontal: 5 },
  saveButton: { backgroundColor: "#2f43fa", padding: 12, borderRadius: 8, flex: 1, alignItems: "center", marginRight: 5 },
  cancelButton: { backgroundColor: "#666", padding: 12, borderRadius: 8, flex: 1, alignItems: "center", marginLeft: 5 },
  btnText: { color: "#fff", fontWeight: "bold" },
  contactRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  contactText: { fontSize: 16, color: "#444" },
  noContacts: { textAlign: 'center', color: '#888', padding: 10 },
  btnOutline: { padding: 12, borderStyle: "dashed", borderWidth: 1, borderColor: "#2f43fa", borderRadius: 8, alignItems: "center", marginTop: 10 },
  btnOutlineText: { color: "#2f43fa", fontWeight: "600" },
  addBox: { marginTop: 10 },
  btnLogout: { backgroundColor: "crimson", flexDirection: 'row', padding: 15, borderRadius: 10, justifyContent: 'center', alignItems: "center", marginBottom: 10 },
  langItem: { flexDirection: "row", justifyContent: "space-between", padding: 12, borderRadius: 8, marginTop: 5 },
  langSelected: { backgroundColor: "#005FCC" },
  langText: { fontSize: 16, color: '#333' },
  whiteText: { color: "#fff" },
  loginContainer: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E6E6FA",
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginVertical: 20,
    color: "#333",
  },
  loginInput: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#ddd",
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