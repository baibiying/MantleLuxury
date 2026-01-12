"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function YieldsPage() {
  const router = useRouter();

  useEffect(() => {
    // 重定向到持仓页面
    router.replace("/portfolio");
  }, [router]);

  return null;
}
