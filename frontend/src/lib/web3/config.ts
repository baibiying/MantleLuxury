import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { metaMask } from 'wagmi/connectors';

// Mantle Sepolia 测试网配置
export const mantleSepoliaTestnet = defineChain({
  id: 5003,
  name: 'Mantle Sepolia',
  network: 'mantle-sepolia',
  nativeCurrency: {
    name: 'Mantle',
    symbol: 'MNT', // 确保符号是 MNT
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.sepolia.mantle.xyz'],
    },
    public: {
      http: ['https://rpc.sepolia.mantle.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mantle Explorer',
      url: 'https://explorer.sepolia.mantle.xyz',
    },
  },
  testnet: true,
});

// MetaMask 网络配置（用于添加到 MetaMask）
export const mantleSepoliaMetaMaskConfig = {
  chainId: `0x${mantleSepoliaTestnet.id.toString(16)}`, // 0x138b
  chainName: 'Mantle Sepolia',
  nativeCurrency: {
    name: 'Mantle',
    symbol: 'MNT',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.sepolia.mantle.xyz'],
  blockExplorerUrls: ['https://explorer.sepolia.mantle.xyz'],
};

// 创建连接器（只在客户端执行）
let connectors: ReturnType<typeof metaMask>[] = [];

if (typeof window !== 'undefined') {
  // 只在浏览器环境中创建 MetaMask 连接器
  connectors = [
    metaMask({
      // 允许用户选择账户；设置 shim 开关以便每次连接都可选择
      shimDisconnect: true,
      UNSTABLE_shimOnConnectSelectAccount: true,
      dappMetadata: {
        name: 'MantleLuxury',
        url: window.location.origin,
      },
    }),
  ];
}

// Wagmi 配置
export const wagmiConfig = createConfig({
  chains: [mantleSepoliaTestnet],
  connectors,
  transports: {
    [mantleSepoliaTestnet.id]: http(),
  },
});

