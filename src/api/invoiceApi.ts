import apiClient from './axios';
import { Platform } from 'react-native';

export interface InvoiceData {
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

export const createInvoiceFromVoice = async (audioUri: string): Promise<string> => {
  const formData = new FormData();
  
  // On iOS, ensure the URI has the correct prefix
  const fileUri = Platform.OS === 'ios' && !audioUri.startsWith('file://') 
    ? `file://${audioUri}` 
    : audioUri;

  formData.append('file', {
    uri: fileUri,
    type: 'audio/m4a',
    name: 'recording.m4a',
  } as any);

  const response = await apiClient.post<string>('/invoices', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const getInvoicePdfLink = async (invoiceId: string): Promise<string> => {
  const response = await apiClient.get<string>(`/invoices/${invoiceId}/links`);
  return response.data;
};


export const getInvoiceInformation = async (invoiceId: string): Promise<InvoiceData | null> => {
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
