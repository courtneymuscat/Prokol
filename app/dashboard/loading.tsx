export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="max-w-4xl mx-auto p-6 space-y-5 pt-20">
        <div className="h-7 w-48 bg-gray-200 rounded-xl" />
        <div className="h-24 bg-white rounded-2xl border border-gray-100" />
        <div className="h-32 bg-white rounded-2xl border border-gray-100" />
        <div className="h-40 bg-white rounded-2xl border border-gray-100" />
        <div className="h-28 bg-white rounded-2xl border border-gray-100" />
      </div>
    </div>
  )
}
