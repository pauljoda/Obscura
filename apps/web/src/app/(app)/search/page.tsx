import type { Metadata } from "next";
import { SearchPageClient } from "../../../components/routes/search-page-client";

export const metadata: Metadata = {
  title: "Search — Obscura",
};

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kinds?: string }>;
}) {
  const params = await searchParams;
  return (
    <SearchPageClient
      initialQuery={params.q ?? ""}
      initialKinds={params.kinds ?? ""}
    />
  );
}
