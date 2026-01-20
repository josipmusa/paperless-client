import React, {useEffect} from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { CheckCircle2, Eye, Share2, Download, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';

function BlurWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return (
        <View style={styles.webBackdrop}>
          {children}
        </View>
    );
  }

  return (
      <BlurView intensity={20} tint="dark" style={styles.modalOverlay}>
        {children}
      </BlurView>
  );
}

export function InvoiceSuccessModal({ visible, onClose, onDownload, onShare, onView, canInteract }: any) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible]);

  const Content = (
      <BlurWrapper>
        <View style={styles.modalContent}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <X size={20} color="#94a3b8" />
          </Pressable>

          <View style={styles.iconContainer}>
            <View style={styles.iconGlow} />
            <CheckCircle2 size={50} color="#4ade80" strokeWidth={2.5} />
          </View>

          <Text style={styles.modalTitle}>Invoice Created!</Text>
          <Text style={styles.modalSubtext}>
            The voice recording has been successfully converted into a digital invoice.
          </Text>

          <Pressable
              style={[styles.primaryBtn, !canInteract && styles.disabledBtn]}
              onPress={onView}
              disabled={!canInteract}
          >
            <Eye size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Preview Invoice</Text>
          </Pressable>

          <View style={styles.secondaryActions}>
            <Pressable style={styles.iconBtn} onPress={onDownload} disabled={!canInteract}>
              <Download size={20} color="#60a5fa" />
              <Text style={styles.iconBtnLabel}>Save</Text>
            </Pressable>

            <View style={styles.modalDivider} />

            <Pressable style={styles.iconBtn} onPress={onShare} disabled={!canInteract}>
              <Share2 size={20} color="#4ade80" />
              <Text style={styles.iconBtnLabel}>Share</Text>
            </Pressable>
          </View>
        </View>
      </BlurWrapper>
  );

  return Platform.OS === 'web'
      ? (visible ? <View style={styles.webOverlay}>{Content}</View> : null)
      : (
          <Modal visible={visible} transparent animationType="fade">
            {Content}
          </Modal>
      );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 8,
  },
  iconContainer: {
    marginBottom: 20,
    marginTop: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#22c55e',
    opacity: 0.2,
    transform: [{ scale: 1.5 }],
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 8,
  },
  modalSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryActions: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 8,
  },
  iconBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  iconBtnLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  modalDivider: {
    width: 1,
    backgroundColor: '#334155',
    marginVertical: 8,
  },
  webOverlay: {
    position: 'static',
    inset: 0,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  webBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)', // Slate-900-ish
    padding: 24,
    borderRadius: 28,
  },
  disabledBtn: {
    opacity: 0.5,
  }
});