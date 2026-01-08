import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useAudioRecorder, RecordingOptions, AudioModule, IOSOutputFormat, AudioQuality } from 'expo-audio';
import { createInvoiceFromVoice, getInvoicePdfLink } from '../api/invoiceApi';
import { useJobStore, initializeJobWebSocket, disconnectJobWebSocket } from '../store/jobStore';
import { JobStatus } from '../websocket/jobWebSocket';

const recordingOptions: RecordingOptions = {
  extension: '.wav',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    extension: '.wav',
    outputFormat: 'default',
    audioEncoder: 'default',
    sampleRate: 44100,
  },
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 44100,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/wav',
    bitsPerSecond: 128000,
  },
};

export default function RecordingScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const audioRecorder = useAudioRecorder(recordingOptions);

  const currentJob = useJobStore((state) => state.currentJob);
  const setCurrentJob = useJobStore((state) => state.setCurrentJob);
  const clearCurrentJob = useJobStore((state) => state.clearCurrentJob);

  useEffect(() => {
    initializeJobWebSocket();
    return () => {
      disconnectJobWebSocket();
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
    }
  }, [currentJob?.status]);

  const fetchPdfLink = async (invoiceId: string) => {
    setIsLoadingPdf(true);
    try {
      const url = await getInvoicePdfLink(invoiceId);
      setPdfUrl(url);
    } catch (error) {
      console.error('Failed to get PDF link:', error);
      Alert.alert('Error', 'Failed to get invoice PDF. Please try again.');
    } finally {
      setIsLoadingPdf(false);
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
  };

  const startRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission Denied', 'Microphone permission is required to record audio.');
        return;
      }

      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      audioRecorder.record();
      setIsRecording(true);
      setRecordingDuration(0);

      intervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      setIsRecording(false);
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (uri) {
        await uploadRecording(uri);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    }
  };

  const uploadRecording = async (uri: string) => {
    setIsUploading(true);
    try {
      const jobId = await createInvoiceFromVoice(uri);
      setCurrentJob({ id: jobId, status: 'PENDING' });
      setRecordingDuration(0);
    } catch (error: any) {
      console.error('Failed to upload recording:', error);
      Alert.alert(
        'Upload Failed',
        error.response?.data?.message || 'Failed to upload recording. Please try again.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusText = (status: JobStatus): string => {
    switch (status) {
      case 'PENDING':
        return 'Queued for processing...';
      case 'RUNNING':
        return 'Processing your recording...';
      case 'DONE':
        return 'Invoice created!';
      case 'FAILED':
        return 'Processing failed';
      default:
        return '';
    }
  };

  const getStatusColor = (status: JobStatus): string => {
    switch (status) {
      case 'PENDING':
        return '#f39c12';
      case 'RUNNING':
        return '#3498db';
      case 'DONE':
        return '#27ae60';
      case 'FAILED':
        return '#e74c3c';
      default:
        return '#666';
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Invoice</Text>
      <Text style={styles.subtitle}>
        Record a voice message describing the invoice details
      </Text>

      <View style={styles.recordingArea}>
        <Text style={styles.duration}>{formatDuration(recordingDuration)}</Text>
        
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording...</Text>
          </View>
        )}
      </View>

      {isUploading ? (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.uploadingText}>Uploading recording...</Text>
        </View>
      ) : isLoadingPdf ? (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#27ae60" />
          <Text style={[styles.statusText, { color: '#27ae60' }]}>
            Preparing your invoice...
          </Text>
        </View>
      ) : pdfUrl ? (
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>Invoice Ready!</Text>
          <TouchableOpacity style={styles.viewPdfButton} onPress={handleViewPdf}>
            <Text style={styles.viewPdfButtonText}>View PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newRecordingButton} onPress={handleReset}>
            <Text style={styles.newRecordingButtonText}>Create Another Invoice</Text>
          </TouchableOpacity>
        </View>
      ) : currentJob && (currentJob.status === 'PENDING' || currentJob.status === 'RUNNING') ? (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={getStatusColor(currentJob.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(currentJob.status) }]}>
            {getStatusText(currentJob.status)}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordButtonActive,
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.recordButtonInner,
              isRecording && styles.recordButtonInnerActive,
            ]}
          />
        </TouchableOpacity>
      )}

      <Text style={styles.hint}>
        {pdfUrl
          ? 'Your invoice is ready to view'
          : currentJob && (currentJob.status === 'PENDING' || currentJob.status === 'RUNNING')
            ? 'Please wait while we process your recording'
          : isRecording
            ? 'Tap to stop recording'
            : 'Tap to start recording'}
      </Text>
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
  recordingArea: {
    alignItems: 'center',
    marginBottom: 48,
  },
  duration: {
    fontSize: 48,
    fontWeight: '300',
    color: '#333',
    fontVariant: ['tabular-nums'],
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e74c3c',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    color: '#e74c3c',
    fontWeight: '500',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#e74c3c',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  recordButtonActive: {
    borderColor: '#333',
  },
  recordButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e74c3c',
  },
  recordButtonInnerActive: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  hint: {
    fontSize: 14,
    color: '#999',
  },
  uploadingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#3498db',
  },
  processingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 48,
    color: '#27ae60',
    marginBottom: 16,
  },
  successText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#27ae60',
    marginBottom: 24,
  },
  viewPdfButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 12,
  },
  viewPdfButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  newRecordingButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  newRecordingButtonText: {
    color: '#3498db',
    fontSize: 14,
  },
});
