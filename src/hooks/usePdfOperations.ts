import {useCallback, useState} from "react";
import {File, Paths} from "expo-file-system";
import * as Sharing from "expo-sharing";
import Toast from "react-native-root-toast";
import {getInvoicePdfPreview} from "../api/invoiceApi";

export function usePdfOperations() {
    const [isDownloading, setIsDownloading] = useState(false);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [currentPdfBase64, setCurrentPdfBase64] = useState<string>("");
    const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState<string>("");
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);

    const downloadInvoicePdf = useCallback(async (invoiceId: number, invoiceNumber: string): Promise<string> => {
        const fileName = `Invoice_${invoiceNumber}.pdf`;

        const file = new File(Paths.document, fileName);
        if (file.exists) {
            return file.uri;
        }


        const base64Data = await getInvoicePdfPreview(invoiceId);

        file.create();

        // Note: The .write() method accepts string or Uint8Array.
        // To handle binary data correctly via base64, we decode it first.
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        file.write(binaryData);

        if (!file.exists || file.size <= 0) {
            throw new Error("Download failed");
        }

        return file.uri;
    }, []);

    const downloadPdf = useCallback(async (invoiceId: number, invoiceNumber: string) => {
        try {
            setIsDownloading(true);
            await downloadInvoicePdf(invoiceId, invoiceNumber);

            Toast.show(`Invoice ${invoiceNumber} is available offline`, {
                duration: Toast.durations.LONG,
                position: Toast.positions.BOTTOM,
                shadow: true,
                animation: true,
                backgroundColor: "#16a34a",
                textColor: "#ffffff",
            });
        } catch (error) {
            console.error("Failed to download PDF:", error);
            Toast.show("Failed to download PDF. Please try again.", {
                duration: Toast.durations.LONG,
                position: Toast.positions.BOTTOM,
                shadow: true,
                animation: true,
                backgroundColor: "#ef4444",
                textColor: "#ffffff",
            });
        } finally {
            setIsDownloading(false);
        }
    }, [downloadInvoicePdf]);

    const sharePdf = useCallback(async (invoiceId: number, invoiceNumber: string) => {
        try {
            const available = await Sharing.isAvailableAsync();
            if (!available) {
                Toast.show("Your device does not support sharing", {
                    duration: Toast.durations.LONG,
                    position: Toast.positions.BOTTOM,
                    shadow: true,
                    animation: true,
                    backgroundColor: "#f59e0b",
                    textColor: "#ffffff",
                });
                return;
            }

            const uri = await downloadInvoicePdf(invoiceId, invoiceNumber);

            await Sharing.shareAsync(uri, {
                mimeType: "application/pdf",
                dialogTitle: `Share Invoice ${invoiceNumber}`,
                UTI: "com.adobe.pdf",
            });
        } catch (error) {
            console.error(error);
            Toast.show("Could not share the invoice", {
                duration: Toast.durations.LONG,
                position: Toast.positions.BOTTOM,
                shadow: true,
                animation: true,
                backgroundColor: "#ef4444",
                textColor: "#ffffff",
            });
        }
    }, [downloadInvoicePdf]);

    const viewPdf = useCallback(async (invoiceId: number, invoiceNumber: string) => {
        try {
            setPdfLoading(true);
            setPdfError(null);
            setCurrentInvoiceNumber(invoiceNumber);
            setViewerVisible(true);

            const base64Data = await getInvoicePdfPreview(invoiceId);
            setCurrentPdfBase64(base64Data);
            setPdfLoading(false);
        } catch (error) {
            console.error("Failed to load PDF:", error);
            setPdfError("Failed to load PDF. Please try again.");
            setPdfLoading(false);
            Toast.show("Failed to open PDF. Please try again.", {
                duration: Toast.durations.LONG,
                position: Toast.positions.BOTTOM,
                shadow: true,
                animation: true,
                backgroundColor: "#ef4444",
                textColor: "#ffffff",
            });
        }
    }, []);

    const closeViewer = useCallback(() => {
        setViewerVisible(false);
        setCurrentPdfBase64("");
        setPdfError(null);
    }, []);

    return {
        downloadPdf,
        sharePdf,
        viewPdf,
        isDownloading,
        viewerVisible,
        currentPdfBase64,
        currentInvoiceNumber,
        closeViewer,
        pdfLoading,
        pdfError,
    };
}
