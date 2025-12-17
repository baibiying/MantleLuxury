"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type Asset = {
  id: string;
  assetType: string;
  brand: string;
  model: string;
  year: number | null;
  status: string;
  tokenAddress: string | null;
  submittedBy: string | null;
  createdAt: string;
  pricePerShare: string | null;
  totalSupply: string | null;
};

type AssetReview = {
  id: string;
  reviewerAddress: string;
  reviewStatus: string;
  reviewNotes: string | null;
  actionType: string | null;
  nextStep: string | null;
  createdAt: string;
  updatedAt: string;
};

type AssetDetail = {
  asset: any;
  reviews: AssetReview[];
};

type Stats = {
  total: number;
  registered: number;
  fundraising: number;
  funded: number;
  sold: number;
};

export default function AdminAssetsPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAsset, setSelectedAsset] = useState<AssetDetail | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("approved");
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionType, setActionType] = useState("initial_review");
  const [nextStep, setNextStep] = useState("");
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
    try {
      const res = await fetch(`${API_BASE}/api/admin/assets/stats`, {
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
        setError(null);
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
      const [assetsRes, statsRes] = await Promise.all([
        fetch(
          `${API_BASE}/api/admin/assets${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`,
          { headers }
        ),
        fetch(`${API_BASE}/api/admin/assets/stats`, { headers }),
      ]);

      if (!assetsRes.ok) throw new Error("Failed to load assets");
      if (!statsRes.ok) throw new Error("Failed to load stats");

      const assetsData = await assetsRes.json();
      const statsData = await statsRes.json();

      setAssets(assetsData);
      setStats(statsData);
    } catch (e: any) {
      setError(e.message ?? "加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  const loadAssetDetail = async (assetId: string) => {
    if (!address) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/assets/${assetId}`, {
        headers: {
          "X-Wallet-Address": address,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to load asset detail");
      }
      const data = await res.json();
      setSelectedAsset(data);
    } catch (e: any) {
      setError(e.message ?? "加载资产详情失败");
    }
  };

  const handleCreateReview = async () => {
    if (!address || !selectedAsset) return;
    if (!reviewStatus) {
      setError("请选择审核状态");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/admin/assets/${selectedAsset.asset.id}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Wallet-Address": address,
          },
          body: JSON.stringify({
            reviewStatus,
            reviewNotes: reviewNotes.trim() || null,
            actionType: actionType || null,
            nextStep: nextStep.trim() || null,
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "创建审核记录失败");
      }

      setSuccess("✅ 审核记录已创建");
      setTimeout(() => setSuccess(null), 3000);
      setShowReviewModal(false);
      setReviewNotes("");
      setNextStep("");
      loadAssetDetail(selectedAsset.asset.id);
      loadData();
    } catch (e: any) {
      setError(e.message ?? "创建审核记录失败");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      registered: "bg-slate-600 text-slate-200",
      fundraising: "bg-blue-600 text-blue-100",
      funded: "bg-emerald-600 text-emerald-100",
      sold: "bg-purple-600 text-purple-100",
    };
    const labels = {
      registered: "待认证",
      fundraising: "募集中",
      funded: "已满额",
      sold: "已售出",
    };
    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${styles[status as keyof typeof styles] || styles.registered}`}
      >
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getReviewStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-amber-600 text-amber-100",
      approved: "bg-emerald-600 text-emerald-100",
      rejected: "bg-red-600 text-red-100",
      needs_revision: "bg-orange-600 text-orange-100",
    };
    const labels = {
      pending: "待处理",
      approved: "已通过",
      rejected: "已拒绝",
      needs_revision: "需修改",
    };
    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}
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
              <h1 className="text-2xl font-semibold">资产审核后台</h1>
              <p className="text-sm text-slate-400 mt-1">
                管理资产提交和审核流程
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
            <h1 className="text-2xl font-semibold">资产审核后台</h1>
            <p className="text-sm text-slate-400 mt-1">
              管理资产提交和审核流程（仅管理员）
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
              <div className="grid gap-4 md:grid-cols-5">
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">总资产数</div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </div>
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">待认证</div>
                  <div className="text-2xl font-bold text-slate-400">{stats.registered}</div>
                </div>
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">募集中</div>
                  <div className="text-2xl font-bold text-blue-400">{stats.fundraising}</div>
                </div>
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">已满额</div>
                  <div className="text-2xl font-bold text-emerald-400">{stats.funded}</div>
                </div>
                <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-4 py-4">
                  <div className="text-xs text-slate-400 mb-1">已售出</div>
                  <div className="text-2xl font-bold text-purple-400">{stats.sold}</div>
                </div>
              </div>
            )}

            {/* 资产列表 */}
            <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">资产列表</h2>
                <div className="flex items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="all">全部状态</option>
                    <option value="registered">待认证</option>
                    <option value="fundraising">募集中</option>
                    <option value="funded">已满额</option>
                    <option value="sold">已售出</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700/60">
                      <th className="py-3 text-left font-normal">资产信息</th>
                      <th className="py-3 text-left font-normal">状态</th>
                      <th className="py-3 text-left font-normal">提交者</th>
                      <th className="py-3 text-left font-normal">合约地址</th>
                      <th className="py-3 text-left font-normal">提交时间</th>
                      <th className="py-3 text-right font-normal">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          暂无资产数据
                        </td>
                      </tr>
                    ) : (
                      assets.map((asset) => (
                        <tr
                          key={asset.id}
                          className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/20"
                        >
                          <td className="py-3">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {asset.brand} {asset.model}
                              </span>
                              <span className="text-xs text-slate-500 mt-1">
                                {asset.assetType === "watch" ? "名表" : "珠宝"} ·{" "}
                                {asset.year ?? "年份未知"}
                              </span>
                            </div>
                          </td>
                          <td className="py-3">{getStatusBadge(asset.status)}</td>
                          <td className="py-3 font-mono text-xs">
                            {asset.submittedBy || "-"}
                          </td>
                          <td className="py-3 font-mono text-xs">
                            {asset.tokenAddress ? (
                              <a
                                href={`https://explorer.sepolia.mantle.xyz/address/${asset.tokenAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-400 hover:text-sky-300"
                              >
                                {asset.tokenAddress.substring(0, 10)}...
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-3 text-slate-400 text-xs">
                            {new Date(asset.createdAt).toLocaleString("zh-CN")}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => loadAssetDetail(asset.id)}
                              className="px-3 py-1 bg-sky-600 hover:bg-sky-700 rounded text-white text-xs font-medium transition-colors"
                            >
                              查看详情
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 资产详情模态框 */}
            {selectedAsset && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">资产详情</h2>
                      <button
                        onClick={() => {
                          setSelectedAsset(null);
                          setShowReviewModal(false);
                        }}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        ✕
                      </button>
                    </div>

                    {/* 资产基本信息 */}
                    <div className="mb-6 p-4 bg-slate-800/50 rounded-lg">
                      <h3 className="font-semibold mb-3">基本信息</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">品牌：</span>
                          <span className="ml-2">{selectedAsset.asset.brand}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">型号：</span>
                          <span className="ml-2">{selectedAsset.asset.model}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">类型：</span>
                          <span className="ml-2">
                            {selectedAsset.asset.assetType === "watch" ? "名表" : "珠宝"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">年份：</span>
                          <span className="ml-2">{selectedAsset.asset.year ?? "-"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">状态：</span>
                          <span className="ml-2">{getStatusBadge(selectedAsset.asset.status)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">合约地址：</span>
                          <span className="ml-2 font-mono text-xs">
                            {selectedAsset.asset.tokenAddress || "-"}
                          </span>
                        </div>
                      </div>
                      {selectedAsset.asset.description && (
                        <div className="mt-4">
                          <span className="text-slate-400">描述：</span>
                          <p className="mt-1 text-slate-300">{selectedAsset.asset.description}</p>
                        </div>
                      )}
                    </div>

                    {/* 审核记录 */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">审核记录</h3>
                        <button
                          onClick={() => setShowReviewModal(true)}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg text-white text-sm font-medium transition-colors"
                        >
                          + 添加审核记录
                        </button>
                      </div>
                      {selectedAsset.reviews.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-sm">
                          暂无审核记录
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedAsset.reviews.map((review) => (
                            <div
                              key={review.id}
                              className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  {getReviewStatusBadge(review.reviewStatus)}
                                  {review.actionType && (
                                    <span className="text-xs text-slate-400">
                                      {review.actionType}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-slate-400">
                                  {new Date(review.createdAt).toLocaleString("zh-CN")}
                                </span>
                              </div>
                              {review.reviewNotes && (
                                <p className="text-sm text-slate-300 mt-2">
                                  {review.reviewNotes}
                                </p>
                              )}
                              {review.nextStep && (
                                <p className="text-xs text-slate-400 mt-2">
                                  下一步：{review.nextStep}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 mt-2">
                                审核人：{review.reviewerAddress}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-3">
                      <Link
                        href={`/assets/${selectedAsset.asset.id}`}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-colors"
                      >
                        查看前端页面
                      </Link>
                      {selectedAsset.asset.authentications && selectedAsset.asset.authentications.length > 0 && (
                        <div className="px-4 py-2 bg-slate-700/50 rounded-lg text-sm text-slate-300">
                          认证记录：{selectedAsset.asset.authentications.length} 条
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 添加审核记录模态框 */}
            {showReviewModal && selectedAsset && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">添加审核记录</h2>
                    <button
                      onClick={() => setShowReviewModal(false)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        审核状态 *
                      </label>
                      <select
                        value={reviewStatus}
                        onChange={(e) => setReviewStatus(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="approved">已通过</option>
                        <option value="rejected">已拒绝</option>
                        <option value="needs_revision">需修改</option>
                        <option value="pending">待处理</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        操作类型
                      </label>
                      <select
                        value={actionType}
                        onChange={(e) => setActionType(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="initial_review">初始审核</option>
                        <option value="authentication_review">认证审核</option>
                        <option value="custody_review">托管审核</option>
                        <option value="insurance_review">保险审核</option>
                        <option value="final_approval">最终批准</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        审核备注
                      </label>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="请输入审核备注..."
                        rows={4}
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        下一步操作建议
                      </label>
                      <input
                        type="text"
                        value={nextStep}
                        onChange={(e) => setNextStep(e.target.value)}
                        placeholder="例如：需要补充认证报告"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleCreateReview}
                        className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg text-white font-medium transition-colors"
                      >
                        提交审核记录
                      </button>
                      <button
                        onClick={() => setShowReviewModal(false)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

