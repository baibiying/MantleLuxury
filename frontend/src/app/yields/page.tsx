"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type YieldDistribution = {
  id: string;
  distributionIdBytes32: string;
  assetId: string;
  tokenAddress: string;
  yieldType: string;
  totalAmount: string;
  distributedAmount: string;
  isCompleted: boolean;
  transactionHash: string | null;
  createdAt: string;
  completedAt: string | null;
};

export default function YieldsPage() {
  const { address, isConnected } = useAccount();
  const [yields, setYields] = useState<YieldDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalYield, setTotalYield] = useState<string>("0");

  useEffect(() => {
    const loadYields = async () => {
      if (!address) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [yieldsRes, summaryRes] = await Promise.all([
          fetch(`${API_BASE}/api/yields/user/${address}`),
          fetch(`${API_BASE}/api/portfolio/${address}/yields`),
        ]);

        if (yieldsRes.ok) {
          const data = await yieldsRes.json();
          setYields(data);
        }

        if (summaryRes.ok) {
          const summary = await summaryRes.json();
          // 如果后端返回的累计收益为0，但前端有收益记录，则从前端计算
          if (summary.totalYield === 0 && yields.length > 0) {
            const calculatedTotal = yields.reduce((sum, y) => {
              const amount = y.isCompleted ? parseFloat(y.distributedAmount || "0") : parseFloat(y.totalAmount || "0");
              return sum + amount;
            }, 0);
            setTotalYield(calculatedTotal.toString());
          } else {
            setTotalYield(summary.totalYield || "0");
          }
        } else if (yields.length > 0) {
          // 如果后端 API 失败，但前端有收益记录，则从前端计算
          const calculatedTotal = yields.reduce((sum, y) => {
            const amount = y.isCompleted ? parseFloat(y.distributedAmount || "0") : parseFloat(y.totalAmount || "0");
            return sum + amount;
          }, 0);
          setTotalYield(calculatedTotal.toString());
        }
      } catch (err: any) {
        setError(err.message || "加载失败");
      } finally {
        setLoading(false);
      }
    };
    loadYields();
  }, [address]);

  const formatAmount = (amount: string) => {
    try {
      const num = parseFloat(amount);
      return num.toFixed(4);
    } catch {
      return "0.0000";
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleString("zh-CN");
    } catch {
      return dateStr;
    }
  };

  return (
    <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6 relative">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
              <span className="gradient-text">收益记录</span>
            </h1>
            <p className="text-sm text-slate-300">
              查看您的资产升值收益分配记录
            </p>
          </div>
          <WalletConnect />
        </header>

        {!isConnected || !address ? (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center">
            <p className="text-sm text-slate-300 mb-3">
              请先连接钱包，查看收益记录。
            </p>
            <WalletConnect />
          </div>
        ) : (
          <>
            {/* 总收益统计 */}
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-6 py-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5"></div>
                <div className="relative z-10">
                  <div className="text-xs text-slate-400 mb-2">累计收益</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {formatAmount(totalYield)} MNT
                  </div>
                </div>
              </div>
              <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-6 py-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
                <div className="relative z-10">
                  <div className="text-xs text-slate-400 mb-2">收益记录数</div>
                  <div className="text-2xl font-bold text-sky-400">
                    {yields.length}
                  </div>
                </div>
              </div>
              <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-6 py-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5"></div>
                <div className="relative z-10">
                  <div className="text-xs text-slate-400 mb-2">已完成分配</div>
                  <div className="text-2xl font-bold text-amber-400">
                    {yields.filter((y) => y.isCompleted).length}
                  </div>
                </div>
              </div>
            </div>

            {/* 收益记录列表 */}
            {loading ? (
              <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center">
                <p className="text-slate-300">加载中...</p>
              </div>
            ) : error ? (
              <div className="glass-effect border border-red-500/40 rounded-2xl px-6 py-8 text-center">
                <p className="text-red-300">{error}</p>
              </div>
            ) : yields.length === 0 ? (
              <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center">
                <p className="text-slate-300 mb-4">暂无收益记录</p>
                <Link
                  href="/assets"
                  className="text-sky-400 hover:text-sky-300 underline"
                >
                  去投资资产 →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {yields.map((yieldItem) => (
                  <div
                    key={yieldItem.id}
                    className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-6 py-5 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                yieldItem.isCompleted
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                              }`}
                            >
                              {yieldItem.isCompleted ? "已完成" : "进行中"}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs bg-slate-700/40 text-slate-300 border border-slate-600/40">
                              {yieldItem.yieldType === "appreciation"
                                ? "升值收益"
                                : "租赁收益"}
                            </span>
                          </div>
                          <div className="text-sm text-slate-400">
                            分配 ID: {yieldItem.distributionIdBytes32.slice(0, 10)}...
                            {yieldItem.distributionIdBytes32.slice(-8)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400 mb-1">
                            总收益金额
                          </div>
                          <div className="text-xl font-bold text-emerald-400">
                            {formatAmount(yieldItem.totalAmount)} MNT
                          </div>
                          {yieldItem.isCompleted && (
                            <div className="text-xs text-slate-500 mt-1">
                              已分配: {formatAmount(yieldItem.distributedAmount)} MNT
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-slate-500 text-xs mb-1">
                            资产 ID
                          </div>
                          <div className="text-slate-300 font-mono text-xs">
                            {yieldItem.assetId.slice(0, 8)}...
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">
                            合约地址
                          </div>
                          <div className="text-slate-300 font-mono text-xs">
                            {yieldItem.tokenAddress.slice(0, 6)}...
                            {yieldItem.tokenAddress.slice(-4)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">创建时间</div>
                          <div className="text-slate-300 text-xs">
                            {formatDate(yieldItem.createdAt)}
                          </div>
                        </div>
                        {yieldItem.completedAt && (
                          <div>
                            <div className="text-slate-500 text-xs mb-1">
                              完成时间
                            </div>
                            <div className="text-slate-300 text-xs">
                              {formatDate(yieldItem.completedAt)}
                            </div>
                          </div>
                        )}
                      </div>

                      {yieldItem.transactionHash && (
                        <div className="mt-4 pt-4 border-t border-slate-800">
                          <a
                            href={`https://explorer.sepolia.mantle.xyz/tx/${yieldItem.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-sky-400 hover:text-sky-300"
                          >
                            查看交易: {yieldItem.transactionHash.slice(0, 10)}...
                            {yieldItem.transactionHash.slice(-8)} →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

