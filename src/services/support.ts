import { account } from "../lib/appwrite";

type SupportSource = "rg" | "bg";

const SOURCES: Record<SupportSource, { endpoint: string; archiveEndpoint: string }> = {
  rg: {
    endpoint: "https://kiviwxonxeqmzqlmshpc.supabase.co/functions/v1/mw-support-admin",
    archiveEndpoint: "https://kiviwxonxeqmzqlmshpc.supabase.co/functions/v1/archive-support-to-drive",
  },
  bg: {
    endpoint: "https://jfzavijlkbqzkrnlgphz.supabase.co/functions/v1/mw-support-admin",
    archiveEndpoint: "https://jfzavijlkbqzkrnlgphz.supabase.co/functions/v1/archive-support-to-drive",
  },
};

const ticketSources = new Map<string, SupportSource>();

async function requestFrom(source: SupportSource, path = "", init: RequestInit = {}) {
  const jwt = await account.createJWT();
  const res = await fetch(`${SOURCES[source].endpoint}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-appwrite-jwt": jwt.jwt,
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Falha ao acessar a Central de Suporte (${source.toUpperCase()})`);
  return data;
}

function resolveSource(ticketId: string): SupportSource {
  return ticketSources.get(ticketId) || "rg";
}

export type SupportSenderIdentity = {
  name?: string | null;
  role?: string | null;
  avatarUrl?: string | null;
};

function signalStaffSend(ticketId: string) {
  window.dispatchEvent(new CustomEvent("mw-support-staff-sent", { detail: { ticketId, at: Date.now() } }));
}

async function archiveRequest(ticketId: string) {
  const source = resolveSource(ticketId);
  const jwt = await account.createJWT();
  const res = await fetch(SOURCES[source].archiveEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-appwrite-jwt": jwt.jwt,
    },
    body: JSON.stringify({ ticket_id: ticketId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Falha ao arquivar atendimento no Google Drive");
  return data;
}

export type SupportTicket = {
  id: string;
  ticket_number: number;
  tenant_key: string;
  requester_name?: string | null;
  requester_email?: string | null;
  requester_sector?: string | null;
  requester_role?: string | null;
  requester_avatar_url?: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  source_path?: string | null;
  last_message_at: string;
  last_message_is_staff?: boolean | null;
  last_message_body?: string | null;
  last_message_sender_id?: string | null;
  last_message_created_at?: string | null;
  created_at: string;
  updated_at: string;
  archive_status?: "active" | "archiving" | "archived" | "error";
  archive_drive_file_id?: string | null;
  archive_drive_json_file_id?: string | null;
  archive_drive_folder_id?: string | null;
  archive_drive_url?: string | null;
  archived_at?: string | null;
  archived_message_count?: number;
  archive_error?: string | null;
};

export type SupportAttachment = {
  path: string;
  name: string;
  mime_type?: string | null;
  size?: number | null;
  url?: string | null;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  is_staff: boolean;
  created_at: string;
  sender_name?: string | null;
  sender_role?: string | null;
  sender_avatar_url?: string | null;
  attachments?: SupportAttachment[];
};

export const supportService = {
  async list(status = "todos") {
    const settled = await Promise.allSettled(
      (Object.keys(SOURCES) as SupportSource[]).map(async (source) => {
        const data = await requestFrom(source, `?status=${encodeURIComponent(status)}`) as { tickets: SupportTicket[] };
        (data.tickets || []).forEach((ticket) => ticketSources.set(ticket.id, source));
        return data.tickets || [];
      }),
    );

    const successes = settled
      .filter((result): result is PromiseFulfilledResult<SupportTicket[]> => result.status === "fulfilled")
      .flatMap((result) => result.value);

    if (!successes.length && settled.some((result) => result.status === "rejected")) {
      const firstFailure = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
      throw firstFailure?.reason instanceof Error ? firstFailure.reason : new Error("Falha ao acessar a Central de Suporte");
    }

    return {
      tickets: successes.sort(
        (a, b) =>
          new Date(b.last_message_at || b.updated_at || b.created_at).getTime() -
          new Date(a.last_message_at || a.updated_at || a.created_at).getTime(),
      ),
    };
  },

  async detail(ticketId: string) {
    const source = resolveSource(ticketId);
    const data = await requestFrom(source, `?ticket_id=${encodeURIComponent(ticketId)}`) as { ticket: SupportTicket; messages: SupportMessage[] };
    ticketSources.set(data.ticket.id, source);
    return data;
  },

  async sendMessage(ticketId: string, body: string, files: File[] = [], sender: SupportSenderIdentity = {}) {
    const source = resolveSource(ticketId);

    if (!files.length) {
      signalStaffSend(ticketId);
      const result = await requestFrom(source, "", {
        method: "POST",
        body: JSON.stringify({
          action: "send_message",
          ticket_id: ticketId,
          body,
          sender_name: sender.name || "MW TECH",
          sender_role: sender.role || "Administrador",
          sender_avatar_url: sender.avatarUrl || "",
        }),
      });
      signalStaffSend(ticketId);
      return result;
    }

    const jwt = await account.createJWT();
    const form = new FormData();
    form.append("action", "send_message");
    form.append("ticket_id", ticketId);
    form.append("body", body);
    form.append("sender_name", sender.name || "MW TECH");
    form.append("sender_role", sender.role || "Administrador");
    form.append("sender_avatar_url", sender.avatarUrl || "");
    files.forEach((file) => form.append("files", file, file.name));

    signalStaffSend(ticketId);
    const res = await fetch(SOURCES[source].endpoint, {
      method: "POST",
      headers: { "x-appwrite-jwt": jwt.jwt },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Falha ao enviar mensagem/anexo");
    signalStaffSend(ticketId);
    return data;
  },

  async openTicket(ticketId: string, sender: SupportSenderIdentity = {}) {
    const source = resolveSource(ticketId);
    return requestFrom(source, "", {
      method: "POST",
      body: JSON.stringify({
        action: "open_ticket",
        ticket_id: ticketId,
        sender_name: sender.name || "MW TECH",
        sender_role: sender.role || "Administrador",
        sender_avatar_url: sender.avatarUrl || "",
      }),
    }) as Promise<{ greeted: boolean; message?: SupportMessage }>;
  },

  async archive(ticketId: string) {
    return archiveRequest(ticketId) as Promise<{ success: boolean; ticket: SupportTicket; driveUrl?: string; archivedMessages?: number }>;
  },

  async updateStatus(ticketId: string, status: string) {
    const source = resolveSource(ticketId);

    if (status === "resolvido") {
      await requestFrom(source, "", {
        method: "POST",
        body: JSON.stringify({
          action: "send_message",
          ticket_id: ticketId,
          body: "Olá! Seu atendimento foi concluído e o chamado foi resolvido. Agradecemos pelo contato com o suporte da MW TECH. Se precisar de algo mais, estaremos à disposição.",
        }),
      });
    }

    if (status === "fechado") {
      await requestFrom(source, "", {
        method: "POST",
        body: JSON.stringify({
          action: "send_message",
          ticket_id: ticketId,
          body: "Este chamado foi encerrado pela equipe de suporte da MW TECH. Caso ainda precise de atendimento, você pode abrir um novo chamado.",
        }),
      });
    }

    const result = await requestFrom(source, "", {
      method: "POST",
      body: JSON.stringify({ action: "update_status", ticket_id: ticketId, status }),
    });

    if (status === "resolvido" || status === "fechado") {
      try {
        await archiveRequest(ticketId);
      } catch (error) {
        console.warn("Chamado encerrado, mas o arquivamento no Drive falhou", error);
      }
    }

    return result;
  },
};
