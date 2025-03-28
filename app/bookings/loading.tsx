export function LoadingBookings() {
  return (
    <div className="animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="mb-4 p-4 border rounded-lg">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      ))}
    </div>
  );
}

export default LoadingBookings;
