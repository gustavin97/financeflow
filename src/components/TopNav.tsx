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
    <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-md">
      <div className="flex h-16 w-full items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/planilha" className="shrink-0" aria-label="Finance Flow">
          <Logo large />
        </Link>
        <nav className="ml-2 flex h-full min-w-0 flex-1 items-stretch gap-1 overflow-x-auto">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`my-2.5 flex items-center gap-1.5 rounded-lg px-3 text-[15px] font-medium transition-colors ${
                  active ? "bg-brand-soft text-brand" : "text-muted hover:bg-head hover:text-ink"
                }`}
              >
                <Icon size={17} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <Dropdown
          label="Menu da conta"
          triggerClassName="btn btn-ghost h-11 gap-2 px-2"
          trigger={
            <>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#16a35a] to-brand text-[14px] font-semibold text-white">
                {user.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-[140px] truncate text-[15px] sm:inline">
                {user.name.split(" ")[0]}
              </span>
              <ChevronDown size={16} className="text-faint" />
            </>
          }
        >
          <div className="border-b border-grid px-3 py-2">
            <p className="truncate text-[15px] font-medium">{user.name}</p>
            <p className="truncate text-[14px] text-muted">{user.email}</p>
          </div>
          <MenuItem href="/conta">
            <UserRound size={16} /> Minha conta
          </MenuItem>
          <MenuItem onClick={logout}>
            <LogOut size={16} /> Sair
          </MenuItem>
        </Dropdown>
      </div>
    </header>
  );
}
