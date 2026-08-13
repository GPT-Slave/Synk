"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const supportedLocales = [
  "en",
  "fr",
  "ar",
  "ja",
  "zh",
  "es",
  "pt",
  "ru",
  "de",
  "nl",
  "hi",
] as const;

export type SynkLocale = (typeof supportedLocales)[number];

export const localeNames: Record<SynkLocale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
  ja: "日本語",
  zh: "中文",
  es: "Español",
  pt: "Português",
  ru: "Русский",
  de: "Deutsch",
  nl: "Nederlands",
  hi: "हिन्दी",
};

const intlLocales: Record<SynkLocale, string> = {
  en: "en",
  fr: "fr",
  ar: "ar",
  ja: "ja",
  zh: "zh-CN",
  es: "es",
  pt: "pt-BR",
  ru: "ru",
  de: "de",
  nl: "nl",
  hi: "hi",
};

type Variables = Record<string, string | number>;

interface I18nValue {
  locale: SynkLocale;
  direction: "ltr" | "rtl";
  setLocale: (locale: SynkLocale) => void;
  t: (message: string, variables?: Variables) => string;
  formatDate: (
    value: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = "synk:language";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SynkLocale>("en");

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setLocaleState(readInitialLocale()),
      0,
    );
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    document.documentElement.lang = intlLocales[locale];
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((next: SynkLocale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Language selection still works when storage is unavailable.
    }
  }, []);

  const t = useCallback(
    (message: string, variables?: Variables) => {
      const translated = translations[locale]?.[message] ?? message;
      return interpolate(translated, variables);
    },
    [locale],
  );

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      direction: locale === "ar" ? "rtl" : "ltr",
      setLocale,
      t,
      formatDate: (input, options) =>
        new Intl.DateTimeFormat(intlLocales[locale], options).format(
          typeof input === "string" ? parseLocalDate(input) : input,
        ),
      formatNumber: (input, options) =>
        new Intl.NumberFormat(intlLocales[locale], options).format(input),
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider.");
  return value;
}

export function resolveLocale(language: string | null | undefined): SynkLocale {
  const normalized = language?.trim().toLowerCase().replace("_", "-");
  if (!normalized) return "en";
  const prefix = normalized.split("-")[0] as SynkLocale;
  return supportedLocales.includes(prefix) ? prefix : "en";
}

function readInitialLocale(): SynkLocale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && supportedLocales.includes(saved as SynkLocale)) {
      return saved as SynkLocale;
    }
  } catch {
    // Fall through to browser language detection.
  }
  return resolveLocale(navigator.languages?.[0] ?? navigator.language);
}

function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

function interpolate(message: string, variables?: Variables) {
  if (!variables) return message;
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(variables, key) ? String(variables[key]) : placeholder,
  );
}

type TranslationTable = Record<string, string>;

const translations: Partial<Record<SynkLocale, TranslationTable>> = {
  fr: {
    Language: "Langue",
    "Log in": "Se connecter",
    "Sign up": "S’inscrire",
    "Find the time that works for everyone.":
      "Trouvez l’heure qui convient à tout le monde.",
    "Scheduling without the back-and-forth":
      "Planifiez sans échanges interminables",
    "Create an availability poll, share one secure link, and see the perfect overlap. Participants never need an account.":
      "Créez un sondage, partagez un lien sécurisé et trouvez le créneau commun. Aucun compte n’est requis pour les participants.",
    "Create your first poll": "Créer votre premier sondage",
    "Organizer login": "Connexion organisateur",
    "Visual availability": "Disponibilités visuelles",
    "No participant accounts": "Aucun compte participant",
    "Find time. Together.": "Trouvons un créneau. Ensemble.",
    Dashboard: "Tableau de bord",
    "Your meetings": "Vos réunions",
    "Create meeting": "Créer une réunion",
    Upcoming: "À venir",
    Finalized: "Finalisées",
    Past: "Passées",
    "No meetings yet": "Aucune réunion",
    "Load more meetings": "Charger plus de réunions",
    "Back to meetings": "Retour aux réunions",
    "Meeting title": "Titre de la réunion",
    Description: "Description",
    optional: "facultatif",
    "Meeting duration": "Durée de la réunion",
    Timezone: "Fuseau horaire",
    Cancel: "Annuler",
    "Save changes": "Enregistrer",
    "Schedule window": "Période proposée",
    "Pick the days and hours visually":
      "Choisissez les jours et les heures visuellement",
    "Date range": "Plage de dates",
    Start: "Début",
    End: "Fin",
    "Previous month": "Mois précédent",
    "Next month": "Mois suivant",
    "Daily working hours": "Heures de disponibilité quotidiennes",
    "Choose the first time quarter": "Choisissez le premier quart d’heure",
    "Choose the last time quarter": "Choisissez le dernier quart d’heure",
    to: "à",
    "Select date": "Choisir une date",
    "Your availability": "Vos disponibilités",
    "Responding as": "Réponse de",
    "Save now": "Enregistrer",
    "Optional note": "Note facultative",
    "Availability saved": "Disponibilités enregistrées",
    "No schedule slots yet": "Aucun créneau",
    "Autosave ready": "Enregistrement auto prêt",
    "Changes pending": "Modifications en attente",
    "Saving…": "Enregistrement…",
    Saved: "Enregistré",
    "Not saved": "Non enregistré",
    "No heatmap data": "Aucune donnée de disponibilité",
    "No participants available": "Aucun participant disponible",
    available: "disponibles",
    "Top matches": "Meilleurs créneaux",
    "Create your own": "Choisir moi-même",
    Participants: "Participants",
    Responses: "Réponses",
    Schedule: "Horaire",
    "Copy invite": "Copier l’invitation",
    Copied: "Copié",
    "Lock responses": "Fermer les réponses",
    "Open responses": "Rouvrir les réponses",
    "Delete meeting": "Supprimer la réunion",
    "Remove participant": "Retirer le participant",
    Edit: "Modifier",
    "Open Google Meet": "Ouvrir Google Meet",
    "Who’s responding?": "Qui répond ?",
    "Continue to availability": "Continuer vers les disponibilités",
    "Use this name": "Utiliser ce nom",
    "Saved on this device": "Enregistré sur cet appareil",
    "Responses are closed": "Les réponses sont fermées",
    "Invitation not found": "Invitation introuvable",
    Email: "E-mail",
    Password: "Mot de passe",
    "Confirm password": "Confirmer le mot de passe",
    "Create organizer account": "Créer un compte organisateur",
    "Quarter-hour slots": "Créneaux de 15 minutes",
    "Each hour is split into four independently selectable quarters.":
      "Chaque heure est divisée en quatre quarts sélectionnables séparément.",
    "Loading…": "Chargement…",
    "Welcome back": "Bon retour",
    "Use another name": "Utiliser un autre nom",
    "Log out": "Se déconnecter",
    "Your availability could not be saved.":
      "Vos disponibilités n’ont pas pu être enregistrées.",
    "No matches yet": "Aucune correspondance",
    "Synk hit an unexpected problem. Your saved data is safe; retry the page to continue.":
      "Synk a rencontré un problème inattendu. Vos données sont en sécurité ; réessayez pour continuer.",
    "Something went wrong": "Un problème est survenu",
    "Welcome back. Your meetings and responses are waiting.":
      "Bon retour. Vos réunions et réponses vous attendent.",
    "Log in to Synk": "Connexion à Synk",
    "Create polls, share one secure link, and find the overlap.":
      "Créez des sondages, partagez un lien sécurisé et trouvez le créneau commun.",
    "Start organizing": "Commencer à organiser",
    "Signed in as": "Connecté en tant que",
    "Create a poll, share its private invitation link, and watch responses arrive.":
      "Créez un sondage, partagez son lien d’invitation privé et voyez les réponses arriver.",
    "Check that the API and database are running, then try again.":
      "Vérifiez que l’API et la base de données fonctionnent, puis réessayez.",
    "Could not load your meetings": "Impossible de charger vos réunions",
    "Create your first meeting": "Créer votre première réunion",
    "Your first availability poll takes less than a minute to create.":
      "Votre premier sondage de disponibilité prend moins d’une minute à créer.",
    "Define the window, then share the secure link with your participants.":
      "Définissez la période, puis partagez le lien sécurisé avec vos participants.",
    "Meeting deleted": "Réunion supprimée",
    "The invitation and all responses were removed.":
      "L’invitation et toutes les réponses ont été supprimées.",
    "Participant removed": "Participant supprimé",
    "{name} and their availability were removed.":
      "{name} et ses disponibilités ont été supprimés.",
    "The participant and their availability were removed.":
      "Le participant et ses disponibilités ont été supprimés.",
    "Responses locked": "Réponses verrouillées",
    "Responses reopened": "Réponses rouvertes",
    "Participants can view the invitation but cannot edit responses.":
      "Les participants peuvent voir l’invitation mais ne peuvent plus modifier leurs réponses.",
    "Participants can edit their availability again.":
      "Les participants peuvent à nouveau modifier leurs disponibilités.",
    "Meeting reopened": "Réunion rouverte",
    "Finalization was removed and responses are open again.":
      "La finalisation a été annulée et les réponses sont de nouveau ouvertes.",
    "Meeting scheduled": "Réunion planifiée",
    "The confirmed time is now visible to every participant.":
      "L’heure confirmée est maintenant visible par tous les participants.",
    "It may have been deleted, or it belongs to another organizer.":
      "Elle a peut-être été supprimée, ou elle appartient à un autre organisateur.",
    "Meeting not found": "Réunion introuvable",
    "Invitation copied": "Invitation copiée",
    "The private Synk link is ready to share.":
      "Le lien privé Synk est prêt à être partagé.",
    "Could not copy the link": "Impossible de copier le lien",
    "Your browser blocked clipboard access. Copy it from the address bar instead.":
      "Votre navigateur a bloqué l’accès au presse-papiers. Copiez-le depuis la barre d’adresse à la place.",
    "All meetings": "Toutes les réunions",
    "Re-open meeting": "Rouvrir la réunion",
    "Delete this meeting?": "Supprimer cette réunion ?",
    "This permanently removes the invitation, participant names, comments, and every availability response. This cannot be undone.":
      "Cela supprime définitivement l’invitation, les noms des participants, les commentaires et toutes les réponses de disponibilité. Cette action est irréversible.",
    "Keep meeting": "Garder la réunion",
    "Delete permanently": "Supprimer définitivement",
    "Remove this participant?": "Supprimer ce participant ?",
    "{name} and all of their availability will be permanently removed from this meeting.":
      "{name} et toutes ses disponibilités seront définitivement supprimés de cette réunion.",
    "This participant": "Ce participant",
    "Choose your meeting time": "Choisissez l’heure de votre réunion",
    "Live availability heatmap": "Carte de disponibilité en direct",
    "Edit meeting": "Modifier la réunion",
    "Meeting could not be loaded": "La réunion n’a pas pu être chargée",
    "Re-open the meeting from its dashboard before changing the schedule.":
      "Rouvrez la réunion depuis son tableau de bord avant de modifier le planning.",
    "This meeting is finalized": "Cette réunion est finalisée",
    "Back to meeting": "Retour à la réunion",
    "Return to meeting": "Revenir à la réunion",
    "Loading meeting form…": "Chargement du formulaire de réunion…",
    "Synk invitation": "Invitation Synk",
    "Restoring your response…": "Restauration de votre réponse…",
    "Choose a name saved on this device or enter a new one. Next, you'll select your available hours directly on the calendar.":
      "Choisissez un nom enregistré sur cet appareil ou saisissez-en un nouveau. Ensuite, sélectionnez vos disponibilités directement sur le calendrier.",
    "Saved response found": "Réponse enregistrée trouvée",
    "Enter a new name": "Saisir un nouveau nom",
    "Display name": "Nom d’affichage",
    "Your name will be remembered only on this device.":
      "Votre nom ne sera mémorisé que sur cet appareil.",
    "Choose a saved name instead": "Choisir un nom enregistré à la place",
    "Choose or enter a name between 2 and 30 characters.":
      "Choisissez ou saisissez un nom entre 2 et 30 caractères.",
    "Select the times that work for you; changes autosave.":
      "Sélectionnez les créneaux qui vous conviennent ; les modifications sont enregistrées automatiquement.",
    "Open my saved availability": "Ouvrir mes disponibilités enregistrées",
    "Continue as {name}?": "Continuer en tant que {name} ?",
    "We found your response on this device. Continue to review or update your availability.":
      "Nous avons trouvé votre réponse sur cet appareil. Continuez pour consulter ou modifier vos disponibilités.",
    "Continue as {name}": "Continuer en tant que {name}",
    "We couldn't restore your response": "Nous n’avons pas pu restaurer votre réponse",
    "Check your connection and try again. You can also continue with a different participant name.":
      "Vérifiez votre connexion et réessayez. Vous pouvez aussi continuer avec un autre nom de participant.",
    "Try again": "Réessayer",
    "Choose a name": "Choisir un nom",
    "This link is invalid, expired, or the organizer deleted the meeting. Ask the organizer for a fresh invitation.":
      "Ce lien est invalide, expiré, ou l’organisateur a supprimé la réunion. Demandez une nouvelle invitation à l’organisateur.",
    "Return to Synk": "Retour à Synk",
    "Synk home": "Accueil Synk",
    "Organizer access": "Accès organisateur",
    "Enter a valid email address.": "Saisissez une adresse e-mail valide.",
    "Enter your password.": "Saisissez votre mot de passe.",
    "Use at least 8 characters.": "Utilisez au moins 8 caractères.",
    "Use no more than 72 characters.": "Utilisez au maximum 72 caractères.",
    "Add a lowercase letter.": "Ajoutez une lettre minuscule.",
    "Add an uppercase letter.": "Ajoutez une lettre majuscule.",
    "Add a number.": "Ajoutez un chiffre.",
    "Add a special character.": "Ajoutez un caractère spécial.",
    "Passwords do not match.": "Les mots de passe ne correspondent pas.",
    "Unable to connect to Synk. Is the API running?":
      "Impossible de se connecter à Synk. L’API est-elle démarrée ?",
    "Hide password": "Masquer le mot de passe",
    "Show password": "Afficher le mot de passe",
    "8+ strong characters": "8 caractères robustes ou plus",
    "Your password": "Votre mot de passe",
    "Repeat your password": "Répétez votre mot de passe",
    "Already organizing with Synk?": "Vous organisez déjà avec Synk ?",
    "New to Synk?": "Nouveau sur Synk ?",
    "Checking your session…": "Vérification de votre session…",
    "Meeting updated": "Réunion mise à jour",
    "Meeting created": "Réunion créée",
    "Your schedule and invitation details are up to date.":
      "Votre planning et les détails de l’invitation sont à jour.",
    "Your private invitation is ready to share.":
      "Votre invitation privée est prête à être partagée.",
    "End date must be on or after the start date.":
      "La date de fin doit être postérieure ou égale à la date de début.",
    "Working hours must end after they start.":
      "Les horaires de travail doivent se terminer après leur début.",
    "Meeting duration cannot be longer than the daily scheduling window.":
      "La durée de la réunion ne peut pas dépasser la période de planification journalière.",
    "Unable to reach Synk. Is the API running?":
      "Impossible de joindre Synk. L’API est-elle démarrée ?",
    "15 min": "15 min",
    "1 hour": "1 heure",
    "3 hours": "3 heures",
    "6 hours": "6 heures",
    "Drag the slider in 15-minute steps. Synk uses this exact duration for suggestions and finalization.":
      "Faites glisser le curseur par tranches de 15 minutes. Synk utilise exactement cette durée pour les suggestions et la finalisation.",
    "Choose a start square, then an end square—just like booking a stay.":
      "Choisissez une case de début, puis une case de fin — comme pour réserver un séjour.",
    "Now choose the last day": "Choisissez maintenant le dernier jour",
    "Choose the first day": "Choisissez le premier jour",
    "Select two dates": "Sélectionnez deux dates",
    "{duration} each selected day": "{duration} par jour sélectionné",
    "The organizer needs to add at least one valid day and time slot before availability can be selected.":
      "L’organisateur doit ajouter au moins un jour et un créneau horaire valides avant que les disponibilités puissent être sélectionnées.",
    "Your latest times and note are safely stored.":
      "Vos derniers horaires et votre note sont bien enregistrés.",
    "For example: I can join 15 minutes late on Wednesday.":
      "Par exemple : je peux rejoindre avec 15 minutes de retard le mercredi.",
    "Your selections and note autosave after a short pause.":
      "Vos sélections et votre note sont enregistrées automatiquement après une courte pause.",
    "Choose a start square or drag across the grid. Synk highlights the full {duration} meeting.":
      "Choisissez une case de début ou faites glisser sur la grille. Synk met en évidence toute la réunion de {duration}.",
    "Hover or focus a square to see who is available.":
      "Survolez ou sélectionnez une case pour voir qui est disponible.",
    "The heatmap will fill as participants respond.":
      "La carte de disponibilité se remplira au fur et à mesure des réponses.",
    "Heatmap legend": "Légende de la carte de disponibilité",
    Perfect: "Parfait",
    Select: "Sélectionner",
    Confirmed: "Confirmée",
    "{title} now has a confirmed time.": "{title} a maintenant une heure confirmée.",
    Date: "Date",
    Time: "Heure",
    "The organizer is confirming the exact time.":
      "L’organisateur confirme l’heure exacte.",
    "Suggestions appear as soon as someone saves availability.":
      "Les suggestions apparaissent dès qu’une personne enregistre ses disponibilités.",
  },
  ar: {
    Language: "اللغة",
    "Log in": "تسجيل الدخول",
    "Sign up": "إنشاء حساب",
    "Find the time that works for everyone.": "اعثر على الوقت المناسب للجميع.",
    "Scheduling without the back-and-forth": "جدولة بلا رسائل متبادلة",
    "Create an availability poll, share one secure link, and see the perfect overlap. Participants never need an account.":
      "أنشئ استطلاع توافر وشارك رابطًا آمنًا واعثر على الوقت المشترك. لا يحتاج المشاركون إلى حساب.",
    "Create your first poll": "أنشئ أول استطلاع",
    "Organizer login": "دخول المنظّم",
    "Visual availability": "توافر مرئي",
    "No participant accounts": "دون حسابات للمشاركين",
    "Find time. Together.": "لنجد الوقت معًا.",
    Dashboard: "لوحة التحكم",
    "Your meetings": "اجتماعاتك",
    "Create meeting": "إنشاء اجتماع",
    Upcoming: "قادمة",
    Finalized: "مكتملة",
    Past: "سابقة",
    "No meetings yet": "لا توجد اجتماعات",
    "Load more meetings": "تحميل المزيد",
    "Back to meetings": "العودة للاجتماعات",
    "Meeting title": "عنوان الاجتماع",
    Description: "الوصف",
    optional: "اختياري",
    "Meeting duration": "مدة الاجتماع",
    Timezone: "المنطقة الزمنية",
    Cancel: "إلغاء",
    "Save changes": "حفظ التغييرات",
    "Schedule window": "نطاق الجدول",
    "Pick the days and hours visually": "اختر الأيام والساعات بصريًا",
    "Date range": "نطاق التاريخ",
    Start: "البداية",
    End: "النهاية",
    "Previous month": "الشهر السابق",
    "Next month": "الشهر التالي",
    "Daily working hours": "ساعات العمل اليومية",
    "Choose the first time quarter": "اختر أول ربع ساعة",
    "Choose the last time quarter": "اختر آخر ربع ساعة",
    to: "إلى",
    "Select date": "اختر تاريخًا",
    "Your availability": "توفرّك",
    "Responding as": "الرد باسم",
    "Save now": "احفظ الآن",
    "Optional note": "ملاحظة اختيارية",
    "Availability saved": "تم حفظ التوافر",
    "No schedule slots yet": "لا توجد فترات زمنية",
    "Autosave ready": "الحفظ التلقائي جاهز",
    "Changes pending": "تغييرات معلّقة",
    "Saving…": "جارٍ الحفظ…",
    Saved: "تم الحفظ",
    "Not saved": "لم يُحفظ",
    "No heatmap data": "لا توجد بيانات توافر",
    "No participants available": "لا يوجد مشاركون متاحون",
    available: "متاحون",
    "Top matches": "أفضل الأوقات",
    "Create your own": "اختر وقتك",
    Participants: "المشاركون",
    Responses: "الردود",
    Schedule: "الجدول",
    "Copy invite": "نسخ الدعوة",
    Copied: "تم النسخ",
    "Lock responses": "إغلاق الردود",
    "Open responses": "فتح الردود",
    "Delete meeting": "حذف الاجتماع",
    "Remove participant": "إزالة المشارك",
    Edit: "تعديل",
    "Open Google Meet": "فتح Google Meet",
    "Who’s responding?": "من يجيب؟",
    "Continue to availability": "متابعة إلى التوافر",
    "Use this name": "استخدم هذا الاسم",
    "Saved on this device": "محفوظ على هذا الجهاز",
    "Responses are closed": "الردود مغلقة",
    "Invitation not found": "الدعوة غير موجودة",
    Email: "البريد الإلكتروني",
    Password: "كلمة المرور",
    "Confirm password": "تأكيد كلمة المرور",
    "Create organizer account": "إنشاء حساب منظّم",
    "Quarter-hour slots": "فترات من 15 دقيقة",
    "Each hour is split into four independently selectable quarters.":
      "كل ساعة مقسّمة إلى أربعة أرباع يمكن اختيار كل منها منفردًا.",
    "Loading…": "جارٍ التحميل…",
    "Welcome back": "مرحبًا بعودتك",
    "Use another name": "استخدم اسمًا آخر",
    "Log out": "تسجيل الخروج",
    "Your availability could not be saved.": "تعذّر حفظ توافرك.",
    "No matches yet": "لا توجد نتائج بعد",
    "Synk hit an unexpected problem. Your saved data is safe; retry the page to continue.":
      "واجه Synk مشكلة غير متوقعة. بياناتك المحفوظة آمنة؛ أعد تحميل الصفحة للمتابعة.",
    "Something went wrong": "حدث خطأ ما",
    "Welcome back. Your meetings and responses are waiting.":
      "مرحبًا بعودتك. اجتماعاتك وردودك في انتظارك.",
    "Log in to Synk": "تسجيل الدخول إلى Synk",
    "Create polls, share one secure link, and find the overlap.":
      "أنشئ استطلاعات، وشارك رابطًا آمنًا واحدًا، واعثر على التوافق.",
    "Start organizing": "ابدأ التنظيم",
    "Signed in as": "تم تسجيل الدخول باسم",
    "Create a poll, share its private invitation link, and watch responses arrive.":
      "أنشئ استطلاعًا، وشارك رابط دعوته الخاص، وشاهد الردود تصل.",
    "Check that the API and database are running, then try again.":
      "تحقق من تشغيل الواجهة البرمجية وقاعدة البيانات، ثم أعد المحاولة.",
    "Could not load your meetings": "تعذّر تحميل اجتماعاتك",
    "Create your first meeting": "أنشئ اجتماعك الأول",
    "Your first availability poll takes less than a minute to create.":
      "يستغرق إنشاء أول استطلاع لتوافرك أقل من دقيقة.",
    "Define the window, then share the secure link with your participants.":
      "حدد الفترة الزمنية، ثم شارك الرابط الآمن مع المشاركين.",
    "Meeting deleted": "تم حذف الاجتماع",
    "The invitation and all responses were removed.":
      "تمت إزالة الدعوة وجميع الردود.",
    "Participant removed": "تمت إزالة المشارك",
    "{name} and their availability were removed.": "تمت إزالة {name} وتوافره.",
    "The participant and their availability were removed.":
      "تمت إزالة المشارك وتوافره.",
    "Responses locked": "تم قفل الردود",
    "Responses reopened": "تم إعادة فتح الردود",
    "Participants can view the invitation but cannot edit responses.":
      "يمكن للمشاركين رؤية الدعوة لكن لا يمكنهم تعديل ردودهم.",
    "Participants can edit their availability again.":
      "يمكن للمشاركين تعديل توافرهم مجددًا.",
    "Meeting reopened": "تمت إعادة فتح الاجتماع",
    "Finalization was removed and responses are open again.":
      "تمت إزالة الإنهاء وأصبحت الردود مفتوحة مجددًا.",
    "Meeting scheduled": "تمت جدولة الاجتماع",
    "The confirmed time is now visible to every participant.":
      "الوقت المؤكد مرئي الآن لجميع المشاركين.",
    "It may have been deleted, or it belongs to another organizer.":
      "ربما تم حذفه، أو أنه يخص منظّمًا آخر.",
    "Meeting not found": "الاجتماع غير موجود",
    "Invitation copied": "تم نسخ الدعوة",
    "The private Synk link is ready to share.": "رابط Synk الخاص جاهز للمشاركة.",
    "Could not copy the link": "تعذّر نسخ الرابط",
    "Your browser blocked clipboard access. Copy it from the address bar instead.":
      "منع متصفحك الوصول إلى الحافظة. انسخه من شريط العنوان بدلاً من ذلك.",
    "All meetings": "جميع الاجتماعات",
    "Re-open meeting": "إعادة فتح الاجتماع",
    "Delete this meeting?": "هل تريد حذف هذا الاجتماع؟",
    "This permanently removes the invitation, participant names, comments, and every availability response. This cannot be undone.":
      "سيؤدي هذا إلى إزالة الدعوة وأسماء المشاركين والتعليقات وكل رد على التوافر بشكل نهائي. لا يمكن التراجع عن هذا.",
    "Keep meeting": "الاحتفاظ بالاجتماع",
    "Delete permanently": "حذف نهائي",
    "Remove this participant?": "هل تريد إزالة هذا المشارك؟",
    "{name} and all of their availability will be permanently removed from this meeting.":
      "ستتم إزالة {name} وكل توافره نهائيًا من هذا الاجتماع.",
    "This participant": "هذا المشارك",
    "Choose your meeting time": "اختر وقت اجتماعك",
    "Live availability heatmap": "خريطة التوافر الحرارية المباشرة",
    "Edit meeting": "تعديل الاجتماع",
    "Meeting could not be loaded": "تعذّر تحميل الاجتماع",
    "Re-open the meeting from its dashboard before changing the schedule.":
      "أعد فتح الاجتماع من لوحة التحكم قبل تغيير الجدول.",
    "This meeting is finalized": "هذا الاجتماع منتهٍ",
    "Back to meeting": "العودة إلى الاجتماع",
    "Return to meeting": "الرجوع إلى الاجتماع",
    "Loading meeting form…": "جارٍ تحميل نموذج الاجتماع…",
    "Synk invitation": "دعوة Synk",
    "Restoring your response…": "جارٍ استعادة ردك…",
    "Choose a name saved on this device or enter a new one. Next, you'll select your available hours directly on the calendar.":
      "اختر اسمًا محفوظًا على هذا الجهاز أو أدخل اسمًا جديدًا. بعدها، اختر ساعات توافرك مباشرة على التقويم.",
    "Saved response found": "تم العثور على رد محفوظ",
    "Enter a new name": "إدخال اسم جديد",
    "Display name": "اسم العرض",
    "Your name will be remembered only on this device.":
      "سيُحفظ اسمك على هذا الجهاز فقط.",
    "Choose a saved name instead": "اختر اسمًا محفوظًا بدلاً من ذلك",
    "Choose or enter a name between 2 and 30 characters.":
      "اختر أو أدخل اسمًا يتراوح بين حرفين و30 حرفًا.",
    "Select the times that work for you; changes autosave.":
      "اختر الأوقات التي تناسبك؛ التغييرات تُحفظ تلقائيًا.",
    "Open my saved availability": "افتح توافري المحفوظ",
    "Continue as {name}?": "المتابعة باسم {name}؟",
    "We found your response on this device. Continue to review or update your availability.":
      "وجدنا ردك على هذا الجهاز. تابع لمراجعة أو تحديث توافرك.",
    "Continue as {name}": "المتابعة باسم {name}",
    "We couldn't restore your response": "تعذّر استعادة ردك",
    "Check your connection and try again. You can also continue with a different participant name.":
      "تحقق من اتصالك وأعد المحاولة. يمكنك أيضًا المتابعة باسم مشارك مختلف.",
    "Try again": "إعادة المحاولة",
    "Choose a name": "اختيار اسم",
    "This link is invalid, expired, or the organizer deleted the meeting. Ask the organizer for a fresh invitation.":
      "هذا الرابط غير صالح أو منتهي الصلاحية، أو أن المنظّم حذف الاجتماع. اطلب دعوة جديدة من المنظّم.",
    "Return to Synk": "العودة إلى Synk",
    "Synk home": "الصفحة الرئيسية لـ Synk",
    "Organizer access": "دخول المنظّم",
    "Enter a valid email address.": "أدخل عنوان بريد إلكتروني صالحًا.",
    "Enter your password.": "أدخل كلمة المرور.",
    "Use at least 8 characters.": "استخدم 8 أحرف على الأقل.",
    "Use no more than 72 characters.": "استخدم 72 حرفًا كحد أقصى.",
    "Add a lowercase letter.": "أضف حرفًا صغيرًا.",
    "Add an uppercase letter.": "أضف حرفًا كبيرًا.",
    "Add a number.": "أضف رقمًا.",
    "Add a special character.": "أضف رمزًا خاصًا.",
    "Passwords do not match.": "كلمتا المرور غير متطابقتين.",
    "Unable to connect to Synk. Is the API running?":
      "تعذّر الاتصال بـ Synk. هل الواجهة البرمجية تعمل؟",
    "Hide password": "إخفاء كلمة المرور",
    "Show password": "إظهار كلمة المرور",
    "8+ strong characters": "8 أحرف قوية أو أكثر",
    "Your password": "كلمة مرورك",
    "Repeat your password": "كرر كلمة المرور",
    "Already organizing with Synk?": "هل تنظّم بالفعل مع Synk؟",
    "New to Synk?": "جديد على Synk؟",
    "Checking your session…": "جارٍ التحقق من جلستك…",
    "Meeting updated": "تم تحديث الاجتماع",
    "Meeting created": "تم إنشاء الاجتماع",
    "Your schedule and invitation details are up to date.":
      "جدولك وتفاصيل الدعوة محدّثة.",
    "Your private invitation is ready to share.": "دعوتك الخاصة جاهزة للمشاركة.",
    "End date must be on or after the start date.":
      "يجب أن يكون تاريخ الانتهاء في نفس تاريخ البدء أو بعده.",
    "Working hours must end after they start.":
      "يجب أن تنتهي ساعات العمل بعد بدايتها.",
    "Meeting duration cannot be longer than the daily scheduling window.":
      "لا يمكن أن تتجاوز مدة الاجتماع نافذة الجدولة اليومية.",
    "Unable to reach Synk. Is the API running?":
      "تعذّر الوصول إلى Synk. هل الواجهة البرمجية تعمل؟",
    "15 min": "15 دقيقة",
    "1 hour": "ساعة واحدة",
    "3 hours": "3 ساعات",
    "6 hours": "6 ساعات",
    "Drag the slider in 15-minute steps. Synk uses this exact duration for suggestions and finalization.":
      "اسحب الشريط بخطوات 15 دقيقة. يستخدم Synk هذه المدة بالضبط للاقتراحات والإنهاء.",
    "Choose a start square, then an end square—just like booking a stay.":
      "اختر مربع بداية، ثم مربع نهاية — تمامًا كحجز إقامة.",
    "Now choose the last day": "اختر الآن اليوم الأخير",
    "Choose the first day": "اختر اليوم الأول",
    "Select two dates": "اختر تاريخين",
    "{duration} each selected day": "{duration} لكل يوم مختار",
    "The organizer needs to add at least one valid day and time slot before availability can be selected.":
      "يحتاج المنظّم إلى إضافة يوم واحد وفترة زمنية صالحة على الأقل قبل إمكانية اختيار التوافر.",
    "Your latest times and note are safely stored.":
      "أوقاتك وملاحظتك الأخيرة محفوظة بأمان.",
    "For example: I can join 15 minutes late on Wednesday.":
      "مثال: يمكنني الانضمام متأخرًا 15 دقيقة يوم الأربعاء.",
    "Your selections and note autosave after a short pause.":
      "تُحفظ اختياراتك وملاحظتك تلقائيًا بعد توقف قصير.",
    "Choose a start square or drag across the grid. Synk highlights the full {duration} meeting.":
      "اختر مربع بداية أو اسحب عبر الشبكة. يبرز Synk اجتماع {duration} كاملاً.",
    "Hover or focus a square to see who is available.":
      "مرّر أو ركّز على مربع لمعرفة من هو متاح.",
    "The heatmap will fill as participants respond.":
      "ستمتلئ الخريطة الحرارية مع استجابة المشاركين.",
    "Heatmap legend": "مفتاح الخريطة الحرارية",
    Perfect: "مثالي",
    Select: "اختيار",
    Confirmed: "مؤكَّد",
    "{title} now has a confirmed time.": "أصبح لدى {title} الآن وقت مؤكَّد.",
    Date: "التاريخ",
    Time: "الوقت",
    "The organizer is confirming the exact time.": "المنظّم يؤكد الوقت الدقيق.",
    "Suggestions appear as soon as someone saves availability.":
      "أي شخص يحفظ توفره، تظهر الاقتراحات فورًا.",
  },
  ja: {
    Language: "言語",
    "Log in": "ログイン",
    "Sign up": "登録",
    "Find the time that works for everyone.":
      "全員に合う時間を見つけましょう。",
    "Scheduling without the back-and-forth": "やり取りなしで日程調整",
    "Create an availability poll, share one secure link, and see the perfect overlap. Participants never need an account.":
      "候補日を作成し、安全なリンクを共有して、全員が空いている時間を確認できます。参加者のアカウントは不要です。",
    "Create your first poll": "最初の日程調整を作成",
    "Organizer login": "主催者ログイン",
    "Visual availability": "空き時間を可視化",
    "No participant accounts": "参加者登録不要",
    "Find time. Together.": "一緒に時間を見つけよう。",
    Dashboard: "ダッシュボード",
    "Your meetings": "あなたの会議",
    "Create meeting": "会議を作成",
    Upcoming: "予定",
    Finalized: "確定済み",
    Past: "過去",
    "No meetings yet": "会議はありません",
    "Load more meetings": "さらに読み込む",
    "Back to meetings": "会議一覧へ戻る",
    "Meeting title": "会議名",
    Description: "説明",
    optional: "任意",
    "Meeting duration": "会議時間",
    Timezone: "タイムゾーン",
    Cancel: "キャンセル",
    "Save changes": "変更を保存",
    "Schedule window": "候補期間",
    "Pick the days and hours visually": "日付と時間を選択",
    "Date range": "日付範囲",
    Start: "開始",
    End: "終了",
    "Previous month": "前の月",
    "Next month": "次の月",
    "Daily working hours": "1日の候補時間",
    "Choose the first time quarter": "開始する15分枠を選択",
    "Choose the last time quarter": "終了する15分枠を選択",
    to: "〜",
    "Select date": "日付を選択",
    "Your availability": "あなたの空き時間",
    "Responding as": "回答者",
    "Save now": "今すぐ保存",
    "Optional note": "任意のメモ",
    "Availability saved": "空き時間を保存しました",
    "No schedule slots yet": "時間枠がありません",
    "Autosave ready": "自動保存の準備完了",
    "Changes pending": "未保存の変更",
    "Saving…": "保存中…",
    Saved: "保存済み",
    "Not saved": "未保存",
    "No heatmap data": "空き時間データがありません",
    "No participants available": "空いている参加者はいません",
    available: "人が空いています",
    "Top matches": "おすすめ時間",
    "Create your own": "自分で選ぶ",
    Participants: "参加者",
    Responses: "回答",
    Schedule: "予定",
    "Copy invite": "招待をコピー",
    Copied: "コピー済み",
    "Lock responses": "回答を締め切る",
    "Open responses": "回答を再開",
    "Delete meeting": "会議を削除",
    "Remove participant": "参加者を削除",
    Edit: "編集",
    "Open Google Meet": "Google Meetを開く",
    "Who’s responding?": "回答する人は？",
    "Continue to availability": "空き時間の入力へ",
    "Use this name": "この名前を使う",
    "Saved on this device": "この端末に保存済み",
    "Responses are closed": "回答は締め切られました",
    "Invitation not found": "招待が見つかりません",
    Email: "メール",
    Password: "パスワード",
    "Confirm password": "パスワード確認",
    "Create organizer account": "主催者アカウントを作成",
    "Quarter-hour slots": "15分単位",
    "Each hour is split into four independently selectable quarters.":
      "1時間を4つの15分枠に分け、個別に選択できます。",
    "Loading…": "読み込み中…",
    "Welcome back": "おかえりなさい",
    "Use another name": "別の名前を使う",
    "Log out": "ログアウト",
    "Your availability could not be saved.": "空き時間を保存できませんでした。",
    "No matches yet": "まだ一致する時間がありません",
    "Synk hit an unexpected problem. Your saved data is safe; retry the page to continue.":
      "Synkで予期しない問題が発生しました。保存されたデータは安全です。ページを再試行してください。",
    "Something went wrong": "問題が発生しました",
    "Welcome back. Your meetings and responses are waiting.":
      "おかえりなさい。あなたの会議と回答がお待ちしています。",
    "Log in to Synk": "Synkにログイン",
    "Create polls, share one secure link, and find the overlap.":
      "投票を作成し、安全なリンクを、1つ共有して、重なる時間を見つけましょう。",
    "Start organizing": "主催を始める",
    "Signed in as": "ログイン中：",
    "Create a poll, share its private invitation link, and watch responses arrive.":
      "投票を作成し、専用の招待リンクを共有して、回答が届くのを見守りましょう。",
    "Check that the API and database are running, then try again.":
      "APIとデータベースが稼働しているか確認して、もう一度お試しください。",
    "Could not load your meetings": "会議を読み込めませんでした",
    "Create your first meeting": "最初の会議を作成",
    "Your first availability poll takes less than a minute to create.":
      "最初の空き時間投票は1分もかからず作成できます。",
    "Define the window, then share the secure link with your participants.":
      "期間を設定し、安全なリンクを参加者と共有しましょう。",
    "Meeting deleted": "会議を削除しました",
    "The invitation and all responses were removed.":
      "招待とすべての回答が削除されました。",
    "Participant removed": "参加者を削除しました",
    "{name} and their availability were removed.": "{name}さんとその空き時間が削除されました。",
    "The participant and their availability were removed.":
      "参加者とその空き時間が削除されました。",
    "Responses locked": "回答をロックしました",
    "Responses reopened": "回答のロックを解除しました",
    "Participants can view the invitation but cannot edit responses.":
      "参加者は招待を閲覧できますが、回答を編集できません。",
    "Participants can edit their availability again.":
      "参加者は再び空き時間を編集できます。",
    "Meeting reopened": "会議を再開しました",
    "Finalization was removed and responses are open again.":
      "確定が取り消され、回答が再び受け付けられています。",
    "Meeting scheduled": "会議が確定しました",
    "The confirmed time is now visible to every participant.":
      "確定した時間がすべての参加者に表示されるようになりました。",
    "It may have been deleted, or it belongs to another organizer.":
      "削除されたか、別の主催者の会議である可能性があります。",
    "Meeting not found": "会議が見つかりません",
    "Invitation copied": "招待をコピーしました",
    "The private Synk link is ready to share.": "Synkの専用リンクを共有できます。",
    "Could not copy the link": "リンクをコピーできませんでした",
    "Your browser blocked clipboard access. Copy it from the address bar instead.":
      "ブラウザがクリップボードへのアクセスをブロックしました。代わりにアドレスバーからコピーしてください。",
    "All meetings": "すべての会議",
    "Re-open meeting": "会議を再開する",
    "Delete this meeting?": "この会議を削除しますか？",
    "This permanently removes the invitation, participant names, comments, and every availability response. This cannot be undone.":
      "招待、参加者名、コメント、すべての空き時間回答が完全に削除されます。この操作は元に戻せません。",
    "Keep meeting": "会議を保持",
    "Delete permanently": "完全に削除",
    "Remove this participant?": "この参加者を削除しますか？",
    "{name} and all of their availability will be permanently removed from this meeting.":
      "{name}さんとそのすべての空き時間はこの会議から完全に削除されます。",
    "This participant": "この参加者",
    "Choose your meeting time": "会議の時間を選択",
    "Live availability heatmap": "リアルタイム空き時間ヒートマップ",
    "Edit meeting": "会議を編集",
    "Meeting could not be loaded": "会議を読み込めませんでした",
    "Re-open the meeting from its dashboard before changing the schedule.":
      "スケジュールを変更する前に、ダッシュボードから会議を再開してください。",
    "This meeting is finalized": "この会議は確定済みです",
    "Back to meeting": "会議に戻る",
    "Return to meeting": "会議のページに戻る",
    "Loading meeting form…": "会議フォームを読み込み中…",
    "Synk invitation": "Synkの招待",
    "Restoring your response…": "回答を復元しています…",
    "Choose a name saved on this device or enter a new one. Next, you'll select your available hours directly on the calendar.":
      "この端末に保存された名前を選ぶか、新しい名前を入力してください。次に、カレンダーで直接空いている時間を選択します。",
    "Saved response found": "保存された回答が見つかりました",
    "Enter a new name": "新しい名前を入力",
    "Display name": "表示名",
    "Your name will be remembered only on this device.":
      "あなたの名前はこの端末にのみ記憶されます。",
    "Choose a saved name instead": "代わりに保存済みの名前を選ぶ",
    "Choose or enter a name between 2 and 30 characters.":
      "2～30文字の名前を選択または入力してください。",
    "Select the times that work for you; changes autosave.":
      "都合の良い時間を選んでください。変更は自動保存されます。",
    "Open my saved availability": "保存された空き時間を開く",
    "Continue as {name}?": "{name}として続けますか？",
    "We found your response on this device. Continue to review or update your availability.":
      "この端末で回答が見つかりました。続けて空き時間を確認・更新してください。",
    "Continue as {name}": "{name}として続ける",
    "We couldn't restore your response": "回答を復元できませんでした",
    "Check your connection and try again. You can also continue with a different participant name.":
      "接続を確認してもう一度お試しください。別の参加者名で続けることもできます。",
    "Try again": "再試行",
    "Choose a name": "名前を選択",
    "This link is invalid, expired, or the organizer deleted the meeting. Ask the organizer for a fresh invitation.":
      "このリンクは無効か期限切れです。または主催者が会議を削除しました。主催者に新しい招待を依頼してください。",
    "Return to Synk": "Synkに戻る",
    "Synk home": "Synkのホーム",
    "Organizer access": "主催者アクセス",
    "Enter a valid email address.": "有効なメールアドレスを入力してください。",
    "Enter your password.": "パスワードを入力してください。",
    "Use at least 8 characters.": "8文字以上にしてください。",
    "Use no more than 72 characters.": "72文字以内にしてください。",
    "Add a lowercase letter.": "小文字を追加してください。",
    "Add an uppercase letter.": "大文字を追加してください。",
    "Add a number.": "数字を追加してください。",
    "Add a special character.": "特殊文字を追加してください。",
    "Passwords do not match.": "パスワードが一致しません。",
    "Unable to connect to Synk. Is the API running?":
      "Synkに接続できません。APIは稼働していますか？",
    "Hide password": "パスワードを隠す",
    "Show password": "パスワードを表示",
    "8+ strong characters": "8文字以上の強力なパスワード",
    "Your password": "パスワード",
    "Repeat your password": "パスワードを再入力",
    "Already organizing with Synk?": "すでにSynkで主催していますか？",
    "New to Synk?": "Synkは初めてですか？",
    "Checking your session…": "セッションを確認中…",
    "Meeting updated": "会議を更新しました",
    "Meeting created": "会議を作成しました",
    "Your schedule and invitation details are up to date.":
      "スケジュールと招待の詳細は最新です。",
    "Your private invitation is ready to share.": "専用の招待を共有できます。",
    "End date must be on or after the start date.":
      "終了日は開始日以降にしてください。",
    "Working hours must end after they start.":
      "勤務時間は開始時刻より後に終了する必要があります。",
    "Meeting duration cannot be longer than the daily scheduling window.":
      "会議時間は1日のスケジュール枠より長くできません。",
    "Unable to reach Synk. Is the API running?":
      "Synkに接続できません。APIは稼働していますか？",
    "15 min": "15分",
    "1 hour": "1時間",
    "3 hours": "3時間",
    "6 hours": "6時間",
    "Drag the slider in 15-minute steps. Synk uses this exact duration for suggestions and finalization.":
      "スライダーを15分単位でドラッグしてください。Synkは提案や確定にこの正確な時間を使用します。",
    "Choose a start square, then an end square—just like booking a stay.":
      "宿泊予約のように、開始のマスを選び、次に終了のマスを選びます。",
    "Now choose the last day": "次に最終日を選択",
    "Choose the first day": "最初の日を選択",
    "Select two dates": "2つの日付を選択",
    "{duration} each selected day": "選択した各日につき{duration}",
    "The organizer needs to add at least one valid day and time slot before availability can be selected.":
      "空き時間を選択できるようにするには、主催者が少なくとも1つの有効な日と時間枚を追加する必要があります。",
    "Your latest times and note are safely stored.":
      "最新の時間とメモは安全に保存されています。",
    "For example: I can join 15 minutes late on Wednesday.":
      "例：水曜日は15分遅れて参加できます。",
    "Your selections and note autosave after a short pause.":
      "選択とメモは少し間を置いて自動保存されます。",
    "Choose a start square or drag across the grid. Synk highlights the full {duration} meeting.":
      "開始のマスを選ぶか、グリッド上でドラッグしてください。Synkが{duration}の会議全体をハイライトします。",
    "Hover or focus a square to see who is available.":
      "マスをホバーまたはフォーカスすると、誰が参加可能か表示されます。",
    "The heatmap will fill as participants respond.":
      "参加者が回答するにつれてヒートマップが埋まっていきます。",
    "Heatmap legend": "ヒートマップの凡例",
    Perfect: "完璧",
    Select: "選択",
    Confirmed: "確定済み",
    "{title} now has a confirmed time.": "{title}の時間が確定しました。",
    Date: "日付",
    Time: "時間",
    "The organizer is confirming the exact time.": "主催者が正確な時間を確定中です。",
    "Suggestions appear as soon as someone saves availability.":
      "誰かが空き時間を保存するとすぐに提案が表示されます。",
  },
  zh: {
    Language: "语言",
    "Log in": "登录",
    "Sign up": "注册",
    "Find the time that works for everyone.": "找到适合所有人的时间。",
    "Scheduling without the back-and-forth": "无需反复沟通的日程安排",
    "Create an availability poll, share one secure link, and see the perfect overlap. Participants never need an account.":
      "创建空闲时间投票，分享安全链接，查看大家都合适的时间。参与者无需账号。",
    "Create your first poll": "创建第一个投票",
    "Organizer login": "组织者登录",
    "Visual availability": "直观显示空闲时间",
    "No participant accounts": "参与者无需账号",
    "Find time. Together.": "一起找到时间。",
    Dashboard: "控制面板",
    "Your meetings": "你的会议",
    "Create meeting": "创建会议",
    Upcoming: "即将开始",
    Finalized: "已确定",
    Past: "过去",
    "No meetings yet": "暂无会议",
    "Load more meetings": "加载更多",
    "Back to meetings": "返回会议",
    "Meeting title": "会议标题",
    Description: "说明",
    optional: "可选",
    "Meeting duration": "会议时长",
    Timezone: "时区",
    Cancel: "取消",
    "Save changes": "保存更改",
    "Schedule window": "时间范围",
    "Pick the days and hours visually": "直观选择日期和时间",
    "Date range": "日期范围",
    Start: "开始",
    End: "结束",
    "Previous month": "上个月",
    "Next month": "下个月",
    "Daily working hours": "每日可选时间",
    "Choose the first time quarter": "选择开始的15分钟",
    "Choose the last time quarter": "选择结束的15分钟",
    to: "至",
    "Select date": "选择日期",
    "Your availability": "你的空闲时间",
    "Responding as": "回答者",
    "Save now": "立即保存",
    "Optional note": "可选备注",
    "Availability saved": "空闲时间已保存",
    "No schedule slots yet": "暂无时间段",
    "Autosave ready": "自动保存已就绪",
    "Changes pending": "有待保存的更改",
    "Saving…": "正在保存…",
    Saved: "已保存",
    "Not saved": "未保存",
    "No heatmap data": "暂无空闲时间数据",
    "No participants available": "无人有空",
    available: "人有空",
    "Top matches": "最佳时间",
    "Create your own": "自行选择",
    Participants: "参与者",
    Responses: "回复",
    Schedule: "日程",
    "Copy invite": "复制邀请",
    Copied: "已复制",
    "Lock responses": "关闭回复",
    "Open responses": "开放回复",
    "Delete meeting": "删除会议",
    "Remove participant": "移除参与者",
    Edit: "编辑",
    "Open Google Meet": "打开 Google Meet",
    "Who’s responding?": "谁在回答？",
    "Continue to availability": "继续填写空闲时间",
    "Use this name": "使用此姓名",
    "Saved on this device": "已保存在此设备",
    "Responses are closed": "回复已关闭",
    "Invitation not found": "找不到邀请",
    Email: "电子邮箱",
    Password: "密码",
    "Confirm password": "确认密码",
    "Create organizer account": "创建组织者账号",
    "Quarter-hour slots": "15分钟时间段",
    "Each hour is split into four independently selectable quarters.":
      "每小时分为四个可单独选择的15分钟时间段。",
    "Loading…": "加载中…",
    "Welcome back": "欢迎回来",
    "Use another name": "使用其他姓名",
    "Log out": "退出登录",
    "Your availability could not be saved.": "无法保存你的空闲时间。",
    "No matches yet": "暂无匹配",
    "Synk hit an unexpected problem. Your saved data is safe; retry the page to continue.":
      "Synk遇到了意外问题。你保存的数据是安全的；重试页面以继续。",
    "Something went wrong": "出现了问题",
    "Welcome back. Your meetings and responses are waiting.":
      "欢迎回来。你的会议和回复正在等待。",
    "Log in to Synk": "登录Synk",
    "Create polls, share one secure link, and find the overlap.":
      "创建投票，分享一个安全链接，找到共同的时间。",
    "Start organizing": "开始组织",
    "Signed in as": "已登录为",
    "Create a poll, share its private invitation link, and watch responses arrive.":
      "创建投票，分享其私密邀请链接，查看回复到来。",
    "Check that the API and database are running, then try again.":
      "请检查API和数据库是否正在运行，然后重试。",
    "Could not load your meetings": "无法加载你的会议",
    "Create your first meeting": "创建你的第一个会议",
    "Your first availability poll takes less than a minute to create.":
      "创建你的第一个空闲时间投票不到一分钟。",
    "Define the window, then share the secure link with your participants.":
      "设置时间范围，然后与参与者分享安全链接。",
    "Meeting deleted": "会议已删除",
    "The invitation and all responses were removed.": "邀请和所有回复已被移除。",
    "Participant removed": "参与者已移除",
    "{name} and their availability were removed.": "{name}及其空闲时间已被移除。",
    "The participant and their availability were removed.":
      "该参与者及其空闲时间已被移除。",
    "Responses locked": "回复已锁定",
    "Responses reopened": "回复已重新开放",
    "Participants can view the invitation but cannot edit responses.":
      "参与者可以查看邀请，但无法编辑回复。",
    "Participants can edit their availability again.":
      "参与者可以再次编辑他们的空闲时间。",
    "Meeting reopened": "会议已重新开放",
    "Finalization was removed and responses are open again.":
      "确定已被撤销，回复重新开放。",
    "Meeting scheduled": "会议已安排",
    "The confirmed time is now visible to every participant.":
      "确认的时间现已对所有参与者可见。",
    "It may have been deleted, or it belongs to another organizer.":
      "它可能已被删除，或属于另一位组织者。",
    "Meeting not found": "未找到会议",
    "Invitation copied": "邀请已复制",
    "The private Synk link is ready to share.": "私密Synk链接已可分享。",
    "Could not copy the link": "无法复制链接",
    "Your browser blocked clipboard access. Copy it from the address bar instead.":
      "你的浏览器阻止了剪贴板访问。请改从地址栏复制。",
    "All meetings": "所有会议",
    "Re-open meeting": "重新开放会议",
    "Delete this meeting?": "删除此会议？",
    "This permanently removes the invitation, participant names, comments, and every availability response. This cannot be undone.":
      "这将永久删除邀请、参与者姓名、评论以及所有空闲时间回复。此操作无法撤销。",
    "Keep meeting": "保留会议",
    "Delete permanently": "永久删除",
    "Remove this participant?": "移除此参与者？",
    "{name} and all of their availability will be permanently removed from this meeting.":
      "{name}及其所有空闲时间将从此会议中永久移除。",
    "This participant": "该参与者",
    "Choose your meeting time": "选择会议时间",
    "Live availability heatmap": "实时空闲时间热力图",
    "Edit meeting": "编辑会议",
    "Meeting could not be loaded": "无法加载会议",
    "Re-open the meeting from its dashboard before changing the schedule.":
      "在更改日程之前，请先从仪表盘重新开放会议。",
    "This meeting is finalized": "此会议已确定",
    "Back to meeting": "返回会议",
    "Return to meeting": "回到会议",
    "Loading meeting form…": "正在加载会议表单…",
    "Synk invitation": "Synk邀请",
    "Restoring your response…": "正在恢复你的回复…",
    "Choose a name saved on this device or enter a new one. Next, you'll select your available hours directly on the calendar.":
      "选择此设备上保存的姓名，或输入新姓名。接下来，直接在日历上选择你的空闲时间。",
    "Saved response found": "找到已保存的回复",
    "Enter a new name": "输入新姓名",
    "Display name": "显示名称",
    "Your name will be remembered only on this device.":
      "你的姓名只会在此设备上被记住。",
    "Choose a saved name instead": "改为选择已保存的姓名",
    "Choose or enter a name between 2 and 30 characters.":
      "请选择或输入一个2到30个字符的姓名。",
    "Select the times that work for you; changes autosave.":
      "选择适合你的时间；更改会自动保存。",
    "Open my saved availability": "打开我已保存的空闲时间",
    "Continue as {name}?": "以{name}的身份继续？",
    "We found your response on this device. Continue to review or update your availability.":
      "我们在此设备上找到了你的回复。继续以查看或更新你的空闲时间。",
    "Continue as {name}": "以{name}的身份继续",
    "We couldn't restore your response": "我们无法恢复你的回复",
    "Check your connection and try again. You can also continue with a different participant name.":
      "请检查你的网络连接并重试。你也可以使用其他参与者姓名继续。",
    "Try again": "重试",
    "Choose a name": "选择姓名",
    "This link is invalid, expired, or the organizer deleted the meeting. Ask the organizer for a fresh invitation.":
      "此链接无效、已过期，或组织者已删除该会议。请向组织者索取新邀请。",
    "Return to Synk": "返回Synk",
    "Synk home": "Synk首页",
    "Organizer access": "组织者入口",
    "Enter a valid email address.": "请输入有效的电子邮件地址。",
    "Enter your password.": "请输入你的密码。",
    "Use at least 8 characters.": "至少使用8个字符。",
    "Use no more than 72 characters.": "不要超过72个字符。",
    "Add a lowercase letter.": "添加一个小写字母。",
    "Add an uppercase letter.": "添加一个大写字母。",
    "Add a number.": "添加一个数字。",
    "Add a special character.": "添加一个特殊字符。",
    "Passwords do not match.": "两次密码不一致。",
    "Unable to connect to Synk. Is the API running?":
      "无法连接到Synk。API是否正在运行？",
    "Hide password": "隐藏密码",
    "Show password": "显示密码",
    "8+ strong characters": "8位以上的强密码",
    "Your password": "你的密码",
    "Repeat your password": "再次输入密码",
    "Already organizing with Synk?": "已经在使用Synk组织会议？",
    "New to Synk?": "初次使用Synk？",
    "Checking your session…": "正在检查你的登录状态…",
    "Meeting updated": "会议已更新",
    "Meeting created": "会议已创建",
    "Your schedule and invitation details are up to date.":
      "你的日程和邀请详情已是最新。",
    "Your private invitation is ready to share.": "你的私密邀请已可分享。",
    "End date must be on or after the start date.":
      "结束日期必须晚于或等于开始日期。",
    "Working hours must end after they start.":
      "工作时间的结束必须晚于开始。",
    "Meeting duration cannot be longer than the daily scheduling window.":
      "会议时长不能超过每日可安排的时间范围。",
    "Unable to reach Synk. Is the API running?":
      "无法连接到Synk。API是否正在运行？",
    "15 min": "15分钟",
    "1 hour": "1小时",
    "3 hours": "3小时",
    "6 hours": "6小时",
    "Drag the slider in 15-minute steps. Synk uses this exact duration for suggestions and finalization.":
      "以15分钟为步长拖动滑块。Synk会使用这个确切时长来生成建议并确定会议。",
    "Choose a start square, then an end square—just like booking a stay.":
      "先选择开始方块，再选择结束方块——就像预订住宿一样。",
    "Now choose the last day": "现在选择最后一天",
    "Choose the first day": "选择第一天",
    "Select two dates": "选择两个日期",
    "{duration} each selected day": "每个选定日期{duration}",
    "The organizer needs to add at least one valid day and time slot before availability can be selected.":
      "组织者需要至少添加一个有效的日期和时间段，才能选择空闲时间。",
    "Your latest times and note are safely stored.":
      "你最新的时间和备注已安全保存。",
    "For example: I can join 15 minutes late on Wednesday.":
      "例如：我周三可以晚15分钟加入。",
    "Your selections and note autosave after a short pause.":
      "你的选择和备注会在短暂停顿后自动保存。",
    "Choose a start square or drag across the grid. Synk highlights the full {duration} meeting.":
      "选择开始方块或在网格上拖动。Synk会高亮整个{duration}的会议。",
    "Hover or focus a square to see who is available.":
      "悬停或聚焦方块可查看谁有空。",
    "The heatmap will fill as participants respond.":
      "随着参与者回复，热力图将逐渐填满。",
    "Heatmap legend": "热力图图例",
    Perfect: "完美",
    Select: "选择",
    Confirmed: "已确认",
    "{title} now has a confirmed time.": "{title}现已有确认的时间。",
    Date: "日期",
    Time: "时间",
    "The organizer is confirming the exact time.": "组织者正在确认具体时间。",
    "Suggestions appear as soon as someone saves availability.":
      "一旦有人保存空闲时间，建议就会出现。",
  },
  es: {
    Language: "Idioma",
    "Log in": "Iniciar sesión",
    "Sign up": "Registrarse",
    "Find the time that works for everyone.":
      "Encuentra la hora que funciona para todos.",
    "Scheduling without the back-and-forth":
      "Organiza sin mensajes interminables",
    "Create an availability poll, share one secure link, and see the perfect overlap. Participants never need an account.":
      "Crea una encuesta, comparte un enlace seguro y encuentra la coincidencia perfecta. Los participantes no necesitan cuenta.",
    "Create your first poll": "Crea tu primera encuesta",
    "Organizer login": "Acceso de organizador",
    "Visual availability": "Disponibilidad visual",
    "No participant accounts": "Sin cuentas de participantes",
    "Find time. Together.": "Encontremos tiempo. Juntos.",
    Dashboard: "Panel",
    "Your meetings": "Tus reuniones",
    "Create meeting": "Crear reunión",
    Upcoming: "Próximas",
    Finalized: "Finalizadas",
    Past: "Pasadas",
    "No meetings yet": "Aún no hay reuniones",
    "Load more meetings": "Cargar más",
    "Back to meetings": "Volver a reuniones",
    "Meeting title": "Título de la reunión",
    Description: "Descripción",
    optional: "opcional",
    "Meeting duration": "Duración",
    Timezone: "Zona horaria",
    Cancel: "Cancelar",
    "Save changes": "Guardar cambios",
    "Schedule window": "Ventana de horario",
    "Pick the days and hours visually": "Elige días y horas visualmente",
    "Date range": "Rango de fechas",
    Start: "Inicio",
    End: "Fin",
    "Previous month": "Mes anterior",
    "Next month": "Mes siguiente",
    "Daily working hours": "Horario diario",
    "Choose the first time quarter": "Elige el primer cuarto de hora",
    "Choose the last time quarter": "Elige el último cuarto de hora",
    to: "a",
    "Select date": "Seleccionar fecha",
    "Your availability": "Tu disponibilidad",
    "Responding as": "Respondiendo como",
    "Save now": "Guardar ahora",
    "Optional note": "Nota opcional",
    "Availability saved": "Disponibilidad guardada",
    "No schedule slots yet": "No hay franjas",
    "Autosave ready": "Autoguardado listo",
    "Changes pending": "Cambios pendientes",
    "Saving…": "Guardando…",
    Saved: "Guardado",
    "Not saved": "Sin guardar",
    "No heatmap data": "Sin datos de disponibilidad",
    "No participants available": "Nadie disponible",
    available: "disponibles",
    "Top matches": "Mejores opciones",
    "Create your own": "Elegir otra",
    Participants: "Participantes",
    Responses: "Respuestas",
    Schedule: "Horario",
    "Copy invite": "Copiar invitación",
    Copied: "Copiado",
    "Lock responses": "Cerrar respuestas",
    "Open responses": "Abrir respuestas",
    "Delete meeting": "Eliminar reunión",
    "Remove participant": "Eliminar participante",
    Edit: "Editar",
    "Open Google Meet": "Abrir Google Meet",
    "Who’s responding?": "¿Quién responde?",
    "Continue to availability": "Continuar a disponibilidad",
    "Use this name": "Usar este nombre",
    "Saved on this device": "Guardado en este dispositivo",
    "Responses are closed": "Las respuestas están cerradas",
    "Invitation not found": "Invitación no encontrada",
    Email: "Correo",
    Password: "Contraseña",
    "Confirm password": "Confirmar contraseña",
    "Create organizer account": "Crear cuenta de organizador",
    "Quarter-hour slots": "Franjas de 15 minutos",
    "Each hour is split into four independently selectable quarters.":
      "Cada hora se divide en cuatro cuartos seleccionables por separado.",
    "Loading…": "Cargando…",
    "Welcome back": "Bienvenido de nuevo",
    "Use another name": "Usar otro nombre",
    "Log out": "Cerrar sesión",
    "Your availability could not be saved.":
      "No se pudo guardar tu disponibilidad.",
    "No matches yet": "Aún no hay coincidencias",
    "Synk hit an unexpected problem. Your saved data is safe; retry the page to continue.":
      "Synk tuvo un problema inesperado. Tus datos guardados están seguros; reintenta la página para continuar.",
    "Something went wrong": "Algo salió mal",
    "Welcome back. Your meetings and responses are waiting.":
      "Bienvenido de nuevo. Tus reuniones y respuestas te esperan.",
    "Log in to Synk": "Iniciar sesión en Synk",
    "Create polls, share one secure link, and find the overlap.":
      "Crea encuestas, comparte un enlace seguro y encuentra el momento en común.",
    "Start organizing": "Empezar a organizar",
    "Signed in as": "Conectado como",
    "Create a poll, share its private invitation link, and watch responses arrive.":
      "Crea una encuesta, comparte su enlace de invitación privado y observa cómo llegan las respuestas.",
    "Check that the API and database are running, then try again.":
      "Verifica que la API y la base de datos estén en funcionamiento y vuelve a intentarlo.",
    "Could not load your meetings": "No se pudieron cargar tus reuniones",
    "Create your first meeting": "Crea tu primera reunión",
    "Your first availability poll takes less than a minute to create.":
      "Tu primera encuesta de disponibilidad se crea en menos de un minuto.",
    "Define the window, then share the secure link with your participants.":
      "Define el período y luego comparte el enlace seguro con tus participantes.",
    "Meeting deleted": "Reunión eliminada",
    "The invitation and all responses were removed.":
      "La invitación y todas las respuestas fueron eliminadas.",
    "Participant removed": "Participante eliminado",
    "{name} and their availability were removed.":
      "{name} y su disponibilidad fueron eliminados.",
    "The participant and their availability were removed.":
      "El participante y su disponibilidad fueron eliminados.",
    "Responses locked": "Respuestas bloqueadas",
    "Responses reopened": "Respuestas reabiertas",
    "Participants can view the invitation but cannot edit responses.":
      "Los participantes pueden ver la invitación pero no pueden editar sus respuestas.",
    "Participants can edit their availability again.":
      "Los participantes pueden volver a editar su disponibilidad.",
    "Meeting reopened": "Reunión reabierta",
    "Finalization was removed and responses are open again.":
      "Se eliminó la finalización y las respuestas están abiertas de nuevo.",
    "Meeting scheduled": "Reunión programada",
    "The confirmed time is now visible to every participant.":
      "La hora confirmada ahora es visible para todos los participantes.",
    "It may have been deleted, or it belongs to another organizer.":
      "Puede que haya sido eliminada, o pertenece a otro organizador.",
    "Meeting not found": "Reunión no encontrada",
    "Invitation copied": "Invitación copiada",
    "The private Synk link is ready to share.":
      "El enlace privado de Synk está listo para compartir.",
    "Could not copy the link": "No se pudo copiar el enlace",
    "Your browser blocked clipboard access. Copy it from the address bar instead.":
      "Tu navegador bloqueó el acceso al portapapeles. Cópialo desde la barra de direcciones.",
    "All meetings": "Todas las reuniones",
    "Re-open meeting": "Reabrir la reunión",
    "Delete this meeting?": "¿Eliminar esta reunión?",
    "This permanently removes the invitation, participant names, comments, and every availability response. This cannot be undone.":
      "Esto elimina permanentemente la invitación, los nombres de los participantes, los comentarios y todas las respuestas de disponibilidad. Esta acción no se puede deshacer.",
    "Keep meeting": "Conservar la reunión",
    "Delete permanently": "Eliminar permanentemente",
    "Remove this participant?": "¿Eliminar a este participante?",
    "{name} and all of their availability will be permanently removed from this meeting.":
      "{name} y toda su disponibilidad se eliminarán permanentemente de esta reunión.",
    "This participant": "Este participante",
    "Choose your meeting time": "Elige la hora de tu reunión",
    "Live availability heatmap": "Mapa de calor de disponibilidad en vivo",
    "Edit meeting": "Editar reunión",
    "Meeting could not be loaded": "No se pudo cargar la reunión",
    "Re-open the meeting from its dashboard before changing the schedule.":
      "Reabre la reunión desde su panel antes de cambiar el horario.",
    "This meeting is finalized": "Esta reunión está finalizada",
    "Back to meeting": "Volver a la reunión",
    "Return to meeting": "Regresar a la reunión",
    "Loading meeting form…": "Cargando formulario de reunión…",
    "Synk invitation": "Invitación de Synk",
    "Restoring your response…": "Restaurando tu respuesta…",
    "Choose a name saved on this device or enter a new one. Next, you'll select your available hours directly on the calendar.":
      "Elige un nombre guardado en este dispositivo o ingresa uno nuevo. Luego, selecciona tus horas disponibles directamente en el calendario.",
    "Saved response found": "Se encontró una respuesta guardada",
    "Enter a new name": "Ingresar un nombre nuevo",
    "Display name": "Nombre para mostrar",
    "Your name will be remembered only on this device.":
      "Tu nombre solo se recordará en este dispositivo.",
    "Choose a saved name instead": "Elegir un nombre guardado en su lugar",
    "Choose or enter a name between 2 and 30 characters.":
      "Elige o ingresa un nombre de entre 2 y 30 caracteres.",
    "Select the times that work for you; changes autosave.":
      "Selecciona los horarios que te funcionen; los cambios se guardan automáticamente.",
    "Open my saved availability": "Abrir mi disponibilidad guardada",
    "Continue as {name}?": "¿Continuar como {name}?",
    "We found your response on this device. Continue to review or update your availability.":
      "Encontramos tu respuesta en este dispositivo. Continúa para revisar o actualizar tu disponibilidad.",
    "Continue as {name}": "Continuar como {name}",
    "We couldn't restore your response": "No pudimos restaurar tu respuesta",
    "Check your connection and try again. You can also continue with a different participant name.":
      "Revisa tu conexión e inténtalo de nuevo. También puedes continuar con otro nombre de participante.",
    "Try again": "Reintentar",
    "Choose a name": "Elegir un nombre",
    "This link is invalid, expired, or the organizer deleted the meeting. Ask the organizer for a fresh invitation.":
      "Este enlace no es válido, expiró, o el organizador eliminó la reunión. Pide una nueva invitación al organizador.",
    "Return to Synk": "Volver a Synk",
    "Synk home": "Inicio de Synk",
    "Organizer access": "Acceso de organizador",
    "Enter a valid email address.": "Ingresa una dirección de correo válida.",
    "Enter your password.": "Ingresa tu contraseña.",
    "Use at least 8 characters.": "Usa al menos 8 caracteres.",
    "Use no more than 72 characters.": "Usa no más de 72 caracteres.",
    "Add a lowercase letter.": "Agrega una letra minúscula.",
    "Add an uppercase letter.": "Agrega una letra mayúscula.",
    "Add a number.": "Agrega un número.",
    "Add a special character.": "Agrega un carácter especial.",
    "Passwords do not match.": "Las contraseñas no coinciden.",
    "Unable to connect to Synk. Is the API running?":
      "No se pudo conectar con Synk. ¿La API está en funcionamiento?",
    "Hide password": "Ocultar contraseña",
    "Show password": "Mostrar contraseña",
    "8+ strong characters": "8+ caracteres seguros",
    "Your password": "Tu contraseña",
    "Repeat your password": "Repite tu contraseña",
    "Already organizing with Synk?": "¿Ya organizas con Synk?",
    "New to Synk?": "¿Nuevo en Synk?",
    "Checking your session…": "Verificando tu sesión…",
    "Meeting updated": "Reunión actualizada",
    "Meeting created": "Reunión creada",
    "Your schedule and invitation details are up to date.":
      "Tu horario y los detalles de la invitación están actualizados.",
    "Your private invitation is ready to share.":
      "Tu invitación privada está lista para compartir.",
    "End date must be on or after the start date.":
      "La fecha de fin debe ser igual o posterior a la fecha de inicio.",
    "Working hours must end after they start.":
      "El horario laboral debe terminar después de empezar.",
    "Meeting duration cannot be longer than the daily scheduling window.":
      "La duración de la reunión no puede superar la ventana diaria de programación.",
    "Unable to reach Synk. Is the API running?":
      "No se pudo conectar con Synk. ¿La API está en funcionamiento?",
    "15 min": "15 min",
    "1 hour": "1 hora",
    "3 hours": "3 horas",
    "6 hours": "6 horas",
    "Drag the slider in 15-minute steps. Synk uses this exact duration for suggestions and finalization.":
      "Arrastra el control deslizante en pasos de 15 minutos. Synk usa esta duración exacta para las sugerencias y la finalización.",
    "Choose a start square, then an end square—just like booking a stay.":
      "Elige una casilla de inicio y luego una de fin, como al reservar una estadía.",
    "Now choose the last day": "Ahora elige el último día",
    "Choose the first day": "Elige el primer día",
    "Select two dates": "Selecciona dos fechas",
    "{duration} each selected day": "{duration} por cada día seleccionado",
    "The organizer needs to add at least one valid day and time slot before availability can be selected.":
      "El organizador debe agregar al menos un día y horario válidos antes de poder seleccionar disponibilidad.",
    "Your latest times and note are safely stored.":
      "Tus últimos horarios y notas están guardados de forma segura.",
    "For example: I can join 15 minutes late on Wednesday.":
      "Por ejemplo: puedo unirme 15 minutos tarde el miércoles.",
    "Your selections and note autosave after a short pause.":
      "Tus selecciones y notas se guardan automáticamente tras una breve pausa.",
    "Choose a start square or drag across the grid. Synk highlights the full {duration} meeting.":
      "Elige una casilla de inicio o arrastra por la cuadrícula. Synk resalta toda la reunión de {duration}.",
    "Hover or focus a square to see who is available.":
      "Pasa el cursor o enfoca una casilla para ver quién está disponible.",
    "The heatmap will fill as participants respond.":
      "El mapa de calor se llenará a medida que los participantes respondan.",
    "Heatmap legend": "Leyenda del mapa de calor",
    Perfect: "Perfecto",
    Select: "Seleccionar",
    Confirmed: "Confirmada",
    "{title} now has a confirmed time.": "{title} ahora tiene una hora confirmada.",
    Date: "Fecha",
    Time: "Hora",
    "The organizer is confirming the exact time.":
      "El organizador está confirmando la hora exacta.",
    "Suggestions appear as soon as someone saves availability.":
      "Las sugerencias aparecen en cuanto alguien guarda su disponibilidad.",
  },
  pt: {
    Language: "Idioma",
    "Log in": "Entrar",
    "Sign up": "Criar conta",
    "Find the time that works for everyone.":
      "Encontre o horário ideal para todos.",
    "Scheduling without the back-and-forth": "Agendamento sem idas e vindas",
    "Create an availability poll, share one secure link, and see the perfect overlap. Participants never need an account.":
      "Crie uma enquete, compartilhe um link seguro e encontre o melhor horário. Participantes não precisam de conta.",
    "Create your first poll": "Criar primeira enquete",
    "Organizer login": "Login do organizador",
    "Visual availability": "Disponibilidade visual",
    "No participant accounts": "Sem contas de participantes",
    "Find time. Together.": "Encontre tempo. Juntos.",
    Dashboard: "Painel",
    "Your meetings": "Suas reuniões",
    "Create meeting": "Criar reunião",
    Upcoming: "Próximas",
    Finalized: "Finalizadas",
    Past: "Passadas",
    "No meetings yet": "Nenhuma reunião",
    "Load more meetings": "Carregar mais",
    "Back to meetings": "Voltar às reuniões",
    "Meeting title": "Título da reunião",
    Description: "Descrição",
    optional: "opcional",
    "Meeting duration": "Duração",
    Timezone: "Fuso horário",
    Cancel: "Cancelar",
    "Save changes": "Salvar alterações",
    "Schedule window": "Janela de horários",
    "Pick the days and hours visually": "Escolha dias e horas visualmente",
    "Date range": "Intervalo de datas",
    Start: "Início",
    End: "Fim",
    "Previous month": "Mês anterior",
    "Next month": "Próximo mês",
    "Daily working hours": "Horário diário",
    "Choose the first time quarter": "Escolha o primeiro quarto de hora",
    "Choose the last time quarter": "Escolha o último quarto de hora",
    to: "até",
    "Select date": "Selecionar data",
    "Your availability": "Sua disponibilidade",
    "Responding as": "Respondendo como",
    "Save now": "Salvar agora",
    "Optional note": "Nota opcional",
    "Availability saved": "Disponibilidade salva",
    "No schedule slots yet": "Sem horários",
    "Autosave ready": "Salvamento automático pronto",
    "Changes pending": "Alterações pendentes",
    "Saving…": "Salvando…",
    Saved: "Salvo",
    "Not saved": "Não salvo",
    "No heatmap data": "Sem dados de disponibilidade",
    "No participants available": "Nenhum participante disponível",
    available: "disponíveis",
    "Top matches": "Melhores horários",
    "Create your own": "Escolher outro",
    Participants: "Participantes",
    Responses: "Respostas",
    Schedule: "Horário",
    "Copy invite": "Copiar convite",
    Copied: "Copiado",
    "Lock responses": "Fechar respostas",
    "Open responses": "Abrir respostas",
    "Delete meeting": "Excluir reunião",
    "Remove participant": "Remover participante",
    Edit: "Editar",
    "Open Google Meet": "Abrir Google Meet",
    "Who’s responding?": "Quem está respondendo?",
    "Continue to availability": "Continuar para disponibilidade",
    "Use this name": "Usar este nome",
    "Saved on this device": "Salvo neste dispositivo",
    "Responses are closed": "As respostas estão fechadas",
    "Invitation not found": "Convite não encontrado",
    Email: "E-mail",
    Password: "Senha",
    "Confirm password": "Confirmar senha",
    "Create organizer account": "Criar conta de organizador",
    "Quarter-hour slots": "Blocos de 15 minutos",
    "Each hour is split into four independently selectable quarters.":
      "Cada hora é dividida em quatro partes selecionáveis separadamente.",
    "Loading…": "Carregando…",
    "Welcome back": "Bem-vindo de volta",
    "Use another name": "Usar outro nome",
    "Log out": "Sair",
    "Your availability could not be saved.":
      "Não foi possível salvar sua disponibilidade.",
    "No matches yet": "Ainda não há correspondências",
    "Synk hit an unexpected problem. Your saved data is safe; retry the page to continue.":
      "O Synk encontrou um problema inesperado. Seus dados salvos estão seguros; recarregue a página para continuar.",
    "Something went wrong": "Algo deu errado",
    "Welcome back. Your meetings and responses are waiting.":
      "Bem-vindo de volta. Suas reuniões e respostas estão esperando.",
    "Log in to Synk": "Entrar no Synk",
    "Create polls, share one secure link, and find the overlap.":
      "Crie enquetes, compartilhe um link seguro e encontre o horário em comum.",
    "Start organizing": "Começar a organizar",
    "Signed in as": "Conectado como",
    "Create a poll, share its private invitation link, and watch responses arrive.":
      "Crie uma enquete, compartilhe seu link de convite privado e acompanhe as respostas chegarem.",
    "Check that the API and database are running, then try again.":
      "Verifique se a API e o banco de dados estão em execução e tente novamente.",
    "Could not load your meetings": "Não foi possível carregar suas reuniões",
    "Create your first meeting": "Crie sua primeira reunião",
    "Your first availability poll takes less than a minute to create.":
      "Sua primeira enquete de disponibilidade leva menos de um minuto para criar.",
    "Define the window, then share the secure link with your participants.":
      "Defina o período e compartilhe o link seguro com seus participantes.",
    "Meeting deleted": "Reunião excluída",
    "The invitation and all responses were removed.":
      "O convite e todas as respostas foram removidos.",
    "Participant removed": "Participante removido",
    "{name} and their availability were removed.":
      "{name} e sua disponibilidade foram removidos.",
    "The participant and their availability were removed.":
      "O participante e sua disponibilidade foram removidos.",
    "Responses locked": "Respostas bloqueadas",
    "Responses reopened": "Respostas reabertas",
    "Participants can view the invitation but cannot edit responses.":
      "Os participantes podem ver o convite, mas não podem editar as respostas.",
    "Participants can edit their availability again.":
      "Os participantes podem editar sua disponibilidade novamente.",
    "Meeting reopened": "Reunião reaberta",
    "Finalization was removed and responses are open again.":
      "A finalização foi removida e as respostas estão abertas novamente.",
    "Meeting scheduled": "Reunião agendada",
    "The confirmed time is now visible to every participant.":
      "O horário confirmado agora está visível para todos os participantes.",
    "It may have been deleted, or it belongs to another organizer.":
      "Ela pode ter sido excluída ou pertence a outro organizador.",
    "Meeting not found": "Reunião não encontrada",
    "Invitation copied": "Convite copiado",
    "The private Synk link is ready to share.":
      "O link privado do Synk está pronto para compartilhar.",
    "Could not copy the link": "Não foi possível copiar o link",
    "Your browser blocked clipboard access. Copy it from the address bar instead.":
      "Seu navegador bloqueou o acesso à área de transferência. Copie-o da barra de endereços.",
    "All meetings": "Todas as reuniões",
    "Re-open meeting": "Reabrir reunião",
    "Delete this meeting?": "Excluir esta reunião?",
    "This permanently removes the invitation, participant names, comments, and every availability response. This cannot be undone.":
      "Isso remove permanentemente o convite, os nomes dos participantes, os comentários e todas as respostas de disponibilidade. Esta ação não pode ser desfeita.",
    "Keep meeting": "Manter reunião",
    "Delete permanently": "Excluir permanentemente",
    "Remove this participant?": "Remover este participante?",
    "{name} and all of their availability will be permanently removed from this meeting.":
      "{name} e toda a sua disponibilidade serão removidos permanentemente desta reunião.",
    "This participant": "Este participante",
    "Choose your meeting time": "Escolha o horário da sua reunião",
    "Live availability heatmap": "Mapa de calor de disponibilidade ao vivo",
    "Edit meeting": "Editar reunião",
    "Meeting could not be loaded": "Não foi possível carregar a reunião",
    "Re-open the meeting from its dashboard before changing the schedule.":
      "Reabra a reunião pelo painel antes de alterar o horário.",
    "This meeting is finalized": "Esta reunião está finalizada",
    "Back to meeting": "Voltar à reunião",
    "Return to meeting": "Retornar à reunião",
    "Loading meeting form…": "Carregando formulário da reunião…",
    "Synk invitation": "Convite do Synk",
    "Restoring your response…": "Restaurando sua resposta…",
    "Choose a name saved on this device or enter a new one. Next, you'll select your available hours directly on the calendar.":
      "Escolha um nome salvo neste dispositivo ou digite um novo. Em seguida, selecione seus horários disponíveis diretamente no calendário.",
    "Saved response found": "Resposta salva encontrada",
    "Enter a new name": "Digitar um novo nome",
    "Display name": "Nome de exibição",
    "Your name will be remembered only on this device.":
      "Seu nome será lembrado apenas neste dispositivo.",
    "Choose a saved name instead": "Escolher um nome salvo",
    "Choose or enter a name between 2 and 30 characters.":
      "Escolha ou digite um nome entre 2 e 30 caracteres.",
    "Select the times that work for you; changes autosave.":
      "Selecione os horários que funcionam para você; as alterações são salvas automaticamente.",
    "Open my saved availability": "Abrir minha disponibilidade salva",
    "Continue as {name}?": "Continuar como {name}?",
    "We found your response on this device. Continue to review or update your availability.":
      "Encontramos sua resposta neste dispositivo. Continue para revisar ou atualizar sua disponibilidade.",
    "Continue as {name}": "Continuar como {name}",
    "We couldn't restore your response": "Não conseguimos restaurar sua resposta",
    "Check your connection and try again. You can also continue with a different participant name.":
      "Verifique sua conexão e tente novamente. Você também pode continuar com outro nome de participante.",
    "Try again": "Tentar novamente",
    "Choose a name": "Escolher um nome",
    "This link is invalid, expired, or the organizer deleted the meeting. Ask the organizer for a fresh invitation.":
      "Este link é inválido, expirou, ou o organizador excluiu a reunião. Peça um novo convite ao organizador.",
    "Return to Synk": "Voltar ao Synk",
    "Synk home": "Início do Synk",
    "Organizer access": "Acesso do organizador",
    "Enter a valid email address.": "Digite um endereço de e-mail válido.",
    "Enter your password.": "Digite sua senha.",
    "Use at least 8 characters.": "Use pelo menos 8 caracteres.",
    "Use no more than 72 characters.": "Use no máximo 72 caracteres.",
    "Add a lowercase letter.": "Adicione uma letra minúscula.",
    "Add an uppercase letter.": "Adicione uma letra maiúscula.",
    "Add a number.": "Adicione um número.",
    "Add a special character.": "Adicione um caractere especial.",
    "Passwords do not match.": "As senhas não coincidem.",
    "Unable to connect to Synk. Is the API running?":
      "Não foi possível conectar ao Synk. A API está em execução?",
    "Hide password": "Ocultar senha",
    "Show password": "Mostrar senha",
    "8+ strong characters": "8+ caracteres fortes",
    "Your password": "Sua senha",
    "Repeat your password": "Repita sua senha",
    "Already organizing with Synk?": "Já organiza com o Synk?",
    "New to Synk?": "Novo no Synk?",
    "Checking your session…": "Verificando sua sessão…",
    "Meeting updated": "Reunião atualizada",
    "Meeting created": "Reunião criada",
    "Your schedule and invitation details are up to date.":
      "Seu horário e os detalhes do convite estão atualizados.",
    "Your private invitation is ready to share.":
      "Seu convite privado está pronto para compartilhar.",
    "End date must be on or after the start date.":
      "A data de término deve ser igual ou posterior à data de início.",
    "Working hours must end after they start.":
      "O horário de trabalho deve terminar depois de começar.",
    "Meeting duration cannot be longer than the daily scheduling window.":
      "A duração da reunião não pode ser maior que a janela diária de agendamento.",
    "Unable to reach Synk. Is the API running?":
      "Não foi possível conectar ao Synk. A API está em execução?",
    "15 min": "15 min",
    "1 hour": "1 hora",
    "3 hours": "3 horas",
    "6 hours": "6 horas",
    "Drag the slider in 15-minute steps. Synk uses this exact duration for suggestions and finalization.":
      "Arraste o controle deslizante em passos de 15 minutos. O Synk usa essa duração exata para sugestões e finalização.",
    "Choose a start square, then an end square—just like booking a stay.":
      "Escolha um quadrado inicial e depois um final — como ao reservar uma estadia.",
    "Now choose the last day": "Agora escolha o último dia",
    "Choose the first day": "Escolha o primeiro dia",
    "Select two dates": "Selecione duas datas",
    "{duration} each selected day": "{duration} em cada dia selecionado",
    "The organizer needs to add at least one valid day and time slot before availability can be selected.":
      "O organizador precisa adicionar pelo menos um dia e horário válidos antes que a disponibilidade possa ser selecionada.",
    "Your latest times and note are safely stored.":
      "Seus horários e nota mais recentes estão armazenados com segurança.",
    "For example: I can join 15 minutes late on Wednesday.":
      "Por exemplo: posso entrar 15 minutos atrasado na quarta-feira.",
    "Your selections and note autosave after a short pause.":
      "Suas seleções e nota são salvas automaticamente após uma breve pausa.",
    "Choose a start square or drag across the grid. Synk highlights the full {duration} meeting.":
      "Escolha um quadrado inicial ou arraste pela grade. O Synk destaca toda a reunião de {duration}.",
    "Hover or focus a square to see who is available.":
      "Passe o mouse ou foque um quadrado para ver quem está disponível.",
    "The heatmap will fill as participants respond.":
      "O mapa de calor será preenchido à medida que os participantes responderem.",
    "Heatmap legend": "Legenda do mapa de calor",
    Perfect: "Perfeito",
    Select: "Selecionar",
    Confirmed: "Confirmada",
    "{title} now has a confirmed time.": "{title} agora tem um horário confirmado.",
    Date: "Data",
    Time: "Hora",
    "The organizer is confirming the exact time.":
      "O organizador está confirmando o horário exato.",
    "Suggestions appear as soon as someone saves availability.":
      "As sugestões aparecem assim que alguém salva sua disponibilidade.",
  },
  ru: {
    Language: "Язык",
    "Log in": "Войти",
    "Sign up": "Регистрация",
    "Find the time that works for everyone.": "Найдите время, удобное всем.",
    "Scheduling without the back-and-forth":
      "Планирование без лишней переписки",
    "Create an availability poll, share one secure link, and see the perfect overlap. Participants never need an account.":
      "Создайте опрос, отправьте безопасную ссылку и найдите общее время. Участникам не нужна учётная запись.",
    "Create your first poll": "Создать первый опрос",
    "Organizer login": "Вход организатора",
    "Visual availability": "Наглядная доступность",
    "No participant accounts": "Без аккаунтов участников",
    "Find time. Together.": "Найдём время вместе.",
    Dashboard: "Панель",
    "Your meetings": "Ваши встречи",
    "Create meeting": "Создать встречу",
    Upcoming: "Предстоящие",
    Finalized: "Подтверждённые",
    Past: "Прошедшие",
    "No meetings yet": "Встреч пока нет",
    "Load more meetings": "Загрузить ещё",
    "Back to meetings": "Назад к встречам",
    "Meeting title": "Название встречи",
    Description: "Описание",
    optional: "необязательно",
    "Meeting duration": "Длительность",
    Timezone: "Часовой пояс",
    Cancel: "Отмена",
    "Save changes": "Сохранить",
    "Schedule window": "Диапазон расписания",
    "Pick the days and hours visually": "Выберите дни и часы",
    "Date range": "Диапазон дат",
    Start: "Начало",
    End: "Конец",
    "Previous month": "Предыдущий месяц",
    "Next month": "Следующий месяц",
    "Daily working hours": "Доступные часы",
    "Choose the first time quarter": "Выберите первую четверть часа",
    "Choose the last time quarter": "Выберите последнюю четверть часа",
    to: "до",
    "Select date": "Выберите дату",
    "Your availability": "Ваша доступность",
    "Responding as": "Ответ от",
    "Save now": "Сохранить",
    "Optional note": "Примечание",
    "Availability saved": "Доступность сохранена",
    "No schedule slots yet": "Нет временных интервалов",
    "Autosave ready": "Автосохранение готово",
    "Changes pending": "Есть изменения",
    "Saving…": "Сохранение…",
    Saved: "Сохранено",
    "Not saved": "Не сохранено",
    "No heatmap data": "Нет данных",
    "No participants available": "Никто не доступен",
    available: "доступны",
    "Top matches": "Лучшие варианты",
    "Create your own": "Выбрать вручную",
    Participants: "Участники",
    Responses: "Ответы",
    Schedule: "Расписание",
    "Copy invite": "Копировать приглашение",
    Copied: "Скопировано",
    "Lock responses": "Закрыть ответы",
    "Open responses": "Открыть ответы",
    "Delete meeting": "Удалить встречу",
    "Remove participant": "Удалить участника",
    Edit: "Изменить",
    "Open Google Meet": "Открыть Google Meet",
    "Who’s responding?": "Кто отвечает?",
    "Continue to availability": "Перейти к доступности",
    "Use this name": "Использовать имя",
    "Saved on this device": "Сохранено на устройстве",
    "Responses are closed": "Ответы закрыты",
    "Invitation not found": "Приглашение не найдено",
    Email: "Эл. почта",
    Password: "Пароль",
    "Confirm password": "Подтвердите пароль",
    "Create organizer account": "Создать аккаунт организатора",
    "Quarter-hour slots": "Интервалы по 15 минут",
    "Each hour is split into four independently selectable quarters.":
      "Каждый час разделён на четыре независимо выбираемых интервала.",
    "Loading…": "Загрузка…",
    "Welcome back": "С возвращением",
    "Use another name": "Использовать другое имя",
    "Log out": "Выйти",
    "Your availability could not be saved.":
      "Не удалось сохранить вашу доступность.",
    "No matches yet": "Пока нет совпадений",
    "Synk hit an unexpected problem. Your saved data is safe; retry the page to continue.":
      "В Synk возникла непредвиденная ошибка. Ваши сохранённые данные в безопасности; повторите загрузку страницы, чтобы продолжить.",
    "Something went wrong": "Что-то пошло не так",
    "Welcome back. Your meetings and responses are waiting.":
      "С возвращением. Вас ждут встречи и ответы.",
    "Log in to Synk": "Войти в Synk",
    "Create polls, share one secure link, and find the overlap.":
      "Создавайте опросы, делитесь одной безопасной ссылкой и находите общее время.",
    "Start organizing": "Начать организацию",
    "Signed in as": "Вы вошли как",
    "Create a poll, share its private invitation link, and watch responses arrive.":
      "Создайте опрос, поделитесь его личной ссылкой-приглашением и следите за ответами.",
    "Check that the API and database are running, then try again.":
      "Убедитесь, что API и база данных запущены, затем попробуйте снова.",
    "Could not load your meetings": "Не удалось загрузить ваши встречи",
    "Create your first meeting": "Создайте свою первую встречу",
    "Your first availability poll takes less than a minute to create.":
      "Создание первого опроса о доступности занимает менее минуты.",
    "Define the window, then share the secure link with your participants.":
      "Определите временной диапазон и поделитесь безопасной ссылкой с участниками.",
    "Meeting deleted": "Встреча удалена",
    "The invitation and all responses were removed.":
      "Приглашение и все ответы были удалены.",
    "Participant removed": "Участник удалён",
    "{name} and their availability were removed.":
      "{name} и его/её доступность были удалены.",
    "The participant and their availability were removed.":
      "Участник и его/её доступность были удалены.",
    "Responses locked": "Ответы заблокированы",
    "Responses reopened": "Ответы снова открыты",
    "Participants can view the invitation but cannot edit responses.":
      "Участники могут просматривать приглашение, но не могут редактировать ответы.",
    "Participants can edit their availability again.":
      "Участники снова могут редактировать свою доступность.",
    "Meeting reopened": "Встреча снова открыта",
    "Finalization was removed and responses are open again.":
      "Финализация была снята, ответы снова открыты.",
    "Meeting scheduled": "Встреча назначена",
    "The confirmed time is now visible to every participant.":
      "Подтверждённое время теперь видно всем участникам.",
    "It may have been deleted, or it belongs to another organizer.":
      "Возможно, она была удалена или принадлежит другому организатору.",
    "Meeting not found": "Встреча не найдена",
    "Invitation copied": "Приглашение скопировано",
    "The private Synk link is ready to share.":
      "Личная ссылка Synk готова к отправке.",
    "Could not copy the link": "Не удалось скопировать ссылку",
    "Your browser blocked clipboard access. Copy it from the address bar instead.":
      "Ваш браузер заблокировал доступ к буферу обмена. Скопируйте её из адресной строки.",
    "All meetings": "Все встречи",
    "Re-open meeting": "Снова открыть встречу",
    "Delete this meeting?": "Удалить эту встречу?",
    "This permanently removes the invitation, participant names, comments, and every availability response. This cannot be undone.":
      "Это навсегда удалит приглашение, имена участников, комментарии и все ответы о доступности. Это действие нельзя отменить.",
    "Keep meeting": "Оставить встречу",
    "Delete permanently": "Удалить навсегда",
    "Remove this participant?": "Удалить этого участника?",
    "{name} and all of their availability will be permanently removed from this meeting.":
      "{name} и вся его/её доступность будут навсегда удалены из этой встречи.",
    "This participant": "Этот участник",
    "Choose your meeting time": "Выберите время встречи",
    "Live availability heatmap": "Тепловая карта доступности в реальном времени",
    "Edit meeting": "Редактировать встречу",
    "Meeting could not be loaded": "Не удалось загрузить встречу",
    "Re-open the meeting from its dashboard before changing the schedule.":
      "Снова откройте встречу из панели управления, прежде чем менять расписание.",
    "This meeting is finalized": "Эта встреча завершена",
    "Back to meeting": "Назад к встрече",
    "Return to meeting": "Вернуться к встрече",
    "Loading meeting form…": "Загрузка формы встречи…",
    "Synk invitation": "Приглашение Synk",
    "Restoring your response…": "Восстановление вашего ответа…",
    "Choose a name saved on this device or enter a new one. Next, you'll select your available hours directly on the calendar.":
      "Выберите имя, сохранённое на этом устройстве, или введите новое. Далее вы выберете свободные часы прямо в календаре.",
    "Saved response found": "Найден сохранённый ответ",
    "Enter a new name": "Ввести новое имя",
    "Display name": "Отображаемое имя",
    "Your name will be remembered only on this device.":
      "Ваше имя будет запомнено только на этом устройстве.",
    "Choose a saved name instead": "Выбрать сохранённое имя вместо этого",
    "Choose or enter a name between 2 and 30 characters.":
      "Выберите или введите имя длиной от 2 до 30 символов.",
    "Select the times that work for you; changes autosave.":
      "Выберите удобное время; изменения сохраняются автоматически.",
    "Open my saved availability": "Открыть мою сохранённую доступность",
    "Continue as {name}?": "Продолжить как {name}?",
    "We found your response on this device. Continue to review or update your availability.":
      "Мы нашли ваш ответ на этом устройстве. Продолжите, чтобы просмотреть или обновить свою доступность.",
    "Continue as {name}": "Продолжить как {name}",
    "We couldn't restore your response": "Не удалось восстановить ваш ответ",
    "Check your connection and try again. You can also continue with a different participant name.":
      "Проверьте соединение и попробуйте снова. Также вы можете продолжить с другим именем участника.",
    "Try again": "Повторить",
    "Choose a name": "Выбрать имя",
    "This link is invalid, expired, or the organizer deleted the meeting. Ask the organizer for a fresh invitation.":
      "Эта ссылка недействительна, истекла, или организатор удалил встречу. Попросите у организатора новое приглашение.",
    "Return to Synk": "Вернуться в Synk",
    "Synk home": "Главная Synk",
    "Organizer access": "Доступ организатора",
    "Enter a valid email address.": "Введите действительный адрес электронной почты.",
    "Enter your password.": "Введите пароль.",
    "Use at least 8 characters.": "Используйте не менее 8 символов.",
    "Use no more than 72 characters.": "Используйте не более 72 символов.",
    "Add a lowercase letter.": "Добавьте строчную букву.",
    "Add an uppercase letter.": "Добавьте заглавную букву.",
    "Add a number.": "Добавьте цифру.",
    "Add a special character.": "Добавьте специальный символ.",
    "Passwords do not match.": "Пароли не совпадают.",
    "Unable to connect to Synk. Is the API running?":
      "Не удалось подключиться к Synk. API запущен?",
    "Hide password": "Скрыть пароль",
    "Show password": "Показать пароль",
    "8+ strong characters": "8+ надёжных символов",
    "Your password": "Ваш пароль",
    "Repeat your password": "Повторите пароль",
    "Already organizing with Synk?": "Уже организуете с Synk?",
    "New to Synk?": "Впервые в Synk?",
    "Checking your session…": "Проверка сеанса…",
    "Meeting updated": "Встреча обновлена",
    "Meeting created": "Встреча создана",
    "Your schedule and invitation details are up to date.":
      "Ваше расписание и данные приглашения актуальны.",
    "Your private invitation is ready to share.":
      "Ваше личное приглашение готово к отправке.",
    "End date must be on or after the start date.":
      "Дата окончания должна быть не раньше даты начала.",
    "Working hours must end after they start.":
      "Рабочие часы должны заканчиваться после начала.",
    "Meeting duration cannot be longer than the daily scheduling window.":
      "Продолжительность встречи не может превышать ежедневное окно планирования.",
    "Unable to reach Synk. Is the API running?":
      "Не удалось подключиться к Synk. API запущен?",
    "15 min": "15 мин",
    "1 hour": "1 час",
    "3 hours": "3 часа",
    "6 hours": "6 часов",
    "Drag the slider in 15-minute steps. Synk uses this exact duration for suggestions and finalization.":
      "Перетаскивайте ползунок с шагом 15 минут. Synk использует эту точную продолжительность для предложений и финализации.",
    "Choose a start square, then an end square—just like booking a stay.":
      "Выберите начальный квадрат, затем конечный — как при бронировании проживания.",
    "Now choose the last day": "Теперь выберите последний день",
    "Choose the first day": "Выберите первый день",
    "Select two dates": "Выберите две даты",
    "{duration} each selected day": "{duration} в каждый выбранный день",
    "The organizer needs to add at least one valid day and time slot before availability can be selected.":
      "Организатору нужно добавить хотя бы один действительный день и временной слот, прежде чем можно будет выбрать доступность.",
    "Your latest times and note are safely stored.":
      "Ваши последние временные интервалы и заметка надёжно сохранены.",
    "For example: I can join 15 minutes late on Wednesday.":
      "Например: я могу присоединиться на 15 минут позже в среду.",
    "Your selections and note autosave after a short pause.":
      "Ваш выбор и заметка автоматически сохраняются после короткой паузы.",
    "Choose a start square or drag across the grid. Synk highlights the full {duration} meeting.":
      "Выберите начальный квадрат или протяните по сетке. Synk выделяет всю встречу продолжительностью {duration}.",
    "Hover or focus a square to see who is available.":
      "Наведите курсор или сфокусируйтесь на квадрате, чтобы увидеть, кто доступен.",
    "The heatmap will fill as participants respond.":
      "Тепловая карта будет заполняться по мере ответов участников.",
    "Heatmap legend": "Легенда тепловой карты",
    Perfect: "Идеально",
    Select: "Выбрать",
    Confirmed: "Подтверждено",
    "{title} now has a confirmed time.": "У {title} теперь есть подтверждённое время.",
    Date: "Дата",
    Time: "Время",
    "The organizer is confirming the exact time.":
      "Организатор подтверждает точное время.",
    "Suggestions appear as soon as someone saves availability.":
      "Предложения появляются, как только кто-то сохраняет свою доступность.",
  },
  de: {
    Language: "Sprache",
    "Log in": "Anmelden",
    "Sign up": "Registrieren",
    "Find the time that works for everyone.":
      "Finde die Zeit, die für alle passt.",
    "Scheduling without the back-and-forth": "Terminfindung ohne Hin und Her",
    "Create an availability poll, share one secure link, and see the perfect overlap. Participants never need an account.":
      "Erstelle eine Umfrage, teile einen sicheren Link und finde die beste Überschneidung. Teilnehmende brauchen kein Konto.",
    "Create your first poll": "Erste Umfrage erstellen",
    "Organizer login": "Organisator-Anmeldung",
    "Visual availability": "Visuelle Verfügbarkeit",
    "No participant accounts": "Keine Teilnehmerkonten",
    "Find time. Together.": "Gemeinsam Zeit finden.",
    Dashboard: "Übersicht",
    "Your meetings": "Deine Meetings",
    "Create meeting": "Meeting erstellen",
    Upcoming: "Bevorstehend",
    Finalized: "Festgelegt",
    Past: "Vergangen",
    "No meetings yet": "Noch keine Meetings",
    "Load more meetings": "Mehr laden",
    "Back to meetings": "Zurück zu Meetings",
    "Meeting title": "Meeting-Titel",
    Description: "Beschreibung",
    optional: "optional",
    "Meeting duration": "Meeting-Dauer",
    Timezone: "Zeitzone",
    Cancel: "Abbrechen",
    "Save changes": "Änderungen speichern",
    "Schedule window": "Zeitraum",
    "Pick the days and hours visually": "Tage und Zeiten visuell auswählen",
    "Date range": "Datumsbereich",
    Start: "Start",
    End: "Ende",
    "Previous month": "Vorheriger Monat",
    "Next month": "Nächster Monat",
    "Daily working hours": "Tägliche Zeiten",
    "Choose the first time quarter": "Erste Viertelstunde wählen",
    "Choose the last time quarter": "Letzte Viertelstunde wählen",
    to: "bis",
    "Select date": "Datum wählen",
    "Your availability": "Deine Verfügbarkeit",
    "Responding as": "Antwort als",
    "Save now": "Jetzt speichern",
    "Optional note": "Optionale Notiz",
    "Availability saved": "Verfügbarkeit gespeichert",
    "No schedule slots yet": "Keine Zeitfelder",
    "Autosave ready": "Autospeichern bereit",
    "Changes pending": "Änderungen ausstehend",
    "Saving…": "Speichern…",
    Saved: "Gespeichert",
    "Not saved": "Nicht gespeichert",
    "No heatmap data": "Keine Verfügbarkeitsdaten",
    "No participants available": "Niemand verfügbar",
    available: "verfügbar",
    "Top matches": "Beste Zeiten",
    "Create your own": "Eigene Zeit wählen",
    Participants: "Teilnehmende",
    Responses: "Antworten",
    Schedule: "Zeitplan",
    "Copy invite": "Einladung kopieren",
    Copied: "Kopiert",
    "Lock responses": "Antworten schließen",
    "Open responses": "Antworten öffnen",
    "Delete meeting": "Meeting löschen",
    "Remove participant": "Teilnehmer entfernen",
    Edit: "Bearbeiten",
    "Open Google Meet": "Google Meet öffnen",
    "Who’s responding?": "Wer antwortet?",
    "Continue to availability": "Zur Verfügbarkeit",
    "Use this name": "Diesen Namen verwenden",
    "Saved on this device": "Auf diesem Gerät gespeichert",
    "Responses are closed": "Antworten sind geschlossen",
    "Invitation not found": "Einladung nicht gefunden",
    Email: "E-Mail",
    Password: "Passwort",
    "Confirm password": "Passwort bestätigen",
    "Create organizer account": "Organisator-Konto erstellen",
    "Quarter-hour slots": "15-Minuten-Felder",
    "Each hour is split into four independently selectable quarters.":
      "Jede Stunde ist in vier einzeln wählbare Viertel geteilt.",
    "Loading…": "Wird geladen…",
    "Welcome back": "Willkommen zurück",
    "Use another name": "Anderen Namen verwenden",
    "Log out": "Abmelden",
    "Your availability could not be saved.":
      "Deine Verfügbarkeit konnte nicht gespeichert werden.",
    "No matches yet": "Noch keine Übereinstimmungen",
    "Synk hit an unexpected problem. Your saved data is safe; retry the page to continue.":
      "Bei Synk ist ein unerwartetes Problem aufgetreten. Deine gespeicherten Daten sind sicher; lade die Seite erneut, um fortzufahren.",
    "Something went wrong": "Etwas ist schiefgelaufen",
    "Welcome back. Your meetings and responses are waiting.":
      "Willkommen zurück. Deine Termine und Antworten warten auf dich.",
    "Log in to Synk": "Bei Synk anmelden",
    "Create polls, share one secure link, and find the overlap.":
      "Erstelle Umfragen, teile einen sicheren Link und finde die Überschneidung.",
    "Start organizing": "Mit dem Organisieren beginnen",
    "Signed in as": "Angemeldet als",
    "Create a poll, share its private invitation link, and watch responses arrive.":
      "Erstelle eine Umfrage, teile ihren privaten Einladungslink und verfolge die eingehenden Antworten.",
    "Check that the API and database are running, then try again.":
      "Prüfe, ob die API und die Datenbank laufen, und versuche es erneut.",
    "Could not load your meetings": "Deine Termine konnten nicht geladen werden",
    "Create your first meeting": "Erstelle deinen ersten Termin",
    "Your first availability poll takes less than a minute to create.":
      "Deine erste Verfügbarkeitsumfrage ist in weniger als einer Minute erstellt.",
    "Define the window, then share the secure link with your participants.":
      "Lege den Zeitraum fest und teile dann den sicheren Link mit deinen Teilnehmern.",
    "Meeting deleted": "Termin gelöscht",
    "The invitation and all responses were removed.":
      "Die Einladung und alle Antworten wurden entfernt.",
    "Participant removed": "Teilnehmer entfernt",
    "{name} and their availability were removed.":
      "{name} und ihre/seine Verfügbarkeit wurden entfernt.",
    "The participant and their availability were removed.":
      "Der Teilnehmer und seine/ihre Verfügbarkeit wurden entfernt.",
    "Responses locked": "Antworten gesperrt",
    "Responses reopened": "Antworten wieder geöffnet",
    "Participants can view the invitation but cannot edit responses.":
      "Teilnehmer können die Einladung ansehen, aber keine Antworten bearbeiten.",
    "Participants can edit their availability again.":
      "Teilnehmer können ihre Verfügbarkeit wieder bearbeiten.",
    "Meeting reopened": "Termin wieder geöffnet",
    "Finalization was removed and responses are open again.":
      "Die Finalisierung wurde entfernt, und Antworten sind wieder offen.",
    "Meeting scheduled": "Termin geplant",
    "The confirmed time is now visible to every participant.":
      "Die bestätigte Zeit ist jetzt für alle Teilnehmer sichtbar.",
    "It may have been deleted, or it belongs to another organizer.":
      "Er wurde möglicherweise gelöscht oder gehört einem anderen Organisator.",
    "Meeting not found": "Termin nicht gefunden",
    "Invitation copied": "Einladung kopiert",
    "The private Synk link is ready to share.":
      "Der private Synk-Link ist bereit zum Teilen.",
    "Could not copy the link": "Der Link konnte nicht kopiert werden",
    "Your browser blocked clipboard access. Copy it from the address bar instead.":
      "Dein Browser hat den Zugriff auf die Zwischenablage blockiert. Kopiere ihn stattdessen aus der Adressleiste.",
    "All meetings": "Alle Termine",
    "Re-open meeting": "Termin wieder öffnen",
    "Delete this meeting?": "Diesen Termin löschen?",
    "This permanently removes the invitation, participant names, comments, and every availability response. This cannot be undone.":
      "Dies entfernt dauerhaft die Einladung, die Namen der Teilnehmer, Kommentare und jede Verfügbarkeitsantwort. Dies kann nicht rückgängig gemacht werden.",
    "Keep meeting": "Termin behalten",
    "Delete permanently": "Dauerhaft löschen",
    "Remove this participant?": "Diesen Teilnehmer entfernen?",
    "{name} and all of their availability will be permanently removed from this meeting.":
      "{name} und alle ihre/seine Verfügbarkeit werden dauerhaft aus diesem Termin entfernt.",
    "This participant": "Dieser Teilnehmer",
    "Choose your meeting time": "Wähle deine Termin-Zeit",
    "Live availability heatmap": "Live-Verfügbarkeits-Heatmap",
    "Edit meeting": "Termin bearbeiten",
    "Meeting could not be loaded": "Der Termin konnte nicht geladen werden",
    "Re-open the meeting from its dashboard before changing the schedule.":
      "Öffne den Termin über sein Dashboard erneut, bevor du den Zeitplan änderst.",
    "This meeting is finalized": "Dieser Termin ist finalisiert",
    "Back to meeting": "Zurück zum Termin",
    "Return to meeting": "Zum Termin zurückkehren",
    "Loading meeting form…": "Terminformular wird geladen…",
    "Synk invitation": "Synk-Einladung",
    "Restoring your response…": "Deine Antwort wird wiederhergestellt…",
    "Choose a name saved on this device or enter a new one. Next, you'll select your available hours directly on the calendar.":
      "Wähle einen auf diesem Gerät gespeicherten Namen oder gib einen neuen ein. Als Nächstes wählst du deine verfügbaren Stunden direkt im Kalender aus.",
    "Saved response found": "Gespeicherte Antwort gefunden",
    "Enter a new name": "Neuen Namen eingeben",
    "Display name": "Anzeigename",
    "Your name will be remembered only on this device.":
      "Dein Name wird nur auf diesem Gerät gespeichert.",
    "Choose a saved name instead": "Stattdessen einen gespeicherten Namen wählen",
    "Choose or enter a name between 2 and 30 characters.":
      "Wähle oder gib einen Namen zwischen 2 und 30 Zeichen ein.",
    "Select the times that work for you; changes autosave.":
      "Wähle die Zeiten, die dir passen; Änderungen werden automatisch gespeichert.",
    "Open my saved availability": "Meine gespeicherte Verfügbarkeit öffnen",
    "Continue as {name}?": "Als {name} fortfahren?",
    "We found your response on this device. Continue to review or update your availability.":
      "Wir haben deine Antwort auf diesem Gerät gefunden. Fahre fort, um deine Verfügbarkeit zu überprüfen oder zu aktualisieren.",
    "Continue as {name}": "Als {name} fortfahren",
    "We couldn't restore your response": "Wir konnten deine Antwort nicht wiederherstellen",
    "Check your connection and try again. You can also continue with a different participant name.":
      "Prüfe deine Verbindung und versuche es erneut. Du kannst auch mit einem anderen Teilnehmernamen fortfahren.",
    "Try again": "Erneut versuchen",
    "Choose a name": "Namen wählen",
    "This link is invalid, expired, or the organizer deleted the meeting. Ask the organizer for a fresh invitation.":
      "Dieser Link ist ungültig, abgelaufen, oder der Organisator hat den Termin gelöscht. Bitte den Organisator um eine neue Einladung.",
    "Return to Synk": "Zurück zu Synk",
    "Synk home": "Synk-Startseite",
    "Organizer access": "Organisator-Zugang",
    "Enter a valid email address.": "Gib eine gültige E-Mail-Adresse ein.",
    "Enter your password.": "Gib dein Passwort ein.",
    "Use at least 8 characters.": "Verwende mindestens 8 Zeichen.",
    "Use no more than 72 characters.": "Verwende nicht mehr als 72 Zeichen.",
    "Add a lowercase letter.": "Füge einen Kleinbuchstaben hinzu.",
    "Add an uppercase letter.": "Füge einen Großbuchstaben hinzu.",
    "Add a number.": "Füge eine Zahl hinzu.",
    "Add a special character.": "Füge ein Sonderzeichen hinzu.",
    "Passwords do not match.": "Die Passwörter stimmen nicht überein.",
    "Unable to connect to Synk. Is the API running?":
      "Verbindung zu Synk nicht möglich. Läuft die API?",
    "Hide password": "Passwort verbergen",
    "Show password": "Passwort anzeigen",
    "8+ strong characters": "8+ starke Zeichen",
    "Your password": "Dein Passwort",
    "Repeat your password": "Wiederhole dein Passwort",
    "Already organizing with Synk?": "Organisierst du bereits mit Synk?",
    "New to Synk?": "Neu bei Synk?",
    "Checking your session…": "Deine Sitzung wird überprüft…",
    "Meeting updated": "Termin aktualisiert",
    "Meeting created": "Termin erstellt",
    "Your schedule and invitation details are up to date.":
      "Dein Zeitplan und die Einladungsdetails sind aktuell.",
    "Your private invitation is ready to share.":
      "Deine private Einladung ist bereit zum Teilen.",
    "End date must be on or after the start date.":
      "Das Enddatum muss am oder nach dem Startdatum liegen.",
    "Working hours must end after they start.":
      "Die Arbeitszeiten müssen nach ihrem Beginn enden.",
    "Meeting duration cannot be longer than the daily scheduling window.":
      "Die Termindauer darf nicht länger sein als das tägliche Planungsfenster.",
    "Unable to reach Synk. Is the API running?":
      "Synk ist nicht erreichbar. Läuft die API?",
    "15 min": "15 Min.",
    "1 hour": "1 Stunde",
    "3 hours": "3 Stunden",
    "6 hours": "6 Stunden",
    "Drag the slider in 15-minute steps. Synk uses this exact duration for suggestions and finalization.":
      "Ziehe den Schieberegler in 15-Minuten-Schritten. Synk verwendet diese genaue Dauer für Vorschläge und die Finalisierung.",
    "Choose a start square, then an end square—just like booking a stay.":
      "Wähle ein Startfeld und dann ein Endfeld — genau wie bei einer Buchung.",
    "Now choose the last day": "Wähle nun den letzten Tag",
    "Choose the first day": "Wähle den ersten Tag",
    "Select two dates": "Wähle zwei Daten",
    "{duration} each selected day": "{duration} an jedem ausgewählten Tag",
    "The organizer needs to add at least one valid day and time slot before availability can be selected.":
      "Der Organisator muss mindestens einen gültigen Tag und Zeitslot hinzufügen, bevor Verfügbarkeit ausgewählt werden kann.",
    "Your latest times and note are safely stored.":
      "Deine letzten Zeiten und Notiz sind sicher gespeichert.",
    "For example: I can join 15 minutes late on Wednesday.":
      "Zum Beispiel: Ich kann am Mittwoch 15 Minuten später dazukommen.",
    "Your selections and note autosave after a short pause.":
      "Deine Auswahl und Notiz werden nach einer kurzen Pause automatisch gespeichert.",
    "Choose a start square or drag across the grid. Synk highlights the full {duration} meeting.":
      "Wähle ein Startfeld oder ziehe über das Raster. Synk hebt den gesamten {duration}-Termin hervor.",
    "Hover or focus a square to see who is available.":
      "Fahre über ein Feld oder fokussiere es, um zu sehen, wer verfügbar ist.",
    "The heatmap will fill as participants respond.":
      "Die Heatmap füllt sich, sobald Teilnehmer antworten.",
    "Heatmap legend": "Heatmap-Legende",
    Perfect: "Perfekt",
    Select: "Auswählen",
    Confirmed: "Bestätigt",
    "{title} now has a confirmed time.": "{title} hat jetzt eine bestätigte Zeit.",
    Date: "Datum",
    Time: "Zeit",
    "The organizer is confirming the exact time.":
      "Der Organisator bestätigt gerade die genaue Zeit.",
    "Suggestions appear as soon as someone saves availability.":
      "Vorschläge erscheinen, sobald jemand seine Verfügbarkeit speichert.",
  },
  nl: {
    Language: "Taal",
    "Log in": "Inloggen",
    "Sign up": "Registreren",
    "Find the time that works for everyone.":
      "Vind het tijdstip dat voor iedereen past.",
    "Scheduling without the back-and-forth": "Plannen zonder heen-en-weer",
    "Create an availability poll, share one secure link, and see the perfect overlap. Participants never need an account.":
      "Maak een beschikbaarheidspeiling, deel één veilige link en vind de beste overlap. Deelnemers hebben geen account nodig.",
    "Create your first poll": "Maak je eerste peiling",
    "Organizer login": "Inloggen als organisator",
    "Visual availability": "Visuele beschikbaarheid",
    "No participant accounts": "Geen deelnemersaccounts",
    "Find time. Together.": "Samen tijd vinden.",
    Dashboard: "Dashboard",
    "Your meetings": "Jouw vergaderingen",
    "Create meeting": "Vergadering maken",
    Upcoming: "Komend",
    Finalized: "Vastgelegd",
    Past: "Voorbij",
    "No meetings yet": "Nog geen vergaderingen",
    "Load more meetings": "Meer laden",
    "Back to meetings": "Terug naar vergaderingen",
    "Meeting title": "Titel",
    Description: "Beschrijving",
    optional: "optioneel",
    "Meeting duration": "Duur",
    Timezone: "Tijdzone",
    Cancel: "Annuleren",
    "Save changes": "Wijzigingen opslaan",
    "Schedule window": "Planningsperiode",
    "Pick the days and hours visually": "Kies dagen en uren visueel",
    "Date range": "Datumbereik",
    Start: "Begin",
    End: "Einde",
    "Previous month": "Vorige maand",
    "Next month": "Volgende maand",
    "Daily working hours": "Dagelijkse uren",
    "Choose the first time quarter": "Kies het eerste kwartier",
    "Choose the last time quarter": "Kies het laatste kwartier",
    to: "tot",
    "Select date": "Kies datum",
    "Your availability": "Jouw beschikbaarheid",
    "Responding as": "Antwoord als",
    "Save now": "Nu opslaan",
    "Optional note": "Optionele notitie",
    "Availability saved": "Beschikbaarheid opgeslagen",
    "No schedule slots yet": "Geen tijdvakken",
    "Autosave ready": "Automatisch opslaan gereed",
    "Changes pending": "Wijzigingen wachten",
    "Saving…": "Opslaan…",
    Saved: "Opgeslagen",
    "Not saved": "Niet opgeslagen",
    "No heatmap data": "Geen beschikbaarheidsgegevens",
    "No participants available": "Niemand beschikbaar",
    available: "beschikbaar",
    "Top matches": "Beste tijden",
    "Create your own": "Zelf kiezen",
    Participants: "Deelnemers",
    Responses: "Reacties",
    Schedule: "Planning",
    "Copy invite": "Uitnodiging kopiëren",
    Copied: "Gekopieerd",
    "Lock responses": "Reacties sluiten",
    "Open responses": "Reacties openen",
    "Delete meeting": "Vergadering verwijderen",
    "Remove participant": "Deelnemer verwijderen",
    Edit: "Bewerken",
    "Open Google Meet": "Google Meet openen",
    "Who’s responding?": "Wie antwoordt?",
    "Continue to availability": "Verder naar beschikbaarheid",
    "Use this name": "Deze naam gebruiken",
    "Saved on this device": "Op dit apparaat opgeslagen",
    "Responses are closed": "Reacties zijn gesloten",
    "Invitation not found": "Uitnodiging niet gevonden",
    Email: "E-mail",
    Password: "Wachtwoord",
    "Confirm password": "Bevestig wachtwoord",
    "Create organizer account": "Organisatoraccount maken",
    "Quarter-hour slots": "Tijdvakken van 15 minuten",
    "Each hour is split into four independently selectable quarters.":
      "Elk uur is verdeeld in vier afzonderlijk selecteerbare kwartieren.",
    "Loading…": "Laden…",
    "Welcome back": "Welkom terug",
    "Use another name": "Andere naam gebruiken",
    "Log out": "Uitloggen",
    "Your availability could not be saved.":
      "Je beschikbaarheid kon niet worden opgeslagen.",
    "No matches yet": "Nog geen overeenkomsten",
    "Synk hit an unexpected problem. Your saved data is safe; retry the page to continue.":
      "Synk kreeg een onverwacht probleem. Je opgeslagen gegevens zijn veilig; probeer de pagina opnieuw om door te gaan.",
    "Something went wrong": "Er is iets misgegaan",
    "Welcome back. Your meetings and responses are waiting.":
      "Welkom terug. Je afspraken en reacties wachten op je.",
    "Log in to Synk": "Inloggen bij Synk",
    "Create polls, share one secure link, and find the overlap.":
      "Maak peilingen, deel één veilige link en vind de overlap.",
    "Start organizing": "Begin met organiseren",
    "Signed in as": "Ingelogd als",
    "Create a poll, share its private invitation link, and watch responses arrive.":
      "Maak een peiling, deel de privé-uitnodigingslink en zie de reacties binnenkomen.",
    "Check that the API and database are running, then try again.":
      "Controleer of de API en database draaien en probeer het opnieuw.",
    "Could not load your meetings": "Je afspraken konden niet worden geladen",
    "Create your first meeting": "Maak je eerste afspraak",
    "Your first availability poll takes less than a minute to create.":
      "Je eerste beschikbaarheidspeiling maak je in minder dan een minuut.",
    "Define the window, then share the secure link with your participants.":
      "Bepaal de periode en deel dan de veilige link met je deelnemers.",
    "Meeting deleted": "Afspraak verwijderd",
    "The invitation and all responses were removed.":
      "De uitnodiging en alle reacties zijn verwijderd.",
    "Participant removed": "Deelnemer verwijderd",
    "{name} and their availability were removed.":
      "{name} en hun beschikbaarheid zijn verwijderd.",
    "The participant and their availability were removed.":
      "De deelnemer en hun beschikbaarheid zijn verwijderd.",
    "Responses locked": "Reacties vergrendeld",
    "Responses reopened": "Reacties heropend",
    "Participants can view the invitation but cannot edit responses.":
      "Deelnemers kunnen de uitnodiging bekijken maar geen reacties bewerken.",
    "Participants can edit their availability again.":
      "Deelnemers kunnen hun beschikbaarheid weer bewerken.",
    "Meeting reopened": "Afspraak heropend",
    "Finalization was removed and responses are open again.":
      "De afronding is verwijderd en reacties staan weer open.",
    "Meeting scheduled": "Afspraak gepland",
    "The confirmed time is now visible to every participant.":
      "De bevestigde tijd is nu zichtbaar voor alle deelnemers.",
    "It may have been deleted, or it belongs to another organizer.":
      "Deze is mogelijk verwijderd of behoort toe aan een andere organisator.",
    "Meeting not found": "Afspraak niet gevonden",
    "Invitation copied": "Uitnodiging gekopieerd",
    "The private Synk link is ready to share.":
      "De privé Synk-link is klaar om te delen.",
    "Could not copy the link": "Kon de link niet kopiëren",
    "Your browser blocked clipboard access. Copy it from the address bar instead.":
      "Je browser blokkeerde toegang tot het klembord. Kopieer de link in plaats daarvan vanuit de adresbalk.",
    "All meetings": "Alle afspraken",
    "Re-open meeting": "Afspraak heropenen",
    "Delete this meeting?": "Deze afspraak verwijderen?",
    "This permanently removes the invitation, participant names, comments, and every availability response. This cannot be undone.":
      "Dit verwijdert permanent de uitnodiging, namen van deelnemers, opmerkingen en elke beschikbaarheidsreactie. Dit kan niet ongedaan worden gemaakt.",
    "Keep meeting": "Afspraak behouden",
    "Delete permanently": "Permanent verwijderen",
    "Remove this participant?": "Deze deelnemer verwijderen?",
    "{name} and all of their availability will be permanently removed from this meeting.":
      "{name} en al hun beschikbaarheid worden permanent uit deze afspraak verwijderd.",
    "This participant": "Deze deelnemer",
    "Choose your meeting time": "Kies je vergadertijd",
    "Live availability heatmap": "Live beschikbaarheids-heatmap",
    "Edit meeting": "Afspraak bewerken",
    "Meeting could not be loaded": "De afspraak kon niet worden geladen",
    "Re-open the meeting from its dashboard before changing the schedule.":
      "Heropen de afspraak vanuit het dashboard voordat je het schema wijzigt.",
    "This meeting is finalized": "Deze afspraak is afgerond",
    "Back to meeting": "Terug naar de afspraak",
    "Return to meeting": "Terugkeren naar de afspraak",
    "Loading meeting form…": "Afsprakenformulier wordt geladen…",
    "Synk invitation": "Synk-uitnodiging",
    "Restoring your response…": "Je reactie wordt hersteld…",
    "Choose a name saved on this device or enter a new one. Next, you'll select your available hours directly on the calendar.":
      "Kies een op dit apparaat opgeslagen naam of voer een nieuwe in. Vervolgens selecteer je je beschikbare uren direct in de kalender.",
    "Saved response found": "Opgeslagen reactie gevonden",
    "Enter a new name": "Nieuwe naam invoeren",
    "Display name": "Weergavenaam",
    "Your name will be remembered only on this device.":
      "Je naam wordt alleen op dit apparaat onthouden.",
    "Choose a saved name instead": "Kies in plaats daarvan een opgeslagen naam",
    "Choose or enter a name between 2 and 30 characters.":
      "Kies of voer een naam in van tussen 2 en 30 tekens.",
    "Select the times that work for you; changes autosave.":
      "Selecteer de tijden die voor jou werken; wijzigingen worden automatisch opgeslagen.",
    "Open my saved availability": "Mijn opgeslagen beschikbaarheid openen",
    "Continue as {name}?": "Doorgaan als {name}?",
    "We found your response on this device. Continue to review or update your availability.":
      "We hebben je reactie op dit apparaat gevonden. Ga verder om je beschikbaarheid te bekijken of bij te werken.",
    "Continue as {name}": "Doorgaan als {name}",
    "We couldn't restore your response": "We konden je reactie niet herstellen",
    "Check your connection and try again. You can also continue with a different participant name.":
      "Controleer je verbinding en probeer het opnieuw. Je kunt ook doorgaan met een andere deelnemersnaam.",
    "Try again": "Opnieuw proberen",
    "Choose a name": "Kies een naam",
    "This link is invalid, expired, or the organizer deleted the meeting. Ask the organizer for a fresh invitation.":
      "Deze link is ongeldig, verlopen, of de organisator heeft de afspraak verwijderd. Vraag de organisator om een nieuwe uitnodiging.",
    "Return to Synk": "Terug naar Synk",
    "Synk home": "Synk-startpagina",
    "Organizer access": "Organisatortoegang",
    "Enter a valid email address.": "Voer een geldig e-mailadres in.",
    "Enter your password.": "Voer je wachtwoord in.",
    "Use at least 8 characters.": "Gebruik ten minste 8 tekens.",
    "Use no more than 72 characters.": "Gebruik niet meer dan 72 tekens.",
    "Add a lowercase letter.": "Voeg een kleine letter toe.",
    "Add an uppercase letter.": "Voeg een hoofdletter toe.",
    "Add a number.": "Voeg een cijfer toe.",
    "Add a special character.": "Voeg een speciaal teken toe.",
    "Passwords do not match.": "Wachtwoorden komen niet overeen.",
    "Unable to connect to Synk. Is the API running?":
      "Kan geen verbinding maken met Synk. Draait de API?",
    "Hide password": "Wachtwoord verbergen",
    "Show password": "Wachtwoord tonen",
    "8+ strong characters": "8+ sterke tekens",
    "Your password": "Je wachtwoord",
    "Repeat your password": "Herhaal je wachtwoord",
    "Already organizing with Synk?": "Organiseer je al met Synk?",
    "New to Synk?": "Nieuw bij Synk?",
    "Checking your session…": "Je sessie wordt gecontroleerd…",
    "Meeting updated": "Afspraak bijgewerkt",
    "Meeting created": "Afspraak aangemaakt",
    "Your schedule and invitation details are up to date.":
      "Je schema en uitnodigingsgegevens zijn up-to-date.",
    "Your private invitation is ready to share.":
      "Je privé-uitnodiging is klaar om te delen.",
    "End date must be on or after the start date.":
      "De einddatum moet op of na de startdatum liggen.",
    "Working hours must end after they start.":
      "Werkuren moeten eindigen na hun start.",
    "Meeting duration cannot be longer than the daily scheduling window.":
      "De duur van de afspraak mag niet langer zijn dan het dagelijkse planningsvenster.",
    "Unable to reach Synk. Is the API running?":
      "Kan Synk niet bereiken. Draait de API?",
    "15 min": "15 min",
    "1 hour": "1 uur",
    "3 hours": "3 uur",
    "6 hours": "6 uur",
    "Drag the slider in 15-minute steps. Synk uses this exact duration for suggestions and finalization.":
      "Sleep de schuifregelaar in stappen van 15 minuten. Synk gebruikt deze exacte duur voor suggesties en afronding.",
    "Choose a start square, then an end square—just like booking a stay.":
      "Kies een startvak en dan een eindvak — net als bij het boeken van een verblijf.",
    "Now choose the last day": "Kies nu de laatste dag",
    "Choose the first day": "Kies de eerste dag",
    "Select two dates": "Selecteer twee data",
    "{duration} each selected day": "{duration} op elke geselecteerde dag",
    "The organizer needs to add at least one valid day and time slot before availability can be selected.":
      "De organisator moet ten minste één geldige dag en tijdslot toevoegen voordat beschikbaarheid kan worden geselecteerd.",
    "Your latest times and note are safely stored.":
      "Je laatste tijden en notitie zijn veilig opgeslagen.",
    "For example: I can join 15 minutes late on Wednesday.":
      "Bijvoorbeeld: ik kan woensdag 15 minuten later aansluiten.",
    "Your selections and note autosave after a short pause.":
      "Je selecties en notitie worden na een korte pauze automatisch opgeslagen.",
    "Choose a start square or drag across the grid. Synk highlights the full {duration} meeting.":
      "Kies een startvak of sleep over het raster. Synk markeert de volledige afspraak van {duration}.",
    "Hover or focus a square to see who is available.":
      "Beweeg over of focus op een vak om te zien wie beschikbaar is.",
    "The heatmap will fill as participants respond.":
      "De heatmap vult zich naarmate deelnemers reageren.",
    "Heatmap legend": "Heatmap-legenda",
    Perfect: "Perfect",
    Select: "Selecteren",
    Confirmed: "Bevestigd",
    "{title} now has a confirmed time.": "{title} heeft nu een bevestigde tijd.",
    Date: "Datum",
    Time: "Tijd",
    "The organizer is confirming the exact time.":
      "De organisator bevestigt de exacte tijd.",
    "Suggestions appear as soon as someone saves availability.":
      "Suggesties verschijnen zodra iemand beschikbaarheid opslaat.",
  },
  hi: {
    Language: "भाषा",
    "Log in": "लॉग इन",
    "Sign up": "साइन अप",
    "Find the time that works for everyone.":
      "वह समय खोजें जो सभी के लिए सही हो।",
    "Scheduling without the back-and-forth": "बिना बार-बार संदेश के शेड्यूलिंग",
    "Create an availability poll, share one secure link, and see the perfect overlap. Participants never need an account.":
      "उपलब्धता पोल बनाएँ, सुरक्षित लिंक साझा करें और सभी का सही समय देखें। प्रतिभागियों को खाते की आवश्यकता नहीं है।",
    "Create your first poll": "अपना पहला पोल बनाएँ",
    "Organizer login": "आयोजक लॉग इन",
    "Visual availability": "दृश्य उपलब्धता",
    "No participant accounts": "प्रतिभागी खाते नहीं",
    "Find time. Together.": "साथ मिलकर समय खोजें।",
    Dashboard: "डैशबोर्ड",
    "Your meetings": "आपकी मीटिंग",
    "Create meeting": "मीटिंग बनाएँ",
    Upcoming: "आगामी",
    Finalized: "तय",
    Past: "पिछली",
    "No meetings yet": "अभी कोई मीटिंग नहीं",
    "Load more meetings": "और लोड करें",
    "Back to meetings": "मीटिंग पर वापस",
    "Meeting title": "मीटिंग का शीर्षक",
    Description: "विवरण",
    optional: "वैकल्पिक",
    "Meeting duration": "मीटिंग की अवधि",
    Timezone: "समय क्षेत्र",
    Cancel: "रद्द करें",
    "Save changes": "बदलाव सहेजें",
    "Schedule window": "समय सीमा",
    "Pick the days and hours visually": "दिन और समय चुनें",
    "Date range": "तारीख सीमा",
    Start: "शुरू",
    End: "अंत",
    "Previous month": "पिछला महीना",
    "Next month": "अगला महीना",
    "Daily working hours": "दैनिक उपलब्ध समय",
    "Choose the first time quarter": "पहला 15 मिनट चुनें",
    "Choose the last time quarter": "अंतिम 15 मिनट चुनें",
    to: "से",
    "Select date": "तारीख चुनें",
    "Your availability": "आपकी उपलब्धता",
    "Responding as": "इस नाम से उत्तर",
    "Save now": "अभी सहेजें",
    "Optional note": "वैकल्पिक नोट",
    "Availability saved": "उपलब्धता सहेजी गई",
    "No schedule slots yet": "कोई समय स्लॉट नहीं",
    "Autosave ready": "ऑटोसेव तैयार",
    "Changes pending": "बदलाव बाकी",
    "Saving…": "सहेज रहे हैं…",
    Saved: "सहेजा गया",
    "Not saved": "नहीं सहेजा",
    "No heatmap data": "उपलब्धता डेटा नहीं",
    "No participants available": "कोई प्रतिभागी उपलब्ध नहीं",
    available: "उपलब्ध",
    "Top matches": "सबसे अच्छे समय",
    "Create your own": "अपना समय चुनें",
    Participants: "प्रतिभागी",
    Responses: "उत्तर",
    Schedule: "समय",
    "Copy invite": "निमंत्रण कॉपी करें",
    Copied: "कॉपी हुआ",
    "Lock responses": "उत्तर बंद करें",
    "Open responses": "उत्तर खोलें",
    "Delete meeting": "मीटिंग हटाएँ",
    "Remove participant": "प्रतिभागी हटाएँ",
    Edit: "संपादित करें",
    "Open Google Meet": "Google Meet खोलें",
    "Who’s responding?": "कौन उत्तर दे रहा है?",
    "Continue to availability": "उपलब्धता पर जाएँ",
    "Use this name": "यह नाम उपयोग करें",
    "Saved on this device": "इस डिवाइस पर सहेजा",
    "Responses are closed": "उत्तर बंद हैं",
    "Invitation not found": "निमंत्रण नहीं मिला",
    Email: "ईमेल",
    Password: "पासवर्ड",
    "Confirm password": "पासवर्ड की पुष्टि",
    "Create organizer account": "आयोजक खाता बनाएँ",
    "Quarter-hour slots": "15 मिनट के स्लॉट",
    "Each hour is split into four independently selectable quarters.":
      "हर घंटे को चार अलग-अलग चुने जा सकने वाले 15 मिनट के भागों में बाँटा गया है।",
    "Loading…": "लोड हो रहा है…",
    "Welcome back": "वापसी पर स्वागत है",
    "Use another name": "दूसरा नाम उपयोग करें",
    "Log out": "लॉग आउट",
    "Your availability could not be saved.": "आपकी उपलब्धता सहेजी नहीं जा सकी।",
    "No matches yet": "अभी तक कोई मिलान नहीं",
    "Synk hit an unexpected problem. Your saved data is safe; retry the page to continue.":
      "Synk में एक अप्रत्याशित समस्या आई। आपका सहेजा गया डेटा सुरक्षित है; जारी रखने के लिए पेज फिर से लोड करें।",
    "Something went wrong": "कुछ गलत हो गया",
    "Welcome back. Your meetings and responses are waiting.":
      "वापसी पर स्वागत है। आपकी मीटिंग्स और प्रतिक्रियाएँ प्रतीक्षा कर रही हैं।",
    "Log in to Synk": "Synk में लॉग इन करें",
    "Create polls, share one secure link, and find the overlap.":
      "पोल बनाएँ, एक सुरक्षित लिंक साझा करें, और साझा समय खोजें।",
    "Start organizing": "आयोजन शुरू करें",
    "Signed in as": "इस रूप में साइन इन",
    "Create a poll, share its private invitation link, and watch responses arrive.":
      "एक पोल बनाएँ, इसका निजी निमंत्रण लिंक साझा करें, और प्रतिक्रियाएँ आते हुए देखें।",
    "Check that the API and database are running, then try again.":
      "जाँचें कि API और डेटाबेस चल रहे हैं, फिर पुनः प्रयास करें।",
    "Could not load your meetings": "आपकी मीटिंग्स लोड नहीं हो सकीं",
    "Create your first meeting": "अपनी पहली मीटिंग बनाएँ",
    "Your first availability poll takes less than a minute to create.":
      "आपका पहला उपलब्धता पोल एक मिनट से भी कम समय में बन जाता है।",
    "Define the window, then share the secure link with your participants.":
      "समय सीमा तय करें, फिर प्रतिभागियों के साथ सुरक्षित लिंक साझा करें।",
    "Meeting deleted": "मीटिंग हटाई गई",
    "The invitation and all responses were removed.":
      "निमंत्रण और सभी प्रतिक्रियाएँ हटा दी गईं।",
    "Participant removed": "प्रतिभागी हटाया गया",
    "{name} and their availability were removed.":
      "{name} और उनकी उपलब्धता हटा दी गई।",
    "The participant and their availability were removed.":
      "प्रतिभागी और उनकी उपलब्धता हटा दी गई।",
    "Responses locked": "प्रतिक्रियाएँ लॉक की गईं",
    "Responses reopened": "प्रतिक्रियाएँ फिर से खोली गईं",
    "Participants can view the invitation but cannot edit responses.":
      "प्रतिभागी निमंत्रण देख सकते हैं लेकिन प्रतिक्रियाएँ संपादित नहीं कर सकते।",
    "Participants can edit their availability again.":
      "प्रतिभागी अपनी उपलब्धता फिर से संपादित कर सकते हैं।",
    "Meeting reopened": "मीटिंग फिर से खोली गई",
    "Finalization was removed and responses are open again.":
      "अंतिम निर्णय हटा दिया गया और प्रतिक्रियाएँ फिर से खुली हैं।",
    "Meeting scheduled": "मीटिंग निर्धारित की गई",
    "The confirmed time is now visible to every participant.":
      "पुष्टि किया गया समय अब सभी प्रतिभागियों को दिखाई देता है।",
    "It may have been deleted, or it belongs to another organizer.":
      "इसे हटाया जा चुका हो सकता है, या यह किसी अन्य आयोजक की है।",
    "Meeting not found": "मीटिंग नहीं मिली",
    "Invitation copied": "निमंत्रण कॉपी किया गया",
    "The private Synk link is ready to share.": "निजी Synk लिंक साझा करने के लिए तैयार है।",
    "Could not copy the link": "लिंक कॉपी नहीं हो सका",
    "Your browser blocked clipboard access. Copy it from the address bar instead.":
      "आपके ब्राउज़र ने क्लिपबोर्ड एक्सेस को अवरुद्ध कर दिया। इसके बजाय इसे एड्रेस बार से कॉपी करें।",
    "All meetings": "सभी मीटिंग्स",
    "Re-open meeting": "मीटिंग फिर से खोलें",
    "Delete this meeting?": "क्या इस मीटिंग को हटाना है?",
    "This permanently removes the invitation, participant names, comments, and every availability response. This cannot be undone.":
      "इससे निमंत्रण, प्रतिभागियों के नाम, टिप्पणियाँ और सभी उपलब्धता प्रतिक्रियाएँ स्थायी रूप से हट जाएँगी। इसे पूर्ववत नहीं किया जा सकता।",
    "Keep meeting": "मीटिंग रखें",
    "Delete permanently": "स्थायी रूप से हटाएँ",
    "Remove this participant?": "क्या इस प्रतिभागी को हटाना है?",
    "{name} and all of their availability will be permanently removed from this meeting.":
      "{name} और उनकी सभी उपलब्धता इस मीटिंग से स्थायी रूप से हटा दी जाएगी।",
    "This participant": "यह प्रतिभागी",
    "Choose your meeting time": "अपनी मीटिंग का समय चुनें",
    "Live availability heatmap": "लाइव उपलब्धता हीटमैप",
    "Edit meeting": "मीटिंग संपादित करें",
    "Meeting could not be loaded": "मीटिंग लोड नहीं हो सकी",
    "Re-open the meeting from its dashboard before changing the schedule.":
      "शेड्यूल बदलने से पहले डैशबोर्ड से मीटिंग को फिर से खोलें।",
    "This meeting is finalized": "यह मीटिंग अंतिम रूप से तय हो चुकी है",
    "Back to meeting": "मीटिंग पर वापस जाएँ",
    "Return to meeting": "मीटिंग पर लौटें",
    "Loading meeting form…": "मीटिंग फ़ॉर्म लोड हो रहा है…",
    "Synk invitation": "Synk निमंत्रण",
    "Restoring your response…": "आपकी प्रतिक्रिया बहाल की जा रही है…",
    "Choose a name saved on this device or enter a new one. Next, you'll select your available hours directly on the calendar.":
      "इस डिवाइस पर सहेजा गया नाम चुनें या नया नाम दर्ज करें। इसके बाद, आप सीधे कैलेंडर पर अपने उपलब्ध घंटे चुनेंगे।",
    "Saved response found": "सहेजी गई प्रतिक्रिया मिली",
    "Enter a new name": "नया नाम दर्ज करें",
    "Display name": "प्रदर्शन नाम",
    "Your name will be remembered only on this device.":
      "आपका नाम केवल इस डिवाइस पर याद रखा जाएगा।",
    "Choose a saved name instead": "इसके बजाय सहेजा गया नाम चुनें",
    "Choose or enter a name between 2 and 30 characters.":
      "2 से 30 अक्षरों के बीच का नाम चुनें या दर्ज करें।",
    "Select the times that work for you; changes autosave.":
      "आपके लिए उपयुक्त समय चुनें; बदलाव अपने आप सहेजे जाते हैं।",
    "Open my saved availability": "मेरी सहेजी गई उपलब्धता खोलें",
    "Continue as {name}?": "क्या {name} के रूप में जारी रखें?",
    "We found your response on this device. Continue to review or update your availability.":
      "हमें इस डिवाइस पर आपकी प्रतिक्रिया मिली। अपनी उपलब्धता की समीक्षा या अपडेट करने के लिए जारी रखें।",
    "Continue as {name}": "{name} के रूप में जारी रखें",
    "We couldn't restore your response": "हम आपकी प्रतिक्रिया बहाल नहीं कर सके",
    "Check your connection and try again. You can also continue with a different participant name.":
      "अपना कनेक्शन जाँचें और पुनः प्रयास करें। आप किसी अन्य प्रतिभागी नाम से भी जारी रख सकते हैं।",
    "Try again": "पुनः प्रयास करें",
    "Choose a name": "एक नाम चुनें",
    "This link is invalid, expired, or the organizer deleted the meeting. Ask the organizer for a fresh invitation.":
      "यह लिंक अमान्य है, समाप्त हो चुका है, या आयोजक ने मीटिंग हटा दी है। आयोजक से नया निमंत्रण माँगें।",
    "Return to Synk": "Synk पर वापस जाएँ",
    "Synk home": "Synk होम",
    "Organizer access": "आयोजक पहुँच",
    "Enter a valid email address.": "एक मान्य ईमेल पता दर्ज करें।",
    "Enter your password.": "अपना पासवर्ड दर्ज करें।",
    "Use at least 8 characters.": "कम से कम 8 अक्षरों का उपयोग करें।",
    "Use no more than 72 characters.": "72 से अधिक अक्षरों का उपयोग न करें।",
    "Add a lowercase letter.": "एक छोटा अक्षर जोड़ें।",
    "Add an uppercase letter.": "एक बड़ा अक्षर जोड़ें।",
    "Add a number.": "एक अंक जोड़ें।",
    "Add a special character.": "एक विशेष वर्ण जोड़ें।",
    "Passwords do not match.": "पासवर्ड मेल नहीं खाते।",
    "Unable to connect to Synk. Is the API running?":
      "Synk से कनेक्ट नहीं हो सका। क्या API चल रहा है?",
    "Hide password": "पासवर्ड छिपाएँ",
    "Show password": "पासवर्ड दिखाएँ",
    "8+ strong characters": "8+ मज़बूत अक्षर",
    "Your password": "आपका पासवर्ड",
    "Repeat your password": "अपना पासवर्ड दोबारा दर्ज करें",
    "Already organizing with Synk?": "क्या आप पहले से Synk के साथ आयोजन कर रहे हैं?",
    "New to Synk?": "Synk में नए हैं?",
    "Checking your session…": "आपका सत्र जाँचा जा रहा है…",
    "Meeting updated": "मीटिंग अपडेट की गई",
    "Meeting created": "मीटिंग बनाई गई",
    "Your schedule and invitation details are up to date.":
      "आपका शेड्यूल और निमंत्रण विवरण अद्यतित हैं।",
    "Your private invitation is ready to share.": "आपका निजी निमंत्रण साझा करने के लिए तैयार है।",
    "End date must be on or after the start date.":
      "समाप्ति तिथि प्रारंभ तिथि पर या उसके बाद होनी चाहिए।",
    "Working hours must end after they start.":
      "कार्य समय शुरू होने के बाद ही समाप्त होना चाहिए।",
    "Meeting duration cannot be longer than the daily scheduling window.":
      "मीटिंग की अवधि दैनिक शेड्यूलिंग समय सीमा से अधिक नहीं हो सकती।",
    "Unable to reach Synk. Is the API running?":
      "Synk तक नहीं पहुँचा जा सका। क्या API चल रहा है?",
    "15 min": "15 मिनट",
    "1 hour": "1 घंटा",
    "3 hours": "3 घंटे",
    "6 hours": "6 घंटे",
    "Drag the slider in 15-minute steps. Synk uses this exact duration for suggestions and finalization.":
      "स्लाइडर को 15 मिनट के चरणों में खींचें। Synk सुझावों और अंतिम निर्णय के लिए इसी सटीक अवधि का उपयोग करता है।",
    "Choose a start square, then an end square—just like booking a stay.":
      "एक शुरुआती वर्ग चुनें, फिर एक अंतिम वर्ग—ठीक वैसे ही जैसे ठहरने की बुकिंग करते समय।",
    "Now choose the last day": "अब अंतिम दिन चुनें",
    "Choose the first day": "पहला दिन चुनें",
    "Select two dates": "दो तारीखें चुनें",
    "{duration} each selected day": "चुने गए प्रत्येक दिन {duration}",
    "The organizer needs to add at least one valid day and time slot before availability can be selected.":
      "उपलब्धता चुने जाने से पहले आयोजक को कम से कम एक मान्य दिन और समय स्लॉट जोड़ना होगा।",
    "Your latest times and note are safely stored.":
      "आपके नवीनतम समय और नोट सुरक्षित रूप से संग्रहीत हैं।",
    "For example: I can join 15 minutes late on Wednesday.":
      "उदाहरण: मैं बुधवार को 15 मिनट देर से शामिल हो सकता/सकती हूँ।",
    "Your selections and note autosave after a short pause.":
      "आपके चयन और नोट थोड़ी देर रुकने के बाद अपने आप सहेज लिए जाते हैं।",
    "Choose a start square or drag across the grid. Synk highlights the full {duration} meeting.":
      "एक शुरुआती वर्ग चुनें या ग्रिड पर खींचें। Synk पूरी {duration} की मीटिंग को हाइलाइट करता है।",
    "Hover or focus a square to see who is available.":
      "यह देखने के लिए कि कौन उपलब्ध है, किसी वर्ग पर होवर करें या फ़ोकस करें।",
    "The heatmap will fill as participants respond.":
      "जैसे-जैसे प्रतिभागी प्रतिक्रिया देंगे, हीटमैप भरता जाएगा।",
    "Heatmap legend": "हीटमैप लीजेंड",
    Perfect: "उत्तम",
    Select: "चुनें",
    Confirmed: "पुष्टि की गई",
    "{title} now has a confirmed time.": "{title} का समय अब पुष्टि हो चुका है।",
    Date: "तारीख़",
    Time: "समय",
    "The organizer is confirming the exact time.": "आयोजक सटीक समय की पुष्टि कर रहे हैं।",
    "Suggestions appear as soon as someone saves availability.":
      "जैसे ही कोई अपनी उपलब्धता सहेजता है, सुझाव दिखने लगते हैं।",
  },
};
