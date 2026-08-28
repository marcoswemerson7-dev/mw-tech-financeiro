import type { ComponentType, ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CircleSlash,
  Search,
} from "lucide-react";

export const money = (v: unknown) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export type FinancialKind =
  | "entrada"
  | "receita"
  | "saida"
  | "despesa"
  | "retirada"
  | "estorno"
  | "transferencia"
  | "saldo";

export function getFinancialTone(kind?: string, value?: unknown) {
  const normalized = String(kind || "").toLowerCase();
  const numeric = Number(value || 0);
  if (normalized.includes("entrada") || normalized.includes("receita")) return "text-emerald-700";
  if (normalized.includes("saida") || normalized.includes("despesa") || normalized.includes("retirada")) return "text-rose-700";
  if (normalized.includes("estorno")) return "text-amber-700";
  if (normalized.includes("transfer")) return "text-blue-700";
  if (normalized.includes("saldo") || normalized.includes("resultado")) {
    return numeric < 0 ? "text-rose-700" : "text-emerald-700";
  }
  return numeric < 0 ? "text-rose-700" : "text-[#061426]";
}

export function formatFinancialValue(value: unknown, kind?: string) {
  const normalized = String(kind || "").toLowerCase();
  const numeric = Math.abs(Number(value || 0));
  const shouldInvert =
    normalized.includes("saida") ||
    normalized.includes("despesa") ||
    normalized.includes("retirada") ||
    Number(value || 0) < 0;
  return `${shouldInvert ? "- " : ""}${money(numeric)}`;
}

export function FinancialAmount({
  value,
  kind,
  className = "",
}: {
  value: unknown;
  kind?: string;
  className?: string;
}) {
  return (
    <span className={`${getFinancialTone(kind, value)} ${className}`}>
      {formatFinancialValue(value, kind)}
    </span>
  );
}

export function Toast({
  message,
  tone = "success",
}: {
  message: string;
  tone?: "success" | "error";
}) {
  if (!message) return null;
  return (
    <div className="fixed right-5 top-5 z-[80] rounded-2xl border border-white/20 bg-[#061426] px-5 py-4 text-sm font-bold text-white shadow-[0_18px_45px_rgba(6,20,38,.28)]">
      <span className={tone === "success" ? "text-emerald-300" : "text-rose-300"}>
        {message}
      </span>
    </div>
  );
}

export const dateOnly = (value?: string | null) => {
  if (!value) return "";
  return value.slice(0, 10);
};

export const formatDate = (value?: string | null) => {
  const date = dateOnly(value);
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "--";
};

export const formatMonth = (value?: string | null) => {
  const date = dateOnly(value);
  return date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      })
    : "--";
};

export function Card({
  title,
  value,
  icon,
  tone = "blue",
  hint,
}: {
  title: string;
  value: string;
  icon?: ReactNode;
  tone?: "blue" | "green" | "red" | "indigo";
  hint?: string;
}) {
  const c = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
    indigo: "bg-indigo-50 text-indigo-700",
  }[tone];

  return (
    <div className="group min-h-[154px] rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_10px_32px_rgba(15,35,70,.055)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_40px_rgba(15,35,70,.09)] sm:p-7">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-slate-600">{title}</p>
          <strong className="mt-3 block break-words text-[29px] font-bold leading-tight tracking-[-0.025em] text-[#0b1736] sm:text-[32px]">
            {value}
          </strong>
          {hint ? (
            <p className="mt-3 text-[13px] leading-5 text-slate-500">{hint}</p>
          ) : null}
        </div>
        {icon ? (
          <span className={`grid size-13 shrink-0 place-items-center rounded-2xl ${c}`}>
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  const s =
    status === "pago" || status === "paga" || status === "ativo"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
      : status === "atrasado" || status === "vencido" || status === "suspenso" || status === "cancelado"
        ? "bg-rose-50 text-rose-700 ring-rose-600/10"
        : status === "recorrente"
          ? "bg-blue-50 text-blue-700 ring-blue-600/10"
        : "bg-amber-50 text-amber-700 ring-amber-600/10";

  return (
    <span className={`inline-flex items-center rounded-full px-3.5 py-2 text-[13px] font-black capitalize ring-1 ring-inset ${s}`}>
      {status}
    </span>
  );
}

export const Empty = () => (
  <div className="mx-auto my-8 flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
    <span className="grid size-12 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm">
      <Search size={20} />
    </span>
    <strong className="mt-4 text-[15px] text-[#0b1f3a]">Nenhum registro encontrado</strong>
    <p className="mt-1 text-[13px] text-slate-500">
      Ajuste os filtros ou cadastre novos dados para preencher esta área.
    </p>
  </div>
);

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[32px] font-black leading-tight tracking-[-0.02em] text-[#061426] sm:text-[38px]">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-slate-500 sm:text-base">
          {subtitle}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </section>
  );
}

type Tone = "gold" | "green" | "red" | "blue" | "purple" | "orange";

const toneClasses: Record<Tone, { icon: string; border: string; value: string }> = {
  gold: {
    icon: "bg-amber-50 text-[#d09116]",
    border: "border-t-[#e8ac35]",
    value: "text-[#061426]",
  },
  green: {
    icon: "bg-emerald-50 text-emerald-600",
    border: "border-t-emerald-500",
    value: "text-emerald-700",
  },
  red: {
    icon: "bg-rose-50 text-rose-600",
    border: "border-t-rose-500",
    value: "text-rose-700",
  },
  blue: {
    icon: "bg-blue-50 text-blue-600",
    border: "border-t-blue-600",
    value: "text-[#061426]",
  },
  purple: {
    icon: "bg-purple-50 text-purple-600",
    border: "border-t-purple-500",
    value: "text-[#061426]",
  },
  orange: {
    icon: "bg-orange-50 text-orange-600",
    border: "border-t-orange-500",
    value: "text-orange-700",
  },
};

export function StatCard({
  title,
  value,
  hint,
  icon,
  tone = "blue",
  featured = false,
}: {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  featured?: boolean;
}) {
  const c = toneClasses[tone];
  if (featured) {
    return (
      <div className="relative min-h-[160px] overflow-hidden rounded-2xl border border-[#183a62] bg-[#061426] p-6 text-white shadow-[0_18px_45px_rgba(6,20,38,.22)] sm:p-7">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-70">
          <div className="absolute right-[-40px] top-10 h-24 w-64 rounded-[50%] border border-[#e8ac35]/50" />
          <div className="absolute right-[-20px] top-16 h-20 w-56 rounded-[50%] border border-blue-500/35" />
        </div>
        <div className="relative flex items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-blue-100">{title}</p>
            <strong className="mt-3 block break-words text-[34px] font-black leading-tight tracking-[-0.02em] text-[#f5c75b]">
              {value}
            </strong>
            {hint ? <p className="mt-3 text-[13px] text-blue-100">{hint}</p> : null}
          </div>
          {icon ? (
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-[#e8ac35]/30 bg-white/10 text-[#f5c75b]">
              {icon}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-[154px] rounded-2xl border border-slate-200/90 border-t-[3px] ${c.border} bg-white p-6 shadow-[0_14px_36px_rgba(15,35,70,.06)] sm:p-7`}>
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-slate-600">{title}</p>
          <strong className={`mt-3 block break-words text-[30px] font-black leading-tight tracking-[-0.02em] sm:text-[34px] ${c.value}`}>
            {value}
          </strong>
          {hint ? <p className="mt-3 text-[13px] leading-5 text-slate-500">{hint}</p> : null}
        </div>
        {icon ? (
          <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${c.icon}`}>
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_14px_36px_rgba(15,35,70,.055)] sm:p-7 ${className}`}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          {Icon ? <Icon size={30} className="mt-0.5 shrink-0 text-[#061426]" /> : null}
          <div className="min-w-0">
            <h3 className="text-[21px] font-black leading-tight text-[#061426]">{title}</h3>
            {subtitle ? <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FilterBar({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className={`no-print flex flex-wrap items-center gap-3 rounded-2xl border p-5 shadow-[0_12px_30px_rgba(15,35,70,.055)] ${
      dark ? "border-[#1c446d] bg-[#061426] text-white" : "border-slate-200 bg-white"
    }`}>
      {children}
    </div>
  );
}

export function ActionButton({
  children,
  tone = "navy",
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  tone?: "navy" | "outline" | "danger" | "success";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const cls = {
    navy: "border-[#061426] bg-[#061426] text-white shadow-[0_10px_22px_rgba(6,20,38,.18)] hover:bg-[#082b50]",
    outline: "border-slate-200 bg-white text-[#061426] hover:border-[#e8ac35] hover:text-[#061426]",
    danger: "border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100",
    success: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
  }[tone];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-5 text-[14px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

export function IconAction({
  title,
  children,
  onClick,
  tone = "blue",
}: {
  title: string;
  children: ReactNode;
  onClick?: () => void;
  tone?: "blue" | "red" | "green" | "amber" | "slate";
}) {
  const cls = {
    blue: "border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100",
    red: "border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    amber: "border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100",
    slate: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`grid size-11 place-items-center rounded-xl border transition ${cls}`}
    >
      {children}
    </button>
  );
}

export function statusIcon(status: string) {
  if (status === "pago" || status === "paga" || status === "ativo") return CheckCircle2;
  if (status === "cancelado" || status === "vencido" || status === "atrasado") return AlertCircle;
  if (status === "inativo") return CircleSlash;
  return Clock3;
}
