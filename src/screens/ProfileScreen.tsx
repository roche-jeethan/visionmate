import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  addEmergencyContact,
  deleteEmergencyContact,
  getEmergencyContacts,
  saveDefaultContact,
} from "../services/userService";
import { useTranslation } from "../context/TranslationContext";
import {
  doc,
  getFirestore,
  updateDoc,
  collection,
  where,
  getDocs,
  query,
} from "firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import Collapsible from "react-native-collapsible";

export default function Profile() {
  const auth = getAuth();
  const { targetLanguage, translateText } = useTranslation();

  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [input, setInput] = useState("");
  const [contacts, setContacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Strings to be translated
  const uiStrings = {
    loginRegister: "Login or Register",
    email: "Email",
    password: "Password",
    login: "Login",
    register: "Register",
    welcome: "Welcome",
    yourContacts: "Your Emergency Contacts",
    noContacts: "No contacts found.",
    addContact: "Add Contact",
    cancel: "Cancel",
    logout: "Logout",
    addNumber: "Add new number",
    deleteConfirmation: "Are you sure you want to delete",
    deleteContact: "Delete Contact",
    loggedOut: "Logged out",
    error: "Error",
    loggedIn: "Logged in",
    loginInError: "Login Error",
    rgSuccess: "Registered successfully",
    rgError: "Registration Error",
  };

  // Translate UI on language change
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
      } catch (error) {
        console.error("Translation error:", error);
      } finally {
        setIsTranslating(false);
      }
    };

    translateUI();
  }, [targetLanguage]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) loadContacts();
    });
    return unsubscribe;
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await getEmergencyContacts();
      setContacts(data);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    const auth = getAuth();
    const contactId = auth.currentUser?.uid;
    if (!input.trim()) return;

    try {
      const formattedNumber = `+91${input.trim()}`; // Remove space after +91
      await addEmergencyContact(formattedNumber);
      setInput("");

      Alert.alert("Do you want it to be a default number?", "", [
        {
          text: "Yes",
          onPress: async () => saveDefaultContact(formattedNumber),
        },
        { text: "No" },
      ]);

      loadContacts();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleDeleteContact = (contact: string) => {
    Alert.alert(
      translations.deleteContact || "Delete Contact",
      `${
        translations.deleteConfirmation || "Are you sure you want to delete"
      } ${contact}?`,
      [
        { text: translations.cancel || "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEmergencyContact(contact);
              loadContacts();
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      Alert.alert(translations.loggedOut || "Logged out");
    } catch (error: any) {
      Alert.alert(translations.error || "Error", error.message);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      Alert.alert(translations.loggedIn || "Logged in");
    } catch (error: any) {
      Alert.alert(translations.loggedInError || "Login Error", error.message);
    }
  };

  const handleRegister = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      Alert.alert(translations.rgSuccess || "Registered successfully");
    } catch (error: any) {
      Alert.alert(translations.rgError || "Registration Error", error.message);
    }
  };

  if (loading || isTranslating) {
    return (
      <ActivityIndicator size="large" color="#000" style={styles.loader} />
    );
  }

  if (!user) {
    return (
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
          <Text style={styles.buttonText}>{translations.login}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginButton, styles.registerButton]}
          onPress={handleRegister}
        >
          <Text style={styles.buttonText}>{translations.register}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 25}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>
              {user.email.split("@")[0].charAt(0).toUpperCase() +
                user.email.split("@")[0].slice(1)}
            </Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <Text style={styles.userPhone}>+91 XXXXXXXXXX</Text>
          </View>
          <View style={styles.avatarContainer}>
            <MaterialIcons name="account-circle" size={80} color="#007AFF" />
          </View>
        </View>

        {/* Contacts Section */}
        <View style={styles.contactsCollapse}>
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setIsCollapsed(!isCollapsed)}
          >
            <Text style={styles.contactsTitle}>
              {translations.yourContacts}
            </Text>
            <MaterialIcons
              name={isCollapsed ? "keyboard-arrow-down" : "keyboard-arrow-up"}
              size={24}
              color="#007AFF"
            />
          </TouchableOpacity>

          <Collapsible collapsed={isCollapsed}>
            {contacts.length === 0 ? (
              <Text style={styles.noContacts}>{translations.noContacts}</Text>
            ) : (
              <ScrollView style={styles.contactsScrollView}>
                {contacts.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.contactItem}
                    onPress={() => handleDeleteContact(item)}
                  >
                    <Text style={styles.contactText}>{item}</Text>
                    <MaterialIcons
                      name="delete-outline"
                      size={24}
                      color="crimson"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Collapsible>
        </View>

        {/* Action Buttons */}
        <View style={[styles.actionGrid, { marginBottom: 20 }]}>
          {isAdding ? (
            <View style={styles.addContactForm}>
              <View style={styles.phoneInputContainer}>
                <Text style={styles.countryCode}>+91</Text>
                <TextInput
                  placeholder={translations.addNumber}
                  value={input}
                  onChangeText={setInput}
                  keyboardType="numeric"
                  style={styles.phoneInput}
                />
              </View>
              <View style={styles.addContactButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.confirmButton]}
                  onPress={handleAddContact}
                >
                  <Text style={styles.buttonText}>
                    {translations.addContact}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => {
                    setIsAdding(false);
                    setInput("");
                  }}
                >
                  <Text style={styles.buttonText}>{translations.cancel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.buttonGrid}>
              <TouchableOpacity
                style={[styles.actionButton, styles.addButton]}
                onPress={() => setIsAdding(true)}
              >
                <MaterialIcons name="person-add" size={24} color="white" />
                <Text style={styles.buttonText}>{translations.addContact}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.logoutButton]}
                onPress={handleLogout}
              >
                <MaterialIcons name="logout" size={24} color="white" />
                <Text style={styles.buttonText}>{translations.logout}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContainer: {
    padding: 20,
    flexGrow: 1,
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 20,
    borderRadius: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: "#666",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginVertical: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: "#666",
  },
  avatarContainer: {
    marginLeft: 20,
  },
  contactsCollapse: {
    backgroundColor: "white",
    borderRadius: 15,
    marginTop: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: 400, // Add maximum height
  },
  collapseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
  },
  contactsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  contactsList: {
    maxHeight: 200,
  },
  contactItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  contactText: {
    fontSize: 16,
    color: "#333",
  },
  noContacts: {
    padding: 20,
    color: "#666",
    textAlign: "center",
  },
  actionGrid: {
    marginTop: 20,
  },
  buttonGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  addButton: {
    backgroundColor: "#007AFF",
  },
  logoutButton: {
    backgroundColor: "crimson",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  addContactForm: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 15,
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  countryCode: {
    fontSize: 16,
    color: "#333",
    marginRight: 10,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  addContactButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  confirmButton: {
    backgroundColor: "#007AFF",
  },
  cancelButton: {
    backgroundColor: "#666",
  },
  // Login screen styles
  loginContainer: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
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
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  registerButton: {
    backgroundColor: "#34C759",
  },
  contactsScrollView: {
    maxHeight: 300, // Adjust this value based on your needs
  },
});
