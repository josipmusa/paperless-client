import React, { useRef } from "react";
import * as Haptics from "expo-haptics";
import { StyleSheet, Text, View, Animated, Pressable } from "react-native";
import { Download, Eye, Share2, AlertCircle } from "lucide-react-native";
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

// Modern "Pill" colors with background opacity
const getStatusColors = (status: JobStatus) => {
    switch (status) {
        case "PENDING":
            return { bg: "rgba(202, 138, 4, 0.15)", text: "#facc15" };
        case "RUNNING":
            return { bg: "rgba(37, 99, 235, 0.15)", text: "#60a5fa" };
        case "DONE":
            return { bg: "rgba(22, 163, 74, 0.15)", text: "#4ade80" };
        case "FAILED":
            return { bg: "rgba(220, 38, 38, 0.15)", text: "#f87171" };
        default:
            return { bg: "rgba(148, 163, 184, 0.15)", text: "#94a3b8" };
    }
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
    const statusColors = getStatusColors(status);

    return (
        <View style={styles.cardContainer}>
            {/* TOP SECTION: Info & Status */}
            <View style={styles.cardBody}>
                <View style={styles.topRow}>
                    {/* Left Side: Name & ID */}
                    <View style={styles.infoColumn}>
                        <Text style={styles.customerName} numberOfLines={1}>
                            {customerName || "Processing..."}
                        </Text>
                        <Text style={styles.invoiceId}>
                            {invoiceNumber ? `#${invoiceNumber}` : "Generating ID..."}
                        </Text>
                    </View>

                    {/* Right Side: Status Badge */}
                    <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                        <Text style={[styles.statusText, { color: statusColors.text }]}>
                            {status === "DONE" ? "COMPLETED" : status}
                        </Text>
                    </View>
                </View>

                {/* Amount Row (Aligned Right or Left depending on preference, currently Right for emphasis) */}
                <View style={styles.amountRow}>
                    {amount ? (
                        <Text style={styles.amountText}>{amount}</Text>
                    ) : (
                        <View style={{ height: 28 }} /> // Spacer to prevent jumping
                    )}
                </View>

                {/* Error State */}
                {fetchFailed && invoiceId && (
                    <Pressable
                        style={styles.errorBanner}
                        onPress={() => onRetryFetch(jobId, invoiceId)}
                    >
                        <AlertCircle size={14} color="#fca5a5" />
                        <Text style={styles.errorText}>Sync Failed • Tap to Retry</Text>
                    </Pressable>
                )}
            </View>

            {/* DIVIDER */}
            <View style={styles.divider} />

            {/* BOTTOM SECTION: Actions */}
            <View style={styles.actionRow}>
                <ActionButton
                    icon={<Download size={18} color={canInteract ? "#60a5fa" : "#475569"} />}
                    label="Save"
                    disabled={!canInteract}
                    onPress={() => onDownload(pdfDownloadUrl!, invoiceNumber!)}
                />

                {/* Vertical Divider between buttons */}
                <View style={styles.verticalDivider} />

                <ActionButton
                    icon={<Share2 size={18} color={canInteract ? "#4ade80" : "#475569"} />}
                    label="Share"
                    disabled={!canInteract}
                    onPress={() => onShare(pdfDownloadUrl!, invoiceNumber!)}
                />

                <View style={styles.verticalDivider} />

                <ActionButton
                    icon={<Eye size={18} color={canInteract ? "#a78bfa" : "#475569"} />}
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
        Animated.spring(scaleValue, {
            toValue: 0.95,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleValue, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
        }).start();
    };

    const handlePress = () => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    return (
        <Pressable
            disabled={disabled}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={styles.actionBtnTouchArea}
        >
            <Animated.View style={[styles.actionBtnContent, { transform: [{ scale: scaleValue }], opacity: disabled ? 0.4 : 1 }]}>
                {icon}
                <Text style={styles.actionLabel}>{label}</Text>
            </Animated.View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    cardContainer: {
        backgroundColor: "#1e293b", // Slate 800
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#334155", // Slate 700
        overflow: 'hidden', // Ensures children don't bleed out
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    cardBody: {
        padding: 16,
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    infoColumn: {
        flex: 1,
        marginRight: 12,
    },
    customerName: {
        fontSize: 17,
        fontWeight: "700",
        color: "#f8fafc", // Slate 50
        letterSpacing: 0.3,
        marginBottom: 4,
    },
    invoiceId: {
        fontSize: 13,
        color: "#94a3b8", // Slate 400
        fontWeight: "500",
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    statusText: {
        fontSize: 11,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    amountRow: {
        marginTop: 12,
        alignItems: 'flex-end', // Aligns amount to the right
    },
    amountText: {
        fontSize: 24,
        fontWeight: "700",
        color: "#f8fafc",
        letterSpacing: -0.5,
    },
    errorBanner: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        padding: 8,
        borderRadius: 8,
        gap: 6,
    },
    errorText: {
        color: '#fca5a5',
        fontSize: 12,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: "#334155", // Slate 700
    },
    actionRow: {
        flexDirection: "row",
        backgroundColor: "#273549", // Slightly lighter/different than card body
        height: 52,
    },
    verticalDivider: {
        width: 1,
        backgroundColor: "#334155",
        marginVertical: 10,
    },
    actionBtnTouchArea: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    actionBtnContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    actionLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: "#cbd5e1", // Slate 300
    },
});