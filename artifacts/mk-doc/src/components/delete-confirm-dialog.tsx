import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";

export type DependentCounts = {
  releases?: number;
  documents?: number;
  vulnerabilities?: number;
  software?: number;
  repositories?: number;
  domains?: number;
  applications?: number;
  total: number;
};

export type LinkedAction =
  | { type: "cascade" }
  | { type: "reassign"; targetId: number };

export type LinkedOptions = {
  apps: Array<{ id: number; name: string }>;
  onConfirm: (action: LinkedAction) => void;
};

function dependentSummary(dependents: DependentCounts): string {
  const items: string[] = [];
  if (dependents.releases) items.push(`${dependents.releases} release${dependents.releases !== 1 ? "s" : ""}`);
  if (dependents.documents) items.push(`${dependents.documents} document${dependents.documents !== 1 ? "s" : ""}`);
  if (dependents.vulnerabilities) items.push(`${dependents.vulnerabilities} vulnerability${dependents.vulnerabilities !== 1 ? " records" : ""}`);
  if (dependents.software) items.push(`${dependents.software} software item${dependents.software !== 1 ? "s" : ""}`);
  if (dependents.repositories) items.push(`${dependents.repositories} repositor${dependents.repositories !== 1 ? "ies" : "y"}`);
  if (dependents.domains) items.push(`${dependents.domains} domain${dependents.domains !== 1 ? "s" : ""}`);
  if (dependents.applications) items.push(`${dependents.applications} application${dependents.applications !== 1 ? "s" : ""}`);
  return items.join(", ");
}

function DependentsWarning({ dependents, entityKind = "application" }: { dependents: DependentCounts; entityKind?: string }) {
  if (dependents.total === 0) return null;
  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 flex gap-2">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <div className="text-sm text-amber-800 dark:text-amber-300">
        <span className="font-semibold">Linked records will be orphaned:</span>{" "}
        {dependentSummary(dependents)} {dependents.total === 1 ? "is" : "are"} linked to this {entityKind} and will lose their association.
      </div>
    </div>
  );
}

function LinkedRecordOptions({
  dependents,
  apps,
  choice,
  onChoiceChange,
  targetId,
  onTargetChange,
}: {
  dependents: DependentCounts;
  apps: Array<{ id: number; name: string }>;
  choice: "cascade" | "reassign" | null;
  onChoiceChange: (v: "cascade" | "reassign") => void;
  targetId: string;
  onTargetChange: (v: string) => void;
}) {
  if (dependents.total === 0) return null;
  const summary = dependentSummary(dependents);
  const hasOtherApps = apps.length > 0;
  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-3 space-y-3">
      <div className="flex gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <span className="font-semibold">{dependents.total} linked record{dependents.total !== 1 ? "s" : ""}:</span>{" "}
          {summary}. Choose what to do with them:
        </p>
      </div>
      <RadioGroup
        value={choice ?? ""}
        onValueChange={(v) => onChoiceChange(v as "cascade" | "reassign")}
        className="gap-2 pl-1"
      >
        {hasOtherApps && (
          <div className="flex items-start gap-2">
            <RadioGroupItem value="reassign" id="linked-reassign" className="mt-0.5" />
            <div className="space-y-1.5">
              <Label htmlFor="linked-reassign" className="text-sm font-medium cursor-pointer">
                Reassign linked records to another application
              </Label>
              {choice === "reassign" && (
                <Select value={targetId} onValueChange={onTargetChange}>
                  <SelectTrigger className="h-8 text-sm bg-white dark:bg-background">
                    <SelectValue placeholder="Select application…" />
                  </SelectTrigger>
                  <SelectContent>
                    {apps.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <RadioGroupItem value="cascade" id="linked-cascade" />
          <Label htmlFor="linked-cascade" className="text-sm font-medium cursor-pointer">
            Delete all linked records too
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemLabel,
  entityName,
  entityKind,
  isPending,
  onConfirm,
  dependents,
  isLoadingDependents,
  linkedOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel: string;
  entityName: string;
  entityKind?: string;
  isPending: boolean;
  onConfirm: () => void;
  dependents?: DependentCounts;
  isLoadingDependents?: boolean;
  linkedOptions?: LinkedOptions;
}) {
  const showLinked = !!linkedOptions && !!dependents && dependents.total > 0;

  const [choice, setChoice] = useState<"cascade" | "reassign" | null>(null);
  const [targetId, setTargetId] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setChoice(null);
      setTargetId("");
    }
  }, [open]);

  const isActionInvalid =
    showLinked &&
    (choice === null || (choice === "reassign" && !targetId));

  const handleConfirm = () => {
    if (showLinked && linkedOptions) {
      if (choice === "cascade") {
        linkedOptions.onConfirm({ type: "cascade" });
      } else if (choice === "reassign" && targetId) {
        linkedOptions.onConfirm({ type: "reassign", targetId: Number(targetId) });
      }
    } else {
      onConfirm();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {entityName}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <span>
                This will permanently delete{" "}
                <span className="font-semibold text-foreground">{itemLabel}</span>. This action cannot be undone.
              </span>
              {isLoadingDependents && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Checking linked records…
                </div>
              )}
              {showLinked ? (
                <LinkedRecordOptions
                  dependents={dependents!}
                  apps={linkedOptions!.apps}
                  choice={choice}
                  onChoiceChange={setChoice}
                  targetId={targetId}
                  onTargetChange={setTargetId}
                />
              ) : (
                dependents && <DependentsWarning dependents={dependents} entityKind={entityKind} />
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={isPending || isLoadingDependents || isActionInvalid}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
