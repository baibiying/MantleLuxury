"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type Document = {
  id: string;
  title: string;
  content: string;
  format: string;
};

const documentNames: Record<string, string> = {
  "terms-of-use": "使用条款",
  "risk-disclosure": "风险揭示书",
  "investor-suitability": "投资者适当性说明",
};

export default function LegalDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as string;
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;

    const loadDocument = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/legal-documents/${documentId}`, {
          headers: {
            'Accept': 'application/json',
          },
        });
        if (!res.ok) {
          throw new Error("文档加载失败");
        }
        
        // 检查 Content-Type
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`服务器返回了非JSON格式: ${text.substring(0, 100)}`);
        }
        
        const data = await res.json();
        setDocument(data);
      } catch (e: any) {
        console.error('加载文档失败:', e);
        setError(e.message ?? "加载文档失败");
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentId]);

  // 将Markdown转换为HTML（改进版本）
  const renderMarkdown = (content: string): string => {
    let html = content;
    
    // 处理标题
    html = html.replace(/^# (.*$)/gim, "<h1 class='text-3xl font-bold mb-4 mt-8 text-slate-100'>$1</h1>");
    html = html.replace(/^## (.*$)/gim, "<h2 class='text-2xl font-semibold mb-3 mt-6 text-slate-100'>$1</h2>");
    html = html.replace(/^### (.*$)/gim, "<h3 class='text-xl font-semibold mb-2 mt-4 text-slate-200'>$1</h3>");
    
    // 处理粗体
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-slate-100'>$1</strong>");
    
    // 处理代码
    html = html.replace(/`([^`]+)`/g, "<code class='bg-slate-800 px-2 py-1 rounded text-sm text-sky-300 font-mono'>$1</code>");
    
    // 处理有序列表
    const lines = html.split('\n');
    let inOrderedList = false;
    let inUnorderedList = false;
    let result: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const orderedMatch = line.match(/^(\d+)\.\s(.*)$/);
      const unorderedMatch = line.match(/^-\s(.*)$/);
      
      if (orderedMatch) {
        if (!inOrderedList) {
          if (inUnorderedList) {
            result.push('</ul>');
            inUnorderedList = false;
          }
          result.push('<ol class="list-decimal ml-6 mb-4 space-y-2">');
          inOrderedList = true;
        }
        result.push(`<li class="text-slate-300 leading-relaxed">${orderedMatch[2]}</li>`);
      } else if (unorderedMatch) {
        if (!inUnorderedList) {
          if (inOrderedList) {
            result.push('</ol>');
            inOrderedList = false;
          }
          result.push('<ul class="list-disc ml-6 mb-4 space-y-2">');
          inUnorderedList = true;
        }
        result.push(`<li class="text-slate-300 leading-relaxed">${unorderedMatch[1]}</li>`);
      } else {
        if (inOrderedList) {
          result.push('</ol>');
          inOrderedList = false;
        }
        if (inUnorderedList) {
          result.push('</ul>');
          inUnorderedList = false;
        }
        
        // 处理段落
        if (line.trim()) {
          // 跳过已经是标题的行
          if (!line.match(/^<h[1-6]/)) {
            result.push(`<p class="mb-4 text-slate-300 leading-relaxed">${line}</p>`);
          }
        } else {
          result.push('<br/>');
        }
      }
    }
    
    // 关闭未关闭的列表
    if (inOrderedList) result.push('</ol>');
    if (inUnorderedList) result.push('</ul>');
    
    html = result.join('\n');
    
    return html;
  };

  if (loading) {
    return (
      <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="glass-effect border border-slate-700/60 rounded-2xl px-6 py-8 text-center">
            <p className="text-slate-300">加载中...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !document) {
    return (
      <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="glass-effect border border-red-500/60 rounded-2xl px-6 py-8 text-center">
            <p className="text-red-300">{error || "文档未找到"}</p>
            <Link
              href="/settings"
              className="mt-4 inline-block text-sky-400 hover:text-sky-300"
            >
              返回设置页面
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {/* 返回按钮 */}
        <div className="mb-6">
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回设置
          </Link>
        </div>

        {/* 文档内容 */}
        <div className="glass-effect border border-slate-700/60 rounded-2xl px-8 py-8">
          <div className="mb-6 pb-6 border-b border-slate-700/50">
            <h1 className="text-3xl font-bold mb-2">{document.title}</h1>
            <p className="text-sm text-slate-400">
              最后更新：2025年1月1日
            </p>
          </div>

          <div
            className="prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(document.content),
            }}
            style={{
              color: "#e2e8f0",
            }}
          />
        </div>

        {/* 下载按钮 */}
        <div className="mt-6 text-center">
          <a
            href={`${API_BASE}/api/legal-documents/${documentId}/download`}
            download
            className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 rounded-lg text-white font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            下载文档
          </a>
        </div>
      </div>
    </main>
  );
}

