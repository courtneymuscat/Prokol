export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="max-w-2xl mx-auto p-4 space-y-4 pt-6">
        <div className="h-7 w-36 bg-gray-200 rounded-xl" />
        <div className="h-40 bg-white rounded-2xl border border-gray-100" />
        <div className="h-40 bg-white rounded-2xl border border-gray-100" />
      </div>
    </div>
  )
}
