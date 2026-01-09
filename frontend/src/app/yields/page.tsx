"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { mantleSepoliaTestnet } from "@/lib/web3/config";
import { luxuryTokenAbi } from "@/lib/web3/contracts";
import Link from "next/link";
import PageContainer from "@/components/PageContainer";
import TechCard from "@/components/TechCard";

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
};

export default function YieldsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [yields, setYields] = useState<YieldDistribution[]>([]);
  const [assetGroups, setAssetGroups] = useState<AssetYieldGroup[]>([]);
  const [tokenInfos, setTokenInfos] = useState<Record<string, TokenInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalYield, setTotalYield] = useState<string>("0");
  const [totalUserYield, setTotalUserYield] = useState<string>("0");
  const [totalAllYield, setTotalAllYield] = useState<string>("0");

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

        let yieldsData: YieldDistribution[] = [];
        if (yieldsRes.ok) {
          yieldsData = await yieldsRes.json();
          setYields(yieldsData);
        }

        // 按 assetId 分组收益记录
        const groupedByAsset = yieldsData.reduce((acc, yieldItem) => {
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
          };
        });

        setAssetGroups(groups);

        // 计算我的收益总和和总收益总和
        const { userTotal, allTotal } = yieldsData.reduce(
          (acc, y) => {
            // 我的收益：优先使用 userShare，如果没有则使用 totalAmount（假设用户持有全部）
            const userAmount = y.userShare !== undefined 
              ? parseFloat(y.userShare || "0")
              : parseFloat(y.totalAmount || "0");
            // 总收益：使用 totalAmount
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

        if (summaryRes.ok) {
          const summary = await summaryRes.json();
          // 如果后端返回的累计收益为0，但前端有收益记录，则使用前端计算的值
          if (summary.totalYield === 0 && yieldsData.length > 0) {
            const userTotal = yieldsData.reduce((sum, y) => {
              const amount = y.userShare !== undefined 
                ? parseFloat(y.userShare || "0")
                : parseFloat(y.totalAmount || "0");
              return sum + amount;
            }, 0);
            setTotalYield(userTotal.toString());
          } else {
            setTotalYield(summary.totalYield || "0");
          }
        } else if (yieldsData.length > 0) {
          // 如果后端 API 失败，但前端有收益记录，则从前端计算
          const userTotal = yieldsData.reduce((sum, y) => {
            const amount = y.userShare !== undefined 
              ? parseFloat(y.userShare || "0")
              : parseFloat(y.totalAmount || "0");
            return sum + amount;
          }, 0);
          setTotalYield(userTotal.toString());
        }
      } catch (err: any) {
        setError(err.message || "加载失败");
      } finally {
        setLoading(false);
      }
    };
    loadYields();
  }, [address, publicClient, chainId]);

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
    <PageContainer
      title="收益记录"
      subtitle="查看您的资产升值收益分配记录"
      maxWidth="5xl"
    >
        {!isConnected || !address ? (
          <TechCard className="px-6 py-8 text-center">
            <p className="text-sm text-slate-300">
              请先在页面右上角连接钱包，查看收益记录。
            </p>
          </TechCard>
        ) : (
          <>
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
              <div className="space-y-6">
                {assetGroups.map((group) => (
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
            )}
          </>
        )}
    </PageContainer>
  );
}

