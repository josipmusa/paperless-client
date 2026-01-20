import React from "react";
import {Modal, StyleSheet, View, Text, Pressable, ActivityIndicator, Platform} from "react-native";
import { X } from "lucide-react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PdfViewerProps {
  visible: boolean;
  pdfBase64: string;
  invoiceNumber: string;
  onClose: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function PdfViewer({ visible, pdfBase64, invoiceNumber, onClose, isLoading: externalLoading = false, error: externalError = null }: PdfViewerProps) {
  const insets = useSafeAreaInsets();
  const isLoading = externalLoading;
  const error = externalError;

  const getPdfHtml = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background-color: #0f172a; overflow: hidden; } /* prevented body scroll */
            #pdf-container { width: 100vw; height: 100vh; display: flex; }
            embed { width: 100%; height: 100%; }
          </style>
        </head>
        <body>
          <div id="pdf-container">
            <embed src="data:application/pdf;base64,${pdfBase64}" type="application/pdf" width="100%" height="100%" />
          </div>
        </body>
      </html>
    `;
  };

  const Content = (
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.headerSafeBackground, Platform.OS === 'web' && { paddingTop: 16 }]}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Invoice {invoiceNumber}</Text>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
              <X size={24} color="#f1f5f9" />
            </Pressable>
          </View>
        </View>

        {/* PDF */}
        <View style={styles.pdfContainer}>
          {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#60a5fa" />
                <Text style={styles.loadingText}>Loading PDF...</Text>
              </View>
          )}

          {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={onClose} style={styles.errorButton}>
                  <Text style={styles.errorButtonText}>Close</Text>
                </Pressable>
              </View>
          )}

          {!isLoading && !error && pdfBase64 && (
              Platform.OS === 'web'
                  ? <iframe
                      src={`data:application/pdf;base64,${pdfBase64}`}
                      style={{ flex: 1, width: '100%', height: '100%' }}
                      title={`Invoice ${invoiceNumber}`}
                  />
                  : <WebView
                      source={{ html: getPdfHtml() }}
                      style={styles.pdf}
                      originWhitelist={['*']}
                      onError={({ nativeEvent }) => console.error('WebView Error:', nativeEvent)}
                  />
          )}
        </View>
      </View>
  );

  return Platform.OS === 'web'
      ? (visible ? <View style={styles.webOverlay}>{Content}</View> : null)
      : (
          <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent={true} presentationStyle="fullScreen">
            {Content}
          </Modal>
      );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  // 1. The container that handles the Safe Area Background color
  headerSafeBackground: {
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  // 2. The actual content row inside the safe area
  headerContent: {
    height: 56, // Fixed height for consistency
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f1f5f9",
    flex: 1, // Ensures title takes space but doesn't push X off screen
    marginRight: 16,
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Optional: subtle touch target background
    borderRadius: 20,
  },
  pdfContainer: {
    flex: 1,
    marginTop: 56, // same as header height
  },
  pdf: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject, // Cleaner way to fill parent
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
    zIndex: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#94a3b8",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: "#334155",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: "#f1f5f9",
    fontWeight: "600",
    fontSize: 14,
  },
  webOverlay: {
    position: 'static',
    inset: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
});