import { InvoiceData } from '../api/invoiceApi';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  CompanySetup: undefined;
  Home: undefined;
  Recording: undefined;
  MainTabs: undefined;
  InvoiceDetail: { invoice: InvoiceData };
};

export type MainTabParamList = {
  Recording: undefined;
  Invoices: undefined;
  Settings: undefined;
};
