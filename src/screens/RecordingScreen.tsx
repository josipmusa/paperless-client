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
import { createInvoiceFromVoice, getInvoiceInformation } from "../api/invoiceApi";
import { jobWebSocketService, JobUpdate, JobStatus } from "../websocket/jobWebSocket";

type Invoice = {
  jobId: string;
  invoiceId?: string;
  invoiceNumber?: string;
  customerName?: string;
  amount?: string;
  status: JobStatus;
  fetchFailed?: boolean;
};

export default function VoiceToInvoiceScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [completedInvoiceId, setCompletedInvoiceId] = useState<string | null>(null);
  const isStartingRef = useRef(false);
  const shouldCancelStartRef = useRef(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const startY = useRef(0);
  const startX = useRef(0);
  const isCancelling = useRef(false);
  const recordingStartTime = useRef<number>(0);
  const recordingStarted = useRef(false);

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

  useEffect(() => {
    // Connect to WebSocket on mount
    jobWebSocketService.connect();

    // Subscribe to job updates
    const unsubscribe = jobWebSocketService.subscribe(handleJobUpdate);

    return () => {
      unsubscribe();
    };
  }, []);

  const handleJobUpdate = async (update: JobUpdate) => {
    console.log("Received job update:", update);

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.jobId === update.jobId) {
          return {
            ...inv,
            status: update.status,
          };
        }
        return inv;
      })
    );

    // If job is done, fetch invoice information
    if (update.status === "DONE" && update.resultRef) {
      try {
        const invoiceData = await getInvoiceInformation(update.resultRef);
        
        if (invoiceData) {
          setInvoices((prev) =>
            prev.map((inv) => {
              if (inv.jobId === update.jobId) {
                return {
                  ...inv,
                  invoiceId: update.resultRef,
                  invoiceNumber: invoiceData.invoiceNumber,
                  customerName: invoiceData.customerName,
                  amount: `$${invoiceData.totalAmount.toFixed(2)}`,
                  fetchFailed: false,
                };
              }
              return inv;
            })
          );

          setCompletedInvoiceId(update.resultRef);
          setIsProcessing(false);
          setShowSuccess(true);
        } else {
          // Invoice data not available yet
          setInvoices((prev) =>
            prev.map((inv) => {
              if (inv.jobId === update.jobId) {
                return {
                  ...inv,
                  invoiceId: update.resultRef,
                  fetchFailed: true,
                };
              }
              return inv;
            })
          );
          setIsProcessing(false);
        }
      } catch (error) {
        console.error("Failed to fetch invoice information:", error);
        setInvoices((prev) =>
          prev.map((inv) => {
            if (inv.jobId === update.jobId) {
              return {
                ...inv,
                invoiceId: update.resultRef,
                fetchFailed: true,
              };
            }
            return inv;
          })
        );
        setIsProcessing(false);
      }
    } else if (update.status === "FAILED") {
      await forceStopRecording();
      setIsProcessing(false);
      Alert.alert("Error", "Failed to process recording.");
      setInvoices((prev) => prev.filter((inv) => inv.jobId !== update.jobId));
    }
  };

  const startRecording = async () => {
    if (isProcessing || isStartingRef.current || isRecording) return;

    isStartingRef.current = true;
    shouldCancelStartRef.current = false;

    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        isStartingRef.current = false;
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // User released before we finished setup
      if (shouldCancelStartRef.current) {
        isStartingRef.current = false;
        return;
      }

      await recorder.prepareToRecordAsync();

      // ⏱ Delay start to avoid accidental taps
      setTimeout(() => {
        if (shouldCancelStartRef.current) {
          isStartingRef.current = false;
          return;
        }

        recorder.record();
        recordingStartTime.current = Date.now();
        recordingStarted.current = true;
        isStartingRef.current = false;

        setIsRecording(true);
        Animated.spring(scaleAnim, {
          toValue: 1.15,
          useNativeDriver: true,
        }).start();
      }, 150);
    } catch (error) {
      isStartingRef.current = false;
      recordingStarted.current = false;
      console.error("Failed to start recording:", error);
    }
  };


  const stopRecording = async (cancelled: boolean) => {
    // 👇 Stop a recording that is still starting
    if (isStartingRef.current && !recordingStarted.current) {
      shouldCancelStartRef.current = true;
      isStartingRef.current = false;
      return;
    }

    if (!recordingStarted.current) {
      return;
    }

    const duration = Date.now() - recordingStartTime.current;

    recordingStarted.current = false;
    setIsRecording(false);

    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    try {
      await recorder.stop();
    } catch {}

    // 🚫 Discard short or cancelled recordings
    if (duration < 500 || cancelled) {
      return;
    }

    // ✅ Valid recording
    const uri = recorder.uri;
    if (!uri) return;

    setIsProcessing(true);

    try {
      const jobId = await createInvoiceFromVoice(uri);
      setInvoices((prev) => [
        { jobId, customerName: "Processing...", status: "PENDING" },
        ...prev.slice(0, 2),
      ]);
    } catch (e) {
      await forceStopRecording();
      setIsProcessing(false);
      Alert.alert("Error", "Failed to process recording.");
    }
  };

  const forceStopRecording = async () => {
    if (recordingStarted.current || isStartingRef.current) {
      recordingStarted.current = false;
      isStartingRef.current = false;
      setIsRecording(false);

      try {
        await recorder.stop();
      } catch {}
    }
  };


  const retryFetchInvoice = async (jobId: string, invoiceId: string) => {
    try {
      const invoiceData = await getInvoiceInformation(invoiceId);
      
      if (invoiceData) {
        setInvoices((prev) =>
          prev.map((inv) => {
            if (inv.jobId === jobId) {
              return {
                ...inv,
                invoiceNumber: invoiceData.invoiceNumber,
                customerName: invoiceData.customerName,
                amount: `$${invoiceData.totalAmount.toFixed(2)}`,
                fetchFailed: false,
              };
            }
            return inv;
          })
        );
        setShowSuccess(true);
      } else {
        Alert.alert("Error", "Invoice information is not available yet. Please try again later.");
      }
    } catch (error) {
      console.error("Failed to retry fetch invoice:", error);
      Alert.alert("Error", "Failed to fetch invoice information. Please try again.");
    }
  };


  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: async (_, gesture) => {
      startY.current = gesture.y0;
      startX.current = gesture.x0;
      await startRecording();
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
            keyExtractor={(i) => i.jobId}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => (
                <View style={styles.invoiceCard}>
                  <View style={styles.invoiceHeader}>
                    <Text style={styles.invoiceTitle}>
                      {item.invoiceNumber ? `Invoice #${item.invoiceNumber}` : "Processing Invoice"}
                    </Text>
                    <Text style={[styles.status, statusStyle[item.status]]}>
                      {item.status}
                    </Text>
                  </View>
                  <Text style={styles.invoiceClient}>
                    {item.customerName || "Processing..."}
                  </Text>
                  {item.amount && (
                      <Text style={styles.invoiceAmount}>Amount: {item.amount}</Text>
                  )}
                  
                  {item.fetchFailed && item.invoiceId && (
                    <TouchableOpacity 
                      style={styles.retryBtn}
                      onPress={() => retryFetchInvoice(item.jobId, item.invoiceId!)}
                    >
                      <Text style={styles.retryBtnText}>Retry Fetch Invoice</Text>
                    </TouchableOpacity>
                  )}
                  
                  <View style={styles.invoiceActions}>
                    <TouchableOpacity
                        disabled={item.status !== "DONE" || item.fetchFailed}
                        style={[
                          styles.primaryBtn,
                          (item.status !== "DONE" || item.fetchFailed) && styles.disabled,
                        ]}
                    >
                      <Download size={16} color="white" />
                      <Text style={styles.btnText}>PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        disabled={item.status !== "DONE" || item.fetchFailed}
                        style={[
                          styles.secondaryBtn,
                          (item.status !== "DONE" || item.fetchFailed) && styles.disabled,
                        ]}
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

const statusStyle: Record<JobStatus, { color: string }> = {
  PENDING: { color: "#ca8a04" },
  RUNNING: { color: "#2563eb" },
  DONE: { color: "#16a34a" },
  FAILED: { color: "#dc2626" },
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
  retryBtn: {
    backgroundColor: "#ca8a04",
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    alignItems: "center",
  },
  retryBtnText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
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
