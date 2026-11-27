// Accès au modèle de langage, partagé par le tuteur (W-05) et l'assistant de cours.
//
// Fournisseur : Gemini (GEMINI_API_KEY, palier gratuit) ou Claude (ANTHROPIC_API_KEY), au choix via TUTOR_PROVIDER
// (« gemini », « claude » ou « none »). Par défaut, le premier dont la clé est présente.
import Anthropic from '@anthropic-ai/sdk';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export type Provider = 'gemini' | 'claude';

const CLAUDE_MODEL = 'claude-opus-5-5';
// Identifiant à vérifier dans AI Studio (liste des modèles) : surchargeable sans toucher au code.
const geminiModel = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

/** Fournisseur actif : choix explicite, sinon le premier dont la clé est présente ; `null` : pas d'IA. */
export function providerInUse(): Provider | null {
  const wanted = (process.env.TUTOR_PROVIDER ?? '').toLowerCase();
  if (wanted === 'none') return null;
  if (wanted === 'gemini') return process.env.GEMINI_API_KEY ? 'gemini' : null;
  if (wanted === 'claude') return process.env.ANTHROPIC_API_KEY ? 'claude' : null;
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  return null;
}

/** Gemini : API REST, clé dans l'en-tête (jamais dans l'URL, qui finit dans les journaux). */
async function askGemini(system: string, turns: Turn[], maxTokens: number, schema?: object): Promise<string | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel())}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: schema ? 0.7 : 0.4,
        ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return (
    parts
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('')
      .trim() || null
  );
}

/** Claude : un refus de sécurité donne `null`. */
async function askClaude(system: string, turns: Turn[], maxTokens: number, schema?: object): Promise<string | null> {
  const response = await new Anthropic().beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' }, // réponses courtes : inutile de réfléchir longtemps
    system: schema ? `${system}

Réponds uniquement avec un objet JSON valide, sans texte autour ni bloc de code.` : system,
    messages: turns,
  });
  if (response.stop_reason === 'refusal') return null;
  return (
    response.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('\n')
      .trim() || null
  );
}

/**
 * Génère une réponse (si `schema` est donné : du JSON conforme, à analyser avec `parseJson`). `null` : pas de fournisseur configuré, ou réponse vide / refusée.
 * Lève une erreur si l'appel échoue (quota, réseau, clé ou modèle invalide…) : à l'appelant de prévoir un repli.
 */
export async function generate(system: string, turns: Turn[], maxTokens = 2000, schema?: object): Promise<string | null> {
  const provider = providerInUse();
  if (!provider) return null;
  try {
    return await (provider === 'gemini' ? askGemini(system, turns, maxTokens, schema) : askClaude(system, turns, maxTokens, schema));
  } catch (e) {
    const detail = e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e instanceof Error ? e.message : String(e);
    console.error(`IA (${provider}) indisponible :`, detail);
    throw new Error(detail);
  }
}

/** Analyse une réponse JSON du modèle, même entourée d'un bloc de code ; `null` si elle n'est pas du JSON valide. */
export function parseJson(text: string | null): unknown {
  if (!text) return null;
  const body = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
