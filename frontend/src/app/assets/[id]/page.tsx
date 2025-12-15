"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount, useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
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
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const {
    writeContractAsync,
    data: hash,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isConfirmError,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
    chainId: mantleSepoliaTestnet.id,
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
  const [onchainAvailable, setOnchainAvailable] = useState<string | null>(null); // raw token units (uint256)

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

  // 从链上读取可售数量，确保校验与显示一致
  useEffect(() => {
    const loadOnchainAvailable = async () => {
      if (!asset?.tokenAddress || !publicClient) return;
      try {
        const available = await publicClient.readContract({
          address: asset.tokenAddress as `0x${string}`,
          abi: luxuryTokenAbi,
          functionName: "getAvailableTokens",
          chainId: mantleSepoliaTestnet.id,
        });
        setOnchainAvailable(available?.toString() ?? null);
      } catch (e) {
        // 读取失败时不阻塞，但清空链上值
        setOnchainAvailable(null);
      }
    };
    loadOnchainAvailable();
  }, [asset?.tokenAddress, publicClient]);

  const ensureMantleNetwork = async () => {
    // 优先使用 wagmi 切链，若不存在则添加后再切
    if (chainId === mantleSepoliaTestnet.id) return;

    try {
      if (switchChainAsync) {
        await switchChainAsync({ chainId: mantleSepoliaTestnet.id });
        return;
      }
      throw new Error("switchChain 不可用");
    } catch (error: any) {
      if (error?.code === 4902 || error?.message?.includes("Unrecognized chain")) {
        await (window as any).ethereum?.request({
          method: "wallet_addEthereumChain",
          params: [mantleSepoliaMetaMaskConfig],
        });
        if (switchChainAsync) {
          await switchChainAsync({ chainId: mantleSepoliaTestnet.id });
          return;
        }
      }
      throw error;
    }
  };

  const handleInvest = async () => {
    if (!asset || !isConnected || !address) {
      setInvestError("请先连接钱包");
      return;
    }

    if (!asset.tokenAddress) {
      setInvestError("资产合约地址不存在，无法投资");
      return;
    }

    // 检查/切换网络：失败则不发起交易
    if (chainId !== mantleSepoliaTestnet.id) {
      setInvestError("正在请求切换到 Mantle Sepolia，请在钱包确认");
      try {
        await ensureMantleNetwork();
      } catch (error: any) {
        setInvestError(error?.message || "网络切换失败，请在钱包手动切换到 Mantle Sepolia");
        setInvesting(false);
        return;
      }
      // 让用户在链切换完成后重新点击
      setInvesting(false);
      return;
    }

    if (!investAmount || parseFloat(investAmount) <= 0) {
      setInvestError("请输入有效的投资金额");
      return;
    }

    const shares = calculateShares(investAmount);
    const sharesInt = parseInt(shares);
    if (sharesInt <= 0) {
      setInvestError(`投资金额至少需要 $${asset.pricePerShare} 才能购买 1 份`);
      return;
    }
    // 计算需要购买的代币数量（基于份数）
    // 假设 1 份 = 1 个代币（最小单位 10^decimals），与合约保持一致
    const tokenAmount = parseEther(shares);

    // 校验剩余可购数量（优先使用链上可用量，单位 = 最小代币单位）
    const remainingOnchain = onchainAvailable ? BigInt(onchainAvailable) : null;
    if (remainingOnchain !== null && tokenAmount > remainingOnchain) {
      setInvestError(`剩余可购份数不足（链上剩余 ${formatEther(remainingOnchain)} 份），请减少投资金额`);
      return;
    }
    // 后端/页面的剩余数量是整份数，作为兜底
    const remainingOffchain = parseFloat(asset.remainingSupply);
    if (remainingOnchain === null && !Number.isNaN(remainingOffchain) && sharesInt > remainingOffchain) {
      setInvestError(`剩余可购份数不足（剩余 ${remainingOffchain}），请减少投资金额`);
      return;
    }

    setInvesting(true);
    setInvestError(null);

    try {
      // 调用合约的 buyTokens 函数；用户在 MetaMask 取消会抛错（code 4001）
      await writeContractAsync({
        address: asset.tokenAddress as `0x${string}`,
        abi: luxuryTokenAbi,
        functionName: 'buyTokens',
        args: [tokenAmount],
        chainId: mantleSepoliaTestnet.id,
        value: parseEther(investAmount), // 发送 MNT 支付购买费用
      });
    } catch (e: any) {
      const userRejected =
        e?.code === 4001 ||
        e?.message?.includes("User rejected") ||
        e?.message?.includes("User denied");
      const insufficient = e?.message?.includes("Insufficient tokens available");
      const message = userRejected
        ? "用户已取消交易"
        : insufficient
        ? "剩余代币数量不足，请减少投资金额或稍后再试"
        : e?.message ?? "投资失败";
      setInvestError(message);
      setInvesting(false);
      return;
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

  // 监听交易确认阶段的错误（例如链不匹配或用户拒绝）
  useEffect(() => {
    if (isConfirmError && confirmError) {
      const message =
        (confirmError as any)?.code === 4001 || confirmError.message?.includes("User rejected")
          ? "用户已取消交易"
          : confirmError.message ?? "交易确认失败";
      setInvestError(message);
      setInvesting(false);
    }
  }, [isConfirmError, confirmError]);

  // 监听写入错误（例如用户取消）
  useEffect(() => {
    if (writeError) {
      const message =
        (writeError as any)?.code === 4001 || writeError.message?.includes("User rejected")
          ? "用户已取消交易"
          : writeError.message ?? "投资失败";
      setInvestError(message);
      setInvesting(false);
    }
  }, [writeError]);

  const calculateShares = (amount: string) => {
    if (!asset || !amount || parseFloat(amount) <= 0) {
      return "0";
    }
    const price = parseFloat(asset.pricePerShare);
    const shares = Math.floor(parseFloat(amount) / price);
    return shares.toString();
  };

  // 展示用剩余份数（优先链上）
  const displayRemaining = onchainAvailable
    ? formatEther(BigInt(onchainAvailable))
    : asset?.remainingSupply ?? "0";

  // 在客户端挂载之前，显示加载状态
  if (!mounted || loading) {
    return (
      <main className="min-h-screen gradient-bg text-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto"></div>
          <p className="text-sm text-slate-300">加载资产详情中…</p>
        </div>
      </main>
    );
  }

  if (error || !asset) {
    return (
      <main className="min-h-screen gradient-bg text-slate-50 flex items-center justify-center px-6">
        <div className="glass-effect border border-red-500/40 rounded-2xl px-8 py-6 max-w-md text-center space-y-4">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="text-lg font-semibold text-red-200">
            {error ? "加载失败" : "资产不存在"}
          </p>
          <p className="text-sm text-red-300 break-all">{error || "未找到该资产"}</p>
          <button
            onClick={() => router.push("/assets")}
            className="mt-4 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-xl text-white text-sm font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-red-500/50"
          >
            返回资产列表
          </button>
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
        {/* 头部导航 */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-sm text-slate-400 hover:text-slate-200 transition"
          >
            ← 返回
          </button>
          <WalletConnect />
        </div>

        {/* 资产详情 */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* 左侧：资产信息 */}
          <div className="space-y-6">
            <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-6 py-5 relative overflow-hidden">
              {/* 背景渐变 */}
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5"></div>
              <div className="relative z-10">
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
                    <dd>{displayRemaining}</dd>
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
          </div>

          {/* 右侧：投资模块 */}
          <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-6 py-5 relative overflow-hidden">
            {/* 背景渐变 */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5"></div>
            <div className="relative z-10">
            <h2 className="text-xl font-semibold mb-4 gradient-text">投资此资产</h2>

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
                  className="group relative w-full px-6 py-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 disabled:shadow-none"
                >
                  <span className="relative z-10">
                    {isWriting ? "发送交易..." : isConfirming ? "等待确认..." : investing ? "处理中..." : "确认投资"}
                  </span>
                  <span className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
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
      </div>
    </main>
  );
}

