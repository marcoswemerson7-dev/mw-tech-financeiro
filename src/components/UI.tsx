import type { ReactNode } from "react";

export const money = (v: unknown) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

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
    status === "pago" || status === "ativo"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
      : status === "atrasado" || status === "suspenso"
        ? "bg-rose-50 text-rose-700 ring-rose-600/10"
        : "bg-amber-50 text-amber-700 ring-amber-600/10";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-bold capitalize ring-1 ring-inset ${s}`}>
      {status}
    </span>
  );
}

export const Empty = () => (
  <div className="py-20 text-center text-[15px] text-slate-400">
    Nenhum registro encontrado.
  </div>
);
