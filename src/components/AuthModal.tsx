import React, { useEffect, useRef } from 'react';
import { X, Mic, BrainCircuit, TrendingUp, GraduationCap } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    reason: 'launch' | 'stats' | null;
    onClose: () => void;
    onSignIn: () => void;
}

const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const features = [
    {
        icon: BrainCircuit,
        title: 'Feedback IA complet',
        description: 'Analyse instantanée par Gemini après chaque oral.',
    },
    {
        icon: TrendingUp,
        title: 'Suivi de progression',
        description: 'Historique de toutes vos sessions et évolution de vos scores.',
    },
    {
        icon: GraduationCap,
        title: 'Sauvegarde automatique',
        description: 'Chaque oral enregistré, accessible partout et à tout moment.',
    },
];

const reasons = {
    launch: {
        emoji: '🎤',
        title: 'Prêt à passer à l\'oral ?',
        subtitle: 'Connectez-vous pour lancer votre session et sauvegarder vos résultats.',
    },
    stats: {
        emoji: '📊',
        title: 'Accédez à vos statistiques',
        subtitle: 'Créez votre compte gratuit pour voir votre progression dans le temps.',
    },
};

export default function AuthModal({ isOpen, reason, onClose, onSignIn }: AuthModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    // Click outside to close
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    if (!isOpen || !reason) return null;

    const { emoji, title, subtitle } = reasons[reason];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
            onClick={handleBackdropClick}
            style={{ backgroundColor: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)' }}
        >
            <div
                ref={modalRef}
                className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-modal-in"
                style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    animation: 'modalIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                }}
            >
                {/* Fond décoratif */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
                </div>

                {/* Bouton fermer */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Fermer"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="relative z-10 flex flex-col items-center gap-7 p-8 pt-10">

                    {/* Header */}
                    <div className="text-center space-y-3">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-xl shadow-blue-600/30 mb-1">
                            <Mic className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl mb-1">{emoji}</p>
                            <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
                            <p className="text-slate-400 text-sm mt-2 leading-relaxed">{subtitle}</p>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="w-full space-y-2.5">
                        {features.map(({ icon: Icon, title: ftitle, description }) => (
                            <div
                                key={ftitle}
                                className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 backdrop-blur-sm"
                            >
                                <div className="flex-shrink-0 mt-0.5 w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                                    <Icon className="w-4 h-4 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold text-sm">{ftitle}</h3>
                                    <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{description}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <div className="w-full space-y-3">
                        <button
                            id="modal-google-signin-btn"
                            onClick={onSignIn}
                            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 font-semibold px-6 py-3.5 rounded-2xl shadow-lg shadow-black/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <GoogleIcon />
                            Continuer avec Google — c'est gratuit
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors py-1"
                        >
                            Continuer en mode démo (sans sauvegarde)
                        </button>
                    </div>

                </div>
            </div>

            <style>{`
                @keyframes modalIn {
                    from { opacity: 0; transform: scale(0.92) translateY(12px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
}
