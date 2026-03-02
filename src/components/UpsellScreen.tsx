import React from 'react';
import { Mic, Lock, Star, TrendingUp, BookOpen, Zap } from 'lucide-react';

interface UpsellScreenProps {
    onSignIn: () => void;
    onContinueDemo: () => void;
    /** Score approximatif (flouté) à afficher pour teaser l'utilisateur */
    blurredScore?: number;
}

const FEATURES = [
    { icon: TrendingUp, label: 'Analyse détaillée par critère', desc: 'Clarté, structure, vocabulaire, confiance...' },
    { icon: Star, label: 'Rapport complet du jury', desc: 'Feedback personnalisé selon le type de jury choisi' },
    { icon: BookOpen, label: 'Historique de vos sessions', desc: 'Suivez votre progression dans le temps' },
    { icon: Zap, label: 'Mode Stressant débloqué', desc: 'Entraînez-vous face à un jury exigeant' },
];

export default function UpsellScreen({ onSignIn, onContinueDemo, blurredScore }: UpsellScreenProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 overflow-auto">

            {/* Blobs décoratifs (style LoginPage) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600 rounded-full opacity-10 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600 rounded-full opacity-10 blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600 rounded-full opacity-5 blur-3xl" />
            </div>

            <div className="relative w-full max-w-lg mx-auto px-6 py-12 flex flex-col items-center gap-8">

                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-600/40">
                        <Mic className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-white tracking-tight">JuryMaster</span>
                </div>

                {/* Score flouté (teaser) */}
                {blurredScore !== undefined && (
                    <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center gap-6 backdrop-blur-sm">
                        <div className="relative flex-shrink-0">
                            <div
                                className="text-6xl font-bold text-white select-none"
                                style={{ filter: 'blur(10px)' }}
                            >
                                {blurredScore}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-blue-600/90 backdrop-blur-sm rounded-xl p-2">
                                    <Lock className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Ton score global</p>
                            <p className="text-white font-semibold leading-snug">
                                Connecte-toi pour découvrir<br />ton analyse complète
                            </p>
                        </div>
                    </div>
                )}

                {/* Headline */}
                <div className="text-center space-y-3">
                    <h2 className="text-3xl font-bold text-white tracking-tight leading-tight">
                        Découvre ton analyse détaillée
                    </h2>
                    <p className="text-slate-400 text-base leading-relaxed max-w-sm">
                        Tu viens de terminer ton oral. Crée un compte <span className="text-blue-400 font-medium">gratuitement</span> pour accéder à ton rapport complet.
                    </p>
                </div>

                {/* Features list */}
                <div className="w-full space-y-3">
                    {FEATURES.map(({ icon: Icon, label, desc }) => (
                        <div
                            key={label}
                            className="flex items-center gap-4 bg-white/5 border border-white/8 rounded-2xl px-5 py-4 backdrop-blur-sm"
                        >
                            <div className="flex-shrink-0 bg-blue-600/20 text-blue-400 p-2 rounded-xl">
                                <Icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-white text-sm font-semibold leading-none mb-0.5">{label}</p>
                                <p className="text-slate-500 text-xs">{desc}</p>
                            </div>
                            <div className="ml-auto flex-shrink-0 text-emerald-400">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA principal - Google */}
                <button
                    onClick={onSignIn}
                    className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 font-semibold py-4 px-6 rounded-2xl text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-white/10"
                >
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continuer avec Google — C'est gratuit
                </button>

                {/* Lien retour démo */}
                <button
                    onClick={onContinueDemo}
                    className="text-slate-500 hover:text-slate-300 text-sm transition-colors underline underline-offset-4"
                >
                    Non merci, continuer sans résultats
                </button>
            </div>
        </div>
    );
}
