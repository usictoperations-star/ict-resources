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

function DependentsWarning({ dependents, entityKind = "application" }: { dependents: DependentCounts; entityKind?: string }) {
  if (dependents.total === 0) return null;

  const items: string[] = [];
  if (dependents.releases) items.push(`${dependents.releases} release${dependents.releases !== 1 ? "s" : ""}`);
  if (dependents.documents) items.push(`${dependents.documents} document${dependents.documents !== 1 ? "s" : ""}`);
  if (dependents.vulnerabilities) items.push(`${dependents.vulnerabilities} vulnerability${dependents.vulnerabilities !== 1 ? " records" : ""}`);
  if (dependents.software) items.push(`${dependents.software} software item${dependents.software !== 1 ? "s" : ""}`);
  if (dependents.repositories) items.push(`${dependents.repositories} repositor${dependents.repositories !== 1 ? "ies" : "y"}`);
  if (dependents.domains) items.push(`${dependents.domains} domain${dependents.domains !== 1 ? "s" : ""}`);
  if (dependents.applications) items.push(`${dependents.applications} application${dependents.applications !== 1 ? "s" : ""}`);

  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 flex gap-2">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <div className="text-sm text-amber-800 dark:text-amber-300">
        <span className="font-semibold">Linked records will be orphaned:</span>{" "}
        {items.join(", ")} {items.length === 1 ? "is" : "are"} linked to this {entityKind} and will lose their association.
      </div>
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
}) {
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
              {dependents && <DependentsWarning dependents={dependents} entityKind={entityKind} />}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={isPending || isLoadingDependents}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
