interface AxiosLike {
  response?: {
    status?: number;
    data?: { error?: string };
  };
  message?: string;
}

export function getApiError(err: unknown): string {
  const e = err as AxiosLike;
  const status = e.response?.status;
  const serverMsg = e.response?.data?.error;

  switch (status) {
    case 400:
      return serverMsg ?? 'Invalid request. Please check your input.';
    case 401:
      return 'Your session has expired. Please log in again.';
    case 403:
      return serverMsg ?? 'You do not have permission to perform this action.';
    case 404:
      return serverMsg ?? 'The requested resource was not found.';
    case 409:
      return serverMsg ?? 'Conflict: this resource already exists.';
    case 413:
      return serverMsg ?? 'File is too large to upload.';
    case 422:
      return serverMsg ?? 'The request could not be processed. Please check your input.';
    case 429:
      return 'Too many requests — you have been rate limited. Please wait a moment and try again.';
    case 500:
      return 'Internal server error. Please try again later.';
    case 502:
      return 'Could not reach an external service (e.g. VirusTotal). Please try again later.';
    case 503:
      return serverMsg ?? 'Service temporarily unavailable. Please try again later.';
    default:
      if (!status) return 'Network error. Please check your connection and try again.';
      return serverMsg ?? `Unexpected error (HTTP ${status}). Please try again.`;
  }
}
