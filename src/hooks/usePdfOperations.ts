import { useState, useCallback } from "react";
import { Linking } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import Toast from "react-native-root-toast";

export function usePdfOperations() {
  const [isDownloading, setIsDownloading] = useState(false);

  const getInvoicePdf = useCallback(async (pdfUrl: string, invoiceNumber: string): Promise<string> => {
    const fileName = `Invoice_${invoiceNumber}.pdf`;
    const fileUri = Paths.document.uri + fileName;

    const file = new File(fileUri);
    if (file.exists) {
      return fileUri;
    }
    const result = await File.downloadFileAsync(pdfUrl, file);

    if (!result.exists || result.size <= 0) {
      throw new Error("Download failed");
    }

    return result.uri;
  }, []);

  const downloadPdf = useCallback(async (pdfUrl: string, invoiceNumber: string) => {
    try {
      setIsDownloading(true);
      const uri = await getInvoicePdf(pdfUrl, invoiceNumber);

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
  }, [getInvoicePdf]);

  const sharePdf = useCallback(async (pdfUrl: string, invoiceNumber: string) => {
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

      const uri = await getInvoicePdf(pdfUrl, invoiceNumber);

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
  }, [getInvoicePdf]);

  const viewPdf = useCallback(async (pdfUrl: string, invoiceNumber: string) => {
    try {
      const uri = await getInvoicePdf(pdfUrl, invoiceNumber);

      const canOpen = await Linking.canOpenURL(uri);
      if (canOpen) {
        await Linking.openURL(uri);
      } else {
        Toast.show(
          "No app available to view PDFs. Please install a PDF viewer from your app store.",
          {
            duration: Toast.durations.LONG,
            position: Toast.positions.BOTTOM,
            shadow: true,
            animation: true,
            backgroundColor: "#f59e0b",
            textColor: "#ffffff",
          }
        );
      }
    } catch (error) {
      console.error("Failed to open PDF:", error);
      Toast.show("Failed to open PDF. Please try again.", {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        shadow: true,
        animation: true,
        backgroundColor: "#ef4444",
        textColor: "#ffffff",
      });
    }
  }, [getInvoicePdf]);

  return {
    downloadPdf,
    sharePdf,
    viewPdf,
    isDownloading,
  };
}
