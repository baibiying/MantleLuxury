"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";
import PageContainer from "@/components/PageContainer";
import TechCard from "@/components/TechCard";
import TechButton from "@/components/TechButton";

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
  imageUrls: string[];
  model3dUrl: string | null;
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
  const [uploading, setUploading] = useState(false);

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
    imageUrls: [],
    model3dUrl: null,
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
    
    // 数据验证
    if (!formData.brand || !formData.brand.trim()) {
      setError("请输入品牌名称");
      return;
    }
    if (!formData.model || !formData.model.trim()) {
      setError("请输入型号");
      return;
    }
    if (!formData.totalSupply || parseFloat(formData.totalSupply) <= 0) {
      setError("请输入有效的总份数（必须大于0）");
      return;
    }
    if (!formData.pricePerShare || parseFloat(formData.pricePerShare) <= 0) {
      setError("请输入有效的每份价格（必须大于0）");
      return;
    }
    if (formData.imageUrls.length === 0) {
      setError("请至少上传一张资产图片");
      return;
    }
    
    // 验证总份数和价格的关系
    const totalSupply = parseFloat(formData.totalSupply);
    const pricePerShare = parseFloat(formData.pricePerShare);
    if (totalSupply * pricePerShare > 10000000) { // 总价值超过1000万美元
      setError("资产总价值过高，请检查总份数和每份价格");
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
          imageUrls: JSON.stringify(formData.imageUrls ?? []),
          model3dUrl: formData.model3dUrl || null,
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
    <PageContainer
      title="提交资产"
      subtitle="将您的奢侈品资产提交到 MantleLuxury 平台进行代币化"
      maxWidth="5xl"
    >
      <div className="mb-6 flex items-center justify-end">
        <WalletConnect />
      </div>

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
          <TechCard className="px-6 py-8 text-center">
            <p className="text-sm text-slate-300 mb-3">
              请先连接钱包，再提交资产。
            </p>
            <WalletConnect />
          </TechCard>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <TechCard className="px-5 py-4">
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
          </TechCard>

          <TechCard className="px-5 py-4">
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
          </TechCard>

          <TechCard className="px-5 py-4">
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
          </TechCard>

          <TechCard className="px-5 py-4">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
            <div className="relative z-10">
              <h2 className="text-xl font-bold mb-4 gradient-text">资产图片</h2>
              <p className="text-xs text-slate-400 mb-3">
                上传 1-3 张资产照片（JPG/PNG），优先展示第一张作为封面。
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    if (!e.target.files || e.target.files.length === 0) return;
                    const files = Array.from(e.target.files);
                    setUploading(true);
                    setError(null);
                    try {
                      const uploaded: string[] = [];
                      for (const f of files) {
                        const form = new FormData();
                        form.append("file", f);
                        const res = await fetch(`${API_BASE}/api/assets/upload-image`, {
                          method: "POST",
                          body: form,
                        });
                        if (!res.ok) {
                          const t = await res.text();
                          throw new Error(t || "上传失败");
                        }
                        const data = await res.json();
                        if (data.url) uploaded.push(data.url);
                      }
                      setFormData((prev) => ({
                        ...prev,
                        imageUrls: [...(prev.imageUrls ?? []), ...uploaded].slice(0, 3),
                      }));
                    } catch (err: any) {
                      setError(err.message || "上传失败，请重试");
                    } finally {
                      setUploading(false);
                      // 清空文件选择
                      e.target.value = "";
                    }
                  }}
                  className="text-sm text-slate-200"
                />
                {uploading && (
                  <span className="text-xs text-slate-300">上传中...</span>
                )}
              </div>
              {formData.imageUrls && formData.imageUrls.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {formData.imageUrls.map((url, idx) => {
                    // 如果是相对路径，拼接后端地址
                    const imageUrl = url.startsWith('/uploads/') 
                      ? `${API_BASE}${url}` 
                      : url;
                    return (
                    <div key={idx} className="relative">
                      <div
                        className="h-24 w-full rounded-lg border border-slate-700 bg-cover bg-center"
                        style={{ backgroundImage: `url(${imageUrl})` }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            imageUrls: prev.imageUrls.filter((_, i) => i !== idx),
                          }))
                        }
                        className="absolute top-1 right-1 text-[10px] px-2 py-1 bg-slate-900/80 text-slate-200 rounded"
                      >
                        移除
                      </button>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TechCard>

          <TechCard className="px-5 py-4">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
            <div className="relative z-10">
              <h2 className="text-xl font-bold mb-4 gradient-text">3D 模型（可选）</h2>
              <p className="text-xs text-slate-400 mb-3">
                上传资产的 3D 模型文件（.glb 或 .gltf 格式），让投资者可以360度查看资产。
                文件大小不超过 50MB。
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".glb,.gltf"
                  onChange={async (e) => {
                    if (!e.target.files || e.target.files.length === 0) return;
                    const file = e.target.files[0];
                    setUploading(true);
                    setError(null);
                    try {
                      const form = new FormData();
                      form.append("file", file);
                      const res = await fetch(`${API_BASE}/api/upload/3d-model`, {
                        method: "POST",
                        body: form,
                      });
                      if (!res.ok) {
                        const t = await res.text();
                        throw new Error(t || "上传失败");
                      }
                      const data = await res.json();
                      if (data.url) {
                        setFormData((prev) => ({
                          ...prev,
                          model3dUrl: data.url,
                        }));
                      }
                    } catch (err: any) {
                      setError(err.message || "上传失败，请重试");
                    } finally {
                      setUploading(false);
                      // 清空文件选择
                      e.target.value = "";
                    }
                  }}
                  className="text-sm text-slate-200"
                  disabled={uploading}
                />
                {uploading && (
                  <span className="text-xs text-slate-300">上传中...</span>
                )}
              </div>
              {formData.model3dUrl && (
                <div className="mt-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm text-slate-300">3D 模型已上传</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          model3dUrl: null,
                        }))
                      }
                      className="text-xs px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded transition-colors"
                    >
                      移除
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {formData.model3dUrl}
                  </p>
                </div>
              )}
            </div>
          </TechCard>

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
          <p className="mt-2 text-xs text-amber-300 text-right">
            为符合合规要求，提交资产前需要完成{" "}
            <a
              href="/kyc"
              className="underline decoration-amber-300 hover:text-amber-100"
            >
              KYC / AML 审核
            </a>
            ，通过后才能提交。
          </p>
        </form>
        )}
    </PageContainer>
  );
}


