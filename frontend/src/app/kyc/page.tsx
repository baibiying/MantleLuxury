"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type KycStatus = "none" | "pending" | "approved" | "rejected";

export default function KycPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<KycStatus>("none");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!address) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/kyc/${address}`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus((data.status as KycStatus) ?? "none");
      } catch {
        // ignore
      }
    };
    load();
  }, [address]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/kyc/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: address,
          email,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "提交失败");
      }
      const data = await res.json();
      setStatus((data.status as KycStatus) ?? "pending");
    } catch (e: any) {
      setError(e.message ?? "提交失败");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6">
      <div className="max-w-xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">KYC / AML 审核</h1>
            <p className="text-sm text-slate-400 mt-1">
              完成 KYC / AML 后即可在 MantleLuxury 平台投资资产。
            </p>
          </div>
          <WalletConnect />
        </div>

        {!isConnected || !address ? (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center">
            <p className="text-sm text-slate-300 mb-3">
              请先连接钱包，再进行 KYC。
            </p>
            <WalletConnect />
          </div>
        ) : (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-6 space-y-4">
            <div className="text-sm text-slate-300">
              当前钱包：{" "}
              <span className="font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            </div>

            <div className="text-sm">
              <span className="text-slate-400 mr-2">当前状态：</span>
              <span
                className={`px-2 py-1 rounded-full text-xs ${
                  status === "approved"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                    : status === "pending"
                    ? "bg-amber-500/20 text-amber-200 border border-amber-400/40"
                    : status === "rejected"
                    ? "bg-red-500/20 text-red-200 border border-red-400/40"
                    : "bg-slate-700/40 text-slate-200 border border-slate-500/40"
                }`}
              >
                {status === "approved"
                  ? "已通过"
                  : status === "pending"
                  ? "审核中"
                  : status === "rejected"
                  ? "已驳回"
                  : "未提交"}
              </span>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <p>审核流程（当前为 Demo）：</p>
              <p>1) 提交钱包地址与邮箱，进入审核中。</p>
              <p>2) 平台风控（含黑名单、限额）检查通过后标记“已通过”。</p>
              <p>3) 审核通过后可投资资产、提交新资产；未通过/驳回则无法操作。</p>
              <p className="text-[11px] text-slate-500">
                * Demo 环节：可用接口 <span className="font-mono">/api/kyc/approve/&#123;walletAddress&#125;</span> 手动置为通过。
              </p>
            </div>

            {status === "approved" ? (
              <p className="text-xs text-emerald-300">
                你的 KYC 已通过，可以返回资产页面继续投资。
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    邮箱（用于通知）
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <div className="text-xs text-red-300">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={loading || status === "pending"}
                  className="w-full px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-sm font-semibold"
                >
                  {status === "pending"
                    ? "审核中..."
                    : loading
                    ? "提交中..."
                    : "提交 KYC 信息"}
                </button>

                <p className="text-[11px] text-slate-500">
                  * 当前为 Demo 环节，提交后默认进入“审核中”，可由后台接口
                  <span className="font-mono"> /api/kyc/approve/&#123;walletAddress&#125; </span>
                  手动通过。
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}


