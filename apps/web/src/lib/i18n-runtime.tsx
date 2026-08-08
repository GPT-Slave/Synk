"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  I18nProvider as CatalogProvider,
  localeNames as catalogLocaleNames,
  supportedLocales as catalogSupportedLocales,
  useI18n as useCatalogI18n,
  type SynkLocale as CatalogLocale,
} from "./i18n";

export const supportedLocales = [...catalogSupportedLocales, "it"] as const;
export type SynkLocale = (typeof supportedLocales)[number];

export const localeNames: Record<SynkLocale, string> = {
  ...catalogLocaleNames,
  it: "Italiano",
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
  it: "it",
};

const STORAGE_KEY = "synk:language";
type Variables = Record<string, string | number>;
type TranslationTable = Record<string, string>;

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
  formatDuration: (minutes: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <CatalogProvider>
      <I18nRuntime>{children}</I18nRuntime>
    </CatalogProvider>
  );
}

function I18nRuntime({ children }: { children: React.ReactNode }) {
  const catalog = useCatalogI18n();
  const [locale, setLocaleState] = useState<SynkLocale>("en");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const initial = readInitialLocale();
      setLocaleState(initial);
      if (initial !== "it") catalog.setLocale(initial as CatalogLocale);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [catalog]);

  useEffect(() => {
    document.documentElement.lang = intlLocales[locale];
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback(
    (next: SynkLocale) => {
      setLocaleState(next);
      if (next !== "it") catalog.setLocale(next as CatalogLocale);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Language selection still works when storage is unavailable.
      }
    },
    [catalog],
  );

  const t = useCallback(
    (message: string, variables?: Variables) => {
      const supplemental = supplementalTranslations[locale]?.[message];
      if (supplemental) return interpolate(supplemental, variables);
      if (locale === "it") {
        return interpolate(italianTranslations[message] ?? message, variables);
      }
      return catalog.t(message, variables);
    },
    [catalog, locale],
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
      formatDuration: (minutes) => formatDuration(minutes, intlLocales[locale]),
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

function formatDuration(totalMinutes: number, locale: string) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours) {
    parts.push(
      new Intl.NumberFormat(locale, {
        style: "unit",
        unit: "hour",
        unitDisplay: "long",
      }).format(hours),
    );
  }
  if (minutes || !hours) {
    parts.push(
      new Intl.NumberFormat(locale, {
        style: "unit",
        unit: "minute",
        unitDisplay: "long",
      }).format(minutes),
    );
  }
  return new Intl.ListFormat(locale, { style: "short", type: "unit" }).format(
    parts,
  );
}

const supplementalTranslations: Partial<Record<SynkLocale, TranslationTable>> = {
  fr: {
    "You (organizer)": "Vous (organisateur)",
    "Tap one square or paint across several. The complete timetable is always shown below.":
      "Touchez une case ou faites glisser sur plusieurs. Le planning complet reste toujours affiché ci-dessous.",
    "Times are fixed to {timezone} (meeting timezone) · {minutes}-minute slots":
      "Les horaires sont fixés sur {timezone} (fuseau de la réunion) · créneaux de {minutes} minutes",
    "The heatmap will appear when this meeting has valid schedule slots.":
      "La carte de disponibilité apparaîtra lorsque cette réunion aura des créneaux valides.",
    "{available} of {total} available": "{available} sur {total} disponibles",
    "Select {time}": "Sélectionner {time}",
    "Select {date} at {time}": "Sélectionner {date} à {time}",
    "Remove {date} at {time}": "Retirer {date} à {time}",
    "{date} at {time}: {available} of {total} available{names}":
      "{date} à {time} : {available} sur {total} disponibles{names}",
    "That action did not complete.": "Cette action n’a pas abouti.",
    "Refresh suggestions": "Actualiser les suggestions",
    "availability calendar": "calendrier des disponibilités",
    "availability heatmap": "carte de disponibilité",
    "Switch to light mode": "Passer au mode clair",
    "Switch to dark mode": "Passer au mode sombre",
  },
  ar: {
    "You (organizer)": "أنت (المنظّم)",
    "Tap one square or paint across several. The complete timetable is always shown below.":
      "اضغط على خانة واحدة أو اسحب عبر عدة خانات. يظهر الجدول الكامل دائمًا أدناه.",
    "Times are fixed to {timezone} (meeting timezone) · {minutes}-minute slots":
      "الأوقات مضبوطة على {timezone} (المنطقة الزمنية للاجتماع) · فترات من {minutes} دقيقة",
    "The heatmap will appear when this meeting has valid schedule slots.":
      "ستظهر خريطة التوافر عندما يتضمن الاجتماع فترات زمنية صالحة.",
    "{available} of {total} available": "{available} من {total} متاحون",
    "Select {time}": "اختر {time}",
    "Select {date} at {time}": "اختر {date} عند {time}",
    "Remove {date} at {time}": "أزل {date} عند {time}",
    "{date} at {time}: {available} of {total} available{names}":
      "{date} عند {time}: {available} من {total} متاحون{names}",
    "That action did not complete.": "لم تكتمل هذه العملية.",
    "Refresh suggestions": "تحديث الاقتراحات",
    "availability calendar": "تقويم التوافر",
    "availability heatmap": "خريطة التوافر",
    "Switch to light mode": "التبديل إلى الوضع الفاتح",
    "Switch to dark mode": "التبديل إلى الوضع الداكن",
  },
  ja: {
    "You (organizer)": "あなた（主催者）",
    "Tap one square or paint across several. The complete timetable is always shown below.":
      "1つのマスをタップするか、複数のマスをなぞって選択できます。完全な時間表は常に下に表示されます。",
    "Times are fixed to {timezone} (meeting timezone) · {minutes}-minute slots":
      "時刻は {timezone}（会議のタイムゾーン）に固定 · {minutes}分単位",
    "The heatmap will appear when this meeting has valid schedule slots.":
      "有効な時間枠が設定されるとヒートマップが表示されます。",
    "{available} of {total} available": "{total}人中{available}人が参加可能",
    "Select {time}": "{time}を選択",
    "Select {date} at {time}": "{date} {time}を選択",
    "Remove {date} at {time}": "{date} {time}を解除",
    "{date} at {time}: {available} of {total} available{names}":
      "{date} {time}: {total}人中{available}人が参加可能{names}",
    "That action did not complete.": "操作を完了できませんでした。",
    "Refresh suggestions": "候補を更新",
    "availability calendar": "空き時間カレンダー",
    "availability heatmap": "空き時間ヒートマップ",
    "Switch to light mode": "ライトモードに切り替え",
    "Switch to dark mode": "ダークモードに切り替え",
  },
  zh: {
    "You (organizer)": "你（组织者）",
    "Tap one square or paint across several. The complete timetable is always shown below.":
      "点击一个方格或拖过多个方格进行选择。完整时间表始终显示在下方。",
    "Times are fixed to {timezone} (meeting timezone) · {minutes}-minute slots":
      "时间固定为 {timezone}（会议时区）· {minutes} 分钟时段",
    "The heatmap will appear when this meeting has valid schedule slots.":
      "会议设置有效时段后将显示可用性热图。",
    "{available} of {total} available": "{total} 人中 {available} 人有空",
    "Select {time}": "选择 {time}",
    "Select {date} at {time}": "选择 {date} {time}",
    "Remove {date} at {time}": "取消 {date} {time}",
    "{date} at {time}: {available} of {total} available{names}":
      "{date} {time}：{total} 人中 {available} 人有空{names}",
    "That action did not complete.": "该操作未完成。",
    "Refresh suggestions": "刷新建议",
    "availability calendar": "可用性日历",
    "availability heatmap": "可用性热图",
    "Switch to light mode": "切换到浅色模式",
    "Switch to dark mode": "切换到深色模式",
  },
  es: {
    "You (organizer)": "Tú (organizador)",
    "Tap one square or paint across several. The complete timetable is always shown below.":
      "Toca una casilla o arrastra por varias. El horario completo siempre se muestra abajo.",
    "Times are fixed to {timezone} (meeting timezone) · {minutes}-minute slots":
      "Las horas están fijadas en {timezone} (zona horaria de la reunión) · intervalos de {minutes} minutos",
    "The heatmap will appear when this meeting has valid schedule slots.":
      "El mapa de disponibilidad aparecerá cuando la reunión tenga intervalos válidos.",
    "{available} of {total} available": "{available} de {total} disponibles",
    "Select {time}": "Seleccionar {time}",
    "Select {date} at {time}": "Seleccionar {date} a las {time}",
    "Remove {date} at {time}": "Quitar {date} a las {time}",
    "{date} at {time}: {available} of {total} available{names}":
      "{date} a las {time}: {available} de {total} disponibles{names}",
    "That action did not complete.": "Esa acción no se completó.",
    "Refresh suggestions": "Actualizar sugerencias",
    "availability calendar": "calendario de disponibilidad",
    "availability heatmap": "mapa de disponibilidad",
    "Switch to light mode": "Cambiar al modo claro",
    "Switch to dark mode": "Cambiar al modo oscuro",
  },
  pt: {
    "You (organizer)": "Você (organizador)",
    "Tap one square or paint across several. The complete timetable is always shown below.":
      "Toque em um quadrado ou arraste por vários. O horário completo permanece visível abaixo.",
    "Times are fixed to {timezone} (meeting timezone) · {minutes}-minute slots":
      "Os horários seguem {timezone} (fuso da reunião) · blocos de {minutes} minutos",
    "The heatmap will appear when this meeting has valid schedule slots.":
      "O mapa de disponibilidade aparecerá quando a reunião tiver horários válidos.",
    "{available} of {total} available": "{available} de {total} disponíveis",
    "Select {time}": "Selecionar {time}",
    "Select {date} at {time}": "Selecionar {date} às {time}",
    "Remove {date} at {time}": "Remover {date} às {time}",
    "{date} at {time}: {available} of {total} available{names}":
      "{date} às {time}: {available} de {total} disponíveis{names}",
    "That action did not complete.": "Essa ação não foi concluída.",
    "Refresh suggestions": "Atualizar sugestões",
    "availability calendar": "calendário de disponibilidade",
    "availability heatmap": "mapa de disponibilidade",
    "Switch to light mode": "Mudar para o modo claro",
    "Switch to dark mode": "Mudar para o modo escuro",
  },
  ru: {
    "You (organizer)": "Вы (организатор)",
    "Tap one square or paint across several. The complete timetable is always shown below.":
      "Нажмите одну ячейку или проведите по нескольким. Полное расписание всегда показано ниже.",
    "Times are fixed to {timezone} (meeting timezone) · {minutes}-minute slots":
      "Время указано в {timezone} (часовой пояс встречи) · интервалы по {minutes} мин.",
    "The heatmap will appear when this meeting has valid schedule slots.":
      "Карта доступности появится, когда у встречи будут допустимые временные интервалы.",
    "{available} of {total} available": "доступны {available} из {total}",
    "Select {time}": "Выбрать {time}",
    "Select {date} at {time}": "Выбрать {date} в {time}",
    "Remove {date} at {time}": "Убрать {date} в {time}",
    "{date} at {time}: {available} of {total} available{names}":
      "{date} в {time}: доступны {available} из {total}{names}",
    "That action did not complete.": "Не удалось выполнить действие.",
    "Refresh suggestions": "Обновить варианты",
    "availability calendar": "календарь доступности",
    "availability heatmap": "карта доступности",
    "Switch to light mode": "Переключить на светлую тему",
    "Switch to dark mode": "Переключить на тёмную тему",
  },
  de: {
    "You (organizer)": "Du (Organisator)",
    "Tap one square or paint across several. The complete timetable is always shown below.":
      "Tippe auf ein Feld oder ziehe über mehrere. Der vollständige Zeitplan bleibt unten sichtbar.",
    "Times are fixed to {timezone} (meeting timezone) · {minutes}-minute slots":
      "Zeiten sind auf {timezone} (Zeitzone des Meetings) festgelegt · {minutes}-Minuten-Zeitfenster",
    "The heatmap will appear when this meeting has valid schedule slots.":
      "Die Verfügbarkeitskarte erscheint, sobald das Meeting gültige Zeitfenster hat.",
    "{available} of {total} available": "{available} von {total} verfügbar",
    "Select {time}": "{time} auswählen",
    "Select {date} at {time}": "{date} um {time} auswählen",
    "Remove {date} at {time}": "{date} um {time} entfernen",
    "{date} at {time}: {available} of {total} available{names}":
      "{date} um {time}: {available} von {total} verfügbar{names}",
    "That action did not complete.": "Die Aktion wurde nicht abgeschlossen.",
    "Refresh suggestions": "Vorschläge aktualisieren",
    "availability calendar": "Verfügbarkeitskalender",
    "availability heatmap": "Verfügbarkeitskarte",
    "Switch to light mode": "Zum hellen Modus wechseln",
    "Switch to dark mode": "Zum dunklen Modus wechseln",
  },
  nl: {
    "You (organizer)": "Jij (organisator)",
    "Tap one square or paint across several. The complete timetable is always shown below.":
      "Tik op één vak of veeg over meerdere. Het volledige rooster blijft hieronder zichtbaar.",
    "Times are fixed to {timezone} (meeting timezone) · {minutes}-minute slots":
      "Tijden staan vast op {timezone} (tijdzone van de vergadering) · vakken van {minutes} minuten",
    "The heatmap will appear when this meeting has valid schedule slots.":
      "De beschikbaarheidskaart verschijnt zodra deze vergadering geldige tijdvakken heeft.",
    "{available} of {total} available": "{available} van {total} beschikbaar",
    "Select {time}": "{time} selecteren",
    "Select {date} at {time}": "{date} om {time} selecteren",
    "Remove {date} at {time}": "{date} om {time} verwijderen",
    "{date} at {time}: {available} of {total} available{names}":
      "{date} om {time}: {available} van {total} beschikbaar{names}",
    "That action did not complete.": "Die actie is niet voltooid.",
    "Refresh suggestions": "Suggesties vernieuwen",
    "availability calendar": "beschikbaarheidskalender",
    "availability heatmap": "beschikbaarheidskaart",
    "Switch to light mode": "Naar lichte modus schakelen",
    "Switch to dark mode": "Naar donkere modus schakelen",
  },
  hi: {
    "You (organizer)": "आप (आयोजक)",
    "Tap one square or paint across several. The complete timetable is always shown below.":
      "एक खाने पर टैप करें या कई खानों पर खींचें। पूरा समय-सारणी हमेशा नीचे दिखाई देता है।",
    "Times are fixed to {timezone} (meeting timezone) · {minutes}-minute slots":
      "समय {timezone} (मीटिंग समय क्षेत्र) पर तय हैं · {minutes}-मिनट स्लॉट",
    "The heatmap will appear when this meeting has valid schedule slots.":
      "इस मीटिंग में मान्य समय स्लॉट होने पर उपलब्धता मानचित्र दिखाई देगा।",
    "{available} of {total} available": "{total} में से {available} उपलब्ध",
    "Select {time}": "{time} चुनें",
    "Select {date} at {time}": "{date} को {time} पर चुनें",
    "Remove {date} at {time}": "{date} को {time} पर हटाएँ",
    "{date} at {time}: {available} of {total} available{names}":
      "{date} को {time} पर: {total} में से {available} उपलब्ध{names}",
    "That action did not complete.": "वह कार्रवाई पूरी नहीं हुई।",
    "Refresh suggestions": "सुझाव रीफ़्रेश करें",
    "availability calendar": "उपलब्धता कैलेंडर",
    "availability heatmap": "उपलब्धता मानचित्र",
    "Switch to light mode": "लाइट मोड पर जाएँ",
    "Switch to dark mode": "डार्क मोड पर जाएँ",
  },
};

const italianTranslations: TranslationTable = {
  Language: "Lingua",
  "Log in": "Accedi",
  "Sign up": "Registrati",
  "Find the time that works for everyone.": "Trova l’orario che va bene per tutti.",
  "Scheduling without the back-and-forth": "Organizza senza continui messaggi avanti e indietro",
  "Create an availability poll, share one secure link, and see the perfect overlap. Participants never need an account.":
    "Crea un sondaggio di disponibilità, condividi un unico link sicuro e trova la sovrapposizione perfetta. I partecipanti non hanno bisogno di un account.",
  "Create your first poll": "Crea il tuo primo sondaggio",
  "Organizer login": "Accesso organizzatore",
  "Visual availability": "Disponibilità visiva",
  "No participant accounts": "Nessun account per i partecipanti",
  "Find time. Together.": "Troviamo il momento giusto. Insieme.",
  Dashboard: "Dashboard",
  "Your meetings": "Le tue riunioni",
  "Create meeting": "Crea riunione",
  Upcoming: "In programma",
  Finalized: "Finalizzate",
  Past: "Passate",
  "No meetings yet": "Nessuna riunione",
  "Load more meetings": "Carica altre riunioni",
  "Back to meetings": "Torna alle riunioni",
  "Meeting title": "Titolo della riunione",
  Description: "Descrizione",
  optional: "facoltativo",
  "Meeting duration": "Durata della riunione",
  Timezone: "Fuso orario",
  Cancel: "Annulla",
  "Save changes": "Salva modifiche",
  "Schedule window": "Finestra di pianificazione",
  "Pick the days and hours visually": "Scegli visivamente giorni e orari",
  "Date range": "Intervallo di date",
  Start: "Inizio",
  End: "Fine",
  "Previous month": "Mese precedente",
  "Next month": "Mese successivo",
  "Daily working hours": "Orari giornalieri",
  "Choose the first time quarter": "Scegli il primo quarto d’ora",
  "Choose the last time quarter": "Scegli l’ultimo quarto d’ora",
  to: "a",
  "Select date": "Seleziona data",
  "Your availability": "La tua disponibilità",
  "Responding as": "Rispondi come",
  "Save now": "Salva ora",
  "Optional note": "Nota facoltativa",
  "Availability saved": "Disponibilità salvata",
  "No schedule slots yet": "Nessuna fascia oraria",
  "Autosave ready": "Salvataggio automatico pronto",
  "Changes pending": "Modifiche in sospeso",
  "Saving…": "Salvataggio…",
  Saved: "Salvato",
  "Not saved": "Non salvato",
  "No heatmap data": "Nessun dato di disponibilità",
  "No participants available": "Nessun partecipante disponibile",
  available: "disponibili",
  "Top matches": "Migliori opzioni",
  "Create your own": "Scegli manualmente",
  Participants: "Partecipanti",
  Responses: "Risposte",
  Schedule: "Orario",
  "Copy invite": "Copia invito",
  Copied: "Copiato",
  "Lock responses": "Blocca risposte",
  "Open responses": "Riapri risposte",
  "Delete meeting": "Elimina riunione",
  "Remove participant": "Rimuovi partecipante",
  Edit: "Modifica",
  "Open Google Meet": "Apri Google Meet",
  "Who’s responding?": "Chi sta rispondendo?",
  "Continue to availability": "Continua alle disponibilità",
  "Use this name": "Usa questo nome",
  "Saved on this device": "Salvato su questo dispositivo",
  "Responses are closed": "Le risposte sono chiuse",
  "Invitation not found": "Invito non trovato",
  Email: "E-mail",
  Password: "Password",
  "Confirm password": "Conferma password",
  "Create organizer account": "Crea account organizzatore",
  "Quarter-hour slots": "Fasce da 15 minuti",
  "Each hour is split into four independently selectable quarters.":
    "Ogni ora è divisa in quattro quarti selezionabili indipendentemente.",
  "Loading…": "Caricamento…",
  "Welcome back": "Bentornato",
  "Use another name": "Usa un altro nome",
  "Log out": "Esci",
  "Your availability could not be saved.": "Non è stato possibile salvare la tua disponibilità.",
  "No matches yet": "Nessuna corrispondenza",
  "Synk hit an unexpected problem. Your saved data is safe; retry the page to continue.":
    "Synk ha riscontrato un problema imprevisto. I dati salvati sono al sicuro; riprova la pagina per continuare.",
  "Something went wrong": "Si è verificato un problema",
  "Welcome back. Your meetings and responses are waiting.":
    "Bentornato. Le tue riunioni e le risposte ti aspettano.",
  "Log in to Synk": "Accedi a Synk",
  "Create polls, share one secure link, and find the overlap.":
    "Crea sondaggi, condividi un unico link sicuro e trova la sovrapposizione.",
  "Start organizing": "Inizia a organizzare",
  "Signed in as": "Accesso effettuato come",
  "Create a poll, share its private invitation link, and watch responses arrive.":
    "Crea un sondaggio, condividi il link privato di invito e guarda arrivare le risposte.",
  "Check that the API and database are running, then try again.":
    "Verifica che API e database siano in esecuzione, quindi riprova.",
  "Could not load your meetings": "Impossibile caricare le tue riunioni",
  "Create your first meeting": "Crea la tua prima riunione",
  "Your first availability poll takes less than a minute to create.":
    "Il tuo primo sondaggio di disponibilità richiede meno di un minuto.",
  "Define the window, then share the secure link with your participants.":
    "Definisci l’intervallo, poi condividi il link sicuro con i partecipanti.",
  "Meeting deleted": "Riunione eliminata",
  "The invitation and all responses were removed.": "L’invito e tutte le risposte sono stati rimossi.",
  "Participant removed": "Partecipante rimosso",
  "{name} and their availability were removed.": "{name} e le relative disponibilità sono stati rimossi.",
  "The participant and their availability were removed.":
    "Il partecipante e le relative disponibilità sono stati rimossi.",
  "Responses locked": "Risposte bloccate",
  "Responses reopened": "Risposte riaperte",
  "Participants can view the invitation but cannot edit responses.":
    "I partecipanti possono vedere l’invito ma non modificare le risposte.",
  "Participants can edit their availability again.":
    "I partecipanti possono modificare nuovamente la propria disponibilità.",
  "Meeting reopened": "Riunione riaperta",
  "Finalization was removed and responses are open again.":
    "La finalizzazione è stata annullata e le risposte sono di nuovo aperte.",
  "Meeting scheduled": "Riunione programmata",
  "The confirmed time is now visible to every participant.":
    "L’orario confermato è ora visibile a tutti i partecipanti.",
  "It may have been deleted, or it belongs to another organizer.":
    "Potrebbe essere stata eliminata oppure appartenere a un altro organizzatore.",
  "Meeting not found": "Riunione non trovata",
  "Invitation copied": "Invito copiato",
  "The private Synk link is ready to share.": "Il link privato Synk è pronto per essere condiviso.",
  "Could not copy the link": "Impossibile copiare il link",
  "Your browser blocked clipboard access. Copy it from the address bar instead.":
    "Il browser ha bloccato l’accesso agli appunti. Copialo invece dalla barra degli indirizzi.",
  "All meetings": "Tutte le riunioni",
  "Re-open meeting": "Riapri riunione",
  "Delete this meeting?": "Eliminare questa riunione?",
  "This permanently removes the invitation, participant names, comments, and every availability response. This cannot be undone.":
    "Questa operazione elimina definitivamente l’invito, i nomi dei partecipanti, i commenti e tutte le risposte di disponibilità. Non può essere annullata.",
  "Keep meeting": "Mantieni riunione",
  "Delete permanently": "Elimina definitivamente",
  "Remove this participant?": "Rimuovere questo partecipante?",
  "{name} and all of their availability will be permanently removed from this meeting.":
    "{name} e tutte le relative disponibilità saranno rimossi definitivamente da questa riunione.",
  "This participant": "Questo partecipante",
  "Choose your meeting time": "Scegli l’orario della riunione",
  "Live availability heatmap": "Mappa di disponibilità in tempo reale",
  "Edit meeting": "Modifica riunione",
  "Meeting could not be loaded": "Impossibile caricare la riunione",
  "Re-open the meeting from its dashboard before changing the schedule.":
    "Riapri la riunione dalla dashboard prima di modificare la pianificazione.",
  "This meeting is finalized": "Questa riunione è finalizzata",
  "Back to meeting": "Torna alla riunione",
  "Return to meeting": "Ritorna alla riunione",
  "Loading meeting form…": "Caricamento del modulo riunione…",
  "Synk invitation": "Invito Synk",
  "Restoring your response…": "Ripristino della risposta…",
  "Choose a name saved on this device or enter a new one. Next, you'll select your available hours directly on the calendar.":
    "Scegli un nome salvato su questo dispositivo o inseriscine uno nuovo. Poi selezionerai direttamente sul calendario gli orari in cui sei disponibile.",
  "Saved response found": "Risposta salvata trovata",
  "Enter a new name": "Inserisci un nuovo nome",
  "Display name": "Nome visualizzato",
  "Your name will be remembered only on this device.": "Il tuo nome verrà ricordato solo su questo dispositivo.",
  "Choose a saved name instead": "Scegli invece un nome salvato",
  "Choose or enter a name between 2 and 30 characters.": "Scegli o inserisci un nome tra 2 e 30 caratteri.",
  "Select the times that work for you; changes autosave.":
    "Seleziona gli orari che vanno bene per te; le modifiche vengono salvate automaticamente.",
  "Open my saved availability": "Apri la mia disponibilità salvata",
  "Continue as {name}?": "Continuare come {name}?",
  "We found your response on this device. Continue to review or update your availability.":
    "Abbiamo trovato la tua risposta su questo dispositivo. Continua per controllare o aggiornare la disponibilità.",
  "Continue as {name}": "Continua come {name}",
  "We couldn't restore your response": "Non è stato possibile ripristinare la tua risposta",
  "Check your connection and try again. You can also continue with a different participant name.":
    "Controlla la connessione e riprova. Puoi anche continuare con un nome partecipante diverso.",
  "Try again": "Riprova",
  "Choose a name": "Scegli un nome",
  "This link is invalid, expired, or the organizer deleted the meeting. Ask the organizer for a fresh invitation.":
    "Questo link non è valido, è scaduto oppure l’organizzatore ha eliminato la riunione. Chiedi all’organizzatore un nuovo invito.",
  "Return to Synk": "Torna a Synk",
  "Synk home": "Home di Synk",
  "Organizer access": "Accesso organizzatore",
  "Enter a valid email address.": "Inserisci un indirizzo e-mail valido.",
  "Enter your password.": "Inserisci la password.",
  "Use at least 8 characters.": "Usa almeno 8 caratteri.",
  "Use no more than 72 characters.": "Usa al massimo 72 caratteri.",
  "Add a lowercase letter.": "Aggiungi una lettera minuscola.",
  "Add an uppercase letter.": "Aggiungi una lettera maiuscola.",
  "Add a number.": "Aggiungi un numero.",
  "Add a special character.": "Aggiungi un carattere speciale.",
  "Passwords do not match.": "Le password non corrispondono.",
  "Unable to connect to Synk. Is the API running?": "Impossibile connettersi a Synk. L’API è in esecuzione?",
  "Hide password": "Nascondi password",
  "Show password": "Mostra password",
  "8+ strong characters": "Almeno 8 caratteri sicuri",
  "Your password": "La tua password",
  "Repeat your password": "Ripeti la password",
  "Already organizing with Synk?": "Organizzi già con Synk?",
  "New to Synk?": "Nuovo su Synk?",
  "Checking your session…": "Controllo della sessione…",
  "Meeting updated": "Riunione aggiornata",
  "Meeting created": "Riunione creata",
  "Your schedule and invitation details are up to date.":
    "La pianificazione e i dettagli dell’invito sono aggiornati.",
  "Your private invitation is ready to share.": "Il tuo invito privato è pronto per essere condiviso.",
  "End date must be on or after the start date.": "La data di fine deve essere uguale o successiva alla data di inizio.",
  "Working hours must end after they start.": "L’orario di lavoro deve terminare dopo l’inizio.",
  "Meeting duration cannot be longer than the daily scheduling window.":
    "La durata della riunione non può superare la finestra di pianificazione giornaliera.",
  "Unable to reach Synk. Is the API running?": "Impossibile raggiungere Synk. L’API è in esecuzione?",
  "15 min": "15 min",
  "1 hour": "1 ora",
  "3 hours": "3 ore",
  "6 hours": "6 ore",
  "Drag the slider in 15-minute steps. Synk uses this exact duration for suggestions and finalization.":
    "Trascina il cursore a intervalli di 15 minuti. Synk usa esattamente questa durata per i suggerimenti e la finalizzazione.",
  "Choose a start square, then an end square—just like booking a stay.":
    "Scegli una casella iniziale e poi una finale, proprio come quando prenoti un soggiorno.",
  "Now choose the last day": "Ora scegli l’ultimo giorno",
  "Choose the first day": "Scegli il primo giorno",
  "Select two dates": "Seleziona due date",
  "{duration} each selected day": "{duration} per ogni giorno selezionato",
  "The organizer needs to add at least one valid day and time slot before availability can be selected.":
    "L’organizzatore deve aggiungere almeno un giorno e una fascia oraria validi prima di poter selezionare la disponibilità.",
  "Your latest times and note are safely stored.": "I tuoi ultimi orari e la nota sono stati salvati in sicurezza.",
  "For example: I can join 15 minutes late on Wednesday.": "Ad esempio: mercoledì posso collegarmi con 15 minuti di ritardo.",
  "Your selections and note autosave after a short pause.":
    "Le selezioni e la nota vengono salvate automaticamente dopo una breve pausa.",
  "Choose a start square or drag across the grid. Synk highlights the full {duration} meeting.":
    "Scegli una casella iniziale o trascina sulla griglia. Synk evidenzia l’intera riunione di {duration}.",
  "Hover or focus a square to see who is available.": "Passa il mouse o porta il focus su una casella per vedere chi è disponibile.",
  "The heatmap will fill as participants respond.": "La mappa si riempirà man mano che i partecipanti rispondono.",
  "Heatmap legend": "Legenda della mappa di disponibilità",
  Perfect: "Perfetto",
  Select: "Seleziona",
  Confirmed: "Confermata",
  "{title} now has a confirmed time.": "{title} ora ha un orario confermato.",
  Date: "Data",
  Time: "Ora",
  "The organizer is confirming the exact time.": "L’organizzatore sta confermando l’orario esatto.",
  "Suggestions appear as soon as someone saves availability.":
    "I suggerimenti compaiono non appena qualcuno salva la propria disponibilità.",
  "You (organizer)": "Tu (organizzatore)",
  "Tap one square or paint across several. The complete timetable is always shown below.":
    "Tocca una casella o trascina su più caselle. L’orario completo resta sempre visibile qui sotto.",
  "Times are fixed to {timezone} (meeting timezone) · {minutes}-minute slots":
    "Gli orari sono fissati su {timezone} (fuso orario della riunione) · fasce da {minutes} minuti",
  "The heatmap will appear when this meeting has valid schedule slots.":
    "La mappa di disponibilità apparirà quando la riunione avrà fasce orarie valide.",
  "{available} of {total} available": "{available} su {total} disponibili",
  "Select {time}": "Seleziona {time}",
  "Select {date} at {time}": "Seleziona {date} alle {time}",
  "Remove {date} at {time}": "Rimuovi {date} alle {time}",
  "{date} at {time}: {available} of {total} available{names}":
    "{date} alle {time}: {available} su {total} disponibili{names}",
  "That action did not complete.": "L’azione non è stata completata.",
  "Refresh suggestions": "Aggiorna suggerimenti",
  "availability calendar": "calendario delle disponibilità",
  "availability heatmap": "mappa di disponibilità",
  "Switch to light mode": "Passa alla modalità chiara",
  "Switch to dark mode": "Passa alla modalità scura",
};
