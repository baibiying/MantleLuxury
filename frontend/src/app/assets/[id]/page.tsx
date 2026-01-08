"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { parseEther, formatEther } from "viem";
import { mantleSepoliaTestnet, mantleSepoliaMetaMaskConfig } from "@/lib/web3/config";
import { luxuryTokenAbi } from "@/lib/web3/contracts";
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
  const [retryCount, setRetryCount] = useState(0); // 重试计数
  const [activeImageIndex, setActiveImageIndex] = useState(0); // 当前展示的图片索引
  const [showInvestPanel, setShowInvestPanel] = useState(false); // 是否显示投资面板
  const [agreedToRisks, setAgreedToRisks] = useState(false); // 是否同意风险提示
  const [showImageModal, setShowImageModal] = useState(false); // 是否显示图片查看模态框
  const [modalImageIndex, setModalImageIndex] = useState(0); // 模态框中显示的图片索引
  const [imageIndices, setImageIndices] = useState<number[]>([]); // 从数据库获取的图片索引列表
  const [imageLoading, setImageLoading] = useState<{ [key: number]: boolean }>({}); // 图片加载状态
  const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>({}); // 图片加载错误状态
  const [modalImageLoading, setModalImageLoading] = useState(false); // 模态框图片加载状态
  const imageLoadingRef = useRef<{ [key: number]: boolean }>({}); // 用于 useEffect 的 ref
  const imageErrorsRef = useRef<{ [key: number]: boolean }>({}); // 用于 useEffect 的 ref
  const imageIndicesRef = useRef<number[]>([]); // 用于存储上一次的 imageIndices

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
        
        // 尝试从数据库获取图片索引列表
        try {
          const imagesRes = await fetch(`${API_BASE}/api/assets/${params.id}/images`);
          if (imagesRes.ok) {
            const indices: number[] = await imagesRes.json();
            setImageIndices(indices);
          }
        } catch (e) {
          console.error("Failed to fetch image indices:", e);
        }
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

  // 计算 hero image URL（必须在所有 hooks 之前定义）
  const getDefaultImage = () => {
    if (!asset) {
      return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80";
    }
    if (asset.assetType === "watch") {
      return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80";
    }
    if (asset.assetType === "jewelry") {
      return "https://images.unsplash.com/photo-1506634064465-1c59a0a51ee3?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80";
  };

  // 使用 useMemo 稳定 imageList 的引用，避免 useEffect 无限循环
  // 必须在所有早期返回之前调用
  const imageList = useMemo(() => {
    if (!asset) return [];
    
    // 如果 imageUrls 存在，先解析它（可能是旧的 /uploads/ 路径或新的 API 路径）
    const urlsFromJson: string[] = [];
    if (asset.imageUrls) {
      try {
        const arr = JSON.parse(asset.imageUrls);
        if (Array.isArray(arr) && arr.length > 0) {
          arr.forEach((url: string, index: number) => {
            if (!url) return;
            // 如果是旧的 /uploads/ 路径，直接使用文件系统路径（兼容旧图片）
            if (url.startsWith("/uploads/")) {
              urlsFromJson.push(`${API_BASE}${url}`);
            } else if (url.startsWith("/api/assets/")) {
              // 如果已经是新的 API 路径，直接使用
              urlsFromJson.push(url.startsWith("http") ? url : `${API_BASE}${url}`);
            } else if (url.startsWith("image:")) {
              // 如果是临时图片格式（这种情况应该不会出现，因为后端已经更新了）
              // 但为了兼容，尝试从数据库获取
              if (asset.id) {
                urlsFromJson.push(`${API_BASE}/api/assets/${asset.id}/images/${index}`);
              }
            } else {
              // 外部URL，直接使用
              urlsFromJson.push(url);
            }
          });
        }
      } catch {
        // ignore
      }
    }
    
    // 如果从 JSON 解析到了 URL，使用它们
    if (urlsFromJson.length > 0) {
      return urlsFromJson;
    }
    
    // 否则，使用从数据库获取的图片索引列表
    if (imageIndices.length > 0 && asset.id) {
      return imageIndices.map(index => `${API_BASE}/api/assets/${asset.id}/images/${index}`);
    }
    
    // 如果都没有，尝试索引 0（兼容旧数据）
    if (asset.id) {
      return [`${API_BASE}/api/assets/${asset.id}/images/0`];
    }
    
    return [];
    // 使用 imageIndices 的长度和字符串表示来稳定依赖项
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id, asset?.imageUrls, asset?.assetType, imageIndices.length, imageIndices.join(',')]);
  
  // 使用 useMemo 稳定 heroImage
  const heroImage = useMemo(() => {
    return imageList[activeImageIndex] ?? getDefaultImage();
  }, [imageList, activeImageIndex]);

  // 同步 ref 和 state（必须在所有早期返回之前）
  useEffect(() => {
    imageLoadingRef.current = imageLoading;
  }, [imageLoading]);
  
  useEffect(() => {
    imageErrorsRef.current = imageErrors;
  }, [imageErrors]);

  // 预加载图片：当图片列表或当前索引变化时，预加载当前和相邻图片
  useEffect(() => {
    if (!imageList || imageList.length === 0) return;
    
    // 预加载当前图片
    const currentImageUrl = imageList[activeImageIndex];
    if (currentImageUrl) {
      const img = new Image();
      img.onload = () => {
        setImageLoading(prev => ({ ...prev, [activeImageIndex]: false }));
      };
      img.onerror = () => {
        setImageLoading(prev => ({ ...prev, [activeImageIndex]: false }));
        setImageErrors(prev => ({ ...prev, [activeImageIndex]: true }));
      };
      // 只有在图片还没有加载过且没有错误时才设置加载状态
      const currentLoading = imageLoadingRef.current[activeImageIndex];
      const currentError = imageErrorsRef.current[activeImageIndex];
      if (!currentLoading && !currentError) {
        setImageLoading(prev => ({ ...prev, [activeImageIndex]: true }));
      }
      img.src = currentImageUrl;
    }
    
    // 预加载下一张图片
    if (activeImageIndex < imageList.length - 1) {
      const nextImageUrl = imageList[activeImageIndex + 1];
      if (nextImageUrl) {
        const img = new Image();
        img.src = nextImageUrl;
      }
    }
    
    // 预加载上一张图片
    if (activeImageIndex > 0) {
      const prevImageUrl = imageList[activeImageIndex - 1];
      if (prevImageUrl) {
        const img = new Image();
        img.src = prevImageUrl;
      }
    }
  }, [activeImageIndex, imageList]);

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

  // 确保 asset 存在后再处理（在早期返回之前，所有 hooks 必须已经调用）
  if (!asset) {
    return null;
  }

  return (
    <PageContainer
      title={`${asset.brand} ${asset.model}` || "资产详情"}
      subtitle={asset.description || ""}
      maxWidth="7xl"
    >
      {/* 头部导航 + 右上角投资按钮 */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-400 hover:text-slate-200 transition"
        >
          ← 返回
        </button>
        <button
          onClick={() => {
            setAgreedToRisks(false);
            setShowInvestPanel(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-colors"
        >
          <span>投资此资产</span>
        </button>
      </div>

      {/* 资产详情：占据整页宽度 */}
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
              
              <div className="overflow-hidden rounded-xl mb-4 border border-slate-800/60 shadow-inner bg-slate-900">
                {viewMode === "3d" && asset.model3dUrl ? (
                  <div className="h-96 w-full">
                    <Model3DViewer
                      modelUrl={asset.model3dUrl}
                      autoRotate={true}
                      className="rounded-xl"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div
                      className="relative h-64 w-full cursor-pointer hover:opacity-90 transition-opacity bg-slate-900/50 rounded-lg overflow-hidden"
                      onClick={() => {
                        setModalImageIndex(activeImageIndex);
                        setShowImageModal(true);
                      }}
                    >
                      {imageLoading[activeImageIndex] && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
                          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400"></div>
                        </div>
                      )}
                      {imageErrors[activeImageIndex] ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
                          <div className="text-center">
                            <svg className="w-12 h-12 text-slate-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-xs text-slate-400">图片加载失败</p>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={heroImage}
                          alt={`${asset.brand} ${asset.model}`}
                          className="w-full h-full object-cover"
                          loading="eager"
                          onLoad={() => {
                            setImageLoading(prev => ({ ...prev, [activeImageIndex]: false }));
                          }}
                          onError={() => {
                            setImageLoading(prev => ({ ...prev, [activeImageIndex]: false }));
                            setImageErrors(prev => ({ ...prev, [activeImageIndex]: true }));
                          }}
                          onLoadStart={() => {
                            setImageLoading(prev => ({ ...prev, [activeImageIndex]: true }));
                            setImageErrors(prev => ({ ...prev, [activeImageIndex]: false }));
                          }}
                        />
                      )}
                    </div>
                    {imageList.length > 1 && (
                      <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-800 overflow-x-auto bg-slate-900/80">
                        {imageList.map((url, idx) => (
                          <button
                            key={`${url}-${idx}`}
                            onClick={() => {
                              setActiveImageIndex(idx);
                              // 预加载下一张图片
                              if (idx < imageList.length - 1) {
                                const nextUrl = imageList[idx + 1];
                                const img = new Image();
                                img.src = nextUrl;
                              }
                            }}
                            className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border transition-all ${
                              idx === activeImageIndex
                                ? "border-sky-400 ring-2 ring-sky-500/60"
                                : "border-slate-700 hover:border-slate-500"
                            }`}
                          >
                            {imageLoading[idx] && (
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
                                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-sky-400"></div>
                              </div>
                            )}
                            {imageErrors[idx] ? (
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
                                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            ) : (
                              <img
                                src={url}
                                alt={`缩略图 ${idx + 1}`}
                                className="w-full h-full object-cover"
                                loading={idx < 3 ? "eager" : "lazy"}
                                onLoad={() => {
                                  setImageLoading(prev => ({ ...prev, [idx]: false }));
                                }}
                                onError={() => {
                                  setImageLoading(prev => ({ ...prev, [idx]: false }));
                                  setImageErrors(prev => ({ ...prev, [idx]: true }));
                                }}
                                onLoadStart={() => {
                                  if (!imageLoading[idx]) {
                                    setImageLoading(prev => ({ ...prev, [idx]: true }));
                                  }
                                }}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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

      {/* 投资面板模态框 */}
      {showInvestPanel && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 z-[9999]"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowInvestPanel(false);
              }
            }}
          >
            <div className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-6 py-5 relative overflow-hidden max-w-md w-full bg-slate-900 max-h-[90vh] overflow-y-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold gradient-text">投资此资产</h2>
                  <button
                    onClick={() => setShowInvestPanel(false)}
                    className="text-slate-400 hover:text-slate-100 text-xl leading-none"
                  >
                    ✕
                  </button>
                </div>

                {/* 检查资产是否符合投资条件 */}
                {(() => {
                  const hasVerifiedAuth =
                    asset.authentications && asset.authentications.some(
                      (auth) => auth.authenticationStatus === "verified"
                    );
                  const hasCustody = asset.custody != null;
                  const hasInsurance =
                    asset.insurance != null && asset.insurance.isActive;
                  const canInvest =
                    asset.status === "fundraising" &&
                    hasVerifiedAuth &&
                    hasCustody &&
                    hasInsurance;

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
                    <p className="text-sm text-blue-200">
                      请先在页面右上角连接钱包以进行投资
                    </p>
                  </div>
                )}

                {chainId !== mantleSepoliaTestnet.id && isConnected && (
                  <div className="mb-4 p-4 bg-orange-950/40 border border-orange-500/40 rounded-lg">
                    <p className="text-sm text-orange-200 mb-3">
                      请切换到 Mantle Sepolia 测试网
                    </p>
                    <button
                      onClick={() =>
                        switchChainAsync({ chainId: mantleSepoliaTestnet.id })
                      }
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white text-sm"
                    >
                      切换网络
                    </button>
                  </div>
                )}

                {(() => {
                  const hasVerifiedAuth =
                    asset.authentications && asset.authentications.some(
                      (auth) => auth.authenticationStatus === "verified"
                    );
                  const hasCustody = asset.custody != null;
                  const hasInsurance =
                    asset.insurance != null && asset.insurance.isActive;
                  const canInvest =
                    asset.status === "fundraising" &&
                    hasVerifiedAuth &&
                    hasCustody &&
                    hasInsurance;
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
                    <div className="space-y-1 text-sm text-slate-300">
                      <div>
                        <span className="text-slate-400">单份价格：</span>
                        <span className="font-semibold text-sky-400">
                          {asset.pricePerShare} MNT
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">剩余可购：</span>
                        <span className="font-semibold text-emerald-400">
                          {displayRemaining} 份
                        </span>
                      </div>
                    </div>

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

                    <div className="mt-3 flex items-start gap-2">
                      <input
                        id="agree-risks"
                        type="checkbox"
                        checked={agreedToRisks}
                        onChange={(e) => setAgreedToRisks(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                      />
                      <label
                        htmlFor="agree-risks"
                        className="text-xs text-slate-300 leading-relaxed"
                      >
                        我已仔细阅读并理解风险提示与合规说明（包括使用条款、风险揭示书、投资者适当性说明），
                        同意自行承担相应投资风险。
                      </label>
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
                        kycLoading ||
                        !agreedToRisks
                      }
                      className="group relative w-full px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all duration-300"
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

                    <div className="text-xs text-slate-500 space-y-2 mt-3">
                      <p className="font-medium text-slate-300">基础说明</p>
                      <p>• 你需要发送 MNT 来购买代币份额，代币将从资产提供者转移到你的钱包地址，你支付的 MNT 会转给资产提供者。</p>
                      <p>• 交易需要支付 Gas 费（额外的 MNT），当前界面以 MNT 为单位展示金额（后续可接入预言机换算 USD）。</p>

                      <p className="font-medium text-slate-300 pt-1">主要风险提示</p>
                      <p>• 市场风险：奢侈品及代币价格可能随市场环境、供需关系、宏观经济等因素波动，存在本金亏损的可能。</p>
                      <p>• 流动性风险：代币可能在一段时间内缺乏买方，无法在你期望的时间和价格卖出或退出。</p>
                      <p>• 技术风险：区块链、智能合约、钱包等存在被攻击、漏洞或操作失误（如私钥丢失）等技术风险。</p>
                      <p>• 监管风险：各国/地区对数字资产和 RWA 的监管政策可能变化，极端情况下可能影响代币交易、持有或收益分配。</p>

                      <p className="font-medium text-slate-300 pt-1">合规与适当性</p>
                      <p>• 所有投资者必须完成 KYC / AML 审核，未通过审核的用户无法购买或持有代币。</p>
                      <p>• 本产品适合具备一定风险承受能力和投资经验的投资者，请根据自身财务状况和风险偏好谨慎决策，不要使用生活必需资金或杠杆资金进行投资。</p>
                      <p>• 你需自行承担投资收益的税务申报责任，平台仅在可能的情况下提供交易记录等辅助工具。</p>

                      <p className="font-medium text-slate-300 pt-1">免责声明</p>
                      <p>• 平台不对任何投资损失承担责任，平台提供的资产信息、估值报告等仅供参考，不构成投资建议，过往表现不代表未来收益。</p>
                      <p>• 点击“确认投资”并完成交易，即表示你已阅读并理解上述风险与合规说明，并同意自行承担相应风险。</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* 图片查看模态框 */}
      {showImageModal && imageList.length > 0 && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowImageModal(false);
            }
          }}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
            {/* 关闭按钮 */}
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 text-2xl leading-none z-10"
            >
              ✕
            </button>

            {/* 上一张按钮 */}
            {imageList.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newIndex = modalImageIndex > 0 ? modalImageIndex - 1 : imageList.length - 1;
                  setModalImageIndex(newIndex);
                  setModalImageLoading(true);
                  // 预加载相邻图片
                  if (newIndex > 0) {
                    const prevUrl = imageList[newIndex - 1];
                    const img = new Image();
                    img.src = prevUrl;
                  }
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white px-4 py-2 rounded-lg transition-colors z-10 disabled:opacity-50"
                disabled={modalImageLoading}
              >
                ←
              </button>
            )}

            {/* 图片 */}
            <div className="relative max-w-full max-h-[90vh] flex items-center justify-center">
              {modalImageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg z-10">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                </div>
              )}
              <img
                src={imageList[modalImageIndex]}
                alt={`${asset.brand} ${asset.model} - 图片 ${modalImageIndex + 1}`}
                className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
                onLoad={() => setModalImageLoading(false)}
                onError={() => setModalImageLoading(false)}
                onLoadStart={() => setModalImageLoading(true)}
              />
            </div>

            {/* 下一张按钮 */}
            {imageList.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newIndex = modalImageIndex < imageList.length - 1 ? modalImageIndex + 1 : 0;
                  setModalImageIndex(newIndex);
                  setModalImageLoading(true);
                  // 预加载相邻图片
                  if (newIndex < imageList.length - 1) {
                    const nextUrl = imageList[newIndex + 1];
                    const img = new Image();
                    img.src = nextUrl;
                  }
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white px-4 py-2 rounded-lg transition-colors z-10 disabled:opacity-50"
                disabled={modalImageLoading}
              >
                →
              </button>
            )}

            {/* 图片计数器 */}
            {imageList.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-lg text-sm">
                {modalImageIndex + 1} / {imageList.length}
              </div>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
