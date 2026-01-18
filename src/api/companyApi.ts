import apiClient from './axios';

export interface CompanyData {
  businessName: string;
  address: string;
  phone: string;
  email: string;
  currency?: string;
  paymentNotes?: string;
}

export const createCompany = async (companyData: CompanyData) => {
  const response = await apiClient.post('/companies', companyData);
  return response.data;
};

export const getMyCompany = async (): Promise<CompanyData | null> => {
  try {
    const response = await apiClient.get<CompanyData>('/companies/me');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const updateCompany = async (companyData: CompanyData) => {
  const response = await apiClient.put('/companies/me', companyData);
  return response.data;
};

export const deleteUserAccount = async () => {
  const response = await apiClient.delete('/users/me');
  return response.data;
};
