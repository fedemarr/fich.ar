export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-40 bg-gray-200 rounded" />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="h-5 w-32 bg-gray-100 rounded" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-0">
            <div className="w-9 h-9 rounded-full bg-gray-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 bg-gray-100 rounded" />
              <div className="h-3 w-56 bg-gray-100 rounded" />
            </div>
            <div className="h-5 w-16 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
