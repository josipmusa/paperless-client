import { useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';

export function useWebAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const startRecording = useCallback(async () => {
    if (Platform.OS !== 'web') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use webm audio format which is widely supported
      let mimeType = 'audio/webm;codecs=opus';
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/ogg;codecs=opus';
      }
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/ogg';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }, []);

  const stopRecording = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (Platform.OS !== 'web' || !mediaRecorderRef.current) {
        resolve();
        return;
      }

      if (mediaRecorderRef.current.state === 'inactive') {
        resolve();
        return;
      }

      // Set up listener for when stopping is complete
      const currentRecorder = mediaRecorderRef.current;
      const originalOnStop = currentRecorder.onstop;
      
      currentRecorder.onstop = (event) => {
        console.log('[WebAudioRecorder] Recording stopped, audio chunks:', audioChunksRef.current.length);
        if (originalOnStop) {
          originalOnStop.call(currentRecorder, event);
        }
        setIsRecording(false);
        // Small delay to ensure blob is set
        setTimeout(() => {
          console.log('[WebAudioRecorder] Stop complete');
          resolve();
        }, 100);
      };

      console.log('[WebAudioRecorder] Stopping recording...');
      currentRecorder.stop();
    });
  }, []);

  const getRecordingUri = useCallback(async (): Promise<string | null> => {
    console.log('[WebAudioRecorder] Getting recording URI, blob exists:', !!audioBlob);
    if (!audioBlob) return null;

    // Convert blob to base64 data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log('[WebAudioRecorder] URI created, length:', result.length);
        resolve(result);
      };
      reader.readAsDataURL(audioBlob);
    });
  }, [audioBlob]);

  const clearRecording = useCallback(() => {
    setAudioBlob(null);
    audioChunksRef.current = [];
  }, []);

  return {
    startRecording,
    stopRecording,
    getRecordingUri,
    clearRecording,
    isRecording,
  };
}
