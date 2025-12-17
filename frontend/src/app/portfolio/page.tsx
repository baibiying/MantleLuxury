"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

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
  
  // 计算资产分布数据
  const calculateDistribution = () => {
    if (holdings.length === 0) return { byType: [], byBrand: [] };
    
    // 按类别分布
    const typeMap = new Map<string, number>();
    // 按品牌分布
    const brandMap = new Map<string, number>();
    
    holdings.forEach((h) => {
      const value = parseFloat(h.estimatedValue || "0");
      
      // 按类别
      const type = h.assetType === "watch" ? "名表" : h.assetType === "jewelry" ? "珠宝" : "其他";
      typeMap.set(type, (typeMap.get(type) || 0) + value);
      
      // 按品牌
      if (h.brand) {
        brandMap.set(h.brand, (brandMap.get(h.brand) || 0) + value);
      }
    });
    
    const byType = Array.from(typeMap.entries()).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
    
    const byBrand = Array.from(brandMap.entries())
      .map(([name, value]) => ({
        name,
        value: parseFloat(value.toFixed(2)),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // 只显示前 10 个品牌
    
    return { byType, byBrand };
  };
  
  // CSV 导出功能
  const exportToCSV = async (type: "holdings" | "transactions" | "yields") => {
    if (!address) {
      alert("请先连接钱包");
      return;
    }
    
    try {
      const endpoint = type === "holdings" 
        ? `${API_BASE}/api/portfolio/${address}/export/holdings`
        : type === "transactions"
        ? `${API_BASE}/api/portfolio/${address}/export/transactions`
        : `${API_BASE}/api/portfolio/${address}/export/yields`;
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`导出失败: ${response.status}`);
      }
      
      const csvContent = await response.text();
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      
      const filename = type === "holdings"
        ? `持仓列表_${new Date().toISOString().split("T")[0]}.csv`
        : type === "transactions"
        ? `交易记录_${new Date().toISOString().split("T")[0]}.csv`
        : `收益记录_${new Date().toISOString().split("T")[0]}.csv`;
      
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`导出失败: ${error.message}`);
    }
  };

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
              <>
            {/* 资产分布图表 */}
            {(() => {
              const distribution = calculateDistribution();
              const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
              
              return (
                <div className="mb-6 grid gap-4 md:grid-cols-2">
                  {/* 按类别分布 */}
                  {distribution.byType.length > 0 && (
                    <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-6 py-5 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
                      <div className="relative z-10">
                        <h3 className="text-lg font-semibold mb-4">资产分布（按类别）</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                            <Pie
                              data={distribution.byType}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              label={({ name, percent }) => {
                                // 只显示百分比，完整名称在图例中显示
                                return `${(percent * 100).toFixed(0)}%`;
                              }}
                              outerRadius={85}
                              innerRadius={30}
                              fill="#8884d8"
                              dataKey="value"
                              labelLine={{ strokeWidth: 2 }}
                            >
                              {distribution.byType.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: number, name: string) => [`${value.toFixed(2)} MNT`, name]}
                            />
                            <Legend 
                              wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }}
                              iconType="circle"
                              formatter={(value) => value}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  
                  {/* 按品牌分布 */}
                  {distribution.byBrand.length > 0 && (
                    <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-6 py-5 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5"></div>
                      <div className="relative z-10">
                        <h3 className="text-lg font-semibold mb-4">资产分布（按品牌）</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                            <Pie
                              data={distribution.byBrand}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              label={({ name, percent }) => {
                                // 只显示百分比，完整名称在图例中显示
                                return `${(percent * 100).toFixed(0)}%`;
                              }}
                              outerRadius={85}
                              innerRadius={30}
                              fill="#8884d8"
                              dataKey="value"
                              labelLine={{ strokeWidth: 2 }}
                            >
                              {distribution.byBrand.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: number, name: string) => [`${value.toFixed(2)} MNT`, name]}
                            />
                            <Legend 
                              wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }}
                              iconType="circle"
                              formatter={(value) => value}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            
            {/* 导出按钮 */}
            <div className="mb-4 flex gap-3 flex-wrap">
              <button
                onClick={() => exportToCSV("holdings")}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg text-white text-sm font-medium transition-colors"
              >
                📥 导出持仓列表 (CSV)
              </button>
              <button
                onClick={() => exportToCSV("transactions")}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white text-sm font-medium transition-colors"
              >
                📥 导出交易记录 (CSV)
              </button>
              <button
                onClick={() => exportToCSV("yields")}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-white text-sm font-medium transition-colors"
              >
                📥 导出收益记录 (CSV)
              </button>
            </div>
            
            {/* 持仓列表 */}
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
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}


