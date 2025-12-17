"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type User = {
  id: string;
  walletAddress: string;
  email: string | null;
  kycStatus: "none" | "pending" | "approved" | "rejected";
  kycSubmittedAt: string | null;
  kycApprovedAt: string | null;
  createdAt: string;
  isBlacklisted: boolean;
};

type BlacklistEntry = {
  id: string;
  walletAddress: string;
  reason: string | null;
  createdAt: string;
};

type Stats = {
  total: number;
  none: number;
  pending: number;
  approved: number;
  rejected: number;
  blacklisted: number;
};

export default function AdminKycPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddBlacklist, setShowAddBlacklist] = useState(false);
  const [newBlacklistAddress, setNewBlacklistAddress] = useState("");
  const [newBlacklistReason, setNewBlacklistReason] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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
  }, [mounted, statusFilter, isAdmin]);

  const checkAdminStatus = async () => {
    if (!address) {
      setIsAdmin(false);
      return;
    }
    // 通过尝试访问一个需要权限的接口来检查是否是管理员
    try {
      const res = await fetch(`${API_BASE}/api/admin/kyc/stats`, {
        headers: {
          "X-Wallet-Address": address,
        },
      });
      setIsAdmin(res.ok);
      if (!res.ok) {
        try {
          const data = await res.json();
          setError(data.error || "无权限访问管理后台");
          console.error("Admin check failed:", data);
        } catch {
          const text = await res.text();
          setError(text || "无权限访问管理后台");
          console.error("Admin check failed (text):", text);
        }
      } else {
        setError(null); // 清除之前的错误
      }
    } catch (e: any) {
      setIsAdmin(false);
      setError("检查管理员权限失败: " + (e.message || "网络错误"));
      console.error("Admin check error:", e);
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
      const [usersRes, blacklistRes, statsRes] = await Promise.all([
        fetch(
          `${API_BASE}/api/admin/kyc/users${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`,
          { headers }
        ),
        fetch(`${API_BASE}/api/admin/kyc/blacklist`, { headers }),
        fetch(`${API_BASE}/api/admin/kyc/stats`, { headers }),
      ]);

      if (!usersRes.ok) throw new Error("Failed to load users");
      if (!blacklistRes.ok) throw new Error("Failed to load blacklist");
      if (!statsRes.ok) throw new Error("Failed to load stats");

      const usersData = await usersRes.json();
      const blacklistData = await blacklistRes.json();
      const statsData = await statsRes.json();

      setUsers(usersData);
      setBlacklist(blacklistData);
      setStats(statsData);
    } catch (e: any) {
      setError(e.message ?? "加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  const handleReviewKyc = async (walletAddress: string, status: "approved" | "rejected") => {
    if (!address) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/kyc/users/${walletAddress}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Wallet-Address": address,
          },
          body: JSON.stringify({ status }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "审核失败");
      }

      setSuccess(`✅ KYC ${status === "approved" ? "已通过" : "已拒绝"}`);
      setTimeout(() => setSuccess(null), 3000);
      loadData();
    } catch (e: any) {
      setError(e.message ?? "审核失败");
    }
  };

  const handleAddToBlacklist = async () => {
    if (!address) return;
    if (!newBlacklistAddress.trim()) {
      setError("请输入钱包地址");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/kyc/blacklist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wallet-Address": address,
        },
        body: JSON.stringify({
          walletAddress: newBlacklistAddress.trim(),
          reason: newBlacklistReason.trim() || null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "添加失败");
      }

      setSuccess("✅ 已添加到黑名单");
      setTimeout(() => setSuccess(null), 3000);
      setShowAddBlacklist(false);
      setNewBlacklistAddress("");
      setNewBlacklistReason("");
      loadData();
    } catch (e: any) {
      setError(e.message ?? "添加失败");
    }
  };

  const handleRemoveFromBlacklist = async (walletAddress: string) => {
    if (!address) return;
    if (!confirm(`确定要从黑名单中移除 ${walletAddress} 吗？`)) {
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/admin/kyc/blacklist/${walletAddress}`,
        {
          method: "DELETE",
          headers: {
            "X-Wallet-Address": address,
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "移除失败");
      }

      setSuccess("✅ 已从黑名单移除");
      setTimeout(() => setSuccess(null), 3000);
      loadData();
    } catch (e: any) {
      setError(e.message ?? "移除失败");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      none: "bg-slate-600 text-slate-200",
      pending: "bg-amber-600 text-amber-100",
      approved: "bg-emerald-600 text-emerald-100",
      rejected: "bg-red-600 text-red-100",
    };
    const labels = {
      none: "未提交",
      pending: "审核中",
      approved: "已通过",
      rejected: "已拒绝",
    };
    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${styles[status as keyof typeof styles] || styles.none}`}
      >
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  if (!mounted) return null;

  // 检查管理员权限
  if (isAdmin === false) {
    return (
      <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">KYC / AML 管理</h1>
              <p className="text-sm text-slate-400 mt-1">
                管理用户 KYC 状态和 AML 黑名单
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
                  管理后台仅限管理员访问
                </p>
                <WalletConnect />
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-red-200 mb-2">
                  无权限访问
                </p>
                <p className="text-sm text-slate-300">
                  当前钱包地址不是管理员，无法访问管理后台
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
            <h1 className="text-2xl font-semibold">KYC / AML 管理</h1>
            <p className="text-sm text-slate-400 mt-1">
              管理用户 KYC 状态和 AML 黑名单（仅管理员）
            </p>
          </div>
          <WalletConnect />
        </div>

        {/* 错误和成功提示 */}
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
              <div className="grid gap-4 md:grid-cols-6">
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">总用户数</div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </div>
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">未提交</div>
                  <div className="text-2xl font-bold text-slate-400">{stats.none}</div>
                </div>
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">审核中</div>
                  <div className="text-2xl font-bold text-amber-400">{stats.pending}</div>
                </div>
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">已通过</div>
                  <div className="text-2xl font-bold text-emerald-400">{stats.approved}</div>
                </div>
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">已拒绝</div>
                  <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
                </div>
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">黑名单</div>
                  <div className="text-2xl font-bold text-red-500">{stats.blacklisted}</div>
                </div>
              </div>
            )}

            {/* 用户列表 */}
            <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">用户列表</h2>
                <div className="flex items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="all">全部状态</option>
                    <option value="none">未提交</option>
                    <option value="pending">审核中</option>
                    <option value="approved">已通过</option>
                    <option value="rejected">已拒绝</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700/60">
                      <th className="py-3 text-left font-normal">钱包地址</th>
                      <th className="py-3 text-left font-normal">邮箱</th>
                      <th className="py-3 text-left font-normal">KYC 状态</th>
                      <th className="py-3 text-left font-normal">提交时间</th>
                      <th className="py-3 text-left font-normal">黑名单</th>
                      <th className="py-3 text-right font-normal">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          暂无用户数据
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-slate-800/40 last:border-0"
                        >
                          <td className="py-3 font-mono text-xs">
                            {user.walletAddress}
                          </td>
                          <td className="py-3">{user.email || "-"}</td>
                          <td className="py-3">{getStatusBadge(user.kycStatus)}</td>
                          <td className="py-3 text-slate-400 text-xs">
                            {user.kycSubmittedAt
                              ? new Date(user.kycSubmittedAt).toLocaleString("zh-CN")
                              : "-"}
                          </td>
                          <td className="py-3">
                            {user.isBlacklisted ? (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-red-600 text-red-100">
                                是
                              </span>
                            ) : (
                              <span className="text-slate-500">否</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {user.kycStatus === "pending" && (
                                <>
                                  <button
                                    onClick={() =>
                                      handleReviewKyc(user.walletAddress, "approved")
                                    }
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-white text-xs font-medium transition-colors"
                                  >
                                    通过
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleReviewKyc(user.walletAddress, "rejected")
                                    }
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs font-medium transition-colors"
                                  >
                                    拒绝
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 黑名单管理 */}
            <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">黑名单管理</h2>
                <button
                  onClick={() => setShowAddBlacklist(!showAddBlacklist)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-colors"
                >
                  {showAddBlacklist ? "取消" : "+ 添加黑名单"}
                </button>
              </div>

              {showAddBlacklist && (
                <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        钱包地址
                      </label>
                      <input
                        type="text"
                        value={newBlacklistAddress}
                        onChange={(e) => setNewBlacklistAddress(e.target.value)}
                        placeholder="0x..."
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        原因（可选）
                      </label>
                      <input
                        type="text"
                        value={newBlacklistReason}
                        onChange={(e) => setNewBlacklistReason(e.target.value)}
                        placeholder="请输入加入黑名单的原因"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <button
                      onClick={handleAddToBlacklist}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-colors"
                    >
                      确认添加
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700/60">
                      <th className="py-3 text-left font-normal">钱包地址</th>
                      <th className="py-3 text-left font-normal">原因</th>
                      <th className="py-3 text-left font-normal">添加时间</th>
                      <th className="py-3 text-right font-normal">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blacklist.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          黑名单为空
                        </td>
                      </tr>
                    ) : (
                      blacklist.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-slate-800/40 last:border-0"
                        >
                          <td className="py-3 font-mono text-xs">
                            {entry.walletAddress}
                          </td>
                          <td className="py-3 text-slate-400">
                            {entry.reason || "-"}
                          </td>
                          <td className="py-3 text-slate-400 text-xs">
                            {new Date(entry.createdAt).toLocaleString("zh-CN")}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() =>
                                handleRemoveFromBlacklist(entry.walletAddress)
                              }
                              className="px-3 py-1 bg-slate-600 hover:bg-slate-700 rounded text-white text-xs font-medium transition-colors"
                            >
                              移除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

