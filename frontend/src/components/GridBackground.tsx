"use client";

export default function GridBackground() {
  return (
    <div 
      className="fixed z-0 pointer-events-none"
      style={{
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#020617', // 使用明确的颜色值，确保与 slate-950 一致
        margin: 0,
        padding: 0,
      }}
    >
      {/* 网格背景 */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
      {/* 动态网格线 */}
      <div 
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
          animation: 'gridMove 20s linear infinite',
        }}
      />
      <style jsx>{`
        @keyframes gridMove {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(50px, 50px);
          }
        }
      `}</style>
    </div>
  );
}

