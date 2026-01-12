"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useChainId } from "wagmi";
import { formatEther } from "viem";
import { mantleSepoliaTestnet } from "@/lib/web3/config";
import { luxuryTokenAbi } from "@/lib/web3/contracts";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import Link from "next/link";
import PageContainer from "@/components/PageContainer";
import TechCard from "@/components/TechCard";
import TechButton from "@/components/TechButton";

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

type YieldDistribution = {
  id: string;
  distributionIdBytes32: string;
  assetId: string;
  tokenAddress: string;
  yieldType: string;
  totalAmount: string;
  distributedAmount: string;
  userShare?: string; // 用户实际应得的收益
  isCompleted: boolean;
  transactionHash: string | null;
  createdAt: string;
  completedAt: string | null;
};

type AssetInfo = {
  id: string;
  brand: string;
  model: string;
  assetType: string;
  year: number | null;
};

type TokenInfo = {
  name: string;
  symbol: string;
};

type AssetYieldGroup = {
  assetId: string;
  assetInfo: AssetInfo | null;
  yields: YieldDistribution[];
  userTotal: number;
  allTotal: number;
  tokenSymbol?: string;
  isSubmittedByUser?: boolean; // 是否由当前用户提交
};

type SubmittedAsset = {
  assetId: string;
  assetType: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  tokenAddress: string | null;
  status: string;
  pricePerShare: string | null;
  totalSupply: string | null;
  revenue: string; // 从该资产获得的收益
  createdAt: string;
};

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"holdings" | "yields">("holdings");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalYield, setTotalYield] = useState<string>("0");
  const [yieldHistory, setYieldHistory] = useState<Array<{ date: string; cumulativeYield: number }>>([]);
  const [tokenInfos, setTokenInfos] = useState<Record<string, { name: string; symbol: string }>>({});
  
  // 收益记录相关状态
  const [yields, setYields] = useState<YieldDistribution[]>([]);
  const [assetGroups, setAssetGroups] = useState<AssetYieldGroup[]>([]);
  const [yieldsLoading, setYieldsLoading] = useState(true);
  const [yieldsError, setYieldsError] = useState<string | null>(null);
  const [totalUserYield, setTotalUserYield] = useState<string>("0");
  const [totalAllYield, setTotalAllYield] = useState<string>("0");
  
  // 提交者资产收益相关状态
  const [submittedAssets, setSubmittedAssets] = useState<SubmittedAsset[]>([]);
  const [submittedAssetsLoading, setSubmittedAssetsLoading] = useState(false);
  const [submittedAssetsError, setSubmittedAssetsError] = useState<string | null>(null);
  
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
        const [holdingsRes, yieldsRes, historyRes] = await Promise.all([
          fetch(`${API_BASE}/api/portfolio/${address}`),
          fetch(`${API_BASE}/api/portfolio/${address}/yields`),
          fetch(`${API_BASE}/api/portfolio/${address}/yields/history`),
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

        // 加载收益历史数据
        if (historyRes.ok) {
          const history = await historyRes.json();
          const formattedHistory = history.map((item: any) => ({
            date: new Date(item.date).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }),
            cumulativeYield: parseFloat(item.cumulativeYield || "0"),
            amount: parseFloat(item.amount || "0"),
          }));
          setYieldHistory(formattedHistory);
        }
      } catch (e: any) {
        setError(e.message ?? "加载持仓失败");
      } finally {
        setLoading(false);
      }
    };

    loadHoldings();
  }, [mounted, address, isConnected]);

  // 从链上读取代币名称和符号
  useEffect(() => {
    const loadTokenInfos = async () => {
      if (!publicClient || chainId !== mantleSepoliaTestnet.id || holdings.length === 0) return;
      
      const uniqueTokenAddresses = Array.from(new Set(holdings.map(h => h.tokenAddress).filter(Boolean)));
      if (uniqueTokenAddresses.length === 0) return;

      const tokenInfoEntries = await Promise.all(
        uniqueTokenAddresses.map(async (tokenAddress) => {
          try {
            const [name, symbol] = await Promise.all([
              publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: luxuryTokenAbi,
                functionName: "name",
              }) as Promise<string>,
              publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: luxuryTokenAbi,
                functionName: "symbol",
              }) as Promise<string>,
            ]);
            return [tokenAddress, { name, symbol }] as const;
          } catch (e) {
            return null;
          }
        })
      );

      const nextTokenInfos: Record<string, { name: string; symbol: string }> = {};
      for (const e of tokenInfoEntries) {
        if (e) {
          nextTokenInfos[e[0]] = e[1];
        }
      }
      setTokenInfos(nextTokenInfos);
    };

    loadTokenInfos();
  }, [holdings, publicClient, chainId]);

  // 加载收益记录
  useEffect(() => {
    const loadYields = async () => {
      if (!address) {
        setYieldsLoading(false);
        return;
      }
      setYieldsLoading(true);
      setYieldsError(null);
      try {
        // 获取用户投资的资产的收益记录
        const [yieldsRes, summaryRes, submittedAssetsRes] = await Promise.all([
          fetch(`${API_BASE}/api/yields/user/${address}`),
          fetch(`${API_BASE}/api/portfolio/${address}/yields`),
          fetch(`${API_BASE}/api/portfolio/${address}/submitted-assets`),
        ]);

        let yieldsData: YieldDistribution[] = [];
        if (yieldsRes.ok) {
          yieldsData = await yieldsRes.json();
        }

        // 获取用户提交的资产的收益记录
        let submittedAssetsData: SubmittedAsset[] = [];
        if (submittedAssetsRes.ok) {
          submittedAssetsData = await submittedAssetsRes.json();
        }

        // 对于用户提交的资产，获取每个资产的收益记录
        if (submittedAssetsData.length > 0) {
          const submittedYieldsPromises = submittedAssetsData.map(async (asset) => {
            try {
              const res = await fetch(`${API_BASE}/api/yields/asset/${asset.assetId}`);
              if (res.ok) {
                const assetYields = await res.json();
                return assetYields;
              }
            } catch (err) {
              console.warn(`Failed to fetch yields for submitted asset ${asset.assetId}:`, err);
            }
            return [];
          });

          const submittedYieldsArrays = await Promise.all(submittedYieldsPromises);
          const submittedYields = submittedYieldsArrays.flat();

          // 合并收益记录，避免重复（使用id作为唯一标识）
          const existingYieldIds = new Set(yieldsData.map(y => y.id));
          const newYields = submittedYields.filter((y: YieldDistribution) => !existingYieldIds.has(y.id));
          yieldsData = [...yieldsData, ...newYields];
        }

        // 获取用户提交的资产ID列表（用于标记哪些资产是用户提交的）
        const submittedAssetIds = new Set(submittedAssetsData.map((a: any) => a.assetId));

        setYields(yieldsData);

        // 按 assetId 分组收益记录
        const groupedByAsset = yieldsData.reduce((acc: Record<string, YieldDistribution[]>, yieldItem: YieldDistribution) => {
          const assetId = yieldItem.assetId;
          if (!acc[assetId]) {
            acc[assetId] = [];
          }
          acc[assetId].push(yieldItem);
          return acc;
        }, {} as Record<string, YieldDistribution[]>);

        // 获取所有唯一的 assetId
        const uniqueAssetIds = Object.keys(groupedByAsset);

        // 获取每个资产的详细信息
        const assetInfoPromises = uniqueAssetIds.map(async (assetId) => {
          try {
            const res = await fetch(`${API_BASE}/api/assets/${assetId}`);
            if (res.ok) {
              const asset = await res.json();
              return {
                id: asset.id,
                brand: asset.brand,
                model: asset.model,
                assetType: asset.assetType,
                year: asset.year,
              } as AssetInfo;
            }
          } catch (err) {
            console.warn(`Failed to fetch asset info for ${assetId}:`, err);
          }
          return null;
        });

        const assetInfos = await Promise.all(assetInfoPromises);

        // 获取所有唯一的 tokenAddress
        const uniqueTokenAddresses = Array.from(
          new Set(yieldsData.map((y) => y.tokenAddress).filter(Boolean))
        ) as string[];

        // 如果已连接钱包且网络正确，尝试获取代币符号
        let tokenSymbolsMap: Record<string, string> = {};
        if (publicClient && chainId === mantleSepoliaTestnet.id && uniqueTokenAddresses.length > 0) {
          try {
            const tokenSymbolPromises = uniqueTokenAddresses.map(async (tokenAddress) => {
              try {
                const symbol = (await publicClient.readContract({
                  address: tokenAddress as `0x${string}`,
                  abi: luxuryTokenAbi,
                  functionName: "symbol",
                })) as string;
                return [tokenAddress, symbol] as const;
              } catch (err) {
                console.warn(`Failed to fetch token symbol for ${tokenAddress}:`, err);
                return null;
              }
            });

            const tokenSymbolEntries = await Promise.all(tokenSymbolPromises);
            for (const entry of tokenSymbolEntries) {
              if (entry) {
                tokenSymbolsMap[entry[0]] = entry[1];
              }
            }
          } catch (err) {
            console.warn("Failed to load token symbols:", err);
          }
        }

        // 创建资产分组数据
        const groups: AssetYieldGroup[] = uniqueAssetIds.map((assetId, index) => {
          const assetYields = groupedByAsset[assetId];
          const { userTotal, allTotal } = assetYields.reduce(
            (acc: { userTotal: number; allTotal: number }, y: YieldDistribution) => {
              const userAmount = y.userShare !== undefined 
                ? parseFloat(y.userShare || "0")
                : parseFloat(y.totalAmount || "0");
              const allAmount = parseFloat(y.totalAmount || "0");
              return {
                userTotal: acc.userTotal + userAmount,
                allTotal: acc.allTotal + allAmount,
              };
            },
            { userTotal: 0, allTotal: 0 }
          );

          // 获取该资产分组的 tokenAddress（使用第一个收益记录的 tokenAddress）
          const tokenAddress = assetYields[0]?.tokenAddress;
          const tokenSymbol = tokenAddress ? tokenSymbolsMap[tokenAddress] : undefined;

          return {
            assetId,
            assetInfo: assetInfos[index],
            yields: assetYields,
            userTotal,
            allTotal,
            tokenSymbol,
            isSubmittedByUser: submittedAssetIds.has(assetId),
          };
        });

        setAssetGroups(groups);

        // 计算我的收益总和和总收益总和
        const { userTotal, allTotal } = yieldsData.reduce(
          (acc, y) => {
            const userAmount = y.userShare !== undefined 
              ? parseFloat(y.userShare || "0")
              : parseFloat(y.totalAmount || "0");
            const allAmount = parseFloat(y.totalAmount || "0");
            return {
              userTotal: acc.userTotal + userAmount,
              allTotal: acc.allTotal + allAmount,
            };
          },
          { userTotal: 0, allTotal: 0 }
        );
        
        setTotalUserYield(userTotal.toString());
        setTotalAllYield(allTotal.toString());
      } catch (err: any) {
        setYieldsError(err.message || "加载失败");
      } finally {
        setYieldsLoading(false);
      }
    };
    loadYields();
  }, [address, publicClient, chainId]);

  // 加载提交者的资产收益
  useEffect(() => {
    const loadSubmittedAssets = async () => {
      if (!address) {
        setSubmittedAssetsLoading(false);
        return;
      }
      setSubmittedAssetsLoading(true);
      setSubmittedAssetsError(null);
      try {
        const res = await fetch(`${API_BASE}/api/portfolio/${address}/submitted-assets`);
        if (res.ok) {
          const data = await res.json();
          const parsed: SubmittedAsset[] = data.map((item: any) => ({
            assetId: item.assetId,
            assetType: item.assetType,
            brand: item.brand,
            model: item.model,
            year: item.year,
            tokenAddress: item.tokenAddress,
            status: item.status,
            pricePerShare: item.pricePerShare?.toString() ?? null,
            totalSupply: item.totalSupply?.toString() ?? null,
            revenue: item.revenue?.toString() ?? "0",
            createdAt: item.createdAt,
          }));
          setSubmittedAssets(parsed);
        }
      } catch (err: any) {
        setSubmittedAssetsError(err.message || "加载失败");
      } finally {
        setSubmittedAssetsLoading(false);
      }
    };
    loadSubmittedAssets();
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

  // 获取资产的持仓信息
  const getAssetHolding = (assetId: string | null, tokenAddress: string | null): Holding | null => {
    if (!assetId && !tokenAddress) return null;
    const holding = holdings.find(h => 
      (assetId && h.assetId === assetId) || 
      (tokenAddress && h.tokenAddress === tokenAddress)
    );
    return holding || null;
  };

  if (!mounted) {
    return null;
  }

  return (
    <PageContainer
      title="我的持仓与收益"
      subtitle="查看你在 MantleLuxury 平台上持有的资产份额和收益记录"
      maxWidth="5xl"
    >
        {!isConnected ? (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center">
            <p className="text-sm text-slate-300">
              请先在页面右上角连接钱包以查看你的持仓和收益。
            </p>
          </div>
        ) : (
          <>
            {/* 标签页切换 */}
            <div className="mb-6 flex gap-2 border-b border-slate-700/50">
              <button
                onClick={() => setActiveTab("holdings")}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === "holdings"
                    ? "text-sky-400 border-b-2 border-sky-400"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                我的持仓
              </button>
              <button
                onClick={() => setActiveTab("yields")}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === "yields"
                    ? "text-sky-400 border-b-2 border-sky-400"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                收益记录
              </button>
            </div>

            {activeTab === "holdings" ? (
              <>
            {/* 持仓统计 */}
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <TechCard className="px-6 py-5">
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
                <div className="relative z-10">
                  <div className="text-xs text-slate-400 mb-2">持仓资产数</div>
                  <div className="text-2xl font-bold text-sky-400">
                    {holdings.length}
                  </div>
                </div>
              </TechCard>
              <TechCard className="px-6 py-5">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5"></div>
                <div className="relative z-10">
                  <div className="text-xs text-slate-400 mb-2">总持仓成本</div>
                  <div className="text-2xl font-bold text-amber-400">
                    {holdings.reduce((sum, h) => sum + parseFloat(h.totalCost || "0"), 0).toFixed(4)} MNT
                  </div>
                </div>
              </TechCard>
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
                    <TechCard className="px-6 py-5">
                      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
                      <div className="relative z-10">
                        <h3 className="text-lg font-semibold mb-4">资产分布（按类别）</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                            <Pie
                              data={distribution.byType}
                              cx="50%"
                              cy="50%"
                              label={({ name, percent }) => {
                                // 只显示百分比，完整名称在图例中显示
                                return `${((percent ?? 0) * 100).toFixed(0)}%`;
                              }}
                              labelLine={{ strokeWidth: 2 }}
                              outerRadius={85}
                              innerRadius={30}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {distribution.byType.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: number | undefined, name: string | undefined) => [`${(value ?? 0).toFixed(2)} MNT`, name ?? '']}
                            />
                            <Legend 
                              wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }}
                              iconType="circle"
                              formatter={(value) => value}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </TechCard>
                  )}
                  
                  {/* 按品牌分布 */}
                  {distribution.byBrand.length > 0 && (
                    <TechCard className="px-6 py-5">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5"></div>
                      <div className="relative z-10">
                        <h3 className="text-lg font-semibold mb-4">资产分布（按品牌）</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                            <Pie
                              data={distribution.byBrand}
                              cx="50%"
                              cy="50%"
                              label={({ name, percent }) => {
                                // 只显示百分比，完整名称在图例中显示
                                return `${((percent ?? 0) * 100).toFixed(0)}%`;
                              }}
                              labelLine={{ strokeWidth: 2 }}
                              outerRadius={85}
                              innerRadius={30}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {distribution.byBrand.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: number | undefined, name: string | undefined) => [`${(value ?? 0).toFixed(2)} MNT`, name ?? '']}
                            />
                            <Legend 
                              wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }}
                              iconType="circle"
                              formatter={(value) => value}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </TechCard>
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
            </div>
            
            {/* 持仓列表 */}
            <div className="glass-effect border border-slate-700/60 rounded-2xl px-4 py-4 overflow-x-auto">
              <table className="min-w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700/60">
                  <th className="py-3 text-left font-normal">资产</th>
                  <th className="py-3 text-right font-normal">代币符号</th>
                  <th className="py-3 text-right font-normal">持有份额</th>
                  <th className="py-3 text-right font-normal">单份价格 (MNT)</th>
                  <th className="py-3 text-right font-normal">持仓成本 (MNT)</th>
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
                    <td className="py-3 text-right">
                      {h.tokenAddress && tokenInfos[h.tokenAddress] ? (
                        <span className="text-sm text-sky-400 font-medium">
                          {tokenInfos[h.tokenAddress].symbol}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 text-right">{h.balance}</td>
                    <td className="py-3 text-right">{h.pricePerShare}</td>
                    <td className="py-3 text-right">{h.totalCost}</td>
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
            ) : (
              <>
                {/* 收益记录标签页 */}
                {/* 总收益统计 */}
                <div className="mb-6 grid gap-4 md:grid-cols-3">
                  <TechCard className="px-6 py-5">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5"></div>
                    <div className="relative z-10">
                      <div className="text-xs text-slate-400 mb-2">累计收益</div>
                      <div className="text-2xl font-bold text-emerald-400">
                        {formatAmount(totalUserYield)} / {formatAmount(totalAllYield)} MNT
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        我的收益 / 总收益
                      </div>
                    </div>
                  </TechCard>
                  <TechCard className="px-6 py-5">
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
                    <div className="relative z-10">
                      <div className="text-xs text-slate-400 mb-2">资产数量</div>
                      <div className="text-2xl font-bold text-sky-400">
                        {assetGroups.length}
                      </div>
                    </div>
                  </TechCard>
                  <TechCard className="px-6 py-5">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5"></div>
                    <div className="relative z-10">
                      <div className="text-xs text-slate-400 mb-2">已完成分配</div>
                      <div className="text-2xl font-bold text-amber-400">
                        {yields.filter((y) => y.isCompleted).length}
                      </div>
                    </div>
                  </TechCard>
                </div>

                {/* 收益记录列表 */}
                {yieldsLoading ? (
                  <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center">
                    <p className="text-slate-300">加载中...</p>
                  </div>
                ) : yieldsError ? (
                  <div className="glass-effect border border-red-500/40 rounded-2xl px-6 py-8 text-center">
                    <p className="text-red-300">{yieldsError}</p>
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
                  <div className="space-y-8">
                    {/* 我提交的资产收益 */}
                    {assetGroups.filter(g => g.isSubmittedByUser).length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-400/40 font-medium">
                            我提交的资产
                          </span>
                          <span className="text-sm font-normal text-slate-400">
                            ({assetGroups.filter(g => g.isSubmittedByUser).length} 个资产)
                          </span>
                        </h3>
                        <div className="space-y-6">
                          {assetGroups.filter(g => g.isSubmittedByUser).map((group) => (
                            <div
                              key={group.assetId}
                              className="glass-effect rounded-2xl border border-purple-500/30 overflow-hidden"
                            >
                        {/* 资产汇总头部 */}
                        <div className="bg-gradient-to-r from-sky-500/10 to-purple-500/10 px-6 py-4 border-b border-slate-700/50">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-bold text-slate-200">
                                  {group.assetInfo 
                                    ? `${group.assetInfo.brand} ${group.assetInfo.model}${group.assetInfo.year ? ` (${group.assetInfo.year})` : ''}`
                                    : `资产 ${group.assetId.slice(0, 8)}...`}
                                </h3>
                                <span className="px-2 py-1 rounded text-xs bg-slate-700/40 text-slate-300">
                                  {group.assetInfo?.assetType === 'watch' ? '腕表' : group.assetInfo?.assetType === 'jewelry' ? '珠宝' : '其他'}
                                </span>
                                {group.tokenSymbol && (
                                  <span className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-medium">
                                    {group.tokenSymbol}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">
                                资产 ID: {group.assetId.slice(0, 8)}... | {group.yields.length} 笔收益记录
                                {group.tokenSymbol && ` | 代币符号: ${group.tokenSymbol}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-slate-400 mb-1">该资产收益汇总</div>
                              <div className="text-xl font-bold text-emerald-400">
                                {formatAmount(group.userTotal.toString())} / {formatAmount(group.allTotal.toString())} MNT
                              </div>
                              <div className="text-xs text-slate-500 mt-1">我的收益 / 总收益</div>
                              {(() => {
                                const holding = getAssetHolding(group.assetId, group.yields[0]?.tokenAddress || null);
                                if (!holding) return null;
                                return (
                                  <div className="mt-3 space-y-1">
                                    {holding.roi && (
                                      <div className="text-xs text-slate-300">
                                        收益率: <span className="font-medium text-sky-400">{(Number(holding.roi) * 100).toFixed(2)}%</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* 该资产的收益记录列表 */}
                        <div className="px-6 py-4 space-y-3">
                          {group.yields.map((yieldItem) => (
                            <div
                              key={yieldItem.id}
                              className="card-hover glass-effect rounded-xl border border-slate-700/30 px-4 py-3 relative overflow-hidden"
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/3 to-purple-500/3"></div>
                              <div className="relative z-10">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          yieldItem.isCompleted
                                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                                            : "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                                        }`}
                                      >
                                        {yieldItem.isCompleted ? "已完成" : "进行中"}
                                      </span>
                                      <span className="px-2 py-1 rounded-full text-xs bg-slate-700/40 text-slate-300 border border-slate-600/40">
                                        {yieldItem.yieldType === "appreciation"
                                          ? "升值收益"
                                          : "租赁收益"}
                                      </span>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      分配 ID: {yieldItem.distributionIdBytes32.slice(0, 10)}...
                                      {yieldItem.distributionIdBytes32.slice(-8)}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs text-slate-400 mb-1">我的收益 / 总收益</div>
                                    <div className="text-lg font-bold text-emerald-400">
                                      {formatAmount(
                                        yieldItem.userShare !== undefined 
                                          ? yieldItem.userShare 
                                          : yieldItem.totalAmount
                                      )} / {formatAmount(yieldItem.totalAmount)} MNT
                                    </div>
                                    {yieldItem.isCompleted && (
                                      <div className="text-xs text-slate-500 mt-1">
                                        已分配: {formatAmount(yieldItem.distributedAmount)} MNT
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                  <div>
                                    <div className="text-slate-500 text-xs mb-1">创建时间</div>
                                    <div className="text-slate-300">
                                      {formatDate(yieldItem.createdAt)}
                                    </div>
                                  </div>
                                  {yieldItem.completedAt && (
                                    <div>
                                      <div className="text-slate-500 text-xs mb-1">完成时间</div>
                                      <div className="text-slate-300">
                                        {formatDate(yieldItem.completedAt)}
                                      </div>
                                    </div>
                                  )}
                                  {yieldItem.transactionHash && (
                                    <div>
                                      <div className="text-slate-500 text-xs mb-1">交易</div>
                                      <a
                                        href={`https://explorer.sepolia.mantle.xyz/tx/${yieldItem.transactionHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sky-400 hover:text-sky-300 text-xs"
                                      >
                                        查看交易 →
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                        </div>
                      </div>
                    )}

                    {/* 我投资的资产收益 */}
                    {assetGroups.filter(g => !g.isSubmittedByUser).length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-xs bg-sky-500/20 text-sky-300 border border-sky-400/40 font-medium">
                            我投资的资产
                          </span>
                          <span className="text-sm font-normal text-slate-400">
                            ({assetGroups.filter(g => !g.isSubmittedByUser).length} 个资产)
                          </span>
                        </h3>
                        <div className="space-y-6">
                          {assetGroups.filter(g => !g.isSubmittedByUser).map((group) => (
                            <div
                              key={group.assetId}
                              className="glass-effect rounded-2xl border border-slate-700/50 overflow-hidden"
                            >
                              {/* 资产汇总头部 */}
                              <div className="bg-gradient-to-r from-sky-500/10 to-purple-500/10 px-6 py-4 border-b border-slate-700/50">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-3 mb-2">
                                      <h3 className="text-lg font-bold text-slate-200">
                                        {group.assetInfo 
                                          ? `${group.assetInfo.brand} ${group.assetInfo.model}${group.assetInfo.year ? ` (${group.assetInfo.year})` : ''}`
                                          : `资产 ${group.assetId.slice(0, 8)}...`}
                                      </h3>
                                      <span className="px-2 py-1 rounded text-xs bg-slate-700/40 text-slate-300">
                                        {group.assetInfo?.assetType === 'watch' ? '腕表' : group.assetInfo?.assetType === 'jewelry' ? '珠宝' : '其他'}
                                      </span>
                                      {group.tokenSymbol && (
                                        <span className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-medium">
                                          {group.tokenSymbol}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      资产 ID: {group.assetId.slice(0, 8)}... | {group.yields.length} 笔收益记录
                                      {group.tokenSymbol && ` | 代币符号: ${group.tokenSymbol}`}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs text-slate-400 mb-1">该资产收益汇总</div>
                                    <div className="text-xl font-bold text-emerald-400">
                                      {formatAmount(group.userTotal.toString())} / {formatAmount(group.allTotal.toString())} MNT
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">我的收益 / 总收益</div>
                                    {(() => {
                                      const holding = getAssetHolding(group.assetId, group.yields[0]?.tokenAddress || null);
                                      if (!holding) return null;
                                      return (
                                        <div className="mt-3 space-y-1">
                                          {holding.roi && (
                                            <div className="text-xs text-slate-300">
                                              收益率: <span className="font-medium text-sky-400">{(Number(holding.roi) * 100).toFixed(2)}%</span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>

                              {/* 该资产的收益记录列表 */}
                              <div className="px-6 py-4 space-y-3">
                                {group.yields.map((yieldItem) => (
                                  <div
                                    key={yieldItem.id}
                                    className="card-hover glass-effect rounded-xl border border-slate-700/30 px-4 py-3 relative overflow-hidden"
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/3 to-purple-500/3"></div>
                                    <div className="relative z-10">
                                      <div className="flex items-start justify-between mb-3">
                                        <div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <span
                                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                yieldItem.isCompleted
                                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                                                  : "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                                              }`}
                                            >
                                              {yieldItem.isCompleted ? "已完成" : "进行中"}
                                            </span>
                                            <span className="px-2 py-1 rounded-full text-xs bg-slate-700/40 text-slate-300 border border-slate-600/40">
                                              {yieldItem.yieldType === "appreciation"
                                                ? "升值收益"
                                                : "租赁收益"}
                                            </span>
                                          </div>
                                          <div className="text-xs text-slate-400">
                                            分配 ID: {yieldItem.distributionIdBytes32.slice(0, 10)}...
                                            {yieldItem.distributionIdBytes32.slice(-8)}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-xs text-slate-400 mb-1">我的收益 / 总收益</div>
                                          <div className="text-lg font-bold text-emerald-400">
                                            {formatAmount(
                                              yieldItem.userShare !== undefined 
                                                ? yieldItem.userShare 
                                                : yieldItem.totalAmount
                                            )} / {formatAmount(yieldItem.totalAmount)} MNT
                                          </div>
                                          {yieldItem.isCompleted && (
                                            <div className="text-xs text-slate-500 mt-1">
                                              已分配: {formatAmount(yieldItem.distributedAmount)} MNT
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                        <div>
                                          <div className="text-slate-500 text-xs mb-1">创建时间</div>
                                          <div className="text-slate-300">
                                            {formatDate(yieldItem.createdAt)}
                                          </div>
                                        </div>
                                        {yieldItem.completedAt && (
                                          <div>
                                            <div className="text-slate-500 text-xs mb-1">完成时间</div>
                                            <div className="text-slate-300">
                                              {formatDate(yieldItem.completedAt)}
                                            </div>
                                          </div>
                                        )}
                                        {yieldItem.transactionHash && (
                                          <div>
                                            <div className="text-slate-500 text-xs mb-1">交易</div>
                                            <a
                                              href={`https://explorer.sepolia.mantle.xyz/tx/${yieldItem.transactionHash}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-sky-400 hover:text-sky-300 text-xs"
                                            >
                                              查看交易 →
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
    </PageContainer>
  );
}


