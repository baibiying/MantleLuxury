"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import PageContainer from "@/components/PageContainer";
import TechCard from "@/components/TechCard";
import TechButton from "@/components/TechButton";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type User = {
  id: string;
  walletAddress: string;
  email: string | null;
  kycStatus: "none" | "pending" | "approved" | "rejected";
  kycSubmittedAt: string | null;
  kycApprovedAt: string | null;
  kycRejectedAt: string | null;
  kycRejectionReason: string | null;
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
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingWalletAddress, setRejectingWalletAddress] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [reviewingWalletAddress, setReviewingWalletAddress] = useState<string | null>(null);

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
      // 确保地址格式正确（去除可能的端口号或其他后缀）
      const cleanAddress = address?.split(':')[0] || address;
      const res = await fetch(`${API_BASE}/api/admin/kyc/stats`, {
        headers: {
          "X-Wallet-Address": cleanAddress,
        },
      });
      setIsAdmin(res.ok);
      if (!res.ok) {
        // 403 是正常的，表示不是管理员，不需要显示错误
        if (res.status === 403) {
          setIsAdmin(false);
          setError(null); // 清除错误，403 不是真正的错误
        } else {
          try {
            const data = await res.json();
            setError(data.error || "无权限访问管理后台");
            console.error("Admin check failed:", data);
          } catch {
            const text = await res.text();
            setError(text || "无权限访问管理后台");
            console.error("Admin check failed (text):", text);
          }
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

  const handleReviewKyc = async (walletAddress: string, status: "approved" | "rejected", rejectionReason?: string) => {
    if (!address) return;
    setReviewingWalletAddress(walletAddress);
    setError(null);
    setSuccess(null);
    
    try {
      const requestBody: any = { status };
      if (status === "rejected" && rejectionReason) {
        requestBody.rejectionReason = rejectionReason;
      }

      const res = await fetch(
        `${API_BASE}/api/admin/kyc/users/${walletAddress}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Wallet-Address": address,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        // 检查是否是链上同步失败
        if (data.blockchainSync && data.blockchainSync.status === "failed") {
          throw new Error(`链上同步失败: ${data.blockchainSync.message || "未知错误"}`);
        }
        throw new Error(data.message || data.error || "审核失败");
      }

      // 检查链上同步状态
      const blockchainSync = data.blockchainSync || {};
      if (blockchainSync.status === "success") {
        let successMessage = `✅ KYC ${status === "approved" ? "已通过" : "已拒绝"}（已同步到链上）`;
        if (blockchainSync.transactionHash && blockchainSync.transactionHash !== "N/A") {
          successMessage += `，交易哈希: ${blockchainSync.transactionHash.substring(0, 10)}...`;
        }
        setSuccess(successMessage);
        setTimeout(() => setSuccess(null), 8000);
      } else if (blockchainSync.status === "skipped") {
        // 区块链被禁用（测试环境）
        let successMessage = `✅ KYC ${status === "approved" ? "已通过" : "已拒绝"}（链上同步已跳过，区块链可能被禁用）`;
        setSuccess(successMessage);
        setTimeout(() => setSuccess(null), 8000);
      } else if (blockchainSync.status === "failed") {
        // 链上同步失败（不应该发生，因为后端会在失败时返回错误响应）
        throw new Error(`链上同步失败: ${blockchainSync.message || "未知错误"}`);
      } else {
        // 未知状态
        let successMessage = `✅ KYC ${status === "approved" ? "已通过" : "已拒绝"}`;
        setSuccess(successMessage);
        setTimeout(() => setSuccess(null), 5000);
      }

      setShowRejectDialog(false);
      setRejectionReason("");
      setRejectingWalletAddress("");
      loadData();
    } catch (e: any) {
      setError(e.message ?? "审核失败");
      setTimeout(() => setError(null), 8000);
    } finally {
      setReviewingWalletAddress(null);
    }
  };

  const handleRejectClick = (walletAddress: string) => {
    setRejectingWalletAddress(walletAddress);
    setRejectionReason("");
    setShowRejectDialog(true);
  };

  const handleConfirmReject = () => {
    if (rejectingWalletAddress) {
      handleReviewKyc(rejectingWalletAddress, "rejected", rejectionReason || undefined);
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
        className={`px-2 py-1 rounded text-sm font-medium ${styles[status as keyof typeof styles] || styles.none}`}
      >
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  if (!mounted) return null;

  // 检查管理员权限
  if (isAdmin === false) {
    return (
      <PageContainer
        title="KYC / AML 管理"
        subtitle="管理用户 KYC 状态和 AML 黑名单"
        maxWidth="5xl"
      >
        <TechCard className="px-6 py-8 text-center">
          {!isConnected ? (
            <>
              <p className="text-xl font-semibold text-red-200 mb-2">
                请先连接钱包
              </p>
              <p className="text-base text-slate-300">
                请在页面右上角连接钱包。管理后台仅限管理员访问
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-semibold text-red-200 mb-2">
                无权限访问
              </p>
              <p className="text-base text-slate-300">
                当前钱包地址不是管理员，无法访问管理后台
              </p>
              {error && (
                <p className="text-base text-red-300 mt-2">{error}</p>
              )}
            </>
          )}
        </TechCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="KYC / AML 管理"
      subtitle="管理用户 KYC 状态和 AML 黑名单（仅管理员）"
      maxWidth="5xl"
    >
      {/* 错误和成功提示 */}
      {error && (
        <div className="mb-6 bg-red-950/40 border border-red-500/40 rounded-xl px-6 py-4">
          <p className="text-base font-semibold text-red-200 mb-1">
            错误
          </p>
          <p className="text-sm text-red-300 break-all">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-6 py-4">
          <p className="text-base font-semibold text-emerald-200">
            {success}
          </p>
        </div>
      )}

      {/* 拒绝原因对话框 */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-200 mb-4">拒绝 KYC 申请</h3>
            <div className="mb-4">
              <label className="block text-base font-medium text-slate-300 mb-2">
                拒绝原因（可选）
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="请输入拒绝原因，此原因将发送给用户..."
                rows={4}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-base text-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectionReason("");
                  setRejectingWalletAddress("");
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-base font-semibold"
              >
                取消
              </button>
              <button
                onClick={handleConfirmReject}
                className="flex-1 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-base font-semibold"
              >
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <TechCard className="px-6 py-8 text-center">
          <p className="text-base text-slate-300">正在加载数据...</p>
        </TechCard>
      ) : (
        <div className="space-y-6">
          {/* 统计信息 */}
          {stats && (
            <div className="grid gap-4 md:grid-cols-6">
              <TechCard className="px-4 py-4">
                <div className="text-sm text-slate-400 mb-1">总用户数</div>
                <div className="text-3xl font-bold">{stats.total}</div>
              </TechCard>
              <TechCard className="px-4 py-4">
                <div className="text-sm text-slate-400 mb-1">未提交</div>
                <div className="text-3xl font-bold text-slate-400">{stats.none}</div>
              </TechCard>
              <TechCard className="px-4 py-4">
                <div className="text-sm text-slate-400 mb-1">审核中</div>
                <div className="text-3xl font-bold text-amber-400">{stats.pending}</div>
              </TechCard>
              <TechCard className="px-4 py-4">
                <div className="text-sm text-slate-400 mb-1">已通过</div>
                <div className="text-3xl font-bold text-emerald-400">{stats.approved}</div>
              </TechCard>
              <TechCard className="px-4 py-4">
                <div className="text-sm text-slate-400 mb-1">已拒绝</div>
                <div className="text-3xl font-bold text-red-400">{stats.rejected}</div>
              </TechCard>
              <TechCard className="px-4 py-4">
                <div className="text-sm text-slate-400 mb-1">黑名单</div>
                <div className="text-3xl font-bold text-red-500">{stats.blacklisted}</div>
              </TechCard>
            </div>
          )}

          {/* 用户列表 */}
          <TechCard className="px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">用户列表</h2>
                <div className="flex items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 text-base focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                <table className="min-w-full text-base">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700/60">
                      <th className="py-3 text-left font-medium">钱包地址</th>
                      <th className="py-3 text-left font-medium">邮箱</th>
                      <th className="py-3 text-left font-medium">KYC 状态</th>
                      <th className="py-3 text-left font-medium">提交时间</th>
                      <th className="py-3 text-left font-medium">拒绝原因</th>
                      <th className="py-3 text-left font-medium">黑名单</th>
                      <th className="py-3 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          暂无用户数据
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-slate-800/40 last:border-0"
                        >
                          <td className="py-3 font-mono text-sm">
                            {user.walletAddress}
                          </td>
                          <td className="py-3">{user.email || "-"}</td>
                          <td className="py-3">{getStatusBadge(user.kycStatus)}</td>
                          <td className="py-3 text-slate-400 text-sm">
                            {user.kycSubmittedAt
                              ? new Date(user.kycSubmittedAt).toLocaleString("zh-CN")
                              : "-"}
                          </td>
                          <td className="py-3 text-slate-300 text-sm max-w-xs">
                            {user.kycStatus === "rejected" ? (
                              user.kycRejectionReason ? (
                                <span className="text-red-300" title={user.kycRejectionReason}>
                                  {user.kycRejectionReason.length > 50
                                    ? user.kycRejectionReason.substring(0, 50) + "..."
                                    : user.kycRejectionReason}
                                </span>
                              ) : (
                                <span className="text-slate-500 italic">未提供原因</span>
                              )
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="py-3">
                            {user.isBlacklisted ? (
                              <span className="px-2 py-1 rounded text-sm font-medium bg-red-600 text-red-100">
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
                                  {reviewingWalletAddress === user.walletAddress ? (
                                    <span className="px-3 py-1 bg-slate-600 text-white text-sm font-medium rounded">
                                      同步中...
                                    </span>
                                  ) : (
                                    <>
                                      <TechButton
                                        onClick={() =>
                                          handleReviewKyc(user.walletAddress, "approved")
                                        }
                                        disabled={reviewingWalletAddress !== null}
                                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium"
                                      >
                                        通过
                                      </TechButton>
                                      <TechButton
                                        onClick={() => handleRejectClick(user.walletAddress)}
                                        disabled={reviewingWalletAddress !== null}
                                        className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium"
                                      >
                                        拒绝
                                      </TechButton>
                                    </>
                                  )}
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
          </TechCard>

          {/* 黑名单管理 */}
          <TechCard className="px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">黑名单管理</h2>
                <TechButton
                  onClick={() => setShowAddBlacklist(!showAddBlacklist)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-base font-medium"
                >
                  {showAddBlacklist ? "取消" : "+ 添加黑名单"}
                </TechButton>
              </div>

              {showAddBlacklist && (
                <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-base font-medium mb-2">
                        钱包地址
                      </label>
                      <input
                        type="text"
                        value={newBlacklistAddress}
                        onChange={(e) => setNewBlacklistAddress(e.target.value)}
                        placeholder="0x..."
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-base text-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-base font-medium mb-2">
                        原因（可选）
                      </label>
                      <input
                        type="text"
                        value={newBlacklistReason}
                        onChange={(e) => setNewBlacklistReason(e.target.value)}
                        placeholder="请输入加入黑名单的原因"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-base text-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <TechButton
                      onClick={handleAddToBlacklist}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-base font-medium"
                    >
                      确认添加
                    </TechButton>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-full text-base">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700/60">
                      <th className="py-3 text-left font-medium">钱包地址</th>
                      <th className="py-3 text-left font-medium">原因</th>
                      <th className="py-3 text-left font-medium">添加时间</th>
                      <th className="py-3 text-right font-medium">操作</th>
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
                          <td className="py-3 font-mono text-sm">
                            {entry.walletAddress}
                          </td>
                          <td className="py-3 text-slate-400">
                            {entry.reason || "-"}
                          </td>
                          <td className="py-3 text-slate-400 text-sm">
                            {new Date(entry.createdAt).toLocaleString("zh-CN")}
                          </td>
                          <td className="py-3 text-right">
                            <TechButton
                              onClick={() =>
                                handleRemoveFromBlacklist(entry.walletAddress)
                              }
                              className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium"
                            >
                              移除
                            </TechButton>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
          </TechCard>
        </div>
      )}
    </PageContainer>
  );
}

