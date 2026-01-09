import apiClient from './axios';
import { Platform } from 'react-native';

export const createInvoiceFromVoice = async (audioUri: string): Promise<string> => {
  const formData = new FormData();
  
  // On iOS, ensure the URI has the correct prefix
  const fileUri = Platform.OS === 'ios' && !audioUri.startsWith('file://') 
    ? `file://${audioUri}` 
    : audioUri;
  
  console.log("Original URI:", audioUri);
  console.log("Formatted URI:", fileUri);
  console.log("Platform:", Platform.OS);
  
  // Determine file extension from URI
  const uriParts = audioUri.split('.');
  const fileExtension = uriParts[uriParts.length - 1];
  const fileName = `recording.${fileExtension}`;
  
  // Determine MIME type based on extension
  let mimeType = 'audio/m4a';
  if (fileExtension === 'wav') {
    mimeType = 'audio/wav';
  } else if (fileExtension === 'mp3') {
    mimeType = 'audio/mp3';
  } else if (fileExtension === 'webm') {
    mimeType = 'audio/webm';
  }
  
  console.log("File name:", fileName);
  console.log("MIME type:", mimeType);
  
  formData.append('file', {
    uri: fileUri,
    type: mimeType,
    name: fileName,
  } as any);

  console.log("FormData prepared, sending request...");

  const response = await apiClient.post<string>('/invoices', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  console.log("Response received:", response.data);
  return response.data;
};

export const getInvoicePdfLink = async (invoiceId: string): Promise<string> => {
  const response = await apiClient.get<string>(`/invoices/${invoiceId}/links`);
  return response.data;
};
