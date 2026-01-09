import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Animated,
  PanResponder,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Mic,
  Menu,
  Settings,
  Download,
  Eye,
  Info,
  Bell,
  CheckCircle,
} from "lucide-react-native";
import { useAudioRecorder, RecordingPresets, setAudioModeAsync, requestRecordingPermissionsAsync } from "expo-audio";
import { createInvoiceFromVoice } from "../api/invoiceApi";

type InvoiceStatus = "PENDING" | "RUNNING" | "COMPLETED";

type Invoice = {
  id: number;
  client: string;
  amount?: string;
  status: InvoiceStatus;
};

export default function VoiceToInvoiceScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const invoiceCounter = useRef(1248);
  
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const startY = useRef(0);
  const startX = useRef(0);
  const isCancelling = useRef(false);
  const recordingStartTime = useRef(0);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current!);
      setSeconds(0);
    }

    return () => clearInterval(timerRef.current!);
  }, [isRecording]);

  const startRecording = async () => {
    if (isProcessing) return;

    try {
      // Request permissions
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission Required", "Microphone access is needed to record audio.");
        return;
      }

      // Configure audio mode
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Start recording
      await recorder.prepareToRecordAsync()
      recorder.record();

      recordingStartTime.current = Date.now();
      setIsRecording(true);
      Animated.spring(scaleAnim, {
        toValue: 1.15,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Error", "Failed to start recording. Please try again.");
    }
  };

  const stopRecording = async (cancelled: boolean) => {
    const recordingDuration = Date.now() - recordingStartTime.current;
    
    setIsRecording(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    // Ignore accidental taps (less than 500ms)
    if (recordingDuration < 500) {
      await recorder.stop();
      return;
    }

    if (cancelled) {
      await recorder.stop();
      return;
    }

    // Stop recording and get URI
    try {
      await recorder.stop();
      const uri = recorder.uri

      if (!uri) {
        Alert.alert("Error", "Failed to save recording.");
        return;
      }

      // Create invoice from voice
      const id = invoiceCounter.current++;
      setIsProcessing(true);

      setInvoices((prev) => [
        { id, client: "Processing...", status: "PENDING" },
        ...prev.slice(0, 2),
      ]);

      try {
        const invoiceId = await createInvoiceFromVoice(uri);
        
        updateInvoice(id, "RUNNING");

        // Poll or wait for completion - for now, simulate
        setTimeout(() => {
          updateInvoice(id, "COMPLETED");
          setIsProcessing(false);
          setShowSuccess(true);
        }, 5000);
      } catch (error) {
        console.error("Failed to create invoice:", error);
        setInvoices((prev) => prev.filter((inv) => inv.id !== id));
        setIsProcessing(false);
        Alert.alert("Error", "Failed to process recording. Please try again.");
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      Alert.alert("Error", "Failed to process recording.");
      setIsProcessing(false);
    }
  };

  const updateInvoice = (id: number, status: InvoiceStatus) => {
    setInvoices((prev) =>
        prev.map((inv) =>
            inv.id === id
                ? {
                  ...inv,
                  status,
                  client: status === "COMPLETED" ? "New Client Corp." : inv.client,
                  amount: status === "COMPLETED" ? "$2,150.00" : undefined,
                }
                : inv
        )
    );
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (_, gesture) => {
      startY.current = gesture.y0;
      startX.current = gesture.x0;
      startRecording();
    },
    onPanResponderMove: (_, gesture) => {
      const horizontalDistance = Math.abs(gesture.moveX - startX.current);
      const verticalDistance = startY.current - gesture.moveY;
      
      // Cancel if sliding up or to the side
      if (verticalDistance > 80 || horizontalDistance > 80) {
        isCancelling.current = true;
      } else {
        isCancelling.current = false;
      }
    },
    onPanResponderRelease: () => {
      stopRecording(isCancelling.current);
      isCancelling.current = false;
    },
  });

  return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* HEADER */}
        <View style={styles.header}>
          <Menu size={24} color="#e5e7eb" />
          <Text style={styles.headerTitle}>Paperless</Text>
          <Settings size={24} color="#e5e7eb" />
        </View>

        {/* RECORD CARD */}
        <View style={styles.card}>
          <Text style={styles.title}>Create New Invoice</Text>
          <Text style={styles.subtitle}>
            {isProcessing ? "Processing invoice..." : "Press and hold to record"}
          </Text>

          {isRecording && (
              <Text style={styles.recordingText}>
                Recording… {Math.floor(seconds / 60)}:
                {(seconds % 60).toString().padStart(2, "0")}
              </Text>
          )}

          <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.micButton,
                {
                  backgroundColor: isRecording ? "#dc2626" : "#2563eb",
                  transform: [{ scale: scaleAnim }],
                  opacity: isProcessing ? 0.5 : 1,
                },
              ]}
          >
            <Mic size={36} color="white" />
          </Animated.View>

          <Text style={styles.helperText}>
            Hold to record • Slide to cancel
          </Text>

          {/* TIPS */}
          <View style={styles.tipBox}>
            <Info size={20} color="#2563eb" />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.tipTitle}>Tips for best results:</Text>
              <Text style={styles.tip}>• Speak clearly</Text>
              <Text style={styles.tip}>• Include items & amounts</Text>
              <Text style={styles.tip}>• Mention due date</Text>
            </View>
          </View>
        </View>

        {/* INVOICES */}
        <FlatList
            data={invoices}
            keyExtractor={(i) => i.id.toString()}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => (
                <View style={styles.invoiceCard}>
                  <View style={styles.invoiceHeader}>
                    <Text style={styles.invoiceTitle}>Invoice #{item.id}</Text>
                    <Text style={[styles.status, statusStyle[item.status]]}>
                      {item.status}
                    </Text>
                  </View>
                  <Text style={styles.invoiceClient}>{item.client}</Text>
                  {item.amount && (
                      <Text style={styles.invoiceAmount}>Amount: {item.amount}</Text>
                  )}
                  <View style={styles.invoiceActions}>
                    <TouchableOpacity
                        disabled={item.status !== "COMPLETED"}
                        style={[
                          styles.primaryBtn,
                          item.status !== "COMPLETED" && styles.disabled,
                        ]}
                    >
                      <Download size={16} color="white" />
                      <Text style={styles.btnText}>PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        disabled={item.status !== "COMPLETED"}
                        style={styles.secondaryBtn}
                    >
                      <Eye size={16} color="#e5e7eb" />
                    </TouchableOpacity>
                  </View>
                </View>
            )}
        />

        {/* SUCCESS MODAL */}
        <Modal visible={showSuccess} transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={() => setShowSuccess(false)}
          >
            <TouchableOpacity 
              style={styles.modal}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <CheckCircle size={64} color="#16a34a" />
              <Text style={styles.modalTitle}>Invoice Created!</Text>
              <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => setShowSuccess(false)}
              >
                <Download size={16} color="white" />
                <Text style={styles.btnText}>Download PDF</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const statusStyle = {
  PENDING: { color: "#ca8a04" },
  RUNNING: { color: "#2563eb" },
  COMPLETED: { color: "#16a34a" },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderColor: "#334155",
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#f1f5f9" },
  card: {
    margin: 16,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 16,
  },
  title: { fontSize: 20, fontWeight: "600", textAlign: "center", color: "#f1f5f9" },
  subtitle: { textAlign: "center", color: "#94a3b8", marginBottom: 12 },
  recordingText: { color: "#ef4444", textAlign: "center", marginBottom: 8 },
  micButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 16,
  },
  helperText: { textAlign: "center", color: "#94a3b8", fontSize: 12 },
  tipBox: {
    flexDirection: "row",
    backgroundColor: "#334155",
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  tipTitle: { fontWeight: "600", marginBottom: 4, color: "#f1f5f9" },
  tip: { fontSize: 12, color: "#cbd5e1" },
  invoiceCard: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  invoiceTitle: { fontWeight: "600", color: "#f1f5f9" },
  status: { fontSize: 12, fontWeight: "600" },
  invoiceClient: { color: "#94a3b8", marginTop: 4 },
  invoiceAmount: { marginTop: 8, fontWeight: "600", color: "#f1f5f9" },
  invoiceActions: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  primaryBtn: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#2563eb",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryBtn: {
    padding: 10,
    backgroundColor: "#334155",
    borderRadius: 10,
  },
  btnText: { color: "white", fontWeight: "600" },
  disabled: { opacity: 0.4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#1e293b",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    width: 280,
  },
  modalTitle: { fontSize: 18, fontWeight: "600", marginVertical: 12, color: "#f1f5f9" },
});
