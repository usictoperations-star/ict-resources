export function OwnerBadge({ ownerName }: { ownerName?: string | null }) {
  if (!ownerName) return <span className="text-sm text-muted-foreground">Unassigned</span>;
  return <span className="text-sm font-medium">{ownerName}</span>;
}
