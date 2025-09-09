"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { createTask } from "@/app/actions/tasks";

export default function TasksList() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from("planner_items")
      .select("*")
      .eq('type', 'daily')
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
      setTasks([]);
    } else {
      setTasks(data || []);
    }
  }, []);

  useEffect(() => {
    load();
    // realtime updates (optional)
    const ch = supabase
      .channel("planner-items-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planner_items" },
        () => {
          // Re-fetch on any change
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const handleAdd = async () => {
    try {
      setLoading(true);
      await createTask({ title: "My first task" });
      // load() will be triggered by realtime listener; still call as fallback
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to add task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={handleAdd}
          disabled={loading}
          className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Adding…" : "Add Task"}
        </button>
        {error && (
          <span className="text-sm text-red-500" role="alert">
            {error}
          </span>
        )}
      </div>
      <ul className="list-disc pl-5 space-y-1">
        {tasks.map((t) => (
          <li key={t.id}>{t.title}</li>
        ))}
        {tasks.length === 0 && (
          <li className="list-none text-muted-foreground">No tasks yet</li>
        )}
      </ul>
    </div>
  );
}
