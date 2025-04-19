// screens/DescribeScreen.tsx
import React from "react";
import { SafeAreaView } from "react-native";
import CameraView from "../components/CameraView";

const DescribeScreen = () => {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <CameraView />
    </SafeAreaView>
  );
};

export default DescribeScreen;
