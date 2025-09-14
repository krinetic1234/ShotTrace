import React from "react";
import VideoBox from "./VideoBox";

export default function DualVideoCompare({ originalSrc, latestSrc }: { originalSrc?: string; latestSrc?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <VideoBox 
        src={originalSrc} 
        label="Original" 
        fallback="No original"
      />
      <VideoBox 
        src={latestSrc} 
        label="Latest Chunk" 
        fallback="Processing..."
      />
    </div>
  );
}
