import { supabase } from "./supabase";
export type Account = {
  id: string;
  nome: string;
  tipo_conta: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  saldo_inicial: number;
  saldo_atual: number;
  ativo: boolean;
};
export type Movement = {
  id: string;
  tipo: string;
  data: string;
  descricao: string;
  valor: number;
  observacao?: string;
  created_at: string;
  contas_bancarias?: { nome: string } | null;
  categorias_financeiras?: { nome: string } | null;
};
export const getAccounts = async () => {
  const { data, error } = await supabase
    .from("contas_bancarias")
    .select("*")
    .order("nome");
  if (error) throw error;
  return data as Account[];
};
export const getMovements = async (limit = 100) => {
  const { data, error } = await supabase
    .from("movimentacoes_financeiras")
    .select("*,contas_bancarias(nome),categorias_financeiras(nome)")
    .order("data", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as Movement[];
};
export const registerMovement = async (values: any) => {
  const { data, error } = await supabase.rpc("registrar_movimentacao", {
    p_tipo: values.tipo,
    p_data: values.data,
    p_descricao: values.descricao,
    p_conta_id: values.conta_id,
    p_valor: Number(values.valor),
    p_categoria_id: values.categoria_id || null,
    p_observacao: values.observacao || null,
    p_comprovante_url: values.comprovante_url || null,
    p_conta_destino_id: values.conta_destino_id || null,
  });
  if (error) throw error;
  return data;
};
export async function uploadReceipt(file: File) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");
  const ext = file.name.split(".").pop();
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("comprovantes")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}
