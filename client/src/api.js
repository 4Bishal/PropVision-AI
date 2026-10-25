export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details } = {}) {
    super(message); this.status = status; this.code = code; this.details = details;
  }
}

export async function request(path, { signal, body, timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(data?.error?.message || 'The server could not complete this request.', {
      status: response.status, code: data?.error?.code || 'SERVER_ERROR', details: data?.error?.details,
    });
    if (!data) throw new ApiError('The API returned an invalid response.', { status: response.status, code: 'INVALID_RESPONSE' });
    return data;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? 'The request timed out. Please try again.'
      : 'Cannot reach the backend. Check that Express is running on port 5000.');
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', cancel);
  }
}

export const CATEGORY_FIELDS = ['sector', 'property_type', 'balcony', 'agePossession',
  'furnishing_type', 'floor_category', 'luxury_category'];

export function validateOptions(data) {
  if (CATEGORY_FIELDS.some((field) => !Array.isArray(data?.categories?.[field])
    || !data.categories[field].length || !data.categories[field].every((value) => typeof value === 'string'))) {
    throw new ApiError('The model schema is incomplete. Please retry the connection.', { status: 200, code: 'INVALID_SCHEMA' });
  }
  return data;
}

export function predictionPayload(values) {
  const payload = { ...values };
  for (const field of ['built_up_area', 'bedRoom', 'bathroom', 'servant room', 'store room']) {
    if (values[field] === '' || !Number.isFinite(Number(values[field]))) throw new Error(`Please enter a valid ${field}.`);
    payload[field] = Number(values[field]);
  }
  return payload;
}
