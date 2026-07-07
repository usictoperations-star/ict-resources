import React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, AppWindow, Server, Database, Globe, 
  GitBranch, Rocket, Shield, PackageSearch, FileText, 
  BarChart, Settings, Search, Menu
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex-shrink-0 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b font-mono font-bold text-lg tracking-tight">
          <span className="text-primary mr-2">MK</span>DOC
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            {NAV_ITEMS.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t text-xs text-muted-foreground text-center font-mono">
          v1.0.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
          <div className="flex items-center md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="ml-4 font-mono font-bold text-lg tracking-tight">
              <span className="text-primary mr-1">MK</span>DOC
            </div>
          </div>
          
          <div className="hidden md:flex flex-1 max-w-md ml-auto relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search assets, IP, domains..."
              className="w-full pl-9 bg-muted/50 border-none focus-visible:ring-1"
            />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}