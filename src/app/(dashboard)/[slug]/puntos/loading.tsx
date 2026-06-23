export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-32 bg-gray-200 rounded" />
      <div className="flex justify-end">
        <div className="h-9 w-36 bg-gray-200 rounded-md" />
      </div>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-44 bg-gray-200 rounded" />
            <div className="h-8 w-24 bg-gray-100 rounded-md" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="h-24 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
