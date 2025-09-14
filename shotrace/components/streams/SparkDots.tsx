import React from "react";

export default function SparkDots({ count, activeIndex = -1, maxDots = 60 }: { count: number; activeIndex?: number; maxDots?: number }) {
  const displayCount = Math.min(count, maxDots);
  const startOffset = count > maxDots ? count - maxDots : 0;
  
  return (
    <div className="timeline" aria-label={`Timeline with ${count} items, ${activeIndex >= 0 ? `item ${activeIndex + 1} active` : 'no active item'}`}>
      {Array.from({ length: displayCount }).map((_, i) => {
        const actualIndex = startOffset + i;
        const isActive = actualIndex === activeIndex;
        return (
          <span 
            key={actualIndex} 
            className={`timeline-dot ${isActive ? 'active' : ''}`}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}
