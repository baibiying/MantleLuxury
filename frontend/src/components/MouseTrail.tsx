"use client";

import { useEffect, useState, useRef } from "react";

interface TrailPoint {
  x: number;
  y: number;
  opacity: number;
  size: number;
  timestamp: number;
}

export default function MouseTrail() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const rafRef = useRef<number>();
  const lastPositionRef = useRef({ x: 0, y: 0 });
  const trailRef = useRef<TrailPoint[]>([]);

  useEffect(() => {
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const updatePosition = () => {
      // 平滑插值，让追踪更流畅
      const prevX = currentX;
      const prevY = currentY;
      
      currentX += (targetX - currentX) * 0.2;
      currentY += (targetY - currentY) * 0.2;
      
      setMousePosition({ x: currentX, y: currentY });

      // 计算移动速度
      const dx = currentX - prevX;
      const dy = currentY - prevY;
      const speed = Math.sqrt(dx * dx + dy * dy);

      // 添加拖尾点
      if (speed > 0.5) {
        trailRef.current.push({
          x: currentX,
          y: currentY,
          opacity: 1,
          size: Math.min(8, speed * 0.5),
          timestamp: Date.now(),
        });

        // 限制拖尾长度
        if (trailRef.current.length > 15) {
          trailRef.current.shift();
        }

        // 更新拖尾透明度
        trailRef.current = trailRef.current.map((point) => ({
          ...point,
          opacity: Math.max(0, point.opacity - 0.08),
          size: Math.max(2, point.size * 0.95),
        })).filter((point) => point.opacity > 0.05);

        setTrail([...trailRef.current]);
      }

      rafRef.current = requestAnimationFrame(updatePosition);
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      setIsVisible(true);
      
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(updatePosition);
      }
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
      trailRef.current = [];
      setTrail([]);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* 拖尾光点 */}
      {trail.map((point, index) => (
        <div
          key={`${point.timestamp}-${index}`}
          className="fixed pointer-events-none z-[9999]"
          style={{
            left: `${point.x}px`,
            top: `${point.y}px`,
            transform: "translate(-50%, -50%)",
            opacity: point.opacity,
            transition: "opacity 0.1s linear",
          }}
        >
          <div
            className="rounded-full bg-cyan-400"
            style={{
              width: `${point.size}px`,
              height: `${point.size}px`,
              boxShadow: `0 0 ${point.size * 3}px rgba(0, 255, 255, ${point.opacity * 0.8}), 0 0 ${point.size * 6}px rgba(0, 255, 255, ${point.opacity * 0.5})`,
            }}
          ></div>
        </div>
      ))}

      {/* 主光点 - 核心光效 */}
      <div
        className="fixed pointer-events-none z-[9998] transition-opacity duration-200"
        style={{
          left: `${mousePosition.x}px`,
          top: `${mousePosition.y}px`,
          transform: "translate(-50%, -50%)",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.2s ease-out",
        }}
      >
        {/* 核心亮点 */}
        <div 
          className="w-4 h-4 rounded-full bg-cyan-400 absolute" 
          style={{ 
            boxShadow: '0 0 20px rgba(0, 255, 255, 1), 0 0 40px rgba(0, 255, 255, 0.9), 0 0 60px rgba(0, 255, 255, 0.7)',
            transform: 'translate(-50%, -50%)',
            animation: 'pulse-core 1.5s ease-in-out infinite',
          }}
        ></div>
        
        {/* 旋转光环 */}
        <div 
          className="absolute"
          style={{
            width: '24px',
            height: '24px',
            border: '2px solid rgba(0, 255, 255, 0.6)',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            animation: 'rotate-ring 2s linear infinite',
            boxShadow: '0 0 15px rgba(0, 255, 255, 0.5)',
          }}
        ></div>
        
        {/* 外圈光环 */}
        <div 
          className="absolute"
          style={{
            width: '32px',
            height: '32px',
            border: '1px solid rgba(0, 255, 255, 0.4)',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            animation: 'rotate-ring-reverse 3s linear infinite',
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)',
          }}
        ></div>
      </div>

      {/* 外圈光晕 */}
      <div
        className="fixed pointer-events-none z-[9997] transition-opacity duration-300"
        style={{
          left: `${mousePosition.x}px`,
          top: `${mousePosition.y}px`,
          transform: "translate(-50%, -50%)",
          opacity: isVisible ? 0.6 : 0,
          transition: "opacity 0.3s ease-out",
        }}
      >
        <div 
          className="w-32 h-32 rounded-full bg-cyan-500/40 blur-xl absolute"
          style={{ 
            boxShadow: '0 0 80px rgba(0, 255, 255, 0.5)',
            transform: 'translate(-50%, -50%)',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}
        ></div>
      </div>

      {/* 大范围光晕 */}
      <div
        className="fixed pointer-events-none z-[9996] transition-opacity duration-500"
        style={{
          left: `${mousePosition.x}px`,
          top: `${mousePosition.y}px`,
          transform: "translate(-50%, -50%)",
          opacity: isVisible ? 0.4 : 0,
          transition: "opacity 0.5s ease-out",
        }}
      >
        <div 
          className="w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl absolute"
          style={{ 
            boxShadow: '0 0 120px rgba(0, 255, 255, 0.4)',
            transform: 'translate(-50%, -50%)',
          }}
        ></div>
      </div>

      {/* 连接线效果 */}
      {trail.length > 1 && (
        <svg
          className="fixed pointer-events-none z-[9995]"
          style={{
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
            opacity: isVisible ? 0.3 : 0,
            transition: "opacity 0.3s ease-out",
          }}
        >
          {trail.slice(0, -1).map((point, index) => {
            const nextPoint = trail[index + 1];
            if (!nextPoint) return null;
            
            return (
              <line
                key={`line-${point.timestamp}-${index}`}
                x1={point.x}
                y1={point.y}
                x2={nextPoint.x}
                y2={nextPoint.y}
                stroke="rgba(0, 255, 255, 0.4)"
                strokeWidth="1"
                style={{
                  filter: 'drop-shadow(0 0 3px rgba(0, 255, 255, 0.6))',
                  opacity: Math.min(point.opacity, nextPoint.opacity),
                }}
              />
            );
          })}
        </svg>
      )}

      <style jsx>{`
        @keyframes pulse-core {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.8;
          }
        }
        
        @keyframes rotate-ring {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }
        
        @keyframes rotate-ring-reverse {
          from {
            transform: translate(-50%, -50%) rotate(360deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(0deg);
          }
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 0.8;
          }
        }
      `}</style>
    </>
  );
}

