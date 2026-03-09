"use client";

import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { FaEnvelope, FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { FiMenu } from "react-icons/fi";
import { SiSubstack } from "react-icons/si";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";

type TimeFormat = "12h" | "24h";
type ViewMode = "week" | "day";
type WeekStartsOn = 0 | 1;
type ThemeName = "pink" | "beige" | "yellow" | "green" | "blue" | "purple" | "black";

type PlannerSettings = {
  timeFormat: TimeFormat;
  interval: number;
  startTime: string;
  endTime: string;
  weekStartsOn: WeekStartsOn;
  theme: ThemeName;
};

type PlanBlock = {
  id: string;
  dateKey: string;
  task: string;
  start: string;
  end: string;
  done: boolean;
};

type SlotBlock = PlanBlock & {
  startSlot: number;
  endSlot: number;
};

type CloudPlannerData = {
  settings: PlannerSettings;
  blocks: PlanBlock[];
  viewMode: ViewMode;
  focusByDate: Record<string, string>;
  queueTasks: QueueTask[];
};

type QueueTask = {
  id: string;
  task: string;
  span: number;
};

type EditingCell = {
  day: number;
  slot: number;
};

type ResizeSession = {
  blockId: string;
  initialSpan: number;
  maxSpan: number;
  initialPointerY: number;
  rowHeight: number;
};

type UndoSnapshot = {
  blocks: PlanBlock[];
  queueTasks: QueueTask[];
};

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const INTERVAL_OPTIONS = [5, 10, 15, 20, 30, 60];
const THEME_OPTIONS: ThemeName[] = ["pink", "yellow", "green", "blue", "purple", "black"];
const THEME_LABELS: Record<ThemeName, string> = {
  pink: "cherry",
  beige: "peach",
  yellow: "sunshine (default)",
  green: "forest",
  blue: "ocean",
  purple: "lavender",
  black: "obsidian",
};
const THEME_CLASSES: Record<ThemeName, { page: string; panel: string; soft: string }> = {
  pink: { page: "bg-[#fbf0f5]", panel: "bg-[#fff8fb]", soft: "bg-pink-50" },
  beige: { page: "bg-[#f8ede5]", panel: "bg-[#fff7f1]", soft: "bg-[#f7e5d8]" },
  yellow: { page: "bg-[#fbf8e8]", panel: "bg-[#fffdf2]", soft: "bg-amber-50" },
  green: { page: "bg-[#eef7ef]", panel: "bg-[#f8fdf8]", soft: "bg-emerald-50" },
  blue: { page: "bg-[#edf4fb]", panel: "bg-[#f7fbff]", soft: "bg-sky-50" },
  purple: { page: "bg-[#f3effb]", panel: "bg-[#faf7ff]", soft: "bg-violet-50" },
  black: { page: "bg-zinc-900", panel: "bg-zinc-800", soft: "bg-zinc-700" },
};
const THEME_TONES: Record<
  ThemeName,
  {
    border: string;
    borderSoft: string;
    softHeader: string;
    textMuted: string;
    textSubtle: string;
    textStrong: string;
    baseSurface: string;
    rowHighlight: string;
    cellHighlight: string;
    doneBg: string;
    accentBtn: string;
  }
> = {
  beige: {
    border: "border-orange-300",
    borderSoft: "border-orange-200",
    softHeader: "bg-orange-100",
    textMuted: "text-orange-800",
    textSubtle: "text-orange-600",
    textStrong: "text-orange-900",
    baseSurface: "bg-white",
    rowHighlight: "bg-orange-100/70",
    cellHighlight: "bg-orange-50/70",
    doneBg: "bg-orange-200/70",
    accentBtn: "bg-orange-700 text-orange-50",
  },
  pink: {
    border: "border-rose-300",
    borderSoft: "border-rose-200",
    softHeader: "bg-rose-100",
    textMuted: "text-rose-700",
    textSubtle: "text-rose-500",
    textStrong: "text-rose-900",
    baseSurface: "bg-rose-50/40",
    rowHighlight: "bg-rose-100/70",
    cellHighlight: "bg-rose-50/70",
    doneBg: "bg-rose-200/70",
    accentBtn: "bg-rose-700 text-rose-50",
  },
  yellow: {
    border: "border-amber-300",
    borderSoft: "border-amber-200",
    softHeader: "bg-amber-100",
    textMuted: "text-amber-800",
    textSubtle: "text-amber-600",
    textStrong: "text-amber-900",
    baseSurface: "bg-amber-50/40",
    rowHighlight: "bg-amber-100/70",
    cellHighlight: "bg-amber-50/80",
    doneBg: "bg-amber-200/70",
    accentBtn: "bg-amber-700 text-amber-50",
  },
  green: {
    border: "border-emerald-300",
    borderSoft: "border-emerald-200",
    softHeader: "bg-emerald-100",
    textMuted: "text-emerald-700",
    textSubtle: "text-emerald-500",
    textStrong: "text-emerald-900",
    baseSurface: "bg-emerald-50/40",
    rowHighlight: "bg-emerald-100/70",
    cellHighlight: "bg-emerald-50/80",
    doneBg: "bg-emerald-200/70",
    accentBtn: "bg-emerald-700 text-emerald-50",
  },
  blue: {
    border: "border-sky-300",
    borderSoft: "border-sky-200",
    softHeader: "bg-sky-100",
    textMuted: "text-sky-700",
    textSubtle: "text-sky-500",
    textStrong: "text-sky-900",
    baseSurface: "bg-sky-50/40",
    rowHighlight: "bg-sky-100/70",
    cellHighlight: "bg-sky-50/80",
    doneBg: "bg-sky-200/70",
    accentBtn: "bg-sky-700 text-sky-50",
  },
  purple: {
    border: "border-violet-300",
    borderSoft: "border-violet-200",
    softHeader: "bg-violet-100",
    textMuted: "text-violet-700",
    textSubtle: "text-violet-500",
    textStrong: "text-violet-900",
    baseSurface: "bg-violet-50/40",
    rowHighlight: "bg-violet-100/70",
    cellHighlight: "bg-violet-50/80",
    doneBg: "bg-violet-200/70",
    accentBtn: "bg-violet-700 text-violet-50",
  },
  black: {
    border: "border-zinc-600",
    borderSoft: "border-zinc-700",
    softHeader: "bg-zinc-700",
    textMuted: "text-zinc-100",
    textSubtle: "text-zinc-400",
    textStrong: "text-zinc-100",
    baseSurface: "bg-zinc-800/70",
    rowHighlight: "bg-zinc-700/70",
    cellHighlight: "bg-zinc-700/60",
    doneBg: "bg-zinc-700/80",
    accentBtn: "bg-zinc-100 text-zinc-900",
  },
};
const WELCOME_TITLE = "welcome to minutely";

const DEFAULT_SETTINGS: PlannerSettings = {
  timeFormat: "12h",
  interval: 15,
  startTime: "06:00",
  endTime: "23:00",
  weekStartsOn: 0,
  theme: "yellow",
};

const SETTINGS_KEY = "minimal-planner-settings";
const BLOCKS_KEY = "minimal-planner-blocks";
const VIEW_KEY = "minimal-planner-view";
const FOCUS_KEY = "minimal-planner-focus";
const QUEUE_KEY = "minimal-planner-queue";
const MOBILE_DENSITY_KEY = "minimal-planner-mobile-density";
const FIRST_TASK_HINT_KEY = "minutely-first-task-hint-shown";
const MAX_UNDO_STEPS = 50;
const CLOUD_TABLE = "planner_profiles";
const QUOTES = [
  "small wins stack up.",
  "you are building momentum.",
  "one block at a time.",
  "progress is the point.",
  "you showed up. that matters.",
];
const CLOUD_REDIRECT_URL = "https://minutelyplanner.vercel.app";

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesTo24h(total: number): string {
  const h = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatMinutes(total: number, format: TimeFormat): string {
  const dayMinutes = 24 * 60;
  const normalizedTotal = ((total % dayMinutes) + dayMinutes) % dayMinutes;
  const hours24 = Math.floor(normalizedTotal / 60);
  const mins = (normalizedTotal % 60).toString().padStart(2, "0");
  if (format === "24h") return `${hours24.toString().padStart(2, "0")}:${mins}`;
  const period = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${mins} ${period}`;
}

function getPlannerWindow(settings: PlannerSettings) {
  const startMin = toMinutes(settings.startTime);
  let endMin = toMinutes(settings.endTime);
  if (endMin <= startMin) endMin += 24 * 60;
  return {
    startMin,
    endMin,
    wrapsOvernight: endMin > 24 * 60,
  };
}

function coerceSettings(raw: string): PlannerSettings {
  const parsed = JSON.parse(raw) as Partial<PlannerSettings>;
  const rawTheme = parsed.theme as ThemeName | undefined;
  const theme: ThemeName =
    rawTheme === "beige"
      ? "yellow"
      : THEME_OPTIONS.includes(rawTheme as ThemeName)
        ? (rawTheme as ThemeName)
        : "yellow";
  return {
    timeFormat: parsed.timeFormat === "24h" ? "24h" : "12h",
    interval: INTERVAL_OPTIONS.includes(Number(parsed.interval)) ? Number(parsed.interval) : DEFAULT_SETTINGS.interval,
    startTime: typeof parsed.startTime === "string" ? parsed.startTime : DEFAULT_SETTINGS.startTime,
    endTime: typeof parsed.endTime === "string" ? parsed.endTime : DEFAULT_SETTINGS.endTime,
    weekStartsOn: parsed.weekStartsOn === 1 ? 1 : 0,
    theme,
  };
}

function readStoredSettings(): PlannerSettings | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return null;
  return coerceSettings(raw);
}

function readStoredBlocks(): PlanBlock[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(BLOCKS_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Array<PlanBlock & { day?: number }>;
  const now = new Date();

  return parsed.map((block) => {
    if (block.dateKey) {
      return block;
    }
    const fallback = new Date(now);
    if (typeof block.day === "number") {
      const delta = block.day - now.getDay();
      fallback.setDate(now.getDate() + delta);
    }
    return {
      ...block,
      dateKey: dateToKey(fallback),
    };
  });
}

function readStoredView(): ViewMode {
  if (typeof window === "undefined") return "week";
  const raw = localStorage.getItem(VIEW_KEY);
  if (raw === "day" || raw === "week") return raw;
  return window.matchMedia("(max-width: 640px)").matches ? "day" : "week";
}

function readStoredFocus(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(FOCUS_KEY);
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, string>;
}

function readStoredQueue(): QueueTask[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  return sanitizeQueueTasks(JSON.parse(raw) as QueueTask[]);
}

function sanitizeQueueTasks(parsed: QueueTask[]): QueueTask[] {
  return parsed
    .filter((item) => typeof item?.task === "string" && item.task.trim().length > 0)
    .map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      task: item.task.trim(),
      span: Math.max(1, Number(item.span) || 1),
    }));
}

function readMobileDensity(): "comfy" | "dense" {
  if (typeof window === "undefined") return "comfy";
  const raw = localStorage.getItem(MOBILE_DENSITY_KEY);
  return raw === "dense" ? "dense" : "comfy";
}

function normalizeBlocks(blocks: PlanBlock[], settings: PlannerSettings): SlotBlock[] {
  const { startMin, endMin, wrapsOvernight } = getPlannerWindow(settings);

  return blocks
    .map((block) => {
      let blockStart = toMinutes(block.start);
      let blockEnd = toMinutes(block.end);
      if (blockEnd <= blockStart) blockEnd += 24 * 60;
      if (wrapsOvernight && blockStart < startMin) {
        blockStart += 24 * 60;
        blockEnd += 24 * 60;
      }
      const snappedStart = Math.max(blockStart, startMin);
      const snappedEnd = Math.min(blockEnd, endMin);
      if (snappedEnd <= snappedStart) return null;
      const startSlot = Math.floor((snappedStart - startMin) / settings.interval);
      const endSlot = Math.max(startSlot + 1, Math.ceil((snappedEnd - startMin) / settings.interval));
      return { ...block, startSlot, endSlot };
    })
    .filter((block): block is SlotBlock => block !== null);
}

function formatDayDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase();
}

function dateToKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function keyToDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function Home() {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const initialSettings = readStoredSettings();

  const [settings, setSettings] = useState<PlannerSettings | null>(initialSettings);
  const [blocks, setBlocks] = useState<PlanBlock[]>(readStoredBlocks);
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredView);
  const [focusByDate, setFocusByDate] = useState<Record<string, string>>(readStoredFocus);
  const [queueTasks, setQueueTasks] = useState<QueueTask[]>(readStoredQueue);
  const [now, setNow] = useState(() => new Date());
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [periodInputDate, setPeriodInputDate] = useState(() => dateToKey(new Date()));
  const [isPeriodEditing, setIsPeriodEditing] = useState(false);
  const [readyToPlan, setReadyToPlan] = useState(false);

  const [setupTimeFormat, setSetupTimeFormat] = useState<TimeFormat>(initialSettings?.timeFormat ?? DEFAULT_SETTINGS.timeFormat);
  const [setupInterval, setSetupInterval] = useState(String(initialSettings?.interval ?? DEFAULT_SETTINGS.interval));
  const [setupStartTime, setSetupStartTime] = useState(initialSettings?.startTime ?? DEFAULT_SETTINGS.startTime);
  const [setupEndTime, setSetupEndTime] = useState(initialSettings?.endTime ?? DEFAULT_SETTINGS.endTime);
  const [setupWeekStart, setSetupWeekStart] = useState<WeekStartsOn>(initialSettings?.weekStartsOn ?? DEFAULT_SETTINGS.weekStartsOn);
  const [setupTheme, setSetupTheme] = useState<ThemeName>(initialSettings?.theme ?? DEFAULT_SETTINGS.theme);
  const [setupValidationMessage, setSetupValidationMessage] = useState("");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editingFocusDay, setEditingFocusDay] = useState<number | null>(null);
  const [inlineTask, setInlineTask] = useState("");
  const [inlineSpan, setInlineSpan] = useState("1");
  const [inlineEditingTaskId, setInlineEditingTaskId] = useState<string | null>(null);
  const [inlineEditingTaskName, setInlineEditingTaskName] = useState("");
  const [resizePreview, setResizePreview] = useState<{ blockId: string; span: number } | null>(null);
  const resizePreviewRef = useRef<{ blockId: string; span: number } | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [draggingQueueTaskId, setDraggingQueueTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<EditingCell | null>(null);
  const [queueDraft, setQueueDraft] = useState("");
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [repeatMenu, setRepeatMenu] = useState<{ blockId: string; x: number; y: number } | null>(null);
  const [celebrationQuote, setCelebrationQuote] = useState<string | null>(null);
  const [daySummary, setDaySummary] = useState<{ day: number; lines: string[] } | null>(null);
  const [weekSummary, setWeekSummary] = useState<{ lines: string[] } | null>(null);
  const [showWelcomeLetter, setShowWelcomeLetter] = useState(false);
  const [showFirstTaskLetter, setShowFirstTaskLetter] = useState(false);
  const [welcomeTyped, setWelcomeTyped] = useState("");
  const [setupTyped, setSetupTyped] = useState("");
  const [plannerTyped, setPlannerTyped] = useState("");
  const quoteTimeoutRef = useRef<number | null>(null);
  const quoteIndexRef = useRef(0);
  const plannerSectionRef = useRef<HTMLElement | null>(null);
  const plannerTableRef = useRef<HTMLTableElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const firstSaveToastShownRef = useRef(false);
  const savedToastTimeoutRef = useRef<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const undoStackRef = useRef<UndoSnapshot[]>([]);
  const firstTaskLetterShownRef = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("");
  const [isElectronShell, setIsElectronShell] = useState(false);
  const [mobileDensity, setMobileDensity] = useState<"comfy" | "dense">(readMobileDensity);
  const [isSyncEmailOpen, setIsSyncEmailOpen] = useState(false);
  const [syncEmail, setSyncEmail] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsElectronShell(navigator.userAgent.toLowerCase().includes("electron"));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches) {
      setViewMode("day");
    }
  }, []);

  useEffect(() => {
    if (settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (settings) setLastSavedAt(new Date());
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(blocks));
    setLastSavedAt(new Date());
  }, [blocks]);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, viewMode);
    setLastSavedAt(new Date());
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(FOCUS_KEY, JSON.stringify(focusByDate));
    setLastSavedAt(new Date());
  }, [focusByDate]);

  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queueTasks));
    setLastSavedAt(new Date());
  }, [queueTasks]);

  useEffect(() => {
    localStorage.setItem(MOBILE_DENSITY_KEY, mobileDensity);
  }, [mobileDensity]);

  useEffect(
    () => () => {
      if (quoteTimeoutRef.current) window.clearTimeout(quoteTimeoutRef.current);
      if (savedToastTimeoutRef.current) window.clearTimeout(savedToastTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    firstTaskLetterShownRef.current = localStorage.getItem(FIRST_TASK_HINT_KEY) === "1";
  }, []);

  useEffect(() => {
    if (!repeatMenu) return;
    const closeMenu = () => setRepeatMenu(null);
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [repeatMenu]);

  useEffect(() => {
    if (!showWelcomeLetter) {
      return;
    }
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setWelcomeTyped(WELCOME_TITLE.slice(0, i));
      if (i >= WELCOME_TITLE.length) {
        window.clearInterval(timer);
      }
    }, 55);
    return () => window.clearInterval(timer);
  }, [showWelcomeLetter]);

  useEffect(() => {
    const onSetupScreen = hydrated && (!settings || !readyToPlan);
    if (!onSetupScreen) return;
    setSetupTyped("");
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setSetupTyped("minutely".slice(0, i));
      if (i >= "minutely".length) window.clearInterval(timer);
    }, 70);
    return () => window.clearInterval(timer);
  }, [hydrated, settings, readyToPlan]);

  useEffect(() => {
    const onPlanner = hydrated && Boolean(settings) && readyToPlan && !showWelcomeLetter;
    if (!onPlanner) return;
    setPlannerTyped("");
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setPlannerTyped("minutely".slice(0, i));
      if (i >= "minutely".length) window.clearInterval(timer);
    }, 55);
    return () => window.clearInterval(timer);
  }, [hydrated, settings, readyToPlan, showWelcomeLetter]);

  useEffect(() => {
    setPeriodInputDate(dateToKey(cursorDate));
  }, [cursorDate]);

  useEffect(() => {
    if (!readyToPlan || firstSaveToastShownRef.current) return;
    firstSaveToastShownRef.current = true;
    setShowSavedToast(true);
    if (savedToastTimeoutRef.current) window.clearTimeout(savedToastTimeoutRef.current);
    savedToastTimeoutRef.current = window.setTimeout(() => setShowSavedToast(false), 1400);
  }, [readyToPlan]);

  useEffect(() => {
    const sb = supabase;
    if (!hasSupabaseEnv || !sb) {
      setCloudReady(true);
      return;
    }
    let mounted = true;
    sb.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setCloudReady(true);
    });
    const { data } = sb.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const applyCloudData = useCallback((data: CloudPlannerData) => {
    setSettings(data.settings);
    setSetupTimeFormat(data.settings.timeFormat);
    setSetupInterval(String(data.settings.interval));
    setSetupStartTime(data.settings.startTime);
    setSetupEndTime(data.settings.endTime);
    setSetupWeekStart(data.settings.weekStartsOn);
    setSetupTheme(data.settings.theme);
    setBlocks(data.blocks);
    setViewMode(data.viewMode);
    setFocusByDate(data.focusByDate);
    setQueueTasks((prev) => {
      if (!Array.isArray(data.queueTasks)) return prev;
      return sanitizeQueueTasks(data.queueTasks);
    });
    setReadyToPlan(true);
  }, []);

  useEffect(() => {
    const sb = supabase;
    if (!cloudReady) return;
    if (!hasSupabaseEnv || !sb || !session?.user) {
      setCloudLoaded(true);
      return;
    }

    let cancelled = false;
    setCloudLoaded(false);
    const loadCloud = async () => {
      setCloudStatus("syncing...");
      const { data, error } = await sb.from(CLOUD_TABLE).select("data").eq("user_id", session.user.id).maybeSingle();
      if (cancelled) return;
      if (error) {
        setCloudStatus("sync error");
        setCloudLoaded(true);
        return;
      }
      const cloudData = data?.data as CloudPlannerData | undefined;
      if (cloudData?.settings) {
        applyCloudData(cloudData);
        setCloudStatus("synced");
      } else {
        setCloudStatus("new cloud account");
      }
      setCloudLoaded(true);
    };

    loadCloud();
    return () => {
      cancelled = true;
    };
  }, [cloudReady, session, applyCloudData]);

  const cloudPayload = useMemo<CloudPlannerData | null>(() => {
    if (!settings) return null;
    return {
      settings,
      blocks,
      viewMode,
      focusByDate,
      queueTasks,
    };
  }, [settings, blocks, viewMode, focusByDate, queueTasks]);

  useEffect(() => {
    const sb = supabase;
    if (!cloudLoaded || !session?.user || !cloudPayload || !sb) return;
    const timer = window.setTimeout(async () => {
      const { error } = await sb.from(CLOUD_TABLE).upsert(
        {
          user_id: session.user.id,
          data: cloudPayload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      setCloudStatus(error ? "sync error" : "synced");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [cloudLoaded, session, cloudPayload]);

  const submitSyncSignIn = async () => {
    if (!supabase) return;
    try {
      const email = syncEmail.trim();
      if (!email) return;
      const primaryRedirect =
        typeof window !== "undefined" && window.location.origin.startsWith("http")
          ? window.location.origin
          : CLOUD_REDIRECT_URL;

      let { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: primaryRedirect },
      });

      if (error && primaryRedirect !== CLOUD_REDIRECT_URL) {
        const retry = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: CLOUD_REDIRECT_URL },
        });
        error = retry.error;
      }

      if (error) {
        setCloudStatus(`sign-in failed: ${error.message}`);
        return;
      }
      setCloudStatus("check your email for sign-in link");
      setIsSyncEmailOpen(false);
      setSyncEmail("");
    } catch (error) {
      setCloudStatus(`sign-in failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  };

  const signInToSync = () => {
    setIsSyncEmailOpen(true);
  };

  const signOutFromSync = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setCloudStatus("signed out");
  };

  const activeDay = cursorDate.getDay();
  const plannerWindow = useMemo(() => {
    if (!settings) return { startMin: 0, endMin: 0, wrapsOvernight: false };
    return getPlannerWindow(settings);
  }, [settings]);
  const slotLabels = useMemo(() => {
    if (!settings) return [];
    const { startMin, endMin } = plannerWindow;
    const labels: { start24: string; end24: string; label: string }[] = [];

    for (let t = startMin; t < endMin; t += settings.interval) {
      const next = Math.min(t + settings.interval, endMin);
      labels.push({
        start24: minutesTo24h(t),
        end24: minutesTo24h(next),
        label: `${formatMinutes(t, settings.timeFormat)} - ${formatMinutes(next, settings.timeFormat)}`,
      });
    }

    return labels;
  }, [settings, plannerWindow]);

  const normalized = useMemo(() => {
    if (!settings) return [];
    return normalizeBlocks(blocks, settings);
  }, [blocks, settings]);

  const blocksByDate = useMemo(() => {
    const grouped = new Map<string, SlotBlock[]>();
    normalized.forEach((block) => {
      const list = grouped.get(block.dateKey) ?? [];
      list.push(block);
      grouped.set(block.dateKey, list);
    });

    grouped.forEach((list, key) => {
      grouped.set(
        key,
        list.sort((a, b) => {
          if (a.startSlot === b.startSlot) return a.endSlot - b.endSlot;
          return a.startSlot - b.startSlot;
        }),
      );
    });

    return grouped;
  }, [normalized]);

  const dayOrder = useMemo(() => {
    if (!settings || settings.weekStartsOn === 0) return [0, 1, 2, 3, 4, 5, 6];
    return [1, 2, 3, 4, 5, 6, 0];
  }, [settings]);

  const startOfDisplayedWeek = useMemo(() => {
    if (!settings) return new Date();
    const d = new Date(cursorDate);
    const offset = (d.getDay() - settings.weekStartsOn + 7) % 7;
    d.setDate(d.getDate() - offset);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [cursorDate, settings]);

  const dayDates = useMemo(() => {
    const map = new Map<number, Date>();
    dayOrder.forEach((dayIndex, idx) => {
      const date = new Date(startOfDisplayedWeek);
      date.setDate(startOfDisplayedWeek.getDate() + idx);
      map.set(dayIndex, date);
    });
    return map;
  }, [dayOrder, startOfDisplayedWeek]);

  const visibleDays = useMemo(() => (viewMode === "week" ? dayOrder : [activeDay]), [viewMode, dayOrder, activeDay]);

  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const visibleDateKeys = visibleDays.map((dayIndex) => {
    const d = dayDates.get(dayIndex) ?? now;
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  });
  const isCurrentWindow = visibleDateKeys.includes(todayKey);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const adjustedCurrentMinutes = plannerWindow.wrapsOvernight && currentMinutes < plannerWindow.startMin ? currentMinutes + 24 * 60 : currentMinutes;

  const currentPeriodLabel =
    viewMode === "week"
      ? `${formatDayDate(startOfDisplayedWeek)} - ${formatDayDate(new Date(startOfDisplayedWeek.getFullYear(), startOfDisplayedWeek.getMonth(), startOfDisplayedWeek.getDate() + 6))}`
      : formatDayDate(cursorDate);

  const currentSlotIndex = useMemo(() => {
    return slotLabels.findIndex((slot) => {
      const slotStartMin = toMinutes(slot.start24);
      const slotEndMin = toMinutes(slot.end24);
      return adjustedCurrentMinutes >= slotStartMin && adjustedCurrentMinutes < slotEndMin;
    });
  }, [slotLabels, adjustedCurrentMinutes]);

  const currentSlotLabel = currentSlotIndex >= 0 ? slotLabels[currentSlotIndex]?.label ?? "outside planning hours" : "outside planning hours";
  const visibleBlockCount = useMemo(() => {
    return visibleDays.reduce((count, dayIndex) => {
      const dayDate = dayDates.get(dayIndex) ?? now;
      const dayKey = dateToKey(dayDate);
      return count + ((blocksByDate.get(dayKey) ?? []).length ?? 0);
    }, 0);
  }, [visibleDays, dayDates, now, blocksByDate]);

  const getCellForSlot = (day: number, slotIndex: number) => {
    const dayDate = dayDates.get(day) ?? cursorDate;
    const dayKey = dateToKey(dayDate);
    const dayBlocks = blocksByDate.get(dayKey) ?? [];
    for (const block of dayBlocks) {
      if (block.startSlot === slotIndex) return { type: "start" as const, block, span: Math.max(1, block.endSlot - block.startSlot) };
      if (slotIndex > block.startSlot && slotIndex < block.endSlot) return { type: "covered" as const };
    }
    return { type: "empty" as const };
  };

  const getMaxFreeSlots = (day: number, slotIndex: number) => {
    const dayDate = dayDates.get(day) ?? cursorDate;
    const dayKey = dateToKey(dayDate);
    const dayBlocks = blocksByDate.get(dayKey) ?? [];
    const nextOccupied = dayBlocks.find((block) => block.startSlot > slotIndex);
    const totalSlots = slotLabels.length;
    if (!nextOccupied) return totalSlots - slotIndex;
    return Math.max(1, nextOccupied.startSlot - slotIndex);
  };

  const getMaxFreeSlotsForMove = (day: number, slotIndex: number, ignoreBlockId: string) => {
    const dayDate = dayDates.get(day) ?? cursorDate;
    const dayKey = dateToKey(dayDate);
    const dayBlocks = (blocksByDate.get(dayKey) ?? []).filter((block) => block.id !== ignoreBlockId);
    const collisionAtStart = dayBlocks.some((block) => slotIndex >= block.startSlot && slotIndex < block.endSlot);
    if (collisionAtStart) return 0;
    const nextOccupied = dayBlocks.find((block) => block.startSlot > slotIndex);
    const totalSlots = slotLabels.length;
    if (!nextOccupied) return totalSlots - slotIndex;
    return Math.max(1, nextOccupied.startSlot - slotIndex);
  };

  const getMaxSpanForBlock = (block: SlotBlock) => {
    const dayBlocks = blocksByDate.get(block.dateKey) ?? [];
    const nextOccupied = dayBlocks.find((item) => item.startSlot > block.startSlot && item.id !== block.id);
    const totalSlots = slotLabels.length;
    if (!nextOccupied) return Math.max(1, totalSlots - block.startSlot);
    return Math.max(1, nextOccupied.startSlot - block.startSlot);
  };

  const applySetup = (openPlanner: boolean) => {
    const parsedInterval = Number(setupInterval);

    const nextSettings: PlannerSettings = {
      timeFormat: setupTimeFormat,
      interval: parsedInterval,
      startTime: setupStartTime,
      endTime: setupEndTime,
      weekStartsOn: setupWeekStart,
      theme: setupTheme,
    };
    const { startMin, endMin } = getPlannerWindow(nextSettings);
    setSetupValidationMessage("");

    setSettings(nextSettings);
    setInlineSpan("1");
    setIsSettingsOpen(false);
    if (openPlanner) {
      setReadyToPlan(true);
      setWelcomeTyped("");
      setShowWelcomeLetter(true);
    }

    setBlocks((prev) =>
      prev.filter((block) => {
        const bStart = toMinutes(block.start);
        const bEnd = toMinutes(block.end);
        return bEnd > startMin && bStart < endMin;
      }),
    );
  };

  const pushUndoSnapshot = useCallback(() => {
    const snapshot: UndoSnapshot = {
      blocks: blocks.map((block) => ({ ...block })),
      queueTasks: queueTasks.map((task) => ({ ...task })),
    };
    const nextStack = [...undoStackRef.current, snapshot];
    if (nextStack.length > MAX_UNDO_STEPS) {
      nextStack.shift();
    }
    undoStackRef.current = nextStack;
  }, [blocks, queueTasks]);

  const showFirstTaskEnvelope = () => {
    if (firstTaskLetterShownRef.current) return;
    firstTaskLetterShownRef.current = true;
    localStorage.setItem(FIRST_TASK_HINT_KEY, "1");
    setShowFirstTaskLetter(true);
  };

  const closeFirstTaskEnvelope = () => {
    setShowFirstTaskLetter(false);
  };

  const addInlineBlock = () => {
    if (!settings || !editingCell || inlineTask.trim() === "") return;
    const isFirstTask = blocks.length === 0;

    const maxSlots = getMaxFreeSlots(editingCell.day, editingCell.slot);
    const chosenSlots = Math.min(Number(inlineSpan) || 1, maxSlots);
    const startMinutes = plannerWindow.startMin + editingCell.slot * settings.interval;
    const endMinutes = Math.min(startMinutes + chosenSlots * settings.interval, plannerWindow.endMin);

    const next: PlanBlock = {
      id: crypto.randomUUID(),
      dateKey: dateToKey(dayDates.get(editingCell.day) ?? cursorDate),
      task: inlineTask.trim(),
      start: minutesTo24h(startMinutes),
      end: minutesTo24h(endMinutes),
      done: false,
    };

    pushUndoSnapshot();
    setBlocks((prev) => [...prev, next]);
    if (isFirstTask) showFirstTaskEnvelope();
    setInlineTask("");
    setInlineSpan("1");
    setEditingCell(null);
  };

  const celebrate = () => {
    const line = QUOTES[quoteIndexRef.current % QUOTES.length];
    quoteIndexRef.current += 1;
    setCelebrationQuote(line);
    if (quoteTimeoutRef.current) window.clearTimeout(quoteTimeoutRef.current);
    quoteTimeoutRef.current = window.setTimeout(() => setCelebrationQuote(null), 4000);
  };

  const toggleDone = (id: string, checked: boolean) => {
    const target = blocks.find((block) => block.id === id);
    if (!target || target.done === checked) return;
    pushUndoSnapshot();
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) return block;
        return { ...block, done: checked };
      }),
    );
    if (checked) celebrate();
  };

  const eraseBlock = (id: string) => {
    const exists = blocks.some((block) => block.id === id);
    if (!exists) return;
    pushUndoSnapshot();
    setBlocks((prev) => prev.filter((block) => block.id !== id));
  };

  const jumpToNow = () => {
    const nowDate = new Date();
    const nowSlot = slotLabels.findIndex((slot) => {
      const slotStartMin = toMinutes(slot.start24);
      const slotEndMin = toMinutes(slot.end24);
      const nowMins = nowDate.getHours() * 60 + nowDate.getMinutes();
      return nowMins >= slotStartMin && nowMins < slotEndMin;
    });

    setCursorDate(nowDate);
    if (viewMode !== "day") {
      setViewMode("day");
    }
    window.requestAnimationFrame(() => {
      if (nowSlot < 0) return;
      const row = plannerSectionRef.current?.querySelector(`[data-slot-num="${nowSlot}"]`) as HTMLElement | null;
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  };

  const applyPeriodInputJump = () => {
    if (!periodInputDate) {
      setIsPeriodEditing(false);
      return;
    }
    setCursorDate(keyToDate(periodInputDate));
    setIsPeriodEditing(false);
  };

  const handlePeriodInputChange = (value: string) => {
    setPeriodInputDate(value);
    if (value.length !== 10) return;
    setCursorDate(keyToDate(value));
    setIsPeriodEditing(false);
  };

  const exportPlannerAsPdf = async () => {
    if (!plannerTableRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(plannerTableRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });
      const image = new Image();
      image.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("failed to load export image"));
      });
      const orientation = image.width >= image.height ? "landscape" : "portrait";
      const pdf = new jsPDF({
        orientation,
        unit: "px",
        format: [image.width + 40, image.height + 40],
      });
      pdf.addImage(dataUrl, "PNG", 20, 20, image.width, image.height);
      pdf.save(`minutely-${dateToKey(cursorDate)}-${viewMode}.pdf`);
    } catch (error) {
      console.error("pdf export failed", error);
    } finally {
      setIsExporting(false);
    }
  };

  const openDaySummary = (day: number) => {
    if (!settings) {
      return;
    }
    const dayDate = dayDates.get(day) ?? cursorDate;
    const dayKey = dateToKey(dayDate);

    const dayBlocks = blocks
      .filter((block) => block.dateKey === dayKey)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

    if (dayBlocks.length === 0) {
      setDaySummary({
        day,
        lines: ["no activities logged yet.", "add a few time blocks and come back tonight."],
      });
      return;
    }

    const longBlocks = dayBlocks.filter((block) => toMinutes(block.end) - toMinutes(block.start) >= 60);

    if (longBlocks.length === 0) {
      setDaySummary({
        day,
        lines: ["no tasks longer than 1 hour today.", "add longer focus blocks if you want a shorter recap view."],
      });
      return;
    }

    const lines: string[] = [];
    for (const block of longBlocks) {
      const timeLabel = `${formatMinutes(toMinutes(block.start), settings.timeFormat)} - ${formatMinutes(
        toMinutes(block.end),
        settings.timeFormat,
      )}`;
      const lengthLabel = formatDuration(toMinutes(block.end) - toMinutes(block.start));
      lines.push(`${timeLabel} (${lengthLabel}): ${block.task}`);
    }

    setDaySummary({ day, lines });
  };

  const openWeekSummary = () => {
    if (!settings) return;
    const weekDates = dayOrder.map((_, idx) => {
      const date = new Date(startOfDisplayedWeek);
      date.setDate(startOfDisplayedWeek.getDate() + idx);
      return dateToKey(date);
    });

    const weekBlocks = blocks.filter((block) => weekDates.includes(block.dateKey));
    if (weekBlocks.length === 0) {
      setWeekSummary({
        lines: ["no activities logged this week yet.", "fill a few blocks and come back for your recap."],
      });
      return;
    }

    const taskMinutes = new Map<string, number>();
    let totalMinutes = 0;
    for (const block of weekBlocks) {
      const task = block.task.trim() || "untitled task";
      const mins = Math.max(0, toMinutes(block.end) - toMinutes(block.start));
      totalMinutes += mins;
      taskMinutes.set(task, (taskMinutes.get(task) ?? 0) + mins);
    }

    const topTasks = Array.from(taskMinutes.entries())
      .filter(([, mins]) => mins >= 120)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([task, mins]) => `${task} — ${formatDuration(mins)}`);

    const lines = [
      `total tasks scheduled: ${weekBlocks.length}`,
      `total planned time: ${formatDuration(totalMinutes)}`,
      topTasks.length > 0 ? "2+ hour priorities:" : "no 2+ hour tasks this week yet.",
      ...topTasks,
    ];

    setWeekSummary({ lines });
  };

  const startInlineTaskEdit = (block: SlotBlock) => {
    setInlineEditingTaskId(block.id);
    setInlineEditingTaskName(block.task);
  };

  const saveInlineTaskEdit = () => {
    if (!inlineEditingTaskId) return;
    const nextName = inlineEditingTaskName.trim();
    if (nextName && blocks.some((item) => item.id === inlineEditingTaskId && item.task !== nextName)) {
      pushUndoSnapshot();
      setBlocks((prev) => prev.map((item) => (item.id === inlineEditingTaskId ? { ...item, task: nextName } : item)));
    }
    setInlineEditingTaskId(null);
    setInlineEditingTaskName("");
  };

  const repeatBlock = (blockId: string, offsetDays: number) => {
    if (!settings) return;
    const source = normalized.find((item) => item.id === blockId);
    if (!source) return;
    const sourceDate = keyToDate(source.dateKey);
    const targetDate = new Date(sourceDate);
    targetDate.setDate(sourceDate.getDate() + offsetDays);
    const targetDateKey = dateToKey(targetDate);

    const targetDayBlocks = (blocksByDate.get(targetDateKey) ?? []).filter((item) => item.id !== blockId);
    const hasCollision = targetDayBlocks.some((item) => source.startSlot < item.endSlot && source.endSlot > item.startSlot);
    if (hasCollision) {
      window.alert("that time is already occupied on the target day.");
      return;
    }

    const startMinutes = plannerWindow.startMin + source.startSlot * settings.interval;
    const endMinutes = plannerWindow.startMin + source.endSlot * settings.interval;
    const next: PlanBlock = {
      id: crypto.randomUUID(),
      dateKey: targetDateKey,
      task: source.task,
      start: minutesTo24h(startMinutes),
      end: minutesTo24h(endMinutes),
      done: false,
    };

    pushUndoSnapshot();
    setBlocks((prev) => [...prev, next]);
  };

  const moveBlockToSlot = (blockId: string, day: number, slotIndex: number) => {
    if (!settings) return;
    const block = normalized.find((item) => item.id === blockId);
    if (!block) return;
    const currentSpan = Math.max(1, block.endSlot - block.startSlot);
    const maxSlots = getMaxFreeSlotsForMove(day, slotIndex, blockId);
    if (maxSlots < 1) return;
    const span = Math.min(currentSpan, maxSlots);
    const startMinutes = plannerWindow.startMin + slotIndex * settings.interval;
    const endMinutes = Math.min(startMinutes + span * settings.interval, plannerWindow.endMin);
    const targetDate = dayDates.get(day) ?? cursorDate;
    const nextDateKey = dateToKey(targetDate);
    const nextStart = minutesTo24h(startMinutes);
    const nextEnd = minutesTo24h(endMinutes);
    if (block.dateKey === nextDateKey && block.start === nextStart && block.end === nextEnd) return;

    pushUndoSnapshot();
    setBlocks((prev) =>
      prev.map((item) =>
        item.id === blockId
          ? {
              ...item,
              dateKey: nextDateKey,
              start: nextStart,
              end: nextEnd,
            }
          : item,
      ),
    );
  };

  const scheduleQueueTask = (queueTaskId: string, day: number, slotIndex: number) => {
    if (!settings) return;
    const isFirstTask = blocks.length === 0;
    const queueTask = queueTasks.find((item) => item.id === queueTaskId);
    if (!queueTask) return;
    const maxSlots = getMaxFreeSlots(day, slotIndex);
    if (maxSlots < 1) return;
    const span = Math.min(queueTask.span, maxSlots);
    const startMinutes = plannerWindow.startMin + slotIndex * settings.interval;
    const endMinutes = Math.min(startMinutes + span * settings.interval, plannerWindow.endMin);
    const targetDate = dayDates.get(day) ?? cursorDate;

    const next: PlanBlock = {
      id: crypto.randomUUID(),
      dateKey: dateToKey(targetDate),
      task: queueTask.task,
      start: minutesTo24h(startMinutes),
      end: minutesTo24h(endMinutes),
      done: false,
    };

    pushUndoSnapshot();
    setBlocks((prev) => [...prev, next]);
    if (isFirstTask) showFirstTaskEnvelope();
    setQueueTasks((prev) => prev.filter((item) => item.id !== queueTaskId));
  };

  const moveBlockToQueue = (blockId: string) => {
    const block = normalized.find((item) => item.id === blockId);
    if (!block) return;
    const span = Math.max(1, block.endSlot - block.startSlot);
    pushUndoSnapshot();
    setQueueTasks((prev) => [...prev, { id: crypto.randomUUID(), task: block.task, span }]);
    setBlocks((prev) => prev.filter((item) => item.id !== blockId));
  };

  const addQueueTask = () => {
    const task = queueDraft.trim();
    if (!task) return;
    pushUndoSnapshot();
    setQueueTasks((prev) => [...prev, { id: crypto.randomUUID(), task, span: 1 }]);
    setQueueDraft("");
  };

  const startTaskDrag = (event: ReactDragEvent<HTMLElement>, blockId: string) => {
    setDraggingBlockId(blockId);
    event.dataTransfer.effectAllowed = "move";
    const sourceCell = event.currentTarget.closest("td");
    const sourceRect = sourceCell?.getBoundingClientRect();
    const cloneTarget = (sourceCell ?? event.currentTarget).cloneNode(true) as HTMLElement;
    cloneTarget.style.position = "fixed";
    cloneTarget.style.top = "-9999px";
    cloneTarget.style.left = "-9999px";
    cloneTarget.style.pointerEvents = "none";
    cloneTarget.style.opacity = "0.96";
    cloneTarget.style.transform = "scale(0.98)";
    cloneTarget.style.boxShadow = "0 10px 24px rgba(0,0,0,0.16)";
    cloneTarget.style.borderRadius = "12px";
    cloneTarget.style.background = "#fff";
    if (sourceRect) {
      cloneTarget.style.width = `${Math.max(220, sourceRect.width - 12)}px`;
      cloneTarget.style.height = `${Math.max(80, sourceRect.height - 6)}px`;
    }
    document.body.appendChild(cloneTarget);
    event.dataTransfer.setDragImage(cloneTarget, 20, 16);
    window.setTimeout(() => cloneTarget.remove(), 0);
  };

  const startQueueDrag = (event: ReactDragEvent<HTMLElement>, task: QueueTask) => {
    setDraggingQueueTaskId(task.id);
    event.dataTransfer.effectAllowed = "move";
    const dragChip = document.createElement("div");
    dragChip.textContent = task.task;
    dragChip.style.position = "absolute";
    dragChip.style.top = "-9999px";
    dragChip.style.left = "-9999px";
    dragChip.style.padding = "10px 12px";
    dragChip.style.maxWidth = "260px";
    dragChip.style.borderRadius = "10px";
    dragChip.style.background = "rgba(255,255,255,0.98)";
    dragChip.style.border = "1px solid rgba(0,0,0,0.14)";
    dragChip.style.boxShadow = "0 8px 22px rgba(0,0,0,0.16)";
    dragChip.style.fontFamily = "Manrope, sans-serif";
    dragChip.style.fontSize = "14px";
    dragChip.style.color = "#111";
    document.body.appendChild(dragChip);
    event.dataTransfer.setDragImage(dragChip, 14, 14);
    window.setTimeout(() => dragChip.remove(), 0);
  };

  const startResizeBlock = (event: ReactPointerEvent, block: SlotBlock) => {
    if (!settings) return;
    event.preventDefault();
    event.stopPropagation();
    const firstRow = plannerSectionRef.current?.querySelector("tr[data-slot-num]") as HTMLElement | null;
    const rowHeight = firstRow?.getBoundingClientRect().height ?? 46;
    const maxSpan = getMaxSpanForBlock(block);
    const currentSpan = Math.max(1, block.endSlot - block.startSlot);
    resizeSessionRef.current = {
      blockId: block.id,
      initialSpan: currentSpan,
      maxSpan,
      initialPointerY: event.clientY,
      rowHeight,
    };
    const initialPreview = { blockId: block.id, span: currentSpan };
    resizePreviewRef.current = initialPreview;
    setResizePreview(initialPreview);
    pushUndoSnapshot();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const session = resizeSessionRef.current;
      if (!session) return;
      const deltaY = moveEvent.clientY - session.initialPointerY;
      const deltaSlots = Math.round(deltaY / session.rowHeight);
      const nextSpan = Math.max(1, Math.min(session.maxSpan, session.initialSpan + deltaSlots));
      const nextPreview = { blockId: session.blockId, span: nextSpan };
      resizePreviewRef.current = nextPreview;
      setResizePreview(nextPreview);
      setBlocks((prev) =>
        prev.map((item) =>
          item.id === session.blockId
            ? {
                ...item,
                end: minutesTo24h(
                  Math.min(plannerWindow.endMin, toMinutes(item.start) + Math.max(1, nextSpan) * settings.interval),
                ),
              }
            : item,
        ),
      );
    };

    const stopResize = () => {
      const session = resizeSessionRef.current;
      if (!session || !settings) return;
      resizeSessionRef.current = null;
      resizePreviewRef.current = null;
      setResizePreview(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
  };

  const resetAllData = () => {
    if (!window.confirm("erase all planner data and restart setup?")) return;
    localStorage.removeItem(BLOCKS_KEY);
    localStorage.removeItem(FOCUS_KEY);
    localStorage.removeItem(VIEW_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(QUEUE_KEY);
    localStorage.removeItem(MOBILE_DENSITY_KEY);
    setBlocks([]);
    setFocusByDate({});
    setQueueTasks([]);
    setViewMode("week");
    setMobileDensity("comfy");
    setCursorDate(new Date());
    setPeriodInputDate(dateToKey(new Date()));
    setSettings(null);
    setSetupTimeFormat(DEFAULT_SETTINGS.timeFormat);
    setSetupInterval(String(DEFAULT_SETTINGS.interval));
    setSetupStartTime(DEFAULT_SETTINGS.startTime);
    setSetupEndTime(DEFAULT_SETTINGS.endTime);
    setSetupWeekStart(DEFAULT_SETTINGS.weekStartsOn);
    setSetupTheme(DEFAULT_SETTINGS.theme);
    setSetupValidationMessage("");
    setReadyToPlan(false);
    setShowWelcomeLetter(false);
    setIsSettingsOpen(false);
  };

  const topClock = now.toLocaleTimeString([], {
    hour: settings?.timeFormat === "24h" ? "2-digit" : "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: settings?.timeFormat !== "24h",
  });
  const activeTheme = !readyToPlan ? setupTheme : (settings?.theme ?? "beige");
  const themeClasses = THEME_CLASSES[activeTheme];
  const tones = THEME_TONES[activeTheme];
  const centeredBtn = "!justify-center text-center [&>span]:w-full [&>span]:text-center";
  const denseMobile = mobileDensity === "dense";
  const mobileTimeCol = denseMobile ? "w-[72px]" : "w-[80px]";
  const mobileTimeText = denseMobile ? "text-[9px]" : "text-[10px]";
  const mobileCellMinW = denseMobile ? "min-w-32" : "min-w-36";
  const mobileCellPad = denseMobile ? "px-1 py-1" : "px-1.5 py-1.5";
  const setupSelectClassNames =
    activeTheme === "black"
      ? {
          trigger: "h-12 text-base bg-zinc-700 border-zinc-500 text-zinc-100",
          label: "text-zinc-300",
          value: "text-zinc-100",
          selectorIcon: "text-zinc-300",
        }
      : { trigger: "h-12 text-base" };
  const setupInputClassNames =
    activeTheme === "black"
      ? {
          inputWrapper: "h-12 bg-zinc-700 border-zinc-500",
          input: "text-zinc-100",
          label: "text-zinc-300",
        }
      : { inputWrapper: "h-12" };
  const focusPromptTextClass = activeTheme === "black" ? "!text-zinc-100" : tones.textMuted;
  const savedLabel = useMemo(() => {
    if (!lastSavedAt) return "not saved yet";
    const diffSeconds = Math.max(0, Math.floor((now.getTime() - lastSavedAt.getTime()) / 1000));
    if (diffSeconds < 5) return "saved just now";
    if (diffSeconds < 60) return `saved ${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `saved ${diffMinutes}m ago`;
    return `saved at ${lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }, [lastSavedAt, now]);

  if (!hydrated) {
    return <main className="min-h-screen bg-[#f6f6f4]" />;
  }

  if (!settings || !readyToPlan) {
    return (
      <main className={`min-h-screen ${themeClasses.page} px-5 py-10 font-[family-name:var(--font-manrope)] ${activeTheme === "black" ? "text-zinc-100" : "text-[#252525]"}`}>
        <div className="mx-auto max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
            <Card shadow="sm" className={`border ${tones.border} ${themeClasses.panel}`}>
              <CardBody className={`gap-6 p-8 ${activeTheme === "black" ? "black-setup" : ""}`}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.65 }} className="space-y-2">
                  <h1 className={`font-[family-name:var(--font-instrument-serif)] text-5xl leading-tight ${tones.textStrong}`}>
                    {setupTyped}
                    <span className="ml-0.5 inline-block animate-pulse">|</span>
                  </h1>
                <p className={`text-lg ${tones.textMuted}`}>set your format, then start planning.</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: "easeOut", delay: 0.12 }}
                  className="grid gap-4 sm:grid-cols-2"
                >
                <Select
                  label="time format"
                  labelPlacement="outside"
                  selectedKeys={new Set([setupTimeFormat])}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as TimeFormat;
                    if (selected) setSetupTimeFormat(selected);
                  }}
                  classNames={setupSelectClassNames}
                >
                  <SelectItem key="12h">normal time (am/pm)</SelectItem>
                  <SelectItem key="24h">military time</SelectItem>
                </Select>

                <Select
                  label="interval"
                  labelPlacement="outside"
                  selectedKeys={new Set([setupInterval])}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) setSetupInterval(selected);
                  }}
                  classNames={setupSelectClassNames}
                >
                  {INTERVAL_OPTIONS.map((option) => (
                    <SelectItem key={String(option)}>{`${option} minutes${option === 15 ? " (recommended)" : ""}`}</SelectItem>
                  ))}
                </Select>

                <Input
                  type="time"
                  label="day starts"
                  labelPlacement="outside"
                  value={setupStartTime}
                  onValueChange={(value) => {
                    setSetupStartTime(value);
                    if (setupValidationMessage) setSetupValidationMessage("");
                  }}
                  classNames={setupInputClassNames}
                />
                <Input
                  type="time"
                  label="day ends"
                  labelPlacement="outside"
                  value={setupEndTime}
                  onValueChange={(value) => {
                    setSetupEndTime(value);
                    if (setupValidationMessage) setSetupValidationMessage("");
                  }}
                  classNames={setupInputClassNames}
                />

                <Select
                  label="week starts on"
                  labelPlacement="outside"
                  selectedKeys={new Set([String(setupWeekStart)])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    setSetupWeekStart(value === "1" ? 1 : 0);
                  }}
                  classNames={setupSelectClassNames}
                >
                  <SelectItem key="0">sunday</SelectItem>
                  <SelectItem key="1">monday</SelectItem>
                </Select>
                <Select
                  label="theme"
                  labelPlacement="outside"
                  selectedKeys={new Set([setupTheme])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as ThemeName;
                    if (value) setSetupTheme(value);
                  }}
                  classNames={setupSelectClassNames}
                >
                  {THEME_OPTIONS.map((option) => (
                    <SelectItem key={option}>{THEME_LABELS[option]}</SelectItem>
                  ))}
                </Select>

                </motion.div>

                {setupValidationMessage ? <p className="text-sm text-red-500">{setupValidationMessage}</p> : null}

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay: 0.2 }}>
                  <Button radius="sm" size="lg" onPress={() => applySetup(true)} className={`h-12 text-base font-semibold ${tones.accentBtn}`}>
                    start planning
                  </Button>
                </motion.div>
              </CardBody>
            </Card>
          </motion.div>
        </div>
        {activeTheme === "black" ? (
          <style jsx global>{`
            .black-setup [data-slot="label"] { color: #e5e7eb !important; }
            .black-setup [data-slot="trigger"] { color: #f9fafb !important; background: #3f3f46 !important; border-color: #71717a !important; }
            .black-setup [data-slot="value"] { color: #f9fafb !important; }
            .black-setup [data-slot="input-wrapper"] { background: #3f3f46 !important; border-color: #71717a !important; }
            .black-setup input { color: #f9fafb !important; }
            .black-setup h1 { color: #f9fafb !important; }
          `}</style>
        ) : null}
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen ${themeClasses.page} px-3 font-[family-name:var(--font-manrope)] ${
        isElectronShell ? "pb-4 pt-10 sm:pb-6 sm:pt-10" : "py-4 sm:py-6"
      } sm:px-5 ${activeTheme === "black" ? "text-zinc-100" : "text-[#252525]"}`}
    >
      {isElectronShell ? (
        <div
          aria-hidden="true"
          className="fixed inset-x-0 top-0 z-[120] h-8"
          style={{ WebkitAppRegion: "drag" } as CSSProperties}
        />
      ) : null}
      <AnimatePresence>
        {showSavedToast ? (
          <motion.div
            key="saved-toast"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-4 right-4 z-[120]"
          >
            <div className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-700 shadow-sm">saved locally</div>
          </motion.div>
        ) : null}
        {showWelcomeLetter ? (
          <motion.div
            key="welcome-letter"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-white/95 px-4"
            onClick={() => setShowWelcomeLetter(false)}
          >
            <div className="max-w-2xl rounded-2xl border border-zinc-300 bg-white p-7 text-center shadow-md">
              <p className="text-2xl">✉️</p>
              <h2 className="mt-2 font-[family-name:var(--font-instrument-serif)] text-4xl text-zinc-900">
                {welcomeTyped}
                <span className="ml-0.5 inline-block animate-pulse">|</span>
              </h2>
              <p className="mt-4 whitespace-pre-line text-base text-zinc-700">
                happy to see you here! click any box to write a task, set an intention for each day, and have fun. let&apos;s make life count by the minute.
                {"\n\n"}with love,{`\n`}ellis :)
              </p>
              <div className="mt-5 flex items-center justify-center gap-3 text-zinc-600">
                <Link href="mailto:elliskim0114@gmail.com" isExternal aria-label="email">
                  <FaEnvelope className="text-base" />
                </Link>
                <Link href="https://www.linkedin.com/in/elliskim0114" isExternal aria-label="linkedin">
                  <FaLinkedin className="text-base" />
                </Link>
                <Link href="https://substack.com/@elliskim0114" isExternal aria-label="substack">
                  <SiSubstack className="text-base" />
                </Link>
                <Link href="https://x.com/elliskim0114" isExternal aria-label="x">
                  <FaXTwitter className="text-base" />
                </Link>
              </div>
              <p className="mt-4 text-sm text-zinc-500">click anywhere to close</p>
            </div>
          </motion.div>
        ) : null}
        {showFirstTaskLetter ? (
          <motion.div
            key="first-task-letter"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[109] flex items-center justify-center bg-white/95 px-4"
            onClick={closeFirstTaskEnvelope}
          >
            <div className="max-w-2xl rounded-2xl border border-zinc-300 bg-white p-7 text-center shadow-md">
              <p className="text-2xl">✉️</p>
              <h2 className="mt-2 font-[family-name:var(--font-instrument-serif)] text-4xl text-zinc-900">first task complete!</h2>
              <p className="mt-4 whitespace-pre-line text-base text-zinc-700">
                you&apos;re building real momentum.
                {"\n\n"}use &quot;jump to now&quot; to get to your current time.
                {"\n"}click the bottom-right star to save tasks in queue.
                {"\n"}right-click any task to repeat it.
              </p>
              <p className="mt-4 text-sm text-zinc-500">click anywhere to close</p>
            </div>
          </motion.div>
        ) : null}
        {repeatMenu ? (
          <div
            className={`fixed z-[130] min-w-[180px] rounded-md border shadow-lg ${tones.border} ${themeClasses.panel}`}
            style={{
              left: repeatMenu.x,
              top: repeatMenu.y,
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className={`border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide ${tones.borderSoft} ${tones.textSubtle}`}>repeat</div>
            <button
              type="button"
              className={`block w-full px-3 py-2 text-left text-sm ${tones.textStrong}`}
              onClick={() => {
                repeatBlock(repeatMenu.blockId, 1);
                setRepeatMenu(null);
              }}
            >
              daily (+1 day)
            </button>
            <button
              type="button"
              className={`block w-full px-3 py-2 text-left text-sm ${tones.textStrong}`}
              onClick={() => {
                repeatBlock(repeatMenu.blockId, 7);
                setRepeatMenu(null);
              }}
            >
              weekly (+7 days)
            </button>
          </div>
        ) : null}
        {celebrationQuote ? (
          <motion.div
            key="celebration-letter"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white"
            onClick={() => {
              if (quoteTimeoutRef.current) window.clearTimeout(quoteTimeoutRef.current);
              setCelebrationQuote(null);
            }}
          >
            <div className="relative flex h-80 w-[min(92vw,620px)] items-center justify-center">
              <motion.div
                initial={{ scale: 0.92, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="relative h-52 w-[min(88vw,520px)]"
              >
                <div className="absolute inset-x-0 bottom-0 h-36 rounded-b-2xl border border-zinc-300 bg-white" />
                <motion.div
                  initial={{ rotateX: 0 }}
                  animate={{ rotateX: -170 }}
                  transition={{ duration: 0.65, ease: "easeInOut" }}
                  style={{ transformOrigin: "top" }}
                  className="absolute inset-x-0 top-0 h-28 rounded-t-2xl border border-zinc-300 bg-zinc-100"
                />
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: -14, opacity: 1 }}
                  transition={{ duration: 0.55, delay: 0.28 }}
                  className="absolute left-1/2 top-14 w-[85%] -translate-x-1/2 rounded-xl border border-zinc-300 bg-white px-5 py-6 text-center"
                >
                  <p className="text-2xl">💌</p>
                  <p className="mt-1 text-sm uppercase tracking-wide text-zinc-500">task complete. proud of you.</p>
                  <p className="mt-2 font-[family-name:var(--font-instrument-serif)] text-2xl text-zinc-800">{celebrationQuote}</p>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
        {daySummary ? (
          <motion.div
            key="day-summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[105] flex items-center justify-center bg-white/95 px-4"
            onClick={() => setDaySummary(null)}
          >
            <div className="relative flex h-[28rem] w-[min(94vw,720px)] items-center justify-center">
              <motion.div
                initial={{ scale: 0.96, y: 16 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="relative h-72 w-[min(92vw,620px)]"
              >
                <div className="absolute inset-x-0 bottom-0 h-52 rounded-b-3xl border border-zinc-300 bg-white" />
                <motion.div
                  initial={{ rotateX: 0 }}
                  animate={{ rotateX: -170 }}
                  transition={{ duration: 0.65, ease: "easeInOut" }}
                  style={{ transformOrigin: "top" }}
                  className="absolute inset-x-0 top-0 h-32 rounded-t-3xl border border-zinc-300 bg-zinc-100"
                />
                <motion.div
                  initial={{ y: 60, opacity: 0 }}
                  animate={{ y: -14, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="absolute left-1/2 top-16 w-[88%] -translate-x-1/2 rounded-2xl border border-zinc-300 bg-white px-5 py-5"
                >
                  <p className="text-center text-sm uppercase tracking-wide text-zinc-500">
                    {DAY_NAMES[daySummary.day]} recap
                  </p>
                  <p className="mt-1 text-center font-[family-name:var(--font-instrument-serif)] text-3xl text-zinc-900">
                    your day in a few lines
                  </p>
                  <div className="mt-4 space-y-2 text-sm text-zinc-700">
                    {daySummary.lines.map((line, index) => (
                      <p key={`day-${daySummary.day}-${index}`}>• {line}</p>
                    ))}
                  </div>
                  <p className="mt-4 text-center text-xs text-zinc-500">click anywhere to close</p>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
        {weekSummary ? (
          <motion.div
            key="week-summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[106] flex items-center justify-center bg-white/95 px-4"
            onClick={() => setWeekSummary(null)}
          >
            <div className="relative flex h-[28rem] w-[min(94vw,720px)] items-center justify-center">
              <motion.div
                initial={{ scale: 0.96, y: 16 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="relative h-72 w-[min(92vw,620px)]"
              >
                <div className="absolute inset-x-0 bottom-0 h-52 rounded-b-3xl border border-zinc-300 bg-white" />
                <motion.div
                  initial={{ rotateX: 0 }}
                  animate={{ rotateX: -170 }}
                  transition={{ duration: 0.65, ease: "easeInOut" }}
                  style={{ transformOrigin: "top" }}
                  className="absolute inset-x-0 top-0 h-32 rounded-t-3xl border border-zinc-300 bg-zinc-100"
                />
                <motion.div
                  initial={{ y: 60, opacity: 0 }}
                  animate={{ y: -14, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="absolute left-1/2 top-16 w-[88%] -translate-x-1/2 rounded-2xl border border-zinc-300 bg-white px-5 py-5"
                >
                  <p className="text-center text-sm uppercase tracking-wide text-zinc-500">weekly recap</p>
                  <p className="mt-1 text-center font-[family-name:var(--font-instrument-serif)] text-3xl text-zinc-900">where your time went</p>
                  <div className="mt-4 space-y-2 text-sm text-zinc-700">
                    {weekSummary.lines.map((line, index) => {
                      const isLabel = index <= 2;
                      return (
                        <p key={`week-${index}`} className={isLabel ? "font-semibold text-zinc-900" : ""}>
                          {isLabel ? line : `• ${line}`}
                        </p>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-center text-xs text-zinc-500">click anywhere to close</p>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mx-auto max-w-[1600px] space-y-4">
        <header className={`sticky top-2 z-40 rounded-xl border ${tones.border} ${themeClasses.panel} p-3 shadow-sm backdrop-blur sm:p-5`}>
          <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 sm:gap-x-6">
            <h1 className="font-[family-name:var(--font-instrument-serif)] text-xl leading-none sm:text-5xl">
              {plannerTyped}
              <span className={`ml-0.5 inline-block ${plannerTyped.length < "minutely".length ? "animate-pulse" : ""}`}>|</span>
            </h1>
            <div className={`text-right font-mono text-lg leading-none tabular-nums sm:mt-2 sm:text-4xl ${tones.textStrong}`}>{topClock}</div>
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18 }}
              className={`text-xs sm:text-lg ${tones.textMuted}`}
            >
              clean blocks. zero noise. every minute.
            </motion.p>
            <button
              type="button"
              className={`truncate text-right text-xs sm:text-lg ${tones.textMuted}`}
              onClick={jumpToNow}
            >
              current slot: {currentSlotLabel}
            </button>
          </div>

          <div className={`mt-3 rounded-lg border ${tones.borderSoft} ${themeClasses.soft} px-2.5 py-2.5 sm:px-4 sm:py-3`}>
            <div className="flex items-start gap-2 sm:hidden">
              <div className={`flex overflow-hidden rounded-md border ${tones.border} ${tones.baseSurface}`}>
                <Button
                  size="md"
                  radius="none"
                  variant="light"
                  className={`h-9 min-w-20 border-r text-sm font-medium ${tones.border} ${tones.textStrong} ${centeredBtn} ${
                    viewMode === "day" ? tones.softHeader : ""
                  }`}
                  onPress={() => setViewMode("day")}
                >
                  day
                </Button>
                <Button
                  size="md"
                  radius="none"
                  variant="light"
                  className={`h-9 min-w-20 text-sm font-medium ${tones.textStrong} ${centeredBtn} ${
                    viewMode === "week" ? tones.softHeader : ""
                  }`}
                  onPress={() => setViewMode("week")}
                >
                  week
                </Button>
              </div>

              <div className={`flex min-w-0 flex-1 overflow-hidden rounded-md border ${tones.border} ${tones.baseSurface}`}>
                <div className="flex h-9 min-w-0 flex-1 items-center justify-center px-1">
                  {isPeriodEditing ? (
                    <Input
                      type="date"
                      aria-label="jump to date"
                      value={periodInputDate}
                      onValueChange={handlePeriodInputChange}
                      autoFocus
                      className="w-full"
                      classNames={{
                        inputWrapper: `h-8 min-h-8 border-none bg-transparent shadow-none ${activeTheme === "black" ? "[color-scheme:dark]" : ""}`,
                        input: `text-center text-xs ${activeTheme === "black" ? "!text-zinc-100" : tones.textMuted}`,
                      }}
                      onBlur={applyPeriodInputJump}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          applyPeriodInputJump();
                        }
                        if (event.key === "Escape") {
                          setPeriodInputDate(dateToKey(cursorDate));
                          setIsPeriodEditing(false);
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className={`h-full w-full truncate text-center text-xs ${tones.textMuted}`}
                      onClick={() => setIsPeriodEditing(true)}
                    >
                      {currentPeriodLabel}
                    </button>
                  )}
                </div>
              </div>

              <Dropdown>
                <DropdownTrigger>
                  <Button
                    size="md"
                    variant="light"
                    className={`h-9 min-w-9 rounded-md border px-2 ${tones.border} ${tones.baseSurface} ${tones.textStrong} ${centeredBtn}`}
                    isIconOnly
                    aria-label="open planner actions"
                  >
                    <FiMenu className="text-lg" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="planner mobile menu"
                  className={`min-w-[220px] ${activeTheme === "black" ? "text-zinc-100" : ""}`}
                  itemClasses={{
                    base: `data-[hover=true]:${tones.softHeader}`,
                  }}
                >
                  <DropdownItem
                    key="prev-period"
                    onPress={() =>
                      setCursorDate((prev) => {
                        const next = new Date(prev);
                        next.setDate(prev.getDate() - (viewMode === "week" ? 7 : 1));
                        return next;
                      })
                    }
                  >
                    prev
                  </DropdownItem>
                  <DropdownItem
                    key="next-period"
                    onPress={() =>
                      setCursorDate((prev) => {
                        const next = new Date(prev);
                        next.setDate(prev.getDate() + (viewMode === "week" ? 7 : 1));
                        return next;
                      })
                    }
                  >
                    next
                  </DropdownItem>
                  <DropdownItem key="jump" onPress={jumpToNow}>
                    jump to now
                  </DropdownItem>
                  <DropdownItem key="recap" onPress={openWeekSummary}>
                    weekly recap
                  </DropdownItem>
                  <DropdownItem key="export" onPress={exportPlannerAsPdf} isDisabled={isExporting}>
                    export pdf
                  </DropdownItem>
                  {hasSupabaseEnv ? (
                    session?.user ? (
                      <DropdownItem key="sync-out" onPress={signOutFromSync}>
                        sign out
                      </DropdownItem>
                    ) : (
                      <DropdownItem key="sync-in" onPress={signInToSync}>
                        sync sign in
                      </DropdownItem>
                    )
                  ) : (
                    <DropdownItem key="sync-missing" onPress={() => setCloudStatus("sync unavailable: missing supabase env vars")}>
                      sync unavailable
                    </DropdownItem>
                  )}
                  <DropdownItem key="settings" onPress={() => setIsSettingsOpen(true)}>
                    settings
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>

            <div className="topbar-buttons hidden items-center gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex">
              <div className={`flex overflow-hidden rounded-md border ${tones.border} ${tones.baseSurface}`}>
                <Button
                  size="md"
                  radius="none"
                  variant="light"
                  className={`h-9 min-w-20 border-r text-sm font-medium sm:h-10 sm:min-w-24 sm:text-base ${tones.border} ${tones.textStrong} ${centeredBtn} ${
                    viewMode === "day" ? tones.softHeader : ""
                  }`}
                  onPress={() => setViewMode("day")}
                >
                  day view
                </Button>
                <Button
                  size="md"
                  radius="none"
                  variant="light"
                  className={`h-9 min-w-20 text-sm font-medium sm:h-10 sm:min-w-24 sm:text-base ${tones.textStrong} ${centeredBtn} ${
                    viewMode === "week" ? tones.softHeader : ""
                  }`}
                  onPress={() => setViewMode("week")}
                >
                  week view
                </Button>
              </div>
              <div className={`flex overflow-hidden rounded-md border ${tones.border} ${tones.baseSurface}`}>
                <Button
                  size="md"
                  radius="none"
                  variant="light"
                  className={`h-9 min-w-20 border-r text-sm font-medium sm:h-10 sm:min-w-24 sm:text-base ${tones.border} ${tones.textStrong} ${centeredBtn}`}
                  onPress={() =>
                    setCursorDate((prev) => {
                      const next = new Date(prev);
                      next.setDate(prev.getDate() - (viewMode === "week" ? 7 : 1));
                      return next;
                    })
                  }
                >
                  prev
                </Button>
                <div className={`flex h-9 min-w-32 items-center justify-center px-2 sm:h-10 sm:min-w-40 sm:px-3`}>
                  {isPeriodEditing ? (
                    <Input
                      type="date"
                      aria-label="jump to date"
                      value={periodInputDate}
                      onValueChange={handlePeriodInputChange}
                      autoFocus
                      className="w-full"
                      classNames={{
                        inputWrapper: `h-8 min-h-8 border-none bg-transparent shadow-none sm:h-9 sm:min-h-9 ${activeTheme === "black" ? "[color-scheme:dark]" : ""}`,
                        input: `text-center text-xs sm:text-sm ${activeTheme === "black" ? "!text-zinc-100" : tones.textMuted}`,
                      }}
                      onBlur={applyPeriodInputJump}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          applyPeriodInputJump();
                        }
                        if (event.key === "Escape") {
                          setPeriodInputDate(dateToKey(cursorDate));
                          setIsPeriodEditing(false);
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className={`h-full w-full text-center text-xs sm:text-sm ${tones.textMuted}`}
                      onClick={() => setIsPeriodEditing(true)}
                    >
                      {currentPeriodLabel}
                    </button>
                  )}
                </div>
                <Button
                  size="md"
                  radius="none"
                  variant="light"
                  className={`h-9 min-w-20 border-l text-sm font-medium sm:h-10 sm:min-w-24 sm:text-base ${tones.border} ${tones.textStrong} ${centeredBtn}`}
                  onPress={() =>
                    setCursorDate((prev) => {
                      const next = new Date(prev);
                      next.setDate(prev.getDate() + (viewMode === "week" ? 7 : 1));
                      return next;
                    })
                  }
                >
                  next
                </Button>
              </div>
              <div className={`flex overflow-hidden rounded-md border ${tones.border} ${tones.baseSurface}`}>
                <Button
                  size="md"
                  radius="none"
                  variant="light"
                  className={`h-9 min-w-24 text-sm font-medium sm:h-10 sm:min-w-28 sm:text-base ${tones.textStrong} ${centeredBtn}`}
                  onPress={jumpToNow}
                >
                  jump to now
                </Button>
              </div>
              <div className={`flex overflow-hidden rounded-md border ${tones.border} ${tones.baseSurface}`}>
                <Button
                  size="md"
                  radius="none"
                  variant="light"
                  className={`h-9 min-w-32 text-sm font-medium sm:h-10 sm:min-w-36 sm:text-base ${tones.textStrong} ${centeredBtn}`}
                  onPress={openWeekSummary}
                >
                  weekly recap
                </Button>
              </div>
              <div className={`flex overflow-hidden rounded-md border ${tones.border} ${tones.baseSurface}`}>
                <Button
                  size="md"
                  radius="none"
                  variant="light"
                  className={`h-9 min-w-24 text-sm font-medium sm:h-10 sm:min-w-28 sm:text-base ${tones.textStrong} ${centeredBtn}`}
                  onPress={exportPlannerAsPdf}
                  isDisabled={isExporting}
                >
                  export pdf
                </Button>
              </div>
              <div className={`flex overflow-hidden rounded-md border ${tones.border} ${tones.baseSurface}`}>
                {hasSupabaseEnv ? (
                  session?.user ? (
                    <Button
                      size="md"
                      radius="none"
                      variant="light"
                      className={`h-9 min-w-24 text-sm font-medium sm:h-10 sm:min-w-28 sm:text-base ${tones.textStrong} ${centeredBtn}`}
                      onPress={signOutFromSync}
                    >
                      sign out
                    </Button>
                  ) : (
                    <Button
                      size="md"
                      radius="none"
                      variant="light"
                      className={`h-9 min-w-24 text-sm font-medium sm:h-10 sm:min-w-28 sm:text-base ${tones.textStrong} ${centeredBtn}`}
                      onPress={signInToSync}
                    >
                      sync sign in
                    </Button>
                  )
                ) : (
                  <Button
                    size="md"
                    radius="none"
                    variant="light"
                    className={`h-9 min-w-24 text-sm font-medium sm:h-10 sm:min-w-28 sm:text-base ${tones.textStrong} ${centeredBtn}`}
                    onPress={() => setCloudStatus("sync unavailable: missing supabase env vars")}
                  >
                    sync unavailable
                  </Button>
                )}
              </div>
              <div className={`flex overflow-hidden rounded-md border ${tones.border} ${tones.baseSurface} sm:ml-auto`}>
                <Button
                  size="md"
                  radius="none"
                  variant="light"
                  className={`h-9 min-w-24 text-sm font-medium sm:h-10 sm:min-w-28 sm:text-base ${tones.textStrong} ${centeredBtn}`}
                  onPress={() => setIsSettingsOpen(true)}
                >
                  settings
                </Button>
              </div>
            </div>
            {hasSupabaseEnv ? (
              <p className={`mt-2 hidden text-xs sm:block ${tones.textSubtle}`}>
                cloud sync: {session?.user?.email ?? "not signed in"}
                {cloudStatus ? ` • ${cloudStatus}` : ""}
                {` • ${savedLabel}`}
              </p>
            ) : (
              <p className={`mt-2 hidden text-xs sm:block ${tones.textSubtle}`}>add supabase keys to enable cross-device sync. • {savedLabel}</p>
            )}
            <p className={`mt-1 text-[11px] sm:hidden ${tones.textSubtle}`}>
              {savedLabel} • use menu for settings
            </p>
            {visibleBlockCount === 0 ? (
              <p className={`mt-2 hidden text-sm sm:block ${tones.textSubtle}`}>no tasks yet. tap any empty cell to add your first block.</p>
            ) : null}
          </div>
        </header>

        <section ref={plannerSectionRef} className={`overflow-auto rounded-xl border ${tones.border} ${themeClasses.panel}`}>
          <table ref={plannerTableRef} className="w-full min-w-[340px] border-separate border-spacing-0 sm:min-w-[980px]">
            <thead>
              <tr className={tones.softHeader}>
                <th
                  className={`sticky left-0 z-20 ${mobileTimeCol} border-b border-r px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide sm:w-60 sm:px-4 sm:py-3 sm:text-sm ${tones.border} ${tones.softHeader} ${tones.textMuted}`}
                >
                  time
                </th>
                {visibleDays.map((dayIndex) => {
                  const isToday = dayIndex === now.getDay();
                  const date = dayDates.get(dayIndex) ?? now;
                  const focusKey = dateToKey(date);
                  const focusValue = focusByDate[focusKey] ?? "";
                  const showPrompt = isCurrentWindow && dayIndex === now.getDay();
                  const isEditing = editingFocusDay === dayIndex || focusValue.length > 0;
                  return (
                    <th key={dayIndex} className={`border-b border-r px-1.5 py-1.5 text-left sm:px-2 sm:py-2 ${tones.border} ${tones.textMuted}`}>
                      <div className="px-2 pb-2">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-sm capitalize sm:text-base ${isToday ? `font-extrabold ${tones.textStrong}` : "font-semibold"}`}>
                            {DAY_NAMES[dayIndex]}
                          </span>
                          <span className={`text-xs sm:text-sm ${isToday ? `font-semibold ${tones.textStrong}` : tones.textSubtle}`}>{formatDayDate(date)}</span>
                        </div>
                      </div>
                      {isEditing ? (
                        <Input
                          value={focusValue}
                          onValueChange={(value) =>
                            setFocusByDate((prev) => ({
                              ...prev,
                              [focusKey]: value,
                            }))
                          }
                          onBlur={() => {
                            if ((focusByDate[focusKey] ?? "").trim() === "") {
                              setEditingFocusDay(null);
                            }
                          }}
                          placeholder="what matters most today?"
                          classNames={{
                            inputWrapper: `h-8 rounded-md sm:h-10 ${tones.baseSurface}`,
                            input: `text-xs sm:text-sm ${activeTheme === "black" ? "!text-zinc-100" : ""}`,
                          }}
                        />
                      ) : (
                        <Button
                          variant="bordered"
                          radius="sm"
                          className={`h-8 w-full text-xs font-medium sm:h-10 sm:text-sm ${tones.border} ${tones.baseSurface} ${focusPromptTextClass}`}
                          onPress={() => setEditingFocusDay(dayIndex)}
                        >
                          {showPrompt ? "what matters most today?" : ""}
                        </Button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {slotLabels.map((slot, slotIndex) => {
                const slotStartMin = toMinutes(slot.start24);
                const slotEndMin = toMinutes(slot.end24);
                const isCurrentSlot = isCurrentWindow && adjustedCurrentMinutes >= slotStartMin && adjustedCurrentMinutes < slotEndMin;
                return (
                <tr
                  key={`${slot.start24}-${slot.end24}`}
                  data-slot-num={slotIndex}
                  className={isCurrentSlot ? tones.rowHighlight : ""}
                >
                  <td
                    className={`sticky left-0 z-10 ${mobileTimeCol} whitespace-nowrap border-b border-r px-2 py-2 align-top ${mobileTimeText} sm:w-60 sm:px-4 sm:py-3 sm:text-[15px] ${tones.borderSoft} ${themeClasses.panel} ${isCurrentSlot ? `font-extrabold ${tones.textStrong}` : tones.textSubtle}`}
                  >
                    {slot.label}
                  </td>

                  {visibleDays.map((dayIndex) => {
                    const cell = getCellForSlot(dayIndex, slotIndex);
                    if (cell.type === "covered") return null;

                    if (cell.type === "start") {
                      return (
                        <td
                          key={`${dayIndex}-${slotIndex}`}
                          rowSpan={cell.span}
                            className={`relative ${mobileCellMinW} border-b border-r ${mobileCellPad} pb-9 align-top sm:min-w-56 sm:px-3 sm:py-3 ${tones.borderSoft} ${
                              cell.block.done ? tones.doneBg : tones.baseSurface
                            }`}
                        >
                          <div
                            draggable
                            onDragStart={(event) => startTaskDrag(event, cell.block.id)}
                            onDragEnd={() => {
                              setDraggingBlockId(null);
                              setDraggingQueueTaskId(null);
                              setDropTarget(null);
                            }}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              setRepeatMenu({
                                blockId: cell.block.id,
                                x: event.clientX,
                                y: event.clientY,
                              });
                            }}
                            className={`flex h-full cursor-grab flex-col gap-2 rounded-md border p-2 transition-transform duration-150 active:cursor-grabbing ${
                              tones.borderSoft
                            } ${
                              draggingBlockId === cell.block.id ? "-translate-y-1 scale-[0.99] opacity-35 shadow-xl ring-2 ring-black/10" : ""
                            }`}
                          >
                            {inlineEditingTaskId === cell.block.id ? (
                              <Input
                                value={inlineEditingTaskName}
                                onValueChange={setInlineEditingTaskName}
                                autoFocus
                                classNames={{ inputWrapper: "h-8 sm:h-9", input: "text-xs sm:text-base" }}
                                onBlur={saveInlineTaskEdit}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    saveInlineTaskEdit();
                                  }
                                  if (event.key === "Escape") {
                                    setInlineEditingTaskId(null);
                                    setInlineEditingTaskName("");
                                  }
                                }}
                              />
                            ) : (
                              <div
                                className={`w-full text-left text-sm leading-tight transition sm:text-lg ${
                                  cell.block.done ? `${tones.textSubtle} line-through` : tones.textStrong
                                }`}
                                onDoubleClick={() => startInlineTaskEdit(cell.block)}
                                title="drag to move, double-click to rename, right-click to repeat"
                              >
                                {cell.block.task}
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-3">
                              <Checkbox
                                isSelected={cell.block.done}
                                onValueChange={(checked) => toggleDone(cell.block.id, checked)}
                                size="sm"
                                classNames={{ label: `text-sm ${tones.textMuted}` }}
                              >
                                done
                              </Checkbox>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="light" className={tones.textSubtle} onPress={() => eraseBlock(cell.block.id)}>
                                  erase
                                </Button>
                              </div>
                            </div>
                            {resizePreview?.blockId === cell.block.id ? (
                              <p className={`mt-auto text-xs ${tones.textSubtle}`}>{resizePreview.span} blocks</p>
                            ) : null}
                          </div>
                          <div
                            aria-label="resize task"
                            className={`absolute inset-x-1 bottom-1 h-9 cursor-row-resize rounded-md border ${tones.borderSoft} ${tones.baseSurface}`}
                            onPointerDown={(event) => startResizeBlock(event, cell.block)}
                          >
                            <div className={`mx-auto mt-3 h-1.5 w-20 rounded-full ${tones.textSubtle} bg-current/35`} />
                          </div>
                        </td>
                      );
                    }

                    const isEditing = editingCell?.day === dayIndex && editingCell.slot === slotIndex;
                    const maxSpan = getMaxFreeSlots(dayIndex, slotIndex);

                    return (
                      <td
                        key={`${dayIndex}-${slotIndex}`}
                        className={`${mobileCellMinW} border-b border-r ${mobileCellPad} align-top sm:min-w-56 ${tones.borderSoft} ${
                          isCurrentSlot ? tones.cellHighlight : ""
                        } ${
                          dropTarget?.day === dayIndex && dropTarget?.slot === slotIndex ? `ring-2 ${tones.border} ${tones.softHeader}` : ""
                        }`}
                        onDragOver={(event) => {
                          if (!draggingBlockId && !draggingQueueTaskId) return;
                          event.preventDefault();
                          setDropTarget({ day: dayIndex, slot: slotIndex });
                        }}
                        onDragLeave={() => {
                          if (dropTarget?.day === dayIndex && dropTarget?.slot === slotIndex) setDropTarget(null);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggingBlockId) {
                            moveBlockToSlot(draggingBlockId, dayIndex, slotIndex);
                          } else if (draggingQueueTaskId) {
                            scheduleQueueTask(draggingQueueTaskId, dayIndex, slotIndex);
                          } else {
                            return;
                          }
                          setDraggingBlockId(null);
                          setDraggingQueueTaskId(null);
                          setDropTarget(null);
                        }}
                      >
                        {isEditing ? (
                          <div className={`space-y-2 rounded-md border p-2 ${tones.border} ${themeClasses.soft}`}>
                            <Input
                              value={inlineTask}
                              onValueChange={setInlineTask}
                              autoFocus
                              placeholder="task"
                              classNames={{ inputWrapper: "h-10", input: "text-sm" }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") addInlineBlock();
                                if (event.key === "Escape") {
                                  setEditingCell(null);
                                  setInlineTask("");
                                }
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <Select
                                selectedKeys={new Set([inlineSpan])}
                                onSelectionChange={(keys) => {
                                  const value = Array.from(keys)[0] as string;
                                  if (value) setInlineSpan(value);
                                }}
                                className="w-40"
                                classNames={{ trigger: "h-9 min-h-9" }}
                                size="sm"
                              >
                                {Array.from({ length: Math.min(maxSpan, 8) }, (_, i) => i + 1).map((span) => (
                                  <SelectItem key={String(span)}>{`${span} block${span > 1 ? "s" : ""}`}</SelectItem>
                                ))}
                              </Select>
                              <Button size="sm" className={tones.accentBtn} onPress={addInlineBlock}>
                                save
                              </Button>
                              <Button
                                size="sm"
                                variant="light"
                                onPress={() => {
                                  setEditingCell(null);
                                  setInlineTask("");
                                }}
                              >
                                cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            aria-label="add task"
                            className={`h-full min-h-14 w-full rounded-md border border-dashed transition hover:opacity-80 ${tones.borderSoft}`}
                            onClick={() => {
                              setEditingCell({ day: dayIndex, slot: slotIndex });
                              setInlineSpan("1");
                            }}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );})}
              <tr className={tones.softHeader}>
                <td
                  className={`sticky left-0 z-10 ${mobileTimeCol} whitespace-nowrap border-b border-r px-2 py-2 ${mobileTimeText} font-semibold sm:w-60 sm:px-4 sm:py-3 sm:text-sm ${tones.border} ${tones.softHeader} ${tones.textMuted}`}
                >
                  end of day
                </td>
                {visibleDays.map((dayIndex) => (
                  <td key={`summary-${dayIndex}`} className={`border-b border-r px-2 py-2 ${tones.border}`}>
                    <Button
                      radius="sm"
                      variant="bordered"
                      className={`h-10 w-full text-sm font-medium ${tones.border} ${tones.baseSurface} ${tones.textMuted}`}
                      onPress={() => openDaySummary(dayIndex)}
                    >
                      {isCurrentWindow && dayIndex === now.getDay() ? (
                        "summarize your day"
                      ) : (
                        <span className="invisible">summarize your day</span>
                      )}
                    </Button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      </div>
      {isQueueOpen ? (
        <div
          className={`fixed bottom-20 right-4 z-[95] w-[min(92vw,320px)] rounded-xl border p-3 shadow-xl ${tones.border} ${themeClasses.panel}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-semibold uppercase tracking-wide ${tones.textMuted}`}>queue</p>
            <Button size="sm" variant="light" className={tones.textSubtle} onPress={() => setIsQueueOpen(false)}>
              close
            </Button>
          </div>
          <p className={`mt-1 text-xs ${tones.textSubtle}`}>store tasks without a time, then drag them into slots.</p>

          <div className="mt-3 flex gap-2">
            <Input
              value={queueDraft}
              onValueChange={setQueueDraft}
              placeholder="task in queue"
              classNames={{ inputWrapper: "h-9", input: "text-sm" }}
              onKeyDown={(event) => {
                if (event.key === "Enter") addQueueTask();
              }}
            />
            <Button size="sm" className={tones.accentBtn} onPress={addQueueTask}>
              add
            </Button>
          </div>

          <div
            className={`mt-3 min-h-24 max-h-[52vh] space-y-2 overflow-auto rounded-md border p-2 ${tones.borderSoft} ${
              draggingBlockId ? `${tones.softHeader} border-dashed` : ""
            }`}
            onDragOver={(event) => {
              if (!draggingBlockId) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!draggingBlockId) return;
              moveBlockToQueue(draggingBlockId);
              setDraggingBlockId(null);
              setDraggingQueueTaskId(null);
              setDropTarget(null);
            }}
          >
            {queueTasks.length === 0 ? (
              <p className={`text-xs ${tones.textSubtle}`}>queue is empty.</p>
            ) : (
              queueTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(event) => startQueueDrag(event, task)}
                  onDragEnd={() => {
                    setDraggingQueueTaskId(null);
                    setDropTarget(null);
                  }}
                  className={`cursor-grab rounded-md border px-2 py-2 text-sm active:cursor-grabbing ${tones.borderSoft} ${
                    draggingQueueTaskId === task.id ? "opacity-40" : ""
                  }`}
                >
                  <p className={tones.textStrong}>{task.task}</p>
                  <p className={`mt-1 text-xs ${tones.textSubtle}`}>{task.span} block{task.span > 1 ? "s" : ""}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
      <Button
        isIconOnly
        radius="full"
        aria-label={isQueueOpen ? "close queue" : "open queue"}
        className={`fixed bottom-4 right-4 z-[96] h-12 w-12 text-xl shadow-lg ${tones.border} ${tones.baseSurface} ${tones.textStrong}`}
        onPress={() => setIsQueueOpen((prev) => !prev)}
      >
        ✦
      </Button>
      <footer className={`mx-auto mt-3 flex max-w-[1600px] flex-col gap-2 px-1 pb-2 text-xs sm:flex-row sm:items-center sm:justify-between ${tones.textSubtle}`}>
        <div className="flex items-center gap-3">
          <span>any questions?</span>
          <Link href="mailto:elliskim0114@gmail.com" isExternal aria-label="email" className={tones.textSubtle}>
            <FaEnvelope className="text-sm" />
          </Link>
          <Link href="https://www.linkedin.com/in/elliskim0114" isExternal aria-label="linkedin" className={tones.textSubtle}>
            <FaLinkedin className="text-sm" />
          </Link>
          <Link href="https://substack.com/@elliskim0114" isExternal aria-label="substack" className={tones.textSubtle}>
            <SiSubstack className="text-sm" />
          </Link>
          <Link href="https://x.com/elliskim0114" isExternal aria-label="x" className={tones.textSubtle}>
            <FaXTwitter className="text-sm" />
          </Link>
        </div>
        <div className="text-left sm:text-right">minutely v1.0 • updated march 8, 2026</div>
      </footer>

      <Modal isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="font-[family-name:var(--font-instrument-serif)] text-3xl">planner settings</ModalHeader>
              <ModalBody className="gap-4">
                <Select
                  label="time format"
                  labelPlacement="outside"
                  selectedKeys={new Set([setupTimeFormat])}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as TimeFormat;
                    if (selected) setSetupTimeFormat(selected);
                  }}
                >
                  <SelectItem key="12h">normal time (am/pm)</SelectItem>
                  <SelectItem key="24h">military time</SelectItem>
                </Select>

                <Select
                  label="interval"
                  labelPlacement="outside"
                  selectedKeys={new Set([setupInterval])}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) setSetupInterval(selected);
                  }}
                >
                  {INTERVAL_OPTIONS.map((option) => (
                    <SelectItem key={String(option)}>{`${option} minutes${option === 15 ? " (recommended)" : ""}`}</SelectItem>
                  ))}
                </Select>

                <Select
                  label="week starts on"
                  labelPlacement="outside"
                  selectedKeys={new Set([String(setupWeekStart)])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    setSetupWeekStart(value === "1" ? 1 : 0);
                  }}
                >
                  <SelectItem key="0">sunday</SelectItem>
                  <SelectItem key="1">monday</SelectItem>
                </Select>
                <Select
                  label="theme"
                  labelPlacement="outside"
                  selectedKeys={new Set([setupTheme])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as ThemeName;
                    if (value) setSetupTheme(value);
                  }}
                >
                  {THEME_OPTIONS.map((option) => (
                    <SelectItem key={option}>{THEME_LABELS[option]}</SelectItem>
                  ))}
                </Select>
                <Select
                  label="mobile density"
                  labelPlacement="outside"
                  selectedKeys={new Set([mobileDensity])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as "comfy" | "dense";
                    if (value) setMobileDensity(value);
                  }}
                >
                  <SelectItem key="comfy">comfy</SelectItem>
                  <SelectItem key="dense">dense</SelectItem>
                </Select>

                <Input type="time" label="day starts" labelPlacement="outside" value={setupStartTime} onValueChange={setSetupStartTime} />
                <Input type="time" label="day ends" labelPlacement="outside" value={setupEndTime} onValueChange={setSetupEndTime} />
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={resetAllData}>
                  reset all data
                </Button>
                <Button variant="light" onPress={onClose}>
                  cancel
                </Button>
                <Button className={tones.accentBtn} onPress={() => applySetup(false)}>
                  save settings
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <Modal isOpen={isSyncEmailOpen} onOpenChange={setIsSyncEmailOpen} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="font-[family-name:var(--font-instrument-serif)] text-3xl">cloud sync sign in</ModalHeader>
              <ModalBody>
                <Input
                  type="email"
                  label="email"
                  labelPlacement="outside"
                  value={syncEmail}
                  onValueChange={setSyncEmail}
                  placeholder="you@example.com"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitSyncSignIn();
                    }
                  }}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  cancel
                </Button>
                <Button
                  className={tones.accentBtn}
                  onPress={() => void submitSyncSignIn()}
                  isDisabled={!syncEmail.trim()}
                >
                  send magic link
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <style jsx global>{`
        .topbar-buttons button {
          justify-content: center !important;
          text-align: center !important;
          align-items: center !important;
        }
        .topbar-buttons button [data-slot='content'],
        .topbar-buttons button span {
          display: flex !important;
          width: 100% !important;
          justify-content: center !important;
          align-items: center !important;
          text-align: center !important;
          line-height: 1 !important;
        }
      `}</style>

    </main>
  );
}
