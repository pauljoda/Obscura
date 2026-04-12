"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BulkScrape } from "../../../components/scrape/bulk-scrape";
import { useNsfw } from "../../../components/nsfw/nsfw-context";

export default function IdentifyPage() {
  const { mode } = useNsfw();
  const router = useRouter();

  useEffect(() => {
    if (mode === "off") {
      router.replace("/");
    }
  }, [mode, router]);

  if (mode === "off") return null;

  return <BulkScrape />;
}
