export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="max-w-2xl mx-auto p-4 space-y-4 pt-6">
        <div className="h-7 w-40 bg-gray-200 rounded-xl" />
        <div className="h-28 bg-white rounded-2xl border border-gray-100" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-10 bg-white rounded-lg border border-gray-100" />
          ))}
        </div>
        <div className="h-40 bg-white rounded-2xl border border-gray-100" />
      </div>
    </div>
  )
}
