import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Download, Share2, FileText } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { usePdfOperations } from '../hooks/usePdfOperations';
import { PdfViewer } from '../components/PdfViewer';

type InvoiceDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'InvoiceDetail'>;
type InvoiceDetailRouteProp = RouteProp<RootStackParamList, 'InvoiceDetail'>;

interface Props {
  navigation: InvoiceDetailNavigationProp;
  route: InvoiceDetailRouteProp;
}

export default function InvoiceDetailScreen({ navigation, route }: Props) {
  const { invoice } = route.params;
  const [isLoading, setIsLoading] = useState(false);

  const {
    downloadPdf,
    sharePdf,
    viewPdf,
    viewerVisible,
    currentPdfUri,
    currentInvoiceNumber,
    closeViewer,
  } = usePdfOperations();

  const handleDownload = async () => {
    setIsLoading(true);
    await downloadPdf(invoice.pdfDownloadUrl, invoice.invoiceNumber);
    setIsLoading(false);
  };

  const handleShare = async () => {
    setIsLoading(true);
    await sharePdf(invoice.pdfDownloadUrl, invoice.invoiceNumber);
    setIsLoading(false);
  };

  const handleView = async () => {
    setIsLoading(true);
    await viewPdf(invoice.pdfDownloadUrl, invoice.invoiceNumber);
    setIsLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoice Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Invoice Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.iconContainer}>
            <FileText size={32} color="#3b82f6" />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Invoice Number</Text>
            <Text style={styles.value}>{invoice.invoiceNumber}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{invoice.customerName}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Total Amount</Text>
            <Text style={styles.amountValue}>
              {invoice.currency} {invoice.totalAmount.toFixed(2)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Completed</Text>
            </View>
          </View>
        </View>

        {/* PDF Preview Section */}
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>PDF Document</Text>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={handleView}
            disabled={isLoading}
          >
            <FileText size={24} color="#3b82f6" />
            <View style={styles.previewTextContainer}>
              <Text style={styles.previewTitle}>View Invoice PDF</Text>
              <Text style={styles.previewSubtitle}>Tap to open full preview</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDownload}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Download size={20} color="#3b82f6" />
            )}
            <Text style={styles.actionButtonText}>Download PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShare}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Share2 size={20} color="#3b82f6" />
            )}
            <Text style={styles.actionButtonText}>Share PDF</Text>
          </TouchableOpacity>
        </View>

        {/* Immutable Notice */}
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>
            ℹ️ Invoices are read-only and cannot be edited after generation.
          </Text>
        </View>
      </ScrollView>

      {/* PDF Viewer Modal */}
      <PdfViewer
        visible={viewerVisible}
        pdfUri={currentPdfUri}
        invoiceNumber={currentInvoiceNumber}
        onClose={closeViewer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#1e3a5f',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: '#f1f5f9',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  amountValue: {
    fontSize: 18,
    color: '#10b981',
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
  },
  previewSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 12,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 16,
  },
  previewTextContainer: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  actionsSection: {
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  noticeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noticeText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
});
