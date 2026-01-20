import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, PanResponder, Platform } from "react-native";
import { Mic, Loader2, ChevronUp, ChevronsLeft, ChevronsRight } from "lucide-react-native";

interface RecordingButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  isGettingReady: boolean;
  seconds: number;
  onStartRecording: () => Promise<void>;
  onStopRecording: (cancelled: boolean) => Promise<void>;
}

export function RecordingButton({
  isRecording,
  isProcessing,
  isGettingReady,
  seconds,
  onStartRecording,
  onStopRecording,
}: RecordingButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cancelIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const recordingPulseAnim = useRef(new Animated.Value(1)).current;
  const arrowSlideAnim = useRef(new Animated.Value(0)).current;
  const processingSpinAnim = useRef(new Animated.Value(0)).current;
  const startY = useRef(0);
  const startX = useRef(0);
  const isCancelling = useRef(false);

  // Spinning animation for processing state
  useEffect(() => {
    if (isProcessing) {
      Animated.loop(
        Animated.timing(processingSpinAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();
    } else {
      processingSpinAnim.setValue(0);
    }
  }, [isProcessing]);

  const spinInterpolate = processingSpinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Pulse animation for recording state
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingPulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(recordingPulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      recordingPulseAnim.setValue(1);
      // Reset scale animation when not recording
      scaleAnim.setValue(1);
    }
  }, [isRecording]);

  // Animated arrows for "slide to cancel" gesture
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(arrowSlideAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(arrowSlideAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      arrowSlideAnim.setValue(0);
      // Reset cancel indicator when not recording
      cancelIndicatorOpacity.setValue(0);
    }
  }, [isRecording]);

  const panResponder = Platform.OS === 'web' 
    ? { panHandlers: {} }
    : PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: async (_, gesture) => {
          startY.current = gesture.y0;
          startX.current = gesture.x0;
          isCancelling.current = false;
          await onStartRecording();
        },
        onPanResponderMove: (_, gesture) => {
          const horizontalDistance = Math.abs(gesture.moveX - startX.current);
          const verticalDistance = startY.current - gesture.moveY;
          
          if (verticalDistance > 80 || horizontalDistance > 80) {
            if (!isCancelling.current) {
              isCancelling.current = true;
              Animated.timing(cancelIndicatorOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }).start();
            }
          } else {
            if (isCancelling.current) {
              isCancelling.current = false;
              Animated.timing(cancelIndicatorOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }).start();
            }
          }
        },
        onPanResponderRelease: () => {
          const wasCancelling = isCancelling.current;
          onStopRecording(wasCancelling);
          isCancelling.current = false;
          
          // Reset cancel indicator
          Animated.timing(cancelIndicatorOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        },
      });

  return (
    <View style={styles.container}>
      {/* Subtitle or Processing Indicator */}
      {isProcessing ? (
        <View style={styles.processingContainer}>
          <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
            <Loader2 size={20} color="#3b82f6" />
          </Animated.View>
          <Text style={styles.processingText}>Processing invoice...</Text>
        </View>
      ) : (
        <Text style={styles.subtitle}>
          {isGettingReady ? "Get ready..." : "Press and hold to record"}
        </Text>
      )}

      <View style={styles.recordingArea}>
        <View style={styles.timerContainer}>
          {isRecording && (
            <Text style={styles.recordingText}>
              {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, "0")}
            </Text>
          )}
        </View>

        <View style={styles.micButtonContainer}>
          {/* Pulsing rings around mic button while recording */}
          {isRecording && (
            <>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: recordingPulseAnim }],
                    opacity: recordingPulseAnim.interpolate({
                      inputRange: [1, 1.15],
                      outputRange: [0.6, 0],
                    }),
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ 
                      scale: recordingPulseAnim.interpolate({
                        inputRange: [1, 1.15],
                        outputRange: [1.05, 1.2],
                      })
                    }],
                    opacity: recordingPulseAnim.interpolate({
                      inputRange: [1, 1.15],
                      outputRange: [0.3, 0],
                    }),
                  },
                ]}
              />
            </>
          )}

          <Animated.View
              {...(isProcessing ? {} : panResponder.panHandlers)}
              style={[
                styles.micButton,
                {
                  backgroundColor: isRecording 
                    ? "#dc2626" 
                    : isGettingReady 
                    ? "#f59e0b" 
                    : "#2563eb",
                  transform: [
                    { scale: isGettingReady ? pulseAnim : scaleAnim }
                  ],
                  opacity: isProcessing ? 0.4 : 1,
                },
              ]}
              pointerEvents={isProcessing ? "none" : "auto"}
          >
            <Mic size={36} color="white" />
            
            {/* Cancel swipe indicator - overlays on button */}
            <Animated.View
              style={[
                styles.swipeOverlay,
                { 
                  opacity: cancelIndicatorOpacity,
                  backgroundColor: 'rgba(239, 68, 68, 0.9)',
                }
              ]}
            >
              <Text style={styles.swipeText}>✕</Text>
            </Animated.View>
          </Animated.View>
        </View>

        {/* Animated arrows for slide to cancel gesture */}
        {isRecording && (
          <View style={styles.gestureIndicators}>
            {/* Up arrow */}
            <Animated.View
              style={[
                styles.arrowIndicator,
                styles.arrowUp,
                {
                  opacity: arrowSlideAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 0.8, 0.3],
                  }),
                  transform: [
                    {
                      translateY: arrowSlideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -10],
                      }),
                    },
                  ],
                },
              ]}
            >
              <ChevronUp size={20} color="#ef4444" strokeWidth={3} />
            </Animated.View>

            {/* Left arrows */}
            <Animated.View
              style={[
                styles.arrowIndicator,
                styles.arrowLeft,
                {
                  opacity: arrowSlideAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 0.8, 0.3],
                  }),
                  transform: [
                    {
                      translateX: arrowSlideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -10],
                      }),
                    },
                  ],
                },
              ]}
            >
              <ChevronsLeft size={24} color="#ef4444" strokeWidth={3} />
            </Animated.View>

            {/* Right arrows */}
            <Animated.View
              style={[
                styles.arrowIndicator,
                styles.arrowRight,
                {
                  opacity: arrowSlideAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 0.8, 0.3],
                  }),
                  transform: [
                    {
                      translateX: arrowSlideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 10],
                      }),
                    },
                  ],
                },
              ]}
            >
              <ChevronsRight size={24} color="#ef4444" strokeWidth={3} />
            </Animated.View>
          </View>
        )}
      </View>

      <Text style={styles.helperText}>
        Hold to record • Slide to cancel
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  subtitle: { 
    textAlign: "center", 
    color: "#94a3b8", 
    marginBottom: 12 
  },
  processingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  processingText: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "500",
  },
  recordingArea: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 140,
  },
  timerContainer: {
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  micButtonContainer: {
    width: 96,
    height: 96,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  recordingText: { 
    color: "#ef4444", 
    textAlign: "center", 
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 1,
  },
  micButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    zIndex: 2,
  },
  pulseRing: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: "#dc2626",
    zIndex: 1,
  },
  gestureIndicators: {
    position: "absolute",
    width: 200,
    height: 200,
    top: 0,
    zIndex: 0,
  },
  arrowIndicator: {
    position: "absolute",
  },
  arrowUp: {
    top: 0,
    left: "50%",
    marginLeft: -12,
  },
  arrowLeft: {
    left: 20,
    top: "50%",
    marginTop: 16,
  },
  arrowRight: {
    right: 20,
    top: "50%",
    marginTop: 16,
  },
  swipeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  swipeText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "700",
  },
  helperText: { 
    textAlign: "center", 
    color: "#94a3b8", 
    fontSize: 12,
    marginTop: 8,
  },
});
