import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Cloud,
  ExternalLink,
  FileChartColumn,
  Folder,
  Headphones,
  Landmark,
  Link2,
  MoreHorizontal,
  PanelsTopLeft,
  Plus,
  RefreshCw,
  Sun,
  UsersRound,
  Zap,
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
  const recent = rows.slice(0, 4);
  const displayName = String(session?.name || session?.email?.split("@")[0] || "Administrador").trim();
  const firstName = displayName.split(/\s+/)[0] || "Administrador";
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(now);

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-4 pb-4">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-[0_8px_26px_rgba(15,23,42,.045)] sm:px-7">
        <div className="pointer-events-none absolute inset-y-0 left-[47%] hidden w-[28%] overflow-hidden lg:block">
          <div className="absolute inset-0 bg-gradient-to-r from-white via-amber-50/70 to-white" />
          <div className="absolute bottom-2 left-8 h-20 w-8 rounded-t-md bg-slate-200/60" />
          <div className="absolute bottom-2 left-20 h-28 w-10 rounded-t-md bg-amber-200/45" />
          <div className="absolute bottom-2 left-36 h-24 w-9 rounded-t-md bg-blue-200/55" />
          <div className="absolute bottom-2 left-52 h-16 w-7 rounded-t-md bg-slate-300/50" />
          <div className="absolute bottom-0 left-5 right-4 h-8 bg-gradient-to-t from-emerald-100/70 to-transparent" />
        </div>

        <div className="relative grid gap-4 xl:grid-cols-[1.42fr_.62fr_.56fr] xl:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#b98222]">MW TECH Control</p>
            <h1 className="mt-1 text-[30px] font-semibold tracking-[-.025em] text-[#0b2239] sm:text-[36px]">Painel executivo</h1>
            <p className="mt-1 text-[13px] text-slate-500">Indicadores essenciais da operação, reunidos em um só lugar.</p>
          </div>

          <div className="rounded-xl border border-amber-100/90 bg-gradient-to-br from-amber-50 to-white px-4 py-3 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-amber-500 shadow-sm"><Sun size={22} /></span>
              <div>
                <p className="text-[14px] font-semibold text-[#0b2239]">Bom dia, {firstName}!</p>
                <p className="mt-1 text-[10px] capitalize leading-4 text-slate-500">Hoje é {dateLabel}.</p>
                <p className="text-[10px] text-slate-400">Vamos em frente!</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white px-4 py-3 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="mt-1 size-3 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
              <div>
                <p className="text-[10px] font-medium text-slate-500">Status do ambiente</p>
                <p className="mt-0.5 text-[15px] font-semibold text-[#0b2239]">Operação normal</p>
                <p className="mt-1 text-[10px] text-slate-400">Todos os sistemas funcionando.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<ArrowUpRight size={22} />} title="A receber hoje" value={brl(receberHoje)} hint={`${recebimentosHoje} lançamento${recebimentosHoje === 1 ? "" : "s"}`} href="/movimentacoes" tone="green" />
        <MetricCard icon={<ArrowDownRight size={22} />} title="A pagar hoje" value={brl(pagarHoje)} hint={`${pagamentosHoje} lançamento${pagamentosHoje === 1 ? "" : "s"}`} href="/despesas" tone="orange" />
        <MetricCard icon={<Landmark size={22} />} title="Saldo em caixa" value={brl(account)} hint="Saldo consolidado" href="/caixa" tone="blue" />
        <MetricCard icon={<UsersRound size={22} />} title="Usuários ativos" value={String(usersCount)} hint="Acessos habilitados" href="/usuarios" tone="purple" />
      </section>

      <section className="grid gap-3 xl:grid-cols-[2.1fr_.82fr]">
        <DriveCard data={drive} loading={driveLoading} error={driveError} refresh={() => loadDrive(true)} />
        <Panel title="Sistemas e órgãos" icon={<Building2 size={18} />} actionHref="/sistemas">
          <div className="space-y-2.5">
            <InfoRow icon={<Building2 size={16} />} label="Órgãos gerenciados" subtitle="Prefeituras e entidades" value={String(systemsCount)} />
            <InfoRow icon={<PanelsTopLeft size={16} />} label="Sistemas ativos" subtitle="Em funcionamento" value={String(activeSystemsCount)} />
            <InfoRow icon={<Link2 size={16} />} label="Integrações" subtitle="Conectadas e operacionais" value="Ativas" success />
          </div>
        </Panel>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.18fr_.94fr_.88fr]">
        <Panel title="Fluxo financeiro" icon={<BarChart3 size={18} />} subtitle="Entradas e saídas dos últimos 6 meses" rightLabel="Últimos 6 meses">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chart} barGap={5}>
              <CartesianGrid stroke="#e9eef5" vertical />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis axisLine={false} tickLine={false} width={55} tick={{ fontSize: 9, fill: "#94a3b8" }} tickFormatter={(v) => `R$ ${Math.round(v / 1000)} mil`} />
              <Tooltip formatter={(v) => brl(Number(v))} />
              <Bar dataKey="entradas" name="Entradas" fill="#39ad86" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="saidas" name="Saídas" fill="#dca93b" radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-1 flex justify-center gap-5 text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-emerald-500" />Entradas</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-amber-400" />Saídas</span>
          </div>
        </Panel>

        <Panel title="Últimos lançamentos" icon={<FileChartColumn size={18} />} actionHref="/movimentacoes">
          <div className="divide-y divide-slate-100">
            {recent.length ? recent.map((x) => {
              const entry = x.tipo.includes("entrada");
              return (
                <div key={x.id} className="flex items-center gap-3 py-2.5">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${entry ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{entry ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-[#17324d]">{x.descricao || (entry ? "Recebimento" : "Pagamento")}</p>
                    <span className="text-[10px] text-slate-400">{new Date(x.data).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <span className={`text-[11px] font-semibold ${entry ? "text-emerald-600" : "text-rose-600"}`}>{brl(Number(x.valor))}</span>
                  <MoreHorizontal size={14} className="text-slate-400" />
                </div>
              );
            }) : <div className="py-12 text-center text-xs text-slate-400">Nenhum lançamento recente.</div>}
          </div>
        </Panel>

        <Panel title="Acesso rápido" icon={<Zap size={18} />}>
          <div className="grid grid-cols-3 gap-2.5">
            <Quick href="/movimentacoes" icon={<Plus size={19} />} label="Novo lançamento" />
            <Quick href="/despesas" icon={<FileChartColumn size={19} />} label="Contas a pagar" />
            <Quick href="/relatorios" icon={<BarChart3 size={19} />} label="Relatórios" />
            <Quick href="/usuarios" icon={<UsersRound size={19} />} label="Gerenciar usuários" />
            <Quick href={driveAccountUrl} icon={<Cloud size={19} />} label="Abrir Drive" external />
            <Quick href="/suporte" icon={<Headphones size={19} />} label="Suporte" />
          </div>
        </Panel>
      </section>

      <footer className="flex flex-col gap-2 px-2 pt-1 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span>MW TECH Control &nbsp;•&nbsp; Sistemas e Soluções Digitais &nbsp;•&nbsp; Gestão mais simples. Resultados maiores.</span>
        <span className="flex items-center gap-3"><span>Privacidade</span><span>Termos de uso</span><span>Suporte</span><span className="flex items-center gap-1.5 text-emerald-600"><i className="size-2 rounded-full bg-emerald-500" />Todos os sistemas operacionais</span></span>
      </footer>
    </div>
  );
}

function MetricCard({ icon, title, value, hint, href, tone }: { icon: ReactNode; title: string; value: string; hint: string; href: string; tone: "green" | "orange" | "blue" | "purple" }) {
  const style = {
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-violet-50 text-violet-600",
  }[tone];
  return (
    <a href={href} className="group relative rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_7px_20px_rgba(15,23,42,.04)] transition hover:-translate-y-0.5 hover:shadow-md">
      <MoreHorizontal size={15} className="absolute right-4 top-4 text-slate-400" />
      <div className="flex items-start gap-4 pr-5">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${style}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-[#18324d]">{title}</p>
          <p className="mt-1 truncate text-[23px] font-semibold tracking-[-.025em] text-[#0b2239]">{value}</p>
          <p className="mt-1 text-[10px] text-slate-400">{hint}</p>
          <p className="mt-3 text-right text-[10px] font-medium text-blue-600">Ver detalhes →</p>
        </div>
      </div>
    </a>
  );
}

function Panel({ title, icon, subtitle, actionHref, rightLabel, children }: { title: string; icon: ReactNode; subtitle?: string; actionHref?: string; rightLabel?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_7px_20px_rgba(15,23,42,.04)]">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-slate-50 text-[#1f4f7b]">{icon}</span>
          <div>
            <h2 className="text-[14px] font-semibold text-[#0b2239]">{title}</h2>
            {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {actionHref ? <a href={actionHref} className="text-[10px] font-medium text-blue-600">Ver todos →</a> : rightLabel ? <span className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] text-slate-500">{rightLabel}</span> : null}
      </div>
      {children}
    </section>
  );
}

function DriveCard({ data, loading, error, refresh }: { data: DriveStorageUsage | null; loading: boolean; error: string; refresh: () => void }) {
  const pct = Math.max(0, Math.min(100, data?.percent || 0));
  const folders = data?.folders || [];
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_7px_20px_rgba(15,23,42,.04)]">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative grid size-10 place-items-center overflow-hidden rounded-lg bg-white shadow-sm">
            <span className="absolute left-[8px] top-[4px] size-0 border-x-[9px] border-b-[17px] border-x-transparent border-b-[#1fa463]" />
            <span className="absolute bottom-[5px] left-[4px] h-[11px] w-[20px] skew-x-[-28deg] bg-[#1a73e8]" />
            <span className="absolute bottom-[5px] right-[4px] h-[11px] w-[20px] skew-x-[28deg] bg-[#fbbc04]" />
          </span>
          <div><h2 className="text-[15px] font-semibold text-[#0b2239]">Google Drive</h2><p className="text-[10px] text-slate-400">Armazenamento corporativo da MW TECH</p></div>
        </div>
        <div className="flex items-center gap-2">
          <a href={driveAccountUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-medium text-slate-600">Abrir no Drive <ExternalLink size={12} /></a>
          <button onClick={refresh} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /></button>
          <button type="button" className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-400"><MoreHorizontal size={14} /></button>
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[.92fr_1.4fr]">
        <div className="rounded-xl bg-gradient-to-br from-[#0a2947] to-[#08233d] p-4 text-white">
          <p className="text-[10px] font-medium text-slate-300">Uso do armazenamento</p>
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <p className="text-[30px] font-semibold tracking-[-.03em]">{pct.toFixed(1)}%</p>
            <p className="pb-1 text-[10px] text-slate-300">{Number(data?.usedGb || 0).toFixed(2)} GB de {Number(data?.totalGb || 0).toFixed(0)} GB</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-blue-400" style={{ width: `${pct}%` }} /></div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/[.07] px-3 py-2.5"><p className="text-[10px] text-slate-300">Disponível</p><p className="mt-1 text-[13px] font-semibold">{Number(data?.availableGb || 0).toFixed(2)} GB</p></div>
            <div className="rounded-lg bg-white/[.07] px-3 py-2.5"><p className="text-[10px] text-slate-300">Plano</p><p className="mt-1 text-[13px] font-semibold">{Number(data?.totalGb || 0).toFixed(0)} GB</p></div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium text-[#18324d]">Pastas monitoradas</p><span className="text-[10px] text-slate-400">{folders.length} pasta{folders.length === 1 ? "" : "s"}</span></div>
          <div className="space-y-2">
            {folders.length ? folders.slice(0, 3).map((folder) => (
              <div key={folder.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><Folder size={16} /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-medium text-[#17324d]">{folder.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{folder.files} arquivos • {folder.folders} pastas</p></div>
                <span className="text-[11px] font-semibold text-[#17324d]">{folder.usedGb.toFixed(2)} GB</span>
                <MoreHorizontal size={14} className="text-slate-400" />
              </div>
            )) : <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-[11px] text-slate-400">Nenhuma pasta monitorada.</div>}
          </div>
          <a href="/armazenamento" className="mt-2.5 flex min-h-[34px] items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 text-[10px] font-medium text-blue-600 hover:bg-blue-50/40"><Plus size={14} />Ver armazenamento completo</a>
        </div>
      </div>
    </section>
  );
}

function InfoRow({ icon, label, subtitle, value, success = false }: { icon: ReactNode; label: string; subtitle: string; value: string; success?: boolean }) {
  return <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-blue-600 shadow-sm">{icon}</span><div className="min-w-0 flex-1"><p className="text-[11px] font-medium text-[#17324d]">{label}</p><p className="text-[10px] text-slate-400">{subtitle}</p></div><span className={`text-[12px] font-semibold ${success ? "text-emerald-600" : "text-[#17324d]"}`}>{value}</span></div>;
}

function Quick({ href, icon, label, external = false }: { href: string; icon: ReactNode; label: string; external?: boolean }) {
  return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 px-2 text-center text-[10px] font-medium text-[#17324d] transition hover:-translate-y-0.5 hover:bg-blue-50 hover:text-blue-700">{icon}<span>{label}</span></a>;
}

function buildChart(rows: Movement[]) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = rows.filter((x) => onlyDate(x.data).startsWith(key));
    return {
      mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      entradas: list.filter((x) => x.tipo.includes("entrada")).reduce((sum, x) => sum + Number(x.valor || 0), 0),
      saidas: list.filter((x) => x.tipo.includes("saida")).reduce((sum, x) => sum + Number(x.valor || 0), 0),
    };
  });
}
