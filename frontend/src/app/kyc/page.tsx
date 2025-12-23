"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type KycStatus = "none" | "pending" | "approved" | "rejected";
type Step = "risk-assessment" | "basic-info" | "documents" | "review";

type RiskAssessmentAnswers = {
  investmentExperience: number;
  riskTolerance: number;
  investmentGoal: number;
  investmentHorizon: number;
};

type KycData = {
  email: string;
  fullName: string;
  idNumber: string;
  idType: string;
  address: string;
  phone: string;
  idDocumentFrontUrl: string | null;
  idDocumentBackUrl: string | null;
  selfieUrl: string | null;
};

export default function KycPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<KycStatus>("none");
  const [currentStep, setCurrentStep] = useState<Step>("risk-assessment");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessmentAnswers>({
    investmentExperience: 1,
    riskTolerance: 1,
    investmentGoal: 1,
    investmentHorizon: 1,
  });
  const [riskAssessmentSubmitted, setRiskAssessmentSubmitted] = useState(false);
  const [riskAssessmentResult, setRiskAssessmentResult] = useState<any>(null);

  const [kycData, setKycData] = useState<KycData>({
    email: "",
    fullName: "",
    idNumber: "",
    idType: "id_card",
    address: "",
    phone: "",
    idDocumentFrontUrl: null,
    idDocumentBackUrl: null,
    selfieUrl: null,
  });

  const [uploading, setUploading] = useState<{
    front: boolean;
    back: boolean;
    selfie: boolean;
  }>({
    front: false,
    back: false,
    selfie: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!address) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/kyc/${address}`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus((data.status as KycStatus) ?? "none");
        setRejectionReason(data.kycRejectionReason || null);
        
        // 加载已保存的KYC数据
        if (data.email) setKycData(prev => ({ ...prev, email: data.email }));
        if (data.fullName) setKycData(prev => ({ ...prev, fullName: data.fullName }));
        if (data.idNumber) setKycData(prev => ({ ...prev, idNumber: data.idNumber }));
        if (data.idType) setKycData(prev => ({ ...prev, idType: data.idType }));
        if (data.address) setKycData(prev => ({ ...prev, address: data.address }));
        if (data.phone) setKycData(prev => ({ ...prev, phone: data.phone }));
        if (data.idDocumentFrontUrl) setKycData(prev => ({ ...prev, idDocumentFrontUrl: data.idDocumentFrontUrl }));
        if (data.idDocumentBackUrl) setKycData(prev => ({ ...prev, idDocumentBackUrl: data.idDocumentBackUrl }));
        if (data.selfieUrl) setKycData(prev => ({ ...prev, selfieUrl: data.selfieUrl }));
        
        // 检查是否已完成风险测评
        const riskRes = await fetch(`${API_BASE}/api/risk-assessment/${address}`);
        if (riskRes.ok) {
          const riskData = await riskRes.json();
          setRiskAssessmentSubmitted(true);
          setRiskAssessmentResult(riskData);
          // 如果KYC状态是none或rejected，进入基本信息步骤
          if (data.status === "none" || data.status === "rejected") {
            setCurrentStep("basic-info");
          }
        }
      } catch {
        // ignore
      }
    };
    load();
  }, [address]);

  const handleRiskAssessmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/risk-assessment/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: address,
          answers: riskAssessment,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "提交失败");
      }
      const data = await res.json();
      setRiskAssessmentSubmitted(true);
      setRiskAssessmentResult(data);
      setCurrentStep("basic-info");
    } catch (e: any) {
      setError(e.message ?? "提交失败");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, type: "front" | "back" | "selfie") => {
    if (!file) return;
    
    setUploading(prev => ({ ...prev, [type]: true }));
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch(`${API_BASE}/api/upload/kyc-document`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "上传失败");
      }
      
      const data = await res.json();
      // 如果返回的是相对路径，拼接完整的API_BASE
      let fileUrl = data.url;
      if (fileUrl && !fileUrl.startsWith("http")) {
        fileUrl = `${API_BASE}${fileUrl}`;
      }
      
      if (type === "front") {
        setKycData(prev => ({ ...prev, idDocumentFrontUrl: fileUrl }));
      } else if (type === "back") {
        setKycData(prev => ({ ...prev, idDocumentBackUrl: fileUrl }));
      } else if (type === "selfie") {
        setKycData(prev => ({ ...prev, selfieUrl: fileUrl }));
      }
    } catch (e: any) {
      setError(e.message ?? "上传失败");
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    
    // 验证必填字段
    if (!kycData.email.trim() || !kycData.fullName.trim() || !kycData.idNumber.trim()) {
      setError("请填写所有必填字段");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/kyc/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: address,
          ...kycData,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "提交失败");
      }
      const data = await res.json();
      setStatus((data.status as KycStatus) ?? "pending");
      setCurrentStep("review");
    } catch (e: any) {
      setError(e.message ?? "提交失败");
    } finally {
      setLoading(false);
    }
  };

  const handleResubmit = () => {
    setStatus("none");
    setRejectionReason(null);
    setCurrentStep("basic-info");
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">KYC / AML 审核</h1>
            <p className="text-sm text-slate-400 mt-1">
              完成 KYC / AML 后即可在 MantleLuxury 平台投资资产。
            </p>
          </div>
          <WalletConnect />
        </div>

        {!isConnected || !address ? (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center">
            <p className="text-sm text-slate-300 mb-3">
              请先连接钱包，再进行 KYC。
            </p>
            <WalletConnect />
          </div>
        ) : (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-6 space-y-4">
            {/* 状态显示 */}
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-slate-400 mr-2">当前状态：</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    status === "approved"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                      : status === "pending"
                      ? "bg-amber-500/20 text-amber-200 border border-amber-400/40"
                      : status === "rejected"
                      ? "bg-red-500/20 text-red-200 border border-red-400/40"
                      : "bg-slate-700/40 text-slate-200 border border-slate-500/40"
                  }`}
                >
                  {status === "approved"
                    ? "已通过"
                    : status === "pending"
                    ? "审核中"
                    : status === "rejected"
                    ? "已驳回"
                    : "未提交"}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </div>
            </div>

            {/* 驳回原因显示 */}
            {status === "rejected" && rejectionReason && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="text-sm font-semibold text-red-300 mb-2">驳回原因</div>
                <div className="text-sm text-red-200">{rejectionReason}</div>
                <button
                  onClick={handleResubmit}
                  className="mt-3 px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg text-white text-sm font-medium transition-colors"
                >
                  重新提交
                </button>
              </div>
            )}

            {/* 已通过提示 */}
            {status === "approved" && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <p className="text-sm text-emerald-300">
                  ✓ 你的 KYC 已通过，可以返回资产页面继续投资。
                </p>
              </div>
            )}

            {/* 审核中提示 */}
            {status === "pending" && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-300">
                  ⏳ 你的 KYC 申请正在审核中，请耐心等待。
                </p>
              </div>
            )}

            {/* 风险测评步骤 */}
            {currentStep === "risk-assessment" && !riskAssessmentSubmitted && status !== "approved" && status !== "pending" && (
              <form onSubmit={handleRiskAssessmentSubmit} className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">步骤 1: 风险测评问卷</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    请如实回答以下问题，帮助我们了解您的投资偏好和风险承受能力。
                  </p>
                </div>

                {/* 投资经验 */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    1. 您的投资经验如何？
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 1, label: "几乎没有投资经验" },
                      { value: 2, label: "有少量投资经验（1-2年）" },
                      { value: 3, label: "有中等投资经验（3-5年）" },
                      { value: 4, label: "有丰富投资经验（5-10年）" },
                      { value: 5, label: "有非常丰富的投资经验（10年以上）" },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="investmentExperience"
                          value={option.value}
                          checked={riskAssessment.investmentExperience === option.value}
                          onChange={(e) =>
                            setRiskAssessment({
                              ...riskAssessment,
                              investmentExperience: parseInt(e.target.value),
                            })
                          }
                          className="mr-2"
                        />
                        <span className="text-sm text-slate-300">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 风险承受能力 */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    2. 您的风险承受能力如何？
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 1, label: "非常保守，不能接受任何本金损失" },
                      { value: 2, label: "保守，只能接受小幅波动（<5%）" },
                      { value: 3, label: "稳健，可以接受中等波动（5-15%）" },
                      { value: 4, label: "积极，可以接受较大波动（15-30%）" },
                      { value: 5, label: "非常积极，可以接受高风险高收益（>30%）" },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="riskTolerance"
                          value={option.value}
                          checked={riskAssessment.riskTolerance === option.value}
                          onChange={(e) =>
                            setRiskAssessment({
                              ...riskAssessment,
                              riskTolerance: parseInt(e.target.value),
                            })
                          }
                          className="mr-2"
                        />
                        <span className="text-sm text-slate-300">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 投资目标 */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    3. 您的主要投资目标是？
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 1, label: "保值为主，追求稳定收益" },
                      { value: 2, label: "稳健增值，略高于通胀" },
                      { value: 3, label: "平衡收益与风险，追求长期增长" },
                      { value: 4, label: "追求较高收益，愿意承担一定风险" },
                      { value: 5, label: "追求最大收益，愿意承担高风险" },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="investmentGoal"
                          value={option.value}
                          checked={riskAssessment.investmentGoal === option.value}
                          onChange={(e) =>
                            setRiskAssessment({
                              ...riskAssessment,
                              investmentGoal: parseInt(e.target.value),
                            })
                          }
                          className="mr-2"
                        />
                        <span className="text-sm text-slate-300">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 投资期限 */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    4. 您的投资期限偏好是？
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 1, label: "短期（<1年）" },
                      { value: 2, label: "中短期（1-3年）" },
                      { value: 3, label: "中期（3-5年）" },
                      { value: 4, label: "中长期（5-10年）" },
                      { value: 5, label: "长期（>10年）" },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="investmentHorizon"
                          value={option.value}
                          checked={riskAssessment.investmentHorizon === option.value}
                          onChange={(e) =>
                            setRiskAssessment({
                              ...riskAssessment,
                              investmentHorizon: parseInt(e.target.value),
                            })
                          }
                          className="mr-2"
                        />
                        <span className="text-sm text-slate-300">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="text-xs text-red-300">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-sm font-semibold"
                >
                  {loading ? "提交中..." : "提交风险测评"}
                </button>
              </form>
            )}

            {/* 风险测评结果 */}
            {riskAssessmentResult && (
              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <h4 className="text-sm font-semibold mb-2">风险测评结果</h4>
                <p className="text-xs text-slate-300 mb-2">
                  风险等级：<span className="font-semibold text-sky-400">
                    {riskAssessmentResult.riskLevel === "conservative" ? "保守型" :
                     riskAssessmentResult.riskLevel === "moderate" ? "稳健型" : "积极型"}
                  </span>
                </p>
                <p className="text-xs text-slate-400">
                  {riskAssessmentResult.assessmentResult}
                </p>
              </div>
            )}

            {/* 基本信息步骤 */}
            {currentStep === "basic-info" && riskAssessmentSubmitted && status !== "approved" && status !== "pending" && (
              <form onSubmit={(e) => { e.preventDefault(); setCurrentStep("documents"); }} className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">步骤 2: 基本信息</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    请填写您的真实身份信息。
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    邮箱地址 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={kycData.email}
                    onChange={(e) => setKycData(prev => ({ ...prev, email: e.target.value }))}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    姓名 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={kycData.fullName}
                    onChange={(e) => setKycData(prev => ({ ...prev, fullName: e.target.value }))}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="请输入真实姓名"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      证件类型 <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={kycData.idType}
                      onChange={(e) => setKycData(prev => ({ ...prev, idType: e.target.value }))}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="id_card">身份证</option>
                      <option value="passport">护照</option>
                      <option value="driver_license">驾驶证</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      证件号 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={kycData.idNumber}
                      onChange={(e) => setKycData(prev => ({ ...prev, idNumber: e.target.value }))}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="请输入证件号"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    地址
                  </label>
                  <textarea
                    value={kycData.address}
                    onChange={(e) => setKycData(prev => ({ ...prev, address: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="请输入详细地址"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    联系电话
                  </label>
                  <input
                    type="tel"
                    value={kycData.phone}
                    onChange={(e) => setKycData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="请输入联系电话"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-sm font-semibold"
                >
                  下一步：上传证件
                </button>
              </form>
            )}

            {/* 证件上传步骤 */}
            {currentStep === "documents" && riskAssessmentSubmitted && status !== "approved" && status !== "pending" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">步骤 3: 上传证件</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    请上传清晰的证件照片和自拍照片。
                  </p>
                </div>

                <div className="space-y-4">
                  {/* 证件正面 */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      证件正面照片
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "front");
                        }}
                        disabled={uploading.front}
                        className="text-sm text-slate-300"
                      />
                      {uploading.front && (
                        <span className="text-xs text-slate-400">上传中...</span>
                      )}
                      {kycData.idDocumentFrontUrl && (
                        <span className="text-xs text-emerald-400">✓ 已上传</span>
                      )}
                    </div>
                  </div>

                  {/* 证件背面 */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      证件背面照片
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "back");
                        }}
                        disabled={uploading.back}
                        className="text-sm text-slate-300"
                      />
                      {uploading.back && (
                        <span className="text-xs text-slate-400">上传中...</span>
                      )}
                      {kycData.idDocumentBackUrl && (
                        <span className="text-xs text-emerald-400">✓ 已上传</span>
                      )}
                    </div>
                  </div>

                  {/* 自拍照片 */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      自拍照片（人脸识别）
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "selfie");
                        }}
                        disabled={uploading.selfie}
                        className="text-sm text-slate-300"
                      />
                      {uploading.selfie && (
                        <span className="text-xs text-slate-400">上传中...</span>
                      )}
                      {kycData.selfieUrl && (
                        <span className="text-xs text-emerald-400">✓ 已上传</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      * 请手持证件进行自拍，确保面部和证件清晰可见
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="text-xs text-red-300">{error}</div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setCurrentStep("basic-info")}
                    className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold"
                  >
                    上一步
                  </button>
                  <button
                    onClick={() => setCurrentStep("review")}
                    className="flex-1 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-sm font-semibold"
                  >
                    下一步：确认提交
                  </button>
                </div>
              </div>
            )}

            {/* 确认提交步骤 */}
            {currentStep === "review" && riskAssessmentSubmitted && status !== "approved" && status !== "pending" && (
              <form onSubmit={handleKycSubmit} className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">步骤 4: 确认提交</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    请确认您的信息无误后提交。
                  </p>
                </div>

                <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg space-y-2 text-sm">
                  <div><span className="text-slate-400">姓名：</span>{kycData.fullName}</div>
                  <div><span className="text-slate-400">证件类型：</span>
                    {kycData.idType === "id_card" ? "身份证" :
                     kycData.idType === "passport" ? "护照" : "驾驶证"}
                  </div>
                  <div><span className="text-slate-400">证件号：</span>
                    {kycData.idNumber.slice(0, 4)}****{kycData.idNumber.slice(-4)}
                  </div>
                  <div><span className="text-slate-400">邮箱：</span>{kycData.email}</div>
                  {kycData.phone && <div><span className="text-slate-400">电话：</span>{kycData.phone}</div>}
                  {kycData.address && <div><span className="text-slate-400">地址：</span>{kycData.address}</div>}
                </div>

                {error && (
                  <div className="text-xs text-red-300">{error}</div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep("documents")}
                    className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold"
                  >
                    上一步
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !kycData.email || !kycData.fullName || !kycData.idNumber}
                    className="flex-1 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-sm font-semibold"
                  >
                    {loading ? "提交中..." : "提交 KYC 申请"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
