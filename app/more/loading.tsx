export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="max-w-2xl mx-auto p-4 space-y-4 pt-6">
        <div className="h-7 w-24 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-2xl border border-gray-100" />
          ))}
        </div>
      </div>
    </div>
  )
}
