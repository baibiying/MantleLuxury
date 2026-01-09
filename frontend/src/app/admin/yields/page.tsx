"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import PageContainer from "@/components/PageContainer";
import TechCard from "@/components/TechCard";
import TechButton from "@/components/TechButton";

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

type AssetInfo = {
  id: string;
  brand: string;
  model: string;
  assetType: string;
  year: number | null;
};

type AssetYieldGroup = {
  assetId: string;
  assetInfo: AssetInfo | null;
  yields: YieldDistribution[];
  totalAmount: number;
  distributedAmount: number;
  completedAmount: number;
  pendingAmount: number;
};

type Stats = {
  total: number;
  completed: number;
  pending: number;
  totalAmount: string;
  completedAmount: string;
  pendingAmount: string;
  distributedAmount: string;
};

export default function AdminYieldsPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [yields, setYields] = useState<YieldDistribution[]>([]);
  const [assetGroups, setAssetGroups] = useState<AssetYieldGroup[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 创建分配表单
  const [assetId, setAssetId] = useState("");
  const [yieldType, setYieldType] = useState<"appreciation" | "rental">(
    "appreciation"
  );
  const [totalAmount, setTotalAmount] = useState("");
  const [creating, setCreating] = useState(false);
  const [creatingOnChainId, setCreatingOnChainId] = useState<string | null>(
    null
  );
  const [distributingId, setDistributingId] = useState<string | null>(null);

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

  useEffect(() => {
    if (mounted && isAdmin === true) {
      loadData();
    }
  }, [mounted, isAdmin]);

  const checkAdminStatus = async () => {
    if (!address) {
      setIsAdmin(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/yields/stats`, {
        headers: {
          "X-Wallet-Address": address,
        },
      });
      setIsAdmin(res.ok);
      if (!res.ok) {
        try {
          const data = await res.json();
          setError(data.error || "无权限访问收益分配控制台");
          console.error("Admin yield check failed:", data);
        } catch {
          const text = await res.text();
          setError(text || "无权限访问收益分配控制台");
          console.error("Admin yield check failed (text):", text);
        }
      } else {
        setError(null);
      }
    } catch (e: any) {
      setIsAdmin(false);
      setError("检查管理员权限失败: " + (e.message || "网络错误"));
      console.error("Admin yield check error:", e);
    }
  };

  const loadData = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const headers = {
        "X-Wallet-Address": address,
      };
      const [yieldsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/yields`, { headers }),
        fetch(`${API_BASE}/api/admin/yields/stats`, { headers }),
      ]);

      if (!yieldsRes.ok) throw new Error("加载收益分配记录失败");
      if (!statsRes.ok) throw new Error("加载统计信息失败");

      const yieldsData = await yieldsRes.json();
      const statsData = await statsRes.json();

      setYields(yieldsData);
      setStats(statsData);

      // 按 assetId 分组收益分配记录
      const groupedByAsset = yieldsData.reduce((acc: Record<string, YieldDistribution[]>, yieldItem) => {
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

      // 创建资产分组数据
      const groups: AssetYieldGroup[] = uniqueAssetIds.map((assetId, index) => {
        const assetYields = groupedByAsset[assetId];
        const { totalAmount, distributedAmount, completedAmount, pendingAmount } = assetYields.reduce(
          (acc, y) => {
            const amount = parseFloat(y.totalAmount || "0");
            const distributed = parseFloat(y.distributedAmount || "0");
            return {
              totalAmount: acc.totalAmount + amount,
              distributedAmount: acc.distributedAmount + distributed,
              completedAmount: acc.completedAmount + (y.isCompleted ? amount : 0),
              pendingAmount: acc.pendingAmount + (y.isCompleted ? 0 : amount),
            };
          },
          { totalAmount: 0, distributedAmount: 0, completedAmount: 0, pendingAmount: 0 }
        );

        return {
          assetId,
          assetInfo: assetInfos[index],
          yields: assetYields,
          totalAmount,
          distributedAmount,
          completedAmount,
          pendingAmount,
        };
      });

      setAssetGroups(groups);
    } catch (e: any) {
      setError(e.message ?? "加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: string | number) => {
    try {
      const num =
        typeof amount === "number" ? amount : parseFloat(amount || "0");
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

  const handleCreateDistribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    if (!assetId.trim()) {
      setError("请填写资产 ID");
      return;
    }
    if (!totalAmount.trim() || isNaN(Number(totalAmount))) {
      setError("请输入有效的总收益金额（MNT）");
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/yields/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wallet-Address": address,
        },
        body: JSON.stringify({
          assetId: assetId.trim(),
          yieldType,
          totalAmount: totalAmount.trim(),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "创建收益分配失败");
      }

      const data: YieldDistribution = await res.json();
      setSuccess("✅ 收益分配记录已创建（链下）");
      setTimeout(() => setSuccess(null), 3000);
      setAssetId("");
      setTotalAmount("");
      // 将新记录插入列表顶部
      setYields((prev) => [data, ...prev]);
      // 重新加载统计
      loadData();
    } catch (e: any) {
      setError(e.message ?? "创建收益分配失败");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateOnChain = async (distributionId: string) => {
    if (!address) return;
    const target = yields.find((y) => y.id === distributionId);
    if (!target) return;

    if (
      !confirm(
        `确认在链上为资产 ${target.assetId} 创建收益分配？\n金额：${formatAmount(
          target.totalAmount
        )} MNT`
      )
    ) {
      return;
    }

    setCreatingOnChainId(distributionId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/yields/${distributionId}/create-on-chain`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Wallet-Address": address,
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "链上创建收益分配失败");
      }

      const data = await res.json();
      const txHash = data.transactionHash as string | undefined;
      setSuccess("✅ 已在链上创建收益分配");
      setTimeout(() => setSuccess(null), 3000);

      // 更新对应记录的 transactionHash
      if (txHash) {
        setYields((prev) =>
          prev.map((y) =>
            y.id === distributionId ? { ...y, transactionHash: txHash } : y
          )
        );
      }
      // 重新加载数据，保证与后端一致
      loadData();
    } catch (e: any) {
      setError(e.message ?? "链上创建收益分配失败");
    } finally {
      setCreatingOnChainId(null);
    }
  };

  const handleDistributeOnChain = async (distributionId: string) => {
    if (!address) return;
    const target = yields.find((y) => y.id === distributionId);
    if (!target) return;

    if (!target.transactionHash) {
      setError("请先在链上创建分配（createDistribution），再执行分发");
      return;
    }

    if (
      !confirm(
        `确认在链上执行收益分配？\n资产 ${target.assetId}\n金额：${formatAmount(
          target.totalAmount
        )} MNT`
      )
    ) {
      return;
    }

    setDistributingId(distributionId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/yields/${distributionId}/distribute-on-chain`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Wallet-Address": address,
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "链上执行收益分配失败");
      }

      const data = await res.json();
      const txHash = data.transactionHash as string | undefined;
      setSuccess("✅ 已在链上执行收益分配并标记为完成");
      setTimeout(() => setSuccess(null), 3000);

      if (txHash) {
        setYields((prev) =>
          prev.map((y) =>
            y.id === distributionId
              ? {
                  ...y,
                  transactionHash: y.transactionHash || txHash,
                  isCompleted: true,
                  distributedAmount: y.totalAmount,
                }
              : y
          )
        );
      }
      await loadData();
    } catch (e: any) {
      setError(e.message ?? "链上执行收益分配失败");
    } finally {
      setDistributingId(null);
    }
  };

  if (!mounted) return null;

  // 管理员权限不足时的提示
  if (isAdmin === false) {
    return (
      <PageContainer
        title="收益分配控制台"
        subtitle="仅管理员可以创建和管理收益分配"
        maxWidth="5xl"
      >
        <TechCard className="px-6 py-8 text-center">
          {!isConnected ? (
            <>
              <p className="text-lg font-semibold text-red-200 mb-2">
                请先连接钱包
              </p>
              <p className="text-sm text-slate-300">
                请在页面右上角连接钱包。收益分配控制台仅限管理员访问
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-red-200 mb-2">
                无权限访问
              </p>
              <p className="text-sm text-slate-300">
                当前钱包地址不是管理员，无法访问收益分配控制台
              </p>
              {error && (
                <p className="text-sm text-red-300 mt-2">{error}</p>
              )}
            </>
          )}
        </TechCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="收益分配控制台"
      subtitle="为已代币化资产创建和管理收益分配（仅管理员）"
      maxWidth="5xl"
    >
      {/* 全局提示 */}
      {error && (
        <div className="mb-6 bg-red-950/40 border border-red-500/40 rounded-xl px-6 py-4">
          <p className="text-sm font-semibold text-red-200 mb-1">
            错误
          </p>
          <p className="text-xs text-red-300 break-all">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-6 py-4">
          <p className="text-sm font-semibold text-emerald-200">
            {success}
          </p>
        </div>
      )}

      {loading ? (
        <TechCard className="px-6 py-8 text-center">
          <p className="text-sm text-slate-300">正在加载数据...</p>
        </TechCard>
      ) : (
        <div className="space-y-6">
            {/* 统计信息 */}
            {stats && (
              <div className="grid gap-4 md:grid-cols-5">
                <TechCard className="px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">总分配次数</div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </TechCard>
                <TechCard className="px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">已完成</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {stats.completed}
                  </div>
                </TechCard>
                <TechCard className="px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">进行中</div>
                  <div className="text-2xl font-bold text-amber-400">
                    {stats.pending}
                  </div>
                </TechCard>
                <TechCard className="px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">
                    已完成金额
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {formatAmount(stats.completedAmount || "0")} MNT
                  </div>
                </TechCard>
                <TechCard className="px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">
                    进行中金额
                  </div>
                  <div className="text-2xl font-bold text-amber-400">
                    {formatAmount(stats.pendingAmount || "0")} MNT
                  </div>
                </TechCard>
              </div>
            )}

            {/* 创建收益分配表单 */}
            <TechCard className="px-6 py-6">
              <h2 className="text-lg font-semibold mb-4">创建新的收益分配</h2>
              <p className="text-sm text-slate-400 mb-4">
                先在链下创建收益分配记录，然后再在链上执行 createDistribution。
              </p>
              <form
                onSubmit={handleCreateDistribution}
                className="grid gap-4 md:grid-cols-3"
              >
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium mb-2">
                    资产 ID *
                  </label>
                  <input
                    type="text"
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    placeholder="资产 UUID（可从资产后台复制）"
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                    disabled={creating}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    收益类型
                  </label>
                  <select
                    value={yieldType}
                    onChange={(e) =>
                      setYieldType(e.target.value as "appreciation" | "rental")
                    }
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                    disabled={creating}
                  >
                    <option value="appreciation">升值收益</option>
                    <option value="rental">租赁收益</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    总收益金额（MNT）*
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="例如：10.5"
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                    disabled={creating}
                  />
                </div>
                <div className="md:col-span-3 flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
                  >
                    {creating ? "创建中..." : "创建链下收益分配"}
                  </button>
                </div>
              </form>
            </TechCard>

            {/* 收益分配列表 */}
            <TechCard className="px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">收益分配记录</h2>
                <p className="text-xs text-slate-400">
                  提示：先创建链下记录 → 在链上创建分配 → 执行链上分发。
                </p>
              </div>

              {yields.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  暂无收益分配记录
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
                            </div>
                            <div className="text-xs text-slate-400">
                              资产 ID: {group.assetId.slice(0, 8)}... | {group.yields.length} 笔分配记录
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400 mb-1">该资产分配汇总</div>
                            <div className="text-xl font-bold text-emerald-400">
                              {formatAmount(group.totalAmount.toString())} MNT
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              已完成: {formatAmount(group.completedAmount.toString())} MNT | 进行中: {formatAmount(group.pendingAmount.toString())} MNT
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 该资产的收益分配记录列表 */}
                      <div className="px-6 py-4 space-y-3">
                        {group.yields.map((y) => (
                          <div
                            key={y.id}
                            className="card-hover glass-effect rounded-xl border border-slate-700/30 px-4 py-3 relative overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/3 to-purple-500/3"></div>
                            <div className="relative z-10">
                              <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  y.isCompleted
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                                }`}
                              >
                                {y.isCompleted ? "已完成" : "进行中"}
                              </span>
                              <span className="px-3 py-1 rounded-full text-xs bg-slate-700/40 text-slate-300 border border-slate-600/40">
                                {y.yieldType === "appreciation"
                                  ? "升值收益"
                                  : "租赁收益"}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400">
                              分配 ID:{" "}
                              <span className="font-mono">
                                {y.distributionIdBytes32.slice(0, 10)}...
                                {y.distributionIdBytes32.slice(-8)}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              资产 ID:{" "}
                              <span className="font-mono">
                                {y.assetId.slice(0, 8)}...
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              Token:{" "}
                              <span className="font-mono">
                                {y.tokenAddress.slice(0, 6)}...
                                {y.tokenAddress.slice(-4)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400 mb-1">
                              总收益金额
                            </div>
                            <div className="text-xl font-bold text-emerald-400">
                              {formatAmount(y.totalAmount)} MNT
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              已分配:{" "}
                              {formatAmount(y.distributedAmount || "0")} MNT
                            </div>
                          </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-400">
                          <div>
                            <div className="mb-1">创建时间</div>
                            <div className="text-slate-300">
                              {formatDate(y.createdAt)}
                            </div>
                          </div>
                          <div>
                            <div className="mb-1">完成时间</div>
                            <div className="text-slate-300">
                              {formatDate(y.completedAt)}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <div className="mb-1">链上交易</div>
                            {y.transactionHash ? (
                              <a
                                href={`https://explorer.sepolia.mantle.xyz/tx/${y.transactionHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-400 hover:text-sky-300"
                              >
                                {y.transactionHash.slice(0, 12)}...
                                {y.transactionHash.slice(-8)} →
                              </a>
                            ) : (
                              <span className="text-slate-500">
                                尚未在链上创建（createDistribution）
                              </span>
                            )}
                          </div>
                              </div>

                              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => handleCreateOnChain(y.id)}
                            disabled={
                              creatingOnChainId === y.id || !!y.transactionHash
                            }
                            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                              y.transactionHash
                                ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                                : "bg-sky-600 hover:bg-sky-700 text-white"
                            }`}
                          >
                            {y.transactionHash
                              ? "已在链上创建"
                              : creatingOnChainId === y.id
                              ? "链上创建中..."
                              : "在链上创建分配"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDistributeOnChain(y.id)}
                            disabled={
                              distributingId === y.id ||
                              !y.transactionHash ||
                              y.isCompleted
                            }
                            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                              y.isCompleted
                                ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                                : !y.transactionHash
                                ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            }`}
                          >
                            {y.isCompleted
                              ? "已完成分发"
                              : !y.transactionHash
                              ? "等待链上创建"
                              : distributingId === y.id
                              ? "分发中..."
                              : "执行链上分发并标记完成"}
                          </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TechCard>
        </div>
      )}
    </PageContainer>
  );
}


