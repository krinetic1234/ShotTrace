"use client";

import React, { useEffect, useCallback } from "react";

export type TimelineItem = { index: number; relPath?: string };

export default function ChunkTimeline({ 
  items, 
  activeIndex, 
  onChange 
}: { 
  items: TimelineItem[]; 
  activeIndex: number; 
  onChange: (idx: number) => void;
}) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target !== document.activeElement) return; // Only if timeline is focused
    if (e.key === "ArrowLeft" && activeIndex > 0) {
      e.preventDefault();
      onChange(activeIndex - 1);
    } else if (e.key === "ArrowRight" && activeIndex < items.length - 1) {
      e.preventDefault();
      onChange(activeIndex + 1);
    }
  }, [activeIndex, items.length, onChange]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (items.length === 0) {
    return (
      <div className="glass rounded-lg p-4 border border-white/10 text-center text-gray-400 text-sm">
        Awaiting chunks...
      </div>
    );
  }

  return (
    <div className="glass rounded-lg p-4 border border-white/10">
      <div className="text-xs text-gray-400 mb-3 font-medium">
        Chunk Timeline ({items.length} chunks)
      </div>
      <div 
        className="grid grid-cols-10 gap-2" 
        role="tablist" 
        aria-label="Chunk timeline"
        tabIndex={0}
      >
        {items.slice(-20).map((item, i) => {
          const isActive = item.index === activeIndex;
          return (
            <button
              key={item.index}
              role="tab"
              aria-selected={isActive}
              aria-label={`Chunk ${item.index}`}
              onClick={() => onChange(item.index)}
              className={`
                aspect-square rounded text-xs font-mono transition-all
                ${isActive 
                  ? 'bg-sky-500 text-white ring-2 ring-sky-300' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }
              `}
            >
              {item.index}
            </button>
          );
        })}
      </div>
      <div className="text-xs text-gray-500 mt-2">
        Use ← → arrow keys to navigate
      </div>
    </div>
  );
}
