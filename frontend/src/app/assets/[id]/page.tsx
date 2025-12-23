"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { parseEther, formatEther } from "viem";
import { mantleSepoliaTestnet, mantleSepoliaMetaMaskConfig } from "@/lib/web3/config";
import { luxuryTokenAbi } from "@/lib/web3/contracts";
import WalletConnect from "@/components/WalletConnect";
import PageContainer from "@/components/PageContainer";
import TechCard from "@/components/TechCard";
import TechButton from "@/components/TechButton";
import Model3DViewer from "@/components/Model3DViewer";

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
  imageUrls?: string | null;
  model3dUrl?: string | null;
  authentications?: Array<{
    id: string;
    authenticationStatus: string;
    authenticatorName: string;
    authenticatorType: string;
    verificationDate: string | null;
    reportUrl: string | null;
    reportHash: string | null;
    verifierSignature: string | null;
    notes: string | null;
  }>;
  custody?: {
    id: string;
    custodyStatus: string;
    custodyOrganization: string;
    warehouseLocation: string | null;
    entryDate: string | null;
    facilityStandards: string | null;
  } | null;
  insurance?: {
    id: string;
    insuranceCompany: string;
    policyNumber: string | null;
    coverageAmount: string;
    coverageCurrency: string;
    policyStartDate: string;
    policyEndDate: string;
    coverageType: string | null;
    isActive: boolean;
  } | null;
  valuations?: Array<{
    id: string;
    valuationAmount: string;
    valuationCurrency: string;
    valuationDate: string | null;
    valuationAgency: string | null;
    reportUrl: string | null;
  }>;
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
  const [kycStatus, setKycStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [kycLoading, setKycLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"image" | "3d">("image"); // 图片或3D模型查看模式

  useEffect(() => {
    async function fetchAsset() {
      try {
        const res = await fetch(`${API_BASE}/api/assets/${params.id}`);
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: Asset = await res.json();
        
        // 获取估值报告
        try {
          const valuationsRes = await fetch(`${API_BASE}/api/assets/${params.id}/valuations`);
          if (valuationsRes.ok) {
            const valuations = await valuationsRes.json();
            data.valuations = valuations;
          }
        } catch (e) {
          console.error("Failed to fetch valuations:", e);
        }
        
        setAsset(data);
        setError(null);
        setRetryCount(0); // 成功后重置重试计数
      } catch (e: any) {
        const errorMessage = e.message ?? "加载资产失败";
        setError(errorMessage);
        // 如果是网络错误且重试次数少于3次，自动重试
        if (retryCount < 3 && (errorMessage.includes("fetch") || errorMessage.includes("network"))) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            fetchAsset();
          }, 2000 * (retryCount + 1)); // 递增延迟：2s, 4s, 6s
        }
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchAsset();
    }
  }, [params.id, retryCount]);

  // 加载当前钱包的 KYC / AML 状态
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

    // 前端强制检查 KYC / AML 状态
    if (kycStatus !== "approved") {
      setInvestError("请先完成 KYC / AML 审核再进行投资");
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
      // 成功后记录投资到后端
      if (asset && address && hash && investAmount) {
        const shares = calculateShares(investAmount);
        fetch(`${API_BASE}/api/portfolio/investment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userAddress: address,
            assetId: asset.id,
            tokenAddress: asset.tokenAddress,
            investedAmountMnt: investAmount,
            shares,
            txHash: hash,
          }),
        }).catch(() => {
          // 记录失败不影响链上交易
        });
      }
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
      <PageContainer
        title="资产详情"
        subtitle="加载中..."
        maxWidth="7xl"
      >
        <div className="text-center space-y-4 py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
          <p className="text-sm text-slate-300">加载资产详情中…</p>
          {retryCount > 0 && (
            <p className="text-xs text-slate-500">正在重试 ({retryCount}/3)...</p>
          )}
        </div>
      </PageContainer>
    );
  }

  if (error || !asset) {
    return (
      <PageContainer
        title="资产详情"
        subtitle=""
        maxWidth="7xl"
      >
        <div className="glass-effect border border-red-500/40 rounded-2xl px-8 py-6 max-w-md mx-auto text-center space-y-4">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="text-lg font-semibold text-red-200">
            {error ? "加载失败" : "资产不存在"}
          </p>
          <p className="text-sm text-red-300 break-all mb-4">{error || "未找到该资产"}</p>
          <div className="flex gap-3 justify-center">
            {error && (
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  // 重新加载
                  const fetchAsset = async () => {
                    try {
                      const res = await fetch(`${API_BASE}/api/assets/${params.id}`);
                      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
                      const data: Asset = await res.json();
                      setAsset(data);
                      setError(null);
                    } catch (e: any) {
                      setError(e.message ?? "加载资产失败");
                    } finally {
                      setLoading(false);
                    }
                  };
                  fetchAsset();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-colors"
              >
                重试
              </button>
            )}
            <button
              onClick={() => router.push("/assets")}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-colors"
            >
              返回资产列表
            </button>
          </div>
        </div>
      </PageContainer>
    );
  }

  // 确保 asset 存在后再处理
  if (!asset) {
    return null;
  }

  // 计算 hero image URL
  const getHeroImage = () => {
    if (asset.imageUrls) {
      try {
        const arr = JSON.parse(asset.imageUrls);
        if (Array.isArray(arr) && arr.length > 0) {
          const url = arr[0];
          // 如果是相对路径，拼接后端地址
          if (url.startsWith('/uploads/')) {
            return `${API_BASE}${url}`;
          }
          return url;
        }
      } catch {
        // ignore
      }
    }
    if (asset.assetType === "watch") {
      return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80";
    }
    if (asset.assetType === "jewelry") {
      return "https://images.unsplash.com/photo-1506634064465-1c59a0a51ee3?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80";
  };
  
  const heroImage = getHeroImage();

  return (
    <PageContainer
      title={asset.name || "资产详情"}
      subtitle={asset.description || ""}
      maxWidth="7xl"
    >
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
              {/* 查看模式切换按钮 */}
              {asset.model3dUrl && (
                <div className="mb-3 flex gap-2">
                  <button
                    onClick={() => setViewMode("image")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      viewMode === "image"
                        ? "bg-sky-600 text-white"
                        : "bg-slate-800/50 text-slate-300 hover:bg-slate-700/50"
                    }`}
                  >
                    图片
                  </button>
                  <button
                    onClick={() => setViewMode("3d")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      viewMode === "3d"
                        ? "bg-sky-600 text-white"
                        : "bg-slate-800/50 text-slate-300 hover:bg-slate-700/50"
                    }`}
                  >
                    3D模型
                  </button>
                </div>
              )}
              
              <div className="overflow-hidden rounded-xl mb-4 border border-slate-800/60 shadow-inner">
                {viewMode === "3d" && asset.model3dUrl ? (
                  <div className="h-96 w-full">
                    <Model3DViewer 
                      modelUrl={asset.model3dUrl} 
                      autoRotate={true}
                      className="rounded-xl"
                    />
                  </div>
                ) : (
                  <div
                    className="h-56 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${heroImage})` }}
                  />
                )}
              </div>
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
                            : asset.status === "registered"
                            ? "border-blue-400/60 text-blue-200 bg-blue-500/10"
                            : "border-slate-500/60 text-slate-200 bg-slate-500/10"
                        }`}
                      >
                        {asset.status === "fundraising"
                          ? "募集中"
                          : asset.status === "funded"
                          ? "已满额"
                          : asset.status === "registered"
                          ? "待认证"
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

              {/* 真伪认证与估值信息 */}
              {asset.authentications && asset.authentications.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">真伪认证与估值</h3>
                  <div className="space-y-3">
                    {asset.authentications.map((auth) => (
                      <div
                        key={auth.id}
                        className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-sm font-medium text-slate-200">
                              {auth.authenticatorName}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {auth.authenticatorType === "official_brand"
                                ? "官方品牌认证"
                                : auth.authenticatorType === "third_party"
                                ? "第三方机构认证"
                                : "AI 系统认证"}
                            </div>
                          </div>
                          <span
                            className={`text-xs rounded-full px-2 py-1 border ${
                              auth.authenticationStatus === "verified"
                                ? "border-emerald-400/60 text-emerald-200 bg-emerald-500/10"
                                : auth.authenticationStatus === "rejected"
                                ? "border-red-400/60 text-red-200 bg-red-500/10"
                                : "border-amber-400/60 text-amber-200 bg-amber-500/10"
                            }`}
                          >
                            {auth.authenticationStatus === "verified"
                              ? "已认证"
                              : auth.authenticationStatus === "rejected"
                              ? "已拒绝"
                              : "待审核"}
                          </span>
                        </div>
                        {auth.verificationDate && (
                          <div className="text-xs text-slate-500 mb-2">
                            认证日期: {new Date(auth.verificationDate).toLocaleDateString("zh-CN")}
                          </div>
                        )}
                        {auth.reportUrl && (
                          <a
                            href={auth.reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-sky-400 hover:text-sky-300 inline-block mt-1"
                          >
                            查看认证报告 →
                          </a>
                        )}
                        {auth.reportHash && (
                          <div className="text-xs text-slate-500 mt-1 font-mono">
                            报告哈希: {auth.reportHash.slice(0, 20)}...
                          </div>
                        )}
                        {auth.notes && (
                          <div className="text-xs text-slate-400 mt-2 whitespace-pre-line">
                            {auth.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!asset.authentications || asset.authentications.length === 0) && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">真伪认证与估值</h3>
                  <p className="text-xs text-slate-500">
                    暂无认证信息
                  </p>
                </div>
              )}

              {/* 估值报告 */}
              {asset.valuations && asset.valuations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">估值报告</h3>
                  <div className="space-y-3">
                    {asset.valuations.map((valuation) => (
                      <div
                        key={valuation.id}
                        className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-sm font-medium text-slate-200">
                              {valuation.valuationAgency || "估值机构"}
                            </div>
                            {valuation.valuationDate && (
                              <div className="text-xs text-slate-400 mt-1">
                                估值日期: {new Date(valuation.valuationDate).toLocaleDateString("zh-CN")}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-emerald-400">
                              {parseFloat(valuation.valuationAmount).toLocaleString("zh-CN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              {valuation.valuationCurrency || "USD"}
                            </div>
                          </div>
                        </div>
                        {valuation.reportUrl && (
                          <a
                            href={valuation.reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-sky-400 hover:text-sky-300 inline-block mt-2"
                          >
                            查看完整估值报告 →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 托管与保险信息 */}
              {(asset.custody || asset.insurance) && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">托管与保险</h3>
                  <div className="space-y-3">
                    {asset.custody && (
                      <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-sm font-medium text-slate-200">
                              托管机构：{asset.custody.custodyOrganization}
                            </div>
                            {asset.custody.warehouseLocation && (
                              <div className="text-xs text-slate-400 mt-1">
                                仓储位置：{asset.custody.warehouseLocation}
                              </div>
                            )}
                            {asset.custody.entryDate && (
                              <div className="text-xs text-slate-400 mt-1">
                                入库日期：{new Date(asset.custody.entryDate).toLocaleDateString("zh-CN")}
                              </div>
                            )}
                            {asset.custody.facilityStandards && (
                              <div className="text-xs text-slate-400 mt-1">
                                设施标准：{asset.custody.facilityStandards}
                              </div>
                            )}
                          </div>
                          <span
                            className={`text-xs rounded-full px-2 py-1 border ${
                              asset.custody.custodyStatus === "in_custody"
                                ? "border-emerald-400/60 text-emerald-200 bg-emerald-500/10"
                                : "border-slate-400/60 text-slate-200 bg-slate-500/10"
                            }`}
                          >
                            {asset.custody.custodyStatus === "in_custody"
                              ? "托管中"
                              : asset.custody.custodyStatus === "for_sale"
                              ? "待售"
                              : asset.custody.custodyStatus === "sold"
                              ? "已售"
                              : "已注册"}
                          </span>
                        </div>
                      </div>
                    )}

                    {asset.insurance && asset.insurance.isActive && (
                      <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-sm font-medium text-slate-200">
                              保险公司：{asset.insurance.insuranceCompany}
                            </div>
                            {asset.insurance.policyNumber && (
                              <div className="text-xs text-slate-400 mt-1">
                                保单号：{asset.insurance.policyNumber}
                              </div>
                            )}
                            <div className="text-xs text-slate-400 mt-1">
                              保额：{parseFloat(asset.insurance.coverageAmount).toLocaleString()} {asset.insurance.coverageCurrency}
                            </div>
                            {asset.insurance.coverageType && (
                              <div className="text-xs text-slate-400 mt-1">
                                保险类型：{asset.insurance.coverageType}
                              </div>
                            )}
                            <div className="text-xs text-slate-400 mt-1">
                              有效期：{new Date(asset.insurance.policyStartDate).toLocaleDateString("zh-CN")} - {new Date(asset.insurance.policyEndDate).toLocaleDateString("zh-CN")}
                            </div>
                          </div>
                          <span className="text-xs rounded-full px-2 py-1 border border-emerald-400/60 text-emerald-200 bg-emerald-500/10">
                            有效
                          </span>
                        </div>
                      </div>
                    )}

                    {(!asset.custody && !asset.insurance) && (
                      <p className="text-xs text-slate-500">
                        暂无托管和保险信息
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(!asset.custody && !asset.insurance) && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">托管与保险</h3>
                  <p className="text-xs text-slate-500">
                    暂无托管和保险信息
                  </p>
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

            {/* 检查资产是否符合投资条件 */}
            {(() => {
              const hasVerifiedAuth = asset.authentications && asset.authentications.some(
                (auth) => auth.authenticationStatus === "verified"
              );
              const hasCustody = asset.custody != null;
              const hasInsurance = asset.insurance != null && asset.insurance.isActive;
              const canInvest = asset.status === "fundraising" && hasVerifiedAuth && hasCustody && hasInsurance;
              
              if (!canInvest) {
                if (asset.status === "registered") {
                  return (
                    <div className="mb-4 p-4 bg-blue-950/40 border border-blue-500/40 rounded-lg">
                      <p className="text-sm text-blue-200">
                        此资产正在等待认证审核，认证通过后才能开始募集。
                      </p>
                    </div>
                  );
                }
                if (!hasVerifiedAuth) {
                  return (
                    <div className="mb-4 p-4 bg-amber-950/40 border border-amber-500/40 rounded-lg">
                      <p className="text-sm text-amber-200">
                        此资产尚未通过真伪认证，无法投资。
                      </p>
                    </div>
                  );
                }
                if (!hasCustody) {
                  return (
                    <div className="mb-4 p-4 bg-amber-950/40 border border-amber-500/40 rounded-lg">
                      <p className="text-sm text-amber-200">
                        此资产尚未进入托管，为保障资产安全，无法投资。
                      </p>
                    </div>
                  );
                }
                if (!hasInsurance) {
                  return (
                    <div className="mb-4 p-4 bg-amber-950/40 border border-amber-500/40 rounded-lg">
                      <p className="text-sm text-amber-200">
                        此资产尚未购买保险，为保障投资者权益，无法投资。
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="mb-4 p-4 bg-amber-950/40 border border-amber-500/40 rounded-lg">
                    <p className="text-sm text-amber-200">
                      此资产当前不在募集中，无法投资。
                    </p>
                  </div>
                );
              }
              return null;
            })()}

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

            {(() => {
              const hasVerifiedAuth = asset.authentications && asset.authentications.some(
                (auth) => auth.authenticationStatus === "verified"
              );
              const hasCustody = asset.custody != null;
              const hasInsurance = asset.insurance != null && asset.insurance.isActive;
              const canInvest = asset.status === "fundraising" && hasVerifiedAuth && hasCustody && hasInsurance;
              return canInvest && isConnected && chainId === mantleSepoliaTestnet.id;
            })() && (
              <div className="space-y-4">
                {kycStatus !== "approved" && (
                  <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-lg text-sm text-amber-200">
                    为符合合规要求，你需要先完成{" "}
                    <a
                      href="/kyc"
                      className="underline text-amber-100 hover:text-amber-50"
                    >
                      KYC / AML 审核
                    </a>
                    ，通过后才能进行投资。
                  </div>
                )}
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
                  disabled={
                    investing ||
                    isWriting ||
                    isConfirming ||
                    !investAmount ||
                    parseFloat(investAmount) <= 0 ||
                    kycStatus !== "approved" ||
                    kycLoading
                  }
                  className="group relative w-full px-6 py-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 disabled:shadow-none"
                >
                  <span className="relative z-10">
                    {kycLoading
                      ? "检查 KYC / AML 状态..."
                      : kycStatus !== "approved"
                      ? "请先完成 KYC / AML"
                      : isWriting
                      ? "发送交易..."
                      : isConfirming
                      ? "等待确认..."
                      : investing
                      ? "处理中..."
                      : "确认投资"}
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

        {/* 风险提示与合规说明 */}
        <div className="mt-8 card-hover glass-effect rounded-2xl border border-slate-700/50 px-6 py-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-red-500/5"></div>
          <div className="relative z-10">
            <h2 className="text-2xl font-semibold mb-6 gradient-text">风险提示与合规说明</h2>
            
            <div className="space-y-6">
              {/* 重要风险提示 */}
              <div className="p-5 bg-red-950/20 border border-red-500/30 rounded-xl">
                <div className="flex items-start gap-3 mb-3">
                  <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-lg font-semibold text-red-300 mb-2">重要风险提示</h3>
                    <p className="text-sm text-red-200/80 leading-relaxed">
                      投资奢侈品 RWA 代币存在多种风险，包括但不限于市场风险、流动性风险、技术风险、监管风险等。
                      请仔细阅读以下风险揭示，充分了解投资风险后再做出投资决策。
                    </p>
                  </div>
                </div>
              </div>

              {/* 风险类型 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-200">投资风险类型</h3>
                
                <div className="grid gap-4 md:grid-cols-2">
                  {/* 市场风险 */}
                  <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <h4 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                      </svg>
                      市场风险
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      奢侈品市场价格受多种因素影响，包括品牌价值、市场供需、经济环境等。
                      资产价值可能出现波动，投资本金可能遭受损失。
                    </p>
                  </div>

                  {/* 流动性风险 */}
                  <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <h4 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      流动性风险
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      代币可能缺乏足够的市场流动性，导致难以在需要时以合理价格出售。
                      资产退出可能需要较长时间，或需等待资产整体出售。
                    </p>
                  </div>

                  {/* 技术风险 */}
                  <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <h4 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                      </svg>
                      技术风险
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      区块链技术、智能合约、钱包安全等存在技术风险。
                      可能面临黑客攻击、智能合约漏洞、私钥丢失等风险。
                    </p>
                  </div>

                  {/* 监管风险 */}
                  <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <h4 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      监管风险
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      各国对数字资产和 RWA 的监管政策可能发生变化。
                      监管变化可能影响代币交易、持有或收益分配的合法性。
                    </p>
                  </div>
                </div>
              </div>

              {/* 合规要求 */}
              <div className="pt-4 border-t border-slate-800">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">合规要求</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                    <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-slate-200 mb-1">KYC / AML 要求</h4>
                      <p className="text-xs text-slate-400">
                        所有投资者必须完成 KYC（了解你的客户）和 AML（反洗钱）审核。
                        未通过审核的用户无法购买或持有代币。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                    <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-slate-200 mb-1">投资者适当性</h4>
                      <p className="text-xs text-slate-400">
                        本产品适合具有一定风险承受能力和投资经验的投资者。
                        请根据自身情况评估是否适合投资。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                    <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-slate-200 mb-1">税务责任</h4>
                      <p className="text-xs text-slate-400">
                        投资者需自行承担投资收益的税务申报责任。
                        平台提供交易记录导出功能，方便用户完成税务申报。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 免责声明 */}
              <div className="pt-4 border-t border-slate-800">
                <h3 className="text-lg font-semibold text-slate-200 mb-3">免责声明</h3>
                <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                  <p className="text-xs text-slate-400 leading-relaxed space-y-2">
                    <span className="block">
                      1. 本平台不对任何投资损失承担责任。投资决策由投资者自行做出，投资风险由投资者自行承担。
                    </span>
                    <span className="block">
                      2. 平台提供的资产信息、估值报告等仅供参考，不构成投资建议。
                    </span>
                    <span className="block">
                      3. 代币价格可能因市场因素波动，过往表现不代表未来收益。
                    </span>
                    <span className="block">
                      4. 投资者应充分了解区块链技术和数字资产的特点，谨慎投资。
                    </span>
                    <span className="block">
                      5. 如遇监管政策变化，平台可能暂停或终止相关服务。
                    </span>
                  </p>
                </div>
              </div>

              {/* 法律文件链接 */}
              <div className="pt-4 border-t border-slate-800">
                <h3 className="text-lg font-semibold text-slate-200 mb-3">相关法律文件</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <Link
                    href="/legal/terms-of-use"
                    className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:border-slate-600/50 transition-colors group"
                  >
                    <div className="text-sm font-medium text-slate-200 mb-1 group-hover:text-sky-300 transition-colors">
                      使用条款
                    </div>
                    <div className="text-xs text-slate-500">
                      平台服务使用条款和条件
                    </div>
                  </Link>
                  <Link
                    href="/legal/risk-disclosure"
                    className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:border-slate-600/50 transition-colors group"
                  >
                    <div className="text-sm font-medium text-slate-200 mb-1 group-hover:text-sky-300 transition-colors">
                      风险揭示书
                    </div>
                    <div className="text-xs text-slate-500">
                      完整的投资风险提示和免责声明
                    </div>
                  </Link>
                  <Link
                    href="/legal/investor-suitability"
                    className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:border-slate-600/50 transition-colors group"
                  >
                    <div className="text-sm font-medium text-slate-200 mb-1 group-hover:text-sky-300 transition-colors">
                      投资者适当性说明
                    </div>
                    <div className="text-xs text-slate-500">
                      适合性评估和投资建议
                    </div>
                  </Link>
                </div>
              </div>

              {/* 确认提示 */}
              <div className="pt-4 border-t border-slate-800">
                <div className="p-4 bg-blue-950/20 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-blue-300 mb-1">投资确认</h4>
                      <p className="text-xs text-blue-200/80">
                        点击"确认投资"即表示您已充分理解并接受上述所有风险提示和合规要求，
                        同意承担投资风险，并确认您符合投资者适当性要求。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </PageContainer>
  );
}

