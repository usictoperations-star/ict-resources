import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, AppWindow, Server, Database, Globe,
  GitBranch, Rocket, Shield, PackageSearch, FileText,
  BarChart, Settings, Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchBar } from "@/components/search-bar";

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

function NavLinks({ location, onNavigate }: { location: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5 px-2">
      {NAV_ITEMS.map((item) => {
        const isActive =
          location === item.href ||
          (item.href !== "/" && location.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
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
