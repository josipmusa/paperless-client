import apiClient from './axios';
import { Platform } from 'react-native';

export const createInvoiceFromVoice = async (audioUri: string): Promise<string> => {
  const formData = new FormData();
  
  // On iOS, ensure the URI has the correct prefix
  const fileUri = Platform.OS === 'ios' && !audioUri.startsWith('file://') 
    ? `file://${audioUri}` 
    : audioUri;
  
  formData.append('file', {
    uri: fileUri,
    type: 'audio/wav',
    name: 'recording.wav',
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
