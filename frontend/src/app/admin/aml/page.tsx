"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import PageContainer from "@/components/PageContainer";
import TechCard from "@/components/TechCard";
import TechButton from "@/components/TechButton";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type AmlAlert = {
  id: string;
  walletAddress: string;
  alertType: string;
  riskLevel: string;
  source: string | null;
  message: string | null;
  status: "open" | "in_review" | "resolved" | "ignored";
  createdAt: string;
  updatedAt: string;
  handledBy: string | null;
  handledAt: string | null;
  handleNotes: string | null;
};

export default function AdminAmlPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [alerts, setAlerts] = useState<AmlAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [selectedAlert, setSelectedAlert] = useState<AmlAlert | null>(null);
  const [handleStatus, setHandleStatus] = useState<"open" | "in_review" | "resolved" | "ignored">("in_review");
  const [handleNotes, setHandleNotes] = useState("");

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
      loadAlerts();
    }
  }, [mounted, isAdmin, statusFilter]);

  const checkAdminStatus = async () => {
    if (!address) {
      setIsAdmin(false);
      return;
    }
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
          } catch {
            const text = await res.text();
            setError(text || "无权限访问管理后台");
          }
        }
      } else {
        setError(null);
      }
    } catch (e: any) {
      setIsAdmin(false);
      setError("检查管理员权限失败: " + (e.message || "网络错误"));
    }
  };

  const loadAlerts = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const headers = {
        "X-Wallet-Address": address,
      };
      const res = await fetch(
        `${API_BASE}/api/admin/aml-alerts${
          statusFilter !== "all" ? `?status=${statusFilter}` : ""
        }`,
        { headers }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "加载告警失败");
      }
      const data: AmlAlert[] = await res.json();
      setAlerts(data);
    } catch (e: any) {
      setError(e.message ?? "加载告警失败");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAlert = async () => {
    if (!address || !selectedAlert) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/aml-alerts/${selectedAlert.id}/handle`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Wallet-Address": address,
          },
          body: JSON.stringify({
            status: handleStatus,
            handleNotes: handleNotes.trim() || null,
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "更新告警状态失败");
      }
      setSuccess("✅ 告警状态已更新");
      setTimeout(() => setSuccess(null), 3000);
      setSelectedAlert(null);
      setHandleNotes("");
      await loadAlerts();
    } catch (e: any) {
      setError(e.message ?? "更新告警状态失败");
    }
  };

  const getRiskBadge = (level: string) => {
    const styles: Record<string, string> = {
      low: "bg-slate-600 text-slate-100",
      medium: "bg-amber-600 text-amber-100",
      high: "bg-red-600 text-red-100",
      critical: "bg-purple-700 text-purple-100",
    };
    const labels: Record<string, string> = {
      low: "低",
      medium: "中",
      high: "高",
      critical: "极高",
    };
    const cls = styles[level] ?? styles.medium;
    const label = labels[level] ?? level;
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${cls}`}>
        {label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: "bg-red-600 text-red-100",
      in_review: "bg-amber-600 text-amber-100",
      resolved: "bg-emerald-600 text-emerald-100",
      ignored: "bg-slate-600 text-slate-100",
    };
    const labels: Record<string, string> = {
      open: "未处理",
      in_review: "处理中",
      resolved: "已处置",
      ignored: "已忽略",
    };
    const cls = styles[status] ?? styles.open;
    const label = labels[status] ?? status;
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${cls}`}>
        {label}
      </span>
    );
  };

  if (!mounted) return null;

  if (isAdmin === false) {
    return (
      <PageContainer
        title="AML 告警管理"
        subtitle="查看并处理 AML 风控告警（仅管理员）"
        maxWidth="5xl"
      >
        <TechCard className="px-6 py-8 text-center">
          {!isConnected ? (
            <>
              <p className="text-lg font-semibold text-red-200 mb-2">
                请先连接钱包
              </p>
              <p className="text-sm text-slate-300">
                请在页面右上角连接钱包。管理后台仅限管理员访问
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-red-200 mb-2">
                无权限访问
              </p>
              <p className="text-sm text-slate-300">
                当前钱包地址不是管理员，无法访问 AML 告警后台
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
      title="AML 告警管理"
      subtitle="查看高风险地址与异常交易告警，并记录处理结果"
      maxWidth="5xl"
    >
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
          <p className="text-sm text-slate-300">正在加载告警数据...</p>
        </TechCard>
      ) : (
        <TechCard className="px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">告警列表</h2>
              <div className="flex items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="open">未处理</option>
                  <option value="in_review">处理中</option>
                  <option value="resolved">已处置</option>
                  <option value="ignored">已忽略</option>
                  <option value="all">全部状态</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700/60">
                    <th className="py-3 text-left font-normal">钱包地址</th>
                    <th className="py-3 text-left font-normal">风险等级</th>
                    <th className="py-3 text-left font-normal">类型</th>
                    <th className="py-3 text-left font-normal">来源</th>
                    <th className="py-3 text-left font-normal">状态</th>
                    <th className="py-3 text-left font-normal">创建时间</th>
                    <th className="py-3 text-right font-normal">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-slate-400"
                      >
                        当前没有符合筛选条件的告警
                      </td>
                    </tr>
                  ) : (
                    alerts.map((alert) => (
                      <tr
                        key={alert.id}
                        className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/20"
                      >
                        <td className="py-3 font-mono text-xs">
                          {alert.walletAddress}
                        </td>
                        <td className="py-3">{getRiskBadge(alert.riskLevel)}</td>
                        <td className="py-3 text-xs text-slate-300">
                          {alert.alertType === "blacklist_hit"
                            ? "黑名单命中"
                            : alert.alertType === "single_tx_limit"
                            ? "单笔金额超阈值"
                            : alert.alertType === "total_limit"
                            ? "累计金额超阈值"
                            : alert.alertType === "external_risk"
                            ? "外部风控告警"
                            : "手工录入"}
                        </td>
                        <td className="py-3 text-xs text-slate-400">
                          {alert.source || "internal_rule"}
                        </td>
                        <td className="py-3">{getStatusBadge(alert.status)}</td>
                        <td className="py-3 text-xs text-slate-400">
                          {new Date(alert.createdAt).toLocaleString("zh-CN")}
                        </td>
                        <td className="py-3 text-right">
                          <TechButton
                            onClick={() => {
                              setSelectedAlert(alert);
                              setHandleStatus(alert.status);
                              setHandleNotes(alert.handleNotes || "");
                            }}
                            className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium"
                          >
                            查看 / 处理
                          </TechButton>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TechCard>
        )}

        {/* 告警详情与处理模态框 */}
        {selectedAlert && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">告警详情</h2>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-slate-500 text-xs mb-1">钱包地址</div>
                  <div className="font-mono text-xs">
                    {selectedAlert.walletAddress}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-slate-500 text-xs mb-1">风险等级</div>
                    <div>{getRiskBadge(selectedAlert.riskLevel)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs mb-1">当前状态</div>
                    <div>{getStatusBadge(selectedAlert.status)}</div>
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-1">告警类型</div>
                  <div className="text-slate-300 text-xs">
                    {selectedAlert.alertType === "blacklist_hit"
                      ? "黑名单命中"
                      : selectedAlert.alertType === "single_tx_limit"
                      ? "单笔金额超阈值"
                      : selectedAlert.alertType === "total_limit"
                      ? "累计金额超阈值"
                      : selectedAlert.alertType === "external_risk"
                      ? "外部风控告警"
                      : "手工录入"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-1">来源</div>
                  <div className="text-slate-300 text-xs">
                    {selectedAlert.source || "internal_rule"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-1">告警信息</div>
                  <div className="text-slate-300 whitespace-pre-line">
                    {selectedAlert.message || "-"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-slate-500 text-xs mb-1">创建时间</div>
                    <div className="text-slate-300 text-xs">
                      {new Date(selectedAlert.createdAt).toLocaleString(
                        "zh-CN"
                      )}
                    </div>
                  </div>
                  {selectedAlert.handledAt && (
                    <div>
                      <div className="text-slate-500 text-xs mb-1">
                        处理时间
                      </div>
                      <div className="text-slate-300 text-xs">
                        {new Date(selectedAlert.handledAt).toLocaleString(
                          "zh-CN"
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {selectedAlert.handledBy && (
                  <div>
                    <div className="text-slate-500 text-xs mb-1">处理人</div>
                    <div className="text-slate-300 text-xs font-mono">
                      {selectedAlert.handledBy}
                    </div>
                  </div>
                )}
                {selectedAlert.handleNotes && (
                  <div>
                    <div className="text-slate-500 text-xs mb-1">历史备注</div>
                    <div className="text-slate-300 text-xs whitespace-pre-line">
                      {selectedAlert.handleNotes}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                  <h3 className="text-sm font-semibold">更新告警状态</h3>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      状态
                    </label>
                    <select
                      value={handleStatus}
                      onChange={(e) =>
                        setHandleStatus(
                          e.target.value as
                            | "open"
                            | "in_review"
                            | "resolved"
                            | "ignored"
                        )
                      }
                      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="open">未处理</option>
                      <option value="in_review">处理中</option>
                      <option value="resolved">已处置</option>
                      <option value="ignored">已忽略</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      处理备注
                    </label>
                    <textarea
                      value={handleNotes}
                      onChange={(e) => setHandleNotes(e.target.value)}
                      rows={3}
                      placeholder="例如：已联系用户补充资料 / 已确认为高风险地址并加入黑名单等"
                      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <TechButton
                      onClick={handleUpdateAlert}
                      className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm"
                    >
                      保存处理结果
                    </TechButton>
                    <TechButton
                      onClick={() => setSelectedAlert(null)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm"
                    >
                      取消
                    </TechButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </PageContainer>
  );
}




