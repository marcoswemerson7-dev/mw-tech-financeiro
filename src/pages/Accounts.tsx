import { useEffect, useMemo, useState } from "react";
import { Plus, X, Landmark, Pencil, Trash2, Upload, ImageOff } from "lucide-react";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { deleteAccount, getAccounts, saveAccount } from "../services/accounts";
import { deleteBankLogo, getBankLogoView, uploadBankLogo } from "../services/storage";
import { money, Empty } from "../components/UI";

type Account = {
  id: string;
  nome: string;
  banco: string;
  codigo_banco?: string;
  agencia?: string;
  conta?: string;
  tipo_conta: string;
  saldo_inicial: number;
  saldo_atual: number;
  cor: string;
  ativo: boolean;
};

const demo: Account = {
  id: "demo-bb",
  nome: "Conta principal",
  banco: "Banco do Brasil",
  codigo_banco: "001",
  agencia: "Informe a agência",
  conta: "Informe a conta",
  tipo_conta: "corrente",
  saldo_inicial: 0,
  saldo_atual: 0,
  cor: "#f7c600",
  ativo: true,
};

export default function Accounts() {
  const [rows, setRows] = useState<Account[]>([]);
  const [edit, setEdit] = useState<Partial<Account> | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoVersion, setLogoVersion] = useState(Date.now());

  async function load() {
    if (!isConfigured) {
      setRows(JSON.parse(localStorage.getItem("mw-accounts") || JSON.stringify([demo])));
      return;
    }
    setRows((await getAccounts()) as Account[]);
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

  function openEditor(account: Partial<Account> = {}) {
    setLogoFile(null);
    setLogoPreview("");
    setRemoveLogo(false);
    setEdit(account);
  }

  function chooseLogo(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) return alert("A logomarca deve estar em PNG, JPG ou JPEG.");
    if (file.size > 2_000_000) return alert("A logomarca deve ter no máximo 2 MB.");
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    d.saldo_inicial = Number(d.saldo_inicial || 0);
    d.saldo_atual = edit?.id ? Number(edit.saldo_atual ?? edit.saldo_inicial ?? 0) : d.saldo_inicial;
    d.ativo = true;
    d.cor = edit?.cor || "#0b2b66";
    setSaving(true);
    try {
      let accountId = edit?.id || "";
      if (!isConfigured) {
        accountId ||= crypto.randomUUID();
        const nextRow = { ...edit, ...d, id: accountId } as Account;
        const next = edit?.id ? rows.map((x) => x.id === edit.id ? nextRow : x) : [...rows, nextRow];
        localStorage.setItem("mw-accounts", JSON.stringify(next));
        setRows(next);
      } else {
        const saved: any = await saveAccount(d, edit?.id);
        accountId = saved.$id || edit?.id || "";
        if (removeLogo && accountId) await deleteBankLogo(accountId);
        if (logoFile && accountId) await uploadBankLogo(accountId, logoFile);
        const nextRow: Account = {
          id: accountId,
          nome: d.nome,
          banco: d.banco,
          codigo_banco: d.codigo_banco,
          agencia: d.agencia,
          conta: d.conta,
          tipo_conta: d.tipo_conta,
          saldo_inicial: d.saldo_inicial,
          saldo_atual: d.saldo_atual,
          cor: d.cor,
          ativo: true,
        };
        setRows((current) => edit?.id ? current.map((x) => x.id === edit.id ? nextRow : x) : [...current, nextRow]);
        setLogoVersion(Date.now());
      }
      setEdit(null);
      setLogoFile(null);
      setLogoPreview("");
      alert("Conta bancária salva com sucesso.");
    } catch (error: any) {
      alert(error?.message || "Não foi possível salvar a conta.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta conta bancária?")) return;
    if (!isConfigured) {
      const n = rows.filter((x) => x.id !== id);
      localStorage.setItem("mw-accounts", JSON.stringify(n));
      setRows(n);
    } else {
      await deleteAccount(id);
      void deleteBankLogo(id).catch(() => undefined);
      setRows((current) => current.filter((x) => x.id !== id));
    }
    alert("Conta bancária excluída com sucesso.");
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[30px] font-extrabold tracking-tight text-[#0b1d3a]">Contas bancárias e caixa</h2>
          <p className="mt-1.5 text-[16px] text-slate-500">Visualize suas contas, dados bancários e saldos de forma rápida.</p>
        </div>
        <button onClick={() => openEditor({})} className="flex min-h-[50px] items-center gap-2 rounded-lg bg-[#0b2b66] px-5 py-3 text-[15px] font-bold text-white shadow-sm transition hover:bg-[#082454]">
          <Plus size={19} /> Cadastrar conta
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <span className="text-[15px] font-semibold text-slate-500">Saldo total em contas</span>
          <strong className="mt-3 block text-[34px] tracking-tight text-[#0b1d3a]">{money(rows.reduce((s, a) => s + Number(a.saldo_atual ?? a.saldo_inicial), 0))}</strong>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <span className="text-[15px] font-semibold text-slate-500">Quantidade de contas</span>
          <strong className="mt-3 block text-[34px] tracking-tight text-[#0b1d3a]">{rows.length}</strong>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((a) => (
          <div key={a.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="h-2.5" style={{ background: a.cor }} />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-4">
                  <BankLogo account={a} version={logoVersion} />
                  <div className="min-w-0">
                    <b className="block truncate text-[17px] font-extrabold text-[#0b1d3a]">{a.nome}</b>
                    <span className="mt-1 block text-[14px] font-medium text-slate-500">{a.banco} · {a.codigo_banco || "—"}</span>
                    <span className="mt-1 block text-[12px] uppercase tracking-wide text-slate-400">{a.tipo_conta || "Conta bancária"}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => openEditor(a)} className="grid size-10 place-items-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 transition hover:bg-blue-100" aria-label="Editar conta"><Pencil size={17} /></button>
                  <button onClick={() => remove(a.id)} className="grid size-10 place-items-center rounded-lg border border-rose-100 bg-rose-50 text-rose-700 transition hover:bg-rose-100" aria-label="Excluir conta"><Trash2 size={17} /></button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div><span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Agência</span><b className="mt-1 block text-[15px] text-slate-700">{a.agencia || "Não informada"}</b></div>
                <div><span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Conta</span><b className="mt-1 block text-[15px] text-slate-700">{a.conta || "Não informada"}</b></div>
              </div>

              <div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-5">
                <span className="text-[14px] font-semibold text-slate-500">Saldo atual</span>
                <strong className="text-[24px] tracking-tight text-[#0b1d3a]">{money(a.saldo_atual ?? a.saldo_inicial)}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!rows.length && <Empty />}

      {edit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <form onSubmit={save} className="max-h-[94vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-7 py-6">
              <div><p className="text-[12px] font-bold uppercase tracking-[.16em] text-[#b97f2e]">Dados bancários</p><h3 className="mt-1 text-[26px] font-extrabold text-[#0b1d3a]">{edit.id ? "Editar" : "Nova"} conta</h3></div>
              <button type="button" onClick={() => setEdit(null)} className="grid size-10 place-items-center rounded-lg hover:bg-slate-100"><X /></button>
            </div>

            <div className="border-b border-slate-100 bg-slate-50/70 px-7 py-5">
              <p className="mb-3 text-[14px] font-bold text-slate-700">Logomarca do banco</p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid size-20 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {logoPreview ? <img src={logoPreview} alt="Prévia da logomarca" className="h-full w-full object-contain p-2" /> : edit.id && !removeLogo ? <LogoPreview account={edit as Account} version={logoVersion} /> : <Landmark className="text-slate-400" size={30} />}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#0b2b66] bg-white px-4 py-2.5 text-sm font-bold text-[#0b2b66] hover:bg-blue-50"><Upload size={16}/> Selecionar logomarca<input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => chooseLogo(e.target.files?.[0])}/></label>
                  {edit.id && <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(""); setRemoveLogo(true); }} className="flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50"><ImageOff size={16}/> Remover</button>}
                </div>
                <p className="w-full text-xs text-slate-500">PNG, JPG ou JPEG · máximo 2 MB. A imagem será ajustada sem distorção no card da conta.</p>
              </div>
            </div>

            <div className="grid gap-5 p-7 sm:grid-cols-2">
              {[["nome", "Nome da conta"],["banco", "Banco"],["codigo_banco", "Código do banco"],["agencia", "Agência"],["conta", "Número da conta"],["tipo_conta", "Tipo da conta"],["saldo_inicial", "Saldo inicial"]].map(([n, l]) => (
                <label key={n} className="text-[14px] font-bold text-slate-700">{l}
                  <input required={["nome", "banco"].includes(n)} name={n} type={n === "saldo_inicial" ? "number" : "text"} step="0.01" defaultValue={String((edit as any)[n] ?? "")} className="input" />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-7 py-5">
              <button type="button" onClick={() => setEdit(null)} className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700">Cancelar</button>
              <button disabled={saving} className="rounded-lg bg-[#0b2b66] px-6 py-3 font-bold text-white disabled:cursor-wait disabled:opacity-60">{saving ? "Salvando..." : "Salvar conta"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function BankLogo({ account, version }: { account: Account; version: number }) {
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => isConfigured ? `${getBankLogoView(account.id)}${getBankLogoView(account.id).includes("?") ? "&" : "?"}v=${version}` : "", [account.id, version]);
  if (!isConfigured || failed) return <FallbackLogo account={account} />;
  return <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><img src={src} alt={`Logo ${account.banco}`} className="h-full w-full object-contain p-2" onError={() => setFailed(true)} /></span>;
}

function LogoPreview({ account, version }: { account: Account; version: number }) {
  const [failed, setFailed] = useState(false);
  const src = `${getBankLogoView(account.id)}${getBankLogoView(account.id).includes("?") ? "&" : "?"}v=${version}`;
  if (failed) return <Landmark className="text-slate-400" size={30} />;
  return <img src={src} alt="Logomarca atual" className="h-full w-full object-contain p-2" onError={() => setFailed(true)} />;
}

function FallbackLogo({ account }: { account: Account }) {
  return <span className={`grid size-14 shrink-0 place-items-center rounded-xl border ${account.codigo_banco === "001" ? "border-[#e3c100] bg-[#f7c600] text-[#153c8a]" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{account.codigo_banco === "001" ? <b className="text-[14px]">BB</b> : <Landmark size={25} />}</span>;
}
