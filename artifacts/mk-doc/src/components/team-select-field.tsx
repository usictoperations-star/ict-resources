import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListTeams } from "@workspace/api-client-react";

export function TeamSelectField({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) {
  const { data: teamsPage } = useListTeams({ limit: 100 });
  const teams = teamsPage?.data;
  return (
    <Select value={value || "unassigned"} onValueChange={v => onValueChange(v === "unassigned" ? "" : v)}>
      <SelectTrigger className="h-9"><SelectValue placeholder="Select team" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {teams?.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
