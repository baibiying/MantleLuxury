"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type FormData = {
  assetType: string;
  brand: string;
  model: string;
  year: string;
  description: string;
  purchasePrice: string; // USD
  purchaseDate: string;
  serialNumber: string;
  totalSupply: string;
  pricePerShare: string; // USD
  submittedBy: string;
};

// 汇率：1 USD = 1 MNT（简化处理，实际应该接入价格预言机）
const USD_TO_MNT_RATE = 1;

export default function AssetSubmitPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [kycStatus, setKycStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [kycLoading, setKycLoading] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    assetType: "watch",
    brand: "",
    model: "",
    year: "",
    description: "",
    purchasePrice: "",
    purchaseDate: "",
    serialNumber: "",
    totalSupply: "",
    pricePerShare: "",
    submittedBy: "",
  });

  // 当连接的钱包变化时，自动填充提交者地址
  useEffect(() => {
    if (address) {
      setFormData((prev) => ({ ...prev, submittedBy: address }));
    }
  }, [address]);

  // 加载 KYC / AML 状态
  useEffect(() => {
    const loadKyc = async () => {
      if (!address) {
        setKycStatus("none");
        return;
      }
      setKycLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/kyc/${address}`);
        if (res.ok) {
          const data = await res.json();
          setKycStatus((data.status as any) ?? "none");
        } else {
          setKycStatus("none");
        }
      } catch {
        setKycStatus("none");
      } finally {
        setKycLoading(false);
      }
    };
    loadKyc();
  }, [address]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      setError("请先连接钱包再提交资产");
      return;
    }
    if (kycStatus !== "approved") {
      setError("请先完成 KYC / AML 审核再提交资产");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`${API_BASE}/api/assets/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetType: formData.assetType,
          brand: formData.brand,
          model: formData.model,
          year: formData.year ? parseInt(formData.year) : null,
          description: formData.description || null,
          purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : null,
          purchaseDate: formData.purchaseDate || null,
          serialNumber: formData.serialNumber || null,
          totalSupply: formData.totalSupply ? parseFloat(formData.totalSupply) : null,
          pricePerShare: formData.pricePerShare ? parseFloat(formData.pricePerShare) : null,
          submittedBy: formData.submittedBy || "anonymous",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `提交失败: ${response.status}`);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/assets");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "提交失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6 relative">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>
      <div className="max-w-5xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
              <span className="gradient-text">提交奢侈品资产</span>
            </h1>
            <p className="text-base text-slate-300">
              将您的奢侈品进行 RWA 代币化，让更多投资者参与分享资产价值。
            </p>
          </div>
          <WalletConnect />
        </header>

        {success && (
          <div className="mb-6 bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-6 py-4">
            <p className="text-sm font-semibold text-emerald-200">
              ✓ 资产提交成功！
            </p>
            <p className="text-xs text-emerald-300 mt-1">
              正在跳转到资产列表页面...
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-950/40 border border-red-500/40 rounded-xl px-6 py-4">
            <p className="text-sm font-semibold text-red-200 mb-1">
              提交失败
            </p>
            <p className="text-xs text-red-300 break-all">{error}</p>
          </div>
        )}

        {!isConnected ? (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center">
            <p className="text-sm text-slate-300 mb-3">
              请先连接钱包，再提交资产。
            </p>
            <WalletConnect />
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-5 py-4 relative overflow-hidden">
            {/* 背景渐变 */}
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
            <div className="relative z-10">
            <h2 className="text-xl font-bold mb-4 gradient-text">基本信息</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  资产类型 <span className="text-red-400">*</span>
                </label>
                <select
                  name="assetType"
                  value={formData.assetType}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="watch">名表</option>
                  <option value="jewelry">珠宝</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  品牌 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  required
                  placeholder="例如：Patek Philippe"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  型号 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  required
                  placeholder="例如：Nautilus 5711"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    年份
                  </label>
                  <input
                    type="number"
                    name="year"
                    value={formData.year}
                    onChange={handleChange}
                    placeholder="例如：2019"
                    min="1900"
                    max={new Date().getFullYear()}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    序列号
                  </label>
                  <input
                    type="text"
                    name="serialNumber"
                    value={formData.serialNumber}
                    onChange={handleChange}
                    placeholder="资产序列号"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  描述
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="资产的详细描述、历史、特点等..."
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>
            </div>
            </div>
          </section>

          <section className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-5 py-4 relative overflow-hidden">
            {/* 背景渐变 */}
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
            <div className="relative z-10">
            <h2 className="text-xl font-bold mb-4 gradient-text">购买信息</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    购入价格 (USD)
                  </label>
                  <input
                    type="number"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    placeholder="例如：50000"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {formData.purchasePrice && parseFloat(formData.purchasePrice) > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      约 {parseFloat(formData.purchasePrice) * USD_TO_MNT_RATE} MNT
                      <span className="text-slate-500 ml-1">(汇率: 1 USD = {USD_TO_MNT_RATE} MNT)</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    购入日期
                  </label>
                  <input
                    type="date"
                    name="purchaseDate"
                    value={formData.purchaseDate}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>
            </div>
          </section>

          <section className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-5 py-4 relative overflow-hidden">
            {/* 背景渐变 */}
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
            <div className="relative z-10">
            <h2 className="text-xl font-bold mb-4 gradient-text">代币化参数</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    总份数 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    name="totalSupply"
                    value={formData.totalSupply}
                    onChange={handleChange}
                    required
                    step="1"
                    min="1"
                    placeholder="例如：1000"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    将资产拆分为多少份代币
                  </p>
                  {formData.totalSupply && formData.pricePerShare && 
                   parseFloat(formData.totalSupply) > 0 && 
                   parseFloat(formData.pricePerShare) > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      总价值: ${(parseFloat(formData.totalSupply) * parseFloat(formData.pricePerShare)).toFixed(2)} USD
                      {' '}
                      (约 {(parseFloat(formData.totalSupply) * parseFloat(formData.pricePerShare) * USD_TO_MNT_RATE).toFixed(2)} MNT)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    每份价格 (USD) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    name="pricePerShare"
                    value={formData.pricePerShare}
                    onChange={handleChange}
                    required
                    step="0.01"
                    min="0"
                    placeholder="例如：500"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {formData.pricePerShare && parseFloat(formData.pricePerShare) > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      约 {parseFloat(formData.pricePerShare) * USD_TO_MNT_RATE} MNT 每份
                      <span className="text-slate-500 ml-1">(汇率: 1 USD = {USD_TO_MNT_RATE} MNT)</span>
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    投资者将用 MNT 支付此价格来购买代币份额
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  提交者钱包地址
                </label>
                <input
                  type="text"
                  name="submittedBy"
                  value={formData.submittedBy}
                  readOnly
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">
                  当前连接的钱包地址将作为资产发行方标识。
                </p>
              </div>
            </div>
            </div>
          </section>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || kycStatus !== "approved" || kycLoading}
              className="flex-1 px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition"
            >
              {kycLoading
                ? "检查 KYC / AML 状态..."
                : kycStatus !== "approved"
                ? "请先完成 KYC / AML"
                : loading
                ? "提交中..."
                : "提交资产"}
            </button>
          </div>
        </form>
        )}
      </div>
    </main>
  );
}


