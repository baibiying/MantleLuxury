"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { useEffect, useState } from 'react';
import { mantleSepoliaTestnet, mantleSepoliaMetaMaskConfig } from '@/lib/web3/config';

export default function WalletConnect() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [mounted, setMounted] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 连接后自动尝试切到 Mantle Sepolia
  useEffect(() => {
    const ensureMantle = async () => {
      if (!isConnected || switchingNetwork) return;
      if (chainId === mantleSepoliaTestnet.id) {
        setNetworkError(null);
        return;
      }
      try {
        if (switchChainAsync) {
          setSwitchingNetwork(true);
          await switchChainAsync({ chainId: mantleSepoliaTestnet.id });
          setNetworkError(null);
        }
      } catch (error: any) {
        // 如果链不存在，尝试添加
        if (error?.code === 4902 || error?.message?.includes('Unrecognized chain')) {
          try {
            await (window as any).ethereum?.request({
              method: 'wallet_addEthereumChain',
              params: [mantleSepoliaMetaMaskConfig],
            });
            if (switchChainAsync) {
              await switchChainAsync({ chainId: mantleSepoliaTestnet.id });
              setNetworkError(null);
            }
          } catch (addErr: any) {
            setNetworkError(addErr?.message || '请在钱包中切换到 Mantle Sepolia');
          }
        } else {
          setNetworkError(error?.message || '请在钱包中切换到 Mantle Sepolia');
        }
      } finally {
        setSwitchingNetwork(false);
      }
    };
    ensureMantle();
  }, [isConnected, chainId, switchChainAsync, switchingNetwork]);

  if (!mounted) {
    return null;
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-sm text-slate-300">
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
        {chainId !== mantleSepoliaTestnet.id && (
          <button
            onClick={() => !switchingNetwork && switchChainAsync?.({ chainId: mantleSepoliaTestnet.id })}
            disabled={switchingNetwork}
            className="px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 rounded-lg text-white text-xs transition"
          >
            {switchingNetwork ? '切换中...' : '切换到 Mantle Sepolia'}
          </button>
        )}
        <button
          onClick={() => disconnect()}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition"
        >
          断开连接
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.id}
          onClick={() => {
            // 连接时指定目标链，MetaMask 会在连接后提示切链
            connect({ connector, chainId: mantleSepoliaTestnet.id });
          }}
          disabled={isPending}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white text-sm transition"
        >
          {isPending ? '连接中...' : connector.name === 'MetaMask' ? '连接钱包' : connector.name}
        </button>
      ))}
      {networkError && (
        <span className="text-xs text-orange-300 ml-2">
          {networkError}
        </span>
      )}
    </div>
  );
}

