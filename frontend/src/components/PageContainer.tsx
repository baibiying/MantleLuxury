"use client";

import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "5xl" | "7xl" | "full";
  className?: string;
}

export default function PageContainer({
  children,
  title,
  subtitle,
  maxWidth = "7xl",
  className = "",
}: PageContainerProps) {
  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "5xl": "max-w-5xl",
    "7xl": "max-w-7xl",
    full: "max-w-full",
  }[maxWidth];

  return (
    <main 
      className="min-h-screen text-slate-50 relative"
      style={{
        backgroundColor: '#020617', // 使用明确的颜色值，确保与整体背景一致
        minHeight: '100vh',
      }}
    >
      {/* 背景装饰 - 区块链风格光效 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl float-animation pulse-light" style={{ boxShadow: '0 0 100px rgba(0, 255, 255, 0.3)' }}></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/12 rounded-full blur-3xl float-animation pulse-light" style={{ animationDelay: '2s', boxShadow: '0 0 120px rgba(139, 92, 246, 0.3)' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-500/8 rounded-full blur-3xl glow-effect" style={{ boxShadow: '0 0 80px rgba(0, 255, 136, 0.2)' }}></div>
        {/* 额外的光效 - 区块链风格 */}
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-br from-cyan-500/8 via-transparent to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-purple-500/8 via-transparent to-transparent"></div>
        <div className="absolute top-1/2 right-1/4 w-48 h-48 bg-green-500/5 rounded-full blur-2xl"></div>
      </div>

      <div className={`relative z-10 ${maxWidthClass} mx-auto px-4 sm:px-6 py-8 sm:py-12 ${className}`}>
        {/* 页面标题区域 */}
        {(title || subtitle) && (
          <header className="mb-8 sm:mb-12 text-center sm:text-left">
            {title && (
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3">
                <span className="gradient-text">{title}</span>
              </h1>
            )}
            {subtitle && (
              <p className="text-sm sm:text-base text-slate-400 max-w-2xl">
                {subtitle}
              </p>
            )}
          </header>
        )}

        {/* 页面内容 */}
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </main>
  );
}

