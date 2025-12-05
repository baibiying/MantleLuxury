"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { useEffect, useState } from 'react';
import { mantleSepoliaTestnet, mantleSepoliaMetaMaskConfig } from '@/lib/web3/config';

export default function WalletConnect() {
  const { address, isConnected, connector, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 切换账户：断开后重新连接，MetaMask 会显示账户选择界面
  const handleSwitchAccount = async () => {
    await disconnect();
    // 等待断开完成后再连接
    setTimeout(() => {
      const metaMaskConnector = connectors.find(c => c.id === 'metaMask');
      if (metaMaskConnector) {
        connect({ connector: metaMaskConnector });
      }
    }, 100);
  };

  // 确保网络正确配置
  useEffect(() => {
    if (isConnected && chainId && chainId === mantleSepoliaTestnet.id) {
      // 确保 MetaMask 显示正确的网络信息
      // MetaMask 应该自动识别网络配置中的 nativeCurrency
    }
  }, [isConnected, chainId]);

  if (!mounted) {
    return null;
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-sm text-slate-300">
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
        <button
          onClick={handleSwitchAccount}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition"
          title="切换账户"
        >
          切换账户
        </button>
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
            // 连接时会自动显示 MetaMask 账户选择界面
            connect({ connector });
          }}
          disabled={isPending}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white text-sm transition"
        >
          {isPending ? '连接中...' : connector.name === 'MetaMask' ? '连接钱包' : connector.name}
        </button>
      ))}
    </div>
  );
}

