"use client";

import { useEffect, useState } from "react";

export default function DataStream() {
  const [streams, setStreams] = useState<Array<{ id: number; text: string; left: number; speed: number }>>([]);

  useEffect(() => {
    const chars = "01ABCDEF0123456789abcdef";
    const newStreams: Array<{ id: number; text: string; left: number; speed: number }> = [];

    for (let i = 0; i < 8; i++) {
      const length = Math.floor(Math.random() * 20) + 10;
      let text = "";
      for (let j = 0; j < length; j++) {
        text += chars[Math.floor(Math.random() * chars.length)];
      }
      newStreams.push({
        id: i,
        text,
        left: Math.random() * 100,
        speed: Math.random() * 2 + 1,
      });
    }

    setStreams(newStreams);
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-15">
      {streams.map((stream) => (
        <div
          key={stream.id}
          className="absolute font-mono text-xs text-cyan-300 whitespace-nowrap"
          style={{
            left: `${stream.left}%`,
            top: `${stream.id * 12}%`,
            animation: `streamDown ${20 / stream.speed}s linear infinite`,
            textShadow: "0 0 10px rgba(0, 255, 255, 0.8), 0 0 20px rgba(0, 255, 255, 0.5)",
          }}
        >
          {stream.text}
        </div>
      ))}
      <style jsx>{`
        @keyframes streamDown {
          0% {
            transform: translateY(-100vh);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

