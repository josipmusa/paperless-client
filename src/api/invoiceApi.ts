import apiClient from './axios';

export interface InvoiceJobResponse {
  id: string;
}

export const createInvoiceFromVoice = async (audioUri: string): Promise<InvoiceJobResponse> => {
  const formData = new FormData();
  
  formData.append('file', {
    uri: audioUri,
    type: 'audio/wav',
    name: 'recording.wav',
  } as any);

  const response = await apiClient.post<InvoiceJobResponse>('/invoices', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};
