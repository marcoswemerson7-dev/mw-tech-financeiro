import { account } from "../lib/appwrite";

const ENDPOINT = "https://kiviwxonxeqmzqlmshpc.supabase.co/functions/v1/mw-support-admin";
const ARCHIVE_ENDPOINT = "https://kiviwxonxeqmzqlmshpc.supabase.co/functions/v1/archive-support-to-drive";

async function request(path = "", init: RequestInit = {}) {
  const jwt = await account.createJWT();
  const res = await fetch(`${ENDPOINT}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-appwrite-jwt": jwt.jwt,
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Falha ao acessar a Central de Suporte");
  return data;
}

async function archiveRequest(ticketId: string) {
  const jwt = await account.createJWT();
  const res = await fetch(ARCHIVE_ENDPOINT, {
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
  subject: string;
  category: string;
  priority: string;
  status: string;
  source_path?: string | null;
  last_message_at: string;
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

export type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  is_staff: boolean;
  created_at: string;
};

export const supportService = {
  async list(status = "todos") {
    return request(`?status=${encodeURIComponent(status)}`) as Promise<{ tickets: SupportTicket[] }>;
  },
  async detail(ticketId: string) {
    return request(`?ticket_id=${encodeURIComponent(ticketId)}`) as Promise<{ ticket: SupportTicket; messages: SupportMessage[] }>;
  },
  async sendMessage(ticketId: string, body: string) {
    return request("", { method: "POST", body: JSON.stringify({ action: "send_message", ticket_id: ticketId, body }) });
  },
  async archive(ticketId: string) {
    return archiveRequest(ticketId) as Promise<{ success: boolean; ticket: SupportTicket; driveUrl?: string; archivedMessages?: number }>;
  },
  async updateStatus(ticketId: string, status: string) {
    if (status === "resolvido" || status === "fechado") {
      return archiveRequest(ticketId);
    }
    return request("", { method: "POST", body: JSON.stringify({ action: "update_status", ticket_id: ticketId, status }) });
  },
};
