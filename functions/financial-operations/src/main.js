import { Client, ID, Query, TablesDB, Users } from "node-appwrite";

const T = {
  accounts: "contas_financeiras",
  moves: "movimentacoes_financeiras",
  expenses: "despesas",
  payments: "pagamentos_despesas",
  ops: "operacoes_idempotentes",
  systems: "sistemas_orgaos",
  staff: "usuarios_acessos",
  incidents: "monitoring_incidents",
};

const gb = (value) => Math.round((Number(value || 0) / 1024 / 1024 / 1024) * 100) / 100;
const positive = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error("O valor deve ser maior que zero.");
  return number;
};
const nowIso = () => new Date().toISOString();
const asIso = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Data inválida.");
  return date.toISOString();
};

async function googleAccessToken() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Integração com o Google Drive ainda não configurada.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "Não foi possível autenticar no Google Drive.");
  return data.access_token;
}

async function driveJson(token, url) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Falha ao consultar o Google Drive.");
  return data;
}

async function folderUsage(token, rootId) {
  let bytes = 0;
  let files = 0;
  let folders = 0;
  const queue = [rootId];
  const seen = new Set();
  while (queue.length) {
    const folderId = queue.shift();
    if (!folderId || seen.has(folderId)) continue;
    seen.add(folderId);
    let pageToken = "";
    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and trashed = false`,
        fields: "nextPageToken,files(id,mimeType,size)",
        pageSize: "1000",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const data = await driveJson(token, `https://www.googleapis.com/drive/v3/files?${params}`);
      for (const file of data.files || []) {
        if (file.mimeType === "application/vnd.google-apps.folder") {
          folders++;
          queue.push(file.id);
        } else {
          files++;
          bytes += Number(file.size || 0);
        }
      }
      pageToken = data.nextPageToken || "";
    } while (pageToken);
  }
  return { bytes, usedGb: gb(bytes), files, folders };
}

async function getDriveStorage() {
  const token = await googleAccessToken();
  const about = await driveJson(token, "https://www.googleapis.com/drive/v3/about?fields=storageQuota");
  const quota = about.storageQuota || {};
  const limit = Number(quota.limit || 0);
  const usage = Number(quota.usage || 0);
  let configuredFolders = [];
  try {
    configuredFolders = JSON.parse(process.env.GOOGLE_DRIVE_FOLDERS || "[]");
  } catch {
    throw new Error("GOOGLE_DRIVE_FOLDERS possui JSON inválido.");
  }
  const folders = [];
  for (const item of configuredFolders) {
    if (!item?.id || !item?.name) continue;
    const stats = await folderUsage(token, item.id);
    folders.push({ id: item.id, name: item.name, ...stats, percentOfTotal: limit ? Math.round((stats.bytes / limit) * 1000) / 10 : 0 });
  }
  return {
    ok: true,
    totalGb: gb(limit),
    usedGb: gb(usage),
    availableGb: gb(Math.max(limit - usage, 0)),
    percent: limit ? Math.round((usage / limit) * 1000) / 10 : 0,
    folders,
    updatedAt: nowIso(),
  };
}


async function ensureIncidentTable(db, databaseId) {
  try {
    await db.getTable({ databaseId, tableId: T.incidents });
    return;
  } catch (e) {
    if (e.code !== 404) throw e;
  }

  await db.createTable({
    databaseId,
    tableId: T.incidents,
    name: "Incidentes de monitoramento",
    permissions: [],
    rowSecurity: false,
    columns: [
      { key: "incident_key", type: "varchar", size: 255, required: true },
      { key: "system", type: "varchar", size: 20, required: true },
      { key: "system_label", type: "varchar", size: 120, required: true },
      { key: "severity", type: "varchar", size: 20, required: true },
      { key: "source", type: "varchar", size: 30, required: true },
      { key: "title", type: "varchar", size: 255, required: true },
      { key: "message", type: "text", required: false },
      { key: "action_url", type: "varchar", size: 2048, required: false },
      { key: "active", type: "boolean", required: false, default: true },
      { key: "first_seen_at", type: "datetime", required: true },
      { key: "last_seen_at", type: "datetime", required: true },
      { key: "occurrences", type: "integer", required: false, default: 1 },
      { key: "acknowledged", type: "boolean", required: false, default: false },
      { key: "acknowledged_at", type: "datetime", required: false },
      { key: "acknowledged_by", type: "varchar", size: 64, required: false },
      { key: "resolved_at", type: "datetime", required: false },
      { key: "updated_at", type: "datetime", required: true }
    ],
    indexes: [
      { key: "incident_key_unique", type: "unique", attributes: ["incident_key"] },
      { key: "incident_system", type: "key", attributes: ["system"] },
      { key: "incident_active", type: "key", attributes: ["active"] },
      { key: "incident_last_seen", type: "key", attributes: ["last_seen_at"] }
    ]
  });
}

function overlapMinutes(start, end, monthStart, monthEnd) {
  const a = Math.max(new Date(start).getTime(), monthStart.getTime());
  const b = Math.min(new Date(end).getTime(), monthEnd.getTime());
  return Math.max(0, (b - a) / 60000);
}

function unionMinutes(intervals) {
  if (!intervals.length) return 0;
  const sorted = intervals
    .map(([a,b]) => [new Date(a).getTime(), new Date(b).getTime()])
    .filter(([a,b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((x,y) => x[0] - y[0]);
  if (!sorted.length) return 0;
  let total = 0;
  let [start,end] = sorted[0];
  for (const [nextStart,nextEnd] of sorted.slice(1)) {
    if (nextStart <= end) end = Math.max(end, nextEnd);
    else { total += end - start; start = nextStart; end = nextEnd; }
  }
  total += end - start;
  return total / 60000;
}

export default async ({ req, res, error }) => {
  const userId = req.headers["x-appwrite-user-id"];
  if (!userId) return res.json({ error: "Usuário não autenticado." }, 401);

  let input;
  try {
    input = JSON.parse(req.body || "{}");
  } catch {
    return res.json({ error: "JSON inválido." }, 400);
  }

  const { action, idempotencyKey } = input;
  if (!action) return res.json({ error: "Ação não informada." }, 400);

  if (action === "health") {
    return res.json({ ok: true, authenticated: true, function: "financial-operations", version: "2026-09-17-stable" });
  }

  if (action === "getDriveStorage") {
    try {
      return res.json(await getDriveStorage());
    } catch (e) {
      error(e.message);
      return res.json({ error: e.message || "Erro ao consultar o Google Drive." }, 400);
    }
  }

  const adminActions = ["listSystems", "saveSystem", "deleteSystem", "listStaff", "saveStaff", "deleteStaff", "listIncidents", "syncIncidents", "acknowledgeIncident", "monthlyAvailability"];
  const readOnlyActions = ["listSystems", "listStaff", "listIncidents", "monthlyAvailability"];
  const noIdempotencyActions = ["syncIncidents", "acknowledgeIncident"];
  const mutationActions = !readOnlyActions.includes(action) && !noIdempotencyActions.includes(action);
  if (mutationActions && !idempotencyKey) return res.json({ error: "Chave de idempotência obrigatória." }, 400);

  const endpoint = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const databaseId = process.env.APPWRITE_DATABASE_ID || "mw-tech-financeiro";
  if (!projectId || !apiKey) return res.json({ error: "Function sem APPWRITE_PROJECT_ID/APPWRITE_API_KEY configurados." }, 500);

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const db = new TablesDB(client);
  const users = new Users(client);

  const configuredAdmins = String(process.env.CONTROL_ADMIN_USER_IDS || "").split(",").map((x) => x.trim()).filter(Boolean);
  const isAdmin = configuredAdmins.length === 0 || configuredAdmins.includes(userId);
  const requireAdmin = () => {
    if (!isAdmin) throw new Error("Acesso exclusivo do administrador do MW TECH Control.");
  };

  const replay = async () => {
    if (!mutationActions || !idempotencyKey) return null;
    try {
      const done = await db.getRow({ databaseId, tableId: T.ops, rowId: idempotencyKey });
      return { ok: true, id: done.result_id, replayed: true };
    } catch (e) {
      if (e.code !== 404) throw e;
      return null;
    }
  };

  try {
    if (adminActions.includes(action)) {
      if (action === "listSystems") {
        const result = await db.listRows({ databaseId, tableId: T.systems, queries: [Query.orderAsc("orgao"), Query.limit(200)] });
        return res.json({ ok: true, rows: result.rows });
      }
      if (action === "listStaff") {
        requireAdmin();
        const result = await db.listRows({ databaseId, tableId: T.staff, queries: [Query.orderAsc("nome"), Query.limit(200)] });
        const authUsers = await users.list({ queries: [Query.limit(500)] });
        const byEmail = new Map((authUsers.users || []).map((user) => [String(user.email || "").toLowerCase(), user]));
        const rows = result.rows.map((row) => {
          const authUser = byEmail.get(String(row.email || "").toLowerCase());
          return {
            ...row,
            cpf: String(authUser?.prefs?.cpf || ""),
            auth_user_id: authUser?.$id || "",
            login_criado: Boolean(authUser?.$id),
          };
        });
        return res.json({ ok: true, rows });
      }

      if (["listIncidents","syncIncidents","acknowledgeIncident","monthlyAvailability"].includes(action)) {
        requireAdmin();
        await ensureIncidentTable(db, databaseId);

        if (action === "listIncidents") {
          const result = await db.listRows({
            databaseId,
            tableId: T.incidents,
            queries: [Query.orderDesc("last_seen_at"), Query.limit(300)]
          });
          return res.json({ ok: true, rows: result.rows });
        }

        if (action === "syncIncidents") {
          const incoming = Array.isArray(input.incidents) ? input.incidents.slice(0, 100) : [];
          const activeKeys = new Set(incoming.map((item) => String(item.id || "")).filter(Boolean));
          const current = await db.listRows({ databaseId, tableId: T.incidents, queries: [Query.limit(300)] });
          const byKey = new Map(current.rows.map((row) => [String(row.incident_key), row]));
          const now = nowIso();

          for (const item of incoming) {
            const incidentKey = String(item.id || "").slice(0,255);
            if (!incidentKey) continue;
            const previous = byKey.get(incidentKey);
            const data = {
              incident_key: incidentKey,
              system: String(item.system || "mw").slice(0,20),
              system_label: String(item.systemLabel || item.system || "MW TECH").slice(0,120),
              severity: String(item.severity || "warning").slice(0,20),
              source: String(item.source || "health").slice(0,30),
              title: String(item.title || "Incidente").slice(0,255),
              message: String(item.message || "").slice(0,12000),
              action_url: String(item.actionUrl || "").slice(0,2048),
              active: true,
              first_seen_at: previous?.first_seen_at || item.occurredAt || now,
              last_seen_at: now,
              occurrences: Number(previous?.occurrences || 0) + 1,
              acknowledged: Boolean(previous?.acknowledged),
              acknowledged_at: previous?.acknowledged_at || "",
              acknowledged_by: previous?.acknowledged_by || "",
              resolved_at: "",
              updated_at: now,
            };
            if (previous) await db.updateRow({ databaseId, tableId: T.incidents, rowId: previous.$id, data });
            else await db.createRow({ databaseId, tableId: T.incidents, rowId: ID.unique(), data });
          }

          for (const row of current.rows) {
            if (row.active && !activeKeys.has(String(row.incident_key))) {
              await db.updateRow({
                databaseId,
                tableId: T.incidents,
                rowId: row.$id,
                data: { active: false, resolved_at: now, last_seen_at: now, updated_at: now }
              });
            }
          }

          const refreshed = await db.listRows({ databaseId, tableId: T.incidents, queries: [Query.orderDesc("last_seen_at"), Query.limit(300)] });
          return res.json({ ok: true, rows: refreshed.rows });
        }

        if (action === "acknowledgeIncident") {
          const incidentKey = String(input.incidentKey || "");
          if (!incidentKey) throw new Error("Incidente não informado.");
          const found = await db.listRows({ databaseId, tableId: T.incidents, queries: [Query.equal("incident_key", incidentKey), Query.limit(1)] });
          const row = found.rows[0];
          if (!row) throw new Error("Incidente não encontrado.");
          const now = nowIso();
          const updated = await db.updateRow({
            databaseId,
            tableId: T.incidents,
            rowId: row.$id,
            data: { acknowledged: true, acknowledged_at: now, acknowledged_by: userId, updated_at: now }
          });
          return res.json({ ok: true, row: updated });
        }

        if (action === "monthlyAvailability") {
          const month = String(input.month || nowIso().slice(0,7));
          if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Competência inválida.");
          const [year, monthNumber] = month.split("-").map(Number);
          const start = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0));
          const end = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0));
          const effectiveEnd = Math.min(Date.now(), end.getTime());
          const periodMinutes = Math.max(1, (effectiveEnd - start.getTime()) / 60000);
          const result = await db.listRows({ databaseId, tableId: T.incidents, queries: [Query.limit(500)] });
          const systems = ["mw","rg","bg"].map((system) => {
            const rows = result.rows.filter((row) => String(row.system) === system && new Date(row.first_seen_at).getTime() < end.getTime() && new Date(row.resolved_at || nowIso()).getTime() >= start.getTime());
            const critical = rows.filter((row) => row.severity === "critical");
            const healthCritical = critical.filter((row) => row.source === "health");
            const intervals = healthCritical.map((row) => [
              new Date(Math.max(new Date(row.first_seen_at).getTime(), start.getTime())).toISOString(),
              new Date(Math.min(new Date(row.resolved_at || nowIso()).getTime(), effectiveEnd)).toISOString()
            ]);
            const downtimeMinutes = Math.round(unionMinutes(intervals) * 10) / 10;
            const availability = Math.max(0, Math.min(100, 100 - (downtimeMinutes / periodMinutes) * 100));
            return {
              system,
              incidents: rows.length,
              criticalIncidents: critical.length,
              downtimeMinutes,
              availability: Math.round(availability * 1000) / 1000,
            };
          });
          return res.json({ ok: true, month, periodMinutes, systems });
        }
      }

      requireAdmin();
      const replayed = await replay();
      if (replayed) return res.json(replayed);
      const now = nowIso();

      if (action === "saveSystem") {
        if (!String(input.orgao || "").trim()) throw new Error("Informe o órgão.");
        if (!String(input.sistema || "").trim()) throw new Error("Informe o nome do sistema.");
        const data = {
          orgao: String(input.orgao || "").trim(),
          tipo_orgao: input.tipo_orgao || "Prefeitura",
          sistema: String(input.sistema || "").trim(),
          dominio_url: input.dominio_url || "",
          vercel_url: input.vercel_url || "",
          acesso_url: input.acesso_url || input.dominio_url || "",
          ambiente: input.ambiente || "Produção",
          status: input.status || "ativo",
          observacao: input.observacao || "",
          updated_at: now,
        };
        const row = input.id
          ? await db.updateRow({ databaseId, tableId: T.systems, rowId: input.id, data })
          : await db.createRow({ databaseId, tableId: T.systems, rowId: ID.unique(), data: { ...data, created_at: now } });
        await db.createRow({ databaseId, tableId: T.ops, rowId: idempotencyKey, data: { action, user_id: userId, result_id: row.$id, created_at: now } });
        return res.json({ ok: true, row });
      }

      if (action === "deleteSystem") {
        if (!input.id) throw new Error("Sistema não informado.");
        await db.deleteRow({ databaseId, tableId: T.systems, rowId: input.id });
        await db.createRow({ databaseId, tableId: T.ops, rowId: idempotencyKey, data: { action, user_id: userId, result_id: input.id, created_at: now } });
        return res.json({ ok: true, id: input.id });
      }

      if (action === "saveStaff") {
        if (!String(input.nome || "").trim()) throw new Error("Informe o nome do usuário.");
        if (!String(input.email || "").trim()) throw new Error("Informe o e-mail do usuário.");
        const email = String(input.email || "").trim().toLowerCase();
        const cpf = String(input.cpf || "").replace(/\D/g, "");
        if (cpf && cpf.length !== 11) throw new Error("Informe um CPF válido com 11 dígitos.");

        const authMatches = await users.list({ queries: [Query.equal("email", email), Query.limit(1)] });
        let authUser = authMatches.users?.[0] || null;

        if (!authUser) {
          throw new Error("A conta de login deste e-mail ainda não existe no Appwrite Auth. Crie a conta Auth e depois salve o CPF aqui.");
        }

        if (authUser) {
          const allUsers = await users.list({ queries: [Query.limit(500)] });
          if (cpf) {
            const duplicate = (allUsers.users || []).find((user) => user.$id !== authUser.$id && String(user.prefs?.cpf || "").replace(/\D/g, "") === cpf);
            if (duplicate) throw new Error("Este CPF já está vinculado a outro usuário.");
          }
          await users.updateName({ userId: authUser.$id, name: String(input.nome || "").trim() });
          await users.updatePrefs({
            userId: authUser.$id,
            prefs: {
              ...(authUser.prefs || {}),
              cpf,
              cargo: input.cargo || "Colaborador",
              mw_control_status: input.status || "ativo",
            },
          });
        }

        const data = {
          nome: String(input.nome || "").trim(),
          email,
          cargo: input.cargo || "Colaborador",
          status: input.status || "ativo",
          modulos: JSON.stringify(input.modulos || []),
          updated_at: now,
        };
        const row = input.id
          ? await db.updateRow({ databaseId, tableId: T.staff, rowId: input.id, data })
          : await db.createRow({ databaseId, tableId: T.staff, rowId: ID.unique(), data: { ...data, created_at: now } });
        await db.createRow({ databaseId, tableId: T.ops, rowId: idempotencyKey, data: { action, user_id: userId, result_id: row.$id, created_at: now } });
        return res.json({ ok: true, row: { ...row, cpf, auth_user_id: authUser?.$id || "", login_criado: Boolean(authUser?.$id) } });
      }

      if (action === "deleteStaff") {
        if (!input.id) throw new Error("Usuário não informado.");
        await db.deleteRow({ databaseId, tableId: T.staff, rowId: input.id });
        await db.createRow({ databaseId, tableId: T.ops, rowId: idempotencyKey, data: { action, user_id: userId, result_id: input.id, created_at: now } });
        return res.json({ ok: true, id: input.id });
      }
    }

    const replayed = await replay();
    if (replayed) return res.json(replayed);

    const now = nowIso();
    const tx = await db.createTransaction();
    const transactionId = tx.$id;
    const get = (tableId, rowId) => db.getRow({ databaseId, tableId, rowId, transactionId });
    const update = (tableId, rowId, data) => db.updateRow({ databaseId, tableId, rowId, data, transactionId });
    const create = (tableId, rowId, data) => db.createRow({ databaseId, tableId, rowId, data, transactionId });
    const remove = (tableId, rowId) => db.deleteRow({ databaseId, tableId, rowId, transactionId });

    const applyEffect = async (move, sign = 1, allowNegative = false) => {
      const value = positive(move.valor);
      const origin = await get(T.accounts, move.conta_id);
      const transfer = move.tipo === "transferencia";
      const out = move.tipo === "saida" || transfer;
      const delta = (out ? -value : value) * sign;
      const next = Number(origin.saldo_atual || 0) + delta;
      if (next < 0 && !allowNegative) throw new Error("Saldo insuficiente para concluir a alteração.");
      await update(T.accounts, origin.$id, { saldo_atual: next, updated_at: now });
      if (transfer) {
        if (!move.conta_destino_id || move.conta_destino_id === origin.$id) throw new Error("Informe uma conta de destino diferente.");
        const destination = await get(T.accounts, move.conta_destino_id);
        const destinationNext = Number(destination.saldo_atual || 0) + value * sign;
        if (destinationNext < 0 && !allowNegative) throw new Error("Saldo insuficiente na conta de destino.");
        await update(T.accounts, destination.$id, { saldo_atual: destinationNext, updated_at: now });
      }
    };

    let resultId = "";
    let resultRow = null;

    if (action === "saveAccount") {
      if (!String(input.nome || "").trim()) throw new Error("Informe o nome da conta.");
      const initial = Number(input.saldo_inicial || 0);
      const data = {
        nome: String(input.nome).trim(),
        tipo: input.tipo || input.tipo_conta || "corrente",
        banco: input.banco || "",
        codigo_banco: input.codigo_banco || "",
        agencia: input.agencia || "",
        numero_conta: input.numero_conta || input.conta || "",
        saldo_inicial: initial,
        saldo_atual: input.id ? Number(input.saldo_atual ?? initial) : initial,
        cor: input.cor || "#0b2b66",
        ativo: input.ativo !== false,
        updated_at: now,
      };
      resultRow = input.id
        ? await update(T.accounts, input.id, data)
        : await create(T.accounts, ID.unique(), { ...data, created_at: now });
      resultId = resultRow.$id;
    } else if (action === "deleteAccount") {
      if (!input.id) throw new Error("Conta não informada.");
      const linked = await db.listRows({ databaseId, tableId: T.moves, queries: [Query.equal("conta_id", input.id), Query.limit(1)], transactionId });
      if (linked.rows.length) throw new Error("Esta conta possui movimentações e não pode ser excluída.");
      await remove(T.accounts, input.id);
      resultId = input.id;
    } else if (action === "createExpense") {
      if (!String(input.descricao || "").trim()) throw new Error("Informe a descrição da despesa.");
      resultId = ID.unique();
      resultRow = await create(T.expenses, resultId, {
        descricao: String(input.descricao).trim(),
        categoria_id: input.categoria_id || "",
        categoria: input.categoria || "",
        competencia: asIso(input.competencia),
        vencimento: asIso(input.data_vencimento || input.vencimento),
        valor: positive(input.valor),
        conta_id: input.conta_bancaria_id || input.conta_id || "",
        fornecedor: input.fornecedor || "",
        observacao: input.observacoes || input.observacao || "",
        status: "pendente",
        recorrente: Boolean(input.recorrente),
        recorrencia_id: input.recorrencia_id || "",
        data_pagamento: "",
        comprovante_id: "",
        created_by: userId,
        created_at: now,
        updated_at: now,
      });
    } else if (action === "registerMovement" || action === "transfer") {
      const value = positive(input.valor);
      const origin = await get(T.accounts, input.conta_id);
      const transfer = action === "transfer" || input.tipo === "transferencia";
      const out = input.tipo === "saida" || transfer;
      if (out && Number(origin.saldo_atual || 0) < value) throw new Error("Saldo insuficiente.");
      await update(T.accounts, origin.$id, { saldo_atual: Number(origin.saldo_atual || 0) + (out ? -value : value), updated_at: now });
      if (transfer) {
        if (!input.conta_destino_id || input.conta_destino_id === origin.$id) throw new Error("Informe uma conta de destino diferente.");
        const destination = await get(T.accounts, input.conta_destino_id);
        await update(T.accounts, destination.$id, { saldo_atual: Number(destination.saldo_atual || 0) + value, updated_at: now });
      }
      resultId = ID.unique();
      resultRow = await create(T.moves, resultId, {
        tipo: transfer ? "transferencia" : input.tipo,
        data: asIso(input.data),
        descricao: input.descricao || "Movimentação",
        categoria_id: input.categoria_id || "",
        conta_id: origin.$id,
        conta_destino_id: input.conta_destino_id || "",
        valor: value,
        observacao: input.observacao || "",
        comprovante_id: input.comprovante_id || "",
        despesa_id: "",
        pagamento_id: "",
        created_by: userId,
        idempotency_key: idempotencyKey,
        created_at: now,
      });
    } else if (action === "updateMovement") {
      const move = await get(T.moves, input.movimentacao_id);
      if (move.despesa_id || move.pagamento_id) throw new Error("Movimentações geradas por despesas/pagamentos devem ser alteradas pela tela de Despesas.");
      await applyEffect(move, -1);
      const next = {
        ...move,
        tipo: input.tipo || move.tipo,
        data: input.data ? asIso(input.data) : move.data,
        descricao: input.descricao ?? move.descricao,
        conta_id: input.conta_id || move.conta_id,
        conta_destino_id: input.conta_destino_id ?? move.conta_destino_id,
        valor: positive(input.valor ?? move.valor),
        observacao: input.observacao ?? move.observacao,
        comprovante_id: input.comprovante_id ?? move.comprovante_id,
      };
      await applyEffect(next, 1);
      resultId = move.$id;
      resultRow = await update(T.moves, move.$id, {
        tipo: next.tipo,
        data: next.data,
        descricao: next.descricao,
        conta_id: next.conta_id,
        conta_destino_id: next.conta_destino_id || "",
        valor: next.valor,
        observacao: next.observacao || "",
        comprovante_id: next.comprovante_id || "",
        updated_at: now,
      });
    } else if (action === "deleteMovement") {
      const move = await get(T.moves, input.movimentacao_id);
      if (move.despesa_id || move.pagamento_id) throw new Error("Movimentação vinculada a despesa/pagamento. Exclua ou estorne pela tela de Despesas.");
      await applyEffect(move, -1, true);
      resultId = move.$id;
      await remove(T.moves, move.$id);
    } else if (action === "updateExpense") {
      const expense = await get(T.expenses, input.despesa_id);
      if (expense.status === "pago") throw new Error("Estorne o pagamento antes de editar uma despesa paga.");
      resultId = expense.$id;
      resultRow = await update(T.expenses, expense.$id, {
        descricao: input.descricao ?? expense.descricao,
        categoria: input.categoria ?? expense.categoria,
        categoria_id: input.categoria_id ?? expense.categoria_id,
        competencia: input.competencia ? asIso(input.competencia) : expense.competencia,
        vencimento: input.data_vencimento || input.vencimento ? asIso(input.data_vencimento || input.vencimento) : expense.vencimento,
        valor: positive(input.valor ?? expense.valor),
        conta_id: input.conta_id ?? input.conta_bancaria_id ?? expense.conta_id,
        fornecedor: input.fornecedor ?? expense.fornecedor,
        observacao: input.observacao ?? input.observacoes ?? expense.observacao,
        updated_at: now,
      });
    } else if (action === "cancelExpense") {
      const expense = await get(T.expenses, input.despesa_id);
      if (expense.status === "pago") throw new Error("Estorne o pagamento antes de cancelar uma despesa paga.");
      resultId = expense.$id;
      resultRow = await update(T.expenses, expense.$id, { status: "cancelado", updated_at: now });
    } else if (action === "deleteExpense" || action === "hardDeleteExpense") {
      const expense = await get(T.expenses, input.despesa_id);
      if (expense.status === "pago") throw new Error("Estorne o pagamento antes de excluir definitivamente uma despesa paga.");
      resultId = expense.$id;
      await remove(T.expenses, expense.$id);
    } else if (action === "payExpense") {
      const expense = await get(T.expenses, input.despesa_id);
      if (expense.status === "pago") throw new Error("Esta despesa já está paga.");
      if (expense.status === "cancelado") throw new Error("Reative ou edite a despesa antes de efetuar o pagamento.");
      const value = positive(input.valor_pago);
      const account = await get(T.accounts, input.conta_id);
      if (Number(account.saldo_atual || 0) < value) throw new Error("Saldo insuficiente.");
      const paymentId = ID.unique();
      const movementId = ID.unique();
      resultId = paymentId;
      await create(T.payments, paymentId, {
        despesa_id: expense.$id,
        conta_id: account.$id,
        valor: value,
        data_pagamento: asIso(input.data_pagamento),
        comprovante_id: input.comprovante_id || "",
        observacao: input.observacao || "",
        created_by: userId,
        estornado: false,
        created_at: now,
        idempotency_key: idempotencyKey,
      });
      await create(T.moves, movementId, {
        tipo: "saida",
        data: asIso(input.data_pagamento),
        descricao: `Pagamento: ${expense.descricao}`,
        categoria_id: expense.categoria_id || "",
        conta_id: account.$id,
        conta_destino_id: "",
        valor: value,
        observacao: input.observacao || "",
        comprovante_id: input.comprovante_id || "",
        despesa_id: expense.$id,
        pagamento_id: paymentId,
        created_by: userId,
        idempotency_key: `m-${idempotencyKey}`.slice(0, 36),
        created_at: now,
      });
      await update(T.accounts, account.$id, { saldo_atual: Number(account.saldo_atual || 0) - value, updated_at: now });
      await update(T.expenses, expense.$id, { status: "pago", conta_id: account.$id, data_pagamento: asIso(input.data_pagamento), comprovante_id: input.comprovante_id || "", updated_at: now });
    } else if (action === "reverseExpensePayment") {
      const payment = await get(T.payments, input.pagamento_id);
      if (payment.estornado) throw new Error("Este pagamento já foi estornado.");
      const account = await get(T.accounts, payment.conta_id);
      const expense = await get(T.expenses, payment.despesa_id);
      resultId = ID.unique();
      await update(T.accounts, account.$id, { saldo_atual: Number(account.saldo_atual || 0) + Number(payment.valor || 0), updated_at: now });
      await update(T.payments, payment.$id, { estornado: true, estornado_at: now });
      await update(T.expenses, expense.$id, { status: "pendente", data_pagamento: "", updated_at: now });
      await create(T.moves, resultId, {
        tipo: "estorno",
        data: now,
        descricao: `Estorno: ${expense.descricao}`,
        categoria_id: expense.categoria_id || "",
        conta_id: account.$id,
        conta_destino_id: "",
        valor: Number(payment.valor || 0),
        observacao: input.observacao || "",
        comprovante_id: "",
        despesa_id: expense.$id,
        pagamento_id: payment.$id,
        created_by: userId,
        idempotency_key: `m-${idempotencyKey}`.slice(0, 36),
        created_at: now,
      });
    } else {
      throw new Error("Ação financeira inválida.");
    }

    await create(T.ops, idempotencyKey, { action, user_id: userId, result_id: resultId, created_at: now });
    await db.updateTransaction({ transactionId, commit: true });
    return res.json({ ok: true, id: resultId, row: resultRow, action });
  } catch (e) {
    error(e.message);
    return res.json({ error: e.message || "Erro interno." }, 400);
  }
};
