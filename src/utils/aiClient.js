export async function callAiEndpoint(endpoint, payload, personalApiKey = '') {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (personalApiKey && personalApiKey.trim()) {
    headers['x-gemini-api-key'] = personalApiKey.trim();
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Lỗi máy chủ AI (${res.status})`);
    err.code = data.code;
    throw err;
  }
  return data;
}
