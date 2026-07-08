import { Badge } from "@/components/ui/badge";
import { useListTeams } from "@workspace/api-client-react";

const TEAM_COLORS: Record<string, string> = {
  "infra-cloud-ops": "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100",
  "app-engineering": "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100",
  "cybersecurity-governance": "bg-red-100 text-red-800 border-red-200 hover:bg-red-100",
  "digital-ops-pmo": "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100",
};

export function useTeams() {
  return useListTeams();
}

export function TeamBadge({ teamId }: { teamId?: number | null }) {
  const { data: teams } = useListTeams();
  if (!teamId) return <span className="text-sm text-muted-foreground">Unassigned</span>;
  const team = teams?.find(t => t.id === teamId);
  if (!team) return <span className="text-sm text-muted-foreground">Unassigned</span>;
  return (
    <Badge variant="outline" className={TEAM_COLORS[team.slug] ?? ""}>
      {team.name}
    </Badge>
  );
}
