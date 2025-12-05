"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount, useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { mantleSepoliaTestnet, mantleSepoliaMetaMaskConfig } from "@/lib/web3/config";
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

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  // 使用 wagmi hooks（必须在 WagmiProvider 内部）
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: hash, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [investAmount, setInvestAmount] = useState("");
  const [investing, setInvesting] = useState(false);
  const [investError, setInvestError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAsset() {
      try {
        const res = await fetch(`${API_BASE}/api/assets/${params.id}`);
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: Asset = await res.json();
        setAsset(data);
      } catch (e: any) {
        setError(e.message ?? "Failed to load asset");
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchAsset();
    }
  }, [params.id]);

  const handleInvest = async () => {
    if (!asset || !isConnected || !address) {
      setInvestError("请先连接钱包");
      return;
    }

    if (!asset.tokenAddress) {
      setInvestError("资产合约地址不存在，无法投资");
      return;
    }

    // 检查网络
    if (chainId !== mantleSepoliaTestnet.id) {
      setInvestError("请切换到 Mantle Sepolia 测试网");
      try {
        // 尝试切换网络
        await switchChain({ chainId: mantleSepoliaTestnet.id });
      } catch (error: any) {
        // 如果网络不存在，尝试添加网络
        if (error?.code === 4902 || error?.message?.includes('Unrecognized chain')) {
          try {
            await (window as any).ethereum?.request({
              method: 'wallet_addEthereumChain',
              params: [mantleSepoliaMetaMaskConfig],
            });
            // 网络添加后，再次尝试切换
            await switchChain({ chainId: mantleSepoliaTestnet.id });
          } catch (addError) {
            setInvestError("请手动在 MetaMask 中添加 Mantle Sepolia 网络");
            return;
          }
        } else {
          setInvestError("网络切换失败，请手动切换");
          return;
        }
      }
      return;
    }

    if (!investAmount || parseFloat(investAmount) <= 0) {
      setInvestError("请输入有效的投资金额");
      return;
    }

    const shares = calculateShares(investAmount);
    if (parseInt(shares) <= 0) {
      setInvestError(`投资金额至少需要 $${asset.pricePerShare} 才能购买 1 份`);
      return;
    }

    setInvesting(true);
    setInvestError(null);

    try {
      // 计算需要购买的代币数量（基于份数）
      // 假设 1 份 = 1 个代币（最小单位），实际应该根据代币的 decimals 来计算
      const tokenAmount = parseEther(shares);

      // 调用合约的 buyTokens 函数
      // 需要发送 MNT（value）来购买代币
      writeContract({
        address: asset.tokenAddress as `0x${string}`,
        abi: luxuryTokenAbi,
        functionName: 'buyTokens',
        args: [tokenAmount],
        value: parseEther(investAmount), // 发送 MNT 支付购买费用
      });
    } catch (e: any) {
      setInvestError(e.message ?? "投资失败");
      setInvesting(false);
    }
  };

  // 监听交易状态
  useEffect(() => {
    if (isConfirmed) {
      setInvesting(false);
      setInvestAmount("");
      // 可以显示成功消息或刷新数据
      alert("投资成功！代币已发送到你的钱包。");
    }
  }, [isConfirmed]);

  const calculateShares = (amount: string) => {
    if (!asset || !amount || parseFloat(amount) <= 0) {
      return "0";
    }
    const price = parseFloat(asset.pricePerShare);
    const shares = Math.floor(parseFloat(amount) / price);
    return shares.toString();
  };

  // 在客户端挂载之前，显示加载状态
  if (!mounted || loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-300">加载资产详情中…</p>
      </main>
    );
  }

  if (error || !asset) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-6 py-4 max-w-md">
          <p className="text-sm font-semibold text-red-200 mb-1">
            {error ? "加载失败" : "资产不存在"}
          </p>
          <p className="text-xs text-red-300 break-all">{error || "未找到该资产"}</p>
          <button
            onClick={() => router.push("/assets")}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm"
          >
            返回资产列表
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
      <div className="max-w-4xl mx-auto">
        {/* 头部导航 */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-sm text-slate-400 hover:text-slate-200 transition"
          >
            ← 返回
          </button>
          <WalletConnect />
        </div>

        {/* 资产详情 */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* 左侧：资产信息 */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-5">
              <div className="mb-4">
                <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                  {asset.assetType === "watch" ? "名表" : "珠宝"}
                </div>
                <h1 className="text-3xl font-semibold mb-2">
                  {asset.brand} {asset.model}
                </h1>
                {asset.year && (
                  <p className="text-sm text-slate-400">{asset.year} 年</p>
                )}
              </div>

              {asset.description && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">资产描述</h3>
                  <p className="text-sm text-slate-400 whitespace-pre-line">
                    {asset.description}
                  </p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-800">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-500">单份价格</dt>
                    <dd className="font-semibold text-lg">{asset.pricePerShare} MNT</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">总份数</dt>
                    <dd>{asset.totalSupply}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">剩余可购</dt>
                    <dd>{asset.remainingSupply}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">状态</dt>
                    <dd>
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
                    </dd>
                  </div>
                </dl>
              </div>

              {asset.tokenAddress && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <div className="text-xs text-slate-500 mb-1">合约地址</div>
                  <div className="text-xs font-mono text-slate-400 break-all">
                    {asset.tokenAddress}
                  </div>
                  <a
                    href={`https://explorer.sepolia.mantle.xyz/address/${asset.tokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sky-400 hover:text-sky-300 mt-1 inline-block"
                  >
                    在区块浏览器查看 →
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：投资模块 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-5">
            <h2 className="text-xl font-semibold mb-4">投资此资产</h2>

            {asset.status !== "fundraising" && (
              <div className="mb-4 p-4 bg-amber-950/40 border border-amber-500/40 rounded-lg">
                <p className="text-sm text-amber-200">
                  此资产当前不在募集中，无法投资。
                </p>
              </div>
            )}

            {!isConnected && (
              <div className="mb-4 p-4 bg-blue-950/40 border border-blue-500/40 rounded-lg">
                <p className="text-sm text-blue-200 mb-3">
                  请先连接钱包以进行投资
                </p>
                <WalletConnect />
              </div>
            )}

            {chainId !== mantleSepoliaTestnet.id && isConnected && (
              <div className="mb-4 p-4 bg-orange-950/40 border border-orange-500/40 rounded-lg">
                <p className="text-sm text-orange-200 mb-3">
                  请切换到 Mantle Sepolia 测试网
                </p>
                <button
                  onClick={() => switchChain({ chainId: mantleSepoliaTestnet.id })}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white text-sm"
                >
                  切换网络
                </button>
              </div>
            )}

            {asset.status === "fundraising" && isConnected && chainId === mantleSepoliaTestnet.id && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    投资金额 (MNT)
                  </label>
                  <input
                    type="number"
                    value={investAmount}
                    onChange={(e) => setInvestAmount(e.target.value)}
                    step="0.01"
                    min={asset.pricePerShare}
                    placeholder={`最少 ${asset.pricePerShare} MNT`}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {investAmount && parseFloat(investAmount) > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                    将获得约 {calculateShares(investAmount)} 份代币（假设 1 份 = 1 代币）
                    </p>
                  )}
                </div>

                {investError && (
                  <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg">
                    <p className="text-xs text-red-200">{investError}</p>
                  </div>
                )}

                <button
                  onClick={handleInvest}
                  disabled={investing || isWriting || isConfirming || !investAmount || parseFloat(investAmount) <= 0}
                  className="w-full px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition"
                >
                  {isWriting ? "发送交易..." : isConfirming ? "等待确认..." : investing ? "处理中..." : "确认投资"}
                </button>

                {hash && (
                  <div className="mt-2 text-xs text-slate-400">
                    交易哈希: {hash.slice(0, 10)}...{hash.slice(-8)}
                    <a
                      href={`https://explorer.sepolia.mantle.xyz/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-sky-400 hover:text-sky-300"
                    >
                      查看 →
                    </a>
                  </div>
                )}

                <div className="text-xs text-slate-500 space-y-1">
                  <p>• 你需要发送 MNT 来购买代币份额</p>
                  <p>• 代币将从资产提供者转移到你的钱包地址</p>
                  <p>• 你支付的 MNT 会转给资产提供者</p>
                  <p>• 交易需要支付 Gas 费（额外的 MNT）</p>
                  <p>• 当前 UI 以 MNT 为单位展示金额（后续可接入预言机换算 USD）</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

