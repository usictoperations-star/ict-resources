import React from "react";

interface PageHeaderProps {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle: string;
  count?: number;
  actions?: React.ReactNode;
}

export function PageHeader({ icon: Icon, iconColor, title, subtitle, count, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="p-2.5 rounded-xl shrink-0" style={{ backgroundColor: `${iconColor}18` }}>
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {count != null && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground border border-border/60">
                {count}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {actions}
        </div>
      )}
    </div>
  );
}
