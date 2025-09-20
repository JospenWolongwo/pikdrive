"use client";

import { useState, useEffect } from "react";

interface PageLoaderProps {
  message?: string;
  showSpinner?: boolean;
}

export function PageLoader({ 
  message = "Chargement...", 
  showSpinner = true 
}: PageLoaderProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      {showSpinner && (
        <div className="relative">
          {/* Animated favicon-style spinner */}
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
          {/* Your favicon as overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img 
              src="/favicon.svg" 
              alt="PikDrive" 
              className="w-6 h-6 opacity-80 animate-pulse"
            />
          </div>
        </div>
      )}
      
      <div className="text-center">
        <p className="text-gray-600 font-medium">
          {message}{dots}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Veuillez patienter
        </p>
      </div>
    </div>
  );
}

export default PageLoader;
