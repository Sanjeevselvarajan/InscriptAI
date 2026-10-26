import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, ExternalLink, Loader2, ScanText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "My History — InscriptAI" },
      { name: "description", content: "Your saved Tamil inscription analyses." },
      { property: "og:title", content: "My History — InscriptAI" },
      { property: "og:description", content: "Reopen and manage saved inscription analyses." },
    ],
  }),
  component: History,
});

const PAGE = 10;

function History() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscription_analyses")
        .select("id, original_filename, script_type, english_translation, created_at, edited_tamil, original_text")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => {
    const s = q.toLowerCase();
    const f = (data ?? []).filter(
      (r) => !s || r.original_filename.toLowerCase().includes(s) || (r.script_type ?? "").toLowerCase().includes(s) || (r.edited_tamil ?? r.original_text ?? "").includes(q),
    );
    return sort === "new" ? f : [...f].reverse();
  }, [data, q, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);

  async function del(id: string) {
    const { error } = await supabase.from("inscription_analyses").delete().eq("id", id);
    if (error) return void toast.error("Could not delete: " + error.message);
    toast.success("Analysis deleted");
    qc.invalidateQueries({ queryKey: ["history"] });
  }

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user)
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-4xl">My History</h1>
        <p className="mt-3 text-muted-foreground">Sign in to view your saved analyses.</p>
        <Button asChild className="mt-6 bg-gradient-primary"><Link to="/auth">Sign in</Link></Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl">My History</h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="pl-8" aria-label="Search history" />
          </div>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as "new" | "old")} className="rounded-md border bg-background px-3 text-sm">
            <option value="new">Newest</option>
            <option value="old">Oldest</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : error ? (
        <p className="mt-10 text-destructive">Could not load history. Please refresh.</p>
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border bg-card p-12 text-center shadow-soft">
          <ScanText className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-4 font-medium">{data?.length ? "No matches" : "No saved analyses yet"}</p>
          <Button asChild className="mt-6 bg-gradient-primary"><Link to="/analyze">Analyze an inscription</Link></Button>
        </div>
      ) : (
        <>
          <ul className="mt-8 divide-y rounded-2xl border bg-card shadow-soft">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-accent font-tamil text-lg text-accent-foreground">
                  {(r.edited_tamil || r.original_text || "அ").trim().charAt(0) || "அ"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.original_filename}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()} · {r.script_type || "unknown script"} ·{" "}
                    <span className={r.english_translation ? "text-success" : ""}>{r.english_translation ? "Translated" : "Not translated"}</span>
                  </p>
                </div>
                <Button asChild size="sm" variant="outline"><Link to="/analyze" search={{ id: r.id }}><ExternalLink className="mr-1 h-4 w-4" />Open</Link></Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
                      <AlertDialogDescription>“{r.original_filename}” will be permanently removed.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => del(r.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
              <span>{page + 1} / {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
