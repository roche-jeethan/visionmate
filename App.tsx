import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Ionicons } from "@expo/vector-icons";
import { LogBox } from "react-native";
import { TranslationProvider } from "./src/context/TranslationContext";

import { SERVER_IP } from "./src/config/config";

import SettingsScreen from "./src/screens/SettingsScreen";
import EmergencyScreen from "./src/screens/EmergencyScreen";
import CameraScreen from "./src/screens/CameraScreen";
import LocationScreen from "./src/screens/LocationScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import DescribeScreen from "./src/screens/DescribeScreen";
import { BiometricAuth } from "./src/components/auth/BiometricAuth";

import { setServerHost } from "./src/config/runtime";

LogBox.ignoreAllLogs();

const screens = [
  { name: "Settings", component: SettingsScreen, icon: "settings" },
  { name: "Profile", component: ProfileScreen, icon: "person" },
  { name: "Emergency", component: EmergencyScreen, icon: "alert-circle" },
  { name: "Camera", component: CameraScreen, icon: "camera" },
  { name: "Describe", component: DescribeScreen, icon: "book" },
];

const Tab = createMaterialTopTabNavigator();

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <BiometricAuth onAuthSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Settings"
        screenOptions={{
          tabBarActiveTintColor: "white",
          tabBarLabelStyle: { fontSize: 0.5 },
          tabBarStyle: { backgroundColor: "#005FCC", paddingTop: 50 },
          tabBarIndicatorStyle: { backgroundColor: "white" },
          swipeEnabled: true,
        }}
      >
        {screens.map((screen) => (
          <Tab.Screen
            key={screen.name}
            name={screen.name}
            component={screen.component}
            options={{
              tabBarIcon: ({ color }) => (
                <Ionicons
                  name={screen.icon as keyof (typeof Ionicons)["glyphMap"]}
                  size={24}
                  color={color}
                />
              ),
            }}
          />
        ))}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    (async () => {
      try {
        const host = SERVER_IP;
        console.log("Resolved backend host:", host); 
        setServerHost(host);
      } catch (err) {
        console.warn("Failed to resolve server IP, using fallback", err);
      }
    })();
  }, []);

  return (
    <TranslationProvider>
      <AppContent />
    </TranslationProvider>
  );
}
