import { useEffect, useState } from "react";
import { getCompanySettings, saveCompanySettings } from "../services/reports";
const fields = ["nome_empresa", "razao_social", "cnpj", "telefone", "email", "endereco", "cidade", "estado", "pix", "banco", "agencia", "conta", "logo_url"];
export default function Settings() {
  const [data, setData] = useState<Record<string, string>>({}), [msg, setMsg] = useState("");
  useEffect(() => { getCompanySettings().then((x: any) => setData(x)).catch(() => setData({})); }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setMsg(""); try { const value = Object.fromEntries(new FormData(e.currentTarget)); await saveCompanySettings(value, data.id); setMsg("Configurações salvas."); } catch (e: any) { setMsg(e.message || "Não foi possível salvar."); } }
  return <form onSubmit={save} className="max-w-4xl rounded-2xl border bg-white p-6"><h2 className="text-2xl font-bold">Dados da empresa</h2><div className="mt-6 grid gap-4 sm:grid-cols-2">{fields.map(f => <label className="text-sm font-medium capitalize" key={f}>{f.replaceAll("_", " ")}<input name={f} defaultValue={data[f] || ""} className="mt-1.5 w-full rounded-xl border p-3" /></label>)}</div>{msg && <p className="mt-4 text-sm text-slate-600">{msg}</p>}<button className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-white">Salvar configurações</button></form>;
}
