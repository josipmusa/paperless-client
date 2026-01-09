import React, { useRef } from "react";
import * as Haptics from "expo-haptics";
import { StyleSheet, Text, View, Animated, Pressable } from "react-native";
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
                    {status === "DONE" ? "COMPLETED" : status}
                </Text>
            </View>

            {amount && (
                <Text style={styles.invoiceAmount}>{amount}</Text>
            )}

            {fetchFailed && invoiceId && (
                <Pressable
                    style={styles.retryBtn}
                    onPress={() => onRetryFetch(jobId, invoiceId)}
                >
                    <Text style={styles.retryBtnText}>Retry Fetch Invoice</Text>
                </Pressable>
            )}

            <View style={styles.invoiceActions}>
                <ActionButton
                    icon={<Download size={16} color="#60a5fa" />}
                    label="Save"
                    disabled={!canInteract}
                    onPress={() => onDownload(pdfDownloadUrl!, invoiceNumber!)}
                />

                <ActionButton
                    icon={<Share2 size={16} color="#4ade80" />}
                    label="Share"
                    disabled={!canInteract}
                    onPress={() => onShare(pdfDownloadUrl!, invoiceNumber!)}
                />

                <ActionButton
                    icon={<Eye size={16} color="#a78bfa" />}
                    label="View"
                    disabled={!canInteract}
                    onPress={() => onView(pdfDownloadUrl!, invoiceNumber!)}
                />
            </View>
        </View>
    );
}

function ActionButton({ icon, label, disabled, onPress }: any) {
    const scaleValue = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        if (disabled) return;
        // Modern "Snappy" compression
        Animated.spring(scaleValue, {
            toValue: 0.92,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        // Modern spring back
        Animated.spring(scaleValue, {
            toValue: 1,
            tension: 150,
            friction: 7,
            useNativeDriver: true,
        }).start();
    };

    const handlePress = () => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    return (
        <Animated.View style={{ flex: 1, transform: [{ scale: scaleValue }] }}>
            <Pressable
                disabled={disabled}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
                style={({ pressed }) => [
                    styles.actionBtn,
                    disabled && styles.disabled,
                    pressed && { backgroundColor: "#3f4e64" },
                ]}
            >
                <View style={styles.actionContent}>
                    {icon}
                    <Text style={styles.actionLabel}>{label}</Text>
                </View>
            </Pressable>
        </Animated.View>
    );

}

const styles = StyleSheet.create({
    invoiceCard: {
        backgroundColor: "#1e293b", // Slate 800
        padding: 18,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#334155", // Slate 700
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
        gap: 10,
        flex: 1,
    },
    invoiceTextContainer: {
        flex: 1,
    },
    invoiceTitle: {
        fontWeight: "700",
        color: "#f8fafc",
        fontSize: 17,
    },
    invoiceNumber: {
        fontSize: 12,
        color: "#94a3b8",
        marginTop: 1,
    },
    status: {
        fontSize: 11,
        fontWeight: "700",
        textTransform: 'uppercase',
    },
    invoiceAmount: {
        marginTop: 12,
        fontSize: 20,
        fontWeight: "800",
        color: "#38bdf8", // Brighter blue for dark mode visibility
    },
    retryBtn: {
        backgroundColor: "#ca8a04",
        padding: 12,
        borderRadius: 12,
        marginTop: 16,
        alignItems: "center",
    },
    retryBtnText: {
        color: "white",
        fontWeight: "700",
        fontSize: 14,
    },
    invoiceActions: {
        flexDirection: "row",
        marginTop: 20,
        gap: 8,
    },
    actionBtn: {
        flex: 1,
        flexDirection: "row", // Side-by-side layout
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: "#334155", // Slate 700
        gap: 6,
    },
    actionContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    actionLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#f1f5f9",
    },
    disabled: {
        opacity: 0.2,
    },
});