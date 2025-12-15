"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChainId, usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { mantleSepoliaTestnet } from "@/lib/web3/config";
import { luxuryTokenAbi } from "@/lib/web3/contracts";

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
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onchainRemaining, setOnchainRemaining] = useState<Record<string, string>>({});

  const chainId = useChainId();
  const publicClient = usePublicClient();

  useEffect(() => {
    async function fetchAssets() {
      try {
        const res = await fetch(`${API_BASE}/api/assets`);
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: Asset[] = await res.json();
        setAssets(data);
      } catch (e: any) {
        setError(e.message ?? "Failed to load assets");
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
              chainId: mantleSepoliaTestnet.id,
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
      <main className="min-h-screen gradient-bg text-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto"></div>
          <p className="text-sm text-slate-300">加载资产列表中…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-6 py-4 max-w-md">
          <p className="text-sm font-semibold text-red-200 mb-1">
            加载失败
          </p>
          <p className="text-xs text-red-300 break-all">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6 relative">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="mb-6 flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
              <span className="gradient-text">可投资资产</span>
            </h1>
            <p className="text-sm text-slate-300">
              来自 MantleLuxury 的奢侈品 RWA 资产列表
            </p>
          </div>
          <Link
            href="/assets/submit"
            className="group relative px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 rounded-xl text-white text-sm font-semibold hover:from-sky-400 hover:to-blue-500 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/50"
          >
            <span className="relative z-10 flex items-center gap-2">
              <span className="text-lg">+</span> 提交资产
            </span>
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset, index) => (
            <Link
              key={asset.id}
              href={`/assets/${asset.id}`}
              className="group card-hover glass-effect rounded-2xl px-6 py-5 border border-slate-700/50 hover:border-sky-500/50 relative overflow-hidden"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* 卡片背景渐变 */}
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <div className="relative z-10">
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
                  <span
                    className={`text-xs rounded-full px-3 py-1.5 border font-medium ${
                      asset.status === "fundraising"
                        ? "border-amber-400/60 text-amber-200 bg-amber-500/20 shadow-lg shadow-amber-500/20"
                        : asset.status === "funded"
                        ? "border-emerald-400/60 text-emerald-200 bg-emerald-500/20 shadow-lg shadow-emerald-500/20"
                        : "border-slate-500/60 text-slate-200 bg-slate-500/20"
                    }`}
                  >
                    {asset.status === "fundraising"
                      ? "募集中"
                      : asset.status === "funded"
                      ? "已满额"
                      : "已结束"}
                  </span>
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
                      {asset.tokenAddress &&
                      onchainRemaining[asset.tokenAddress] !== undefined
                        ? `${onchainRemaining[asset.tokenAddress]} 份`
                        : `${asset.remainingSupply} 份`}
                    </dd>
                  </div>
                </dl>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
