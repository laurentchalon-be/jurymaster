import React from 'react';
import { Lock, ShieldCheck, Eye } from 'lucide-react';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ResponsiveContainer,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Renvoie la couleur du score selon sa valeur (/20) */
function scoreColor(score: number): string {
    if (score >= 14) return '#22c55e'; // vert
    if (score >= 10) return '#f59e0b'; // amber
    return '#ef4444';                  // rouge
}

/** Barre de progression colorée */
function ScoreBar({ score }: { score: number }) {
    return (
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
                className="h-2 rounded-full transition-all duration-700"
                style={{ width: `${(score / 20) * 100}%`, backgroundColor: scoreColor(score) }}
            />
        </div>
    );
}

/** Lignes de squelette animées (contenu flouté) */
function SkeletonLines() {
    return (
        <div className="space-y-2 mt-3">
            <div className="h-2.5 bg-slate-200 rounded-full w-full animate-pulse" />
            <div className="h-2.5 bg-slate-200 rounded-full w-4/5 animate-pulse" />
            <div className="h-2.5 bg-slate-200 rounded-full w-3/5 animate-pulse" />
        </div>
    );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function GuestResultsView({ report, onSignIn, onContinueDemo }: GuestResultsViewProps) {

    // Critère "révélé" : on prend le premier de la liste (généralement "Clarté")
    // ou le critère avec le score le plus bas pour maximiser l'impact émotionnel
    const revealedCriterion = report.radarData.reduce(
        (worst, c) => (c.A < worst.A ? c : worst),
        report.radarData[0]
    );
    const lockedCriteria = report.radarData.filter(c => c.subject !== revealedCriterion.subject);

    const revealedColor = scoreColor(revealedCriterion.A);

    // Mention du critère révélé
    let revealedMention = '⚠️ À travailler';
    if (revealedCriterion.A >= 16) revealedMention = '🏆 Excellent';
    else if (revealedCriterion.A >= 14) revealedMention = '✅ Très bien';
    else if (revealedCriterion.A >= 10) revealedMention = '📈 Passable';

    return (
        <section className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* En-tête */}
            <div className="flex items-center justify-between px-1">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Aperçu Flash</h2>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Analyse partielle · rapport complet après connexion
                    </p>
                </div>
                <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-semibold">
                    <Lock className="w-3 h-3" />
                    Mode Démo
                </span>
            </div>

            {/* ── Ligne principale : Score flouté + Critère révélé ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Score global — FLOUTÉ */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                    {/* Badge "verrouillé" */}
                    <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] font-semibold text-slate-400">Verrouillé</span>
                    </div>

                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Score global</p>

                    {/* Chiffre flouté */}
                    <div className="relative flex items-center justify-center w-36 h-36">
                        <span
                            className="text-7xl font-bold text-slate-900 select-none tabular-nums"
                            style={{ filter: 'blur(12px)', userSelect: 'none' }}
                        >
                            {report.globalScore}
                        </span>
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                            <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl px-4 py-2.5 flex flex-col items-center gap-1 shadow-xl">
                                <Lock className="w-5 h-5 text-white" />
                                <span className="text-white text-xs font-bold whitespace-nowrap">Connecte-toi</span>
                            </div>
                        </div>
                    </div>

                    <span className="text-slate-400 text-sm font-medium">/20</span>

                    {/* Point clé IA — flouté aussi */}
                    <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 relative overflow-hidden">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">🎯 Point clé du jury</p>
                        <p
                            className="text-sm text-slate-700 leading-relaxed select-none"
                            style={{ filter: 'blur(4px)' }}
                        >
                            {report.pointCle}
                        </p>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="bg-white/90 border border-slate-200 text-slate-500 text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" /> Visible après connexion
                            </span>
                        </div>
                    </div>
                </div>

                {/* Critère révélé — VISIBLE et mis en avant */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border-2 flex flex-col justify-center gap-5 relative"
                    style={{ borderColor: revealedColor + '50' }}>

                    {/* Badge "Révélé" */}
                    <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold"
                        style={{
                            backgroundColor: revealedColor + '15',
                            borderColor: revealedColor + '40',
                            color: revealedColor,
                        }}>
                        <Eye className="w-3 h-3" />
                        Révélé
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                            Critère le plus déterminant
                        </p>
                        <h3 className="text-2xl font-bold text-slate-900">{revealedCriterion.subject}</h3>
                    </div>

                    {/* Score mis en avant */}
                    <div className="flex items-end gap-3">
                        <span className="text-7xl font-bold leading-none tabular-nums" style={{ color: revealedColor }}>
                            {revealedCriterion.A}
                        </span>
                        <span className="text-2xl text-slate-400 font-medium mb-2">/20</span>
                        <span className="mb-2 text-sm font-semibold px-3 py-1 rounded-full border"
                            style={{
                                backgroundColor: revealedColor + '15',
                                borderColor: revealedColor + '40',
                                color: revealedColor,
                            }}>
                            {revealedMention}
                        </span>
                    </div>

                    <ScoreBar score={revealedCriterion.A} />

                    {/* Message d'accroche contextuel */}
                    <p className="text-slate-500 text-sm leading-relaxed">
                        {revealedCriterion.A < 10
                            ? `Ta ${revealedCriterion.subject.toLowerCase()} est ton point faible principal. Connecte-toi pour obtenir des conseils précis pour t'améliorer.`
                            : revealedCriterion.A < 14
                                ? `Bonne base en ${revealedCriterion.subject.toLowerCase()}, mais il y a une marge de progression. Vois l'analyse complète pour savoir comment progresser.`
                                : `Belle performance en ${revealedCriterion.subject.toLowerCase()} ! Connecte-toi pour voir tes autres points forts et axes d'amélioration.`
                        }
                    </p>
                </div>
            </div>

            {/* ── Radar (silhouette seulement, pas de tooltip) + critères verrouillés ── */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

                {/* Radar — visible mais sans labels de score, juste la forme */}
                <div className="md:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-slate-900 font-semibold text-sm">📊 Profil de compétences</h3>
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                            Aperçu
                        </span>
                    </div>
                    <div className="flex-1 w-full min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={report.radarData}>
                                <PolarGrid stroke="#e2e8f0" />
                                <PolarAngleAxis
                                    dataKey="subject"
                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
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
                                    stroke="#94a3b8"
                                    fill="#94a3b8"
                                    fillOpacity={0.15}
                                    strokeWidth={2}
                                    strokeDasharray="4 2"
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-center text-[10px] text-slate-400 mt-1">
                        Scores exacts visibles après connexion
                    </p>
                </div>

                {/* Critères verrouillés */}
                <div className="md:col-span-3 bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-900 font-semibold text-sm">Détail par critère</h3>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                            <Lock className="w-2.5 h-2.5" />
                            {lockedCriteria.length} critères verrouillés
                        </span>
                    </div>

                    <div className="space-y-3">
                        {lockedCriteria.map((criterion) => (
                            <div key={criterion.subject} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 relative overflow-hidden">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-slate-800 text-sm">{criterion.subject}</h4>
                                    {/* Score flouté */}
                                    <span
                                        className="font-bold text-sm px-2.5 py-1 rounded-lg bg-slate-200 text-slate-200 select-none"
                                        style={{ filter: 'blur(5px)' }}
                                    >
                                        {criterion.A}/20
                                    </span>
                                </div>
                                {/* Barre de progression floue */}
                                <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2" style={{ filter: 'blur(1px)' }}>
                                    <div
                                        className="h-1.5 rounded-full"
                                        style={{ width: `${(criterion.A / 20) * 100}%`, backgroundColor: '#cbd5e1' }}
                                    />
                                </div>
                                <SkeletonLines />
                                {/* Overlay verrou */}
                                <div className="absolute inset-0 flex items-center justify-end pr-4">
                                    <div className="flex items-center gap-1 bg-white/90 border border-slate-200 px-2.5 py-1 rounded-full shadow-sm">
                                        <Lock className="w-2.5 h-2.5 text-slate-400" />
                                        <span className="text-[10px] font-semibold text-slate-500">Connecte-toi pour lire</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Bannière CTA ── */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-7 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
                <div className="text-center md:text-left">
                    <h3 className="text-white text-xl font-bold mb-1">
                        Débloque ton analyse complète — gratuitement
                    </h3>
                    <p className="text-white/80 text-sm max-w-sm leading-relaxed">
                        Score global, {lockedCriteria.length} critères détaillés, tics de langage et conseils personnalisés du jury t'attendent.
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
                        Se connecter — C'est gratuit
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
