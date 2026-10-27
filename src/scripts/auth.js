// Login da Redação pelo Supabase Auth (e-mail e senha). A sessão fica guardada
// neste navegador pelo próprio cliente do Supabase.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "../lib/supabase.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const base = document.body.dataset.base ?? "";
export const pages = { entrar: `${base}/entrar/`, cadastro: `${base}/cadastro/`, painel: `${base}/painel/` };

// Mensagens do Supabase em português, pelo código do erro.
const messages = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Falta confirmar o e-mail. Abra o link que mandamos na sua caixa de entrada (olhe o spam também).",
  user_already_exists: "Já existe uma conta com esse e-mail. Tente entrar.",
  email_exists: "Já existe uma conta com esse e-mail. Tente entrar.",
  weak_password: "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.",
  over_email_send_rate_limit: "Muitos e-mails enviados agora há pouco. Espere alguns minutos e tente de novo.",
  over_request_rate_limit: "Muitas tentativas seguidas. Espere um pouco e tente de novo.",
  signup_disabled: "O cadastro está fechado no momento.",
  validation_failed: "Confira o e-mail digitado.",
};
export const authMessage = (error) => messages[error?.code] ?? (error?.status ? `Não deu certo: ${error.message}` : "Não deu pra falar com o servidor agora. Tenta de novo em instantes.");

export async function currentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Treme o formulário quando dá erro.
export function shake(form) {
  form.classList.remove("shake");
  void form.offsetWidth;
  form.classList.add("shake");
}
