"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { mantleSepoliaTestnet } from "@/lib/web3/config";
import { luxuryTokenAbi } from "@/lib/web3/contracts";
import WalletConnect from "@/components/WalletConnect";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

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
  description: string | null;
};

type Holding = {
  asset: Asset;
  balance: string; // human-readable份数
  value: string;   // 估算价值（balance * pricePerShare）
};

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !address || !isConnected) {
      setLoading(false);
      setHoldings([]);
      return;
    }

    const loadHoldings = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. 获取所有资产
        const res = await fetch(`${API_BASE}/api/assets`);
        if (!res.ok) {
          throw new Error(`加载资产失败: ${res.status}`);
        }
        const assets: Asset[] = await res.json();
        const assetsWithToken = assets.filter(
          (a) => a.tokenAddress && a.status === "fundraising"
        );

        if (!publicClient || chainId !== mantleSepoliaTestnet.id) {
          setError("请切换到 Mantle Sepolia 网络以查看持仓");
          setHoldings([]);
          setLoading(false);
          return;
        }

        // 2. 逐个读取 balanceOf
        const results = await Promise.all(
          assetsWithToken.map(async (asset) => {
            try {
              const raw = (await publicClient.readContract({
                address: asset.tokenAddress as `0x${string}`,
                abi: luxuryTokenAbi,
                functionName: "balanceOf",
                args: [address as `0x${string}`],
                chainId: mantleSepoliaTestnet.id,
              })) as bigint;

              if (raw === 0n) return null;

              const balance = parseFloat(formatEther(raw));
              const price = parseFloat(asset.pricePerShare);
              const value = isNaN(price) ? 0 : balance * price;

              return {
                asset,
                balance: balance.toFixed(4).replace(/\.?0+$/, ""),
                value: value.toFixed(4).replace(/\.?0+$/, ""),
              } as Holding;
            } catch {
              return null;
            }
          })
        );

        setHoldings(results.filter((h): h is Holding => h !== null));
      } catch (e: any) {
        setError(e.message ?? "加载持仓失败");
      } finally {
        setLoading(false);
      }
    };

    loadHoldings();
  }, [mounted, address, isConnected, chainId, publicClient]);

  if (!mounted) {
    return null;
  }

  return (
    <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">我的持仓</h1>
            <p className="text-sm text-slate-400 mt-1">
              查看你在 MantleLuxury 平台上持有的资产份额
            </p>
          </div>
          <WalletConnect />
        </div>

        {!isConnected ? (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center">
            <p className="text-sm text-slate-300 mb-3">
              请先连接钱包以查看你的持仓。
            </p>
            <WalletConnect />
          </div>
        ) : loading ? (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center text-sm text-slate-300">
            正在加载持仓…
          </div>
        ) : error ? (
          <div className="glass-effect border border-red-500/60 rounded-2xl px-6 py-8 text-center text-sm text-red-200">
            {error}
          </div>
        ) : holdings.length === 0 ? (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center text-sm text-slate-300">
            当前钱包在平台上尚未持有任何资产份额。
          </div>
        ) : (
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-4 py-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700/60">
                  <th className="py-3 text-left font-normal">资产</th>
                  <th className="py-3 text-right font-normal">持有份额</th>
                  <th className="py-3 text-right font-normal">单份价格 (MNT)</th>
                  <th className="py-3 text-right font-normal">估算持仓价值 (MNT)</th>
                  <th className="py-3 text-right font-normal">操作</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map(({ asset, balance, value }) => (
                  <tr
                    key={asset.id}
                    className="border-b border-slate-800/40 last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {asset.brand} {asset.model}
                        </span>
                        <span className="text-xs text-slate-500 mt-1">
                          {asset.assetType === "watch" ? "名表" : "珠宝"} ·{" "}
                          {asset.year ?? "年份未知"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right">{balance}</td>
                    <td className="py-3 text-right">{asset.pricePerShare}</td>
                    <td className="py-3 text-right">{value}</td>
                    <td className="py-3 text-right">
                      <a
                        href={`/assets/${asset.id}`}
                        className="text-xs text-sky-400 hover:text-sky-300"
                      >
                        查看详情
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}


