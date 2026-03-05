import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Quota journalier en secondes pour un connecté non-pro
const DAILY_QUOTA_SECONDS = 10 * 60; // 10 minutes

// ─── Hachage IP (RGPD-friendly : pseudonymisation, jamais stockée en clair) ──
async function hashIp(ip: string): Promise<string> {
    const salt = Deno.env.get('IP_HASH_SALT');
    if (!salt) {
        console.error('[security] IP_HASH_SALT secret is not configured!');
        // Use a runtime-derived fallback instead of a hardcoded value visible in source code
        const fallback = Deno.env.get('SUPABASE_URL') ?? 'emergency-fallback';
        const fallbackData = new TextEncoder().encode(ip + fallback);
        const fb = await crypto.subtle.digest('SHA-256', fallbackData);
        return Array.from(new Uint8Array(fb)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
    }
    const data = new TextEncoder().encode(ip + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32);
}

// ─── Extraction IP depuis les headers Supabase / Cloudflare ──────────────────
function extractIp(req: Request): string | null {
    const cf = req.headers.get('cf-connecting-ip');
    if (cf) return cf.trim();
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const realIp = req.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
    return null;
}

// Auto-nettoyage : supprime les entrées de plus de 7 jours (probabiliste ~1%)
async function maybeCleanup(supabaseAdmin: SupabaseClient) {
    if (Math.random() > 0.01) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    await supabaseAdmin
        .from("daily_quota_usage")
        .delete()
        .lt("usage_date", cutoff.toISOString().split("T")[0]);
}

Deno.serve(async (req: Request) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };

    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // verify_jwt: true — Supabase vérifie le JWT automatiquement avant d'arriver ici.
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const userId = user.id;

    if (req.method === "POST") {
        let body: { action?: string, seconds_used?: number, device_id?: string };
        try {
            body = await req.json();
        } catch {
            return new Response(JSON.stringify({ error: "Corps JSON invalide" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!body.device_id) {
            return new Response(JSON.stringify({ error: "device_id manquant" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const deviceId = body.device_id;
        const action = body.action || "check";

        // ── Calcul IP hash (troisième axe de contrôle pour les connectés free) ──
        // Note : pour les connectés, le userId reste le verrou principal.
        // L'IP ajoute une protection si quelqu'un crée plusieurs comptes.
        const rawIp = extractIp(req);
        const ipHash = rawIp ? await hashIp(rawIp) : null;

        // ── action: 'check' ── (vérifie le quota restant)
        if (action === "check") {
            // Quota par userId
            const { data: userData, error: userDbError } = await supabaseAdmin
                .from("daily_quota_usage")
                .select("seconds_used")
                .eq("entity_id", userId)
                .eq("entity_type", "user")
                .eq("usage_date", today)
                .maybeSingle();
            if (userDbError) throw userDbError;

            // Quota par device_id
            const { data: devData, error: devDbError } = await supabaseAdmin
                .from("daily_quota_usage")
                .select("seconds_used")
                .eq("entity_id", deviceId)
                .eq("entity_type", "device")
                .eq("usage_date", today)
                .maybeSingle();
            if (devDbError) throw devDbError;

            // Quota par IP hashée (protection multi-comptes)
            let ipData: { seconds_used: number } | null = null;
            if (ipHash) {
                const { data: ipRow, error: ipDbError } = await supabaseAdmin
                    .from("daily_quota_usage")
                    .select("seconds_used")
                    .eq("entity_id", ipHash)
                    .eq("entity_type", "ip_hash")
                    .eq("usage_date", today)
                    .maybeSingle();
                if (ipDbError) console.error("[quota] IP hash DB error:", ipDbError);
                else ipData = ipRow;
            }

            const uSecs = userData?.seconds_used ?? 0;
            const dSecs = devData?.seconds_used ?? 0;
            const iSecs = ipData?.seconds_used ?? 0;
            // On prend le max des 3 axes pour être le plus restrictif
            const maxUsed = Math.max(uSecs, dSecs, iSecs);
            const secondsLeft = Math.max(0, DAILY_QUOTA_SECONDS - maxUsed);

            if (iSecs > uSecs && iSecs > dSecs) {
                console.log(`[quota] IP axis (${iSecs}s) > user (${uSecs}s) & device (${dSecs}s) → possible multi-account`);
            }

            await maybeCleanup(supabaseAdmin);

            return new Response(
                JSON.stringify({
                    seconds_used: maxUsed,
                    seconds_left: secondsLeft,
                    daily_quota: DAILY_QUOTA_SECONDS,
                    quota_reached: secondsLeft === 0,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ── action: 'record' ── (enregistre la durée utilisée)
        if (action === "record") {
            const secondsToAdd = Math.min(
                Math.max(0, Math.round(body.seconds_used ?? 0)),
                DAILY_QUOTA_SECONDS
            );

            if (secondsToAdd <= 0) {
                return new Response(JSON.stringify({ ok: true, seconds_used: 0 }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Enregistrement userId + deviceId (existant)
            const { data, error } = await supabaseAdmin.rpc("increment_quota_usage", {
                p_user_id: userId,
                p_device_id: deviceId,
                p_date: today,
                p_seconds: secondsToAdd,
                p_max: DAILY_QUOTA_SECONDS,
            });

            if (error) {
                console.error("RPC Error:", error.message);
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Enregistrement par IP hashée
            if (ipHash) {
                // Incrément propre via RPC dédiée (évite les race conditions et les remises à zéro)
                try {
                    await supabaseAdmin.rpc("increment_ip_quota_usage", {
                        p_ip_hash: ipHash,
                        p_date: today,
                        p_seconds: secondsToAdd,
                        p_max: DAILY_QUOTA_SECONDS,
                    });
                } catch (e) {
                    console.error("[quota] increment_ip_quota_usage error:", e);
                }
            }

            return new Response(
                JSON.stringify({ ok: true, quota_data: data }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(JSON.stringify({ error: "Action inconnue" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ error: "Méthode non supportée" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
});
