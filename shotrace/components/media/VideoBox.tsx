import React from "react";

export default function VideoBox({ src, label, className = "", fallback }: { src?: string; label?: string; className?: string; fallback?: React.ReactNode }) {
  return (
    <div className={`aspect-video bg-black/40 rounded-lg overflow-hidden ${className}`}>
      {label && <div className="text-xs text-gray-400 mb-1 font-medium">{label}</div>}
      {src ? (
        <video 
          src={src} 
          className="w-full h-full object-contain" 
          controls 
          muted 
          preload="metadata"
          aria-label={label ? `Video: ${label}` : "Video player"}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
          {fallback || "No video"}
        </div>
      )}
    </div>
  );
}
