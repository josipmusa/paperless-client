import apiClient from './axios';

export const createInvoiceFromVoice = async (audioUri: string): Promise<string> => {
  const formData = new FormData();
  
  formData.append('file', {
    uri: audioUri,
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
