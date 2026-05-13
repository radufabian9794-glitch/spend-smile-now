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
import { Plus, Wallet, LogOut, Trash2, Pencil } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Spendly — Track your spending" },
      { name: "description", content: "A simple, private spending tracker. Log payments by type, amount, and date." },
    ],
  }),
  component: Dashboard,
});

const TYPES = ["Food", "Transport", "Housing", "Entertainment", "Health", "Shopping", "Bills", "Other"];

type Expense = {
  id: string;
  type: string;
  amount: number;
  payment_date: string;
  description: string | null;
  created_at: string;
};

function Dashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [open, setOpen] = useState(false);

  // form
  const [type, setType] = useState("Food");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

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
        description: description.trim() || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    setExpenses((prev) => [data as Expense, ...prev]);
    setOpen(false);
    setAmount("");
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

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent payments</h2>
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
                      {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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

        <Card className="divide-y">
          {expenses.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              No payments yet. Add your first one to get started.
            </div>
          ) : (
            expenses.map((e) => (
              <div key={e.id} className="p-4 flex items-center gap-4">
                <div className="size-10 rounded-lg bg-accent text-accent-foreground grid place-items-center text-xs font-semibold shrink-0">
                  {e.type.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="font-medium truncate">{e.type}</p>
                    <p className="text-xs text-muted-foreground">{e.payment_date}</p>
                  </div>
                  {e.description && <p className="text-sm text-muted-foreground truncate">{e.description}</p>}
                </div>
                <p className="font-semibold tabular-nums">${Number(e.amount).toFixed(2)}</p>
                <Button variant="ghost" size="icon" onClick={() => removeExpense(e.id)} aria-label="Delete">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </Card>
      </main>
    </div>
  );
}
