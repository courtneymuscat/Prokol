export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="max-w-5xl mx-auto p-6 space-y-5 pt-6">
        <div className="h-8 w-48 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-2xl border border-gray-100" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-2xl border border-gray-100" />
        <div className="h-48 bg-white rounded-2xl border border-gray-100" />
      </div>
    </div>
  )
}
