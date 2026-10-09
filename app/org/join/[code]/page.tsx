import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function OrgJoinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const admin = createAdminClient()

  // Admin client bypasses RLS — unauthenticated visitors can't read
  // org_signup_links directly (same reasoning as coach_invites in
  // /invite/[token]/page.tsx).
  const { data: link } = await admin
    .from('org_signup_links')
    .select('org_id, is_active')
    .eq('code', code)
    .maybeSingle()

  if (!link || !link.is_active) {
    return <InvalidLink message="This signup link isn't active. Ask your gym for a current link." />
  }

  const { data: org } = await admin
    .from('organisations')
    .select('name, app_name, logo_url, brand_colour')
    .eq('id', link.org_id)
    .maybeSingle()

  if (!org) {
    return <InvalidLink message="This signup link isn't active. Ask your gym for a current link." />
  }

  const displayName = org.app_name ?? org.name

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 text-center space-y-6">
        {org.logo_url ? (
          <Image src={org.logo_url} alt={displayName} width={64} height={64} className="h-16 w-16 mx-auto object-contain rounded-xl" />
        ) : (
          <div
            className="h-16 w-16 mx-auto rounded-xl flex items-center justify-center text-white text-xl font-bold"
            style={{ backgroundColor: org.brand_colour ?? '#1D9E75' }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Join {displayName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create your account to get started — your programs and targets will be set up automatically.
          </p>
        </div>
        <Link
          href={`/signup?org_join=${code}`}
          className="block w-full py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-colors"
          style={{ backgroundColor: org.brand_colour ?? '#1D9E75' }}
        >
          Create your account
        </Link>
        <p className="text-sm text-gray-500">
          Already have an account?{' '}
          <Link href={`/login?org_join=${code}`} className="text-gray-900 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}

function InvalidLink({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 text-center space-y-4">
        <p className="text-gray-700 font-medium">{message}</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">Go to prokol.io</Link>
      </div>
    </div>
  )
}
