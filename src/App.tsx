import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, CheckCircle, AlertCircle, MessageSquare, Award, Play, Square, Lightbulb, Clock, HelpCircle, Crown } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/lib/supabase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '@/hooks/useAuth';
import NavBar from '@/components/NavBar';
import AuthModal from '@/components/AuthModal';
import GuestResultsView, { GuestFlashReport } from '@/components/GuestResultsView';
import Dashboard from '@/components/Dashboard';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type JuryType = 'Bienveillant' | 'Stressant';
type ModalReason = 'launch' | 'stats' | null;
type ActiveView = 'oral' | 'dashboard';

// Durée maximale en secondes pour les utilisateurs non connectés
const GUEST_MAX_SECONDS = 120; // 2 minutes

// Durée maximale en secondes pour les utilisateurs connectés
const CONNECTED_MAX_SECONDS = 5 * 60;  // 5 minutes (compte gratuit)
const PRO_MAX_SECONDS = 15 * 60;        // 15 minutes (abonné Pro)

// Clé sessionStorage pour persister la transcription avant redirect OAuth
const PENDING_KEY = 'jurymaster_pending_analysis';

interface RadarDataPoint {
  subject: string;
  A: number;
  fullMark: number;
  explanation: string;
}

interface FeedbackReport {
  globalScore: number;
  globalScoreExplanation: string;
  fillerWords: string[];
  radarData: RadarDataPoint[];
  feedback: string;
  contentSuggestions: string;
  questions?: string[];
}

export default function App() {
  const { user, profile, isLoading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } = useAuth();

  const [juryType, setJuryType] = useState<JuryType>('Bienveillant');
  const [subject, setSubject] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [interimTranscription, setInterimTranscription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Vérification...");
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Clé pour forcer le re-fetch du Dashboard après une nouvelle analyse
  const [dashboardKey, setDashboardKey] = useState(0);
  // Vue active (navigation header)
  const [activeView, setActiveView] = useState<ActiveView>('oral');
  // Quota journalier de l'utilisateur connecté (en secondes)
  const [quotaSecondsUsed, setQuotaSecondsUsed] = useState(0);

  const sessionStartTimeRef = useRef<number>(0);
  const isProModeRef = useRef(false);
  const isGuestModeRef = useRef(true);

  // ─── Device ID (Traceur local RGPD-compliant anti-fraude) ───────────────────
  const [deviceId, setDeviceId] = useState<string>('');
  const deviceIdRef = useRef<string>('');

  useEffect(() => {
    let id = localStorage.getItem('jurymaster_device_id');
    if (!id) {
      // Génère une ID aléatoire stockée uniquement en local
      id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      localStorage.setItem('jurymaster_device_id', id);
    }
    setDeviceId(id);
    deviceIdRef.current = id;
  }, []);

  // ─── Loading message rotation ───────────────────────────────────────────────
  useEffect(() => {
    if (!isStarting) {
      setLoadingMessage("Vérification...");
      return;
    }

    const SUBJECT_MESSAGES = [
      'Analyse sémantique du sujet...',
      'Briefing des experts sur la thématique...',
      'Préparation du jury spécialisé...'
    ];

    const GENERAL_MESSAGES = [
      'Préparation de la salle d\'examen...',
      'Mise en place des jurés...',
      'Initialisation de la session libre...'
    ];

    const CONCOURS_MESSAGES = [
      'Tirage au sort de votre jury...',
      'Vérification de la grille d\'évaluation...',
      'Ouverture de la session...'
    ];

    const PRO_IA_MESSAGES = [
      'Calibrage des modèles d\'écoute...',
      'Synchronisation des processeurs d\'analyse...',
      'Initialisation du coach IA...'
    ];

    const PREMIUM_MESSAGES = [
      'Optimisation du jury haute fidélité...',
      'Activation des analyses avancées...'
    ];

    let pool = subject.trim() ? [...SUBJECT_MESSAGES] : [...GENERAL_MESSAGES];
    pool = [...pool, ...CONCOURS_MESSAGES, ...PRO_IA_MESSAGES];
    if (profile?.is_pro) {
      pool = [...pool, ...PREMIUM_MESSAGES];
    }

    let index = 0;
    setLoadingMessage(pool[index]);

    const interval = setInterval(() => {
      index = (index + 1) % pool.length;
      setLoadingMessage(pool[index]);
    }, 700);

    return () => clearInterval(interval);
  }, [isStarting, subject, profile?.is_pro]);

  // Auth modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalReason, setModalReason] = useState<ModalReason>(null);

  // Limites et utilisation
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const fetchUsageCount = useCallback(async () => {
    let devId = localStorage.getItem('jurymaster_device_id');
    if (!devId) return;
    try {
      const { data, error } = await (supabase.rpc as any)('get_daily_usage', { p_device_id: devId });
      if (!error && data !== null) {
        setUsageCount(data as number);
      }
    } catch (e) {
      console.error('Erreur chargement usage:', e);
    }
  }, []);

  useEffect(() => {
    fetchUsageCount();
  }, [fetchUsageCount, user]);

  const maxSessions = profile?.is_pro ? 50 : (user ? 3 : 1);
  const remainingSessions = usageCount !== null ? Math.max(0, maxSessions - usageCount) : maxSessions;

  // ─── Chargement quota journalier (pour barre de progression header) ──────────
  const fetchQuota = useCallback(async () => {
    if (!user || profile?.is_pro) return; // Pro : pas de quota
    try {
      let deviceId = localStorage.getItem('jurymaster_device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        localStorage.setItem('jurymaster_device_id', deviceId);
      }

      const { data, error } = await supabase.functions.invoke('session-quota', {
        body: { action: 'check', device_id: deviceId }
      });

      if (error) throw error;

      // La fonction renvoie seconds_used comme le max entre device usage et user usage
      setQuotaSecondsUsed(data?.seconds_used ?? 0);
    } catch (e) {
      console.error('[quota] Erreur chargement quota:', e);
    }
  }, [user, profile?.is_pro]);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  // ─── Guest session timer ────────────────────────────────────────────────────
  const [guestSecondsLeft, setGuestSecondsLeft] = useState(GUEST_MAX_SECONDS);
  const [showUpsell, setShowUpsell] = useState(false);
  // Flash report (lite) capturé pour l'écran guest
  const [capturedFlashReport, setCapturedFlashReport] = useState<GuestFlashReport | null>(null);
  // Toast "Mode Stressant réservé aux membres"
  const [showStressantToast, setShowStressantToast] = useState(false);
  // Indique qu'on est en train de récupérer une session guest après connexion
  const [isRecoveringSession, setIsRecoveringSession] = useState(false);
  const guestTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Connected user session timer ───────────────────────────────────────────
  const [connectedSecondsLeft, setConnectedSecondsLeft] = useState(0);
  const [showConnectedSessionEnd, setShowConnectedSessionEnd] = useState(false);
  const connectedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggerConnectedLimitReachedRef = useRef<() => Promise<void>>(async () => { });

  const recognitionRef = useRef<any>(null);
  // Ref miroir de isRecording pour les event handlers (évite les closures stale)
  const isRecordingRef = useRef(false);
  // ─── Refs miroirs transcription (fix closure stale du timer) ────────────────
  // Le setInterval capture la transcription au moment du démarrage du timer.
  // Ces refs gardent toujours la valeur courante, lisible par n'importe quel callback.
  const transcriptionRef = useRef('');
  const interimTranscriptionRef = useRef('');
  // Ref vers la dernière version de triggerGuestLimitReached
  const triggerGuestLimitReachedRef = useRef<() => Promise<void>>(async () => { });

  // ─── Reconnaissance vocale (initialisation) ─────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setTranscription((prev) => {
            const next = prev + finalTranscript;
            transcriptionRef.current = next;   // ← sync ref
            return next;
          });
        }
        setInterimTranscription(interimTranscript);
        interimTranscriptionRef.current = interimTranscript;  // ← sync ref
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        // 'no-speech' et 'aborted' sont normaux (silence ou arrêt manuel) → on ignore
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setError(`Erreur de reconnaissance vocale: ${event.error}`);
          isRecordingRef.current = false;
          setIsRecording(false);
        }
      };

      // ── Auto-restart après silence : Chrome coupe la reconnaissance après
      // quelques secondes sans voix. On redémarre si on est encore en recording.
      recognition.onend = () => {
        if (isRecordingRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Peut échouer si déjà en train de redémarrer, on ignore
          }
        }
      };

      recognitionRef.current = recognition;
    } else {
      setError("Votre navigateur ne supporte pas la reconnaissance vocale (Web Speech API). Essayez sur Chrome.");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // ─── Timer guest : compte à rebours pendant l'enregistrement ────────────────
  const stopGuestTimer = useCallback(() => {
    if (guestTimerRef.current) {
      clearInterval(guestTimerRef.current);
      guestTimerRef.current = null;
    }
  }, []);

  const triggerGuestLimitReached = useCallback(async () => {
    stopGuestTimer();
    isRecordingRef.current = false;  // ← bloquer le onend restart avant le stop
    setIsRecording(false);
    try { recognitionRef.current?.stop(); } catch (_) { /* ignore */ }

    // ← Lire les refs (pas les state) pour avoir la transcription à jour
    const finalText = transcriptionRef.current + interimTranscriptionRef.current;

    // Toujours analyser, même avec peu de texte
    setIsAnalyzing(true);
    setError(null);
    setShowUpsell(true); // Afficher immédiatement la section (loader visible)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-oral', {
        body: {
          type: 'guest',
          transcript: finalText,
          juryType,
          subject,
          device_id: deviceIdRef.current,
        },
      });

      if (fnError) {
        if (fnError.message?.includes('RATE_LIMIT_REACHED')) {
          setShowLimitModal(true);
          return;
        }
        throw fnError;
      }
      if ((data as any)?.error === 'RATE_LIMIT_REACHED') {
        setShowLimitModal(true);
        return;
      }

      const parsed = data as GuestFlashReport;
      // Clamp globalScore entre 0 et 20
      parsed.globalScore = Math.min(20, Math.max(0, Math.round(parsed.globalScore * 10) / 10));
      // Clamp chaque score radar
      parsed.radarData = parsed.radarData.map((d: GuestFlashReport['radarData'][number]) => ({
        ...d,
        A: Math.min(20, Math.max(0, Math.round(d.A * 10) / 10)),
        fullMark: 20,
      }));
      setCapturedFlashReport(parsed);
      fetchUsageCount();
    } catch (err) {
      console.error('Erreur analyse guest:', err);
      // L'écran upsell s'affiche quand même (showUpsell=true), sans score
    } finally {
      setIsAnalyzing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [juryType, subject, stopGuestTimer]); // ← transcription/interim lus via refs, pas en deps

  // Synchronise la ref vers la dernière version de triggerGuestLimitReached
  useEffect(() => {
    triggerGuestLimitReachedRef.current = triggerGuestLimitReached;
  }, [triggerGuestLimitReached]);

  const startGuestTimer = useCallback(() => {
    setGuestSecondsLeft(GUEST_MAX_SECONDS);
    guestTimerRef.current = setInterval(() => {
      setGuestSecondsLeft((prev) => {
        if (prev <= 1) {
          // ← Appel via ref = toujours la version la plus récente (fix closure stale)
          triggerGuestLimitReachedRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []); // ← aucune dep : le ref se met à jour automatiquement

  // Nettoyage du timer au démontage
  useEffect(() => () => stopGuestTimer(), [stopGuestTimer]);

  // ─── Timer connecté (non-guest) ─────────────────────────────────────────────
  const stopConnectedTimer = useCallback(() => {
    if (connectedTimerRef.current) {
      clearInterval(connectedTimerRef.current);
      connectedTimerRef.current = null;
    }
  }, []);

  const triggerConnectedLimitReached = useCallback(async () => {
    stopConnectedTimer();
    isRecordingRef.current = false;
    setIsRecording(false);
    try { recognitionRef.current?.stop(); } catch (_) { /* ignore */ }

    if (sessionStartTimeRef.current > 0) {
      const elapsedSeconds = Math.round((Date.now() - sessionStartTimeRef.current) / 1000);
      if (!isGuestModeRef.current && !isProModeRef.current) {
        supabase.functions.invoke('session-quota', {
          method: 'POST',
          body: { action: 'record', seconds_used: elapsedSeconds, device_id: deviceIdRef.current }
        }).then(() => {
          fetchQuota(); // Rafraîchit la barre NavBar
        }).catch(err => console.error("Erreur quota POST:", err));
      }
      sessionStartTimeRef.current = 0;
    }

    const finalText = transcriptionRef.current + interimTranscriptionRef.current;
    setShowConnectedSessionEnd(true);

    if (finalText.trim().length >= 10) {
      await analyzeTranscription(finalText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopConnectedTimer]);

  // Synchronise la ref vers la dernière version de triggerConnectedLimitReached
  useEffect(() => {
    triggerConnectedLimitReachedRef.current = triggerConnectedLimitReached;
  }, [triggerConnectedLimitReached]);

  const startConnectedTimer = useCallback((maxSeconds: number) => {
    setConnectedSecondsLeft(maxSeconds);
    setShowConnectedSessionEnd(false);
    connectedTimerRef.current = setInterval(() => {
      setConnectedSecondsLeft((prev) => {
        if (prev <= 1) {
          triggerConnectedLimitReachedRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Nettoyage du timer connecté au démontage
  useEffect(() => () => stopConnectedTimer(), [stopConnectedTimer]);

  // ─── Helpers pour actions protégées ─────────────────────────────────────────
  const requireAuth = (reason: 'launch' | 'stats'): boolean => {
    if (user) return true;
    setModalReason(reason);
    setModalOpen(true);
    return false;
  };

  // ─── Enregistrement ──────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (usageCount !== null && remainingSessions <= 0) {
      setShowLimitModal(true);
      return;
    }

    setError(null);
    setReport(null);
    setTranscription('');
    setInterimTranscription('');
    setShowUpsell(false);
    setCapturedFlashReport(null);
    setShowConnectedSessionEnd(false);
    setIsStarting(true);

    const isPro = profile?.is_pro ?? false;
    isProModeRef.current = isPro;
    isGuestModeRef.current = !user;

    if (!user) {
      startGuestTimer();
      finishStartingRecording();
      return;
    }

    let allowedDuration = isPro ? PRO_MAX_SECONDS : CONNECTED_MAX_SECONDS;

    // Vérification quota si connecté non-pro
    if (!isPro) {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('session-quota', {
          method: 'POST',
          body: { action: 'check', device_id: deviceId }
        });
        if (fnError) throw fnError;

        if (data?.quota_reached) {
          setError("⏳ Quota journalier de 5 minutes atteint. L'usage gratuit est limité pour cet appareil ou ce compte. Revenez demain ou devenez Mentor !");
          setIsStarting(false);
          return;
        }

        const secondsLeft = data?.seconds_left ?? CONNECTED_MAX_SECONDS;
        allowedDuration = Math.min(CONNECTED_MAX_SECONDS, secondsLeft);
      } catch (e) {
        console.error("Erreur vérification quota:", e);
      }
    }

    startConnectedTimer(allowedDuration);
    finishStartingRecording();
  };

  const finishStartingRecording = () => {
    sessionStartTimeRef.current = Date.now();
    isRecordingRef.current = true;
    setIsRecording(true);
    setIsStarting(false);

    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.error(e);
    }
  };

  const stopRecording = async () => {
    stopGuestTimer();
    stopConnectedTimer();
    isRecordingRef.current = false;  // ← en premier pour bloquer le onend restart
    setIsRecording(false);
    try {
      recognitionRef.current?.stop();
    } catch (e) {
      console.error(e);
    }

    if (sessionStartTimeRef.current > 0) {
      const elapsedSeconds = Math.round((Date.now() - sessionStartTimeRef.current) / 1000);
      if (!isGuestModeRef.current && !isProModeRef.current) {
        supabase.functions.invoke('session-quota', {
          method: 'POST',
          body: { action: 'record', seconds_used: elapsedSeconds, device_id: deviceIdRef.current }
        }).then(() => {
          fetchQuota(); // Rafraîchit la barre NavBar
        }).catch(err => console.error("Erreur quota POST:", err));
      }
      sessionStartTimeRef.current = 0;
    }

    const finalFullTranscription = transcription + interimTranscription;
    if (finalFullTranscription.trim().length < 10) {
      setError("La transcription est trop courte pour être analysée.");
      return;
    }

    // Guest qui stoppe manuellement → Upsell (on analyse pour le score flouté)
    if (!user) {
      await triggerGuestLimitReached();
      return;
    }

    await analyzeTranscription(finalFullTranscription);
  };

  const analyzeTranscription = async (text: string, juryOverride?: JuryType, subjectOverride?: string) => {
    setIsAnalyzing(true);
    setError(null);

    const effectiveJury = juryOverride ?? juryType;
    const effectiveSubject = subjectOverride ?? subject;

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-oral', {
        body: {
          type: 'full',
          transcript: text,
          juryType: effectiveJury,
          subject: effectiveSubject,
          device_id: deviceIdRef.current,
        },
      });

      if (fnError) {
        if (fnError.message?.includes('RATE_LIMIT_REACHED')) {
          setShowLimitModal(true);
          return;
        }
        throw fnError;
      }
      if ((data as any)?.error === 'RATE_LIMIT_REACHED') {
        setShowLimitModal(true);
        return;
      }

      const parsedReport = data as FeedbackReport;
      setReport(parsedReport);

      // ── Sauvegarde en base Supabase si l'utilisateur est connecté ────────
      if (user) {
        try {
          const { error: insertErr } = await (supabase.from('sessions') as any).insert({
            user_id: user.id,
            subject_name: effectiveSubject?.trim() || 'Session libre',
            score_global: parsedReport.globalScore,
            analysis_json: {
              globalScoreExplanation: parsedReport.globalScoreExplanation,
              fillerWords: parsedReport.fillerWords,
              radarData: parsedReport.radarData,
              feedback: parsedReport.feedback,
              contentSuggestions: parsedReport.contentSuggestions,
              juryType: effectiveJury,
            },
          });
          if (insertErr) {
            console.error('[DB] Erreur sauvegarde session:', insertErr);
          } else {
            // Déclenche le refresh du dashboard
            setDashboardKey((k) => k + 1);
          }
        } catch (saveErr) {
          console.error('[DB] Exception sauvegarde session:', saveErr);
        }
      }
      fetchUsageCount();
    } catch (err: any) {
      console.error("Erreur d'analyse complète:", err);
      const detail = err?.message || err?.toString() || 'Erreur inconnue';
      setError(`Erreur IA : ${detail}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ─── Formatage du timer ──────────────────────────────────────────────────────
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─── Récupération session guest après connexion OAuth ─────────────────────────
  // Après la redirection OAuth, l'utilisateur revient connecté mais son
  // state React (transcription) a été perdu. On le récupère depuis sessionStorage.
  useEffect(() => {
    if (!user || isLoading) return;

    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return;

    try {
      const { transcription: savedText, juryType: savedJury, subject: savedSubject } =
        JSON.parse(raw) as { transcription: string; juryType: JuryType; subject: string };

      // Nettoyer immédiatement pour éviter les doubles déclenchements
      sessionStorage.removeItem(PENDING_KEY);

      if (savedText.trim().length < 10) return;

      // Restaurer le contexte et lancer l'analyse complète
      setIsRecoveringSession(true);
      setJuryType(savedJury);
      setSubject(savedSubject);
      setTranscription(savedText);

      // Petit délai pour que les states se mettent à jour avant l'analyse
      setTimeout(async () => {
        setIsRecoveringSession(false);
        await analyzeTranscription(savedText, savedJury, savedSubject);
      }, 300);
    } catch (e) {
      console.error('[Recovery] Erreur lecture sessionStorage:', e);
      sessionStorage.removeItem(PENDING_KEY);
    }
    // analyzeTranscription est stable (définie plush bas), on la passe en dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);

  // ─── Wrapper signIn : sauvegarde la transcription avant le redirect OAuth ───
  const signInWithGoogleAndSave = async () => {
    const textToSave = transcriptionRef.current + interimTranscriptionRef.current;
    if (textToSave.trim().length >= 3) {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({
        transcription: textToSave,
        juryType,
        subject,
      }));
    }
    await signInWithGoogle();
  };

  // ─── Loader initial session ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-900 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm animate-pulse">Chargement...</p>
        </div>
      </div>
    );
  }

  // ─── Mode maintenance ──────────────────────────────────────────────────────────
  const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === 'true';
  const WHITELISTED_EMAILS = [
    'laurent.chalon.nl25@gmail.com',
    'laurentchalon1@gmail.com',
    'lauuchalon@gmail.com',
  ];
  const isWhitelisted = user?.email && WHITELISTED_EMAILS.includes(user.email.toLowerCase());

  if (MAINTENANCE_MODE && !isWhitelisted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Logo / icône */}
          <div className="w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center mx-auto">
            <span className="text-4xl">⚙️</span>
          </div>

          {/* Titre */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Jury<span className="text-indigo-400">Master</span>
            </h1>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">
              Maintenance en cours
            </p>
          </div>

          {/* Message */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left space-y-3">
            <p className="text-slate-200 font-semibold text-sm">
              🚧 Nous améliorons JuryMaster pour vous !
            </p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Une mise à jour importante est en cours de déploiement. Le service sera de nouveau disponible très prochainement.
            </p>
            <p className="text-slate-500 text-xs">
              Merci pour votre patience. 🙏
            </p>
          </div>

          {/* Connexion admin discrète */}
          {!user && (
            <button
              onClick={() => { setModalReason('launch'); setModalOpen(true); }}
              className="text-slate-700 hover:text-slate-500 text-xs transition-colors underline underline-offset-4"
            >
              Connexion administrateur
            </button>
          )}
          {user && !isWhitelisted && (
            <p className="text-slate-700 text-xs">
              Connecté en tant que {user.email} — accès non autorisé pendant la maintenance.
            </p>
          )}
        </div>

        {/* AuthModal nécessaire pour le bouton connexion admin */}
        <AuthModal
          isOpen={modalOpen}
          reason={modalReason}
          onClose={() => setModalOpen(false)}
          onSignIn={signInWithGoogle}
          onSignInWithEmail={signInWithEmail}
          onSignUpWithEmail={signUpWithEmail}
        />
      </div>
    );
  }

  // Callback de reset démo (réutilisé dans PartialResultsView)
  const handleContinueDemo = () => {
    setShowUpsell(false);
    setReport(null);
    setTranscription('');
    setInterimTranscription('');
    setCapturedFlashReport(null);
  };

  // ─── Render principal ─────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen font-sans selection:bg-blue-100 selection:text-blue-900"
      style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', transition: 'background-color 0.3s ease, color 0.3s ease' }}
    >

      {/* Modale d'incitation à la connexion */}
      <AuthModal
        isOpen={modalOpen}
        reason={modalReason}
        onClose={() => setModalOpen(false)}
        onSignIn={signInWithGoogle}
        onSignInWithEmail={signInWithEmail}
        onSignUpWithEmail={signUpWithEmail}
      />

      {/* Modale de limite atteinte */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-900 mb-2">Limite quotidienne atteinte</h3>
            <p className="text-slate-500 text-center text-sm mb-8">
              Vous avez épuisé vos sessions pour aujourd'hui. Revenez demain ou devenez Mentor pour un {user ? 'accès illimité' : 'accès étendu'} et d'autres avantages exclusifs.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowLimitModal(false); if (!user) { setModalReason('launch'); setModalOpen(true); } }}
                className={user
                  ? "w-full relative overflow-hidden group/btn bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 hover:from-amber-500 hover:to-orange-600 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-300 shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98]"
                  : "w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all shadow-md shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98]"}
              >
                {user && <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] -translate-x-[150%] animate-[shimmer_2s_infinite]" />}
                <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-sm">
                  {user && <Crown className="w-5 h-5 text-orange-50" />}
                  {user ? 'Devenir Mentor' : 'Créer un compte gratuit'}
                </span>
              </button>
              <button
                onClick={() => setShowLimitModal(false)}
                className="w-full text-slate-500 hover:text-slate-700 font-medium py-3 rounded-xl transition-colors hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header dynamique */}
      <NavBar
        user={user}
        profile={profile}
        onSignIn={signInWithGoogleAndSave}
        onSignOut={signOut}
        activeView={activeView}
        onNavigate={(view) => {
          setActiveView(view);
          // Navigation vers Nouvel Oral → reset les résultats précédents
          if (view === 'oral') {
            setReport(null);
            setShowUpsell(false);
            setCapturedFlashReport(null);
          }
        }}
        quotaSecondsUsed={quotaSecondsUsed}
        quotaSecondsMax={CONNECTED_MAX_SECONDS}
      />


      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* VUE DASHBOARD (user connecté + onglet Dashboard actif)     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeView === 'dashboard' && user && (
          <Dashboard refreshTrigger={dashboardKey} isPro={profile?.is_pro ?? false} />
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* VUE ORAL (default + guest)                                  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeView === 'oral' && (
          <>
            {/* Bannière guest mode */}
            {!user && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👋</span>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">Bienvenue en mode démo !</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Testez l'interface avec <strong>2 minutes d'oral gratuit</strong>. Connectez-vous pour des sessions complètes.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setModalReason('launch'); setModalOpen(true); }}
                  className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                >
                  Créer un compte gratuit →
                </button>
              </div>
            )}

            {/* Espace Entraînement */}
            <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight">Espace d'Entraînement</h2>
                  <p className="text-slate-500">
                    Préparez votre oral face à votre jury.
                    {!user && <span className="text-amber-600 font-medium"> · 2 min max en mode démo</span>}
                  </p>
                </div>

                {/* ── Choix du type de jury ── */}
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm font-medium text-slate-500">Type de jury</p>
                  <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl">
                    {(['Bienveillant', 'Stressant'] as const).map((type) => {
                      const isPro = user !== null && (profile?.is_pro ?? false);
                      const isLocked = type === 'Stressant' && !isPro;
                      const isActive = juryType === type;
                      return (
                        <div key={type} className="relative group">
                          <button
                            onClick={() => { if (!isLocked) setJuryType(type); }}
                            disabled={isRecording || isAnalyzing}
                            className={[
                              'flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200',
                              isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                              isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                            ].join(' ')}
                          >
                            {isLocked && <span className="text-xs">🔒</span>}
                            {type === 'Bienveillant' ? '😊' : '😤'} {type}
                          </button>
                          {/* Tooltip ⭐ Option Premium pour Stressant (toujours, qu'on soit guest ou non) */}
                          {isLocked && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <div className="bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl relative">
                                ⭐ Option Premium
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="w-full max-w-2xl text-left space-y-2">
                  <label htmlFor="subject" className="block text-sm font-medium text-slate-700 ml-1">
                    Sujet de l'oral (optionnel)
                  </label>
                  <input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={isRecording || isAnalyzing}
                    placeholder="Ex: Présentation de mon projet de fin d'études sur l'IA..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-50 transition-all"
                  />
                </div>

                {/* Indicateur de sessions restantes */}
                {usageCount !== null && !profile?.is_pro && (
                  <div className="bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm text-slate-600 font-medium w-full max-w-sm mx-auto">
                    <Activity className="w-4 h-4 text-slate-400" />
                    <span>Sessions restantes aujourd'hui :</span>
                    <span className={remainingSessions > 0 ? "text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100" : "text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-md border border-red-100"}>
                      {remainingSessions}/{maxSessions}
                    </span>
                  </div>
                )}

                {/* Visualiseur d'ondes */}
                <div className="h-24 w-full max-w-md flex items-center justify-center gap-1">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1.5 bg-blue-500 rounded-full transition-all duration-150",
                        isRecording ? "animate-pulse" : "h-2 opacity-20"
                      )}
                      style={{
                        height: isRecording ? `${Math.max(10, Math.random() * 60 + 20)}px` : '8px',
                        animationDelay: `${i * 0.05}s`
                      }}
                    />
                  ))}
                </div>

                {/* Timer guest (visible pendant l'enregistrement) */}
                {isRecording && !user && (
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors",
                    guestSecondsLeft <= 30
                      ? "bg-red-50 text-red-600 border border-red-200 animate-pulse"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  )}>
                    <Clock className="w-4 h-4" />
                    Temps restant : {formatTimer(guestSecondsLeft)}
                  </div>
                )}

                {/* Timer connecté (visible pendant l'enregistrement) */}
                {isRecording && user && (
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors",
                    connectedSecondsLeft <= 60
                      ? "bg-red-50 text-red-600 border border-red-200 animate-pulse"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  )}>
                    <Clock className="w-4 h-4" />
                    Temps restant : {formatTimer(connectedSecondsLeft)}
                    {!(profile?.is_pro) && (
                      <span className="ml-1 text-[10px] font-medium text-slate-400">(Quota 5 min/jour)</span>
                    )}
                  </div>
                )}

                {/* Contrôles */}
                <div className="flex items-center gap-4">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      disabled={isAnalyzing || isStarting}
                      className="flex items-center gap-2 px-8 py-3.5 rounded-full font-bold transition-all duration-300 disabled:opacity-50 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {isStarting ? (
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0" />
                      ) : (
                        <Play className="w-5 h-5 fill-current flex-shrink-0" />
                      )}
                      <span className="truncate">{isStarting ? loadingMessage : "Lancer l'oral"}</span>
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-8 py-3.5 rounded-full font-bold transition-all duration-300 shadow-xl shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Square className="w-5 h-5 fill-current" />
                      Terminer l'oral
                    </button>
                  )}
                </div>

                {/* Zone de transcription */}
                <div className="w-full max-w-2xl text-left bg-slate-50 rounded-2xl p-6 min-h-[160px] border border-slate-100 relative">
                  <div className="absolute top-4 right-4 flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    <Activity className="w-4 h-4" />
                    Transcription en direct
                  </div>
                  <p className="text-slate-700 leading-relaxed mt-6 whitespace-pre-wrap">
                    {transcription}
                    <span className="text-slate-400">{interimTranscription}</span>
                    {!transcription && !interimTranscription && !isRecording && (
                      <span className="text-slate-400 italic">Votre discours apparaîtra ici...</span>
                    )}
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                  </div>
                )}
              </div>
            </section>

            {/* Loading State */}
            {isAnalyzing && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-slate-500 font-medium animate-pulse">Le jury délibère...</p>
              </div>
            )}

            {/* Banner de récupération de session après connexion */}
            {isRecoveringSession && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl px-6 py-4 flex items-center gap-4">
                <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />
                <div>
                  <p className="text-blue-900 font-semibold text-sm">🎓 On reprend ton oral !</p>
                  <p className="text-blue-600 text-xs mt-0.5">L'analyse complète de ta session démo est en cours...</p>
                </div>
              </div>
            )}

            {/* Bannière fin de session connecté non-pro */}
            {showConnectedSessionEnd && user && !isAnalyzing && !(profile?.is_pro) && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-100 rounded-xl p-2.5 flex-shrink-0">
                    <Clock className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">⏱️ Session de 5 min écoulée</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Passez à l'abonnement <span className="font-semibold text-indigo-600">Mentor</span> pour des sessions de <strong>15 minutes</strong> sans interruption.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setModalReason('launch'); setModalOpen(true); }}
                  className="flex-shrink-0 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-indigo-200 whitespace-nowrap"
                >
                  ⭐ Devenir Mentor
                </button>
              </div>
            )}

            {/* Résultats Flash guests (après 2 min) */}
            {showUpsell && !user && !isAnalyzing && capturedFlashReport && (
              <GuestResultsView
                report={capturedFlashReport}
                onSignIn={signInWithGoogleAndSave}
                onContinueDemo={handleContinueDemo}
              />
            )}

            {/* Fallback minimal si transcription vraiment vide */}
            {showUpsell && !user && !isAnalyzing && !capturedFlashReport && (
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center space-y-4">
                <p className="text-slate-500 text-sm">⏱️ Ton oral était trop court pour être analysé. Connecte-toi pour des sessions complètes.</p>
                <button onClick={signInWithGoogleAndSave} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-2xl text-sm transition-all">
                  Se connecter
                </button>
                <button onClick={handleContinueDemo} className="block mx-auto text-slate-400 hover:text-slate-600 text-xs underline underline-offset-4">
                  Continuer sans résultats
                </button>
              </div>
            )}

          </>
        )}

        {/* Dashboard de Résultats (uniquement pour les users connectés, dans la vue Oral) */}
        {activeView === 'oral' && report && !isAnalyzing && user && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-semibold tracking-tight">Rapport du Jury</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Score Global */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl mb-4">
                  <Award className="w-8 h-8" />
                </div>
                <h3 className="text-slate-500 font-medium mb-2">Score Global</h3>
                <div className="text-6xl font-bold tracking-tighter text-slate-900 mb-4">
                  {report.globalScore}
                  <span className="text-2xl text-slate-400 font-medium">/100</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4 w-full">
                  {report.globalScoreExplanation}
                </p>
              </div>

              {/* Radar Chart */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 md:col-span-2 flex flex-col">
                <h3 className="text-slate-900 font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Analyse des compétences
                </h3>
                <div className="flex-1 w-full min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={report.radarData}>
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
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Détail des compétences */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 md:col-span-3">
                <h3 className="text-slate-900 font-semibold mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Détail de l'évaluation par critère
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {report.radarData.map((data, i) => (
                    <div key={i} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-slate-900">{data.subject}</h4>
                        <span className="text-blue-600 font-bold bg-blue-100 px-2.5 py-1 rounded-lg text-sm">{data.A}/100</span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{data.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feedback du Jury */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 md:col-span-2">
                <h3 className="text-slate-900 font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                  Retour du Jury ({juryType})
                </h3>
                <p className="text-slate-700 leading-relaxed">
                  {report.feedback}
                </p>
              </div>

              {/* Tics de langage */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
                <h3 className="text-slate-900 font-semibold mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Tics de langage
                </h3>
                {report.fillerWords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {report.fillerWords.map((word, i) => (
                      <span key={i} className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-medium border border-amber-100">
                        "{word}"
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-xl text-sm font-medium">
                    <CheckCircle className="w-5 h-5" />
                    Aucun tic de langage détecté !
                  </div>
                )}
              </div>

              {/* Pistes d'amélioration */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 md:col-span-3">
                <h3 className="text-slate-900 font-semibold mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  Pistes d'amélioration sur le fond
                </h3>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {report.contentSuggestions}
                </p>
              </div>

              {/* Module Questions du Jury (Pro uniquement) */}
              {profile?.is_pro && report.questions && report.questions.length > 0 && (
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-indigo-100 md:col-span-3">
                  <h3 className="text-indigo-600 font-semibold mb-4 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5" />
                    Questions possibles du jury
                  </h3>
                  <ul className="space-y-3">
                    {report.questions.map((q: string, i: number) => (
                      <li
                        key={i}
                        className="p-4 rounded-xl text-sm leading-relaxed font-semibold transition-colors bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100/70"
                      >
                        <span className="font-bold mr-2 text-indigo-600">
                          Q{i + 1}.
                        </span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          </section>
        )}
      </main>
    </div >
  );
}
