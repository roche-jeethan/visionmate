import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Ionicons } from "@expo/vector-icons"; 

import { LogBox } from "react-native";

import { TranslationProvider } from "./src/context/TranslationContext";

import SettingsScreen from "./src/screens/SettingsScreen";
import EmergencyScreen from "./src/screens/EmergencyScreen";
import CameraScreen from "./src/screens/CameraScreen";
import LocationScreen from "./src/screens/LocationScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

LogBox.ignoreAllLogs();

const screens = [
  { name: "Settings", component: SettingsScreen, icon: "settings" },
  { name: "Emergency", component: EmergencyScreen, icon: "alert-circle" },
  { name: "Camera", component: CameraScreen, icon: "camera" },
  { name: "Location", component: LocationScreen, icon: "location" },
  { name: "Profile", component: ProfileScreen, icon: "person" },
];

const Tab = createMaterialTopTabNavigator();

export default function App() {
  return (
    <TranslationProvider>
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Profile"
          screenOptions={{
            tabBarActiveTintColor: "white",
            tabBarLabelStyle: { fontSize: 0.5},  
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
                  <Ionicons name={screen.icon as keyof typeof Ionicons['glyphMap']} size={24} color={color} />
                ),
              }}
            />
          ))}
        </Tab.Navigator>
      </NavigationContainer>
    </TranslationProvider>
  );
}
