import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList} from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from 'react-native-root-toast';
import { Menu, Settings } from "lucide-react-native";
import { useAudioRecorder, RecordingPresets, setAudioModeAsync, requestRecordingPermissionsAsync } from "expo-audio";
import { createInvoiceFromVoice, getInvoiceInformation, getInvoices } from "../api/invoiceApi";
import { jobWebSocketService, JobUpdate, JobStatus } from "../websocket/jobWebSocket";
import { RecordingButton } from "../components/RecordingButton";
import { InvoiceCard } from "../components/InvoiceCard";
import { InvoiceSuccessModal } from "../components/InvoiceSuccessModal";
import { RecordingTips } from "../components/RecordingTips";
import { usePdfOperations } from "../hooks/usePdfOperations";

type Invoice = {
  jobId: string;
  invoiceId?: string;
  invoiceNumber?: string;
  customerName?: string;
  amount?: string;
  status: JobStatus;
  fetchFailed?: boolean;
  pdfDownloadUrl?: string;
};

export default function VoiceToInvoiceScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [completedInvoiceId, setCompletedInvoiceId] = useState<string | null>(null);
  const [isGettingReady, setIsGettingReady] = useState(false);
  
  const isStartingRef = useRef(false);
  const shouldCancelStartRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTime = useRef<number>(0);
  const recordingStarted = useRef(false);

  const haptics = {
    start: () =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

    stop: () =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

    cancel: () =>
        Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning
        ),
  };
  
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const { downloadPdf, sharePdf, viewPdf } = usePdfOperations();

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
        invoiceId: invoice.invoiceNumber,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        amount: `$${invoice.totalAmount.toFixed(2)}`,
        status: "DONE",
        pdfDownloadUrl: invoice.pdfDownloadUrl,
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
                  amount: `$${invoiceData.totalAmount.toFixed(2)}`,
                  fetchFailed: false,
                  pdfDownloadUrl: invoiceData.pdfDownloadUrl,
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

      await recorder.prepareToRecordAsync();

      setTimeout(() => {
        if (shouldCancelStartRef.current) {
          isStartingRef.current = false;
          setIsGettingReady(false);
          return;
        }

        recorder.record();
        recordingStartTime.current = Date.now();
        recordingStarted.current = true;
        isStartingRef.current = false;
        setIsGettingReady(false);
        setIsRecording(true);
      }, 150);
    } catch (error) {
      isStartingRef.current = false;
      recordingStarted.current = false;
      setIsGettingReady(false);
      console.error("Failed to start recording:", error);
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
      await recorder.stop();
    } catch {}

    if (duration < 500 || cancelled) {
      haptics.cancel();
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
    if (recordingStarted.current || isStartingRef.current) {
      recordingStarted.current = false;
      isStartingRef.current = false;
      setIsRecording(false);

      haptics.cancel();

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
        keyExtractor={(i) => i.jobId}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <InvoiceCard
            {...item}
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
          if (completedInvoice?.pdfDownloadUrl && completedInvoice?.invoiceNumber) {
            downloadPdf(completedInvoice.pdfDownloadUrl, completedInvoice.invoiceNumber);
          }
        }}
        onShare={() => {
          if (completedInvoice?.pdfDownloadUrl && completedInvoice?.invoiceNumber) {
            sharePdf(completedInvoice.pdfDownloadUrl, completedInvoice.invoiceNumber);
          }
        }}
        canInteract={!!completedInvoice?.pdfDownloadUrl}
      />
    </SafeAreaView>
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
  },
  title: { 
    fontSize: 20, 
    fontWeight: "600", 
    textAlign: "center", 
    color: "#f1f5f9" 
  },
});
