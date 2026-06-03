import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? (
  import.meta.env.PROD ? window.location.origin : 'http://localhost:4000'
);

const apiClient = axios.create({
  baseURL: apiBaseUrl,
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
