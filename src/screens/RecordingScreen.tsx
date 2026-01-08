import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  Animated,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  RecordingOptions,
  AudioModule,
  IOSOutputFormat,
  AudioQuality,
} from 'expo-audio';
import {
  createInvoiceFromVoice,
  getInvoicePdfLink,
} from '../api/invoiceApi';
import {
  useJobStore,
  initializeJobWebSocket,
  disconnectJobWebSocket,
} from '../store/jobStore';

const HOLD_DELAY = 200;
const CANCEL_THRESHOLD = -100;

type UiPhase = 'idle' | 'uploading' | 'processing' | 'done';

const recordingOptions: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
    sampleRate: 44100,
  },
  ios: {
    extension: '.m4a',
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 44100,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/mp4',
    bitsPerSecond: 128000,
  },
};

export default function RecordingScreen() {
  /** ---------- UI STATE ---------- */
  const [uiPhase, setUiPhase] = useState<UiPhase>('idle');
  const [isHolding, setIsHolding] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [duration, setDuration] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  /** ---------- REFS (CRITICAL) ---------- */
  const isRecordingRef = useRef(false);
  const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef(0);

  const slideX = useRef(new Animated.Value(0)).current;
  const audioRecorder = useAudioRecorder(recordingOptions);

  const currentJob = useJobStore((s) => s.currentJob);
  const setCurrentJob = useJobStore((s) => s.setCurrentJob);
  const clearCurrentJob = useJobStore((s) => s.clearCurrentJob);

  /** ---------- LIFECYCLE ---------- */
  useEffect(() => {
    initializeJobWebSocket();
    return () => {
      disconnectJobWebSocket();
      timerRef.current && clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentJob?.status === 'DONE' && currentJob.resultRef) {
      loadPdf(currentJob.resultRef);
    } else if (currentJob?.status === 'FAILED') {
      Alert.alert('Error', 'Invoice processing failed');
      reset();
    } else if (
        currentJob?.status === 'PENDING' ||
        currentJob?.status === 'RUNNING'
    ) {
      setUiPhase('processing');
    }
  }, [currentJob?.status]);

  /** ---------- AUDIO ---------- */
  const startRecording = async () => {
    const permission =
        await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) return;

    await AudioModule.setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();

    isRecordingRef.current = true;
    setDuration(0);

    timerRef.current = setInterval(
        () => setDuration((d) => d + 1),
        1000
    );
  };

  const stopRecording = async (cancelled: boolean) => {
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = null;

    if (!isRecordingRef.current) return;

    isRecordingRef.current = false;
    await audioRecorder.stop();

    if (cancelled) {
      reset();
      return;
    }

    if (!audioRecorder.uri) {
      reset();
      return;
    }

    upload(audioRecorder.uri);
  };

  /** ---------- API ---------- */
  const upload = async (uri: string) => {
    setUiPhase('uploading');
    try {
      const jobId = await createInvoiceFromVoice(uri);
      setCurrentJob({ id: jobId, status: 'PENDING' });
    } catch {
      Alert.alert('Upload failed');
      reset();
    }
  };

  const loadPdf = async (id: string) => {
    const url = await getInvoicePdfLink(id);
    setPdfUrl(url);
    setUiPhase('done');
  };

  const reset = () => {
    clearCurrentJob();
    setUiPhase('idle');
    setDuration(0);
    setIsCancelling(false);
  };

  /** ---------- GESTURES ---------- */
  const onPressIn = (e: any) => {
    if (uiPhase !== 'idle') return;

    setIsHolding(true);
    setIsCancelling(false);
    slideX.setValue(0);
    touchStartX.current = e.nativeEvent.pageX;

    startTimeoutRef.current = setTimeout(
        startRecording,
        HOLD_DELAY
    );
  };

  const onPressOut = (e: any) => {
    setIsHolding(false);

    if (!isRecordingRef.current) {
      startTimeoutRef.current &&
      clearTimeout(startTimeoutRef.current);
      return;
    }

    const delta =
        e.nativeEvent.pageX - touchStartX.current;

    stopRecording(delta < CANCEL_THRESHOLD);
  };

  const onMove = (e: any) => {
    if (!isRecordingRef.current) return;

    const delta =
        e.nativeEvent.pageX - touchStartX.current;

    if (delta < 0) {
      slideX.setValue(
          Math.max(delta, CANCEL_THRESHOLD - 20)
      );
      setIsCancelling(delta < CANCEL_THRESHOLD);
    }
  };

  /** ---------- RENDER ---------- */
  return (
      <View style={styles.container}>
        <Text style={styles.title}>Create Invoice</Text>
        <Text style={styles.subtitle}>
          Hold to record invoice details
        </Text>

        {uiPhase === 'idle' && (
            <>
              {isRecordingRef.current && (
                  <View style={styles.recordOverlay}>
                    <Animated.Text
                        style={[
                          styles.slideText,
                          { opacity: slideX.interpolate({
                              inputRange: [CANCEL_THRESHOLD, 0],
                              outputRange: [1, 0.3],
                            }) },
                        ]}
                    >
                      ← Slide to cancel
                    </Animated.Text>

                    <Text style={styles.timer}>
                      {new Date(duration * 1000)
                          .toISOString()
                          .substring(14, 19)}
                    </Text>
                  </View>
              )}

              <Pressable
                  onPressIn={onPressIn}
                  onPressOut={onPressOut}
                  onTouchMove={onMove}
                  style={[
                    styles.button,
                    isHolding && styles.buttonPressed,
                  ]}
              >
                <Ionicons name="mic" size={26} color="#fff" />
                <Text style={styles.buttonText}>
                  Hold to record
                </Text>
              </Pressable>
            </>
        )}

        {uiPhase === 'uploading' && <ActivityIndicator size="large" />}
        {uiPhase === 'processing' && <Text>Processing…</Text>}
        {uiPhase === 'done' && (
            <Pressable onPress={() => Linking.openURL(pdfUrl!)}>
              <Text style={styles.done}>View PDF</Text>
            </Pressable>
        )}
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 48,
  },

  /* ---------- RECORD BUTTON ---------- */
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366', // WhatsApp green
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 32,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },

  buttonPressed: {
    transform: [{ scale: 1.08 }],
    backgroundColor: '#1ebe5d',
  },

  buttonText: {
    marginLeft: 10,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },

  /* ---------- RECORDING OVERLAY ---------- */
  recordOverlay: {
    position: 'absolute',
    top: '45%',
    alignItems: 'center',
  },

  slideText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },

  timer: {
    fontSize: 36,
    fontWeight: '300',
    color: '#e53935',
    fontVariant: ['tabular-nums'],
  },

  /* ---------- PROCESSING ---------- */
  done: {
    fontSize: 18,
    fontWeight: '600',
    color: '#25D366',
    marginTop: 16,
  },
});

