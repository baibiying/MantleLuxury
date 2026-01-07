"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";
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

type AssetAuthentication = {
  id: string;
  assetId: string;
  authenticationStatus: string;
  authenticatorName: string;
  authenticatorType: string;
  verificationDate: string | null;
  reportUrl: string | null;
  reportHash: string | null;
  verifierSignature: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Valuation = {
  id: string;
  assetId: string;
  valuationAmount: string;
  valuationCurrency: string;
  valuationDate: string | null;
  valuationAgency: string | null;
  reportUrl: string | null;
  createdAt: string;
};

type Custody = {
  id: string;
  assetId: string;
  custodyStatus: string;
  custodyOrganization: string;
  warehouseLocation: string | null;
  warehouseAddressHash: string | null;
  entryDate: string | null;
  custodyContractUrl: string | null;
  custodyContractHash: string | null;
  facilityStandards: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Insurance = {
  id: string;
  assetId: string;
  insuranceCompany: string;
  policyNumber: string | null;
  coverageAmount: string;
  coverageCurrency: string;
  policyStartDate: string;
  policyEndDate: string;
  premiumAmount: string | null;
  coverageType: string | null;
  policyDocumentUrl: string | null;
  policyDocumentHash: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type AssetDetail = {
  asset: any;
  reviews: AssetReview[];
  authentications?: AssetAuthentication[];
  valuations?: Valuation[];
  custody?: Custody;
  insurance?: Insurance;
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

  // 资产真伪认证表单
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authType, setAuthType] = useState("third_party");
  const [authReportUrl, setAuthReportUrl] = useState("");
  const [authReportHash, setAuthReportHash] = useState("");
  const [authSignature, setAuthSignature] = useState("");
  const [authNotes, setAuthNotes] = useState("");

  // 估值报告表单
  const [showValuationModal, setShowValuationModal] = useState(false);
  const [valuationAmount, setValuationAmount] = useState("");
  const [valuationCurrency, setValuationCurrency] = useState("USD");
  const [valuationDate, setValuationDate] = useState("");
  const [valuationAgency, setValuationAgency] = useState("");
  const [valuationReportUrl, setValuationReportUrl] = useState("");

  // 托管表单
  const [showCustodyModal, setShowCustodyModal] = useState(false);
  const [custodyOrganization, setCustodyOrganization] = useState("");
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [warehouseAddressHash, setWarehouseAddressHash] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [custodyContractUrl, setCustodyContractUrl] = useState("");
  const [custodyContractHash, setCustodyContractHash] = useState("");
  const [facilityStandards, setFacilityStandards] = useState("");
  const [custodyNotes, setCustodyNotes] = useState("");

  // 保险表单
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [insuranceCompany, setInsuranceCompany] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [coverageAmount, setCoverageAmount] = useState("");
  const [coverageCurrency, setCoverageCurrency] = useState("USD");
  const [policyStartDate, setPolicyStartDate] = useState("");
  const [policyEndDate, setPolicyEndDate] = useState("");
  const [premiumAmount, setPremiumAmount] = useState("");
  const [coverageType, setCoverageType] = useState("全险");
  const [policyDocumentUrl, setPolicyDocumentUrl] = useState("");
  const [policyDocumentHash, setPolicyDocumentHash] = useState("");
  const [insuranceNotes, setInsuranceNotes] = useState("");

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    // 创建或获取 Portal 容器
    if (typeof window !== "undefined") {
      let container = document.getElementById("modal-portal");
      if (!container) {
        container = document.createElement("div");
        container.id = "modal-portal";
        container.style.position = "fixed";
        container.style.top = "0";
        container.style.left = "0";
        container.style.width = "100%";
        container.style.height = "100%";
        container.style.zIndex = "99999";
        container.style.pointerEvents = "none";
        document.body.appendChild(container);
      }
      setPortalContainer(container);
    }
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
      console.log("Asset detail data:", data);
      console.log("Token address:", data?.asset?.tokenAddress);
      setSelectedAsset(data);
    } catch (e: any) {
      setError(e.message ?? "加载资产详情失败");
    }
  };

  const loadAuthentications = async (assetId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/asset-authentications/asset/${assetId}`);
      if (!res.ok) {
        return;
      }
      const data: AssetAuthentication[] = await res.json();
      setSelectedAsset((prev) =>
        prev
          ? {
              ...prev,
              authentications: data,
            }
          : prev
      );
    } catch {
      // ignore
    }
  };

  const loadValuations = async (assetId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/valuations/asset/${assetId}`, {
        headers: {
          "X-Wallet-Address": address || "",
        },
      });
      if (!res.ok) {
        return;
      }
      const data: Valuation[] = await res.json();
      setSelectedAsset((prev) =>
        prev
          ? {
              ...prev,
              valuations: data,
            }
          : prev
      );
    } catch {
      // ignore
    }
  };

  const loadCustody = async (assetId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/custodies/asset/${assetId}`);
      if (!res.ok) {
        return;
      }
      const data: Custody = await res.json();
      setSelectedAsset((prev) =>
        prev
          ? {
              ...prev,
              custody: data,
            }
          : prev
      );
    } catch {
      // ignore
    }
  };

  const loadInsurance = async (assetId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/insurances/asset/${assetId}`);
      if (!res.ok) {
        return;
      }
      const data: Insurance = await res.json();
      setSelectedAsset((prev) =>
        prev
          ? {
              ...prev,
              insurance: data,
            }
          : prev
      );
    } catch {
      // ignore
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
        throw new Error(text || "创建平台审核记录失败");
      }

      setSuccess("✅ 平台审核记录已创建");
      setTimeout(() => setSuccess(null), 3000);
      setShowReviewModal(false);
      setReviewNotes("");
      setNextStep("");
      await loadAssetDetail(selectedAsset.asset.id);
      await loadCustody(selectedAsset.asset.id);
      await loadInsurance(selectedAsset.asset.id);
      loadData();
    } catch (e: any) {
      setError(e.message ?? "创建平台审核记录失败");
    }
  };

  const handleCreateAuthentication = async () => {
    if (!selectedAsset) return;
    if (!authName.trim()) {
      setError("请输入鉴定机构名称");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/asset-authentications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId: selectedAsset.asset.id,
          authenticatorName: authName.trim(),
          authenticatorType: authType,
          reportUrl: authReportUrl.trim() || null,
          reportHash: authReportHash.trim() || null,
          verifierSignature: authSignature.trim() || null,
          notes: authNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "创建认证记录失败");
      }
      setSuccess("✅ 认证记录已创建（状态：待审核）");
      setTimeout(() => setSuccess(null), 3000);
      setShowAuthModal(false);
      setAuthName("");
      setAuthType("third_party");
      setAuthReportUrl("");
      setAuthReportHash("");
      setAuthSignature("");
      setAuthNotes("");
      await loadAuthentications(selectedAsset.asset.id);
    } catch (e: any) {
      setError(e.message ?? "创建认证记录失败");
    }
  };

  const handleReviewAuthentication = async (
    authenticationId: string,
    status: "verified" | "rejected"
  ) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/asset-authentications/${authenticationId}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            notes: null,
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "更新认证状态失败");
      }
      setSuccess(
        status === "verified" ? "✅ 认证已标记为通过" : "✅ 认证已标记为拒绝"
      );
      setTimeout(() => setSuccess(null), 3000);
      if (selectedAsset) {
        await Promise.all([
          loadAssetDetail(selectedAsset.asset.id),
          loadAuthentications(selectedAsset.asset.id),
          loadValuations(selectedAsset.asset.id),
          loadCustody(selectedAsset.asset.id),
          loadInsurance(selectedAsset.asset.id),
        ]);
      }
    } catch (e: any) {
      setError(e.message ?? "更新认证状态失败");
    }
  };

  const handleCreateValuation = async () => {
    if (!selectedAsset || !address) return;
    if (!valuationAmount.trim() || !valuationAgency.trim()) {
      setError("请输入估值金额和估值机构");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/valuations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wallet-Address": address,
        },
        body: JSON.stringify({
          assetId: selectedAsset.asset.id,
          valuationAmount: valuationAmount.trim(),
          valuationCurrency: valuationCurrency,
          valuationDate: valuationDate || null,
          valuationAgency: valuationAgency.trim(),
          reportUrl: valuationReportUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "创建估值记录失败");
      }
      setSuccess("✅ 估值记录已创建");
      setTimeout(() => setSuccess(null), 3000);
      setShowValuationModal(false);
      setValuationAmount("");
      setValuationCurrency("USD");
      setValuationDate("");
      setValuationAgency("");
      setValuationReportUrl("");
      await loadValuations(selectedAsset.asset.id);
    } catch (e: any) {
      setError(e.message ?? "创建估值记录失败");
    }
  };

  const handleDeleteValuation = async (valuationId: string) => {
    if (!address || !confirm("确定要删除这条估值记录吗？")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/valuations/${valuationId}`, {
        method: "DELETE",
        headers: {
          "X-Wallet-Address": address,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "删除估值记录失败");
      }
      setSuccess("✅ 估值记录已删除");
      setTimeout(() => setSuccess(null), 3000);
      if (selectedAsset) {
        await loadValuations(selectedAsset.asset.id);
      }
    } catch (e: any) {
      setError(e.message ?? "删除估值记录失败");
    }
  };

  const handleCreateCustody = async () => {
    if (!selectedAsset) return;
    if (!custodyOrganization.trim()) {
      setError("请输入托管机构名称");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/custodies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId: selectedAsset.asset.id,
          custodyOrganization: custodyOrganization.trim(),
          warehouseLocation: warehouseLocation.trim() || null,
          warehouseAddressHash: warehouseAddressHash.trim() || null,
          entryDate: entryDate || null,
          custodyContractUrl: custodyContractUrl.trim() || null,
          custodyContractHash: custodyContractHash.trim() || null,
          facilityStandards: facilityStandards.trim() || null,
          notes: custodyNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "创建托管记录失败");
      }
      setSuccess("✅ 托管记录已创建");
      setTimeout(() => setSuccess(null), 3000);
      setShowCustodyModal(false);
      setCustodyOrganization("");
      setWarehouseLocation("");
      setWarehouseAddressHash("");
      setEntryDate("");
      setCustodyContractUrl("");
      setCustodyContractHash("");
      setFacilityStandards("");
      setCustodyNotes("");
      await loadCustody(selectedAsset.asset.id);
    } catch (e: any) {
      setError(e.message ?? "创建托管记录失败");
    }
  };

  const handleCreateInsurance = async () => {
    console.log("handleCreateInsurance called");
    setError(null); // 清除之前的错误
    setSuccess(null); // 清除之前的成功消息
    if (!selectedAsset) {
      console.log("No selected asset");
      setError("请先选择资产");
      return;
    }
    if (!insuranceCompany.trim() || !coverageAmount.trim() || !policyEndDate) {
      console.log("Validation failed:", { insuranceCompany, coverageAmount, policyEndDate });
      setError("请输入保险公司、保额和到期日期");
      return;
    }
    try {
      console.log("Sending request to create insurance");
      const res = await fetch(`${API_BASE}/api/insurances`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId: selectedAsset.asset.id,
          insuranceCompany: insuranceCompany.trim(),
          policyNumber: policyNumber.trim() || null,
          coverageAmount: coverageAmount.trim(),
          coverageCurrency: coverageCurrency,
          policyStartDate: policyStartDate || null,
          policyEndDate: policyEndDate,
          premiumAmount: premiumAmount.trim() || null,
          coverageType: coverageType || "全险",
          policyDocumentUrl: policyDocumentUrl.trim() || null,
          policyDocumentHash: policyDocumentHash.trim() || null,
          notes: insuranceNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Insurance creation failed:", res.status, text);
        throw new Error(text || "创建保险记录失败");
      }
      const data = await res.json();
      console.log("Insurance created successfully:", data);
      setSuccess("✅ 保险记录已创建");
      setTimeout(() => setSuccess(null), 3000);
      setShowInsuranceModal(false);
      setInsuranceCompany("");
      setPolicyNumber("");
      setCoverageAmount("");
      setCoverageCurrency("USD");
      setPolicyStartDate("");
      setPolicyEndDate("");
      setPremiumAmount("");
      setCoverageType("全险");
      setPolicyDocumentUrl("");
      setPolicyDocumentHash("");
      setInsuranceNotes("");
      await loadInsurance(selectedAsset.asset.id);
    } catch (e: any) {
      console.error("Error creating insurance:", e);
      setError(e.message ?? "创建保险记录失败");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      registered: "bg-slate-600 text-white",
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
        className={`px-2 py-1 rounded text-sm font-medium ${styles[status as keyof typeof styles] || styles.registered}`}
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
        className={`px-2 py-1 rounded text-sm font-medium ${styles[status as keyof typeof styles] || styles.pending}`}
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
        title="资产审核后台"
        subtitle="管理资产提交和审核流程"
        maxWidth="5xl"
      >
        <TechCard className="px-6 py-8 text-center">
          {!isConnected ? (
            <>
              <p className="text-lg font-semibold text-red-200 mb-2">
                请先连接钱包
              </p>
              <p className="text-base text-slate-300">
                请在页面右上角连接钱包。管理后台仅限管理员访问
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-red-200 mb-2">
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
      title="资产审核后台"
      subtitle="管理资产提交和审核流程（仅管理员）"
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

      {loading ? (
        <TechCard className="px-6 py-8 text-center">
          <p className="text-base text-slate-300">正在加载数据...</p>
        </TechCard>
      ) : (
        <div className="space-y-6">
            {/* 统计信息 */}
            {stats && (
              <div className="grid gap-4 md:grid-cols-5">
                <TechCard className="px-4 py-4">
                  <div className="text-sm text-slate-300 mb-1">总资产数</div>
                  <div className="text-3xl font-bold">{stats.total}</div>
                </TechCard>
                <TechCard className="px-4 py-4">
                  <div className="text-sm text-slate-300 mb-1">待认证</div>
                  <div className="text-3xl font-bold text-slate-300">{stats.registered}</div>
                </TechCard>
                <TechCard className="px-4 py-4">
                  <div className="text-sm text-slate-300 mb-1">募集中</div>
                  <div className="text-3xl font-bold text-blue-400">{stats.fundraising}</div>
                </TechCard>
                <TechCard className="px-4 py-4">
                  <div className="text-sm text-slate-300 mb-1">已满额</div>
                  <div className="text-3xl font-bold text-emerald-400">{stats.funded}</div>
                </TechCard>
                <TechCard className="px-4 py-4">
                  <div className="text-sm text-slate-300 mb-1">已售出</div>
                  <div className="text-3xl font-bold text-purple-400">{stats.sold}</div>
                </TechCard>
              </div>
            )}

            {/* 资产列表 */}
            <TechCard className="px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">资产列表</h2>
                <div className="flex items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 text-base focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                <table className="w-full text-lg">
                  <thead>
                    <tr className="text-slate-300 border-b border-slate-700/60">
                      <th className="py-3 text-left font-normal min-w-[280px]">资产信息</th>
                      <th className="py-3 text-left font-normal min-w-[100px]">状态</th>
                      <th className="py-3 text-left font-normal min-w-[200px]">提交者</th>
                      <th className="py-3 text-left font-normal min-w-[200px]">合约地址</th>
                      <th className="py-3 text-left font-normal min-w-[180px]">提交时间</th>
                      <th className="py-3 text-right font-normal min-w-[120px]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-300">
                          暂无资产数据
                        </td>
                      </tr>
                    ) : (
                      assets.map((asset) => (
                        <tr
                          key={asset.id}
                          className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/20 cursor-pointer"
                              onClick={async () => {
                                await loadAssetDetail(asset.id);
                                await loadAuthentications(asset.id);
                                await loadValuations(asset.id);
                                await loadCustody(asset.id);
                                await loadInsurance(asset.id);
                              }}
                        >
                          <td className="py-3 min-w-[280px]">
                            <div className="flex flex-col">
                              <span className="font-medium break-words">
                                {asset.brand} {asset.model}
                              </span>
                              <span className="text-base text-slate-300 mt-1">
                                {asset.assetType === "watch" ? "名表" : "珠宝"} ·{" "}
                                {asset.year ?? "年份未知"}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 min-w-[100px]">{getStatusBadge(asset.status)}</td>
                          <td className="py-3 font-mono text-base min-w-[200px] break-all">
                            {asset.submittedBy || "-"}
                          </td>
                          <td className="py-3 font-mono text-base min-w-[200px] break-all">
                            {asset.tokenAddress ? (
                              <a
                                href={`https://explorer.sepolia.mantle.xyz/address/${asset.tokenAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 break-all"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {asset.tokenAddress}
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-3 text-slate-300 text-base min-w-[180px] whitespace-nowrap">
                            {new Date(asset.createdAt).toLocaleString("zh-CN")}
                          </td>
                          <td className="py-3 text-right min-w-[120px]">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await loadAssetDetail(asset.id);
                                await loadAuthentications(asset.id);
                                await loadValuations(asset.id);
                              }}
                              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg text-white text-base font-medium transition-colors whitespace-nowrap shadow-lg shadow-sky-500/20"
                            >
                              📋 查看详情
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TechCard>

            {/* 资产详情模态框 - 使用 Portal 渲染到最顶层 */}
            {selectedAsset && portalContainer && createPortal(
              <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4" 
                style={{ 
                  paddingTop: '120px',
                  zIndex: 99999,
                  pointerEvents: 'auto'
                }}
                onClick={(e) => {
                  // 点击背景关闭模态框
                  if (e.target === e.currentTarget) {
                    setSelectedAsset(null);
                    setShowReviewModal(false);
                  }
                }}
              >
                <div 
                  className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[calc(100vh-140px)] overflow-hidden flex flex-col shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 固定标题栏 */}
                  <div className="flex items-center justify-between p-6 border-b border-slate-700 flex-shrink-0 bg-slate-900 sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                      <h2 className="text-2xl font-semibold text-white">资产详情</h2>
                      <Link
                        href={`/assets/${selectedAsset.asset.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 text-sm font-medium underline flex items-center gap-1 transition-colors"
                      >
                        <span>查看用户端页面</span>
                        <span>→</span>
                      </Link>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedAsset(null);
                        setShowReviewModal(false);
                      }}
                      className="text-slate-300 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-slate-800 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  {/* 可滚动内容区域 */}
                  <div className="overflow-y-auto flex-1">
                    <div className="p-6">

                    {/* 资产基本信息 */}
                    <div className="mb-6 p-4 bg-slate-800/50 rounded-lg">
                      <h3 className="font-semibold mb-3 text-white">基本信息</h3>
                      <div className="grid grid-cols-2 gap-4 text-base">
                        <div>
                          <span className="text-slate-300">品牌：</span>
                          <span className="ml-2 text-white font-medium">{selectedAsset.asset.brand}</span>
                        </div>
                        <div>
                          <span className="text-slate-300">型号：</span>
                          <span className="ml-2 text-white font-medium">{selectedAsset.asset.model}</span>
                        </div>
                        <div>
                          <span className="text-slate-300">类型：</span>
                          <span className="ml-2 text-white font-medium">
                            {selectedAsset.asset.assetType === "watch" ? "名表" : "珠宝"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-300">年份：</span>
                          <span className="ml-2 text-white font-medium">{selectedAsset.asset.year ?? "-"}</span>
                        </div>
                        <div>
                          <span className="text-slate-300">状态：</span>
                          <span className="ml-2">{getStatusBadge(selectedAsset.asset.status)}</span>
                          <select
                            value={selectedAsset.asset.status}
                            onChange={async (e) => {
                              if (!address || !selectedAsset) return;
                              const newStatus = e.target.value;
                              if (!confirm(`确定要将资产状态从 "${selectedAsset.asset.status}" 更改为 "${newStatus}" 吗？`)) {
                                return;
                              }
                              try {
                                const res = await fetch(
                                  `${API_BASE}/api/admin/assets/${selectedAsset.asset.id}/status`,
                                  {
                                    method: "PUT",
                                    headers: {
                                      "Content-Type": "application/json",
                                      "X-Wallet-Address": address,
                                    },
                                    body: JSON.stringify({ status: newStatus }),
                                  }
                                );
                                if (!res.ok) {
                                  const text = await res.text();
                                  throw new Error(text || "更新资产状态失败");
                                }
                                setSuccess(`✅ 资产状态已更新为 "${newStatus}"`);
                                setTimeout(() => setSuccess(null), 3000);
      await loadAssetDetail(selectedAsset.asset.id);
      await loadCustody(selectedAsset.asset.id);
      await loadInsurance(selectedAsset.asset.id);
      loadData();
                              } catch (e: any) {
                                setError(e.message ?? "更新资产状态失败");
                              }
                            }}
                            className="ml-3 px-3 py-1 bg-slate-700 border border-slate-600 rounded text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            <option value="registered">待认证</option>
                            <option value="fundraising">募集中</option>
                            <option value="funded">已满额</option>
                            <option value="sold">已售出</option>
                          </select>
                        </div>
                        <div>
                          <span className="text-slate-300">合约地址：</span>
                          <span className="ml-2 font-mono text-sm text-cyan-300">
                            {selectedAsset.asset?.tokenAddress || selectedAsset.asset?.token_address || "-"}
                          </span>
                          {selectedAsset.asset?.tokenAddress && (
                            <a
                              href={`https://explorer.sepolia.mantle.xyz/address/${selectedAsset.asset.tokenAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-cyan-400 hover:text-cyan-300 text-sm underline"
                            >
                              查看 →
                            </a>
                          )}
                        </div>
                      </div>
                      {selectedAsset.asset.description && (
                        <div className="mt-4">
                          <span className="text-slate-300">描述：</span>
                          <p className="mt-1 text-slate-300">{selectedAsset.asset.description}</p>
                        </div>
                      )}
                    </div>

                    {/* 平台审核记录 */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">平台审核记录</h3>
                        <button
                          onClick={() => setShowReviewModal(true)}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg text-white text-base font-medium transition-colors"
                        >
                          + 添加平台审核记录
                        </button>
                      </div>
                      {selectedAsset.reviews.length === 0 ? (
                        <div className="text-center py-8 text-slate-300 text-base">
                          暂无平台审核记录
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
                                    <span className="text-sm text-white">
                                      {review.actionType}
                                    </span>
                                  )}
                                </div>
                                <span className="text-sm text-white">
                                  {new Date(review.createdAt).toLocaleString("zh-CN")}
                                </span>
                              </div>
                              {review.reviewNotes && (
                                <p className="text-base text-white mt-2 leading-relaxed">
                                  {review.reviewNotes}
                                </p>
                              )}
                              {review.nextStep && (
                                <p className="text-sm text-white mt-2">
                                  下一步：{review.nextStep}
                                </p>
                              )}
                              <p className="text-sm text-white mt-2">
                                审核人：<span className="font-mono text-cyan-300">{review.reviewerAddress}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 真伪认证记录 */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">真伪认证记录</h3>
                        <button
                          onClick={() => {
                            setShowAuthModal(true);
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white text-base font-medium transition-colors"
                        >
                          + 添加认证记录
                        </button>
                      </div>
                      {!selectedAsset.authentications ||
                      selectedAsset.authentications.length === 0 ? (
                        <div className="text-center py-6 text-slate-300 text-base">
                          暂无认证记录
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedAsset.authentications.map((auth) => (
                            <div
                              key={auth.id}
                              className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="text-base font-medium text-white">
                                    {auth.authenticatorName}
                                  </div>
                                  <div className="text-sm text-slate-300 mt-1">
                                    {auth.authenticatorType === "official_brand"
                                      ? "官方品牌认证"
                                      : auth.authenticatorType === "third_party"
                                      ? "第三方机构认证"
                                      : "AI 系统认证"}
                                  </div>
                                  {auth.verificationDate && (
                                    <div className="text-sm text-slate-300 mt-1">
                                      鉴定日期：
                                      {new Date(
                                        auth.verificationDate
                                      ).toLocaleDateString("zh-CN")}
                                    </div>
                                  )}
                                  {auth.reportUrl && (
                                    <a
                                      href={auth.reportUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-cyan-400 hover:text-cyan-300 mt-1 inline-block font-medium"
                                    >
                                      查看认证报告 →
                                    </a>
                                  )}
                                  {auth.reportHash && (
                                    <div className="text-sm text-slate-300 mt-1 font-mono text-cyan-300">
                                      报告哈希：
                                      {auth.reportHash.slice(0, 18)}...
                                    </div>
                                  )}
                                  {auth.notes && (
                                    <div className="text-sm text-white mt-1 whitespace-pre-line leading-relaxed">
                                      备注：{auth.notes}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span
                                    className={`inline-block mb-2 text-sm rounded-full px-2 py-1 border ${
                                      auth.authenticationStatus === "verified"
                                        ? "border-emerald-400/60 text-emerald-200 bg-emerald-500/10"
                                        : auth.authenticationStatus ===
                                          "rejected"
                                        ? "border-red-400/60 text-red-200 bg-red-500/10"
                                        : "border-amber-400/60 text-amber-200 bg-amber-500/10"
                                    }`}
                                  >
                                    {auth.authenticationStatus === "verified"
                                      ? "已认证"
                                      : auth.authenticationStatus ===
                                        "rejected"
                                      ? "已拒绝"
                                      : "待审核"}
                                  </span>
                                  <div className="flex flex-col gap-1">
                                    <button
                                      onClick={() =>
                                        handleReviewAuthentication(
                                          auth.id,
                                          "verified"
                                        )
                                      }
                                      disabled={
                                        auth.authenticationStatus === "verified"
                                      }
                                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-300 rounded text-white text-sm font-medium transition-colors"
                                    >
                                      标记为通过
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleReviewAuthentication(
                                          auth.id,
                                          "rejected"
                                        )
                                      }
                                      disabled={
                                        auth.authenticationStatus === "rejected"
                                      }
                                      className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-300 rounded text-white text-sm font-medium transition-colors"
                                    >
                                      标记为拒绝
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 估值报告记录 */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">估值报告记录</h3>
                        <button
                          onClick={() => {
                            setShowValuationModal(true);
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white text-base font-medium transition-colors"
                        >
                          + 添加估值报告
                        </button>
                      </div>
                      {!selectedAsset.valuations ||
                      selectedAsset.valuations.length === 0 ? (
                        <div className="text-center py-6 text-slate-300 text-base">
                          暂无估值报告
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedAsset.valuations.map((valuation) => (
                            <div
                              key={valuation.id}
                              className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="text-base font-medium text-white">
                                    {valuation.valuationAgency || "估值机构"}
                                  </div>
                                  {valuation.valuationDate && (
                                    <div className="text-sm text-slate-300 mt-1">
                                      估值日期：
                                      {new Date(
                                        valuation.valuationDate
                                      ).toLocaleDateString("zh-CN")}
                                    </div>
                                  )}
                                  {valuation.reportUrl && (
                                    <a
                                      href={valuation.reportUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-cyan-400 hover:text-cyan-300 mt-1 inline-block"
                                    >
                                      查看估值报告 →
                                    </a>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-xl font-semibold text-emerald-400 mb-2">
                                    {parseFloat(valuation.valuationAmount).toLocaleString("zh-CN", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{" "}
                                    {valuation.valuationCurrency || "USD"}
                                  </div>
                                  <button
                                    onClick={() =>
                                      handleDeleteValuation(valuation.id)
                                    }
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium transition-colors"
                                  >
                                    删除
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 托管信息 */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">托管信息</h3>
                        <button
                          onClick={() => {
                            setShowCustodyModal(true);
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white text-base font-medium transition-colors"
                        >
                          {selectedAsset.custody ? "编辑托管信息" : "+ 添加托管信息"}
                        </button>
                      </div>
                      {!selectedAsset.custody ? (
                        <div className="text-center py-6 text-slate-300 text-base">
                          暂无托管信息
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                          <div className="grid grid-cols-2 gap-4 text-base">
                            <div>
                              <span className="text-slate-300">托管机构：</span>
                              <span className="ml-2 text-white font-medium">{selectedAsset.custody.custodyOrganization}</span>
                            </div>
                            <div>
                              <span className="text-slate-300">托管状态：</span>
                              <span className="ml-2 text-white font-medium">{selectedAsset.custody.custodyStatus}</span>
                            </div>
                            {selectedAsset.custody.warehouseLocation && (
                              <div>
                                <span className="text-slate-300">仓储位置：</span>
                                <span className="ml-2 text-white font-medium">{selectedAsset.custody.warehouseLocation}</span>
                              </div>
                            )}
                            {selectedAsset.custody.entryDate && (
                              <div>
                                <span className="text-slate-300">入库日期：</span>
                                <span className="ml-2 text-white font-medium">
                                  {new Date(selectedAsset.custody.entryDate).toLocaleDateString("zh-CN")}
                                </span>
                              </div>
                            )}
                            {selectedAsset.custody.custodyContractUrl && (
                              <div className="col-span-2">
                                <span className="text-slate-300">托管合同：</span>
                                <a
                                  href={selectedAsset.custody.custodyContractUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 text-cyan-400 hover:text-cyan-300 underline"
                                >
                                  查看合同 →
                                </a>
                              </div>
                            )}
                            {selectedAsset.custody.facilityStandards && (
                              <div className="col-span-2">
                                <span className="text-slate-300">设施标准：</span>
                                <p className="mt-1 text-white">{selectedAsset.custody.facilityStandards}</p>
                              </div>
                            )}
                            {selectedAsset.custody.notes && (
                              <div className="col-span-2">
                                <span className="text-slate-300">备注：</span>
                                <p className="mt-1 text-white">{selectedAsset.custody.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 保险信息 */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">保险信息</h3>
                        <button
                          onClick={() => {
                            setShowInsuranceModal(true);
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white text-base font-medium transition-colors"
                        >
                          {selectedAsset.insurance ? "编辑保险信息" : "+ 添加保险信息"}
                        </button>
                      </div>
                      {!selectedAsset.insurance ? (
                        <div className="text-center py-6 text-slate-300 text-base">
                          暂无保险信息
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                          <div className="grid grid-cols-2 gap-4 text-base">
                            <div>
                              <span className="text-slate-300">保险公司：</span>
                              <span className="ml-2 text-white font-medium">{selectedAsset.insurance.insuranceCompany}</span>
                            </div>
                            {selectedAsset.insurance.policyNumber && (
                              <div>
                                <span className="text-slate-300">保单号：</span>
                                <span className="ml-2 text-white font-medium">{selectedAsset.insurance.policyNumber}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-slate-300">保额：</span>
                              <span className="ml-2 text-white font-medium text-emerald-400">
                                {parseFloat(selectedAsset.insurance.coverageAmount).toLocaleString("zh-CN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                {selectedAsset.insurance.coverageCurrency}
                              </span>
                            </div>
                            {selectedAsset.insurance.coverageType && (
                              <div>
                                <span className="text-slate-300">保险类型：</span>
                                <span className="ml-2 text-white font-medium">{selectedAsset.insurance.coverageType}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-slate-300">生效日期：</span>
                              <span className="ml-2 text-white font-medium">
                                {new Date(selectedAsset.insurance.policyStartDate).toLocaleDateString("zh-CN")}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-300">到期日期：</span>
                              <span className="ml-2 text-white font-medium">
                                {new Date(selectedAsset.insurance.policyEndDate).toLocaleDateString("zh-CN")}
                              </span>
                            </div>
                            {selectedAsset.insurance.policyDocumentUrl && (
                              <div className="col-span-2">
                                <span className="text-slate-300">保单文档：</span>
                                <a
                                  href={selectedAsset.insurance.policyDocumentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 text-cyan-400 hover:text-cyan-300 underline"
                                >
                                  查看保单 →
                                </a>
                              </div>
                            )}
                            <div className="col-span-2">
                              <span className="text-slate-300">保单状态：</span>
                              <span className={`ml-2 px-2 py-1 rounded text-sm font-medium ${
                                selectedAsset.insurance.isActive
                                  ? "bg-emerald-600 text-emerald-100"
                                  : "bg-red-600 text-red-100"
                              }`}>
                                {selectedAsset.insurance.isActive ? "有效" : "已失效"}
                              </span>
                            </div>
                            {selectedAsset.insurance.notes && (
                              <div className="col-span-2">
                                <span className="text-slate-300">备注：</span>
                                <p className="mt-1 text-white">{selectedAsset.insurance.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    {(() => {
                      const hasApprovedReview =
                        selectedAsset.reviews?.some(
                          (r) => r.reviewStatus === "approved"
                        ) ?? false;
                      const hasVerifiedAuth =
                        (selectedAsset.authentications ?? []).some(
                          (a) => a.authenticationStatus === "verified"
                        );
                      const hasValuation =
                        (selectedAsset.valuations ?? []).length > 0;
                      const hasCustody = !!selectedAsset.custody;
                      const hasInsurance = !!selectedAsset.insurance;

                      const canApprove =
                        hasApprovedReview &&
                        hasVerifiedAuth &&
                        hasValuation &&
                        hasCustody &&
                        hasInsurance;

                      const approveDisabledReason = !canApprove
                        ? [
                            !hasApprovedReview &&
                              "需要至少一条平台审核记录状态为“已通过”",
                            !hasVerifiedAuth &&
                              "需要至少一条真伪认证记录状态为“已认证”",
                            !hasValuation && "需要至少一条估值报告记录",
                            !hasCustody && "需要填写托管信息",
                            !hasInsurance && "需要填写保险信息",
                          ]
                            .filter(Boolean)
                            .join("；")
                        : "";

                      return (
                        <div className="flex gap-3 items-center flex-wrap">
                          {selectedAsset.asset.status === "registered" && (
                            <button
                              disabled={!canApprove}
                              title={
                                !canApprove
                                  ? approveDisabledReason ||
                                    "托管、保险、真伪认证、估值和平台审核记录都完成后才能审核通过并上线"
                                  : undefined
                              }
                              onClick={async () => {
                                if (!address || !selectedAsset || !canApprove)
                                  return;
                                if (
                                  !confirm(
                                    "确定要审核通过此资产并上线募资吗？\n\n资产状态将从'待认证'改为'募集中'，用户将可以投资此资产。"
                                  )
                                ) {
                                  return;
                                }
                                try {
                                  const res = await fetch(
                                    `${API_BASE}/api/admin/assets/${selectedAsset.asset.id}/status`,
                                    {
                                      method: "PUT",
                                      headers: {
                                        "Content-Type": "application/json",
                                        "X-Wallet-Address": address,
                                      },
                                      body: JSON.stringify({
                                        status: "fundraising",
                                      }),
                                    }
                                  );
                                  if (!res.ok) {
                                    const text = await res.text();
                                    throw new Error(
                                      text || "更新资产状态失败"
                                    );
                                  }
                                  setSuccess(
                                    "✅ 资产已审核通过，状态已更新为'募集中'"
                                  );
                                  setTimeout(() => setSuccess(null), 3000);
                                  await loadAssetDetail(
                                    selectedAsset.asset.id
                                  );
                                  await loadCustody(selectedAsset.asset.id);
                                  await loadInsurance(selectedAsset.asset.id);
                                  loadData();
                                } catch (e: any) {
                                  setError(
                                    e.message ?? "更新资产状态失败"
                                  );
                                }
                              }}
                              className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white text-base font-medium transition-colors ${
                                !canApprove
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              ✓ 审核通过并上线
                            </button>
                          )}
                          {selectedAsset.asset.authentications &&
                            selectedAsset.asset.authentications.length > 0 && (
                              <div className="px-4 py-2 bg-slate-700/50 rounded-lg text-base text-slate-300">
                                认证记录：
                                {selectedAsset.asset.authentications.length} 条
                              </div>
                            )}
                        </div>
                      );
                    })()}
                    </div>
                  </div>
                </div>
              </div>,
              portalContainer
            )}

            {/* 添加平台审核记录模态框 - 使用 Portal */}
            {showReviewModal && selectedAsset && portalContainer && createPortal(
              <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" 
                style={{ 
                  paddingTop: '120px',
                  zIndex: 100000,
                  pointerEvents: 'auto'
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowReviewModal(false);
                  }
                }}
              >
                <div 
                  className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold">添加平台审核记录</h2>
                    <button
                      onClick={() => setShowReviewModal(false)}
                      className="text-slate-300 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-base font-medium mb-2 text-white">
                        审核状态 <span className="text-red-400">*</span>
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
                      <label className="block text-sm font-medium mb-2 text-white">
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
                      <label className="block text-sm font-medium mb-2 text-white">
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
                      <label className="block text-sm font-medium mb-2 text-white">
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
                        提交平台审核记录
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
              </div>,
              portalContainer
            )}

            {/* 添加真伪认证记录模态框 - 使用 Portal */}
            {showAuthModal && selectedAsset && portalContainer && createPortal(
              <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" 
                style={{ 
                  paddingTop: '120px',
                  zIndex: 100000,
                  pointerEvents: 'auto'
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowAuthModal(false);
                  }
                }}
              >
                <div 
                  className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold">添加真伪认证记录</h2>
                    <button
                      onClick={() => setShowAuthModal(false)}
                      className="text-slate-300 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        鉴定机构名称 *
                      </label>
                      <input
                        type="text"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="例如：某某鉴定中心 / 品牌官方"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        鉴定类型
                      </label>
                      <select
                        value={authType}
                        onChange={(e) => setAuthType(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="official_brand">官方品牌认证</option>
                        <option value="third_party">第三方机构认证</option>
                        <option value="ai_system">AI 系统辅助认证</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        认证报告链接
                      </label>
                      <input
                        type="text"
                        value={authReportUrl}
                        onChange={(e) => setAuthReportUrl(e.target.value)}
                        placeholder="IPFS / S3 / 其他存储的报告 URL"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        报告哈希（可选）
                      </label>
                      <input
                        type="text"
                        value={authReportHash}
                        onChange={(e) => setAuthReportHash(e.target.value)}
                        placeholder="例如：IPFS CID 或链上记录哈希"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        鉴定师签名/证书信息（可选）
                      </label>
                      <textarea
                        value={authSignature}
                        onChange={(e) => setAuthSignature(e.target.value)}
                        placeholder="可以粘贴证书编号、签名摘要等信息"
                        rows={3}
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        备注（可选）
                      </label>
                      <textarea
                        value={authNotes}
                        onChange={(e) => setAuthNotes(e.target.value)}
                        placeholder="补充说明，例如：综合两家机构意见后结论为真品"
                        rows={3}
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleCreateAuthentication}
                        className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition-colors"
                      >
                        提交认证记录
                      </button>
                      <button
                        onClick={() => setShowAuthModal(false)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              portalContainer
            )}

            {/* 添加估值报告模态框 - 使用 Portal */}
            {showValuationModal && selectedAsset && portalContainer && createPortal(
              <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" 
                style={{ 
                  paddingTop: '120px',
                  zIndex: 100000,
                  pointerEvents: 'auto'
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowValuationModal(false);
                  }
                }}
              >
                <div 
                  className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold">添加估值报告</h2>
                    <button
                      onClick={() => setShowValuationModal(false)}
                      className="text-slate-300 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        估值机构名称 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={valuationAgency}
                        onChange={(e) => setValuationAgency(e.target.value)}
                        placeholder="例如：某某估值机构"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">
                          估值金额 <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={valuationAmount}
                          onChange={(e) => setValuationAmount(e.target.value)}
                          placeholder="例如：50000"
                          className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">
                          币种
                        </label>
                        <select
                          value={valuationCurrency}
                          onChange={(e) => setValuationCurrency(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="USD">USD</option>
                          <option value="MNT">MNT</option>
                          <option value="CNY">CNY</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        估值日期
                      </label>
                      <input
                        type="date"
                        value={valuationDate}
                        onChange={(e) => setValuationDate(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        估值报告链接
                      </label>
                      <input
                        type="text"
                        value={valuationReportUrl}
                        onChange={(e) => setValuationReportUrl(e.target.value)}
                        placeholder="IPFS / S3 / 其他存储的报告 URL"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleCreateValuation}
                        className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition-colors"
                      >
                        提交估值报告
                      </button>
                      <button
                        onClick={() => setShowValuationModal(false)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              portalContainer
            )}

            {/* 添加托管信息模态框 - 使用 Portal */}
            {showCustodyModal && selectedAsset && portalContainer && createPortal(
              <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" 
                style={{ 
                  paddingTop: '120px',
                  zIndex: 100000,
                  pointerEvents: 'auto'
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowCustodyModal(false);
                  }
                }}
              >
                <div 
                  className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold text-white">添加托管信息</h2>
                    <button
                      onClick={() => setShowCustodyModal(false)}
                      className="text-slate-300 hover:text-white text-2xl leading-none"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        托管机构名称 *
                      </label>
                      <input
                        type="text"
                        value={custodyOrganization}
                        onChange={(e) => setCustodyOrganization(e.target.value)}
                        placeholder="例如：香港XX托管中心"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        仓储位置（可选）
                      </label>
                      <input
                        type="text"
                        value={warehouseLocation}
                        onChange={(e) => setWarehouseLocation(e.target.value)}
                        placeholder="例如：香港-XX区（模糊位置）"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        详细地址哈希（可选）
                      </label>
                      <input
                        type="text"
                        value={warehouseAddressHash}
                        onChange={(e) => setWarehouseAddressHash(e.target.value)}
                        placeholder="链上存证的地址哈希"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        入库日期（可选）
                      </label>
                      <input
                        type="date"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        托管合同链接（可选）
                      </label>
                      <input
                        type="text"
                        value={custodyContractUrl}
                        onChange={(e) => setCustodyContractUrl(e.target.value)}
                        placeholder="IPFS / S3 / 其他存储的合同 URL"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        合同哈希（可选）
                      </label>
                      <input
                        type="text"
                        value={custodyContractHash}
                        onChange={(e) => setCustodyContractHash(e.target.value)}
                        placeholder="链上存证的合同哈希"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        设施标准（可选）
                      </label>
                      <textarea
                        value={facilityStandards}
                        onChange={(e) => setFacilityStandards(e.target.value)}
                        placeholder="例如：恒温恒湿、防火防盗监控、访问控制等"
                        rows={3}
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        备注（可选）
                      </label>
                      <textarea
                        value={custodyNotes}
                        onChange={(e) => setCustodyNotes(e.target.value)}
                        placeholder="补充说明"
                        rows={3}
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleCreateCustody}
                        className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition-colors"
                      >
                        提交托管信息
                      </button>
                      <button
                        onClick={() => setShowCustodyModal(false)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              portalContainer
            )}

            {/* 添加保险信息模态框 - 使用 Portal */}
            {showInsuranceModal && selectedAsset && portalContainer && createPortal(
              <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" 
                style={{ 
                  paddingTop: '120px',
                  zIndex: 100000,
                  pointerEvents: 'auto'
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowInsuranceModal(false);
                  }
                }}
              >
                <div 
                  className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold text-white">添加保险信息</h2>
                    <button
                      onClick={() => setShowInsuranceModal(false)}
                      className="text-slate-300 hover:text-white text-2xl leading-none"
                    >
                      ✕
                    </button>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="mb-4 p-3 bg-emerald-900/50 border border-emerald-700 rounded-lg text-emerald-200 text-sm">
                      {success}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        保险公司名称 *
                      </label>
                      <input
                        type="text"
                        value={insuranceCompany}
                        onChange={(e) => setInsuranceCompany(e.target.value)}
                        placeholder="例如：XX保险公司"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">
                          保单号（可选）
                        </label>
                        <input
                          type="text"
                          value={policyNumber}
                          onChange={(e) => setPolicyNumber(e.target.value)}
                          placeholder="保单编号"
                          className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">
                          保险类型
                        </label>
                        <select
                          value={coverageType}
                          onChange={(e) => setCoverageType(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="全险">全险</option>
                          <option value="盗窃险">盗窃险</option>
                          <option value="火灾险">火灾险</option>
                          <option value="综合险">综合险</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">
                          保额 *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={coverageAmount}
                          onChange={(e) => setCoverageAmount(e.target.value)}
                          placeholder="例如：50000"
                          className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">
                          币种
                        </label>
                        <select
                          value={coverageCurrency}
                          onChange={(e) => setCoverageCurrency(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="USD">USD</option>
                          <option value="MNT">MNT</option>
                          <option value="CNY">CNY</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">
                          生效日期（可选）
                        </label>
                        <input
                          type="date"
                          value={policyStartDate}
                          onChange={(e) => setPolicyStartDate(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">
                          到期日期 *
                        </label>
                        <input
                          type="date"
                          value={policyEndDate}
                          onChange={(e) => setPolicyEndDate(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        保费（可选）
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={premiumAmount}
                        onChange={(e) => setPremiumAmount(e.target.value)}
                        placeholder="例如：5000"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        保单文档链接（可选）
                      </label>
                      <input
                        type="text"
                        value={policyDocumentUrl}
                        onChange={(e) => setPolicyDocumentUrl(e.target.value)}
                        placeholder="IPFS / S3 / 其他存储的保单 URL"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        保单文档哈希（可选）
                      </label>
                      <input
                        type="text"
                        value={policyDocumentHash}
                        onChange={(e) => setPolicyDocumentHash(e.target.value)}
                        placeholder="链上存证的保单哈希"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">
                        备注（可选）
                      </label>
                      <textarea
                        value={insuranceNotes}
                        onChange={(e) => setInsuranceNotes(e.target.value)}
                        placeholder="补充说明"
                        rows={3}
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("Button clicked");
                          handleCreateInsurance();
                        }}
                        className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition-colors"
                      >
                        提交保险信息
                      </button>
                      <button
                        onClick={() => setShowInsuranceModal(false)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              portalContainer
            )}
          </div>
        )}
    </PageContainer>
  );
}


