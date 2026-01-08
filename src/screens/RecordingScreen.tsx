import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { createInvoiceFromVoice } from '../api/invoiceApi';

export default function RecordingScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone permission is required to record audio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
        },
      });

      recordingRef.current = recording;
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
    if (!recordingRef.current) return;

    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      setIsRecording(false);
      await recordingRef.current.stopAndUnloadAsync();
      
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

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
      Alert.alert(
        'Success',
        `Recording uploaded! Job ID: ${jobId}\n\nYour invoice is being processed.`
      );
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
        {isRecording
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
});
