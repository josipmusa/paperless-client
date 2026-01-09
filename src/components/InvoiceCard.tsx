import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Download, Eye, Share2 } from "lucide-react-native";
import { StatusIndicator } from "./StatusIndicator";
import { JobStatus } from "../websocket/jobWebSocket";

interface InvoiceCardProps {
  jobId: string;
  invoiceId?: string;
  invoiceNumber?: string;
  customerName?: string;
  amount?: string;
  status: JobStatus;
  fetchFailed?: boolean;
  pdfDownloadUrl?: string;
  onRetryFetch: (jobId: string, invoiceId: string) => void;
  onDownload: (pdfUrl: string, invoiceNumber: string) => void;
  onShare: (pdfUrl: string, invoiceNumber: string) => void;
  onView: (pdfUrl: string, invoiceNumber: string) => void;
}

const statusStyle: Record<JobStatus, { color: string }> = {
  PENDING: { color: "#ca8a04" },
  RUNNING: { color: "#2563eb" },
  DONE: { color: "#16a34a" },
  FAILED: { color: "#dc2626" },
};

export function InvoiceCard({
  jobId,
  invoiceId,
  invoiceNumber,
  customerName,
  amount,
  status,
  fetchFailed,
  pdfDownloadUrl,
  onRetryFetch,
  onDownload,
  onShare,
  onView,
}: InvoiceCardProps) {
  const canInteract = status === "DONE" && !fetchFailed && pdfDownloadUrl && invoiceNumber;

  return (
    <View style={styles.invoiceCard}>
      <View style={styles.invoiceHeader}>
        <View style={styles.invoiceTitleContainer}>
          <StatusIndicator status={status} />
          <View style={styles.invoiceTextContainer}>
            <Text style={styles.invoiceTitle} numberOfLines={1}>
              {customerName || "Processing..."}
            </Text>
            {invoiceNumber && (
              <Text style={styles.invoiceNumber} numberOfLines={1}>
                #{invoiceNumber}
              </Text>
            )}
          </View>
        </View>
        <Text style={[styles.status, statusStyle[status]]}>
          {status}
        </Text>
      </View>
      {amount && (
        <Text style={styles.invoiceAmount}>{amount}</Text>
      )}
      
      {fetchFailed && invoiceId && (
        <TouchableOpacity 
          style={styles.retryBtn}
          onPress={() => onRetryFetch(jobId, invoiceId)}
        >
          <Text style={styles.retryBtnText}>Retry Fetch Invoice</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.invoiceActions}>
        <TouchableOpacity
          disabled={!canInteract}
          style={[
            styles.primaryBtn,
            !canInteract && styles.disabled,
          ]}
          onPress={() => canInteract && onDownload(pdfDownloadUrl, invoiceNumber)}
        >
          <Download size={18} color="white" />
          <Text style={styles.btnText}>Download PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!canInteract}
          style={[
            styles.shareBtn,
            !canInteract && styles.disabled,
          ]}
          onPress={() => canInteract && onShare(pdfDownloadUrl, invoiceNumber)}
        >
          <Share2 size={18} color="white" />
          <Text style={styles.btnText}>Share invoice</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!canInteract}
          style={[
            styles.viewBtn,
            !canInteract && styles.disabled,
          ]}
          onPress={() => canInteract && onView(pdfDownloadUrl, invoiceNumber)}
        >
          <Eye size={18} color="white" />
          <Text style={styles.btnText}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  invoiceCard: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  invoiceTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    flexShrink: 1,
  },
  invoiceTextContainer: {
    flex: 1,
    flexShrink: 1,
  },
  invoiceTitle: { 
    fontWeight: "600", 
    color: "#f1f5f9",
    fontSize: 16,
  },
  invoiceNumber: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  status: { 
    fontSize: 11, 
    fontWeight: "600",
    flexShrink: 0,
  },
  invoiceAmount: { 
    marginTop: 8, 
    fontSize: 18,
    fontWeight: "700", 
    color: "#3b82f6",
  },
  retryBtn: {
    backgroundColor: "#ca8a04",
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    alignItems: "center",
  },
  retryBtnText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  invoiceActions: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
    flexWrap: "wrap",
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
  viewBtn: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#7c3aed",
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { 
    color: "white", 
    fontWeight: "600", 
    fontSize: 14 
  },
  disabled: { 
    opacity: 0.4 
  },
});
