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
  {
    title: "Identificação",
    icon: Building2,
    fields: [
      ["nome_empresa", "Nome fantasia"],
      ["razao_social", "Razão social"],
      ["cnpj", "CNPJ"],
    ],
  },
  {
    title: "Contato e endereço",
    icon: MapPin,
    fields: [
      ["telefone", "Telefone"],
      ["email", "E-mail"],
      ["endereco", "Endereço"],
      ["cidade", "Cidade"],
      ["estado", "Estado"],
      ["cep", "CEP"],
    ],
  },
  {
    title: "Dados financeiros",
    icon: Landmark,
    fields: [
      ["pix", "Chave Pix"],
      ["banco", "Banco"],
      ["agencia", "Agência"],
      ["conta", "Conta"],
    ],
  },
] as const;

export default function Settings() {
  const [data, setData] = useState<Record<string, string>>(defaults);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCompanySettings()
      .then((value: any) => setData({ ...defaults, ...value }))
      .catch(() => setData(defaults));
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      const value = { ...defaults, ...Object.fromEntries(new FormData(e.currentTarget)) };
      await saveCompanySettings(value, data.id);
      setData(value as Record<string, string>);
      setMsg("Configurações salvas com sucesso.");
      setTimeout(() => setMsg(""), 2600);
    } catch (e: any) {
      setMsg(e.message || "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      <Toast message={msg} tone={msg.includes("Não") ? "error" : "success"} />
      <PageHeader
        title="Configurações"
        subtitle="Dados usados nos relatórios, recibos, cabeçalhos e documentos do sistema."
      />

      <form onSubmit={save} className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          {sections.map(({ title, icon: Icon, fields }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-[#0b2b66]">
                  <Icon size={20} />
                </span>
                <h3 className="text-lg font-black text-[#061426]">{title}</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map(([name, label]) => (
                  <label key={name} className="text-sm font-bold text-slate-600">
                    {label}
                    <input
                      name={name}
                      defaultValue={data[name] || ""}
                      className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 px-3 text-[15px] font-semibold text-[#061426] outline-none focus:border-blue-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="text-sm font-bold text-slate-600">
              Logo URL
              <input
                name="logo_url"
                defaultValue={data.logo_url || defaults.logo_url}
                className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 px-3 text-[15px] font-semibold text-[#061426] outline-none focus:border-blue-500"
              />
            </label>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <img src={data.logo_url || defaults.logo_url} alt="MW TECH" className="h-16 w-44 object-contain object-left" />
            <h3 className="mt-5 text-xl font-black text-[#061426]">{data.nome_empresa || defaults.nome_empresa}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">{data.razao_social || defaults.razao_social}</p>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <p className="flex gap-2"><Building2 size={16} className="mt-0.5 text-[#0b2b66]" /> CNPJ: {data.cnpj || defaults.cnpj}</p>
              <p className="flex gap-2"><MapPin size={16} className="mt-0.5 text-[#0b2b66]" /> {[data.endereco, data.cidade, data.estado].filter(Boolean).join(" · ")}</p>
              <p className="flex gap-2"><Mail size={16} className="mt-0.5 text-[#0b2b66]" /> {data.email || defaults.email}</p>
              <p className="flex gap-2"><Phone size={16} className="mt-0.5 text-[#0b2b66]" /> {data.telefone || "Telefone não informado"}</p>
              <p className="flex gap-2"><Landmark size={16} className="mt-0.5 text-[#0b2b66]" /> {data.banco || defaults.banco} · Ag. {data.agencia || defaults.agencia} · Conta {data.conta || defaults.conta}</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[#061426] bg-[#061426] px-5 text-[14px] font-black text-white shadow-[0_10px_22px_rgba(6,20,38,.18)] transition hover:bg-[#082b50] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={18} />
            {busy ? "Salvando..." : "Salvar configurações"}
          </button>
        </aside>
      </form>
    </div>
  );
}
