"use client";

import { useEffect, useState } from "react";

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
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-300">加载资产列表中…</p>
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
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            可投资资产
          </h1>
          <p className="text-sm text-slate-300">
            来自 MantleLuxury 的奢侈品 RWA 资产列表（当前为演示数据）。
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {assets.map((asset) => (
            <article
              key={asset.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4 hover:border-sky-500/60 transition"
            >
              <div className="flex items-baseline justify-between gap-4 mb-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                    {asset.assetType === "watch"
                      ? "名表"
                      : asset.assetType === "jewelry"
                      ? "珠宝"
                      : asset.assetType}
                  </div>
                  <h2 className="text-lg font-semibold">
                    {asset.brand} {asset.model}
                  </h2>
                  {asset.year && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {asset.year} 年
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs rounded-full px-2 py-1 border ${
                    asset.status === "fundraising"
                      ? "border-amber-400/60 text-amber-200 bg-amber-500/10"
                      : asset.status === "funded"
                      ? "border-emerald-400/60 text-emerald-200 bg-emerald-500/10"
                      : "border-slate-500/60 text-slate-200 bg-slate-500/10"
                  }`}
                >
                  {asset.status === "fundraising"
                    ? "募集中"
                    : asset.status === "funded"
                    ? "已满额"
                    : "已结束"}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs text-slate-300">
                <div>
                  <dt className="text-slate-500">单份价格</dt>
                  <dd className="font-medium">${asset.pricePerShare}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">总份数</dt>
                  <dd>{asset.totalSupply}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">剩余可购</dt>
                  <dd>{asset.remainingSupply}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

