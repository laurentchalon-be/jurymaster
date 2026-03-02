import React from 'react';
import { Award, Lock, TrendingUp, Star, BookOpen, Zap, LogIn } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface RadarDataPoint {
    subject: string;
    A: number;
    fullMark: number;
    explanation: string;
}

interface PartialResultsViewProps {
    globalScore: number;
    topStrength: string; // Le seul point fort visible
    radarData: RadarDataPoint[];
    onSignIn: () => void;
    onContinueDemo: () => void;
}

export default function PartialResultsView({
    globalScore,
    topStrength,
    radarData,
    onSignIn,
    onContinueDemo,
}: PartialResultsViewProps) {
    // Convertir le score /100 en /20
    const scoreSur20 = Math.round((globalScore / 100) * 20 * 10) / 10;

    return (
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* En-tête */}
            <div className="flex items-center justify-between px-2">
                <h2 className="text-2xl font-semibold tracking-tight">Résultats Partiels</h2>
                <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-semibold">
                    <Lock className="w-3.5 h-3.5" />
                    Mode Démo
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* ── Score global (visible) ── */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                    <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl mb-4">
                        <Award className="w-8 h-8" />
                    </div>
                    <h3 className="text-slate-500 font-medium mb-2">Score Global</h3>
                    <div className="text-6xl font-bold tracking-tighter text-slate-900 mb-1">
                        {scoreSur20}
                        <span className="text-2xl text-slate-400 font-medium">/20</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">({globalScore}/100)</p>
                    <div className="w-full border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 text-left">
                            ✨ Point fort
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed text-left">
                            {topStrength}
                        </p>
                    </div>
                </div>

                {/* ── Radar Chart (flouté) ── */}
                <div className="md:col-span-2 relative">
                    {/* Contenu flouté */}
                    <div
                        className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col h-full"
                        style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }}
                    >
                        <h3 className="text-slate-900 font-semibold mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                            Analyse des compétences
                        </h3>
                        <div className="flex-1 w-full min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                    <PolarGrid stroke="#e2e8f0" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <Radar
                                        name="Score"
                                        dataKey="A"
                                        stroke="#3b82f6"
                                        fill="#3b82f6"
                                        fillOpacity={0.2}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    {/* Overlay lock */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-white/60 backdrop-blur-[2px]">
                        <div className="bg-slate-900/90 rounded-2xl px-6 py-4 flex flex-col items-center gap-2 shadow-xl">
                            <Lock className="w-5 h-5 text-blue-400" />
                            <p className="text-white text-sm font-semibold text-center">
                                Connecte-toi pour voir<br />l'analyse complète
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Conseils détaillés (floutés) sur toute la largeur ── */}
                <div className="md:col-span-3 relative">
                    {/* Contenu flouté */}
                    <div
                        className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200"
                        style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }}
                    >
                        <h3 className="text-slate-900 font-semibold mb-6 flex items-center gap-2">
                            Détail de l'évaluation par critère
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {radarData.map((data, i) => (
                                <div key={i} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-medium text-slate-900">{data.subject}</h4>
                                        <span className="text-blue-600 font-bold bg-blue-100 px-2.5 py-1 rounded-lg text-sm">
                                            {data.A}/100
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed">{data.explanation}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 p-6 bg-amber-50 rounded-2xl border border-amber-100">
                            <p className="text-amber-800 text-sm leading-relaxed">
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tes pistes d'amélioration
                                détaillées et le feedback complet du jury t'attendent ici après connexion...
                            </p>
                        </div>
                    </div>
                    {/* Overlay lock */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-white/60 backdrop-blur-[2px]">
                        <div className="bg-slate-900/90 rounded-2xl px-6 py-4 flex flex-col items-center gap-2 shadow-xl">
                            <Lock className="w-5 h-5 text-blue-400" />
                            <p className="text-white text-sm font-semibold text-center">
                                Feedback complet & conseils détaillés
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── CTA principal ── */}
                <div className="md:col-span-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg shadow-blue-500/20">
                    <div className="text-center md:text-left">
                        <h3 className="text-white text-xl font-bold mb-2">
                            🎯 Débloquer l'analyse complète
                        </h3>
                        <p className="text-blue-100 text-sm leading-relaxed max-w-sm">
                            Crée un compte gratuit pour accéder au radar chart détaillé, aux conseils personnalisés
                            et à l'historique de tes sessions.
                        </p>
                        <div className="flex flex-wrap gap-4 mt-4 justify-center md:justify-start">
                            {[
                                { icon: TrendingUp, text: 'Analyse radar complète' },
                                { icon: Star, text: 'Feedback jury personnalisé' },
                                { icon: BookOpen, text: 'Historique & progression' },
                                { icon: Zap, text: 'Sessions illimitées' },
                            ].map(({ icon: Icon, text }) => (
                                <span key={text} className="flex items-center gap-1.5 text-blue-100 text-xs font-medium">
                                    <Icon className="w-3.5 h-3.5 text-blue-300" />
                                    {text}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-3 flex-shrink-0">
                        <button
                            onClick={onSignIn}
                            className="flex items-center gap-3 bg-white hover:bg-slate-50 text-slate-900 font-semibold py-3.5 px-8 rounded-2xl text-sm transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-2xl shadow-black/20 whitespace-nowrap"
                        >
                            <LogIn className="w-4 h-4 text-blue-600" />
                            Se connecter pour voir l'analyse complète
                        </button>
                        <button
                            onClick={onContinueDemo}
                            className="text-blue-200/70 hover:text-blue-100 text-xs transition-colors underline underline-offset-4"
                        >
                            Continuer sans résultats
                        </button>
                    </div>
                </div>

            </div>
        </section>
    );
}
