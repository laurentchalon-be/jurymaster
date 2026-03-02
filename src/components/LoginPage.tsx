import { Mic, GraduationCap, BrainCircuit, TrendingUp } from 'lucide-react';

interface LoginPageProps {
    onSignInWithGoogle: () => Promise<void>;
    isLoading?: boolean;
}

// Icône Google SVG officielle
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
        title: 'Feedback IA',
        description: "Analyse instantanée par Gemini après chaque oral.",
    },
    {
        icon: TrendingUp,
        title: 'Suivi de progression',
        description: "Historique de toutes vos sessions et l'évolution de vos scores.",
    },
    {
        icon: GraduationCap,
        title: 'Jury adaptatif',
        description: 'Choisissez un jury bienveillant ou stressant pour vous préparer.',
    },
];

export default function LoginPage({ onSignInWithGoogle, isLoading }: LoginPageProps) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col items-center justify-center px-6 py-12">

            {/* Fond décoratif */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-10">

                {/* Logo + Titre */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-xl shadow-blue-600/30 mb-2">
                        <Mic className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight">JuryMaster</h1>
                    <p className="text-slate-400 text-lg leading-relaxed">
                        Entraînez-vous à l'oral, obtenez un feedback IA<br />et progressez avant votre grand jour.
                    </p>
                </div>

                {/* Features */}
                <div className="w-full space-y-3">
                    {features.map(({ icon: Icon, title, description }) => (
                        <div
                            key={title}
                            className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 backdrop-blur-sm"
                        >
                            <div className="flex-shrink-0 mt-0.5 w-9 h-9 bg-blue-600/20 rounded-xl flex items-center justify-center">
                                <Icon className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-semibold text-sm">{title}</h3>
                                <p className="text-slate-400 text-sm mt-0.5">{description}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA Google */}
                <div className="w-full space-y-3">
                    <button
                        id="google-signin-btn"
                        onClick={onSignInWithGoogle}
                        disabled={isLoading}
                        className="
              w-full flex items-center justify-center gap-3
              bg-white hover:bg-slate-50
              text-slate-900 font-semibold
              px-6 py-3.5 rounded-2xl
              shadow-lg shadow-black/20
              transition-all duration-200
              hover:scale-[1.02] active:scale-[0.98]
              disabled:opacity-60 disabled:cursor-not-allowed
            "
                    >
                        <GoogleIcon />
                        Continuer avec Google
                    </button>
                    <p className="text-center text-xs text-slate-500">
                        En vous connectant, vous acceptez nos conditions d'utilisation.<br />
                        Vos données sont protégées et ne sont pas partagées.
                    </p>
                </div>

            </div>
        </div>
    );
}
