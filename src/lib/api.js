import { supabase } from './supabase';

const BASE_URL = import.meta.env.VITE_API_URL;

async function request(method, path, body, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  };

  // Don't set Content-Type for FormData — browser sets it with boundary
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (res.status === 204) return null;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (isJson && data?.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

// Authenticated binary download (e.g. PDFs) — a plain <a href> can't send the
// Authorization header, so fetch the file and hand back a Blob.
async function requestBlob(path) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try { message = (await res.json()).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.blob();
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  blob: requestBlob,
  get: (path) => request('GET', path),
  post: (path, body, opts = {}) => request('POST', path, body, opts),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};
