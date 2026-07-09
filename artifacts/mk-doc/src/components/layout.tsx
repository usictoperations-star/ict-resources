import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, AppWindow, Server, Database, Globe,
  GitBranch, Rocket, Shield, PackageSearch, FileText,
  BarChart, Settings, Menu, Activity, PenLine, AlertTriangle, Table2,
  LogOut, User, ChevronDown, UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchBar } from "@/components/search-bar";
import { useAuth } from "@/contexts/auth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const ROLE_BADGE: Record<string, { label: string; class: string }> = {
  admin:   { label: "Admin",   class: "bg-red-500/20 text-red-200 border-red-400/30" },
  editor:  { label: "Editor",  class: "bg-blue-400/20 text-blue-200 border-blue-300/30" },
  analyst: { label: "Analyst", class: "bg-amber-400/20 text-amber-200 border-amber-300/30" },
  viewer:  { label: "Viewer",  class: "bg-white/10 text-blue-200 border-white/20" },
};

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: AppWindow },
  { href: "/infrastructure", label: "Infrastructure", icon: Server },
  { href: "/databases", label: "Databases", icon: Database },
  { href: "/domains", label: "Domains", icon: Globe },
  { href: "/repositories", label: "Repositories", icon: GitBranch },
  { href: "/releases", label: "Releases", icon: Rocket },
  { href: "/security", label: "Security", icon: Shield },
  { href: "/software", label: "Software", icon: PackageSearch },
  { href: "/documentation", label: "Documentation", icon: FileText },
  { href: "/reports", label: "Reports", icon: BarChart },
  { href: "/admin", label: "Administration", icon: Settings },
];

const SECURITY_SUB_ITEMS = [
  { id: "vulnerability-health", label: "Vulnerability Health", icon: Activity },
  { id: "log-vulnerability",    label: "Log Vulnerability",    icon: PenLine },
  { id: "risk-indicators",      label: "Risk Indicators",      icon: AlertTriangle },
  { id: "needs-attention",      label: "Needs Attention",      icon: Shield },
  { id: "vulnerabilities",      label: "Vulnerabilities",      icon: Table2 },
];

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function NavLinks({ location, onNavigate }: { location: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5 px-2">
      {NAV_ITEMS.map((item) => {
        const isActive =
          location === item.href ||
          (item.href !== "/" && location.startsWith(item.href));
        const isSecurityActive = item.href === "/security" && isActive;
        const Icon = item.icon;
        return (
          <React.Fragment key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
                isActive
                  ? "bg-[#2D72C8] text-white"
                  : "text-blue-100 hover:bg-[#1B56A5] hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>

            {isSecurityActive && (
              <div className="ml-4 pl-2.5 border-l border-white/15 mt-0.5 mb-1">
                {SECURITY_SUB_ITEMS.map((sub) => {
                  const SubIcon = sub.icon;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        onNavigate?.();
                        scrollToSection(sub.id);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-medium text-blue-300 hover:bg-white/10 hover:text-white transition-colors text-left leading-none"
                    >
                      <SubIcon className="h-3 w-3 flex-shrink-0 opacity-70" />
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function SidebarBranding() {
  return (
    <div className="flex items-center gap-3 px-4">
      <img
        src="/mk-logo.png"
        alt="MK Logo"
        className="h-10 w-10 object-contain flex-shrink-0"
      />
      <div>
        <div className="font-bold text-white text-base leading-tight tracking-wide">MK DOC</div>
        <div className="text-blue-200 text-xs leading-tight">Digital Operations Center</div>
      </div>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const badge = ROLE_BADGE[user.roles?.[0] ?? "viewer"] ?? ROLE_BADGE.viewer;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 h-9 px-2.5 text-white hover:bg-white/10 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <User className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="hidden sm:flex flex-col items-start leading-none">
            <span className="text-sm font-medium text-white max-w-[120px] truncate">{user.name}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-white/60 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="pb-1">
          <p className="font-medium truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground font-normal truncate">{user.email}</p>
          <span className={`inline-flex items-center mt-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.class}`}>
            {badge.label}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Link href="/profile">
          <DropdownMenuItem className="cursor-pointer">
            <UserCircle className="h-3.5 w-3.5 mr-2" />
            My Profile
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onClick={logout}
        >
          <LogOut className="h-3.5 w-3.5 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [tabletSidebarOpen, setTabletSidebarOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar — always visible on lg+ */}
      <aside className="w-64 flex-shrink-0 flex-col bg-[#0F2D5C] hidden lg:flex">
        <div className="h-16 flex items-center border-b border-white/10 flex-shrink-0">
          <SidebarBranding />
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <NavLinks location={location} />
        </div>
        <div className="p-3 border-t border-white/10 text-xs text-blue-300 text-center font-mono">
          v1.0.0 © 2026 MK DOC
        </div>
      </aside>

      {/* Tablet Sidebar — toggleable at md, hidden at lg+ */}
      {tabletSidebarOpen && (
        <aside className="w-64 flex-shrink-0 flex-col bg-[#0F2D5C] hidden md:flex lg:hidden border-r border-white/10">
          <div className="h-16 flex items-center border-b border-white/10 flex-shrink-0">
            <SidebarBranding />
          </div>
          <div className="flex-1 overflow-y-auto py-3">
            <NavLinks location={location} onNavigate={() => setTabletSidebarOpen(false)} />
          </div>
          <div className="p-3 border-t border-white/10 text-xs text-blue-300 text-center font-mono">
            v1.0.0 © 2026 MK DOC
          </div>
        </aside>
      )}

      {/* Mobile Nav Sheet — full-screen */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-full max-w-full p-0 bg-[#0F2D5C] border-r border-white/10 sm:max-w-sm"
        >
          <SheetHeader className="h-16 flex flex-row items-center px-4 border-b border-white/10">
            <SheetTitle asChild>
              <SidebarBranding />
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto py-3">
            <NavLinks location={location} onNavigate={() => setMobileOpen(false)} />
          </div>
          <div className="p-3 border-t border-white/10 text-xs text-blue-300 text-center font-mono">
            v1.0.0 © 2026 MK DOC
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center gap-3 px-4 sm:px-5 flex-shrink-0 bg-[#1B56A5] shadow-md">
          {/* Mobile hamburger (<md) */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white hover:bg-white/10 flex-shrink-0"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Tablet hamburger (md to lg) */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex lg:hidden text-white hover:bg-white/10 flex-shrink-0"
            onClick={() => setTabletSidebarOpen((v) => !v)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2 flex-shrink-0">
            <img src="/mk-logo.png" alt="MK Logo" className="h-8 w-8 object-contain" />
            <span className="font-bold text-white text-sm tracking-wide">MK DOC</span>
          </div>

          {/* Search bar */}
          <SearchBar />

          {/* User menu */}
          <div className="ml-auto flex-shrink-0">
            <UserMenu />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </div>

        {/* Footer */}
        <footer className="bg-[#1B56A5] border-t border-white/10 px-4 sm:px-6 py-2 flex items-center justify-between flex-shrink-0">
          <span className="text-blue-100 text-xs">MK Digital Operations Center</span>
          <span className="text-blue-200 text-xs font-mono">v1.0.0</span>
        </footer>
      </main>
    </div>
  );
}
