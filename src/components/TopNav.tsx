"use client";

import { BarChart3, ChevronDown, LayoutDashboard, LogOut, PiggyBank, Table2, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/types";
import { Logo } from "./Logo";
import { Dropdown, MenuItem } from "./ui/Dropdown";

const LINKS = [
  { href: "/planilha", label: "Planilha", icon: Table2 },
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/cofrinho", label: "Cofrinho", icon: PiggyBank },
  { href: "/anual", label: "Visão anual", icon: BarChart3 },
];

export function TopNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-grid bg-white">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-4 px-3 sm:px-5">
        <Link href="/planilha" className="shrink-0" aria-label="Finance Flow">
          <Logo />
        </Link>
        <nav className="ml-2 flex h-full min-w-0 flex-1 items-stretch gap-1 overflow-x-auto">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-1.5 px-3 text-[13px] font-medium transition-colors ${
                  active ? "text-brand" : "text-muted hover:bg-head hover:text-ink"
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
                {active && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-brand" />}
              </Link>
            );
          })}
        </nav>
        <Dropdown
          label="Menu da conta"
          triggerClassName="btn btn-ghost h-9 gap-2 px-2"
          trigger={
            <>
              <span className="flex h-6 w-6 items-center justify-center bg-brand-soft text-[12px] font-semibold text-brand">
                {user.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-[140px] truncate text-[13px] sm:inline">
                {user.name.split(" ")[0]}
              </span>
              <ChevronDown size={14} className="text-faint" />
            </>
          }
        >
          <div className="border-b border-grid px-3 py-2">
            <p className="truncate text-[13px] font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <MenuItem href="/conta">
            <UserRound size={14} /> Minha conta
          </MenuItem>
          <MenuItem onClick={logout}>
            <LogOut size={14} /> Sair
          </MenuItem>
        </Dropdown>
      </div>
    </header>
  );
}
