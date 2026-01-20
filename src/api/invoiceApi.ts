import apiClient from './axios';
import {Platform} from 'react-native';

export interface InvoiceData {
  id: number;
  invoiceNumber: string;
  pdfDownloadUrl: string;
  customerName: string;
  totalAmount: number;
  currency: string;
  createdAt?: string;
}

export interface PaginatedInvoiceDataResponse {
  content: InvoiceData[];
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number; // Current page index (0-based)
  };
}

export interface InvoicePdfPreviewResponse {
  base64: string;
}

export const createInvoiceFromVoice = async (audioUri: string): Promise<string> => {
  console.log('[InvoiceAPI] Creating invoice from voice, URI length:', audioUri.length);
  const formData = new FormData();
  
  if (Platform.OS === 'web' && audioUri.startsWith('data:')) {
    // Web: Convert data URL to blob
    console.log('[InvoiceAPI] Converting data URL to blob...');
    const response = await fetch(audioUri);
    const blob = await response.blob();
    
    console.log('[InvoiceAPI] Blob created, type:', blob.type, 'size:', blob.size);
    
    // Determine the file extension from the MIME type
    const mimeType = blob.type;
    const extension = mimeType.includes('webm') ? 'webm' : 'ogg';
    
    formData.append('file', blob, `recording.${extension}`);
  } else {
    // Mobile: Use file URI
    const fileUri = Platform.OS === 'ios' && !audioUri.startsWith('file://') 
      ? `file://${audioUri}` 
      : audioUri;

    formData.append('file', {
      uri: fileUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);
  }

  console.log('[InvoiceAPI] Posting to /invoices...');
  const response = await apiClient.post<string>('/invoices', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  console.log('[InvoiceAPI] Response received, jobId:', response.data);
  return response.data;
};

export const getInvoiceInformation = async (invoiceId: number): Promise<InvoiceData | null> => {
  try {
    const response = await apiClient.get<InvoiceData>(`/invoices/${invoiceId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const getInvoices = async (page = 0, size = 3): Promise<InvoiceData[]> => {
  const response = await apiClient.get<PaginatedInvoiceDataResponse>('/invoices', {
    params: { page, size },
  });
  return response.data.content;
};

export const getPaginatedInvoices = async (page = 0, size = 50): Promise<PaginatedInvoiceDataResponse> => {
  const response = await apiClient.get<PaginatedInvoiceDataResponse>('/invoices', {
    params: { page, size },
  });
  return response.data;
};

export const getInvoicePdfPreview = async (invoiceId: number): Promise<string> => {
  const response = await apiClient.get<InvoicePdfPreviewResponse>(`/invoices/previews/${invoiceId}`);
  return response.data.base64
};

export const getSampleInvoicePdfPreview = async(): Promise<string> => {
  const response = await apiClient.get<InvoicePdfPreviewResponse>('/invoices/sample-previews');
  return response.data.base64;
}
