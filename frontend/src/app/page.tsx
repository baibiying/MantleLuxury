export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
          MantleLuxury
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          奢侈品 RWA 投资平台
        </h1>
        <p className="text-sm text-slate-300 leading-relaxed">
          基于 Mantle L2 的奢侈品实物资产代币化平台，将名表、珠宝等资产拆分为可交易的份额，
          让更多投资者以更低门槛参与高端奢侈品投资。
        </p>
        <div className="flex items-center justify-center gap-4 pt-2">
          <a
            href="/assets"
            className="rounded-full bg-sky-500 px-6 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 transition"
          >
            浏览可投资资产
          </a>
        </div>
      </div>
    </main>
  );
}
