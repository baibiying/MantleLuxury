"use client";

import { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import Link from "next/link";

interface TechButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export default function TechButton({
  children,
  href,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  type = "button",
}: TechButtonProps) {
  const baseClasses = "tech-button relative font-semibold transition-all duration-300 neon-border";
  
  const variantClasses = {
    primary: "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70",
    secondary: "glass-effect text-slate-200 hover:bg-slate-800/80 border-slate-700/50 hover:border-slate-600/50",
    outline: "border-2 border-sky-500/50 text-sky-400 hover:border-sky-400 hover:text-sky-300 hover:bg-sky-500/10",
  }[variant];

  const sizeClasses = {
    sm: "px-4 py-2 text-sm rounded-lg",
    md: "px-6 py-3 text-base rounded-xl",
    lg: "px-10 py-4 text-lg rounded-full",
  }[size];

  const classes = `${baseClasses} ${variantClasses} ${sizeClasses} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        <span className="relative z-10">{children}</span>
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}

