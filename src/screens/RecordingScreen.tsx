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
import { useAudioRecorder, RecordingOptions, AudioModule, IOSOutputFormat, AudioQuality } from 'expo-audio';
import { createInvoiceFromVoice, getInvoicePdfLink } from '../api/invoiceApi';
import { useJobStore, initializeJobWebSocket, disconnectJobWebSocket } from '../store/jobStore';

const CANCEL_THRESHOLD = -100;

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

type RecordingState = 'idle' | 'recording' | 'uploading' | 'processing' | 'done';

export default function RecordingScreen() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const slideX = useRef(new Animated.Value(0)).current;
  const [isCancelling, setIsCancelling] = useState(false);
  const touchStartX = useRef(0);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRecorder = useAudioRecorder(recordingOptions);

  const currentJob = useJobStore((state) => state.currentJob);
  const setCurrentJob = useJobStore((state) => state.setCurrentJob);
  const clearCurrentJob = useJobStore((state) => state.clearCurrentJob);

  useEffect(() => {
    initializeJobWebSocket();
    return () => {
      disconnectJobWebSocket();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentJob?.status === 'DONE' && currentJob.resultRef) {
      fetchPdfLink(currentJob.resultRef);
    } else if (currentJob?.status === 'FAILED') {
      Alert.alert(
        'Processing Failed',
        'Failed to process your voice recording. Please try again.',
        [{ text: 'OK', onPress: handleReset }]
      );
    } else if (currentJob?.status === 'PENDING' || currentJob?.status === 'RUNNING') {
      setRecordingState('processing');
    }
  }, [currentJob?.status]);

  const fetchPdfLink = async (invoiceId: string) => {
    try {
      const url = await getInvoicePdfLink(invoiceId);
      setPdfUrl(url);
      setRecordingState('done');
    } catch (error) {
      console.error('Failed to get PDF link:', error);
      Alert.alert('Error', 'Failed to get invoice PDF. Please try again.');
      setRecordingState('idle');
    }
  };

  const handleViewPdf = async () => {
    if (pdfUrl) {
      await Linking.openURL(pdfUrl);
    }
  };

  const handleReset = () => {
    clearCurrentJob();
    setPdfUrl(null);
    setRecordingState('idle');
    setRecordingDuration(0);
  };

  const startRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission Denied', 'Microphone permission is required to record audio.');
        return false;
      }

      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      audioRecorder.record();
      setRecordingState('recording');
      setRecordingDuration(0);

      intervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
      return false;
    }
  };

  const stopRecording = async (cancelled: boolean = false) => {
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      await audioRecorder.stop();
      
      if (cancelled) {
        setRecordingState('idle');
        setRecordingDuration(0);
        return;
      }

      const uri = audioRecorder.uri;

      if (uri) {
        await uploadRecording(uri);
      } else {
        Alert.alert('Error', 'Recording file not found. Please try again.');
        setRecordingState('idle');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
      setRecordingState('idle');
    }
  };

  const uploadRecording = async (uri: string) => {
    setRecordingState('uploading');
    try {
      const jobId = await createInvoiceFromVoice(uri);
      setCurrentJob({ id: jobId, status: 'PENDING' });
      setRecordingState('processing');
      setRecordingDuration(0);
    } catch (error: any) {
      console.error('Failed to upload recording:', error);
      Alert.alert(
        'Upload Failed',
        error.response?.data?.message || 'Failed to upload recording. Please try again.'
      );
      setRecordingState('idle');
    }
  };

  const handlePressIn = async (event: any) => {
    console.log('Press In - Current State:', recordingState);
    if (recordingState !== 'idle') return;
    touchStartX.current = event.nativeEvent.pageX;
    slideX.setValue(0);
    setIsCancelling(false);
    console.log('Starting recording...');
    await startRecording();
  };

  const handlePressOut = (event: any) => {
    const currentX = event.nativeEvent.pageX;
    const deltaX = currentX - touchStartX.current;
    const shouldCancel = deltaX < CANCEL_THRESHOLD;
    
    console.log('Press Out - Current State:', recordingState, 'DeltaX:', deltaX, 'Should Cancel:', shouldCancel);
    
    if (recordingState === 'recording') {
      Animated.spring(slideX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
      setIsCancelling(false);
      stopRecording(shouldCancel);
    }
  };

  const handleTouchMove = (event: any) => {
    if (recordingState !== 'recording') return;
    
    const currentX = event.nativeEvent.pageX;
    const deltaX = currentX - touchStartX.current;
    
    console.log('Touch Move - DeltaX:', deltaX, 'Threshold:', CANCEL_THRESHOLD);
    
    if (deltaX < 0) {
      const clampedDelta = Math.max(deltaX, CANCEL_THRESHOLD - 20);
      slideX.setValue(clampedDelta);
      const shouldCancel = deltaX < CANCEL_THRESHOLD;
      if (shouldCancel !== isCancelling) {
        setIsCancelling(shouldCancel);
      }
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderContent = () => {
    switch (recordingState) {
      case 'idle':
        return (
          <View style={styles.idleContainer}>
            <View style={styles.micIconContainer}>
              <Ionicons name="mic" size={36} color="#666" />
            </View>
            <Pressable
              style={styles.recordButton}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onTouchMove={handleTouchMove}
              delayLongPress={0}
            >
              <Ionicons name="mic" size={24} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.recordButtonText}>Hold to Record</Text>
            </Pressable>
            <Text style={styles.hint}>Press and hold to record your invoice</Text>
          </View>
        );

      case 'recording':
        return (
          <View style={styles.recordingContainer}>
            <View style={styles.slideHintContainer}>
              <Animated.View
                style={[
                  styles.slideHint,
                  {
                    opacity: slideX.interpolate({
                      inputRange: [CANCEL_THRESHOLD, 0],
                      outputRange: [1, 0.3],
                    }),
                  },
                ]}
              >
                <Text style={styles.slideHintText}>{'<'} Slide to cancel</Text>
              </Animated.View>
            </View>
            
            <View style={styles.timerContainer}>
              <View style={[styles.recordingDot, isCancelling && styles.cancellingDot]} />
              <Text style={[styles.timerText, isCancelling && styles.cancellingText]}>
                {formatDuration(recordingDuration)}
              </Text>
            </View>

            <Pressable
              onPressOut={handlePressOut}
              onTouchMove={handleTouchMove}
              style={{ alignItems: 'center' }}
            >
              <Animated.View
                style={[
                  styles.recordButtonActive,
                  { transform: [{ translateX: slideX }] },
                  isCancelling && styles.recordButtonCancelling,
                ]}
              >
                {isCancelling ? (
                  <Ionicons name="close" size={32} color="#fff" />
                ) : (
                  <View style={styles.recordingCircle} />
                )}
              </Animated.View>
            </Pressable>
            
            <Text style={styles.hint}>
              {isCancelling ? 'Release to cancel' : 'Release to send'}
            </Text>
          </View>
        );

      case 'uploading':
        return (
          <View style={styles.uploadingContainer}>
            <View style={styles.uploadingIconContainer}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
            <Text style={styles.uploadingText}>Uploading...</Text>
            <Text style={styles.hint}>Please wait</Text>
          </View>
        );

      case 'processing':
        return (
          <View style={styles.processingContainer}>
            <View style={styles.progressContainer}>
              <ActivityIndicator size="large" color="#3498db" />
            </View>
            <Text style={styles.processingText}>
              {currentJob?.status === 'PENDING' ? 'Queued...' : 'Processing...'}
            </Text>
            <Text style={styles.hint}>Your invoice is being generated</Text>
          </View>
        );

      case 'done':
        return (
          <View style={styles.doneContainer}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </View>
            <Text style={styles.successText}>Invoice Ready!</Text>
            
            <Pressable style={styles.viewPdfButton} onPress={handleViewPdf}>
              <Text style={styles.viewPdfButtonText}>View Invoice PDF</Text>
            </Pressable>
            
            <Pressable onPress={handleReset}>
              <Text style={styles.newRecordingLink}>Create Another Invoice</Text>
            </Pressable>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Invoice</Text>
      <Text style={styles.subtitle}>
        Record a voice message describing the invoice details
      </Text>
      {renderContent()}
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
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 48,
  },
  hint: {
    fontSize: 14,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },

  // Idle State
  idleContainer: {
    alignItems: 'center',
  },
  micIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  recordButton: {
    flexDirection: 'row',
    backgroundColor: '#3498db',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },

  // Recording State
  recordingContainer: {
    alignItems: 'center',
    width: '100%',
  },
  slideHintContainer: {
    height: 30,
    marginBottom: 16,
  },
  slideHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slideHintText: {
    color: '#999',
    fontSize: 14,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e74c3c',
    marginRight: 8,
  },
  cancellingDot: {
    backgroundColor: '#999',
  },
  timerText: {
    fontSize: 48,
    fontWeight: '300',
    color: '#e74c3c',
    fontVariant: ['tabular-nums'],
  },
  cancellingText: {
    color: '#999',
  },
  recordButtonActive: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e74c3c',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  recordButtonCancelling: {
    backgroundColor: '#999',
  },
  recordingCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },

  // Uploading State
  uploadingContainer: {
    alignItems: 'center',
  },
  uploadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3498db',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3498db',
  },

  // Processing State
  processingContainer: {
    alignItems: 'center',
  },
  progressContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f4fc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  processingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3498db',
  },

  // Done State
  doneContainer: {
    alignItems: 'center',
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#27ae60',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#27ae60',
    marginBottom: 24,
  },
  viewPdfButton: {
    backgroundColor: '#3498db',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginBottom: 16,
  },
  viewPdfButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  newRecordingLink: {
    color: '#3498db',
    fontSize: 16,
    paddingVertical: 8,
  },
});
