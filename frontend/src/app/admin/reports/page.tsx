"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import PageContainer from "@/components/PageContainer";
import TechCard from "@/components/TechCard";
import TechButton from "@/components/TechButton";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export default function AdminReportsPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [assetId, setAssetId] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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
        } catch {
          const text = await res.text();
          setError(text || "无权限访问管理后台");
        }
      } else {
        setError(null);
      }
    } catch (e: any) {
      setIsAdmin(false);
      setError("检查管理员权限失败: " + (e.message || "网络错误"));
    }
  };

  const download = async (url: string, filename: string) => {
    try {
      const res = await fetch(url, {
        headers: {
          "X-Wallet-Address": address ?? "",
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "导出失败");
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e: any) {
      setError(e.message ?? "导出失败");
    }
  };

  if (!mounted) return null;

  if (isAdmin === false) {
    return (
      <PageContainer
        title="报表与导出"
        subtitle="仅管理员可访问的合规与运营报表导出"
        maxWidth="5xl"
      >
        <TechCard className="px-6 py-8 text-center">
          {!isConnected ? (
            <>
              <p className="text-lg font-semibold text-red-200 mb-2">
                请先连接钱包
              </p>
              <p className="text-sm text-slate-300">
                请在页面右上角连接钱包。报表后台仅限管理员访问
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-red-200 mb-2">
                无权限访问
              </p>
              <p className="text-sm text-slate-300">
                当前钱包地址不是管理员，无法访问报表后台
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
      title="报表与导出"
      subtitle="导出资产级与用户级 CSV 报表（仅管理员）"
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

      <div className="grid gap-6 md:grid-cols-2">
          {/* 资产级报表 */}
          <TechCard className="px-6 py-6">
            <h2 className="text-lg font-semibold mb-3">资产级收益与投资报表</h2>
            <p className="text-sm text-slate-400 mb-4">
              按资产导出该资产的募集、投资和收益分配情况（CSV），用于审计与合规记录。
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">
                  资产 ID (UUID)
                </label>
                <input
                  type="text"
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  placeholder="例如：从资产审核后台复制的 ID"
                  className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                />
              </div>
              <TechButton
                onClick={() =>
                  assetId.trim() &&
                  download(
                    `${API_BASE}/api/admin/reports/asset/${assetId.trim()}/yields.csv`,
                    `asset-yields-${assetId.trim()}.csv`
                  )
                }
                disabled={!assetId.trim()}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium"
              >
                导出资产报表 CSV
              </TechButton>
            </div>
          </TechCard>

          {/* 用户级报表 */}
          <TechCard className="px-6 py-6">
            <h2 className="text-lg font-semibold mb-3">用户级交易与收益报表</h2>
            <p className="text-sm text-slate-400 mb-4">
              按钱包地址导出用户的投资记录与相关收益分配信息，支持按日期区间过滤。
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">
                  用户钱包地址
                </label>
                <input
                  type="text"
                  value={userAddress}
                  onChange={(e) => setUserAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    起始日期（可选）
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    结束日期（可选）
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
              <TechButton
                onClick={() => {
                  if (!userAddress.trim()) return;
                  const params = new URLSearchParams();
                  if (fromDate) params.append("from", fromDate);
                  if (toDate) params.append("to", toDate);
                  const qs = params.toString();
                  download(
                    `${API_BASE}/api/admin/reports/user/${userAddress.trim()}/activity.csv${
                      qs ? `?${qs}` : ""
                    }`,
                    `user-activity-${userAddress.trim()}.csv`
                  );
                }}
                disabled={!userAddress.trim()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium"
              >
                导出用户报表 CSV
              </TechButton>
            </div>
          </TechCard>
        </div>
    </PageContainer>
  );
}




