"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type KycStatus = "none" | "pending" | "approved" | "rejected";
type Step = "risk-assessment" | "kyc-info";

type RiskAssessmentAnswers = {
  investmentExperience: number;
  riskTolerance: number;
  investmentGoal: number;
  investmentHorizon: number;
};

export default function KycPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<KycStatus>("none");
  const [currentStep, setCurrentStep] = useState<Step>("risk-assessment");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessmentAnswers>({
    investmentExperience: 1,
    riskTolerance: 1,
    investmentGoal: 1,
    investmentHorizon: 1,
  });
  const [riskAssessmentSubmitted, setRiskAssessmentSubmitted] = useState(false);
  const [riskAssessmentResult, setRiskAssessmentResult] = useState<any>(null);

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
        
        // 检查是否已完成风险测评
        const riskRes = await fetch(`${API_BASE}/api/risk-assessment/${address}`);
        if (riskRes.ok) {
          const riskData = await riskRes.json();
          setRiskAssessmentSubmitted(true);
          setRiskAssessmentResult(riskData);
          setCurrentStep("kyc-info");
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
      setCurrentStep("kyc-info");
    } catch (e: any) {
      setError(e.message ?? "提交失败");
    } finally {
      setLoading(false);
    }
  };

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    
    // 验证邮箱必填
    if (!email || email.trim() === "") {
      setError("请填写邮箱地址");
      return;
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("请输入有效的邮箱地址");
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
          email: email.trim(),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "提交失败");
      }
      const data = await res.json();
      setStatus((data.status as KycStatus) ?? "pending");
    } catch (e: any) {
      setError(e.message ?? "提交失败");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6">
      <div className="max-w-xl mx-auto">
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
            <div className="text-sm text-slate-300">
              当前钱包：{" "}
              <span className="font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            </div>

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

            <div className="text-xs text-slate-400 space-y-1">
              <p>审核流程（当前为 Demo）：</p>
              <p>1) 提交钱包地址与邮箱，进入审核中。</p>
              <p>2) 平台风控（含黑名单、限额）检查通过后标记“已通过”。</p>
              <p>3) 审核通过后可投资资产、提交新资产；未通过/驳回则无法操作。</p>
              <p className="text-[11px] text-slate-500">
                * Demo 环节：可用接口 <span className="font-mono">/api/kyc/approve/&#123;walletAddress&#125;</span> 手动置为通过。
              </p>
            </div>

            {status === "approved" ? (
              <p className="text-xs text-emerald-300">
                你的 KYC 已通过，可以返回资产页面继续投资。
              </p>
            ) : currentStep === "risk-assessment" ? (
              <form onSubmit={handleRiskAssessmentSubmit} className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">风险测评问卷</h3>
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
            ) : (
              <div className="space-y-4">
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

                <form onSubmit={handleKycSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      邮箱（用于通知）<span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                      }}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="you@example.com"
                    />
                  </div>

                  {error && (
                    <div className="text-xs text-red-300">{error}</div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || status === "pending" || !email || email.trim() === ""}
                    className="w-full px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-sm font-semibold"
                  >
                    {status === "pending"
                      ? "审核中..."
                      : loading
                      ? "提交中..."
                      : !email || email.trim() === ""
                      ? "请填写邮箱"
                      : "提交 KYC 信息"}
                  </button>

                  <p className="text-[11px] text-slate-500">
                    * 当前为 Demo 环节，提交后默认进入“审核中”，可由后台接口
                    <span className="font-mono"> /api/kyc/approve/&#123;walletAddress&#125; </span>
                    手动通过。
                  </p>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}


