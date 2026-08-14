import type { SynkLocale } from "./i18n-runtime";

type TranslationTable = Record<string, string>;

export const uiTranslations: Partial<Record<SynkLocale, TranslationTable>> = {
  fr: {
    "Close dialog": "Fermer la boîte de dialogue",
    "Loading Synk…": "Chargement de Synk…",
    "Dismiss notification": "Fermer la notification",
    "Click or sweep across the tiles to mark your availability.":
      "Cliquez ou balayez les cases pour indiquer vos disponibilités.",
  },
  ar: {
    "Close dialog": "إغلاق مربع الحوار",
    "Loading Synk…": "جارٍ تحميل Synk…",
    "Dismiss notification": "إغلاق الإشعار",
    "Click or sweep across the tiles to mark your availability.":
      "انقر أو مرّر عبر الخانات لتحديد أوقات توافرك.",
  },
  ja: {
    "Close dialog": "ダイアログを閉じる",
    "Loading Synk…": "Synkを読み込み中…",
    "Dismiss notification": "通知を閉じる",
    "Click or sweep across the tiles to mark your availability.":
      "タイルをクリックするか、なぞって空いている時間を選択してください。",
  },
  zh: {
    "Close dialog": "关闭对话框",
    "Loading Synk…": "正在加载 Synk…",
    "Dismiss notification": "关闭通知",
    "Click or sweep across the tiles to mark your availability.":
      "点击或滑过时间格来标记你的可用时间。",
  },
  es: {
    "Close dialog": "Cerrar diálogo",
    "Loading Synk…": "Cargando Synk…",
    "Dismiss notification": "Cerrar notificación",
    "Click or sweep across the tiles to mark your availability.":
      "Haz clic o desliza por las casillas para marcar tu disponibilidad.",
  },
  pt: {
    "Close dialog": "Fechar diálogo",
    "Loading Synk…": "Carregando Synk…",
    "Dismiss notification": "Fechar notificação",
    "Click or sweep across the tiles to mark your availability.":
      "Clique ou deslize pelas células para marcar sua disponibilidade.",
  },
  ru: {
    "Close dialog": "Закрыть диалог",
    "Loading Synk…": "Загрузка Synk…",
    "Dismiss notification": "Закрыть уведомление",
    "Click or sweep across the tiles to mark your availability.":
      "Нажимайте или проводите по ячейкам, чтобы отметить свободное время.",
  },
  de: {
    "Close dialog": "Dialog schließen",
    "Loading Synk…": "Synk wird geladen…",
    "Dismiss notification": "Benachrichtigung schließen",
    "Click or sweep across the tiles to mark your availability.":
      "Klicke oder streiche über die Felder, um deine Verfügbarkeit zu markieren.",
  },
  nl: {
    "Close dialog": "Dialoog sluiten",
    "Loading Synk…": "Synk laden…",
    "Dismiss notification": "Melding sluiten",
    "Click or sweep across the tiles to mark your availability.":
      "Klik of veeg over de vakken om je beschikbaarheid aan te geven.",
  },
  hi: {
    "Close dialog": "संवाद बंद करें",
    "Loading Synk…": "Synk लोड हो रहा है…",
    "Dismiss notification": "सूचना बंद करें",
    "Click or sweep across the tiles to mark your availability.":
      "अपनी उपलब्धता चुनने के लिए टाइलों पर क्लिक करें या स्वाइप करें।",
  },
  it: {
    "Close dialog": "Chiudi finestra di dialogo",
    "Loading Synk…": "Caricamento di Synk…",
    "Dismiss notification": "Chiudi notifica",
    "Click or sweep across the tiles to mark your availability.":
      "Fai clic o scorri sulle caselle per indicare la tua disponibilità.",
  },
};