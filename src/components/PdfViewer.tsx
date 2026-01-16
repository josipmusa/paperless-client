import React from "react";
import { Modal, StyleSheet, View, Text, Pressable, ActivityIndicator } from "react-native";
import { X } from "lucide-react-native";
import Pdf from "react-native-pdf";

interface PdfViewerProps {
  visible: boolean;
  pdfUri: string;
  invoiceNumber: string;
  onClose: () => void;
}

export function PdfViewer({ visible, pdfUri, invoiceNumber, onClose }: PdfViewerProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setError(null);
    }
  }, [visible, pdfUri]);

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
            </View>
          )}

          {pdfUri && (
            <Pdf
              source={{ uri: pdfUri }}
              style={styles.pdf}
              onLoadComplete={(numberOfPages) => {
                setIsLoading(false);
                console.log(`PDF loaded with ${numberOfPages} pages`);
              }}
              onError={(error) => {
                setIsLoading(false);
                setError("Failed to load PDF. Please try again.");
                console.error("PDF Error:", error);
              }}
              trustAllCerts={false}
              enablePaging={true}
              spacing={10}
              fitPolicy={0}
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
  },
});
