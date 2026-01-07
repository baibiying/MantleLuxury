"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { mantleSepoliaTestnet } from "@/lib/web3/config";
import { luxuryTokenAbi } from "@/lib/web3/contracts";
import PageContainer from "@/components/PageContainer";
import TechCard from "@/components/TechCard";
import TechButton from "@/components/TechButton";

type Asset = {
  id: string;
  assetType: string;
  brand: string;
  model: string;
  year: number | null;
  pricePerShare: string;
  totalSupply: string;
  remainingSupply: string;
  status: string;
  tokenAddress: string | null;
  imageUrls?: string | null;
  totalYield?: string | null; // 累计收益
  custody?: {
    id: string;
    custodyStatus: string;
    custodyOrganization: string;
  } | null;
  insurance?: {
    id: string;
    isActive: boolean;
  } | null;
  authentications?: Array<{
    id: string;
    authenticationStatus: string;
  }>;
  submittedBy?: string | null; // 提交者钱包地址
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onchainRemaining, setOnchainRemaining] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"price" | "recent" | "yield">("recent");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [myAssetsOnly, setMyAssetsOnly] = useState<boolean>(false);

  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  useEffect(() => {
    async function fetchAssets() {
      try {
        const apiUrl = `${API_BASE}/api/assets`;
        console.log("Fetching assets from:", apiUrl);
        
        const res = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // 添加 mode 和 credentials 以处理 CORS
          mode: 'cors',
          credentials: 'omit',
        });
        
        console.log("Response status:", res.status, res.statusText);
        
        if (!res.ok) {
          const errorText = await res.text().catch(() => res.statusText);
          throw new Error(`请求失败 (${res.status}): ${errorText || res.statusText}`);
        }
        const data: Asset[] = await res.json();
        console.log("Fetched assets:", data.length, "items");
        setAssets(data || []); // 确保始终是数组
        setError(null); // 清除之前的错误
      } catch (e: any) {
        console.error("Failed to fetch assets:", e);
        console.error("Error details:", {
          message: e.message,
          stack: e.stack,
          name: e.name,
          apiBase: API_BASE,
        });
        const errorMessage = e.message ?? "加载资产列表失败";
        setError(`${errorMessage}。请检查后端服务是否正常运行 (${API_BASE})`);
        setAssets([]); // 发生错误时设置为空数组，而不是显示错误页面
      } finally {
        setLoading(false);
      }
    }

    fetchAssets();
  }, []);

  // 从链上读取每个资产的剩余可购份数（getAvailableTokens）
  useEffect(() => {
    const loadOnchainRemaining = async () => {
      if (!publicClient || chainId !== mantleSepoliaTestnet.id) return;
      const withToken = assets.filter(
        (a) => a.tokenAddress && a.status === "fundraising"
      );
      if (withToken.length === 0) return;

      const entries = await Promise.all(
        withToken.map(async (asset) => {
          try {
            const raw = (await publicClient.readContract({
              address: asset.tokenAddress as `0x${string}`,
              abi: luxuryTokenAbi,
              functionName: "getAvailableTokens",
            })) as bigint;
            const formatted = formatEther(raw);
            return [asset.tokenAddress as string, formatted] as const;
          } catch {
            return null;
          }
        })
      );

      const next: Record<string, string> = {};
      for (const e of entries) {
        if (e) {
          next[e[0]] = e[1];
        }
      }
      setOnchainRemaining(next);
    };

    loadOnchainRemaining();
  }, [assets, publicClient, chainId]);

  if (loading) {
    return (
      <PageContainer
        title="可投资资产"
        subtitle="来自 MantleLuxury 的奢侈品 RWA 资产列表"
        maxWidth="5xl"
      >
        <div className="text-center space-y-4 py-20">
          <div className="loading-spinner mx-auto"></div>
          <p className="text-sm text-slate-300">加载资产列表中…</p>
        </div>
      </PageContainer>
    );
  }

  // 如果有错误，显示警告但不阻止页面渲染
  // 这样即使 API 失败，用户也能看到筛选器等 UI

  // 提取所有品牌（用于筛选下拉框）
  const allBrands = Array.from(new Set(assets.map(a => a.brand).filter(Boolean))).sort();

  // 计算预期收益率（基于累计收益和总供应量）
  const calculateExpectedYield = (asset: Asset): number => {
    if (!asset.totalYield || !asset.totalSupply || !asset.pricePerShare) {
      return 0;
    }
    const totalYield = parseFloat(asset.totalYield);
    const totalSupply = parseFloat(asset.totalSupply);
    const pricePerShare = parseFloat(asset.pricePerShare);
    
    if (totalSupply === 0 || pricePerShare === 0) {
      return 0;
    }
    
    // 预期收益率 = (累计收益 / 总供应量) / 每份价格 * 100
    // 这表示每份代币的平均收益相对于价格的百分比
    const yieldPerShare = totalYield / totalSupply;
    return (yieldPerShare / pricePerShare) * 100;
  };

  // 过滤与排序
  const filtered = assets
    .filter((a) => (typeFilter === "all" ? true : a.assetType === typeFilter))
    .filter((a) => (statusFilter === "all" ? true : a.status === statusFilter))
    .filter((a) => (brandFilter === "all" ? true : a.brand === brandFilter))
    .filter((a) => {
      // 如果启用了"我提交的资产"过滤器，只显示当前用户提交的资产
      if (myAssetsOnly && address) {
        if (!a.submittedBy || a.submittedBy.toLowerCase() !== address.toLowerCase()) {
          return false;
        }
      }
      return true;
    })
    .filter((a) => {
      if (priceMin) {
        const pmin = parseFloat(priceMin);
        if (!isNaN(pmin) && parseFloat(a.pricePerShare) < pmin) return false;
      }
      if (priceMax) {
        const pmax = parseFloat(priceMax);
        if (!isNaN(pmax) && parseFloat(a.pricePerShare) > pmax) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "price") {
        return parseFloat(a.pricePerShare) - parseFloat(b.pricePerShare);
      }
      if (sortKey === "yield") {
        // 按预期收益率从高到低排序
        const yieldA = calculateExpectedYield(a);
        const yieldB = calculateExpectedYield(b);
        return yieldB - yieldA;
      }
      // recent: 默认按加载顺序（假定后端按创建时间）
      return 0;
    });

  const imageFor = (asset: Asset) => {
    if (asset.imageUrls) {
      try {
        const arr = JSON.parse(asset.imageUrls);
        if (Array.isArray(arr) && arr.length > 0) {
          const url = arr[0];
          // 如果是旧的 /uploads/ 路径，优先尝试数据库 API，失败则回退到文件系统
          if (url.startsWith('/uploads/')) {
            // 先尝试从数据库获取（索引0），如果数据库没有，回退到文件系统路径
            // 注意：这里我们直接使用文件系统路径，因为旧的图片可能还在文件系统里
            return `${API_BASE}${url}`;
          }
          // 如果已经是新的 API 路径，直接使用
          if (url.startsWith('/api/assets/')) {
            return url.startsWith('http') ? url : `${API_BASE}${url}`;
          }
          // 其他情况（如外部URL），直接返回
          return url;
        }
      } catch {
        // ignore
      }
    }
    // 如果没有图片URL，尝试从数据库获取（索引0）
    if (asset.id) {
      return `${API_BASE}/api/assets/${asset.id}/images/0`;
    }
    // 最后回退到默认图片
    if (asset.assetType === "watch") {
      return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80";
    }
    if (asset.assetType === "jewelry") {
      return "https://images.unsplash.com/photo-1506634064465-1c59a0a51ee3?auto=format&fit=crop&w=800&q=80";
    }
    return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80";
  };

  return (
    <PageContainer
      title="可投资资产"
      subtitle="来自 MantleLuxury 的奢侈品 RWA 资产列表"
      maxWidth="7xl"
    >
      {error && (
        <div className="mb-4 bg-yellow-950/40 border border-yellow-500/40 rounded-xl px-6 py-4">
          <p className="text-sm font-semibold text-yellow-200 mb-1">
            ⚠️ 加载警告
          </p>
          <p className="text-xs text-yellow-300 break-all">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-yellow-400 hover:text-yellow-300 underline"
          >
            点击重试
          </button>
        </div>
      )}
        {/* 筛选与排序 */}
        <section className="mb-4">
          {/* 所有筛选器在同一行 */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">资产类型</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
              >
                <option value="all">全部</option>
                <option value="watch">名表</option>
                <option value="jewelry">珠宝</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">品牌</label>
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
              >
                <option value="all">全部品牌</option>
                {allBrands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">状态</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
              >
                <option value="all">全部</option>
                <option value="registered">待认证</option>
                <option value="fundraising">募集中</option>
                <option value="funded">已满额</option>
                <option value="sold">已结束</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">排序</label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
              >
                <option value="recent">上架时间（默认）</option>
                <option value="price">价格（从低到高）</option>
                <option value="yield">预期收益率（从高到低）</option>
              </select>
            </div>
            {/* 价格区间占据 2 列 */}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-xs text-slate-400">价格区间 (MNT)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="最低"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                />
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="最高"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                />
              </div>
            </div>
          </div>
          {/* 我提交的资产过滤器 */}
          {address && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="myAssetsOnly"
                checked={myAssetsOnly}
                onChange={(e) => setMyAssetsOnly(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-0 focus:ring-offset-slate-900 cursor-pointer"
              />
              <label
                htmlFor="myAssetsOnly"
                className="text-sm text-slate-300 cursor-pointer select-none"
              >
                只显示我提交的资产
              </label>
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-20">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-xl font-semibold text-slate-200 mb-2">
                {assets.length === 0
                  ? "暂无资产"
                  : "没有匹配的资产"}
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                {assets.length === 0
                  ? "当前还没有可投资的资产，请稍后再来查看"
                  : "请尝试调整筛选条件"}
              </p>
            </div>
          ) : (
            filtered.map((asset, index) => (
            <Link
              key={asset.id}
              href={`/assets/${asset.id}`}
              className="group card-hover glass-effect rounded-2xl px-6 py-5 border border-slate-700/50 hover:border-sky-500/50 relative overflow-hidden neon-border code-border"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* 卡片背景渐变 */}
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <div className="relative z-10">
                <div className="overflow-hidden rounded-xl mb-3 border border-slate-800/60 shadow-inner bg-slate-900">
                  <div className="relative h-40 w-full">
                    <Image
                      src={imageFor(asset)}
                      alt={`${asset.brand} ${asset.model}`}
                      fill
                      className="object-cover transform transition duration-500 group-hover:scale-105"
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      // 开发环境下不走优化管道，避免本地调试时各种域名限制
                      unoptimized={process.env.NODE_ENV !== "production"}
                    />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wide text-slate-400 mb-2 font-medium">
                      {asset.assetType === "watch"
                        ? "⌚ 名表"
                        : asset.assetType === "jewelry"
                        ? "💎 珠宝"
                        : asset.assetType}
                    </div>
                    <h2 className="text-xl font-bold mb-1 group-hover:text-sky-400 transition-colors">
                      {asset.brand} {asset.model}
                    </h2>
                    {asset.year && (
                      <p className="text-xs text-slate-400">
                        {asset.year} 年
                      </p>
                    )}
                  </div>
                  {(() => {
                    // 检查资产是否真正可以投资
                    const hasVerifiedAuth = asset.authentications && asset.authentications.some(
                      (auth) => auth.authenticationStatus === "verified"
                    );
                    const hasCustody = asset.custody != null;
                    const hasInsurance = asset.insurance != null && asset.insurance.isActive;
                    const canInvest = asset.status === "fundraising" && hasVerifiedAuth && hasCustody && hasInsurance;
                    
                    // 如果状态是 fundraising 但缺少必要条件，显示"准备中"
                    const displayStatus = asset.status === "fundraising" && !canInvest
                      ? "preparing"
                      : asset.status;
                    
                    return (
                      <span
                        className={`text-xs rounded-full px-3 py-1.5 border font-medium ${
                          displayStatus === "fundraising"
                            ? "border-amber-400/60 text-amber-200 bg-amber-500/20 shadow-lg shadow-amber-500/20"
                            : displayStatus === "funded"
                            ? "border-emerald-400/60 text-emerald-200 bg-emerald-500/20 shadow-lg shadow-emerald-500/20"
                            : displayStatus === "registered"
                            ? "border-blue-400/60 text-blue-200 bg-blue-500/20 shadow-lg shadow-blue-500/20"
                            : displayStatus === "preparing"
                            ? "border-orange-400/60 text-orange-200 bg-orange-500/20 shadow-lg shadow-orange-500/20"
                            : "border-slate-500/60 text-slate-200 bg-slate-500/20"
                        }`}
                      >
                        {displayStatus === "fundraising"
                          ? "募集中"
                          : displayStatus === "funded"
                          ? "已满额"
                          : displayStatus === "registered"
                          ? "待认证"
                          : displayStatus === "preparing"
                          ? "准备中"
                          : "已结束"}
                      </span>
                    );
                  })()}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <dt className="text-slate-500 text-xs">单份价格</dt>
                    <dd className="font-bold text-sky-400">{asset.pricePerShare} MNT</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-slate-500 text-xs">总份数</dt>
                    <dd className="font-semibold">{asset.totalSupply}</dd>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <dt className="text-slate-500 text-xs">剩余可购</dt>
                    <dd className="font-semibold text-emerald-400">
                      {(() => {
                        const remaining = asset.tokenAddress &&
                          onchainRemaining[asset.tokenAddress] !== undefined
                          ? onchainRemaining[asset.tokenAddress]
                          : asset.remainingSupply;
                        const remainingNum = parseFloat(remaining ?? "0");
                        if (!remaining || isNaN(remainingNum) || remainingNum <= 0) {
                          return "暂不可购";
                        }
                        return `${remaining} 份`;
                      })()}
                    </dd>
                  </div>
                  {asset.totalYield && parseFloat(asset.totalYield) > 0 && (
                    <div className="space-y-1 col-span-2">
                      <dt className="text-slate-500 text-xs">累计收益</dt>
                      <dd className="font-semibold text-emerald-400">
                        {parseFloat(asset.totalYield).toFixed(4)} MNT
                      </dd>
                    </div>
                  )}
                  {(() => {
                    const expectedYield = calculateExpectedYield(asset);
                    if (expectedYield > 0) {
                      return (
                        <div className="space-y-1 col-span-2">
                          <dt className="text-slate-500 text-xs">预期收益率</dt>
                          <dd className="font-semibold text-amber-400">
                            {expectedYield.toFixed(2)}%
                          </dd>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </dl>
              </div>
            </Link>
            ))
          )}
        </section>
    </PageContainer>
  );
}
