import { useEffect, useRef } from "react";
import { useAuth } from "../lib/auth";
import { supportService, type SupportTicket } from "../services/support";

const CHECK_INTERVAL_MS = 2500;
const TITLE_RESET_MS = 9000;

const stamp = (ticket: SupportTicket) =>
  new Date(ticket.last_message_at || ticket.updated_at || ticket.created_at).getTime();

function organizationName(tenantKey?: string) {
  const key = String(tenantKey || "").toLowerCase();
  if (key === "bg" || key === "bgr" || key.includes("baixa")) return "Baixa Grande do Ribeiro";
  if (key === "rg" || key.includes("ribeiro")) return "Ribeiro Gonçalves";
  return "Órgão não identificado";
}

function emitToast(message: string) {
  window.dispatchEvent(
    new CustomEvent("mw-tech-toast", {
      detail: { message, kind: "info" },
    }),
  );
}

function playSupportChime() {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    void ctx.resume().catch(() => undefined);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.025);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.72);
    master.connect(ctx.destination);

    const notes = [659.25, 880];
    notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + index * 0.18;
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.8, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.3);
    });

    window.setTimeout(() => void ctx.close(), 1100);
  } catch {
    // O navegador pode bloquear áudio antes da primeira interação do usuário.
  }
}

export default function SupportNotifier() {
  const { session } = useAuth();
  const initialized = useRef(false);
  const snapshot = useRef(new Map<string, number>());
  const originalTitle = useRef(document.title);
  const titleTimer = useRef<number | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!session) {
      initialized.current = false;
      snapshot.current.clear();
      return;
    }

    let disposed = false;

    const notify = (ticket: SupportTicket, isNewTicket: boolean) => {
      const org = organizationName(ticket.tenant_key);
      const number = String(ticket.ticket_number || "").padStart(4, "0");
      const subject = ticket.subject || "Atendimento de suporte";
      const requester = ticket.requester_name || "Usuário";

      playSupportChime();
      emitToast(
        isNewTicket
          ? `🔔 Novo chamado #${number} — ${org}\n${subject}\nSolicitante: ${requester}`
          : `💬 Nova mensagem no chamado #${number} — ${org}\n${subject}`,
      );

      document.title = `🔔 Novo suporte · ${org}`;
      if (titleTimer.current) window.clearTimeout(titleTimer.current);
      titleTimer.current = window.setTimeout(() => {
        document.title = originalTitle.current;
      }, TITLE_RESET_MS);
    };

    const check = async () => {
      if (busy.current || disposed) return;
      busy.current = true;
      try {
        const data = await supportService.list("todos");
        if (disposed) return;

        const active = data.tickets.filter(
          (ticket) => !["resolvido", "fechado"].includes(ticket.status),
        );

        if (!initialized.current) {
          snapshot.current = new Map(active.map((ticket) => [ticket.id, stamp(ticket)]));
          initialized.current = true;
          return;
        }

        const nextSnapshot = new Map<string, number>();
        const changes: Array<{ ticket: SupportTicket; isNew: boolean }> = [];

        active.forEach((ticket) => {
          const currentStamp = stamp(ticket);
          const previousStamp = snapshot.current.get(ticket.id);
          nextSnapshot.set(ticket.id, currentStamp);

          if (previousStamp === undefined) {
            changes.push({ ticket, isNew: true });
          } else if (currentStamp > previousStamp) {
            changes.push({ ticket, isNew: false });
          }
        });

        snapshot.current = nextSnapshot;

        if (changes.length) {
          changes
            .sort((a, b) => stamp(a.ticket) - stamp(b.ticket))
            .forEach(({ ticket, isNew }) => notify(ticket, isNew));

          window.dispatchEvent(
            new CustomEvent("mw-support-updated", { detail: { tickets: data.tickets } }),
          );
        }
      } catch {
        // Uma falha temporária na notificação não deve interromper o sistema.
      } finally {
        busy.current = false;
      }
    };

    void check();
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      if (titleTimer.current) window.clearTimeout(titleTimer.current);
      document.title = originalTitle.current;
    };
  }, [session]);

  return null;
}
