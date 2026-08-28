import { Landmark } from "lucide-react";

const banks: Record<string, { label: string; className: string }> = {
  "001": { label: "BB", className: "bg-[#f7c600] text-[#153c8a]" },
  "104": { label: "CX", className: "bg-[#0066b3] text-white" },
  "260": { label: "NU", className: "bg-[#820ad1] text-white" },
  "237": { label: "BR", className: "bg-[#cc092f] text-white" },
  "341": { label: "IT", className: "bg-[#ff7200] text-white" },
  "033": { label: "ST", className: "bg-[#e60000] text-white" },
};

const byName: Array<[RegExp, { label: string; className: string }]> = [
  [/brasil/i, banks["001"]],
  [/caixa/i, banks["104"]],
  [/nubank|nu pagamentos/i, banks["260"]],
  [/bradesco/i, banks["237"]],
  [/itau|itaú/i, banks["341"]],
  [/santander/i, banks["033"]],
];

export function BankLogo({ code, name, size = "md" }: { code?: string; name?: string; size?: "sm" | "md" | "lg" }) {
  const bank = banks[String(code || "").padStart(3, "0")] || byName.find(([rx]) => rx.test(name || ""))?.[1];
  const box = size === "lg" ? "size-16 rounded-2xl text-base" : size === "sm" ? "size-10 rounded-xl text-xs" : "size-12 rounded-xl text-sm";
  if (bank) {
    return <span className={`grid shrink-0 place-items-center font-black shadow-sm ${box} ${bank.className}`}>{bank.label}</span>;
  }
  const initials = (name || "Banco").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
  return (
    <span className={`grid shrink-0 place-items-center bg-slate-100 font-black text-slate-600 shadow-sm ${box}`}>
      {initials || <Landmark size={size === "lg" ? 28 : 20} />}
    </span>
  );
}
