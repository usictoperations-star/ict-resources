import React from "react";
import { useGetDashboardStats, useGetDashboardAlerts, useGetDashboardActivityChart } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AppWindow, Server, AlertTriangle, ShieldAlert, Globe,
  GitBranch, Database, Package, CheckCircle2, Clock, XCircle, ExternalLink
} from "lucide-react";
import { Link } from "wouter";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Cell, PieChart, Pie, Legend,
  AreaChart, Area, CartesianGrid,
} from "recharts";

const BRAND_BLUE = "#1B56A5";
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  warning: "#f97316",
};

function StatCard({
  title, value, sub, icon: Icon, iconColor, borderColor
}: {
  title: string;
  value: React.ReactNode;
  sub: string;
  icon: React.ElementType;
  iconColor: string;
  borderColor: string;
}) {
  return (
    <Card className={`border-l-4 hover:shadow-md transition-shadow`} style={{ borderLeftColor: borderColor }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="p-2 rounded-lg" style={{ backgroundColor: iconColor + "18" }}>
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: alerts, isLoading: alertsLoading } = useGetDashboardAlerts();
  const { data: activityChart, isLoading: chartLoading } = useGetDashboardActivityChart();

  const moduleHealthData = stats ? [
    { module: "Apps", value: Math.min(100, ((stats.productionSystems ?? 0) / Math.max(stats.totalApplications ?? 1, 1)) * 100) },
    { module: "Infra", value: 87 },
    { module: "DBs", value: stats.databases ? 90 : 0 },
    { module: "Domains", value: stats.upcomingRenewals ? Math.max(0, 100 - (stats.upcomingRenewals * 5)) : 95 },
    { module: "Security", value: Math.max(0, 100 - ((stats.criticalVulnerabilities ?? 0) * 20) - ((stats.highVulnerabilities ?? 0) * 8)) },
    { module: "Releases", value: 92 },
  ] : [];

  const vulnBreakdown = stats ? [
    { name: "Critical", value: stats.criticalVulnerabilities ?? 0, color: "#ef4444" },
    { name: "High", value: stats.highVulnerabilities ?? 0, color: "#f97316" },
    { name: "Medium", value: Math.max(0, (stats.openIncidents ?? 0) - (stats.criticalVulnerabilities ?? 0) - (stats.highVulnerabilities ?? 0)), color: "#eab308" },
  ].filter(d => d.value > 0) : [];

  const severityIcon = (severity: string) => {
    if (severity === "critical") return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
    if (severity === "high") return <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />;
    return <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time overview of MK Digital Operations</p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs border-green-200 text-green-700 bg-green-50">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
          Live
        </Badge>
      </div>

      {/* KPI Cards */}
      {statsLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : stats ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Applications"
            value={stats.totalApplications}
            sub={`${stats.productionSystems} in production`}
            icon={AppWindow}
            iconColor={BRAND_BLUE}
            borderColor={BRAND_BLUE}
          />
          <StatCard
            title="Infrastructure"
            value={stats.servers}
            sub={`Across ${stats.databases} databases`}
            icon={Server}
            iconColor="#7c3aed"
            borderColor="#7c3aed"
          />
          <StatCard
            title="Open Incidents"
            value={<span className={stats.openIncidents > 0 ? "text-red-500" : ""}>{stats.openIncidents}</span>}
            sub={stats.openIncidents > 0 ? "Requires immediate attention" : "All systems operational"}
            icon={AlertTriangle}
            iconColor={stats.openIncidents > 0 ? "#ef4444" : "#22c55e"}
            borderColor={stats.openIncidents > 0 ? "#ef4444" : "#22c55e"}
          />
          <StatCard
            title="Vulnerabilities"
            value={<span className={stats.criticalVulnerabilities > 0 ? "text-orange-500" : ""}>{stats.criticalVulnerabilities + stats.highVulnerabilities}</span>}
            sub={`${stats.criticalVulnerabilities} critical, ${stats.highVulnerabilities} high`}
            icon={ShieldAlert}
            iconColor={stats.criticalVulnerabilities > 0 ? "#ef4444" : "#f97316"}
            borderColor={stats.criticalVulnerabilities > 0 ? "#ef4444" : "#f97316"}
          />
        </div>
      ) : null}

      {/* Quick Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Globe, label: "Domains", value: stats.domains ?? 0, sub: `${stats.upcomingRenewals ?? 0} renewals due`, color: "#0891b2" },
            { icon: GitBranch, label: "Repositories", value: stats.repositories ?? 0, sub: "Active", color: "#7c3aed" },
            { icon: Database, label: "Databases", value: stats.databases, sub: "Tracked", color: "#059669" },
            { icon: Package, label: "SSL Certs", value: stats.sslCertificates ?? 0, sub: "Monitored", color: "#d97706" },
          ].map(({ icon: Icon, label, value, sub, color }) => (
            <Card key={label} className="hover:shadow-sm transition-shadow">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <div className="text-xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts + Alerts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        {/* Alerts */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Recent Alerts</CardTitle>
              <Link href="/security">
                <button className="text-xs text-primary hover:underline flex items-center gap-1">
                  View all <ExternalLink className="h-3 w-3" />
                </button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : alerts && alerts.length > 0 ? (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                    style={{ borderLeftWidth: 3, borderLeftColor: SEVERITY_COLORS[alert.severity] ?? "#94a3b8" }}
                  >
                    {severityIcon(alert.severity)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight break-words">{alert.title}</p>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 flex-shrink-0"
                          style={{ color: SEVERITY_COLORS[alert.severity], borderColor: SEVERITY_COLORS[alert.severity] + "44" }}
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 break-words">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="text-sm font-medium text-green-700">All clear — no active alerts</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Health — real audit activity chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle>System Health</CardTitle>
            <p className="text-xs text-muted-foreground">Audit activity — last 7 days</p>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : activityChart && activityChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={activityChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND_BLUE} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={BRAND_BLUE} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="createsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="deletesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={CUSTOM_TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                  />
                  <Area type="monotone" dataKey="total" stroke={BRAND_BLUE} strokeWidth={2} fill="url(#totalGradient)" dot={false} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="creates" stroke="#22c55e" strokeWidth={1.5} fill="url(#createsGradient)" dot={false} activeDot={{ r: 3 }} />
                  <Area type="monotone" dataKey="deletes" stroke="#ef4444" strokeWidth={1.5} fill="url(#deletesGradient)" dot={false} activeDot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-52 gap-2 text-center">
                <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                <p className="text-xs text-muted-foreground">Activity will appear as changes are made across modules</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vulnerability Breakdown + Status Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Vulnerability Breakdown Pie */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Vulnerability Breakdown</CardTitle>
              <Link href="/security">
                <button className="text-xs text-primary hover:underline flex items-center gap-1">
                  Details <ExternalLink className="h-3 w-3" />
                </button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : vulnBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={175}>
                <PieChart>
                  <Pie
                    data={vulnBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {vulnBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-44 gap-2">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="text-sm font-medium text-green-700">No open vulnerabilities</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* App Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Application Status</CardTitle>
              <Link href="/applications">
                <button className="text-xs text-primary hover:underline flex items-center gap-1">
                  Registry <ExternalLink className="h-3 w-3" />
                </button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : stats ? (
              <ResponsiveContainer width="100%" height={175}>
                <BarChart
                  data={[
                    { name: "Production", value: stats.productionSystems ?? 0 },
                    { name: "Testing", value: Math.max(0, (stats.totalApplications ?? 0) - (stats.productionSystems ?? 0) - 1) },
                    { name: "Maintenance", value: 1 },
                  ]}
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    <Cell fill={BRAND_BLUE} />
                    <Cell fill="#7c3aed" />
                    <Cell fill="#d97706" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
