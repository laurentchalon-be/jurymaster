import { useState, useRef, useEffect } from 'react';
import { Mic, LogOut, LogIn, LayoutDashboard, PlusCircle, ChevronDown, Zap, Crown, X, Check, Clock, Moon } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database.types';

// ── Types ──────────────────────────────────────────────────────────────────────

type ActiveView = 'oral' | 'dashboard';

interface NavBarProps {
    user: User | null;
    profile: Profile | null;
    onSignIn: () => void;
    onOpenModal: () => void;
    onSignOut: () => void;
    // Navigation
    activeView: ActiveView;
    onNavigate: (view: ActiveView) => void;
    // Quota (pour la barre de progression)
    quotaSecondsUsed?: number;   // secondes utilisées aujourd'hui
    quotaSecondsMax?: number;    // quota max en secondes
    // Modal paywall
    onOpenPaywall?: () => void;
}

// ── Constantes visuelles ───────────────────────────────────────────────────────

const QUOTA_MAX = 5 * 60; // 5 min par défaut pour gratuit

function formatQuotaTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return s === 0 ? `${m} min` : `${m} min ${s}s`;
}

// ── Modal Paywall Pass 48h ─────────────────────────────────────────────────────

function PaywallModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center px-4 overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{ backgroundColor: 'rgba(2,6,23,0.8)', backdropFilter: 'blur(10px)' }}
        >
            <div
                className="relative w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl my-8"
                style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1a1060 50%, #0f172a 100%)',
                    border: '1px solid rgba(139,92,246,0.25)',
                    animation: 'modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
                }}
            >
                {/* Glow décoratif */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-32 -right-32 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl" />
                    <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                    <X className="w-5 h-5" />
                </button>

                <div className="relative z-10 p-8 md:p-12 w-full">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl shadow-xl shadow-violet-500/30 mb-5">
                            <Crown className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">Choisissez votre accès</h2>
                        <p className="text-slate-400 text-base max-w-lg mx-auto">
                            Débloquez tout le potentiel d'Auditio pour réussir votre oral.
                        </p>
                    </div>

                    {/* 2 colonnes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                        {/* Pass Rush */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-7 flex flex-col hover:bg-white/10 transition-colors">
                            <h3 className="text-2xl font-bold text-white mb-2">Pass Rush</h3>
                            <p className="text-slate-400 text-sm mb-6 h-10">Idéal pour le jour J. <br />Prépare-toi intensément avant l'épreuve.</p>
                            <div className="flex items-end gap-1 mb-8">
                                <span className="text-5xl font-bold text-white">3,99€</span>
                            </div>
                            <div className="space-y-4 mb-8 flex-1">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3 h-3 text-violet-300" />
                                    </div>
                                    <span className="text-base text-slate-200">Accès total pendant <strong className="text-white">48h</strong></span>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3 h-3 text-violet-300" />
                                    </div>
                                    <span className="text-base text-slate-200">Sessions illimitées</span>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3 h-3 text-violet-300" />
                                    </div>
                                    <span className="text-base text-slate-200">Mode Jury Stressant débloqué</span>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3 h-3 text-violet-300" />
                                    </div>
                                    <span className="text-base text-slate-200">Questions IA personnalisées</span>
                                </div>
                            </div>
                            <button
                                disabled
                                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-xl text-sm transition-colors cursor-not-allowed"
                            >
                                Choisir le Pass Rush
                            </button>
                        </div>

                        {/* Abonnement Mentor */}
                        <div className="bg-gradient-to-b from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl p-7 flex flex-col relative overflow-hidden shadow-2xl shadow-violet-900/20">
                            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-violet-500 to-indigo-500"></div>
                            <div className="absolute top-5 right-5 bg-violet-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-md shadow-violet-500/20">
                                Recommandé
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Abonnement Mentor</h3>
                            <p className="text-slate-400 text-sm mb-6 h-10">Accès complet sur la durée.</p>
                            <div className="flex items-end gap-1 mb-8">
                                <span className="text-5xl font-bold text-white">9,99€</span>
                                <span className="text-slate-400 text-base mb-1">/mois</span>
                            </div>
                            <div className="space-y-4 mb-8 flex-1">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3 h-3 text-violet-300" />
                                    </div>
                                    <span className="text-base text-slate-200 font-medium text-white">Tous les avantages du Pass Rush</span>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3 h-3 text-amber-300" />
                                    </div>
                                    <span className="text-base text-slate-200 font-medium text-amber-100">Historique complet des sessions</span>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3 h-3 text-violet-300" />
                                    </div>
                                    <span className="text-base text-slate-200">Suivi détaillé de votre progression sur la durée</span>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3 h-3 text-violet-300" />
                                    </div>
                                    <span className="text-base text-slate-200">Sans engagement, annulable à tout moment</span>
                                </div>
                            </div>
                            <button
                                disabled
                                className="w-full relative group overflow-hidden bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-4 rounded-xl text-sm transition-all duration-300 cursor-not-allowed"
                            >
                                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] -translate-x-[150%] animate-[shimmer_2s_infinite]" />
                                <div className="relative z-10 flex items-center justify-center gap-2">
                                    <Crown className="w-4 h-4 text-amber-300" />
                                    Devenir Mentor
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 text-center space-y-4">
                        <p className="text-xs text-violet-400/80 font-medium bg-white/5 inline-block py-2 px-4 rounded-lg border border-white/5">
                            💳 Paiement disponible très prochainement
                        </p>
                        <div>
                            <button onClick={onClose} className="text-slate-400 hover:text-white text-sm transition-colors font-medium">
                                Continuer avec la version gratuite
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
        </div>
    );
}

// ── Avatar dropdown ────────────────────────────────────────────────────────────

function AvatarMenu({ user, profile, isPro, onSignOut }: {
    user: User;
    profile: Profile | null;
    isPro: boolean;
    onSignOut: () => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // ─ Dark mode ─
    const [isDark, setIsDark] = useState(() =>
        localStorage.getItem('auditio_theme') === 'dark'
    );

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('auditio_theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    // Fermer au clic extérieur
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const initials = (profile?.full_name ?? user.email ?? 'U')[0].toUpperCase();

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 transition-colors group"
            >
                {profile?.avatar_url ? (
                    <img
                        src={profile.avatar_url}
                        alt={profile.full_name ?? 'Avatar'}
                        className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-200 group-hover:ring-blue-300 transition-all"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-slate-200">
                        {initials}
                    </div>
                )}
                <div className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold text-slate-800 max-w-[110px] truncate">
                        {profile?.full_name?.split(' ')[0] ?? user.email?.split('@')[0]}
                    </span>
                    {isPro
                        ? <span className="text-[10px] font-bold text-amber-600">⭐ Mentor</span>
                        : <span className="text-[10px] text-slate-400">Gratuit</span>
                    }
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50"
                    style={{ animation: 'dropIn 0.15s ease both' }}
                >
                    {/* Infos */}
                    <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-xs font-semibold text-slate-800 truncate">{profile?.full_name ?? user.email}</p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{user.email}</p>
                    </div>

                    <div className="p-1.5 space-y-0.5">
                        {/* Toggle mode sombre */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsDark(v => !v); }}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                        >
                            <div className="flex items-center gap-2.5">
                                <Moon className="w-4 h-4 text-slate-400" />
                                <span className="font-medium">Mode sombre</span>
                            </div>
                            {/* Pill toggle — inline styles pour éviter purge Tailwind */}
                            <div
                                style={{
                                    position: 'relative',
                                    width: '2.25rem',
                                    height: '1.25rem',
                                    borderRadius: '9999px',
                                    backgroundColor: isDark ? '#6366f1' : '#e2e8f0',
                                    transition: 'background-color 0.3s',
                                    flexShrink: 0,
                                }}
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '0.125rem',
                                        left: isDark ? '1rem' : '0.125rem',
                                        width: '1rem',
                                        height: '1rem',
                                        borderRadius: '9999px',
                                        backgroundColor: 'white',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                        transition: 'left 0.25s',
                                    }}
                                />
                            </div>
                        </button>

                        {/* Séparateur */}
                        <div className="h-px bg-slate-100 mx-2 my-1" />

                        {/* Déconnexion */}
                        <button
                            onClick={() => { onSignOut(); setOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
                        >
                            <LogOut className="w-4 h-4" />
                            Se déconnecter
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes dropIn {
                    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}


// ── Barre de quota ─────────────────────────────────────────────────────────────

function QuotaBar({ isPro, quotaSecondsUsed, quotaSecondsMax }: {
    isPro: boolean;
    quotaSecondsUsed: number;
    quotaSecondsMax: number;
}) {
    if (isPro) {
        return (
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100 px-4 py-1.5 flex items-center justify-center gap-2">
                <Crown className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-xs font-bold text-violet-800 tracking-wide uppercase">
                    Membre Mentor · Sessions illimitées
                </span>
                <Check className="w-3.5 h-3.5 text-violet-500" />
            </div>
        );
    }

    const pct = Math.min(1, quotaSecondsUsed / quotaSecondsMax);
    const remaining = Math.max(0, quotaSecondsMax - quotaSecondsUsed);
    const isFull = remaining === 0;

    return (
        <div className="bg-white border-b border-slate-100 px-4 py-1.5">
            <div className="max-w-5xl mx-auto flex items-center gap-3">
                <Clock className={`w-3 h-3 flex-shrink-0 ${isFull ? 'text-red-400' : 'text-slate-400'}`} />
                <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-1 rounded-full transition-all duration-700 ${isFull ? 'bg-red-400' : pct > 0.7 ? 'bg-amber-400' : 'bg-blue-500'}`}
                            style={{ width: `${pct * 100}%` }}
                        />
                    </div>
                    <span className={`text-[11px] font-semibold whitespace-nowrap ${isFull ? 'text-red-500' : 'text-slate-500'}`}>
                        {isFull
                            ? '⚠️ Quota atteint · Revenez demain'
                            : `${formatQuotaTime(remaining)} restante${remaining > 1 ? 's' : ''} (gratuit)`
                        }
                    </span>
                </div>
            </div>
        </div>
    );
}

// ── Composant principal NavBar ─────────────────────────────────────────────────

export default function NavBar({
    user, profile, onSignIn, onOpenModal, onSignOut,
    activeView, onNavigate,
    quotaSecondsUsed = 0,
    quotaSecondsMax = QUOTA_MAX,
}: NavBarProps) {
    const isPro = user !== null && (profile?.is_pro ?? false);
    const [paywallOpen, setPaywallOpen] = useState(false);

    return (
        <>
            <PaywallModal
                isOpen={paywallOpen}
                onClose={() => setPaywallOpen(false)}
            />

            <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm shadow-slate-100/80">
                <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-4">

                    {/* ── GAUCHE : Logo ───────────────────────────────────── */}
                    <button
                        onClick={() => onNavigate('oral')}
                        className="flex items-center gap-2.5 flex-shrink-0 group"
                    >
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-xl shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-all group-hover:scale-105">
                            <Mic className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                            Auditio
                        </span>
                        {!user && (
                            <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                                Démo
                            </span>
                        )}
                    </button>

                    {/* ── CENTRE : Navigation centrée (utilisateurs connectés) ── */}
                    {user && (
                        <nav className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => onNavigate('dashboard')}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeView === 'dashboard'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <LayoutDashboard className="w-3.5 h-3.5" />
                                Dashboard
                            </button>
                            <button
                                onClick={() => onNavigate('oral')}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeView === 'oral'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <PlusCircle className="w-3.5 h-3.5" />
                                Nouvel oral
                            </button>
                        </nav>
                    )}

                    {/* ── DROITE ───────────────────────────────────────────── */}
                    <div className="flex items-center gap-2 flex-shrink-0">

                        {user ? (
                            <>

                                {/* Bouton Devenir Pro (si gratuit) */}
                                {!isPro && (
                                    <button
                                        onClick={() => setPaywallOpen(true)}
                                        className="hidden lg:flex items-center gap-2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 hover:from-amber-500 hover:to-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-orange-500/30 transition-all duration-300 hover:scale-[1.05] active:scale-[0.95] whitespace-nowrap overflow-hidden relative group"
                                    >
                                        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] -translate-x-[150%] group-hover:animate-[shimmer_1.5s_infinite]" />
                                        <Crown className="w-4 h-4 text-orange-50 relative z-10" />
                                        <span className="relative z-10 drop-shadow-sm">Devenir Mentor</span>
                                    </button>
                                )}

                                {/* Avatar menu */}
                                <AvatarMenu
                                    user={user}
                                    profile={profile}
                                    isPro={isPro}
                                    onSignOut={onSignOut}
                                />
                            </>
                        ) : (
                            /* Non connecté → double CTA */
                            <div className="flex items-center gap-2">
                                <button
                                    id="login-btn"
                                    onClick={onOpenModal}
                                    className="hidden sm:flex items-center gap-1.5 text-slate-500 hover:text-slate-800 px-3 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-slate-100"
                                >
                                    <LogIn className="w-3.5 h-3.5" />
                                    Se connecter
                                </button>
                                <button
                                    id="signup-btn"
                                    onClick={onOpenModal}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm shadow-blue-500/30"
                                >
                                    Créer un compte
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Barre de quota ─────────────────────────────────────── */}
            {user && (
                <QuotaBar
                    isPro={isPro}
                    quotaSecondsUsed={quotaSecondsUsed}
                    quotaSecondsMax={quotaSecondsMax}
                />
            )}
        </>
    );
}
