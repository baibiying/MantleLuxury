"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";
import Link from "next/link";
import PageContainer from "@/components/PageContainer";
import TechCard from "@/components/TechCard";
import TechButton from "@/components/TechButton";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type UserSettings = {
  email: string | null;
  emailNotifications: boolean;
  yieldNotifications: boolean;
  announcementNotifications: boolean;
};

export default function SettingsPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    email: null,
    emailNotifications: true,
    yieldNotifications: true,
    announcementNotifications: true,
  });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!address) return;
    const loadSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/user-settings/${address}`);
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
          setEmail(data.email || "");
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    };
    loadSettings();
  }, [address]);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    if (!email || email.trim() === "") {
      setError("请填写邮箱地址");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("请输入有效的邮箱地址");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/user-settings/${address}/email`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "更新失败");
      }
      setSettings((prev) => ({ ...prev, email: email.trim() }));
      setSuccess("✅ 邮箱更新成功！");
      // 3秒后自动清除成功提示
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message ?? "更新失败");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateNotifications = async () => {
    if (!address) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/user-settings/${address}/notifications`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            emailNotifications: settings.emailNotifications,
            yieldNotifications: settings.yieldNotifications,
            announcementNotifications: settings.announcementNotifications,
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "更新失败");
      }
      setSuccess("✅ 通知偏好更新成功！");
      // 3秒后自动清除成功提示
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message ?? "更新失败");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <PageContainer
      title="账户设置"
      subtitle="管理您的账户信息和通知偏好"
      maxWidth="5xl"
    >
      <div className="mb-6 flex items-center justify-end">
          <div>
            <h1 className="text-2xl font-semibold">账户与设置</h1>
            <p className="text-sm text-slate-400 mt-1">
              管理你的账户信息和通知偏好
            </p>
          </div>
          <WalletConnect />
        </div>

        {!isConnected || !address ? (
          <TechCard className="px-6 py-8 text-center">
            <p className="text-sm text-slate-300 mb-3">
              请先连接钱包以查看和修改设置。
            </p>
            <WalletConnect />
          </TechCard>
        ) : (
          <div className="space-y-6">
            {/* 错误和成功提示 - 放在最上面 */}
            {error && (
              <div className="px-4 py-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
                {error}
              </div>
            )}
            {success && (
              <div className="px-4 py-3 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-200">
                {success}
              </div>
            )}

            {/* 邮箱绑定 */}
            <TechCard className="px-6 py-6">
              <h2 className="text-lg font-semibold mb-4">邮箱绑定</h2>
              <p className="text-sm text-slate-400 mb-4">
                绑定邮箱后，我们将通过邮件向你发送重要通知和收益分配信息。
              </p>
              <form onSubmit={handleUpdateEmail} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium mb-2"
                  >
                    邮箱地址
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    disabled={saving}
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
                >
                  {saving ? "保存中..." : "保存邮箱"}
                </button>
              </form>
            </TechCard>

            {/* 通知偏好 */}
            <TechCard className="px-6 py-6">
              <h2 className="text-lg font-semibold mb-4">通知偏好</h2>
              <p className="text-sm text-slate-400 mb-4">
                选择你希望接收的通知类型。
              </p>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="font-medium">邮件通知</div>
                    <div className="text-sm text-slate-400">
                      接收所有类型的邮件通知
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        emailNotifications: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-sky-600 focus:ring-sky-500"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="font-medium">收益分配通知</div>
                    <div className="text-sm text-slate-400">
                      当你的资产产生收益分配时通知你
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.yieldNotifications}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        yieldNotifications: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-sky-600 focus:ring-sky-500"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="font-medium">重要公告通知</div>
                    <div className="text-sm text-slate-400">
                      接收平台重要公告和更新
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.announcementNotifications}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        announcementNotifications: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-sky-600 focus:ring-sky-500"
                  />
                </label>
                <button
                  onClick={handleUpdateNotifications}
                  disabled={saving}
                  className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
                >
                  {saving ? "保存中..." : "保存通知偏好"}
                </button>
              </div>
            </TechCard>

            {/* 法律文件 */}
            <TechCard className="px-6 py-6">
              <h2 className="text-lg font-semibold mb-4">法律文件</h2>
              <p className="text-sm text-slate-400 mb-4">
                查看平台使用条款、风险揭示书和投资者适当性说明。
              </p>
              <div className="space-y-3">
                <Link
                  href="/legal/terms-of-use"
                  className="block px-4 py-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">使用条款</div>
                      <div className="text-sm text-slate-400 mt-1">
                        平台服务使用条款和条件
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
                <Link
                  href="/legal/risk-disclosure"
                  className="block px-4 py-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">风险揭示书</div>
                      <div className="text-sm text-slate-400 mt-1">
                        投资风险提示和免责声明
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
                <Link
                  href="/legal/investor-suitability"
                  className="block px-4 py-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">投资者适当性说明</div>
                      <div className="text-sm text-slate-400 mt-1">
                        适合性评估和投资建议
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              </div>
            </TechCard>
          </div>
        )}
    </PageContainer>
  );
}

