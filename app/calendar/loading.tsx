export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="max-w-4xl mx-auto p-4 space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-32 bg-gray-200 rounded-xl" />
          <div className="h-8 w-24 bg-gray-200 rounded-xl" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-xl border border-gray-100" />
          ))}
        </div>
      </div>
    </div>
  )
}
