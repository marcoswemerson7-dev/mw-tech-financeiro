export const maxDuration = 60;

type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

const DRIVE_STORAGE_ENDPOINT =
  process.env.DRIVE_STORAGE_ENDPOINT ||
  "https://kiviwxonxeqmzqlmshpc.supabase.co/functions/v1/mw-drive-storage-summary";

const MW_TECH_DRIVE_KEY = process.env.MW_TECH_DRIVE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  if (!MW_TECH_DRIVE_KEY) { res.status(503).json({ error: "Integração de armazenamento não configurada." }); return; }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch(DRIVE_STORAGE_ENDPOINT, {
      method: "GET",
      headers: {
        "x-mw-tech-key": MW_TECH_DRIVE_KEY,
        "Accept": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    let body: any = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }

    if (!response.ok || body?.error) {
      const detail =
        body?.error ||
        body?.message ||
        text?.slice(0, 500) ||
        `HTTP ${response.status}`;

      console.error("[DRIVE-STORAGE] upstream error", {
        status: response.status,
        detail,
      });

      res.status(response.status >= 400 && response.status < 600 ? response.status : 502).json({
        error: "Não foi possível consultar o armazenamento do Google Drive.",
        detail,
      });
      return;
    }

    // O Patrimônio usa outra integração OAuth. Consultar apenas métricas agregadas
    // para não confundir o espaço da conta atual com o consumo dessa pasta.
    let externalFolders: unknown[] = [];
    let externalError = "";
    const externalController = new AbortController();
    const externalTimeout = setTimeout(() => externalController.abort(), 12000);
    try {
      const externalResponse = await fetch(
        "https://ybljkroautoqzmifrkbi.supabase.co/functions/v1/patrimonio-drive?action=storage-summary",
        {method:"GET",headers:{"Accept":"application/json"},signal:externalController.signal,cache:"no-store"}
      );
      const externalData = await externalResponse.json().catch(() => ({}));
      if (externalResponse.ok && externalData.folder && externalData.folder.complete === true) {
        externalFolders = [externalData.folder];
      } else {
        externalError = "Medição do Patrimônio temporariamente indisponível.";
      }
    } catch {
      externalError = "Medição do Patrimônio temporariamente indisponível.";
    } finally {
      clearTimeout(externalTimeout);
    }
    res.status(200).json({...body,externalFolders,externalError});
  } catch (error: any) {
    const message =
      error?.name === "AbortError"
        ? "A consulta ao Google Drive excedeu o tempo limite."
        : String(error?.message || "Falha de conexão com o serviço de armazenamento.");

    console.error("[DRIVE-STORAGE] proxy failure", message);
    res.status(502).json({
      error: "Não foi possível consultar o armazenamento do Google Drive.",
      detail: message,
    });
  } finally {
    clearTimeout(timeout);
  }
}
