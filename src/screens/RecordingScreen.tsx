import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, Platform} from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from 'react-native-root-toast';
import { Menu } from "lucide-react-native";
import { useAudioRecorder, RecordingPresets, setAudioModeAsync, requestRecordingPermissionsAsync } from "expo-audio";
import { createInvoiceFromVoice, getInvoiceInformation, getInvoices } from "../api/invoiceApi";
import { jobWebSocketService, JobUpdate, JobStatus } from "../websocket/jobWebSocket";
import { RecordingButton } from "../components/RecordingButton";
import { InvoiceCard } from "../components/InvoiceCard";
import { InvoiceSuccessModal } from "../components/InvoiceSuccessModal";
import { RecordingTips } from "../components/RecordingTips";
import { PdfViewer } from "../components/PdfViewer";
import { usePdfOperations } from "../hooks/usePdfOperations";
import { useWebAudioRecorder } from "../hooks/useWebAudioRecorder";

type Invoice = {
  jobId: string;
  invoiceId?: number;
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
  const [completedInvoiceId, setCompletedInvoiceId] = useState<number | null>(null);
  const [isGettingReady, setIsGettingReady] = useState(false);
  
  const isStartingRef = useRef(false);
  const shouldCancelStartRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTime = useRef<number>(0);
  const recordingStarted = useRef(false);

  const haptics = {
    start: () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    },

    stop: () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    },

    cancel: () => {
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning
            );
        }
    },
  };
  
  const recorder = Platform.OS === 'web' ? null : useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const webRecorder = useWebAudioRecorder();
  
  const { 
    downloadPdf, 
    sharePdf, 
    viewPdf, 
    viewerVisible, 
    currentPdfBase64, 
    currentInvoiceNumber, 
    closeViewer,
    pdfLoading,
    pdfError,
  } = usePdfOperations();

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

  const fetchRecentInvoices = async () => {
    try {
      const invoiceData = await getInvoices();
      const recentInvoices: Invoice[] = invoiceData.map((invoice) => ({
        jobId: `existing-${invoice.invoiceNumber}`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        amount: `${invoice.currency} ${invoice.totalAmount.toFixed(2)}`,
        status: "DONE",
      }));
      setInvoices(recentInvoices);
    } catch (error) {
      console.error("Failed to fetch recent invoices:", error);
    }
  };

  useEffect(() => {
    jobWebSocketService.connect();
    const unsubscribe = jobWebSocketService.subscribe(handleJobUpdate);
    fetchRecentInvoices();

    return () => {
      unsubscribe();
    };
  }, []);

  const handleJobUpdate = async (update: JobUpdate) => {
    console.log("Received job update:", update);

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.jobId === update.jobId) {
          return { ...inv, status: update.status };
        }
        return inv;
      })
    );

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
                  amount: `${invoiceData.currency} ${invoiceData.totalAmount.toFixed(2)}`,
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
          setInvoices((prev) =>
            prev.map((inv) => {
              if (inv.jobId === update.jobId) {
                return { ...inv, invoiceId: update.resultRef, fetchFailed: true };
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
              return { ...inv, invoiceId: update.resultRef, fetchFailed: true };
            }
            return inv;
          })
        );
        setIsProcessing(false);
      }
    } else if (update.status === "FAILED") {
      await forceStopRecording();
      setIsProcessing(false);
      Toast.show('Failed to process recording', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        shadow: true,
        animation: true,
        backgroundColor: '#ef4444',
        textColor: '#ffffff',
      });
      setInvoices((prev) => prev.filter((inv) => inv.jobId !== update.jobId));
    }
  };

  const startRecording = async () => {
    if (isProcessing || isStartingRef.current || isRecording) return;

    isStartingRef.current = true;
    shouldCancelStartRef.current = false;
    setIsGettingReady(true);

    haptics.start();

    try {
      if (Platform.OS === 'web') {
        // Web recording
        await webRecorder.startRecording();
        
        if (shouldCancelStartRef.current) {
          isStartingRef.current = false;
          setIsGettingReady(false);
          webRecorder.stopRecording();
          return;
        }

        recordingStartTime.current = Date.now();
        recordingStarted.current = true;
        isStartingRef.current = false;
        setIsGettingReady(false);
        setIsRecording(true);
      } else {
        // Mobile recording
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          isStartingRef.current = false;
          setIsGettingReady(false);
          return;
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        if (shouldCancelStartRef.current) {
          isStartingRef.current = false;
          setIsGettingReady(false);
          return;
        }

        await recorder!.prepareToRecordAsync();

        setTimeout(() => {
          if (shouldCancelStartRef.current) {
            isStartingRef.current = false;
            setIsGettingReady(false);
            return;
          }

          recorder!.record();
          recordingStartTime.current = Date.now();
          recordingStarted.current = true;
          isStartingRef.current = false;
          setIsGettingReady(false);
          setIsRecording(true);
        }, 150);
      }
    } catch (error) {
      isStartingRef.current = false;
      recordingStarted.current = false;
      setIsGettingReady(false);
      console.error("Failed to start recording:", error);
      Toast.show('Failed to access microphone. Please grant permission.', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        shadow: true,
        animation: true,
        backgroundColor: '#ef4444',
        textColor: '#ffffff',
      });
    }
  };

  const stopRecording = async (cancelled: boolean) => {
    if (isStartingRef.current && !recordingStarted.current) {
      shouldCancelStartRef.current = true;
      isStartingRef.current = false;
      setIsGettingReady(false);
      haptics.cancel();
      return;
    }

    if (!recordingStarted.current) return;

    const duration = Date.now() - recordingStartTime.current;
    recordingStarted.current = false;
    setIsRecording(false);

    haptics.stop();

    try {
      if (Platform.OS === 'web') {
        const blob = await webRecorder.stopRecording();
        if (!blob) {
          Toast.show('Failed to record audio', {
            duration: Toast.durations.LONG,
            position: Toast.positions.BOTTOM,
            shadow: true,
            animation: true,
            backgroundColor: '#ef4444',
            textColor: '#ffffff',
          });
          return;
        }
      } else {
        await recorder!.stop();
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    }

    if (duration < 500 || cancelled) {
      haptics.cancel();
      if (Platform.OS === 'web') {
        webRecorder.clearRecording();
      }
      if (cancelled) {
        Toast.show('Recording cancelled', {
          duration: Toast.durations.SHORT,
          position: Toast.positions.BOTTOM,
          shadow: true,
          animation: true,
          backgroundColor: '#f59e0b',
          textColor: '#ffffff',
        });
      } else if (duration < 500) {
        Toast.show('Recording too short', {
          duration: Toast.durations.SHORT,
          position: Toast.positions.BOTTOM,
          shadow: true,
          animation: true,
          backgroundColor: '#ef4444',
          textColor: '#ffffff',
        });
      }
      return;
    }

    let uri: string | null;
    
    if (Platform.OS === 'web') {
      uri = await webRecorder.getRecordingUri();
      if (!uri) {
        Toast.show('Failed to process recording', {
          duration: Toast.durations.LONG,
          position: Toast.positions.BOTTOM,
          shadow: true,
          animation: true,
          backgroundColor: '#ef4444',
          textColor: '#ffffff',
        });
        return;
      }
      webRecorder.clearRecording();
    } else {
      uri = recorder!.uri;
    }
    
    if (!uri) {
      return;
    }

    setIsProcessing(true);

    try {
      const jobId = await createInvoiceFromVoice(uri);
      setInvoices((prev) => [
        { jobId, customerName: "Processing...", status: "PENDING" },
        ...prev.slice(0, 2),
      ]);
    } catch (e) {
      console.error('Error creating invoice:', e);
      await forceStopRecording();
      setIsProcessing(false);
      Toast.show('Failed to process recording', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        shadow: true,
        animation: true,
        backgroundColor: '#ef4444',
        textColor: '#ffffff',
      });
    }
  };

  const forceStopRecording = async () => {
    recordingStarted.current = false;
    isStartingRef.current = false;
    setIsRecording(false);
    haptics.cancel();

    if (Platform.OS === 'web') {
      try {
        await webRecorder.stopRecording();
      } catch {}
      webRecorder.clearRecording();
    } else {
      try {
        await recorder!.stop();
      } catch {}
    }
  };

  const retryFetchInvoice = async (jobId: string, invoiceId: number) => {
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
                amount: `${invoiceData.currency} ${invoiceData.totalAmount.toFixed(2)}`,
                fetchFailed: false,
              };
            }
            return inv;
          })
        );
        setShowSuccess(true);
      } else {
        Toast.show('Invoice information is not available yet. Please try again later.', {
          duration: Toast.durations.LONG,
          position: Toast.positions.BOTTOM,
          shadow: true,
          animation: true,
          backgroundColor: '#f59e0b',
          textColor: '#ffffff',
        });
      }
    } catch (error) {
      console.error("Failed to retry fetch invoice:", error);
      Toast.show('Failed to fetch invoice information. Please try again.', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        shadow: true,
        animation: true,
        backgroundColor: '#ef4444',
        textColor: '#ffffff',
      });
    }
  };

  const completedInvoice = invoices.find(inv => inv.invoiceId === completedInvoiceId);

  const Container = Platform.OS === 'web' ? View : SafeAreaView;
  const containerProps = Platform.OS === 'web' ? {} : { edges: ['top'] as const };

  return (
    <Container style={styles.container} {...containerProps}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>Paperless</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* RECORD CARD */}
      <View style={styles.card}>
        <Text style={styles.title}>Create New Invoice</Text>
        
        <RecordingButton
            isRecording={isRecording}
            isProcessing={isProcessing}
            isGettingReady={isGettingReady}
            seconds={seconds}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
        />

        <RecordingTips />
      </View>

      {/* INVOICES */}
      <FlatList
          data={invoices}
          extraData={invoices}
          keyExtractor={(i) => i.jobId}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          // Only show the title if the list isn't empty
          ListHeaderComponent={
            invoices.length > 0 ? (
                <View style={styles.listHeaderContainer}>
                  <View style={styles.listHeaderTitleRow}>
                    <Text style={styles.listHeader}>Recent Invoices</Text>
                  </View>
                  <View style={styles.headerUnderline} />
                </View>
            ) : null
          }
          // This renders when 'data' is an empty array
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Menu size={32} color="#475569" />
              </View>
              <Text style={styles.emptyText}>No recent invoices</Text>
              <Text style={styles.emptySubtext}>
                Record your first voice invoice to see it appear here.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
              <InvoiceCard
                  {...item}
                  index={index}
                  onRetryFetch={retryFetchInvoice}
                  onDownload={downloadPdf}
                  onShare={sharePdf}
                  onView={viewPdf}
              />
          )}
      />

      {/* SUCCESS MODAL */}
      <InvoiceSuccessModal
        visible={showSuccess}
        onClose={() => setShowSuccess(false)}
        onDownload={() => {
          if (completedInvoice?.invoiceId && completedInvoice?.invoiceNumber) {
            downloadPdf(completedInvoice.invoiceId, completedInvoice.invoiceNumber);
          }
        }}
        onView={() => {
          if (completedInvoice?.invoiceId && completedInvoice?.invoiceNumber) {
            viewPdf(completedInvoice.invoiceId, completedInvoice.invoiceNumber);
            setShowSuccess(false); // Close modal when viewing
          }
        }}
        onShare={() => {
          if (completedInvoice?.invoiceId && completedInvoice?.invoiceNumber) {
            sharePdf(completedInvoice.invoiceId, completedInvoice.invoiceNumber);
          }
        }}
        canInteract={!!completedInvoice?.invoiceId}
      />

      {/* PDF VIEWER */}
      <PdfViewer
        visible={viewerVisible}
        pdfBase64={currentPdfBase64}
        invoiceNumber={currentInvoiceNumber}
        onClose={closeViewer}
        isLoading={pdfLoading}
        error={pdfError}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#0f172a" 
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderColor: "#334155",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyText: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: "600",
  },
  emptySubtext: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 32,
  },
  listHeaderContainer: {
    marginTop: 24,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  listHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  listHeader: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: -0.5,
  },
  countBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
  },
  countText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  headerUnderline: {
    height: 3,
    width: 40,
    backgroundColor: '#3b82f6', // Match your primary blue
    borderRadius: 2,
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: "600", 
    color: "#f1f5f9" 
  },
  card: {
    margin: 16,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5, // for Android shadow
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    color: "#f1f5f9",
    marginBottom: 12,
    letterSpacing: 0.2,
  },
});
