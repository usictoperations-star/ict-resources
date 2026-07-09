import React, { useMemo } from "react";
import { useGetDashboardStats, useGetDashboardAlerts, useGetDashboardActivityChart } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AppWindow, Server, AlertTriangle, ShieldAlert, Globe,
  GitBranch, Database, CheckCircle2, Clock, XCircle,
  ArrowRight, Rocket, Shield, Activity, PackageSearch, Zap,
  FileText,
} from "lucide-react";
import { Link } from "wouter";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid,
} from "recharts";

// ── constants & helpers ───────────────────────────────────────────────────────

const BRAND = "#1B56A5";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  padding: "8px 12px",
};

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function formatDate() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 2)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── ScoreRing ─────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : "#ef4444";
  const label = score >= 80 ? "Secure" : score >= 60 ? "Fair" : "At Risk";
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="relative flex items-center justify-center w-14 h-14">
        <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
          <circle cx="28" cy="28" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4.5" />
          <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4.5"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.7s ease" }} />
        </svg>
        <span className="absolute text-sm font-bold tabular-nums" style={{ color }}>{score}</span>
      </div>
      <div className="text-center">
        <p className="text-[10px] font-semibold" style={{ color }}>{label}</p>
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Security</p>
      </div>
    </div>
  );
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, sub, icon: Icon, color, href, alert = false,
}: {
  title: string;
  value: React.ReactNode;
  sub: string;
  icon: React.ElementType;
  color: string;
  href?: string;
  alert?: boolean;
}) {
  const inner = (
    <Card className={`group cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 ${alert ? "ring-1 ring-red-300 dark:ring-red-800" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}1a` }}>
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-all -translate-x-1 group-hover:translate-x-0 duration-200" />
        </div>
        <div className="text-2xl font-bold tracking-tight leading-none mb-1">{value}</div>
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug">{sub}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// ── severity maps ─────────────────────────────────────────────────────────────

const SEV_RAIL: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-500",
  warning:  "bg-amber-400",
  medium:   "bg-yellow-400",
  low:      "bg-blue-400",
};
const SEV_PILL: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  warning:  "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
};
function SevIcon({ s }: { s: string }) {
  if (s === "critical") return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
  if (s === "high")     return <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
  return <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
}

// ── module list for Quick Access ──────────────────────────────────────────────

const MODULES = [
  { icon: AppWindow,    label: "Applications",  href: "/applications",  statKey: "totalApplications" },
  { icon: Server,       label: "Infrastructure", href: "/infrastructure", statKey: "servers" },
  { icon: Database,     label: "Databases",      href: "/databases",      statKey: "databases" },
  { icon: Globe,        label: "Domains & SSL",  href: "/domains",        statKey: "domains" },
  { icon: GitBranch,    label: "Repositories",   href: "/repositories",   statKey: "repositories" },
  { icon: Rocket,       label: "Releases",       href: "/releases",       statKey: "recentReleases" },
  { icon: Shield,       label: "Security",       href: "/security",       statKey: null },
  { icon: PackageSearch,label: "Software",       href: "/software",       statKey: null },
  { icon: FileText,     label: "Docs",           href: "/documentation",  statKey: null },
] as const;

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: alerts, isLoading: alertsLoading } = useGetDashboardAlerts();
  const { data: activityChart, isLoading: chartLoading } = useGetDashboardActivityChart();

  const vulnData = useMemo(() => !stats ? [] : [
    { name: "Critical", value: stats.criticalVulnerabilities ?? 0, color: "#ef4444" },
    { name: "High",     value: stats.highVulnerabilities ?? 0,     color: "#f97316" },
  ].filter(d => d.value > 0), [stats]);

  const appEnvData = useMemo(() => !stats ? [] : [
    { name: "Production",  value: stats.productionSystems ?? 0 },
    { name: "Test / Dev",  value: Math.max(0, (stats.totalApplications ?? 0) - (stats.productionSystems ?? 0) - 1) },
    { name: "Maintenance", value: 1 },
  ], [stats]);

  const issueCount = (stats?.openIncidents ?? 0) + (stats?.criticalVulnerabilities ?? 0);
  const hasIssues  = issueCount > 0;
  const critAlerts = alerts?.filter(a => a.severity === "critical" || a.severity === "high").length ?? 0;

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{getGreeting()}</h1>
          <p className="text-sm text-muted-foreground mt-1">{formatDate()}</p>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {statsLoading ? (
              <Skeleton className="h-6 w-44 rounded-full" />
            ) : hasIssues ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-full px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                {issueCount} issue{issueCount !== 1 ? "s" : ""} require attention
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-full px-3 py-1">
                <CheckCircle2 className="h-3 w-3" />
                All systems operational
              </span>
            )}
            <Badge variant="outline" className="gap-1.5 text-xs border-green-200 text-green-700 bg-green-50 dark:bg-green-950/20 dark:border-green-800/40 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
              Live
            </Badge>
          </div>
        </div>

        {stats?.securityScore != null && (
          <div className="hidden sm:block">
            <ScoreRing score={stats.securityScore} />
          </div>
        )}
      </div>

      {/* ── KPI Grid (6-up) ───────────────────────────────────────────────── */}
      {statsLoading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)}
        </div>
      ) : stats ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Total Applications"
            value={stats.totalApplications}
            sub={`${stats.productionSystems} production · ${stats.testSystems ?? 0} test`}
            icon={AppWindow} color={BRAND} href="/applications"
          />
          <KpiCard
            title="Infrastructure"
            value={stats.servers}
            sub={`Servers tracked across all environments`}
            icon={Server} color="#7c3aed" href="/infrastructure"
          />
          <KpiCard
            title="Databases"
            value={stats.databases}
            sub="Actively monitored databases"
            icon={Database} color="#059669" href="/databases"
          />
          <KpiCard
            title="Open Incidents"
            value={
              <span className={stats.openIncidents > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                {stats.openIncidents}
              </span>
            }
            sub={stats.openIncidents > 0 ? `${stats.openIncidents} requiring immediate review` : "No active incidents"}
            icon={AlertTriangle}
            color={stats.openIncidents > 0 ? "#ef4444" : "#22c55e"}
            href="/security"
            alert={stats.openIncidents > 0}
          />
          <KpiCard
            title="Vulnerabilities"
            value={
              <span className={stats.criticalVulnerabilities > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}>
                {(stats.criticalVulnerabilities ?? 0) + (stats.highVulnerabilities ?? 0)}
              </span>
            }
            sub={`${stats.criticalVulnerabilities} critical · ${stats.highVulnerabilities} high`}
            icon={ShieldAlert}
            color={stats.criticalVulnerabilities > 0 ? "#ef4444" : "#f97316"}
            href="/security"
            alert={stats.criticalVulnerabilities > 0}
          />
          <KpiCard
            title="Domains & SSL"
            value={stats.domains}
            sub={`${stats.sslCertificates} SSL certs · ${stats.upcomingRenewals} renewal${stats.upcomingRenewals !== 1 ? "s" : ""} due`}
            icon={Globe} color="#0891b2" href="/domains"
          />
        </div>
      ) : null}

      {/* ── Main Row: Alerts + Activity ───────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-7">

        {/* Alerts */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CardTitle>Recent Alerts</CardTitle>
                {critAlerts > 0 && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 tabular-nums">
                    {critAlerts} critical
                  </span>
                )}
              </div>
              <Link href="/security">
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-[76px] rounded-xl" />)}
              </div>
            ) : alerts && alerts.length > 0 ? (
              <div className="space-y-2">
                {alerts.map(alert => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/20 hover:bg-muted/40 border border-border/50 transition-colors"
                  >
                    <span className={`w-0.5 self-stretch rounded-full shrink-0 ${SEV_RAIL[alert.severity] ?? "bg-slate-400"}`} />
                    <SevIcon s={alert.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug truncate">{alert.title}</p>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${SEV_PILL[alert.severity] ?? "bg-muted text-muted-foreground"}`}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{alert.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5">{timeAgo(alert.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="p-3 rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">All clear — no active alerts</p>
                  <p className="text-xs text-muted-foreground mt-0.5">All systems are operating normally</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Activity Chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Audit Activity</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Operations logged · last 7 days</p>
              </div>
              <div className="p-1.5 rounded-lg bg-muted/50">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-[196px] w-full rounded-lg" />
            ) : activityChart && activityChart.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={activityChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="totalG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={BRAND} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={BRAND} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="createG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number, n: string) => [v, n.charAt(0).toUpperCase() + n.slice(1)]}
                    />
                    <Area type="monotone" dataKey="total" stroke={BRAND} strokeWidth={2}
                      fill="url(#totalG)" dot={false} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="creates" stroke="#22c55e" strokeWidth={1.5}
                      fill="url(#createG)" dot={false} activeDot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-5 mt-3">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: BRAND }} />
                    Total ops
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-3 h-0.5 rounded-full bg-emerald-500 inline-block" />
                    Creates
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[196px] gap-2.5 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/25" />
                <div>
                  <p className="text-sm text-muted-foreground font-medium">No activity recorded yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Changes across modules will appear here</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom Row: Vuln · App Envs · Quick Access ───────────────────── */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">

        {/* Vulnerability Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Vulnerability Breakdown</CardTitle>
              <Link href="/security">
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  Details <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-[148px] w-full rounded-lg" />
            ) : vulnData.length > 0 ? (
              <ResponsiveContainer width="100%" height={148}>
                <PieChart>
                  <Pie data={vulnData} cx="50%" cy="48%" innerRadius={38} outerRadius={60} paddingAngle={5} dataKey="value">
                    {vulnData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[148px] gap-2.5">
                <div className="p-3 rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">No open vulnerabilities</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* App Environments */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">App Environments</CardTitle>
              <Link href="/applications">
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  Registry <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-[148px] w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={148}>
                <BarChart data={appEnvData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                    <Cell fill={BRAND} />
                    <Cell fill="#7c3aed" />
                    <Cell fill="#d97706" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick Access */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Quick Access</CardTitle>
              <Zap className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <p className="text-xs text-muted-foreground">Navigate to any module instantly</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-1">
              {MODULES.map(({ icon: Icon, label, href, statKey }) => {
                const count = statKey && stats ? (stats as unknown as Record<string, unknown>)[statKey] as number | undefined : undefined;
                return (
                  <Link key={label} href={href}>
                    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/60 border border-transparent hover:border-border/60 transition-all cursor-pointer group">
                      <div className="p-1 rounded-md bg-muted/40 group-hover:bg-background transition-colors">
                        <Icon className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                      <span className="text-xs font-medium flex-1 text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                      {count != null && (
                        <span className="text-[10px] font-bold text-muted-foreground/60 tabular-nums">{count}</span>
                      )}
                      <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-all -translate-x-1 group-hover:translate-x-0 duration-150" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
