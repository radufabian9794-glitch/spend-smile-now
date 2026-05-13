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
import { toast } from "sonner";
import { Plus, Wallet, LogOut, Trash2, Pencil, Search, X, Moon, Sun, Tags, Check, Settings, TrendingUp } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveContainer,
  Tooltip,
  Sankey,
  Layer,
  Rectangle,
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
const INCOME_TYPE = "__income";

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

  // income form
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDate, setIncomeDate] = useState(new Date().toISOString().slice(0, 10));
  const [incomeDescription, setIncomeDescription] = useState("");
  const [incomeSaving, setIncomeSaving] = useState(false);

  // edit
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editMerchant, setEditMerchant] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // delete confirmation
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  // account settings
  const [accountOpen, setAccountOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

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

  const spendExpenses = useMemo(
    () => expenses.filter((e) => e.type !== INCOME_TYPE),
    [expenses],
  );
  const incomeExpenses = useMemo(
    () => expenses.filter((e) => e.type === INCOME_TYPE),
    [expenses],
  );

  const total = useMemo(
    () => spendExpenses.reduce((s, e) => s + Number(e.amount), 0),
    [spendExpenses],
  );

  const monthTotal = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return spendExpenses
      .filter((e) => e.payment_date.startsWith(ym))
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [spendExpenses]);

  const yearTotal = useMemo(() => {
    const y = new Date().getFullYear().toString();
    return spendExpenses
      .filter((e) => e.payment_date.startsWith(y))
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [spendExpenses]);

  const monthIncome = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return incomeExpenses
      .filter((e) => e.payment_date.startsWith(ym))
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [incomeExpenses]);

  const leftThisMonth = monthIncome - monthTotal;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = filterMin === "" ? null : Number(filterMin);
    const max = filterMax === "" ? null : Number(filterMax);
    return spendExpenses.filter((e) => {
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
  }, [spendExpenses, filterType, filterFrom, filterTo, filterMin, filterMax, search]);

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
    const denom = filtered.reduce((s, e) => s + Number(e.amount), 0);
    return Array.from(groups.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_MERCHANTS)
      .map((g) => ({
        name: g.display,
        total: g.total,
        count: g.count,
        avg: g.count > 0 ? g.total / g.count : 0,
        pct: denom > 0 ? (g.total / denom) * 100 : 0,
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

  const monthFlow = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    const monthSpend = spendExpenses.filter((e) => e.payment_date.startsWith(ym));
    const remaining = monthIncome - monthTotal;
    if (monthSpend.length === 0 && monthIncome === 0) return null;

    const catTotals = new Map<string, number>();
    const catMerchant = new Map<string, Map<string, number>>();
    for (const e of monthSpend) {
      const cat = e.type;
      const merchant = cleanMerchant(e.merchant) ?? "(no merchant)";
      catTotals.set(cat, (catTotals.get(cat) ?? 0) + Number(e.amount));
      let m = catMerchant.get(cat);
      if (!m) {
        m = new Map();
        catMerchant.set(cat, m);
      }
      m.set(merchant, (m.get(merchant) ?? 0) + Number(e.amount));
    }

    type NodeKind = "income" | "category" | "merchant" | "remaining";
    const nodes: { name: string; kind: NodeKind }[] = [];
    const indexOf = new Map<string, number>();
    const addNode = (key: string, name: string, kind: NodeKind) => {
      const existing = indexOf.get(key);
      if (existing !== undefined) return existing;
      indexOf.set(key, nodes.length);
      nodes.push({ name, kind });
      return nodes.length - 1;
    };

    const links: { source: number; target: number; value: number }[] = [];
    const sourceLabel = monthIncome > 0 ? "Income" : "Spending";
    const incomeIdx = addNode("__income", sourceLabel, "income");

    const sortedCats = Array.from(catTotals.entries()).sort((a, b) => b[1] - a[1]);
    for (const [cat, total] of sortedCats) {
      if (total <= 0) continue;
      const catIdx = addNode(`cat:${cat}`, cat, "category");
      links.push({ source: incomeIdx, target: catIdx, value: total });
      const m = catMerchant.get(cat)!;
      const sortedMerchants = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
      for (const [merchant, val] of sortedMerchants) {
        if (val <= 0) continue;
        const mIdx = addNode(`mer:${merchant}`, merchant, "merchant");
        links.push({ source: catIdx, target: mIdx, value: val });
      }
    }

    if (monthIncome > 0 && remaining > 0) {
      const rIdx = addNode("__remaining", "Remaining", "remaining");
      links.push({ source: incomeIdx, target: rIdx, value: remaining });
    }

    if (links.length === 0) return null;
    return { nodes, links };
  }, [spendExpenses, monthIncome, monthTotal]);

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

  const addIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const amt = Number(incomeAmount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setIncomeSaving(true);
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: session.user.id,
        type: INCOME_TYPE,
        amount: amt,
        payment_date: incomeDate,
        merchant: null,
        description: incomeDescription.trim() || null,
      })
      .select()
      .single();
    setIncomeSaving(false);
    if (error) return toast.error(error.message);
    setExpenses((prev) => [data as Expense, ...prev]);
    setIncomeOpen(false);
    setIncomeAmount("");
    setIncomeDescription("");
    toast.success("Income added");
  };

  const restoreExpense = async (exp: Expense) => {
    const userId = session?.user.id;
    if (!userId) return toast.error("Not signed in");
    setExpenses((cur) =>
      [exp, ...cur.filter((e) => e.id !== exp.id)].sort((a, b) =>
        a.payment_date < b.payment_date ? 1 : a.payment_date > b.payment_date ? -1 : 0,
      ),
    );
    const { error } = await supabase.from("expenses").insert({
      id: exp.id,
      user_id: userId,
      type: exp.type,
      amount: exp.amount,
      payment_date: exp.payment_date,
      description: exp.description,
      merchant: exp.merchant,
    });
    if (error) {
      setExpenses((cur) => cur.filter((e) => e.id !== exp.id));
      toast.error("Couldn't restore payment");
    } else {
      toast.success("Payment restored");
    }
  };

  const removeExpense = async (exp: Expense) => {
    const prev = expenses;
    setExpenses(expenses.filter((e) => e.id !== exp.id));
    const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
    if (error) {
      setExpenses(prev);
      toast.error(error.message);
    } else {
      toast.success("Payment deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            void restoreExpense(exp);
          },
        },
      });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    await removeExpense(pendingDelete);
    setDeleting(false);
    setPendingDelete(null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const changePassword = async () => {
    if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords don't match");
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) return toast.error(error.message);
    setNewPassword("");
    setConfirmPassword("");
    setAccountOpen(false);
    toast.success("Password updated");
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-sm text-muted-foreground hidden sm:inline-flex items-center rounded-md px-2 py-1 hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {session.user.email}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="truncate">{session.user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setAccountOpen(true)}>
                  <Settings className="size-4 mr-2" /> Account settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut className="size-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">This month</p>
            <p className="text-3xl font-bold mt-1">${monthTotal.toFixed(2)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Income this month</p>
            <p className="text-3xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
              ${monthIncome.toFixed(2)}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Left this month</p>
            <p
              className={`text-3xl font-bold mt-1 ${
                monthIncome === 0
                  ? ""
                  : leftThisMonth >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
              }`}
            >
              {monthIncome === 0 ? "—" : `$${leftThisMonth.toFixed(2)}`}
            </p>
            {monthIncome > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {Math.min(100, Math.round((monthTotal / monthIncome) * 100))}% of income spent
              </p>
            )}
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">This year</p>
            <p className="text-3xl font-bold mt-1">${yearTotal.toFixed(2)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">All time</p>
            <p className="text-3xl font-bold mt-1">${total.toFixed(2)}</p>
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-sm font-medium">Money flow this month</p>
            <p className="text-xs text-muted-foreground">
              {monthIncome > 0 ? "Income" : "Spending"} → categories → merchants
            </p>
          </div>
          {!monthFlow ? (
            <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">
              No data for this month yet
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(320, monthFlow.nodes.length * 26)}
            >
              <Sankey
                data={monthFlow}
                nodePadding={24}
                nodeWidth={12}
                margin={{ top: 10, right: 140, bottom: 10, left: 80 }}
                link={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.25 }}
                node={(props: SankeyNodeProps) => (
                  <SankeyNode {...props} colorFor={colorFor} />
                )}
              >
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const p: any = payload[0]?.payload?.payload ?? payload[0]?.payload ?? {};
                    const fmt = (v: number) => `$${Number(v ?? 0).toFixed(2)}`;
                    const rootLabel = monthIncome > 0 ? "Income" : "Spending";
                    let title = "";
                    let path: string[] = [];
                    let amount = 0;
                    if (p.source !== undefined && p.target !== undefined) {
                      const srcNode = monthFlow?.nodes[p.source as number];
                      const tgtNode = monthFlow?.nodes[p.target as number];
                      const src = srcNode?.name ?? "";
                      const tgt = tgtNode?.name ?? "";
                      amount = Number(p.value ?? 0);
                      path = src === rootLabel ? [src, tgt] : [rootLabel, src, tgt];
                      title = "Flow";
                    } else if (p.name) {
                      amount = Number(p.value ?? 0);
                      const kind: SankeyNodeKind = p.kind ?? "category";
                      if (kind === "income") path = [p.name];
                      else if (kind === "remaining") path = [rootLabel, "Remaining"];
                      else if (kind === "category") path = [rootLabel, p.name];
                      else {
                        const parentLink = monthFlow?.links.find(
                          (l) => monthFlow.nodes[l.target].name === p.name,
                        );
                        const parentCat = parentLink
                          ? monthFlow?.nodes[parentLink.source].name
                          : undefined;
                        path = parentCat
                          ? [rootLabel, parentCat, p.name]
                          : [rootLabel, p.name];
                      }
                      title =
                        kind === "income"
                          ? "Total"
                          : kind === "merchant"
                            ? "Merchant total"
                            : kind === "remaining"
                              ? "Unspent"
                              : "Category total";
                    }
                    return (
                      <div
                        style={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          color: "var(--popover-foreground)",
                          padding: "8px 10px",
                          fontSize: 12,
                          maxWidth: 280,
                        }}
                      >
                        <div className="text-muted-foreground mb-1">{title}</div>
                        <div className="font-medium leading-snug break-words">
                          {path.join(" → ")}
                        </div>
                        <div className="mt-1 font-semibold">{fmt(amount)}</div>
                      </div>
                    );
                  }}
                />
              </Sankey>
            </ResponsiveContainer>
          )}
          {monthFlow && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block size-3 rounded-sm"
                  style={{ background: "var(--primary)" }}
                />
                <span>{monthIncome > 0 ? "Income" : "Spending"}</span>
              </div>
              {monthFlow.nodes
                .filter((n) => n.kind === "category")
                .map((n) => (
                  <div key={n.name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block size-3 rounded-sm"
                      style={{ background: colorFor(n.name) }}
                    />
                    <span>{n.name}</span>
                  </div>
                ))}
              {monthFlow.nodes.some((n) => n.kind === "remaining") && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-3 rounded-sm"
                    style={{ background: "var(--muted-foreground)" }}
                  />
                  <span>Remaining (income left after spending)</span>
                </div>
              )}
            </div>
          )}
        </Card>

        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Recent payments</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setManageOpen(true)}>
              <Tags className="size-4 mr-1" /> Categories
            </Button>
            <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add income</DialogTitle>
                </DialogHeader>
                <form onSubmit={addIncome} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="income-amount">Amount</Label>
                      <Input
                        id="income-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={incomeAmount}
                        onChange={(e) => setIncomeAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="income-date">Date</Label>
                      <Input
                        id="income-date"
                        type="date"
                        required
                        value={incomeDate}
                        onChange={(e) => setIncomeDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="income-desc">
                      Source <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                      id="income-desc"
                      rows={2}
                      maxLength={500}
                      placeholder="e.g. Salary, freelance"
                      value={incomeDescription}
                      onChange={(e) => setIncomeDescription(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={incomeSaving}>
                      {incomeSaving ? "Saving..." : "Save income"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
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
                <Button variant="ghost" size="icon" onClick={() => setPendingDelete(e)} aria-label="Delete">
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

        <AlertDialog
          open={!!pendingDelete}
          onOpenChange={(o) => !o && !deleting && setPendingDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete && (
                  <>
                    This will permanently remove{" "}
                    <span className="font-medium text-foreground">
                      {pendingDelete.type}
                      {pendingDelete.merchant ? ` · ${pendingDelete.merchant}` : ""} · $
                      {Number(pendingDelete.amount).toFixed(2)}
                    </span>{" "}
                    on {pendingDelete.payment_date}. This action can't be undone.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void confirmDelete();
                }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog
          open={accountOpen}
          onOpenChange={(o) => {
            setAccountOpen(o);
            if (!o) {
              setNewPassword("");
              setConfirmPassword("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Account settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <div className="text-sm font-medium">{session.user.email}</div>
              </div>
              <div className="space-y-3 border-t pt-4">
                <div className="text-sm font-medium">Change password</div>
                <div className="space-y-2">
                  <Label htmlFor="new-pw">New password</Label>
                  <Input
                    id="new-pw"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-pw">Confirm password</Label>
                  <Input
                    id="confirm-pw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAccountOpen(false)} disabled={pwSaving}>
                Cancel
              </Button>
              <Button onClick={() => void changePassword()} disabled={pwSaving || !newPassword}>
                {pwSaving ? "Saving..." : "Update password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Add entry"
            size="icon"
            className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg shadow-primary/30 hover:scale-105 transition-transform"
          >
            <Plus className="size-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-44 mb-2">
          <DropdownMenuItem onSelect={() => setOpen(true)}>
            <Wallet className="size-4 mr-2" /> Add payment
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setIncomeOpen(true)}>
            <TrendingUp className="size-4 mr-2" /> Add income
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type SankeyNodeKind = "income" | "category" | "merchant" | "remaining";

type SankeyNodeProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: { name: string; kind: SankeyNodeKind; value: number };
};

function SankeyNode({
  x,
  y,
  width,
  height,
  payload,
  colorFor,
}: SankeyNodeProps & { colorFor: (name: string) => string }) {
  const isLeft = payload.kind === "income";
  const isRight = payload.kind === "merchant" || payload.kind === "remaining";
  const fill =
    payload.kind === "income"
      ? "var(--primary)"
      : payload.kind === "remaining"
        ? "var(--muted-foreground)"
        : payload.kind === "category"
          ? colorFor(payload.name)
          : "var(--accent-foreground)";
  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.9} />
      <text
        x={isLeft ? x - 8 : isRight ? x + width + 8 : x + width + 8}
        y={y + height / 2}
        textAnchor={isLeft ? "end" : "start"}
        dominantBaseline="middle"
        style={{ fill: "var(--foreground)", fontSize: 12 }}
      >
        {payload.name}
      </text>
      <text
        x={isLeft ? x - 8 : x + width + 8}
        y={y + height / 2 + 14}
        textAnchor={isLeft ? "end" : "start"}
        dominantBaseline="middle"
        style={{ fill: "var(--muted-foreground)", fontSize: 10 }}
      >
        ${payload.value.toFixed(2)}
      </text>
    </Layer>
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
