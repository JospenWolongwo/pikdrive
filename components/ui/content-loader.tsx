"use client";

interface ContentLoaderProps {
  size?: "sm" | "md" | "lg";
  message?: string;
  className?: string;
}

export function ContentLoader({ 
  size = "md", 
  message,
  className = ""
}: ContentLoaderProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6", 
    lg: "w-8 h-8"
  };

  return (
    <div className={`flex items-center justify-center space-x-2 ${className}`}>
      <div className="relative">
        <div className={`${sizeClasses[size]} border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin`}></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <img 
            src="/favicon.svg" 
            alt="PikDrive" 
            className={`${size === "sm" ? "w-2 h-2" : size === "md" ? "w-3 h-3" : "w-4 h-4"} opacity-70`}
          />
        </div>
      </div>
      {message && (
        <span className="text-sm text-gray-600">{message}</span>
      )}
    </div>
  );
}

export default ContentLoader;
