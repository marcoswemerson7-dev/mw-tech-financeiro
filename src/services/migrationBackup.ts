import { readAgendaCloud } from "./agendaSync";
import { downloadDespachante } from "./despachanteSync";

type ExportStatus = { module: string; source: string; status: "ok" | "empty" | "error"; message?: string };
const safeJSON = (raw: string | null) => {
  if (raw === null) return null;
  try { return JSON.parse(raw) as unknown; } catch { return { raw, parseError: true }; }
};

export async function downloadMigrationBackup(userId: string) {
  if (!userId || userId === "demo") throw new Error("Entre com sua conta real para exportar os dados.");
  const status: ExportStatus[] = [];
  const local: Record<string, unknown> = {};
  const prefix = "mw-agenda-local-v1:" + userId;
  const localKeys = [
    "mw-despachante-organizado-v2",
    "mw-despachante-local-v1",
    prefix,
    prefix + ":pages",
    prefix + ":tasks",
  ];
  for (const key of localKeys) {
    const value = localStorage.getItem(key);
    if (value !== null) local[key] = safeJSON(value);
  }
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix + ":ink:")) local[key] = safeJSON(localStorage.getItem(key));
  }
  status.push({ module: "local", source: "navegador", status: Object.keys(local).length ? "ok" : "empty" });

  let cloudAgenda: unknown = null;
  try {
    const result = await readAgendaCloud();
    cloudAgenda = result;
    status.push({ module: "agenda", source: "appwrite", status: result ? "ok" : "empty" });
  } catch (error) {
    status.push({ module: "agenda", source: "appwrite", status: "error", message: String(error) });
  }

  let cloudDespachante: unknown = null;
  try {
    cloudDespachante = await downloadDespachante();
    status.push({ module: "despachante", source: "appwrite", status: cloudDespachante ? "ok" : "empty" });
  } catch (error) {
    status.push({ module: "despachante", source: "appwrite", status: "error", message: String(error) });
  }

  const backup = {
    format: "mw-tech-control-migration-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    appwriteUserId: userId,
    sources: { local, appwrite: { agenda: cloudAgenda, despachante: cloudDespachante } },
    status,
    note: "Backup parcial dos modulos Agenda e Despachante; NAO inclui dados financeiros, arquivos nem autenticacao.",
  };
  const fileName = "mw-tech-control-migracao-" + new Date().toISOString().slice(0, 10) + ".json";
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return { fileName, status, hasErrors: status.some(item => item.status === "error") };
}
