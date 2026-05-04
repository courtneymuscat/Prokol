import { promises as dns } from 'dns'

const VERCEL_API = 'https://api.vercel.com'
const TOKEN = process.env.VERCEL_API_TOKEN
const PROJECT_ID = process.env.VERCEL_PROJECT_ID

// Standard Vercel DNS targets gym owners should point to
export const VERCEL_CNAME_TARGET = 'cname.vercel-dns.com'
export const VERCEL_A_TARGET = '76.76.21.21'

function authHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Resolves actual DNS records for the domain and checks whether it points to
 * Vercel. Tries CNAME first (subdomains), falls back to A record (apex domains).
 * Returns the record type found, the raw records, and whether it's valid.
 */
export async function checkDnsForVercel(domain: string): Promise<{
  valid: boolean
  recordType: 'CNAME' | 'A' | null
  found: string[]
  expectedCname: string
  expectedA: string
}> {
  const base = {
    expectedCname: VERCEL_CNAME_TARGET,
    expectedA: VERCEL_A_TARGET,
  }

  // Try CNAME first — correct for subdomains like app.theirgym.com
  try {
    const records = await dns.resolveCname(domain)
    // Strip trailing dot that some resolvers append
    const normalised = records.map((r) => r.replace(/\.$/, '').toLowerCase())
    const valid = normalised.some(
      (r) => r === VERCEL_CNAME_TARGET || r.endsWith('.vercel-dns.com'),
    )
    return { ...base, valid, recordType: 'CNAME', found: normalised }
  } catch {
    // ENODATA or ENOTFOUND — no CNAME present, fall through to A record check
  }

  // Try A record — used for apex domains like theirgym.com
  try {
    const records = await dns.resolve4(domain)
    const valid = records.includes(VERCEL_A_TARGET)
    return { ...base, valid, recordType: 'A', found: records }
  } catch {
    // Domain doesn't resolve at all
  }

  return { ...base, valid: false, recordType: null, found: [] }
}

/**
 * Adds the domain to the Vercel project. Idempotent — a 409 (domain already
 * in project) is treated as success because the admin-approve flow adds it first.
 */
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

  // 409 = domain already registered on this project — treat as OK
  if (res.status === 409) return { verified: false }

  const json = await res.json()
  if (!res.ok) {
    return { verified: false, error: json.error?.message ?? `Vercel API error ${res.status}` }
  }

  return { verified: json.verified ?? false }
}

/**
 * Asks Vercel to re-probe DNS for the domain and flip its verified flag.
 * Call this after confirming DNS is correctly configured.
 */
export async function triggerVercelDomainVerify(
  domain: string,
): Promise<{ verified: boolean; error?: string }> {
  if (!TOKEN || !PROJECT_ID) {
    return { verified: false, error: 'VERCEL_API_TOKEN or VERCEL_PROJECT_ID not configured' }
  }

  const res = await fetch(
    `${VERCEL_API}/v9/projects/${PROJECT_ID}/domains/${encodeURIComponent(domain)}/verify`,
    { method: 'POST', headers: authHeaders() },
  )

  const json = await res.json()
  if (!res.ok) {
    return { verified: false, error: json.error?.message ?? `Vercel verify error ${res.status}` }
  }

  return { verified: json.verified ?? false }
}

/**
 * Gets the current domain status from Vercel without triggering a re-check.
 */
export async function getDomainStatus(
  domain: string,
): Promise<{ verified: boolean; error?: string }> {
  if (!TOKEN || !PROJECT_ID) {
    return { verified: false, error: 'VERCEL_API_TOKEN or VERCEL_PROJECT_ID not configured' }
  }

  const res = await fetch(
    `${VERCEL_API}/v9/projects/${PROJECT_ID}/domains/${encodeURIComponent(domain)}`,
    { headers: authHeaders() },
  )

  const json = await res.json()
  if (!res.ok) {
    return { verified: false, error: json.error?.message ?? `Vercel API error ${res.status}` }
  }

  return { verified: json.verified ?? false }
}
