import React from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ResponsiveContainer, Tooltip
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────
export interface GuestRadarPoint {
    subject: string;
    A: number;       // score /20
    fullMark: number; // toujours 20
}

export interface GuestFlashReport {
    globalScore: number;        // /20
    pointCle: string;           // phrase d'accroche IA
    radarData: GuestRadarPoint[]; // 5 critères
}

interface GuestResultsViewProps {
    report: GuestFlashReport;
    onSignIn: () => void;
    onContinueDemo: () => void;
}

// ── Palette selon score ───────────────────────────────────────────────────────
function getPalette(score: number) {
    let mention = '⚠️ À travailler';
    if (score >= 14) mention = '✅ Très bien';
    else if (score >= 10) mention = '📈 Bien';

    return {
        ring: '#3b82f6', bg: 'from-blue-600 to-indigo-600',
        badge: 'bg-blue-50 text-blue-700 border-blue-200', mention
    };
}

function SkeletonLine({ width = 'w-full' }: { width?: string }) {
    return <div className={`h-2.5 bg-slate-200 rounded-full ${width} animate-pulse`} />;
}

// Tooltip personnalisé pour le radar
function CustomTooltip({ active, payload }: any) {
    if (active && payload?.length) {
        return (
            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
                <p className="font-semibold text-slate-700">{payload[0].payload.subject}</p>
                <p className="text-blue-600 font-bold">{payload[0].value}/20</p>
            </div>
        );
    }
    return null;
}

export default function GuestResultsView({ report, onSignIn, onContinueDemo }: GuestResultsViewProps) {
    const palette = getPalette(report.globalScore);
    if (report.globalScore >= 16) palette.mention = '🏆 Excellent';

    // Arc SVG score ring
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const progress = (report.globalScore / 20) * circumference;

    return (
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* En-tête */}
            <div className="flex items-center justify-between px-1">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Aperçu Flash</h2>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Analyse basée sur ton oral · détail complet après connexion
                    </p>
                </div>
                <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-semibold">
                    <Lock className="w-3 h-3" />
                    Mode Démo
                </span>
            </div>

            {/* ── Ligne 1 : Score + Radar ── */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

                {/* Score circle (visible) */}
                <div className="md:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-5">
                    <div className="relative flex items-center justify-center w-40 h-40">
                        <svg className="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
                            <circle
                                cx="60" cy="60" r={radius}
                                fill="none"
                                stroke={palette.ring}
                                strokeWidth="10"
                                strokeLinecap="round"
                                strokeDasharray={`${progress} ${circumference}`}
                                style={{ transition: 'stroke-dasharray 1.2s ease' }}
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-5xl font-bold text-slate-900 leading-none tabular-nums">
                                {report.globalScore}
                            </span>
                            <span className="text-base text-slate-400 font-medium">/20</span>
                        </div>
                    </div>

                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${palette.badge}`}>
                        {palette.mention}
                    </span>

                    {/* Point clé IA */}
                    <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                            🎯 Point clé du jury
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed italic">
                            "{report.pointCle}"
                        </p>
                    </div>
                </div>

                {/* Radar chart (visible — montre la forme générale) */}
                <div className="md:col-span-3 bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-slate-900 font-semibold text-sm flex items-center gap-2">
                            📊 Profil de compétences
                        </h3>
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                            Scores visibles
                        </span>
                    </div>
                    <div className="flex-1 w-full min-h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={report.radarData}>
                                <PolarGrid stroke="#e2e8f0" />
                                <PolarAngleAxis
                                    dataKey="subject"
                                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                                />
                                <PolarRadiusAxis
                                    angle={30}
                                    domain={[0, 20]}
                                    tick={false}
                                    axisLine={false}
                                />
                                <Radar
                                    name="Score"
                                    dataKey="A"
                                    stroke={palette.ring}
                                    fill={palette.ring}
                                    fillOpacity={0.18}
                                    strokeWidth={2}
                                />
                                <Tooltip content={<CustomTooltip />} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ── Ligne 2 : 5 cartes critères (noms + scores visibles, explications verrouillées) ── */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-slate-900 font-semibold flex items-center gap-2">
                        Détail par critère
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                        <Lock className="w-2.5 h-2.5" />
                        Analyses verrouillées
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {report.radarData.map((criterion) => (
                        <div key={criterion.subject} className="bg-slate-50 rounded-2xl p-5 border border-slate-100 relative overflow-hidden">
                            {/* En-tête visible : nom + score */}
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-slate-800 text-sm">{criterion.subject}</h4>
                                <span
                                    className="font-bold text-sm px-2.5 py-1 rounded-lg"
                                    style={{
                                        backgroundColor: `${getPalette(criterion.A).ring}18`,
                                        color: getPalette(criterion.A).ring
                                    }}
                                >
                                    {criterion.A}/20
                                </span>
                            </div>

                            {/* Barre de progression (visible) */}
                            <div className="w-full bg-slate-200 rounded-full h-1.5 mb-3">
                                <div
                                    className="h-1.5 rounded-full transition-all duration-700"
                                    style={{
                                        width: `${(criterion.A / 20) * 100}%`,
                                        backgroundColor: getPalette(criterion.A).ring
                                    }}
                                />
                            </div>

                            {/* Explication verrouillée */}
                            <div className="relative">
                                <div className="space-y-1.5 blur-[4px] select-none pointer-events-none">
                                    <SkeletonLine width="w-full" />
                                    <SkeletonLine width="w-4/5" />
                                    <SkeletonLine width="w-3/5" />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex items-center gap-1 bg-white/90 border border-slate-200 px-2.5 py-1 rounded-full shadow-sm">
                                        <Lock className="w-2.5 h-2.5 text-slate-400" />
                                        <span className="text-[10px] font-semibold text-slate-500">Connecte-toi pour lire</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Bannière CTA ── */}
            <div className={`bg-gradient-to-r ${palette.bg} rounded-3xl p-7 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg`}>
                <div className="text-center md:text-left">
                    <h3 className="text-white text-xl font-bold mb-1">
                        Débloque ton analyse détaillée — gratuitement
                    </h3>
                    <p className="text-white/80 text-sm max-w-sm leading-relaxed">
                        Radar de compétences, détection des tics de langage, et conseils de jury personnalisés t'attendent.
                    </p>
                </div>

                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    <button
                        id="guest-signin-cta"
                        onClick={onSignIn}
                        className="flex items-center gap-2.5 bg-white hover:bg-slate-50 text-slate-900 font-bold py-3.5 px-7 rounded-2xl text-sm transition-all duration-200 hover:scale-[1.04] active:scale-[0.97] shadow-2xl shadow-black/20 whitespace-nowrap"
                    >
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Se connecter pour voir l'analyse complète
                    </button>

                    <button
                        onClick={onContinueDemo}
                        className="text-white/50 hover:text-white/80 text-xs transition-colors underline underline-offset-4"
                    >
                        Continuer sans résultats
                    </button>

                    <div className="flex items-center gap-1.5 mt-1">
                        <ShieldCheck className="w-3 h-3 text-white/40 flex-shrink-0" />
                        <p className="text-white/40 text-[10px] text-center leading-tight max-w-[240px]">
                            En mode gratuit, tes données peuvent être utilisées pour améliorer l'IA.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
