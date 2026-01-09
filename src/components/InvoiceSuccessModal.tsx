import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { CheckCircle, Download, Share2 } from "lucide-react-native";

interface InvoiceSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  onDownload: () => void;
  onShare: () => void;
  canInteract: boolean;
}

export function InvoiceSuccessModal({
  visible,
  onClose,
  onDownload,
  onShare,
  canInteract,
}: InvoiceSuccessModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1}
        onPress={onClose}
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
              onPress={onDownload}
              disabled={!canInteract}
            >
              <Download size={16} color="white" />
              <Text style={styles.btnText}>Download PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={onShare}
              disabled={!canInteract}
            >
              <Share2 size={16} color="white" />
              <Text style={styles.btnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  modalTitle: { 
    fontSize: 18, 
    fontWeight: "600", 
    marginVertical: 12, 
    color: "#f1f5f9" 
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
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
  btnText: { 
    color: "white", 
    fontWeight: "600", 
    fontSize: 14 
  },
});
