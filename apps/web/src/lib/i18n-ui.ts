import type { SynkLocale } from "./i18n-runtime";

type TranslationTable = Record<string, string>;

export const uiTranslations: Partial<Record<SynkLocale, TranslationTable>> = {
  fr: {
    "Close dialog": "Fermer la boîte de dialogue",
    "Loading Synk…": "Chargement de Synk…",
    "Dismiss notification": "Fermer la notification",
  },
  ar: {
    "Close dialog": "إغلاق مربع الحوار",
    "Loading Synk…": "جارٍ تحميل Synk…",
    "Dismiss notification": "إغلاق الإشعار",
  },
  ja: {
    "Close dialog": "ダイアログを閉じる",
    "Loading Synk…": "Synkを読み込み中…",
    "Dismiss notification": "通知を閉じる",
  },
  zh: {
    "Close dialog": "关闭对话框",
    "Loading Synk…": "正在加载 Synk…",
    "Dismiss notification": "关闭通知",
  },
  es: {
    "Close dialog": "Cerrar diálogo",
    "Loading Synk…": "Cargando Synk…",
    "Dismiss notification": "Cerrar notificación",
  },
  pt: {
    "Close dialog": "Fechar diálogo",
    "Loading Synk…": "Carregando Synk…",
    "Dismiss notification": "Fechar notificação",
  },
  ru: {
    "Close dialog": "Закрыть диалог",
    "Loading Synk…": "Загрузка Synk…",
    "Dismiss notification": "Закрыть уведомление",
  },
  de: {
    "Close dialog": "Dialog schließen",
    "Loading Synk…": "Synk wird geladen…",
    "Dismiss notification": "Benachrichtigung schließen",
  },
  nl: {
    "Close dialog": "Dialoog sluiten",
    "Loading Synk…": "Synk laden…",
    "Dismiss notification": "Melding sluiten",
  },
  hi: {
    "Close dialog": "संवाद बंद करें",
    "Loading Synk…": "Synk लोड हो रहा है…",
    "Dismiss notification": "सूचना बंद करें",
  },
  it: {
    "Close dialog": "Chiudi finestra di dialogo",
    "Loading Synk…": "Caricamento di Synk…",
    "Dismiss notification": "Chiudi notifica",
  },
};
