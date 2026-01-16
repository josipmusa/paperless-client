import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Info } from "lucide-react-native";

export function RecordingTips() {
  return (
    <View style={styles.tipBox}>
      <Info size={20} color="#2563eb" />
      <View style={{ marginLeft: 8 }}>
        <Text style={styles.tipTitle}>Tips for best results:</Text>
        <Text style={styles.tip}>• Speak clearly</Text>
        <Text style={styles.tip}>• Include items & amounts</Text>
        <Text style={styles.tip}>• Mention full name of client</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tipBox: {
    flexDirection: "row",
    backgroundColor: "#334155",
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  tipTitle: { 
    fontWeight: "600", 
    marginBottom: 4, 
    color: "#f1f5f9" 
  },
  tip: { 
    fontSize: 12, 
    color: "#cbd5e1" 
  },
});
