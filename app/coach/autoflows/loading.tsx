export default function Loading() {
  return (
    <div className="flex-1 flex flex-col animate-pulse">
      <div className="bg-white border-b px-6 py-4">
        <div className="h-6 w-32 bg-gray-100 rounded-lg" />
      </div>
      <div className="p-6 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border h-20" />
        ))}
      </div>
    </div>
  )
}
