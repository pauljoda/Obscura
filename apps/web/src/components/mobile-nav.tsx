"use client";

import { Film, Users, Tags, Activity, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@obscura/ui/lib/utils";

const navItems = [
  { label: "Scenes", href: "/scenes", icon: Film },
  { label: "Performers", href: "/performers", icon: Users },
  { label: "Tags", href: "/tags", icon: Tags },
  { label: "Jobs", href: "/jobs", icon: Activity },
  { label: "More", href: "/settings", icon: MoreHorizontal },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-border-subtle bg-surface-1 md:hidden">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[0.65rem] transition-colors duration-fast",
              isActive
                ? "text-text-accent"
                : "text-text-disabled hover:text-text-muted"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
