const RENDER_API_ORIGIN = 'https://secure-web-design-school-project.onrender.com';

function isVercelHost(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');
}

export function apiBaseUrl(): string {
  if (import.meta.env.PROD && isVercelHost()) {
    return window.location.origin;
  }

  return import.meta.env.VITE_API_BASE_URL ?? (
    import.meta.env.PROD ? window.location.origin : 'http://localhost:4000'
  );
}

export { RENDER_API_ORIGIN };
