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
