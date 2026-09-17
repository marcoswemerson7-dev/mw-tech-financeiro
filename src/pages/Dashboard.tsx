import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  Cloud,
  ExternalLink,
  FileChartColumn,
  Headphones,
  Landmark,
  Link2,
  PanelsTopLeft,
  Plus,
  RefreshCw,
  Settings2,
  UsersRound,
} from "lucide-react";
import { getAccounts, getMovements, type Movement } from "../lib/finance";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { useAuth } from "../lib/auth";
import { getDriveStorageUsage, type DriveStorageUsage } from "../services/googleDrive";
import { getManagedSystems, type ManagedSystem } from "../services/managedSystems";
import { getTeamAccess, type TeamAccess } from "../services/teamAccess";

const brl = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
const onlyDate = (value: unknown) => String(value || "").slice(0, 10);
const driveAccountUrl = "https://drive.google.com/drive/u/0/my-drive?authuser=arquivoscplrg%40gmail.com";

export default function Dashboard() {
  const { session } = useAuth();
  const [rows, setRows] = useState<Movement[]>([]);
  const [account, setAccount] = useState(0);
  const [drive, setDrive] = useState<DriveStorageUsage | null>(null);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveError, setDriveError] = useState("");
  const [systemsCount, setSystemsCount] = useState(0);
  const [activeSystemsCount, setActiveSystemsCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);

  useEffect(() => {
    if (!isConfigured) return;
    Promise.all([getMovements(500), getAccounts()]).then(([movements, accounts]) => {
      setRows(movements);
      setAccount(accounts.reduce((sum, item) => sum + Number(item.saldo_atual || 0), 0));
    });
    getManagedSystems().then((systems) => {
      setSystemsCount(systems.length);
      setActiveSystemsCount(systems.filter((item: ManagedSystem) => item.status === "ativo").length);
    }).catch(() => undefined);
    getTeamAccess().then((users) => {
      setUsersCount(users.filter((item: TeamAccess) => item.status === "ativo").length);
    }).catch(() => undefined);
  }, []);

  const loadDrive = (force = false) => {
    if (!isConfigured) {
      setDriveLoading(false);
      return;
    }
    setDriveLoading(true);
    setDriveError("");
    getDriveStorageUsage(force)
      .then(setDrive)
      .catch((e: Error) => setDriveError(e.message))
      .finally(() => setDriveLoading(false));
  };

  useEffect(() => loadDrive(false), []);

  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const today = now.toISOString().slice(0, 10);
  const current = rows.filter((x) => onlyDate(x.data).startsWith(month));
  const receberHoje = current.filter((x) => x.tipo.includes("entrada") && onlyDate(x.data) === today).reduce((sum, x) => sum + Number(x.valor || 0), 0);
  const pagarHoje = current.filter((x) => x.tipo.includes("saida") && onlyDate(x.data) === today).reduce((sum, x) => sum + Number(x.valor || 0), 0);
  const recebimentosHoje = current.filter((x) => x.tipo.includes("entrada") && onlyDate(x.data) === today).length;
  const pagamentosHoje = current.filter((x) => x.tipo.includes("saida") && onlyDate(x.data) === today).length;
  const chart = useMemo(() => buildChart(rows), [rows]);
  const recent = rows.slice(0, 5);
  const displayName = String(session?.name || session?.email?.split("@")[0] || "Administrador").trim();
  const firstName = displayName.split(/\s+/)[0] || "Administrador";
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(now);

  return (
    <div className="mx-auto w-full max-w-[1510px] space-y-5 pb-8">
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-[0_8px_24px_rgba(15,23,42,.045)] sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#b98222]">MW TECH Control</p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-.02em] text-[#0b2239] sm:text-[32px]">Painel executivo</h1>
            <p className="mt-1.5 text-sm text-slate-500">Indicadores essenciais da operação em um só lugar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="flex items-center gap-2 text-[11px] font-medium capitalize text-slate-500"><CalendarDays size={14} />{dateLabel}</p>
              <p className="mt-1 text-[15px] font-medium text-[#0b2239]">Olá, {firstName}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-[11px] font-medium text-emerald-700">Status do ambiente</p>
              <p className="mt-1 flex items-center gap-2 text-[13px] font-medium text-emerald-900"><span className="size-2 rounded-full bg-emerald-500" />Operação normal</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<ArrowUpRight size={21} />} title="A receber hoje" value={brl(receberHoje)} hint={`${recebimentosHoje} lançamento${recebimentosHoje === 1 ? "" : "s"}`} href="/movimentacoes" tone="green" />
        <MetricCard icon={<ArrowDownRight size={21} />} title="A pagar hoje" value={brl(pagarHoje)} hint={`${pagamentosHoje} lançamento${pagamentosHoje === 1 ? "" : "s"}`} href="/despesas" tone="orange" />
        <MetricCard icon={<Landmark size={21} />} title="Saldo em caixa" value={brl(account)} hint="Saldo consolidado" href="/caixa" tone="blue" />
        <MetricCard icon={<UsersRound size={21} />} title="Usuários ativos" value={String(usersCount)} hint="Acessos habilitados" href="/usuarios" tone="slate" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.75fr_.8fr]">
        <DriveCard data={drive} loading={driveLoading} error={driveError} refresh={() => loadDrive(true)} />
        <Panel title="Sistemas e órgãos" icon={<Building2 size={19} />} actionHref="/sistemas">
          <div className="space-y-2.5">
            <InfoRow icon={<Building2 size={17} />} label="Órgãos gerenciados" value={String(systemsCount)} />
            <InfoRow icon={<PanelsTopLeft size={17} />} label="Sistemas ativos" value={String(activeSystemsCount)} />
            <InfoRow icon={<Link2 size={17} />} label="Integrações" value="Ativas" />
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_.95fr_.8fr]">
        <Panel title="Fluxo financeiro" icon={<BarChart3 size={19} />} subtitle="Últimos 6 meses">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart} barGap={5}>
              <CartesianGrid stroke="#eef2f6" vertical={false} />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis axisLine={false} tickLine={false} width={55} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => brl(Number(v))} />
              <Bar dataKey="entradas" name="Entradas" fill="#30b98a" radius={[5, 5, 0, 0]} maxBarSize={24} />
              <Bar dataKey="saidas" name="Saídas" fill="#e9954f" radius={[5, 5, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Últimos lançamentos" icon={<FileChartColumn size={19} />} actionHref="/movimentacoes">
          <div className="divide-y divide-slate-100">
            {recent.length ? recent.map((x) => {
              const entry = x.tipo.includes("entrada");
              return (
                <div key={x.id} className="flex items-center gap-3 py-3">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${entry ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"}`}>{entry ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-[#17324d]">{x.descricao || (entry ? "Recebimento" : "Pagamento")}</p>
                    <span className="text-[11px] text-slate-400">{new Date(x.data).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <span className={`text-[12px] font-semibold ${entry ? "text-emerald-600" : "text-orange-700"}`}>{brl(Number(x.valor))}</span>
                </div>
              );
            }) : <div className="py-12 text-center text-xs text-slate-400">Nenhum lançamento recente.</div>}
          </div>
        </Panel>

        <Panel title="Acesso rápido" icon={<Plus size={19} />}>
          <div className="grid grid-cols-2 gap-2.5">
            <Quick href="/movimentacoes" icon={<Plus size={18} />} label="Lançamento" />
            <Quick href="/contas" icon={<Landmark size={18} />} label="Contas" />
            <Quick href="/relatorios" icon={<FileChartColumn size={18} />} label="Relatórios" />
            <Quick href="/usuarios" icon={<UsersRound size={18} />} label="Usuários" />
            <Quick href="/suporte" icon={<Headphones size={18} />} label="Suporte" />
            <Quick href="/configuracoes" icon={<Settings2 size={18} />} label="Configurações" />
          </div>
        </Panel>
      </section>
    </div>
  );
}

function MetricCard({ icon, title, value, hint, href, tone }: { icon: ReactNode; title: string; value: string; hint: string; href: string; tone: "green" | "orange" | "blue" | "slate" }) {
  const style = { green: "bg-emerald-50 text-emerald-600", orange: "bg-orange-50 text-orange-600", blue: "bg-blue-50 text-blue-600", slate: "bg-slate-100 text-slate-600" }[tone];
  return <a href={href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_7px_20px_rgba(15,23,42,.04)] transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start gap-4"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${style}`}>{icon}</span><div className="min-w-0"><p className="text-[12px] font-medium text-slate-500">{title}</p><p className="mt-1 truncate text-[24px] font-semibold tracking-[-.02em] text-[#0b2239]">{value}</p><p className="mt-1 text-[11px] text-slate-400">{hint}</p></div></div></a>;
}

function Panel({ title, icon, subtitle, actionHref, children }: { title: string; icon: ReactNode; subtitle?: string; actionHref?: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_7px_20px_rgba(15,23,42,.04)]"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-slate-50 text-[#315a82]">{icon}</span><div><h2 className="text-[15px] font-semibold text-[#0b2239]">{title}</h2>{subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}</div></div>{actionHref && <a href={actionHref} className="text-[11px] font-medium text-blue-700">Ver todos</a>}</div>{children}</section>;
}

function DriveCard({ data, loading, error, refresh }: { data: DriveStorageUsage | null; loading: boolean; error: string; refresh: () => void }) {
  const pct = Math.max(0, Math.min(100, data?.percent || 0));
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_7px_20px_rgba(15,23,42,.04)]"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Cloud size={20} /></span><div><h2 className="text-[15px] font-semibold text-[#0b2239]">Google Drive</h2><p className="text-[11px] text-slate-400">Armazenamento corporativo</p></div></div><div className="flex items-center gap-2"><a href={driveAccountUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-600">Abrir no Drive <ExternalLink size={13} /></a><button onClick={refresh} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button></div></div>{error && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">{error}</p>}<div className="grid gap-5 md:grid-cols-[.9fr_1.4fr]"><div className="rounded-xl bg-[#0b2239] p-5 text-white"><p className="text-[11px] font-medium text-slate-300">Uso total</p><div className="mt-2 flex items-end justify-between gap-4"><p className="text-[30px] font-semibold">{pct.toFixed(1)}%</p><p className="text-[11px] text-slate-300">{Number(data?.usedGb || 0).toFixed(2)} GB de {Number(data?.totalGb || 0).toFixed(0)} GB</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-blue-400" style={{ width: `${pct}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-2 text-[11px]"><div className="rounded-lg bg-white/[.06] p-2.5"><span className="text-slate-400">Disponível</span><p className="mt-1 font-medium">{Number(data?.availableGb || 0).toFixed(2)} GB</p></div><div className="rounded-lg bg-white/[.06] p-2.5"><span className="text-slate-400">Plano</span><p className="mt-1 font-medium">{Number(data?.totalGb || 0).toFixed(0)} GB</p></div></div></div><div><div className="mb-2 flex items-center justify-between"><p className="text-[12px] font-medium text-slate-500">Pastas monitoradas</p><span className="text-[11px] text-slate-400">{data?.folders?.length || 0}</span></div><div className="space-y-2">{data?.folders?.length ? data.folders.slice(0, 4).map((folder) => <div key={folder.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3"><div className="min-w-0"><p className="truncate text-[12px] font-medium text-[#17324d]">{folder.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{folder.files.toLocaleString("pt-BR")} arquivos · {folder.folders.toLocaleString("pt-BR")} pastas</p></div><span className="ml-3 text-[12px] font-semibold text-[#0b2239]">{folder.usedGb.toFixed(2)} GB</span></div>) : <div className="rounded-xl border border-dashed border-slate-200 px-4 py-7 text-center text-xs text-slate-400">{loading ? "Atualizando armazenamento..." : "Nenhuma pasta monitorada."}</div>}</div></div></div></section>;
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3"><span className="grid size-8 place-items-center rounded-lg bg-white text-blue-700">{icon}</span><span className="flex-1 text-[12px] text-slate-500">{label}</span><span className="text-[12px] font-semibold text-[#0b2239]">{value}</span></div>;
}

function Quick({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return <a href={href} className="flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2 text-center text-[11px] font-medium text-[#315a82] transition hover:border-blue-200 hover:bg-blue-50">{icon}<span>{label}</span></a>;
}

function buildChart(rows: Movement[]) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = rows.filter((x) => onlyDate(x.data).startsWith(key));
    return { mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), entradas: list.filter((x) => x.tipo.includes("entrada")).reduce((sum, x) => sum + Number(x.valor || 0), 0), saidas: list.filter((x) => x.tipo.includes("saida")).reduce((sum, x) => sum + Number(x.valor || 0), 0) };
  });
}
