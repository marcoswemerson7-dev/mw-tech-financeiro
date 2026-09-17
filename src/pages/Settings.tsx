import { useEffect, useState } from "react";
import { Building2, Landmark, Mail, MapPin, Phone, Save } from "lucide-react";
import { getCompanySettings, saveCompanySettings } from "../services/reports";
import { PageHeader, Toast } from "../components/UI";

const defaults: Record<string, string> = {
  nome_empresa: "MW TECH",
  razao_social: "MARCOS WEMERSON DOS SANTOS GONÇALVES",
  cnpj: "62.308.511/0001-12",
  telefone: "",
  email: "marcoswemerson7@gmail.com",
  endereco: "R. Antônio Pinto de Mesquita, 345",
  cidade: "Bela Vista",
  estado: "PI",
  cep: "",
  pix: "marcoswemerson7@gmail.com",
  banco: "Banco do Brasil",
  agencia: "2533-0",
  conta: "28143-3",
  logo_url: "/mw-tech-logo-horizontal.png",
};

const sections = [
  { title: "Identificação da empresa", icon: Building2, fields: [["nome_empresa", "Nome fantasia"], ["razao_social", "Razão social"], ["cnpj", "CNPJ"]] },
  { title: "Contato e endereço", icon: MapPin, fields: [["telefone", "Telefone"], ["email", "E-mail"], ["endereco", "Endereço"], ["cidade", "Cidade"], ["estado", "Estado"], ["cep", "CEP"]] },
  { title: "Dados financeiros", icon: Landmark, fields: [["pix", "Chave Pix"], ["banco", "Banco"], ["agencia", "Agência"], ["conta", "Conta"]] },
] as const;

export default function Settings() {
  const [data, setData] = useState<Record<string, string>>(defaults);
  const [recordId, setRecordId] = useState<string | undefined>();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCompanySettings()
      .then((value: any) => {
        setRecordId(value?.id);
        setData({ ...defaults, ...value });
      })
      .catch(() => setData(defaults))
      .finally(() => setLoading(false));
  }, []);

  const change = (name: string, value: string) => setData((current) => ({ ...current, [name]: value }));

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      const payload = { ...defaults, ...data };
      await saveCompanySettings(payload, recordId);
      setData(payload);
      setMsg("Configurações salvas com sucesso.");
      setTimeout(() => setMsg(""), 2600);
    } catch (e: any) {
      setMsg(e.message || "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Toast message={msg} tone={msg.includes("Não") ? "error" : "success"} />
      <PageHeader title="Configurações" subtitle="Dados institucionais usados em relatórios, recibos e documentos do MW TECH Control." />

      <form onSubmit={save} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4">
          {sections.map(({ title, icon: Icon, fields }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_7px_20px_rgba(15,23,42,.04)] sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-slate-50 text-[#315a82]"><Icon size={18} /></span>
                <div><h3 className="text-[15px] font-semibold text-[#0b2239]">{title}</h3><p className="mt-0.5 text-[11px] text-slate-400">Informações administrativas da MW TECH.</p></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map(([name, label]) => (
                  <label key={name} className="text-[12px] font-medium text-slate-600">
                    {label}
                    <input
                      name={name}
                      value={data[name] || ""}
                      onChange={(e) => change(name, e.target.value)}
                      disabled={loading}
                      className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[14px] font-normal text-[#172b3f] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_7px_20px_rgba(15,23,42,.04)] sm:p-6">
            <label className="text-[12px] font-medium text-slate-600">Logo do sistema
              <input name="logo_url" value={data.logo_url || ""} onChange={(e) => change("logo_url", e.target.value)} className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 px-3.5 text-[14px] font-normal text-[#172b3f] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
            </label>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_7px_20px_rgba(15,23,42,.04)]">
          <p className="text-[11px] font-medium uppercase tracking-[.14em] text-slate-400">Pré-visualização</p>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-5">
            <img src={data.logo_url || defaults.logo_url} alt="MW TECH" className="h-14 w-40 object-contain object-left" />
            <h3 className="mt-5 text-[18px] font-semibold text-[#0b2239]">{data.nome_empresa || defaults.nome_empresa}</h3>
            <p className="mt-1 text-[12px] text-slate-500">{data.razao_social || defaults.razao_social}</p>
            <div className="mt-5 space-y-3 text-[12px] text-slate-500">
              <p className="flex gap-2"><Building2 size={15} className="mt-0.5 text-[#315a82]" /> CNPJ: {data.cnpj || defaults.cnpj}</p>
              <p className="flex gap-2"><MapPin size={15} className="mt-0.5 text-[#315a82]" /> {[data.endereco, data.cidade, data.estado].filter(Boolean).join(" · ")}</p>
              <p className="flex gap-2"><Mail size={15} className="mt-0.5 text-[#315a82]" /> {data.email || defaults.email}</p>
              <p className="flex gap-2"><Phone size={15} className="mt-0.5 text-[#315a82]" /> {data.telefone || "Telefone não informado"}</p>
              <p className="flex gap-2"><Landmark size={15} className="mt-0.5 text-[#315a82]" /> {data.banco || defaults.banco} · Ag. {data.agencia || defaults.agencia} · Conta {data.conta || defaults.conta}</p>
            </div>
          </div>
          <button type="submit" disabled={busy || loading} className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0b2239] px-5 text-[13px] font-medium text-white transition hover:bg-[#123653] disabled:cursor-not-allowed disabled:opacity-50"><Save size={17} />{busy ? "Salvando..." : "Salvar configurações"}</button>
          <p className="mt-3 text-center text-[10px] text-slate-400">As alterações são aplicadas aos documentos e relatórios do sistema.</p>
        </aside>
      </form>
    </div>
  );
}
