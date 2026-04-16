const VERCEL_API = 'https://api.vercel.com'
const TOKEN = process.env.VERCEL_API_TOKEN
const PROJECT_ID = process.env.VERCEL_PROJECT_ID

function authHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export async function addDomainToVercel(
  domain: string,
): Promise<{ verified: boolean; error?: string }> {
  if (!TOKEN || !PROJECT_ID) {
    return { verified: false, error: 'VERCEL_API_TOKEN or VERCEL_PROJECT_ID not configured' }
  }

  const res = await fetch(`${VERCEL_API}/v10/projects/${PROJECT_ID}/domains`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name: domain }),
  })

  const json = await res.json()

  if (!res.ok) {
    return { verified: false, error: json.error?.message ?? `Vercel API error ${res.status}` }
  }

  return { verified: json.verified ?? false }
}

export async function verifyDomain(
  domain: string,
): Promise<{ verified: boolean; error?: string }> {
  if (!TOKEN || !PROJECT_ID) {
    return { verified: false, error: 'VERCEL_API_TOKEN or VERCEL_PROJECT_ID not configured' }
  }

  const res = await fetch(
    `${VERCEL_API}/v10/projects/${PROJECT_ID}/domains/${encodeURIComponent(domain)}`,
    { headers: authHeaders() },
  )

  const json = await res.json()

  if (!res.ok) {
    return { verified: false, error: json.error?.message ?? `Vercel API error ${res.status}` }
  }

  return { verified: json.verified ?? false }
}
