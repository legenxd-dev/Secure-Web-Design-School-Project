import axios from 'axios';
import { apiBaseUrl } from '../config/api';

const apiClient = axios.create({
  baseURL: apiBaseUrl(),
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? '';
    const isAuthRoute = url.includes('/api/auth/');
    if (error.response?.status === 401 && !isAuthRoute) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  },
);

export default apiClient;
