"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";

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

type Stats = {
  total: number;
  completed: number;
  pending: number;
  totalAmount: string;
  distributedAmount: string;
};

export default function AdminYieldsPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [yields, setYields] = useState<YieldDistribution[]>([]);
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
      <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">收益分配控制台</h1>
              <p className="text-sm text-slate-400 mt-1">
                仅管理员可以创建和管理收益分配
              </p>
            </div>
            <WalletConnect />
          </div>
          <div className="glass-effect border border-red-500/60 rounded-2xl px-6 py-8 text-center">
            {!isConnected ? (
              <>
                <p className="text-lg font-semibold text-red-200 mb-2">
                  请先连接钱包
                </p>
                <p className="text-sm text-slate-300 mb-4">
                  收益分配控制台仅限管理员访问
                </p>
                <WalletConnect />
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
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">收益分配控制台</h1>
            <p className="text-sm text-slate-400 mt-1">
              为已代币化资产创建和管理收益分配（仅管理员）
            </p>
          </div>
          <WalletConnect />
        </div>

        {/* 全局提示 */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 px-4 py-3 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-200">
            {success}
          </div>
        )}

        {loading ? (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center text-sm text-slate-300">
            正在加载数据...
          </div>
        ) : (
          <div className="space-y-6">
            {/* 统计信息 */}
            {stats && (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">总分配次数</div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </div>
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">已完成</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {stats.completed}
                  </div>
                </div>
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">进行中</div>
                  <div className="text-2xl font-bold text-amber-400">
                    {stats.pending}
                  </div>
                </div>
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">
                    累计分配金额 / 已分配
                  </div>
                  <div className="text-sm font-medium">
                    <span className="text-emerald-400">
                      {formatAmount(stats.totalAmount)} MNT
                    </span>
                    <span className="text-slate-500 mx-1">/</span>
                    <span className="text-sky-400">
                      {formatAmount(stats.distributedAmount)} MNT
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 创建收益分配表单 */}
            <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-6">
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
            </div>

            {/* 收益分配列表 */}
            <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-6">
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
                <div className="space-y-4">
                  {yields.map((y) => (
                    <div
                      key={y.id}
                      className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-5 py-4 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
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
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}


