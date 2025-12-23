"use client";

import { useEffect, useState, useRef } from "react";

export default function MouseTrail() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const rafRef = useRef<number>();

  useEffect(() => {
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const updatePosition = () => {
      // 平滑插值，让追踪更流畅
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;
      
      setMousePosition({ x: currentX, y: currentY });
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
        <div 
          className="w-3 h-3 rounded-full bg-cyan-400" 
          style={{ 
            boxShadow: '0 0 15px rgba(0, 255, 255, 1), 0 0 30px rgba(0, 255, 255, 0.8), 0 0 45px rgba(0, 255, 255, 0.6)',
            filter: 'blur(0.5px)',
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
          opacity: isVisible ? 0.5 : 0,
          transition: "opacity 0.3s ease-out",
        }}
      >
        <div 
          className="w-24 h-24 rounded-full bg-cyan-500/30 blur-xl"
          style={{ boxShadow: '0 0 60px rgba(0, 255, 255, 0.4)' }}
        ></div>
      </div>

      {/* 大范围光晕 */}
      <div
        className="fixed pointer-events-none z-[9996] transition-opacity duration-500"
        style={{
          left: `${mousePosition.x}px`,
          top: `${mousePosition.y}px`,
          transform: "translate(-50%, -50%)",
          opacity: isVisible ? 0.3 : 0,
          transition: "opacity 0.5s ease-out",
        }}
      >
        <div 
          className="w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl"
          style={{ boxShadow: '0 0 100px rgba(0, 255, 255, 0.3)' }}
        ></div>
      </div>
    </>
  );
}

