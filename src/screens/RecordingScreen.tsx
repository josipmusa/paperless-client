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
  Linking,
  Vibration,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from 'react-native-root-toast';
import {
  Mic,
  Menu,
  Settings,
  Download,
  Eye,
  Info,
  Bell,
  CheckCircle,
  Share2,
  Loader2,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react-native";
import { useAudioRecorder, RecordingPresets, setAudioModeAsync, requestRecordingPermissionsAsync } from "expo-audio";
import {File, Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { createInvoiceFromVoice, getInvoiceInformation, getInvoices } from "../api/invoiceApi";
import { jobWebSocketService, JobUpdate, JobStatus } from "../websocket/jobWebSocket";

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
  
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cancelIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const processingSpinAnim = useRef(new Animated.Value(0)).current;
  const recordingPulseAnim = useRef(new Animated.Value(1)).current;
  const arrowSlideAnim = useRef(new Animated.Value(0)).current;
  const startY = useRef(0);
  const startX = useRef(0);
  const isCancelling = useRef(false);
  const recordingStartTime = useRef<number>(0);
  const recordingStarted = useRef(false);

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
    }
  }, [isRecording]);

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
    // Connect to WebSocket on mount
    jobWebSocketService.connect();

    // Subscribe to job updates
    const unsubscribe = jobWebSocketService.subscribe(handleJobUpdate);

    // Fetch recent invoices
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

    // "Get Ready" pulse animation
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

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

      // User released before we finished setup
      if (shouldCancelStartRef.current) {
        isStartingRef.current = false;
        setIsGettingReady(false);
        return;
      }

      await recorder.prepareToRecordAsync();

      // ⏱ Delay start to avoid accidental taps
      setTimeout(() => {
        if (shouldCancelStartRef.current) {
          isStartingRef.current = false;
          setIsGettingReady(false);
          return;
        }

        // Vibration feedback BEFORE starting to record
        Vibration.vibrate(50);

        recorder.record();
        recordingStartTime.current = Date.now();
        recordingStarted.current = true;
        isStartingRef.current = false;
        setIsGettingReady(false);

        setIsRecording(true);
        Animated.spring(scaleAnim, {
          toValue: 1.15,
          useNativeDriver: true,
        }).start();
      }, 150);
    } catch (error) {
      isStartingRef.current = false;
      recordingStarted.current = false;
      setIsGettingReady(false);
      console.error("Failed to start recording:", error);
    }
  };


  const stopRecording = async (cancelled: boolean) => {
    // 👇 Stop a recording that is still starting
    if (isStartingRef.current && !recordingStarted.current) {
      shouldCancelStartRef.current = true;
      isStartingRef.current = false;
      setIsGettingReady(false);
      return;
    }

    if (!recordingStarted.current) {
      return;
    }

    const duration = Date.now() - recordingStartTime.current;

    recordingStarted.current = false;
    setIsRecording(false);

    // Vibration feedback on stop
    Vibration.vibrate(50);

    // Reset cancel indicator
    Animated.timing(cancelIndicatorOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    try {
      await recorder.stop();
    } catch {}

    // 🚫 Discard short or cancelled recordings
    if (duration < 500 || cancelled) {
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


  const getInvoicePdf = async (pdfUrl: string, invoiceNumber: string) => {
    const fileName = `Invoice_${invoiceNumber}.pdf`;
    const fileUri = Paths.document.uri + fileName;

    // If already downloaded, reuse it
    const file = new File(fileUri);
    if (file.exists) {
      return fileUri;
    }
    const result = await File.downloadFileAsync(pdfUrl, file)

    if (!result.exists || result.size <= 0) {
      throw new Error('Download failed');
    }

    return result.uri;
  };

  const downloadPdf = async (pdfUrl: string, invoiceNumber: string) => {
    try {
      const uri = await getInvoicePdf(pdfUrl, invoiceNumber);

      Toast.show(`Invoice ${invoiceNumber} is available offline`, {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        shadow: true,
        animation: true,
        backgroundColor: '#16a34a',
        textColor: '#ffffff',
      });
    } catch (error) {
      console.error("Failed to download PDF:", error);
      Toast.show('Failed to download PDF. Please try again.', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        shadow: true,
        animation: true,
        backgroundColor: '#ef4444',
        textColor: '#ffffff',
      });
    }
  };

  const sharePdf = async (pdfUrl: string, invoiceNumber: string) => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Toast.show('Your device does not support sharing', {
          duration: Toast.durations.LONG,
          position: Toast.positions.BOTTOM,
          shadow: true,
          animation: true,
          backgroundColor: '#f59e0b',
          textColor: '#ffffff',
        });
        return;
      }

      const uri = await getInvoicePdf(pdfUrl, invoiceNumber);

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share Invoice ${invoiceNumber}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      console.error(error);
      Toast.show('Could not share the invoice', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        shadow: true,
        animation: true,
        backgroundColor: '#ef4444',
        textColor: '#ffffff',
      });
    }
  };

  const viewPdf = async (pdfUrl: string, invoiceNumber: string) => {
    try {
      const uri = await getInvoicePdf(pdfUrl, invoiceNumber);
      
      const canOpen = await Linking.canOpenURL(uri);
      if (canOpen) {
        await Linking.openURL(uri);
      } else {
        Toast.show('No app available to view PDFs. Please install a PDF viewer from your app store.', {
          duration: Toast.durations.LONG,
          position: Toast.positions.BOTTOM,
          shadow: true,
          animation: true,
          backgroundColor: '#f59e0b',
          textColor: '#ffffff',
        });
      }
    } catch (error) {
      console.error('Failed to open PDF:', error);
      Toast.show('Failed to open PDF. Please try again.', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        shadow: true,
        animation: true,
        backgroundColor: '#ef4444',
        textColor: '#ffffff',
      });
    }
  };


  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: async (_, gesture) => {
      startY.current = gesture.y0;
      startX.current = gesture.x0;
      isCancelling.current = false;
      await startRecording();
    },
    onPanResponderMove: (_, gesture) => {
      const horizontalDistance = Math.abs(gesture.moveX - startX.current);
      const verticalDistance = startY.current - gesture.moveY;
      
      // Cancel if sliding up or to the side
      if (verticalDistance > 80 || horizontalDistance > 80) {
        if (!isCancelling.current) {
          isCancelling.current = true;
          // Fade in cancel indicator
          Animated.timing(cancelIndicatorOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      } else {
        if (isCancelling.current) {
          isCancelling.current = false;
          // Fade out cancel indicator
          Animated.timing(cancelIndicatorOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      }
    },
    onPanResponderRelease: () => {
      stopRecording(isCancelling.current);
      isCancelling.current = false;
    },
  });

  // Pulsing Dot Component for status indication
  const PulsingDot = ({ status }: { status: JobStatus }) => {
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
  };

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
                    <View style={styles.invoiceTitleContainer}>
                      <PulsingDot status={item.status} />
                      <View style={styles.invoiceTextContainer}>
                        <Text style={styles.invoiceTitle} numberOfLines={1}>
                          {item.customerName || "Processing..."}
                        </Text>
                        {item.invoiceNumber && (
                          <Text style={styles.invoiceNumber} numberOfLines={1}>
                            #{item.invoiceNumber}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text style={[styles.status, statusStyle[item.status]]}>
                      {item.status}
                    </Text>
                  </View>
                  {item.amount && (
                      <Text style={styles.invoiceAmount}>{item.amount}</Text>
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
                        disabled={item.status !== "DONE" || item.fetchFailed || !item.pdfDownloadUrl}
                        style={[
                          styles.primaryBtn,
                          (item.status !== "DONE" || item.fetchFailed || !item.pdfDownloadUrl) && styles.disabled,
                        ]}
                        onPress={() => item.pdfDownloadUrl && item.invoiceNumber && downloadPdf(item.pdfDownloadUrl, item.invoiceNumber)}
                    >
                      <Download size={18} color="white" />
                      <Text style={styles.btnText}>Download PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        disabled={item.status !== "DONE" || item.fetchFailed || !item.pdfDownloadUrl}
                        style={[
                          styles.shareBtn,
                          (item.status !== "DONE" || item.fetchFailed || !item.pdfDownloadUrl) && styles.disabled,
                        ]}
                        onPress={() => item.pdfDownloadUrl && item.invoiceNumber && sharePdf(item.pdfDownloadUrl, item.invoiceNumber)}
                    >
                      <Share2 size={18} color="white" />
                      <Text style={styles.btnText}>Share invoice</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        disabled={item.status !== "DONE" || item.fetchFailed || !item.pdfDownloadUrl}
                        style={[
                          styles.viewBtn,
                          (item.status !== "DONE" || item.fetchFailed || !item.pdfDownloadUrl) && styles.disabled,
                        ]}
                        onPress={() => item.pdfDownloadUrl && item.invoiceNumber && viewPdf(item.pdfDownloadUrl, item.invoiceNumber)}
                    >
                      <Eye size={18} color="white" />
                      <Text style={styles.btnText}>View</Text>
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
              <View style={styles.modalActions}>
                <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => {
                      const invoice = invoices.find(inv => inv.invoiceId === completedInvoiceId);
                      if (invoice?.pdfDownloadUrl && invoice?.invoiceNumber) {
                        downloadPdf(invoice.pdfDownloadUrl, invoice.invoiceNumber);
                      }
                    }}
                    disabled={!invoices.find(inv => inv.invoiceId === completedInvoiceId)?.pdfDownloadUrl}
                >
                  <Download size={16} color="white" />
                  <Text style={styles.btnText}>Download PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={() => {
                      const invoice = invoices.find(inv => inv.invoiceId === completedInvoiceId);
                      if (invoice?.pdfDownloadUrl && invoice?.invoiceNumber) {
                        sharePdf(invoice.pdfDownloadUrl, invoice.invoiceNumber);
                      }
                    }}
                    disabled={!invoices.find(inv => inv.invoiceId === completedInvoiceId)?.pdfDownloadUrl}
                >
                  <Share2 size={16} color="white" />
                  <Text style={styles.btnText}>Share</Text>
                </TouchableOpacity>
              </View>
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
    alignItems: "center",
    gap: 8,
  },
  invoiceTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    flexShrink: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  invoiceTextContainer: {
    flex: 1,
    flexShrink: 1,
  },
  invoiceTitle: { 
    fontWeight: "600", 
    color: "#f1f5f9",
    fontSize: 16,
  },
  invoiceNumber: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  status: { 
    fontSize: 11, 
    fontWeight: "600",
    flexShrink: 0,
  },
  invoiceAmount: { 
    marginTop: 8, 
    fontSize: 18,
    fontWeight: "700", 
    color: "#4CAF50",
  },
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
    flexWrap: "wrap",
  },
  primaryBtn: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  shareBtn: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    alignItems: "center",
  },
  viewBtn: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#7c3aed",
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryBtn: {
    padding: 10,
    backgroundColor: "#334155",
    borderRadius: 10,
  },
  btnText: { color: "white", fontWeight: "600", fontSize: 14 },
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
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
});
