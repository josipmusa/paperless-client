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
