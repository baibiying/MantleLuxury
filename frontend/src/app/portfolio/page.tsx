"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type Asset = {
  id: string;
  assetType: string;
  brand: string;
  model: string;
  year: number | null;
  pricePerShare: string;
  totalSupply: string;
  remainingSupply: string;
  status: string;
  tokenAddress: string | null;
  description: string | null;
};

type Holding = {
  assetId: string | null;
  assetType: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  tokenAddress: string;
  balance: string;        // 份数
  pricePerShare: string;  // 单份价格
  estimatedValue: string; // 当前市值
  totalCost: string;      // 成本
  pnl: string;            // 浮动收益
  roi: string;            // 收益率（小数，例如 0.12）
  totalYield: string;     // 累计收益
};

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalYield, setTotalYield] = useState<string>("0");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !address || !isConnected) {
      setLoading(false);
      setHoldings([]);
      return;
    }

    const loadHoldings = async () => {
      setLoading(true);
      setError(null);
      try {
        const [holdingsRes, yieldsRes] = await Promise.all([
          fetch(`${API_BASE}/api/portfolio/${address}`),
          fetch(`${API_BASE}/api/portfolio/${address}/yields`),
        ]);

        if (!holdingsRes.ok) {
          throw new Error(`加载持仓失败: ${holdingsRes.status}`);
        }
        const data = await holdingsRes.json();
        const parsed: Holding[] = data.map((item: any) => ({
          assetId: item.assetId,
          assetType: item.assetType,
          brand: item.brand,
          model: item.model,
          year: item.year,
          tokenAddress: item.tokenAddress,
          balance: item.balance?.toString() ?? "0",
          pricePerShare: item.pricePerShare?.toString() ?? "0",
          estimatedValue: item.estimatedValue?.toString() ?? "0",
          totalCost: item.totalCost?.toString() ?? "0",
          pnl: item.pnl?.toString() ?? "0",
          roi: item.roi?.toString() ?? "0",
          totalYield: item.totalYield?.toString() ?? "0",
        }));
        setHoldings(parsed);

        if (yieldsRes.ok) {
          const summary = await yieldsRes.json();
          setTotalYield(summary.totalYield || "0");
        }
      } catch (e: any) {
        setError(e.message ?? "加载持仓失败");
      } finally {
        setLoading(false);
      }
    };

    loadHoldings();
  }, [mounted, address, isConnected]);

  if (!mounted) {
    return null;
  }

  return (
    <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">我的持仓</h1>
            <p className="text-sm text-slate-400 mt-1">
              查看你在 MantleLuxury 平台上持有的资产份额
            </p>
          </div>
          <WalletConnect />
        </div>

        {!isConnected ? (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center">
            <p className="text-sm text-slate-300 mb-3">
              请先连接钱包以查看你的持仓。
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
                    {parseFloat(totalYield).toFixed(4)} MNT
                  </div>
                </div>
              </div>
              <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-6 py-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
                <div className="relative z-10">
                  <div className="text-xs text-slate-400 mb-2">持仓资产数</div>
                  <div className="text-2xl font-bold text-sky-400">
                    {holdings.length}
                  </div>
                </div>
              </div>
              <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-6 py-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5"></div>
                <div className="relative z-10">
                  <div className="text-xs text-slate-400 mb-2">总持仓成本</div>
                  <div className="text-2xl font-bold text-amber-400">
                    {holdings.reduce((sum, h) => sum + parseFloat(h.totalCost || "0"), 0).toFixed(4)} MNT
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center text-sm text-slate-300">
            正在加载持仓…
          </div>
        ) : error ? (
          <div className="glass-effect border border-red-500/60 rounded-2xl px-6 py-8 text-center text-sm text-red-200">
            {error}
          </div>
        ) : holdings.length === 0 ? (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center text-sm text-slate-300">
            当前钱包在平台上尚未持有任何资产份额。
          </div>
        ) : (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-4 py-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700/60">
                  <th className="py-3 text-left font-normal">资产</th>
                  <th className="py-3 text-right font-normal">持有份额</th>
                  <th className="py-3 text-right font-normal">单份价格 (MNT)</th>
                  <th className="py-3 text-right font-normal">持仓成本 (MNT)</th>
                  <th className="py-3 text-right font-normal">当前市值 (MNT)</th>
                  <th className="py-3 text-right font-normal">浮动收益 (MNT)</th>
                  <th className="py-3 text-right font-normal">累计收益 (MNT)</th>
                  <th className="py-3 text-right font-normal">收益率</th>
                  <th className="py-3 text-right font-normal">操作</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr
                    key={h.assetId ?? h.tokenAddress}
                    className="border-b border-slate-800/40 last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {h.brand} {h.model}
                        </span>
                        <span className="text-xs text-slate-500 mt-1">
                          {h.assetType === "watch" ? "名表" : "珠宝"} ·{" "}
                          {h.year ?? "年份未知"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right">{h.balance}</td>
                    <td className="py-3 text-right">{h.pricePerShare}</td>
                    <td className="py-3 text-right">{h.totalCost}</td>
                    <td className="py-3 text-right">{h.estimatedValue}</td>
                    <td className="py-3 text-right">{h.pnl}</td>
                    <td className="py-3 text-right text-emerald-400">
                      {parseFloat(h.totalYield || "0").toFixed(4)}
                    </td>
                    <td className="py-3 text-right">
                      {h.roi
                        ? `${(Number(h.roi) * 100).toFixed(2)}%`
                        : "-"}
                    </td>
                    <td className="py-3 text-right">
                      <a
                        href={`/assets/${h.assetId}`}
                        className="text-xs text-sky-400 hover:text-sky-300"
                      >
                        查看详情
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          </>
        )}
      </div>
    </main>
  );
}


