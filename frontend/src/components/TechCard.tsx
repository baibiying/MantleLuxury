"use client";

import { ReactNode } from "react";

interface TechCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export default function TechCard({
  children,
  className = "",
  hover = true,
  glow = false,
}: TechCardProps) {
  return (
    <div
      className={`
        glass-effect rounded-2xl border border-cyan-500/20 
        relative overflow-hidden
        ${hover ? "card-hover neon-border code-border" : ""}
        ${glow ? "hologram-effect" : ""}
        ${className}
      `}
    >
      {/* 背景渐变 - 区块链风格 */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-purple-500/5 to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {/* 内容 */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

