type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

const EDGE_URL = "https://jfzavijlkbqzkrnlgphz.supabase.co/functions/v1/migrate-supabase-attachments-to-drive";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const limitRaw = Array.isArray(req.query?.limit) ? req.query?.limit[0] : req.query?.limit;
  const limit = Math.max(1, Math.min(Number(limitRaw || 10), 20));
  const url = new URL(EDGE_URL);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url, { method: "GET" });
  const text = await response.text();
  let payload: unknown = text;
  try { payload = JSON.parse(text); } catch {}
  res.status(response.status).json({ upstreamStatus: response.status, payload });
}
