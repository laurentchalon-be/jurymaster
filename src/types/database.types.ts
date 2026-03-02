// ============================================================
// JuryMaster - Types TypeScript pour le schéma Supabase
// Généré manuellement - peut être régénéré via : supabase gen types typescript
// ============================================================

// ---- Enums ----

export type UserLevel = 'lycee' | 'licence' | 'master';
export type PlanStatus = 'free' | 'active' | 'expired';


// ---- Table : profiles ----

export interface Profile {
    id: string;           // uuid, PK, lié à auth.users
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    level: UserLevel;
    exam_date: string | null; // ISO 8601 date string (YYYY-MM-DD)
    created_at: string;       // ISO 8601 timestamp
    is_pro: boolean;          // true si l'utilisateur a un accès premium
}

export type ProfileInsert = Omit<Profile, 'created_at'>;
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at'>>;


// ---- Table : subscriptions ----

export interface Subscription {
    id: string;                       // uuid, PK
    user_id: string;                  // uuid, FK vers profiles
    stripe_customer_id: string | null;
    plan_status: PlanStatus;
    current_period_end: string | null; // ISO 8601 timestamp
    updated_at: string;                // ISO 8601 timestamp
}

export type SubscriptionInsert = Omit<Subscription, 'id' | 'updated_at'>;
export type SubscriptionUpdate = Partial<Omit<Subscription, 'id' | 'user_id'>>;


// ---- Table : sessions ----

// Structure typée du champ analysis_json
export interface SessionAnalysis {
    scores: {
        structure: number;       // 0-100
        argumentation: number;   // 0-100
        elocution: number;       // 0-100
        gestion_stress: number;  // 0-100
    };
    tics_langage: string[];          // ex: ["euh", "donc", "voilà"]
    points_positifs: string[];
    axes_amelioration: string[];
    conseils: string[];
}

export interface Session {
    id: string;                        // uuid, PK
    user_id: string;                   // uuid, FK vers profiles
    subject_name: string;
    transcript: string | null;
    score_global: number | null;       // 0-100
    analysis_json: SessionAnalysis | null; // JSONB typé
    created_at: string;                // ISO 8601 timestamp
}

export type SessionInsert = Omit<Session, 'id' | 'created_at'>;
export type SessionUpdate = Partial<Omit<Session, 'id' | 'user_id' | 'created_at'>>;


// ---- Type global de la Database (pour createClient<Database>()) ----

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: Profile;
                Insert: ProfileInsert;
                Update: ProfileUpdate;
            };
            subscriptions: {
                Row: Subscription;
                Insert: SubscriptionInsert;
                Update: SubscriptionUpdate;
            };
            sessions: {
                Row: Session;
                Insert: SessionInsert;
                Update: SessionUpdate;
            };
        };
        Enums: {
            user_level: UserLevel;
            plan_status: PlanStatus;
        };
    };
}
