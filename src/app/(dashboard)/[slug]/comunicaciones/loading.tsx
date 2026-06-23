export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-40 bg-gray-200 rounded" />
      <div className="flex justify-end">
        <div className="h-9 w-40 bg-gray-200 rounded-md" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
          <div className="flex justify-between">
            <div className="h-4 w-64 bg-gray-200 rounded" />
            <div className="h-5 w-16 bg-gray-100 rounded-full" />
          </div>
          <div className="h-3 w-40 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  )
}
