"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export default function AdminNavigation() {
  const { address, isConnected } = useAccount();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isConnected && address) {
      checkAdminStatus();
    } else if (mounted && !isConnected) {
      setIsAdmin(false);
    }
  }, [mounted, isConnected, address]);

  const checkAdminStatus = async () => {
    if (!address) {
      setIsAdmin(false);
      return;
    }
    try {
      const cleanAddress = address?.split(':')[0] || address;
      const res = await fetch(`${API_BASE}/api/admin/kyc/stats`, {
        headers: {
          "X-Wallet-Address": cleanAddress,
        },
      });
      setIsAdmin(res.ok);
    } catch (e) {
      setIsAdmin(false);
    }
  };

  if (!mounted || !isAdmin) {
    return null;
  }

  return (
    <>
      <Link
        href="/admin/kyc"
        className="relative overflow-hidden rounded-full border border-cyan-500/30 px-4 py-2 text-cyan-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400 hover:text-cyan-100 hover:shadow-[0_0_15px_rgba(0,255,255,0.5)] whitespace-nowrap flex-shrink-0"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 via-cyan-500/20 to-cyan-400/20 opacity-0 transition-opacity duration-300 hover:opacity-100" />
        <span className="relative z-10">KYC / AML 管理</span>
      </Link>
      <Link
        href="/admin/assets"
        className="relative overflow-hidden rounded-full border border-cyan-500/30 px-4 py-2 text-cyan-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400 hover:text-cyan-100 hover:shadow-[0_0_15px_rgba(0,255,255,0.5)] whitespace-nowrap flex-shrink-0"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 via-cyan-500/20 to-cyan-400/20 opacity-0 transition-opacity duration-300 hover:opacity-100" />
        <span className="relative z-10">资产审核</span>
      </Link>
      <Link
        href="/admin/yields"
        className="relative overflow-hidden rounded-full border border-cyan-500/30 px-4 py-2 text-cyan-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400 hover:text-cyan-100 hover:shadow-[0_0_15px_rgba(0,255,255,0.5)] whitespace-nowrap flex-shrink-0"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 via-cyan-500/20 to-cyan-400/20 opacity-0 transition-opacity duration-300 hover:opacity-100" />
        <span className="relative z-10">收益分配控制台</span>
      </Link>
    </>
  );
}






