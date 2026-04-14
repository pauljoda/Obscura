"use client";

import { useState, useCallback } from "react";
import { Film, Images, Users, Activity } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@obscura/ui/lib/utils";
import { MobileMoreSheet } from "./mobile-more-sheet";
import { MobileMoreNavButton } from "./mobile-more-nav-button";

const primaryTabs = [
  { label: "Videos", href: "/videos", icon: Film },
  { label: "Galleries", href: "/galleries", icon: Images },
  { label: "Actors", href: "/performers", icon: Users },
  { label: "Jobs", href: "/jobs", icon: Activity },
] as const;

const moreRoutes = ["/", "/search", "/images", "/studios", "/tags", "/collections", "/identify", "/settings"];

export function MobileNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const isMoreActive =
    sheetOpen ||
    moreRoutes.some(
      (route) =>
        pathname === route ||
        (route !== "/" && pathname.startsWith(route + "/")),
    );

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-border-subtle bg-surface-1 md:hidden">
        {primaryTabs.map((item) => {
          const isActive =
            pathname === item.href ||
            pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[0.65rem] transition-colors duration-fast",
                isActive
                  ? "text-text-accent"
                  : "text-text-disabled hover:text-text-muted",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <MobileMoreNavButton
          isMoreActive={isMoreActive}
          sheetOpen={sheetOpen}
          onToggleSheet={() => setSheetOpen((prev) => !prev)}
        />
      </nav>

      <MobileMoreSheet open={sheetOpen} onClose={closeSheet} />
    </>
  );
}
