import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListUsers } from "@workspace/api-client-react";

export function OwnerSelectField({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) {
  const { data: users } = useListUsers();
  return (
    <Select value={value || "unassigned"} onValueChange={v => onValueChange(v === "unassigned" ? "" : v)}>
      <SelectTrigger className="h-9"><SelectValue placeholder="Select owner" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {users?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
