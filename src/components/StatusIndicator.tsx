import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { JobStatus } from "../websocket/jobWebSocket";

interface StatusIndicatorProps {
  status: JobStatus;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === "PENDING" || status === "RUNNING") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
    return () => pulseAnim.setValue(1);
  }, [status]);

  const getColor = () => {
    switch (status) {
      case "PENDING":
        return "#ca8a04";
      case "RUNNING":
        return "#2563eb";
      case "DONE":
        return "#16a34a";
      case "FAILED":
        return "#dc2626";
    }
  };

  return (
    <Animated.View
      style={[
        styles.statusDot,
        { 
          backgroundColor: getColor(),
          opacity: status === "DONE" || status === "FAILED" ? 1 : pulseAnim,
        }
      ]}
    />
  );
}

const styles = StyleSheet.create({
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
});
