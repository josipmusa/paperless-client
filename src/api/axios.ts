import axios from 'axios';
import { supabase } from '../auth/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export default apiClient;
