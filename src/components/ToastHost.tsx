import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; message: string; kind: ToastKind; title?: string; actionHref?: string; actionLabel?: string; support?: boolean };

const EVENT_NAME = "mw-tech-toast";

function classify(message: string): ToastKind {
  const text = message.toLowerCase();
  if (
    text.includes("erro") ||
    text.includes("não foi possível") ||
    text.includes("inválid") ||
    text.includes("não encontrado") ||
    text.includes("não permite") ||
    text.includes("bloque")
  ) return "error";
  if (
    text.includes("sucesso") ||
    text.includes("excluíd") ||
    text.includes("salv") ||
    text.includes("cadastrad") ||
    text.includes("gerad") ||
    text.includes("conclu") ||
    text.includes("pagamento confirmado")
  ) return "success";
  return "info";
}

export function installToastAlerts() {
  window.alert = (message?: unknown) => {
    const text = String(message ?? "").trim();
    if (!text) return;
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { message: text, kind: classify(text) } }));
  };
}

export default function ToastHost() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ message: string; kind?: ToastKind; title?: string; actionHref?: string; actionLabel?: string; support?: boolean }>;
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const item: ToastItem = {
        id,
        message: custom.detail.message,
        kind: custom.detail.kind || classify(custom.detail.message),
        title: custom.detail.title,
        actionHref: custom.detail.actionHref,
        actionLabel: custom.detail.actionLabel,
        support: custom.detail.support,
      };
      setItems((current) => [...current.slice(-3), item]);
      window.setTimeout(() => setItems((current) => current.filter((x) => x.id !== id)), custom.detail.support ? 9000 : 4200);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const remove = (id: number) => setItems((current) => current.filter((x) => x.id !== id));

  const openItem = (item: ToastItem) => {
    if (!item.actionHref) return;
    remove(item.id);
    navigate(item.actionHref);
  };

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[9999] flex w-[min(470px,calc(100vw-2rem))] flex-col gap-3">
      {items.map((item) => {
        const success = item.kind === "success";
        const error = item.kind === "error";
        const Icon = success ? CheckCircle2 : error ? AlertCircle : Info;
        const shell = success
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : error
            ? "border-rose-200 bg-rose-50 text-rose-950"
            : "border-blue-200 bg-blue-50 text-blue-950";
        const icon = success ? "text-emerald-600" : error ? "text-rose-600" : "text-blue-600";
        const title = item.title || (success ? "Sucesso" : error ? "Atenção" : "Informação");

        return (
          <div
            key={item.id}
            role={item.actionHref ? "button" : undefined}
            tabIndex={item.actionHref ? 0 : undefined}
            onClick={() => openItem(item)}
            onKeyDown={(event) => {
              if (item.actionHref && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                openItem(item);
              }
            }}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border ${item.support ? "p-5 shadow-2xl ring-1 ring-blue-100" : "p-4 shadow-xl"} backdrop-blur ${shell} ${item.actionHref ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-2xl" : ""}`}
          >
            <Icon size={22} className={`mt-0.5 shrink-0 ${icon}`} />
            <div className="min-w-0 flex-1">
              <p className={`${item.support ? "text-base" : "text-sm"} font-extrabold`}>{title}</p>
              <p className={`mt-1 whitespace-pre-line ${item.support ? "text-[15px] leading-6" : "text-sm leading-5"} opacity-90`}>{item.message}</p>
              {item.actionHref && (
                <p className="mt-3 text-xs font-extrabold underline underline-offset-2">
                  {item.actionLabel || "Abrir"}
                </p>
              )}
            </div>
            <button type="button" onClick={(event) => { event.stopPropagation(); remove(item.id); }} className="rounded-md p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100" aria-label="Fechar notificação">
              <X size={17} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
