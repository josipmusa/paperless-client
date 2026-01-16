import React from "react";
import { Modal, StyleSheet, View, Text, Pressable, ActivityIndicator, Platform } from "react-native";
import { X } from "lucide-react-native";
import { WebView } from "react-native-webview";

interface PdfViewerProps {
  visible: boolean;
  pdfUri: string;
  invoiceNumber: string;
  onClose: () => void;
}

export function PdfViewer({ visible, pdfUri, invoiceNumber, onClose }: PdfViewerProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [base64Data, setBase64Data] = React.useState<string>("");

  React.useEffect(() => {
    if (visible && pdfUri) {
      setIsLoading(true);
      setError(null);
      loadPdfAsBase64();
    }
  }, [visible, pdfUri]);

  const loadPdfAsBase64 = async () => {
    try {
      const { readAsStringAsync } = await import("expo-file-system");
      const base64 = await readAsStringAsync(pdfUri, {
        encoding: "base64",
      });
      setBase64Data(base64);
      setIsLoading(false);
    } catch (err) {
      console.error("Error loading PDF:", err);
      setError("Failed to load PDF. Please try again.");
      setIsLoading(false);
    }
  };

  const getPdfHtml = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              background-color: #0f172a;
              overflow: auto;
            }
            #pdf-container {
              width: 100%;
              height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            embed {
              width: 100%;
              height: 100%;
            }
          </style>
        </head>
        <body>
          <div id="pdf-container">
            <embed src="data:application/pdf;base64,${base64Data}" type="application/pdf" width="100%" height="100%" />
          </div>
        </body>
      </html>
    `;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Invoice #{invoiceNumber}</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#f1f5f9" />
          </Pressable>
        </View>

        {/* PDF View */}
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

          {!isLoading && !error && base64Data && (
            <WebView
              source={{ html: getPdfHtml() }}
              style={styles.pdf}
              originWhitelist={['*']}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                setError("Failed to display PDF. Please try again.");
                console.error("WebView Error:", nativeEvent);
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 50,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f1f5f9",
  },
  closeButton: {
    padding: 8,
  },
  pdfContainer: {
    flex: 1,
    position: "relative",
  },
  pdf: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
    zIndex: 10,
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
});
