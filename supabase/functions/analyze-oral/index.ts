import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Hachage IP (RGPD-friendly : pseudonymisation, jamais stockée en clair) ──
// On hash l'IP avec un sel secret pour qu'elle soit non-réversible.
// Seuls les 16 premiers caractères du hex sont conservés (suffisant pour l'anti-abus).
async function hashIp(ip: string): Promise<string> {
    const salt = Deno.env.get('IP_HASH_SALT') ?? 'auditio-default-salt-v1';
    const data = new TextEncoder().encode(ip + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32); // 32 chars hex = 128 bits, suffisant
}

// ─── Extraction IP depuis les headers Supabase / Cloudflare ──────────────────
function extractIp(req: Request): string | null {
    // Cloudflare (priorité haute)
    const cf = req.headers.get('cf-connecting-ip');
    if (cf) return cf.trim();
    // Supabase / proxies standards
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    // Fallback
    const realIp = req.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
    return null;
}

const GUEST_SCHEMA = {
    type: "OBJECT",
    properties: {
        globalScore: {
            type: "NUMBER",
            description: "Note globale de l'oral sur 20 (décimal, ex: 13.5)"
        },
        pointCle: {
            type: "STRING",
            description: "Une seule phrase d'accroche constructive (max 140 caractères), sans rire ni moquerie."
        },
        radarData: {
            type: "ARRAY",
            description: "Exactement 5 critères d'évaluation",
            items: {
                type: "OBJECT",
                properties: {
                    subject: { type: "STRING", description: "Nom du critère (Clarté, Structure, Confiance, Vocabulaire, Pertinence)" },
                    A: { type: "NUMBER", description: "Score sur 20 pour ce critère" },
                    fullMark: { type: "NUMBER", description: "Toujours 20" }
                },
                required: ["subject", "A", "fullMark"]
            }
        }
    },
    required: ["globalScore", "pointCle", "radarData"]
};

const FULL_SCHEMA = {
    type: "OBJECT",
    properties: {
        globalScore: { type: "NUMBER", description: "Score global sur 100" },
        globalScoreExplanation: { type: "STRING", description: "Explication détaillée justifiant la note globale attribuée" },
        fillerWords: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Liste des tics de langage détectés (ex: euh, du coup, en fait)"
        },
        radarData: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    subject: { type: "STRING", description: "Nom du critère (ex: Clarté, Pertinence, Confiance, Vocabulaire, Structure)" },
                    A: { type: "NUMBER", description: "Score sur 100 pour ce critère" },
                    fullMark: { type: "NUMBER", description: "Toujours 100" },
                    explanation: { type: "STRING", description: "Justification détaillée de la note attribuée pour ce critère" }
                },
                required: ["subject", "A", "fullMark", "explanation"]
            },
            description: "Données pour le graphique radar (5 critères obligatoires)"
        },
        feedback: { type: "STRING", description: "Commentaire global du jury, adapté à l'attitude demandée." },
        contentSuggestions: { type: "STRING", description: "Pistes d'améliorations sur le fond." },
        questions: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Liste de 3 questions (soit pièges, soit d'approfondissement) que le jury posera pour déstabiliser ou challenger le candidat sur sa présentation."
        }
    },
    required: ["globalScore", "globalScoreExplanation", "fillerWords", "radarData", "feedback", "contentSuggestions", "questions"]
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
        if (!GEMINI_API_KEY) {
            return new Response(
                JSON.stringify({ error: 'Clé API Gemini non configurée côté serveur.' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { type, transcript, juryType, subject, device_id } = await req.json();

        if (!type || !['guest', 'full'].includes(type) || typeof transcript !== 'string') {
            return new Response(
                JSON.stringify({ error: 'Paramètres invalides.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // --- RATE LIMITING ---
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
        let user_id = null;
        let is_pro = false;

        if (authHeader) {
            const supabaseAuth = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                { global: { headers: { Authorization: authHeader } } }
            );
            const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
            if (userError) {
                console.error("Auth Error:", userError);
            }
            if (user) {
                user_id = user.id;
                const { data: profile } = await supabaseAdmin.from('profiles').select('is_pro').eq('id', user_id).single();
                is_pro = profile?.is_pro ?? false;
            } else {
                console.log("No user returned from getUser()");
            }
        } else {
            console.log("No auth header provided");
        }

        const maxSessions = is_pro ? 50 : (user_id ? 3 : 1);
        const timeAgo = new Date();
        timeAgo.setHours(timeAgo.getHours() - 24);

        let usageCount = 0;

        if (user_id) {
            // ── Utilisateur connecté : quota par user_id (le plus robuste)
            const { count, error } = await supabaseAdmin.from('usage_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user_id)
                .gte('created_at', timeAgo.toISOString());
            if (error) console.error("Usage count error (user):", error);
            usageCount = count ?? 0;
        } else if (device_id) {
            // ── Visiteur non-connecté : quota composite device_id + IP hashée
            const rawIp = extractIp(req);
            const ipHash = rawIp ? await hashIp(rawIp) : null;

            console.log(`[guest] device_id=${device_id}, ip_present=${!!rawIp}, ip_hash=${ipHash?.substring(0, 8)}...`);

            // Compter par device_id
            const { count: deviceCount, error: deviceErr } = await supabaseAdmin.from('usage_logs')
                .select('*', { count: 'exact', head: true })
                .eq('device_id', device_id)
                .is('user_id', null)
                .gte('created_at', timeAgo.toISOString());
            if (deviceErr) console.error("Usage count error (device):", deviceErr);

            // Compter par IP hashée (si disponible)
            let ipCount = 0;
            if (ipHash) {
                const { count: ipUsage, error: ipErr } = await supabaseAdmin.from('usage_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('ip_hash', ipHash)
                    .is('user_id', null)
                    .gte('created_at', timeAgo.toISOString());
                if (ipErr) console.error("Usage count error (ip_hash):", ipErr);
                ipCount = ipUsage ?? 0;
            }

            // On prend le MAX des deux pour être le plus restrictif
            usageCount = Math.max(deviceCount ?? 0, ipCount);

            if (ipCount > (deviceCount ?? 0)) {
                console.log(`[guest] Quota IP (${ipCount}) > quota device (${deviceCount}) → bypass détecté`);
            }
        }

        if (usageCount >= maxSessions) {
            return new Response(
                JSON.stringify({ error: 'RATE_LIMIT_REACHED', remaining: 0, max: maxSessions }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        // ---------------------

        let prompt: string;
        let responseSchema: object;

        if (type === 'guest') {
            const textContent = transcript.trim().length >= 2 ? transcript : '(aucune transcription)';
            prompt = `Tu es un jury d'examen oral professionnel et sérieux. Ton attitude est: ${juryType}.\nLe candidat a indiqué que le sujet de son oral est : "${subject || 'Non précisé'}".\nAnalyse la transcription ci-dessous. Même si elle est courte, fournis une analyse crédible basée sur ce que tu entends.\nIMPORTANT : Reste sérieux et professionnel.\nDonne : une note sur 20, une phrase d'accroche percutante, et 5 scores de compétences.\n\nTranscription:\n"""\n${textContent}\n"""`;
            responseSchema = GUEST_SCHEMA;
        } else {
            prompt = `Tu es un jury d'examen oral. Ton attitude est: ${juryType}.\nLe candidat a indiqué que le sujet de son oral est : "${subject || 'Non précisé'}".\nAnalyse cette transcription d'un oral d'étudiant et fournis un rapport détaillé incluant impérativement 3 questions pièges ou de réflexion que le jury posera suite à cet exposé.\nTranscription: "${transcript}"`;
            responseSchema = FULL_SCHEMA;
        }

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        responseSchema,
                    },
                }),
            }
        );

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            throw new Error(`Gemini API error ${geminiRes.status}: ${errText}`);
        }

        const geminiData = await geminiRes.json();
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('Réponse vide de Gemini.');
        }

        // --- INSERT LOG ON SUCCESS (avec ip_hash pour les guests) ---
        const rawIpForLog = !user_id ? extractIp(req) : null;
        const ipHashForLog = rawIpForLog ? await hashIp(rawIpForLog) : null;

        await supabaseAdmin.from('usage_logs').insert({
            user_id: user_id,
            device_id: device_id || null,
            ip_hash: ipHashForLog, // null pour les connectés (non nécessaire)
        });
        // -----------------------------

        const result = JSON.parse(text);

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        console.error('[analyze-oral] Erreur:', message);
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
