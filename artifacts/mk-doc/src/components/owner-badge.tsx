import { useListUsers } from "@workspace/api-client-react";

export function OwnerBadge({ ownerId }: { ownerId?: number | null }) {
  const { data: users } = useListUsers();
  if (!ownerId) return <span className="text-sm text-muted-foreground">Unassigned</span>;
  const user = users?.find(u => u.id === ownerId);
  if (!user) return <span className="text-sm text-muted-foreground">Unassigned</span>;
  return <span className="text-sm font-medium">{user.name}</span>;
}
