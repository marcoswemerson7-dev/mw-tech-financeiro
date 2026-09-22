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

const MW_TECH_DRIVE_KEY =
  process.env.MW_TECH_DRIVE_KEY ||
  "ADJ9w5w15Tinci91aHGav4vWjpqDqhq2NBeHqqOoQH4";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

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

    res.status(200).json(body);
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
