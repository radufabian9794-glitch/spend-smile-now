import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Wallet, LogOut, Trash2, Pencil, Search, X, Moon, Sun, Tags, Check } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Spendly — Track your spending" },
      { name: "description", content: "A simple, private spending tracker. Log payments by type, amount, and date." },
    ],
  }),
  component: Dashboard,
});

const FALLBACK_COLOR = "#64748b";

/** Trim and collapse internal whitespace; returns null when empty. */
function cleanMerchant(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

type Category = {
  id: string;
  name: string;
  color: string;
};

type Expense = {
  id: string;
  type: string;
  amount: number;
  payment_date: string;
  description: string | null;
  merchant: string | null;
  created_at: string;
};

function Dashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [manageOpen, setManageOpen] = useState(false);

  // Initial theme from localStorage / system preference (pre-login paint)
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefers = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : !!prefers;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const applyTheme = (isDark: boolean) => {
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };

  const toggleDark = async () => {
    const next = !dark;
    applyTheme(next);
    if (!session) return;
    const { error } = await supabase
      .from("profiles")
      .update({ theme: next ? "dark" : "light" })
      .eq("user_id", session.user.id);
    if (error) toast.error("Couldn't save theme preference");
  };

  // form
  const [type, setType] = useState("Food");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // edit
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editMerchant, setEditMerchant] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // filters
  const [filterType, setFilterType] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [search, setSearch] = useState("");
  const [filterMin, setFilterMin] = useState("");
  const [filterMax, setFilterMax] = useState("");

  const openEdit = (e: Expense) => {
    setEditing(e);
    setEditAmount(String(e.amount));
    setEditDate(e.payment_date);
    setEditMerchant(e.merchant ?? "");
    setEditDescription(e.description ?? "");
  };

  const saveEdit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editing) return;
    const amt = Number(editAmount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setEditSaving(true);
    const { data, error } = await supabase
      .from("expenses")
      .update({
        amount: amt,
        payment_date: editDate,
        merchant: cleanMerchant(editMerchant),
        description: editDescription.trim() || null,
      })
      .eq("id", editing.id)
      .select()
      .single();
    setEditSaving(false);
    if (error) return toast.error(error.message);
    setExpenses((prev) => prev.map((x) => (x.id === editing.id ? (data as Expense) : x)));
    setEditing(null);
    toast.success("Payment updated");
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) navigate({ to: "/auth" });
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
      if (!data.session) navigate({ to: "/auth" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("expenses")
      .select("*")
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) return toast.error(error.message);
        setExpenses((data ?? []) as Expense[]);
      });
  }, [session]);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, color")
      .order("name", { ascending: true });
    if (error) return toast.error(error.message);
    const cats = (data ?? []) as Category[];
    setCategories(cats);
    setType((prev) => (cats.some((c) => c.name === prev) ? prev : cats[0]?.name ?? ""));
  };

  useEffect(() => {
    if (!session) return;
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const colorFor = (name: string) =>
    categories.find((c) => c.name === name)?.color ?? FALLBACK_COLOR;

  // Load persisted theme from the user's profile
  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("theme")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.theme) applyTheme(data.theme === "dark");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const total = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.amount), 0),
    [expenses]
  );

  const monthTotal = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return expenses
      .filter((e) => e.payment_date.startsWith(ym))
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [expenses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = filterMin === "" ? null : Number(filterMin);
    const max = filterMax === "" ? null : Number(filterMax);
    return expenses.filter((e) => {
      if (filterType !== "all" && e.type !== filterType) return false;
      if (filterFrom && e.payment_date < filterFrom) return false;
      if (filterTo && e.payment_date > filterTo) return false;
      const amt = Number(e.amount);
      if (min !== null && !Number.isNaN(min) && amt < min) return false;
      if (max !== null && !Number.isNaN(max) && amt > max) return false;
      if (q) {
        const hay = `${e.type} ${e.merchant ?? ""} ${e.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, filterType, filterFrom, filterTo, filterMin, filterMax, search]);

  const filteredTotal = useMemo(
    () => filtered.reduce((s, e) => s + Number(e.amount), 0),
    [filtered]
  );

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      map.set(e.type, (map.get(e.type) ?? 0) + Number(e.amount));
    }
    return Array.from(map, ([name, value]) => ({ name, value })).sort(
      (a, b) => b.value - a.value
    );
  }, [filtered]);

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      const ym = e.payment_date.slice(0, 7);
      map.set(ym, (map.get(ym) ?? 0) + Number(e.amount));
    }
    return Array.from(map, ([month, total]) => ({ month, total })).sort((a, b) =>
      a.month.localeCompare(b.month)
    );
  }, [filtered]);

  const TOP_MERCHANTS = 7;
  const byMerchant = useMemo(() => {
    const groups = new Map<string, { display: string; total: number; count: number }>();
    for (const e of filtered) {
      const cleaned = cleanMerchant(e.merchant);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      const existing = groups.get(key);
      if (existing) {
        existing.total += Number(e.amount);
        existing.count += 1;
      } else {
        groups.set(key, { display: cleaned, total: Number(e.amount), count: 1 });
      }
    }
    return Array.from(groups.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_MERCHANTS)
      .map((g) => ({
        name: g.display,
        total: g.total,
        count: g.count,
        avg: g.count > 0 ? g.total / g.count : 0,
      }));
  }, [filtered]);

  const merchantSuggestions = useMemo(() => {
    // Group by normalized key (case-insensitive, whitespace-collapsed),
    // and surface the most common original spelling as the display value.
    const groups = new Map<string, Map<string, number>>();
    for (const e of expenses) {
      const cleaned = cleanMerchant(e.merchant);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      const variants = groups.get(key) ?? new Map<string, number>();
      variants.set(cleaned, (variants.get(cleaned) ?? 0) + 1);
      groups.set(key, variants);
    }
    return Array.from(groups.values())
      .map((variants) => {
        let total = 0;
        let best = "";
        let bestCount = -1;
        for (const [name, count] of variants) {
          total += count;
          if (count > bestCount) {
            best = name;
            bestCount = count;
          }
        }
        return { name: best, total };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .map((g) => g.name);
  }, [expenses]);

  const filtersActive =
    filterType !== "all" || !!filterFrom || !!filterTo || !!filterMin || !!filterMax || !!search.trim();

  const clearFilters = () => {
    setFilterType("all");
    setFilterFrom("");
    setFilterTo("");
    setFilterMin("");
    setFilterMax("");
    setSearch("");
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: session.user.id,
        type,
        amount: amt,
        payment_date: date,
        merchant: cleanMerchant(merchant),
        description: description.trim() || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    setExpenses((prev) => [data as Expense, ...prev]);
    setOpen(false);
    setAmount("");
    setMerchant("");
    setDescription("");
    toast.success("Payment added");
  };

  const removeExpense = async (id: string) => {
    const prev = expenses;
    setExpenses(expenses.filter((e) => e.id !== id));
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      setExpenses(prev);
      toast.error(error.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (!ready || !session) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/30">
      <Toaster richColors position="top-center" />
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center">
              <Wallet className="size-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Spendly</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{session.user.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4 mr-1" /> Sign out
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDark}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">This month</p>
            <p className="text-3xl font-bold mt-1">${monthTotal.toFixed(2)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">All time</p>
            <p className="text-3xl font-bold mt-1">${total.toFixed(2)}</p>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <p className="text-sm font-medium mb-3">Spending by type</p>
            {byType.length === 0 ? (
              <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">
                No data to display
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={byType}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {byType.map((entry) => (
                      <Cell key={entry.name} fill={colorFor(entry.name)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => `$${Number(v).toFixed(2)}`}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-sm font-medium mb-3">Spending by month</p>
            {byMonth.length === 0 ? (
              <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">
                No data to display
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byMonth} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                    tickLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                    tickLine={{ stroke: "var(--border)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--accent)", opacity: 0.3 }}
                    formatter={(v: number) => `$${Number(v).toFixed(2)}`}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-5 lg:col-span-2">
            <p className="text-sm font-medium mb-3">Top merchants by spend</p>
            {byMerchant.length === 0 ? (
              <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">
                No merchant data to display
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, byMerchant.length * 38)}>
                <BarChart
                  data={byMerchant}
                  layout="vertical"
                  margin={{ top: 5, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                    tickLine={{ stroke: "var(--border)" }}
                    tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                    tickLine={{ stroke: "var(--border)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--accent)", opacity: 0.3 }}
                    formatter={(v: number, _n, item) => {
                      const count = Number(item?.payload?.count ?? 0);
                      const avg = Number(item?.payload?.avg ?? 0);
                      return [
                        `$${Number(v).toFixed(2)} total · avg $${avg.toFixed(2)}`,
                        `${count} payment${count === 1 ? "" : "s"}`,
                      ];
                    }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar dataKey="total" fill="var(--primary)" radius={[0, 6, 6, 0]}>
                    <LabelList
                      dataKey="avg"
                      position="right"
                      formatter={(v: number) => `avg $${Number(v).toFixed(2)}`}
                      style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Recent payments</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setManageOpen(true)}>
              <Tags className="size-4 mr-1" /> Categories
            </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4 mr-1" /> Add payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New payment</DialogTitle>
              </DialogHeader>
              <form onSubmit={addExpense} className="space-y-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          <span className="inline-flex items-center gap-2">
                            <span className="size-3 rounded-full" style={{ background: c.color }} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input id="amount" type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="merchant">Merchant <span className="text-muted-foreground">(optional)</span></Label>
                  <Input id="merchant" list="merchant-suggestions" autoComplete="off" maxLength={120} placeholder="e.g. Whole Foods" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description <span className="text-muted-foreground">(optional)</span></Label>
                  <Textarea id="desc" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save payment"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card className="p-4 space-y-3">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by type, merchant or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Min amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={filterMin}
                onChange={(e) => setFilterMin(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="No limit"
                value={filterMax}
                onChange={(e) => setFilterMax(e.target.value)}
              />
            </div>
          </div>
          {filtersActive && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {filtered.length} match{filtered.length === 1 ? "" : "es"} · ${filteredTotal.toFixed(2)}
              </span>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-4 mr-1" /> Clear
              </Button>
            </div>
          )}
        </Card>

        <Card className="divide-y">
          {expenses.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              No payments yet. Add your first one to get started.
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              No payments match your filters.
            </div>
          ) : (
            filtered.map((e) => (
              <div key={e.id} className="p-4 flex items-center gap-4">
                <div
                  className="size-10 rounded-lg grid place-items-center text-xs font-semibold shrink-0 text-white"
                  style={{ background: colorFor(e.type) }}
                >
                  {e.type.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="font-medium truncate">
                      {e.type}
                      {e.merchant && <span className="text-muted-foreground font-normal"> · {e.merchant}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{e.payment_date}</p>
                  </div>
                  {e.description && <p className="text-sm text-muted-foreground truncate">{e.description}</p>}
                </div>
                <p className="font-semibold tabular-nums">${Number(e.amount).toFixed(2)}</p>
                <Button variant="ghost" size="icon" onClick={() => openEdit(e)} aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => removeExpense(e.id)} aria-label="Delete">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </Card>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit payment{editing ? ` · ${editing.type}` : ""}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-amount">Amount</Label>
                  <Input id="edit-amount" type="number" step="0.01" min="0" required value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Date</Label>
                  <Input id="edit-date" type="date" required value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-merchant">Merchant <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="edit-merchant" list="merchant-suggestions" autoComplete="off" maxLength={120} value={editMerchant} onChange={(e) => setEditMerchant(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea id="edit-desc" rows={2} maxLength={500} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={editSaving}>{editSaving ? "Saving..." : "Save changes"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ManageCategoriesDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          userId={session.user.id}
          categories={categories}
          onChanged={loadCategories}
        />

        <datalist id="merchant-suggestions">
          {merchantSuggestions.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </main>
    </div>
  );
}

const PRESET_COLORS = [
  "#22c55e", "#0ea5e9", "#f59e0b", "#a855f7",
  "#ef4444", "#14b8a6", "#6366f1", "#64748b",
  "#ec4899", "#84cc16", "#f97316", "#06b6d4",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="size-6 rounded-full border border-border grid place-items-center"
          style={{ background: c }}
          aria-label={`Choose ${c}`}
        >
          {value.toLowerCase() === c.toLowerCase() && <Check className="size-3.5 text-white" />}
        </button>
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-6 rounded-full overflow-hidden border border-border bg-transparent cursor-pointer"
        aria-label="Custom color"
      />
    </div>
  );
}

function ManageCategoriesDialog({
  open,
  onOpenChange,
  userId,
  categories,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  categories: Category[];
  onChanged: () => Promise<unknown> | unknown;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [adding, setAdding] = useState(false);

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return toast.error("Enter a category name");
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return toast.error("A category with that name already exists");
    }
    setAdding(true);
    const { error } = await supabase
      .from("categories")
      .insert({ user_id: userId, name, color: newColor });
    setAdding(false);
    if (error) return toast.error(error.message);
    setNewName("");
    setNewColor(PRESET_COLORS[0]);
    await onChanged();
    toast.success("Category added");
  };

  const updateCategory = async (id: string, patch: { name?: string; color?: string }) => {
    const { error } = await supabase.from("categories").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    await onChanged();
  };

  const removeCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? Existing payments keep this label.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await onChanged();
    toast.success("Category deleted");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              onSave={(patch) => updateCategory(c.id, patch)}
              onDelete={() => removeCategory(c.id, c.name)}
            />
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          )}
        </div>

        <form onSubmit={addCategory} className="border-t pt-4 space-y-3">
          <Label className="text-sm">Add a new category</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Category name"
              maxLength={40}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit" disabled={adding}>
              <Plus className="size-4 mr-1" /> Add
            </Button>
          </div>
          <ColorPicker value={newColor} onChange={setNewColor} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({
  category,
  onSave,
  onDelete,
}: {
  category: Category;
  onSave: (patch: { name?: string; color?: string }) => Promise<unknown>;
  onDelete: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const dirty = name.trim() !== category.name || color !== category.color;

  useEffect(() => {
    setName(category.name);
    setColor(category.color);
  }, [category.id, category.name, category.color]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Name can't be empty");
    await onSave({ name: trimmed, color });
    toast.success("Category updated");
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className="size-4 rounded-full shrink-0 border border-border"
          style={{ background: color }}
        />
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        {dirty && (
          <Button size="sm" onClick={save}>Save</Button>
        )}
        <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete category">
          <Trash2 className="size-4" />
        </Button>
      </div>
      <ColorPicker value={color} onChange={setColor} />
    </div>
  );
}
