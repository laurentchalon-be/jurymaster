import React, { useState, useEffect, useCallback } from "react";
import {
  Award,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Target,
  MessageSquare,
  Lightbulb,
  AlertCircle,
  CheckCircle,
  BarChart2,
  RefreshCw,
  HelpCircle,
  Crown,
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { supabase } from "@/lib/supabase";

// ── Hook : détection réactive du dark mode ────────────────────────────────────
// MutationObserver surveille la classe 'dark' sur <html> et force un re-render
// à chaque toggle, pour que les inline styles se mettent à jour.
function useDarkMode() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return dark;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RadarPoint {
  subject: string;
  A: number;
  fullMark: number;
  explanation?: string;
}

interface SessionRecord {
  id: string;
  subject_name: string;
  transcript: string | null;
  score_global: number | null;
  analysis_json: {
    globalScoreExplanation?: string;
    fillerWords?: string[];
    radarData?: RadarPoint[];
    feedback?: string;
    contentSuggestions?: string;
    juryType?: string;
    questions?: string[];
  } | null;
  created_at: string;
}

interface DashboardProps {
  isPro: boolean;
  refreshTrigger?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getScoreColor(score: number) {
  if (score >= 80)
    return {
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      ring: "#10b981",
      label: "🏆 Excellent",
    };
  if (score >= 65)
    return {
      text: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
      ring: "#3b82f6",
      label: "✅ Très bien",
    };
  if (score >= 50)
    return {
      text: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      ring: "#f59e0b",
      label: "📈 Bien",
    };
  return {
    text: "text-red-500",
    bg: "bg-red-50",
    border: "border-red-200",
    ring: "#ef4444",
    label: "⚠️ À travailler",
  };
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function TrendIcon({
  current,
  previous,
}: {
  current: number;
  previous?: number;
}) {
  if (previous === undefined) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 2) return <Minus className="w-4 h-4 text-slate-400" />;
  if (diff > 0) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  return <TrendingDown className="w-4 h-4 text-red-400" />;
}

// ── Custom Tooltip Radar ──────────────────────────────────────────────────────

function RadarTooltip({ active, payload }: any) {
  const dark = useDarkMode();
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: dark ? "#1e293b" : "#ffffff",
          border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
          borderRadius: "12px",
          padding: "8px 12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          fontSize: "12px",
        }}
      >
        <p style={{ fontWeight: 600, color: dark ? "#f1f5f9" : "#334155" }}>
          {d.subject}
        </p>
        <p style={{ color: "#6366f1", fontWeight: 700 }}>
          Ma perf. : {d.A}/100
        </p>
        {d.B !== undefined && (
          <p style={{ color: "#64748b", fontWeight: 500 }}>
            Moyenne Auditio : {d.B}/100
          </p>
        )}
        {d.explanation && (
          <p
            style={{
              color: dark ? "#94a3b8" : "#64748b",
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {d.explanation}
          </p>
        )}
      </div>
    );
  }
  return null;
}

// ── Carte de session individuelle ─────────────────────────────────────────────

function SessionCard({
  session,
  index,
  isFirst,
  previousScore,
  averageRadar,
  isPro,
}: {
  session: SessionRecord;
  index: number;
  isFirst: boolean;
  previousScore?: number;
  averageRadar: any[] | null;
  isPro: boolean;
}) {
  const [expanded, setExpanded] = useState(isFirst);
  const dark = useDarkMode();
  const score = session.score_global ?? 0;
  const palette = getScoreColor(score);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const analysis = session.analysis_json;

  const mergedRadarData = React.useMemo(() => {
    if (!analysis?.radarData) return undefined;
    if (!isPro || !averageRadar) return analysis.radarData;

    return analysis.radarData.map((d) => {
      const avg = averageRadar.find((a) => a.subject === d.subject);
      return {
        ...d,
        B: avg ? avg.B : undefined,
      };
    });
  }, [analysis?.radarData, averageRadar, isPro]);

  return (
    <div
      className={`bg-white rounded-3xl shadow-sm border transition-all duration-300 ${expanded ? "border-blue-200 shadow-blue-50" : "border-slate-200"}`}
    >
      {/* Header cliquable */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50/60 rounded-3xl transition-colors"
      >
        {/* Score ring compact */}
        <div className="relative flex-shrink-0">
          <svg className="w-[76px] h-[76px] -rotate-90" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r={radius}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="8"
            />
            <circle
              cx="48"
              cy="48"
              r={radius}
              fill="none"
              stroke={palette.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${progress} ${circumference}`}
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-slate-900 leading-none tabular-nums">
              {score}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">/100</span>
          </div>
        </div>

        {/* Infos session */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 truncate text-sm">
              {session.subject_name?.trim() || "Session libre"}
            </h3>
            <span
              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${palette.bg} ${palette.text} ${palette.border}`}
            >
              {palette.label}
            </span>
            {index === 0 && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                Dernière session
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(session.created_at)}
            </span>
            {analysis?.juryType && (
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                Jury {analysis.juryType}
              </span>
            )}
          </div>
        </div>

        {/* Tendance + chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <TrendIcon current={score} previous={previousScore} />
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Détail expandable */}
      {expanded && analysis && (
        <div className="px-5 pb-6 space-y-5 border-t border-slate-100">
          {/* Explication score global */}
          {analysis.globalScoreExplanation && (
            <div className="pt-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                ✨ Bilan global
              </p>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-2xl p-4 border border-slate-100">
                {analysis.globalScoreExplanation}
              </p>
            </div>
          )}

          {/* Radar + Détail côte à côte */}
          {analysis.radarData && analysis.radarData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Radar */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  Profil de compétences
                </p>
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3 h-[230px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="70%"
                      data={mergedRadarData}
                    >
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{
                          fill: "#64748b",
                          fontSize: 10,
                          fontWeight: 500,
                        }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={false}
                        axisLine={false}
                      />
                      {isPro && averageRadar && (
                        <Radar
                          name="Moyenne Auditio"
                          dataKey="B"
                          stroke="#94a3b8"
                          fill="#94a3b8"
                          fillOpacity={0.1}
                          strokeWidth={2}
                          strokeDasharray="4 4"
                        />
                      )}
                      <Radar
                        name="Ma performance"
                        dataKey="A"
                        stroke={palette.ring}
                        fill={palette.ring}
                        fillOpacity={0.18}
                        strokeWidth={2}
                      />
                      <Tooltip content={<RadarTooltip />} />
                      {isPro && averageRadar && (
                        <Legend
                          wrapperStyle={{ fontSize: 10, paddingTop: "10px" }}
                        />
                      )}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Critères */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  Détail par critère
                </p>
                <div className="space-y-2.5">
                  {analysis.radarData.map((d) => {
                    const c = getScoreColor(d.A);
                    return (
                      <div
                        key={d.subject}
                        className="bg-slate-50 rounded-xl p-3 border border-slate-100"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-slate-700">
                            {d.subject}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${c.bg} ${c.text}`}
                          >
                            {d.A}/100
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1">
                          <div
                            className="h-1 rounded-full transition-all duration-700"
                            style={{
                              width: `${d.A}%`,
                              backgroundColor: c.ring,
                            }}
                          />
                        </div>
                        {d.explanation && (
                          <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                            {d.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Feedback jury + Tics de langage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.feedback && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Retour du jury
                </p>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  {analysis.feedback}
                </p>
              </div>
            )}

            {analysis.fillerWords !== undefined && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Tics de langage
                </p>
                {analysis.fillerWords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {analysis.fillerWords.map((w, i) => (
                      <span
                        key={i}
                        style={{
                          backgroundColor: dark
                            ? "rgba(161,98,7,0.2)"
                            : "#fffbeb",
                          color: dark ? "#fcd34d" : "#b45309",
                          border: `1px solid ${dark ? "rgba(161,98,7,0.35)" : "#fde68a"}`,
                          borderRadius: "8px",
                          padding: "4px 10px",
                          fontSize: "12px",
                          fontWeight: 500,
                        }}
                      >
                        "{w}"
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-xl text-xs font-medium border border-emerald-100">
                    <CheckCircle className="w-4 h-4" />
                    Aucun tic détecté !
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pistes d'amélioration */}
          {analysis.contentSuggestions && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5" />
                Pistes d'amélioration
              </p>
              <p
                className="text-sm leading-relaxed rounded-2xl p-4 whitespace-pre-wrap"
                style={{
                  backgroundColor: dark
                    ? "rgba(161,98,7,0.1)"
                    : "rgba(255,251,235,0.5)",
                  color: dark ? "#cbd5e1" : "#374151",
                  border: dark
                    ? "1px solid rgba(161,98,7,0.25)"
                    : "1px solid #fde68a",
                }}
              >
                {analysis.contentSuggestions}
              </p>
            </div>
          )}

          {/* Module Questions du Jury (Pro uniquement) */}
          {isPro && analysis.questions && analysis.questions.length > 0 && (
            <div className="pt-5 border-t border-slate-100 mt-5">
              <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                Questions possibles du jury
              </p>
              <ul className="space-y-3">
                {analysis.questions.map((q: string, i: number) => (
                  <li
                    key={i}
                    className={`p-4 rounded-xl text-sm leading-relaxed font-semibold transition-colors ${dark ? "bg-indigo-900/30 text-indigo-200 border border-indigo-800/50 hover:bg-indigo-900/40" : "bg-indigo-50 text-indigo-900 border border-indigo-100 hover:bg-indigo-100/70"}`}
                  >
                    <span className="font-bold mr-2 text-indigo-600 dark:text-indigo-400">
                      Q{i + 1}.
                    </span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Graphique progression (Pro uniquement) ─────────────────────────────────────

function ProgressionChart({ sessions }: { sessions: SessionRecord[] }) {
  const dark = useDarkMode();
  const data = [...sessions].reverse().map((s, i) => ({
    name: formatShortDate(s.created_at),
    score: s.score_global ?? 0,
    session: i + 1,
  }));

  if (data.length < 2) return null;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
      <h3 className="text-slate-900 font-semibold mb-4 flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-indigo-500" />
        Progression sur {data.length} sessions
      </h3>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                return (
                  <div
                    style={{
                      backgroundColor: dark ? "#1e293b" : "#ffffff",
                      border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
                      borderRadius: "12px",
                      padding: "8px 12px",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                      fontSize: "12px",
                    }}
                  >
                    <p
                      style={{
                        color: dark ? "#94a3b8" : "#64748b",
                        marginBottom: 2,
                      }}
                    >
                      {label}
                    </p>
                    <p style={{ color: "#6366f1", fontWeight: 700 }}>
                      Score : {payload[0].value}/100
                    </p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ fill: "#6366f1", r: 4, strokeWidth: 2, stroke: "#fff" }}
              activeDot={{
                r: 6,
                stroke: "#6366f1",
                strokeWidth: 2,
                fill: "#fff",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Composant principal Dashboard ─────────────────────────────────────────────

export default function Dashboard({ isPro, refreshTrigger }: DashboardProps) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [averageRadar, setAverageRadar] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const limit = isPro ? 10 : 1;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from("sessions")
        .select(
          "id, subject_name, transcript, score_global, analysis_json, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (dbErr) throw dbErr;
      setSessions(data ?? []);

      if (isPro) {
        const { data: avgData, error: avgErr } =
          await supabase.rpc("get_average_radar");
        if (!avgErr) {
          setAverageRadar(avgData);
        }
      }
    } catch (err: any) {
      setError("Impossible de charger tes sessions.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [limit, refreshTrigger]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ── États de chargement / erreur / vide ──────────────────────────────────

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-500" />
            {isPro ? "Mes performances" : "Ma dernière performance"}
          </h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-3xl p-5 border border-slate-200 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="w-[76px] h-[76px] rounded-full bg-slate-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-100 rounded-full w-2/5" />
                  <div className="h-2.5 bg-slate-100 rounded-full w-3/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-red-50 border border-red-200 rounded-3xl p-6 flex items-center gap-4">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-red-700 font-semibold text-sm">{error}</p>
        </div>
        <button
          onClick={fetchSessions}
          className="flex items-center gap-1 text-red-600 hover:text-red-700 text-xs font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Réessayer
        </button>
      </section>
    );
  }

  if (sessions.length === 0) {
    return (
      <section className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-3xl p-8 border border-slate-200 text-center space-y-3">
        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto">
          <Activity className="w-6 h-6 text-indigo-400" />
        </div>
        <h3 className="font-semibold text-slate-800">
          Aucune session enregistrée
        </h3>
        <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
          Lance ton premier oral pour voir tes performances apparaître ici.
        </p>
      </section>
    );
  }

  // ── Rendu principal ──────────────────────────────────────────────────────

  const avgScore =
    sessions.length > 0
      ? Math.round(
        sessions.reduce((s, sess) => s + (sess.score_global ?? 0), 0) /
        sessions.length,
      )
      : 0;
  const avgPalette = getScoreColor(avgScore);

  return (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-500" />
            {isPro ? "Mes performances" : "Ma dernière performance"}
          </h2>
          {isPro && sessions.length > 1 && (
            <p className="text-slate-400 text-sm mt-0.5">
              {sessions.length} sessions · score moyen{" "}
              <span className={`font-semibold ${avgPalette.text}`}>
                {avgScore}/100
              </span>
            </p>
          )}
        </div>
        <button
          onClick={fetchSessions}
          title="Rafraîchir"
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Graphique de progression (Pro, ≥2 sessions) */}
      {isPro && sessions.length >= 2 && (
        <ProgressionChart sessions={sessions} />
      )}

      {/* Résumé stats (Pro, ≥2 sessions) */}
      {isPro && sessions.length >= 2 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Score moyen",
              value: `${avgScore}/100`,
              icon: <BarChart2 className="w-4 h-4" />,
              color: avgPalette,
            },
            {
              label: "Meilleur score",
              value: `${Math.max(...sessions.map((s) => s.score_global ?? 0))}/100`,
              icon: <TrendingUp className="w-4 h-4" />,
              color: getScoreColor(
                Math.max(...sessions.map((s) => s.score_global ?? 0)),
              ),
            },
            {
              label: "Sessions",
              value: `${sessions.length}`,
              icon: <Clock className="w-4 h-4" />,
              color: {
                text: "text-indigo-600",
                bg: "bg-indigo-50",
                border: "border-indigo-100",
                ring: "#6366f1",
                label: "",
              },
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`bg-white rounded-2xl p-4 border ${stat.color.border} flex flex-col items-center text-center gap-1.5`}
            >
              <div
                className={`${stat.color.bg} ${stat.color.text} p-2 rounded-xl`}
              >
                {stat.icon}
              </div>
              <span className="text-xl font-bold text-slate-900">
                {stat.value}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Liste des sessions */}
      <div className="space-y-3">
        {sessions.map((session, i) => (
          <React.Fragment key={session.id}>
            <SessionCard
              session={session}
              index={i}
              isFirst={i === 0}
              previousScore={sessions[i + 1]?.score_global ?? undefined}
              averageRadar={averageRadar}
              isPro={isPro}
            />
          </React.Fragment>
        ))}
      </div>

      {/* Upsell pour non-Pro avec > 0 sessions */}
      {!isPro && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl px-6 py-6 border border-white/10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-violet-600 rounded-full opacity-20 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              Passez au niveau supérieur
            </h3>
            <p className="text-sm text-indigo-200 mt-2 max-w-md leading-relaxed">
              Débloquez des <strong>sessions illimitées</strong>, l'historique de vos 5 dernières sessions, la comparaison de niveau et les <strong>questions pièges d'IA</strong> pour bétonner vos oraux.
            </p>
          </div>

          <button className="relative z-10 w-full md:w-auto bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 hover:from-amber-500 hover:to-orange-600 text-white text-sm font-bold px-6 py-3 rounded-xl shadow-lg shadow-orange-500/20 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] whitespace-nowrap overflow-hidden group/btn flex-shrink-0 cursor-not-allowed">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] -translate-x-[150%] animate-[shimmer_2s_infinite]" />
            <span className="relative z-10 drop-shadow-sm flex items-center gap-2 justify-center">
              Devenir Mentor
            </span>
            <span className="block text-[10px] text-amber-100/70 font-medium text-center relative z-10 mt-0.5">Bientôt disponible</span>
          </button>
        </div>
      )}
    </section>
  );
}
