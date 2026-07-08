import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search, AppWindow, Server, Database, Globe, GitBranch, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { useGlobalSearch } from "@workspace/api-client-react";

type ResultGroup = {
  key: string;
  label: string;
  icon: typeof AppWindow;
  href: string;
  items: { id: number; title: string; subtitle?: string | null }[];
};

type FlatResult = {
  group: ResultGroup;
  item: { id: number; title: string; subtitle?: string | null };
};

export function SearchBar() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(handle);
  }, [query]);

  const { data, isFetching } = useGlobalSearch(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.length > 0, queryKey: ["globalSearch", debouncedQuery] } },
  );

  useEffect(() => {
    setOpen(debouncedQuery.length > 0);
    setActiveIndex(-1);
  }, [debouncedQuery]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [data]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const groups: ResultGroup[] = data
    ? [
        {
          key: "applications",
          label: "Applications",
          icon: AppWindow,
          href: "/applications",
          items: data.applications.map((a) => ({ id: a.id, title: a.name, subtitle: a.shortName ?? a.description })),
        },
        {
          key: "infrastructure",
          label: "Infrastructure",
          icon: Server,
          href: "/infrastructure",
          items: data.infrastructure.map((i) => ({ id: i.id, title: i.name, subtitle: i.type })),
        },
        {
          key: "databases",
          label: "Databases",
          icon: Database,
          href: "/databases",
          items: data.databases.map((d) => ({ id: d.id, title: d.name, subtitle: d.type })),
        },
        {
          key: "domains",
          label: "Domains",
          icon: Globe,
          href: "/domains",
          items: data.domains.map((d) => ({ id: d.id, title: d.name, subtitle: d.registrar })),
        },
        {
          key: "repositories",
          label: "Repositories",
          icon: GitBranch,
          href: "/repositories",
          items: data.repositories.map((r) => ({ id: r.id, title: r.name, subtitle: r.url })),
        },
        {
          key: "documents",
          label: "Documentation",
          icon: FileText,
          href: "/documentation",
          items: data.documents.map((d) => ({ id: d.id, title: d.title, subtitle: d.type })),
        },
      ].filter((g) => g.items.length > 0)
    : [];

  const hasResults = groups.length > 0;

  const flatResults: FlatResult[] = groups.flatMap((group) =>
    group.items.map((item) => ({ group, item })),
  );

  const DETAIL_ROUTES: Record<string, string> = {
    applications: "/applications",
    infrastructure: "/infrastructure",
    databases: "/databases",
    domains: "/domains",
    repositories: "/repositories",
    documents: "/documentation",
  };

  function handleSelect(group: ResultGroup, itemId: number) {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    const base = DETAIL_ROUTES[group.key];
    if (base) {
      navigate(`${base}/${itemId}`);
    } else {
      navigate(group.href);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.focus();
      return;
    }

    if (!open || flatResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev < flatResults.length - 1 ? prev + 1 : 0;
        itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev > 0 ? prev - 1 : flatResults.length - 1;
        itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < flatResults.length) {
        const { group, item } = flatResults[activeIndex];
        handleSelect(group, item.id);
      }
    }
  }

  return (
    <div ref={containerRef} className="flex flex-1 justify-end relative min-w-0">
      <Popover open={open}>
        <PopoverAnchor asChild>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-200 pointer-events-none" />
            <Input
              ref={inputRef}
              type="search"
              placeholder="Search assets, IP, domains..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (debouncedQuery.length > 0) setOpen(true);
              }}
              aria-autocomplete="list"
              aria-expanded={open}
              aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
              className="w-full pl-9 bg-white/10 border-white/20 text-white placeholder:text-blue-200 focus-visible:ring-white/30 focus-visible:bg-white/20"
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-200 animate-spin" />
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="end"
          className="w-[22rem] max-h-96 overflow-y-auto p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={() => setOpen(false)}
          role="listbox"
        >
          {!hasResults && !isFetching && (
            <div className="p-4 text-sm text-muted-foreground">No results for "{debouncedQuery}"</div>
          )}
          {(() => {
            let flatIndex = 0;
            return groups.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.key} className="border-b last:border-b-0">
                  <div className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const currentIndex = flatIndex++;
                    const isActive = currentIndex === activeIndex;
                    return (
                      <button
                        key={item.id}
                        id={`search-result-${currentIndex}`}
                        ref={(el) => { itemRefs.current[currentIndex] = el; }}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleSelect(group, item.id)}
                        onMouseEnter={() => setActiveIndex(currentIndex)}
                        onMouseLeave={() => setActiveIndex(-1)}
                        className={`w-full flex items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{item.title}</div>
                          {item.subtitle && (
                            <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            });
          })()}
        </PopoverContent>
      </Popover>
    </div>
  );
}
