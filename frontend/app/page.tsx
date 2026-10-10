"use client";

import {
  MoonIcon,
  SunIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { requestJson as postJson } from "../lib/api";
import { AccountGate, Navigation, AuthForm, AccountProfile, Projects, HelpArticles } from "./workspace-ui";
import { Account } from "../lib/account-api";

const QUESTION_OPTIONS = [
  {
    group: "表达内核",
    question: "你更喜欢发布什么内容？",
    options: ["日常生活记录", "情绪表达/吐槽", "知识干货", "挑战/成长类内容"],
  },
  {
    group: "表达内核",
    question: "你做内容的主要动机是？",
    options: ["记录生活", "表达情绪", "展示能力", "涨粉变现"],
  },
  {
    group: "表达内核",
    question: "你更喜欢哪种视频风格？",
    options: ["真实日常", "情绪共鸣", "结构清晰讲解", "强节奏挑战"],
  },
  {
    group: "表达内核",
    question: "你面对镜头时更像？",
    options: ["自然分享者", "情绪表达者", "讲解型博主", "表现型博主"],
  },
  {
    group: "内容偏好",
    question: "你更在意什么？",
    options: ["真实感", "共鸣感", "专业感", "爆款流量"],
  },
  {
    group: "内容偏好",
    question: "你觉得自己最容易做好什么内容？",
    options: ["生活记录短视频", "情绪故事", "干货总结", "挑战视频"],
  },
  {
    group: "内容偏好",
    question: "你的更新节奏更像？",
    options: ["随缘记录", "情绪驱动", "规律输出", "追热点/冲爆款"],
  },
  {
    group: "内容偏好",
    question: "你最想成为什么类型的博主？",
    options: ["生活博主", "情绪博主", "知识博主", "成长型博主"],
  },
  {
    group: "流量反应",
    question: "看到一个热点突然火了，你通常会？",
    options: ["想想怎么自然带入生活", "先看评论区情绪", "拆解它为什么火", "立刻改成自己的挑战"],
  },
  {
    group: "流量反应",
    question: "哪种评论最容易让你兴奋？",
    options: ["你拍得好真实", "这就是我的心声", "学到了，讲得很清楚", "被你带动想行动了"],
  },
  {
    group: "流量反应",
    question: "拍摄前你更习惯怎么准备？",
    options: ["随手记录现场感", "先找到情绪点", "列出清晰结构", "设计强节奏过程"],
  },
  {
    group: "流量反应",
    question: "一条视频数据不好，你第一反应是？",
    options: ["是不是不够真实", "是不是没击中情绪", "是不是信息不够清楚", "是不是开头不够抓人"],
  },
  {
    group: "人格气质",
    question: "以下哪个创作者角色最像你？",
    options: ["生活观察员", "互联网嘴替", "人间说明书", "行动派队长"],
  },
  {
    group: "人格气质",
    question: "你更喜欢哪种视频开头？",
    options: ["今天发生一件小事", "有没有人和我一样", "三步讲清楚这件事", "我决定挑战一个目标"],
  },
  {
    group: "人格气质",
    question: "你希望粉丝怎么记住你？",
    options: ["真实、不装", "懂我、会说", "靠谱、有用", "自律、有冲劲"],
  },
  {
    group: "人格气质",
    question: "你作为 KOC 最大的优势是？",
    options: ["生活细节敏感", "情绪表达直接", "总结能力强", "行动执行力强"],
  },
];

const ANSWER_KEYS = ["A", "B", "C", "D"];
// Same-origin proxy keeps account cookies and workflow requests on one host.
const API_BASE_URL = "";
const DEFAULT_CONTENT = "我想做适合大学生的效率提升和自我成长内容";
const DEMO_ANSWERS = ["C", "D", "C", "C", "C", "C", "C", "C", "C", "C", "C", "C", "C", "C", "C", "C"];
const DEMO_CONTENT = "我想做大学生日常学习效率、AI 工具使用和自我成长复盘内容，风格要真实但有干货";
const DEMO_DURATION = 75;
const FLOW_STEPS = ["首页", "画像测试", "账号定位", "选题推荐", "脚本生成", "运营策略", "数据复盘"];
const AGENT_TIPS: Record<Stage, string> = {
  landing: "GrowMate 会把 KOC 模糊的创作想法，整理成可执行的增长路径。",
  profile: "正在收集你的表达偏好、内容动机、热点反应和人格气质。",
  positioning: "正在把人格测试结果转译成账号定位、目标受众和起号策略。",
  topics: "正在结合账号定位、平台趋势和历史反馈生成候选选题。",
  script: "正在按照目标时长拆解脚本结构、镜头节奏和互动设计。",
  operate: "正在为选中的内容匹配发布时间、更新节奏和互动话术。",
  review: "正在读取表现数据，识别内容亮点、薄弱环节和下一轮优化方向。",
};

type Stage = "landing" | "profile" | "positioning" | "topics" | "script" | "operate" | "review";
type UtilityPanel = "workspace" | "profile" | "settings" | "help" | "auth" | null;
type ThemeMode = "system" | "light" | "dark";
type GrowthGoal = "custom";

type ManualMetricsInput = {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  follows: number | null;
};

const STAGE_TO_ROUTE: Record<Stage, string> = {
  landing: "/",
  profile: "/profile",
  positioning: "/positioning",
  topics: "/topics",
  script: "/script",
  operate: "/operate",
  review: "/review",
};

const ROUTE_TO_STAGE: Record<string, Stage> = {
  "/": "landing",
  "/profile": "profile",
  "/positioning": "positioning",
  "/topics": "topics",
  "/script": "script",
  "/operate": "operate",
  "/review": "review",
};

const SESSION_STORAGE_KEY = "growmate-demo-state";
const DEFAULT_CUSTOM_GOAL_TEXT = "\u63d0\u5347\u8d26\u53f7\u7684\u7a33\u5b9a\u6da8\u7c89\u6548\u7387";
const CUSTOM_GOAL_CONFIG = {
  id: "custom" as GrowthGoal,
  title: "\u589e\u957f\u76ee\u6807",
  subtitle: "\u5148\u660e\u786e\u8fd9\u4e00\u8f6e\u6700\u60f3\u5b8c\u6210\u7684\u589e\u957f\u7ed3\u679c\uff0cGrowMate \u4f1a\u56f4\u7ed5\u8fd9\u4e2a\u76ee\u6807\u7ed9\u51fa\u540e\u7eed\u5efa\u8bae\u3002",
  metric: "\u4f60\u53ef\u4ee5\u76f4\u63a5\u4fee\u6539\u8fd9\u4e2a\u76ee\u6807\uff0c\u7cfb\u7edf\u4f1a\u4f18\u5148\u56f4\u7ed5\u5b83\u751f\u6210\u5b9a\u4f4d\u3001\u9009\u9898\u3001\u811a\u672c\u548c\u7b56\u7565\u5efa\u8bae\u3002",
};
const SESSION_STORAGE_VERSION = 5;

function subscribeToHydration() { return () => {}; }

function getGoalConfig(goal: GrowthGoal, customGoalText = "") {
  const config = CUSTOM_GOAL_CONFIG;
  const normalizedCustomGoal = customGoalText.trim();
  return {
    ...config,
    title: normalizedCustomGoal || "\u589e\u957f\u76ee\u6807",
    subtitle: normalizedCustomGoal ? `\u5f53\u524d\u76ee\u6807\uff1a${normalizedCustomGoal}` : "\u5148\u5199\u4e0b\u8fd9\u4e00\u8f6e\u6700\u60f3\u4f18\u5148\u5b8c\u6210\u7684\u589e\u957f\u7ed3\u679c\u3002",
    metric: normalizedCustomGoal ? "GrowMate \u4f1a\u4f18\u5148\u56f4\u7ed5\u8fd9\u4e2a\u76ee\u6807\u751f\u6210\u5b9a\u4f4d\u3001\u9009\u9898\u3001\u811a\u672c\u548c\u53d1\u5e03\u7b56\u7565\u5efa\u8bae\u3002" : config.metric,
  };
}

function readSavedState(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey) || window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SESSION_STORAGE_VERSION ||
        (parsed.savedAt && Date.now() - parsed.savedAt > 7 * 86400_000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

type Profile = {
  type: string;
  label: string;
  explanation?: string;
  traits?: string[];
  desired_content: string;
  target_duration: number;
  growth_goal?: string;
};

type Positioning = {
  persona: string;
  account_positioning: string;
  content_style: string;
  target_audience: string;
  persona_tags: string[];
  expression_formats: string[];
  starter_suggestions: string[];
};

type TopicItem = {
  title: string;
  hook: string;
  angle: string;
  heat: number;
  fit: number;
  growth_potential: number;
  reason: string;
  persona_fit?: string;
};

type ScriptResult = {
  session_id?: string;
  graph_trace?: string[];
  title: string;
  target_duration: number;
  estimated_voiceover_seconds?: number;
  voiceover_characters?: number;
  timing_note?: string;
  hook: string;
  summary: string;
  cover_text: string;
  comment_cta: string;
  timeline: Array<{
    stage: string;
    duration: string;
    visual: string;
    voiceover: string;
    action_tip: string;
  }>;
};

type OperatorResult = {
  session_id?: string;
  graph_trace?: string[];
  publish_time: string;
  schedule: string[];
  comment_hooks: string[];
  interaction_tips: string[];
};

type PerformanceResult = {
  session_id?: string;
  graph_trace?: string[];
  source: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  follows: number;
  engagement_rate: number;
};

type DiagnosisResult = {
  session_id?: string;
  graph_trace?: string[];
  diagnosis: {
    problem: string;
    strengths: string[];
    suggestions: string[];
    next_topics: string[];
    evidence?: string[];
    limitations?: string[];
  };
  strategy: {
    content_direction: string[];
    hook_strategy: string;
    avoid: string[];
    next_focus: string;
  };
};

type AnalyzeResponse = {
  session_id?: string;
  graph_trace?: string[];
  profile: Profile;
  positioning: Positioning;
};

export default function Home() {
  return <AccountGate>{(user, onAccountChange) => <HomeContent key={user?.id || "guest"} user={user} onAccountChange={onAccountChange} />}</AccountGate>;
}

function HomeContent({ user, onAccountChange }: { user: Account | null; onAccountChange: (user: Account | null) => void }) {
  const storageKey = user ? `${SESSION_STORAGE_KEY}:${user.id}` : SESSION_STORAGE_KEY;
  const readSavedDemoState = () => readSavedState(storageKey);
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const pathname = usePathname();
  const stage = ROUTE_TO_STAGE[pathname] || "landing";
  const growthGoal: GrowthGoal = "custom";
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const requestController = useRef<AbortController | null>(null);
  const scriptLock = useRef(false);
  const [customGoalText, setCustomGoalText] = useState(() => readSavedDemoState()?.customGoalText || DEFAULT_CUSTOM_GOAL_TEXT);
  const [answers, setAnswers] = useState<string[]>(() => readSavedDemoState()?.answers || Array(QUESTION_OPTIONS.length).fill(""));
  const [desiredContent, setDesiredContent] = useState(() => readSavedDemoState()?.desiredContent || DEFAULT_CONTENT);
  const [targetDuration, setTargetDuration] = useState(() => readSavedDemoState()?.targetDuration || 60);
  const [result, setResult] = useState<AnalyzeResponse | null>(() => readSavedDemoState()?.result || null);
  const [graphTrace, setGraphTrace] = useState<string[]>(() => readSavedDemoState()?.graphTrace || []);
  const [topics, setTopics] = useState<TopicItem[]>(() => readSavedDemoState()?.topics || []);
  const [rejectedTopics, setRejectedTopics] = useState<TopicItem[]>(() => readSavedDemoState()?.rejectedTopics || []);
  const [selectedTopic, setSelectedTopic] = useState<TopicItem | null>(() => readSavedDemoState()?.selectedTopic || null);
  const [scriptResult, setScriptResult] = useState<ScriptResult | null>(() => readSavedDemoState()?.scriptResult || null);
  const [operatorResult, setOperatorResult] = useState<OperatorResult | null>(() => readSavedDemoState()?.operatorResult || null);
  const [performanceResult, setPerformanceResult] = useState<PerformanceResult | null>(() => readSavedDemoState()?.performanceResult || null);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(() => readSavedDemoState()?.diagnosisResult || null);
  const [strategyMemory, setStrategyMemory] = useState<DiagnosisResult["strategy"] | null>(() => readSavedDemoState()?.strategyMemory || readSavedDemoState()?.diagnosisResult?.strategy || null);
  const [performanceMode, setPerformanceMode] = useState<"manual" | "mock">(() => readSavedDemoState()?.performanceMode || "manual");
  const [manualMetrics, setManualMetrics] = useState<ManualMetricsInput>(
    () =>
      readSavedDemoState()?.manualMetrics || {
        views: null,
        likes: null,
        comments: null,
        shares: null,
        follows: null,
      },
  );
  const [loading, setLoading] = useState(false);
  const [topicLoading, setTopicLoading] = useState(false);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [operatorLoading, setOperatorLoading] = useState(false);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [error, setError] = useState("");
  const [topicError, setTopicError] = useState("");
  const [scriptError, setScriptError] = useState("");
  const [operatorError, setOperatorError] = useState("");
  const [performanceError, setPerformanceError] = useState("");
  const [diagnosisError, setDiagnosisError] = useState("");
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanel>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "system";
    }
    return (window.localStorage.getItem("growmate-theme") as ThemeMode | null) || "system";
  });
  const [highContrast, setHighContrast] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("growmate-high-contrast") === "true";
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const progressIndex = useMemo(() => FLOW_STEPS.indexOf(stageName(stage)), [stage]);
  const completionText = useMemo(() => `${answers.filter(Boolean).length}/16 题已完成`, [answers]);
  const agentLogs = useMemo(
    () =>
      graphTrace.length
        ? graphTrace
        : buildAgentLogs(stage, result, topics, selectedTopic, scriptResult, operatorResult, performanceResult, diagnosisResult),
    [graphTrace, stage, result, topics, selectedTopic, scriptResult, operatorResult, performanceResult, diagnosisResult],
  );
  const questionGroups = useMemo(
    () =>
      ["表达内核", "内容偏好", "流量反应", "人格气质"].map((group) => ({
        group,
        items: QUESTION_OPTIONS.map((item, index) => ({ ...item, index })).filter((item) => item.group === group),
      })),
    [],
  );
  const filteredKnowledge = useMemo(() => {
    const items = [
      "如何选择 KOC 起号赛道",
      "如何判断选题是否适合自己",
      "短视频脚本开头怎么写",
      "评论区如何提高转粉率",
      "复盘数据时先看哪些指标",
    ];
    return items.filter((item) => item.includes(searchQuery.trim()));
  }, [searchQuery]);

  useEffect(() => {
    window.localStorage.setItem("growmate-theme", themeMode);
    window.localStorage.setItem("growmate-high-contrast", String(highContrast));
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => { document.documentElement.dataset.theme = themeMode === "system" ? media.matches ? "dark" : "light" : themeMode; };
    applyTheme();
    media.addEventListener("change", applyTheme);
    document.documentElement.dataset.contrast = highContrast ? "high" : "normal";
    return () => media.removeEventListener("change", applyTheme);
  }, [themeMode, highContrast]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        growthGoal,
        customGoalText,
        version: SESSION_STORAGE_VERSION,
        savedAt: Date.now(),
        answers,
        desiredContent,
        targetDuration,
        result,
        topics,
        rejectedTopics,
        selectedTopic,
        scriptResult,
        operatorResult,
        performanceResult,
        diagnosisResult,
        strategyMemory,
        performanceMode,
        manualMetrics,
        graphTrace,
      }),
    );
    window.sessionStorage.removeItem(storageKey);
    } catch { /* Storage may be unavailable in private browser sessions. */ }
  }, [storageKey, growthGoal, customGoalText, answers, desiredContent, targetDuration, result, topics, rejectedTopics, selectedTopic, scriptResult, operatorResult, performanceResult, diagnosisResult, strategyMemory, performanceMode, manualMetrics, graphTrace]);

  useEffect(() => () => requestController.current?.abort(), []);

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  function navigateToStage(nextStage: Stage) {
    startNavigation(() => router.push(STAGE_TO_ROUTE[nextStage]));
  }

  function updateAnswer(questionIndex: number, answer: string) {
    setAnswers((current) => current.map((item, index) => (index === questionIndex ? answer : item)));
  }

  function updateManualMetric(key: keyof ManualMetricsInput, value: number | null) {
    setManualMetrics((current) => ({ ...current, [key]: value }));
    setPerformanceResult(null);
    setDiagnosisResult(null);
  }

  function changePerformanceMode(mode: "manual" | "mock") {
    setPerformanceMode(mode);
    setPerformanceResult(null);
    setDiagnosisResult(null);
    setPerformanceError("");
  }

  function applyDemoKoc() {
    setAnswers(DEMO_ANSWERS);
    setDesiredContent(DEMO_CONTENT);
    setTargetDuration(DEMO_DURATION);
  }

  async function requestJson<T>(path: string, body: unknown): Promise<T> {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    return postJson<T>(API_BASE_URL, path, body, controller.signal);
  }

  function resetAfterProfile() {
    setStrategyMemory(null);
    setTopics([]);
    setRejectedTopics([]);
    setSelectedTopic(null);
    setScriptResult(null);
    setOperatorResult(null);
    setPerformanceResult(null);
    setDiagnosisResult(null);
    setGraphTrace([]);
  }

  function resetAfterTopics() {
    setSelectedTopic(null);
    setScriptResult(null);
    setOperatorResult(null);
    setPerformanceResult(null);
    setDiagnosisResult(null);
    setGraphTrace([]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (answers.some((item) => !item)) {
      setError("请先完成 16 题人格测试后再生成创作画像");
      return;
    }
    if (!customGoalText.trim() || !desiredContent.trim() || !Number.isInteger(targetDuration) || targetDuration < 15 || targetDuration > 3000) {
      setError("请填写增长目标、内容方向，以及 15–3000 秒的整数视频时长。");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    resetAfterProfile();

    try {
      const data = await requestJson<AnalyzeResponse>("/api/profile/analyze", {
        answers,
        desired_content: desiredContent,
        target_duration: Number(targetDuration),
        growth_goal: customGoalText.trim(),
      });
      setResult(data);
      setGraphTrace(data.graph_trace || []);
      navigateToStage("positioning");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "账号定位分析失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateTopics(rejections: TopicItem[] = []) {
    if (!result) {
      return;
    }

    setTopicLoading(true);
    setTopicError("");

    try {
      const data = await requestJson<{ session_id?: string; topics: TopicItem[]; graph_trace?: string[] }>("/api/topic/generate", {
        session_id: result.session_id,
        profile: { ...result.profile, growth_goal: customGoalText.trim() },
        positioning: result.positioning,
        previous_rejections: rejections,
        strategy_memory: strategyMemory || {},
      });
      resetAfterTopics();
      setRejectedTopics(rejections);
      setTopics(data.topics || []);
      setGraphTrace(data.graph_trace || []);
      navigateToStage("topics");
    } catch (generateError) {
      setTopicError(generateError instanceof Error ? generateError.message : "选题生成失败");
    } finally {
      setTopicLoading(false);
    }
  }

  async function handleRegenerateTopics() {
    const nextRejections = [...rejectedTopics, ...topics];
    await handleGenerateTopics(nextRejections);
  }

  async function handleNextRoundTopics() {
    const nextRejections = [...rejectedTopics];
    if (selectedTopic) {
      nextRejections.push(selectedTopic);
    }
    await handleGenerateTopics(nextRejections);
  }

  async function handleGenerateScript(topic: TopicItem) {
    if (!result || scriptLock.current) {
      return;
    }
    scriptLock.current = true;

    setSelectedTopic(topic);
    setScriptLoading(true);
    setScriptError("");
    setScriptResult(null);
    setOperatorResult(null);
    setPerformanceResult(null);
    setDiagnosisResult(null);

    try {
      const data = await requestJson<ScriptResult>("/api/script/generate", {
        session_id: result.session_id,
        profile: { ...result.profile, growth_goal: customGoalText.trim() },
        selected_topic: topic,
      });
      setScriptResult(data);
      setGraphTrace(data.graph_trace || []);
      navigateToStage("script");
    } catch (generateError) {
      setScriptError(generateError instanceof Error ? generateError.message : "脚本生成失败");
    } finally {
      scriptLock.current = false;
      setScriptLoading(false);
    }
  }

  async function handleGenerateOperator() {
    if (!result || !selectedTopic) {
      return;
    }

    setOperatorLoading(true);
    setOperatorError("");
    setOperatorResult(null);

    try {
      const data = await requestJson<OperatorResult>("/api/operator/generate", {
        session_id: result.session_id,
        profile: { ...result.profile, growth_goal: customGoalText.trim() },
        selected_topic: selectedTopic,
      });
      setOperatorResult(data);
      setGraphTrace(data.graph_trace || []);
    } catch (generateError) {
      setOperatorError(generateError instanceof Error ? generateError.message : "运营策略生成失败");
    } finally {
      setOperatorLoading(false);
    }
  }

  async function handleFetchPerformance() {
    if (!result) {
      return;
    }
    if (performanceMode === "manual" && (Object.values(manualMetrics).some((value) => value === null || !Number.isInteger(value) || value < 0) || !manualMetrics.views)) {
      setPerformanceError("请完整填写真实数据：播放量大于 0，其余数据为非负整数；没有互动请填 0。");
      return;
    }

    setPerformanceLoading(true);
    setPerformanceError("");
    setPerformanceResult(null);
    setDiagnosisResult(null);

    try {
      const data = await requestJson<PerformanceResult>("/api/performance/fetch", {
        session_id: result.session_id,
        video_id: null,
        mode: performanceMode,
        manual_metrics: performanceMode === "manual" ? manualMetrics : null,
      });
      setPerformanceResult(data);
      setGraphTrace(data.graph_trace || []);
    } catch (generateError) {
      setPerformanceError(generateError instanceof Error ? generateError.message : "数据获取失败");
    } finally {
      setPerformanceLoading(false);
    }
  }

  async function handleAnalyzeDiagnosis() {
    if (!result || !selectedTopic || !performanceResult) {
      return;
    }

    setDiagnosisLoading(true);
    setDiagnosisError("");
    setDiagnosisResult(null);

    try {
      const data = await requestJson<DiagnosisResult>("/api/diagnosis/analyze", {
        session_id: result.session_id,
        profile: { ...result.profile, growth_goal: customGoalText.trim() },
        selected_topic: selectedTopic,
        performance: performanceResult,
        strategy_memory: strategyMemory || {},
      });
      setDiagnosisResult(data);
      setStrategyMemory(data.strategy);
      setGraphTrace(data.graph_trace || []);
    } catch (generateError) {
      setDiagnosisError(generateError instanceof Error ? generateError.message : "复盘分析失败");
    } finally {
      setDiagnosisLoading(false);
    }
  }

  if (!hydrated) return <main className="min-h-screen bg-[#f8f6f0] p-8 text-slate-600">正在恢复创作进度…</main>;

  const missingPrerequisite = !topicLoading && !isNavigating && stage !== "landing" && stage !== "profile" &&
    (!result || (stage === "script" && !scriptResult) || ((stage === "operate" || stage === "review") && !selectedTopic));

  return (
    <main className={stage === "landing" ? "gm-app gm-landing" : "gm-app gm-workspace"}>
      <TopProgress
        stage={stage}
        user={user}
        completed={[Boolean(result), Boolean(result), topics.length > 0, Boolean(scriptResult), Boolean(operatorResult), Boolean(diagnosisResult)]}
        onNavigate={navigateToStage}
        progressIndex={progressIndex}
        searchQuery={searchQuery}
        notificationsOpen={notificationsOpen}
        onHome={() => navigateToStage("landing")}
        onSearch={setSearchQuery}
        onToggleNotifications={() => setNotificationsOpen((current) => !current)}
        onOpenPanel={setUtilityPanel}
      />
      {utilityPanel ? (
        <UtilityOverlay
          panel={utilityPanel}
          user={user}
          storageKey={storageKey}
          stage={stage}
          onOpenPanel={setUtilityPanel}
          onAccountChange={(account) => { onAccountChange(account); if (account?.id !== user?.id) navigateToStage("landing"); }}
          searchQuery={searchQuery}
          filteredKnowledge={filteredKnowledge}
          themeMode={themeMode}
          highContrast={highContrast}
          onClose={() => setUtilityPanel(null)}
          onSearch={setSearchQuery}
          onThemeChange={setThemeMode}
          onContrastChange={setHighContrast}
        />
      ) : null}

      {missingPrerequisite ? (
        <FullScreenShell eyebrow="继续创作" title="这一步需要先完成前面的内容" subtitle="可以先生成创作画像并选择选题，再继续生成脚本和复盘。">
          <button type="button" onClick={() => navigateToStage(result ? "topics" : "profile")} className="rounded-2xl bg-emerald-700 px-6 py-3 text-white">{result ? "返回选题推荐" : "开始画像测试"}</button>
        </FullScreenShell>
      ) : null}

      {stage === "landing" ? (
        <LandingScreen customGoalText={customGoalText} onCustomGoalChange={(value) => { setCustomGoalText(value); setResult(null); resetAfterProfile(); }} onStart={() => navigateToStage("profile")} />
      ) : null}

      {stage === "profile" ? (
        <FullScreenShell eyebrow="CREATOR PROFILE" title="找到你的表达方式" subtitle="16 道创作偏好问题，为账号定位和内容建议提供依据。不是心理学测评。">
          <form onSubmit={handleSubmit} className="grid gap-6">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={applyDemoKoc}
                className="h-11 rounded-full border border-black/10 bg-[#f2ff87] px-5 text-sm font-bold text-slate-950 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:bg-[#eaff5d]"
              >
                一键体验示例创作者
              </button>
            </div>
            <GoalOverview goal={growthGoal} customGoalText={customGoalText} />
            <div className="grid gap-6">
              {questionGroups.map((group, groupIndex) => (
                <section key={group.group} className="rounded-[2rem] border border-black/10 bg-white/65 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur md:p-5">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-black/10 pb-4">
                    <div>
                      <p className="text-xs font-black tracking-[0.18em] text-emerald-700">{`人格维度 0${groupIndex + 1}`}</p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{group.group}</h2>
                    </div>
                    <span className="rounded-full bg-[#102b26] px-4 py-2 text-xs font-bold text-white">4 题</span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {group.items.map((item) => (
                      <section key={item.question} className="rounded-3xl border border-black/10 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_22px_50px_rgba(15,23,42,0.08)]">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-base font-semibold leading-7">{`${item.index + 1}. ${item.question}`}</h3>
                          <span className="text-xs font-black text-slate-300">{String(item.index + 1).padStart(2, "0")}</span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {item.options.map((option, optionIndex) => {
                            const answerValue = ANSWER_KEYS[optionIndex];
                            const active = answers[item.index] === answerValue;

                            return (
                              <label
                                key={option}
                                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                                  active ? "border-emerald-500 bg-emerald-50 text-slate-950 shadow-[0_10px_24px_rgba(16,185,129,0.12)]" : "border-black/10 bg-white text-slate-600 hover:border-emerald-300"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`question-${item.index}`}
                                  value={answerValue}
                                  checked={active}
                                  onChange={() => updateAnswer(item.index, answerValue)}
                                  className="sr-only"
                                />
                                <span
                                  aria-hidden="true"
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                                    active ? "border-emerald-600 bg-emerald-600" : "border-slate-300 bg-white"
                                  }`}
                                >
                                  <span className={`h-2 w-2 rounded-full ${active ? "bg-white" : "bg-transparent"}`} />
                                </span>
                                <span>{`${answerValue}. ${option}`}</span>
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <section className="grid gap-5 rounded-[2rem] border border-black/10 bg-[#122d28] p-6 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)] lg:grid-cols-[1fr_180px_180px] lg:items-end">
              <div className="grid gap-2">
                <label htmlFor="desiredContent" className="text-sm font-medium text-white/80">
                  你近期最想做什么内容？
                </label>
                <textarea
                  id="desiredContent"
                  value={desiredContent}
                  onChange={(event) => setDesiredContent(event.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/40 focus:border-emerald-300"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="targetDuration" className="text-sm font-medium text-white/80">
                  视频时长（秒）
                </label>
                <input
                  id="targetDuration"
                  type="number"
                  min={15}
                  max={3000}
                  value={targetDuration}
                  onChange={(event) => setTargetDuration(Number(event.target.value))}
                  className="h-12 rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none transition focus:border-emerald-300"
                />
              </div>
              <button type="submit" disabled={loading} className="h-12 rounded-2xl bg-[#e9ff70] px-5 text-sm font-bold text-slate-950 transition hover:bg-[#ddf957] disabled:cursor-not-allowed disabled:bg-white/30">
                {loading ? "分析中..." : "生成创作画像"}
              </button>
            </section>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>{completionText}</span>
              {error ? <span className="text-rose-600">{error}</span> : null}
            </div>
          </form>
        </FullScreenShell>
      ) : null}

      {stage === "positioning" && result ? (
        <FullScreenShell eyebrow="ACCOUNT STRATEGY" title="你的账号定位" subtitle="将创作偏好转化为具体的受众、内容方向与表达策略。">
          <div className="gm-positioning-layout">
            <section className="gm-persona-summary relative overflow-hidden bg-[#102b26] p-7 text-white">
              <div className="absolute right-[-6rem] top-[-6rem] h-64 w-64 rounded-full bg-[#00a870]/25 blur-3xl" />
              <div className="absolute bottom-[-8rem] left-[-7rem] h-72 w-72 rounded-full bg-[#e9ff70]/20 blur-3xl" />
              <div className="relative">
                <p className="text-sm font-bold tracking-[0.22em] text-white/45">GROWMATE PERSONA REPORT</p>
                <h2 className="mt-5 text-3xl font-semibold leading-tight">{result.profile.label}</h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-white/75">{result.profile.explanation || result.positioning.persona}</p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {(result.profile.traits || []).map((trait) => (
                    <span key={trait} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                      {trait}
                    </span>
                  ))}
                </div>
                <div className="mt-8 grid gap-3">
                  <ReportCard title="人格画像" value={personaOneLiner(result.profile.type)} />
                  <ReportCard title="当前风险点" value={personaRisk(result.profile.type)} />
                </div>
              </div>
            </section>
            <section className="gm-document grid gap-4">
              <GoalOverview goal={growthGoal} customGoalText={customGoalText} compact />
              <InfoBlock title="账号定位" value={result.positioning.account_positioning} />
              <InfoBlock title="目标受众" value={result.positioning.target_audience} />
              <InfoBlock title="内容风格" value={result.positioning.content_style} />
              <ChipList title="人设标签" items={result.positioning.persona_tags} />
              <SimpleList title="表达形式建议" items={result.positioning.expression_formats} />
              <SimpleList title="起号建议" items={result.positioning.starter_suggestions} />
              <details className="gm-recommendation"><summary>查看定位补充说明</summary>
                <InfoBlock title="目标优先级" value={deriveAccountStage(result.profile.type, growthGoal, customGoalText)} />
                <InfoBlock title="内容方向判断" value={derivePlatformOpportunity(result.profile.type, growthGoal, customGoalText)} caption="方向建议并非平台实时热度数据。" />
              </details>
              <button
                type="button"
                onClick={() => handleGenerateTopics([])}
                disabled={topicLoading}
                className="h-14 rounded-2xl bg-slate-950 px-6 text-sm font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
              >
                {topicLoading ? "正在生成选题..." : "生成候选选题"}
              </button>
              {topicError ? <p className="text-sm text-rose-600">{topicError}</p> : null}
            </section>
          </div>
        </FullScreenShell>
      ) : null}

      {stage === "topics" && !missingPrerequisite ? (
        <FullScreenShell eyebrow="IDEAS & OPPORTUNITIES" title="找到下一条值得做的内容" subtitle="围绕账号定位与增长目标筛选选题。评分仅供参考，不代表流量预测。">
          <TopicStrategySummary goal={growthGoal} customGoalText={customGoalText} profile={result?.profile || null} selectedTopic={selectedTopic} />
          <div className="gm-topic-list">
            {!topics.length && <div className="gm-empty"><h3>让定位变成具体选题</h3><p>根据当前画像和增长目标，生成本轮候选内容。</p><button type="button" disabled={topicLoading} className="gm-primary" onClick={() => handleGenerateTopics([])}>{topicLoading ? "正在生成选题…" : "生成候选选题"}</button></div>}
            {topics.map((topic) => (
              <TopicCard
                key={topic.title}
                topic={topic}
                profile={result?.profile || null}
                active={selectedTopic?.title === topic.title}
                generatingScript={scriptLoading}
                loading={scriptLoading || topicLoading}
                onSelect={() => handleGenerateScript(topic)}
              />
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRegenerateTopics}
              disabled={topicLoading || scriptLoading || topics.length === 0}
              className="h-12 rounded-2xl border border-black/10 bg-white px-6 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:text-slate-300"
            >
              {topicLoading ? "换题中..." : "重新生成一批"}
            </button>
            {scriptError ? <p className="text-sm text-rose-600">{scriptError}</p> : null}
            {topicError ? <p className="text-sm text-rose-600">{topicError}</p> : null}
          </div>
        </FullScreenShell>
      ) : null}

      {stage === "script" && scriptResult ? (
        <FullScreenShell eyebrow="SCRIPT STUDIO" title="把选题写成可拍的脚本" subtitle={`目标 ${scriptResult.target_duration} 秒 · ${scriptResult.timeline.length} 个段落 · 可复制完整脚本用于拍摄。`}>
          <div className="gm-script-toolbar"><ScriptExport script={scriptResult} /></div>
          <div className="gm-script-layout">
            <section className="gm-script-outline grid content-start gap-4">
              <InfoBlock title="内容标题" value={scriptResult.title} />
              <InfoBlock title="开头钩子" value={scriptResult.hook} />
              <InfoBlock title="封面文案" value={scriptResult.cover_text} />
              <InfoBlock title="互动引导语" value={scriptResult.comment_cta} />
              <InfoBlock title="口播时长估算" value={`${scriptResult.voiceover_characters || 0} 字 / 约 ${scriptResult.estimated_voiceover_seconds || scriptResult.target_duration} 秒`} caption={scriptResult.timing_note || "实际时长受语速、停顿和画面留白影响。"} />
              <button type="button" onClick={() => navigateToStage("operate")} className="h-12 rounded-2xl bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800">
                继续生成发布策略
              </button>
            </section>
            <section className="gm-script-document grid gap-0">
              {scriptResult.timeline.map((item, index) => (
                <TimelineCard key={`${item.stage}-${index}`} item={item} index={index} />
              ))}
            </section>
          </div>
        </FullScreenShell>
      ) : null}

      {stage === "operate" && !missingPrerequisite ? (
        <FullScreenShell eyebrow="PUBLISHING PLAN" title="安排好发布后的下一步" subtitle="生成发布时间、更新节奏与互动建议。当前不支持自动发布。">
          <div className="gm-operation-layout">
            <section className="gm-publish-context bg-[#122d28] p-6 text-white">
              <p className="text-sm text-white/60">当前内容主题</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight">{selectedTopic?.title || "暂未选择选题"}</h2>
              <p className="mt-4 text-sm leading-7 text-white/70">{selectedTopic?.reason}</p>
              <button
                type="button"
                onClick={handleGenerateOperator}
                disabled={operatorLoading}
                className="mt-8 h-12 w-full rounded-2xl bg-[#e9ff70] px-5 text-sm font-bold text-slate-950 transition hover:bg-[#ddf957] disabled:bg-white/30"
              >
                {operatorLoading ? "生成中..." : "生成发布策略"}
              </button>
              {operatorError ? <p className="mt-4 text-sm text-rose-200">{operatorError}</p> : null}
            </section>
            <section className="gm-publish-document grid content-start gap-4">
              {operatorResult ? (
                <>
                  <StrategyExplanationPanel
                    goal={growthGoal}
                    customGoalText={customGoalText}
                    profile={result?.profile || null}
                    topic={selectedTopic}
                    publishTime={operatorResult.publish_time}
                  />
                  <InfoBlock title="建议发布时间" value={operatorResult.publish_time} />
                  <SimpleList title="更新节奏" items={operatorResult.schedule} />
                  <SimpleList title="评论区话术" items={operatorResult.comment_hooks} />
                  <SimpleList title="互动运营建议" items={operatorResult.interaction_tips} />
                  <button type="button" onClick={() => navigateToStage("review")} className="h-12 rounded-2xl bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800">
                    进入数据分析
                  </button>
                </>
              ) : (
                <EmptyPanel text="生成发布策略后，在这里查看发布时间、更新安排与互动建议。" />
              )}
            </section>
          </div>
        </FullScreenShell>
      ) : null}

      {stage === "review" && !missingPrerequisite ? (
        <FullScreenShell eyebrow="PERFORMANCE & LEARNING" title="从数据找到下一轮的方向" subtitle="录入真实数据，或使用明确标注的模拟数据体验复盘。">
          <details className="gm-trace"><summary>查看本轮执行记录</summary><AgentLogPanel logs={agentLogs} /></details>
          <div className="gm-review-layout">
            <section className="gm-review-input grid content-start gap-4">
              <div className="grid gap-3 rounded-[2rem] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
                <p className="text-sm font-bold text-slate-400">选择分析数据来源</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => changePerformanceMode("manual")}
                    disabled={performanceLoading || diagnosisLoading}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      performanceMode === "manual" ? "border-emerald-500 bg-emerald-50" : "border-black/10 bg-white hover:border-emerald-300"
                    }`}
                  >
                    <span className="text-sm font-bold text-slate-900">录入真实内容数据</span>
                    <span className="mt-2 block text-xs leading-5 text-slate-500">适合 KOC 从视频平台后台复制播放、点赞、评论等真实数据。</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => changePerformanceMode("mock")}
                    disabled={performanceLoading || diagnosisLoading}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      performanceMode === "mock" ? "border-emerald-500 bg-emerald-50" : "border-black/10 bg-white hover:border-emerald-300"
                    }`}
                  >
                    <span className="text-sm font-bold text-slate-900">使用模拟演示数据</span>
                    <span className="mt-2 block text-xs leading-5 text-slate-500">适合比赛演示或没有真实账号数据时，快速跑完整复盘流程。</span>
                  </button>
                </div>
                {performanceMode === "manual" ? (
                  <fieldset disabled={performanceLoading || diagnosisLoading} className="grid gap-3 sm:grid-cols-2">
                    <MetricInput label="播放量" value={manualMetrics.views} onChange={(value) => updateManualMetric("views", value)} />
                    <MetricInput label="点赞数" value={manualMetrics.likes} onChange={(value) => updateManualMetric("likes", value)} />
                    <MetricInput label="评论数" value={manualMetrics.comments} onChange={(value) => updateManualMetric("comments", value)} />
                    <MetricInput label="转发数" value={manualMetrics.shares} onChange={(value) => updateManualMetric("shares", value)} />
                    <MetricInput label="涨粉数" value={manualMetrics.follows} onChange={(value) => updateManualMetric("follows", value)} />
                  </fieldset>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleFetchPerformance}
                disabled={performanceLoading || diagnosisLoading}
                className="h-12 rounded-2xl bg-[#0f766e] px-5 text-sm font-bold text-white transition hover:bg-[#115e59] disabled:bg-emerald-300"
              >
                {performanceLoading ? "获取数据中..." : performanceMode === "manual" ? "生成真实数据分析" : "生成模拟数据分析"}
              </button>
              {performanceError ? <p className="text-sm text-rose-600">{performanceError}</p> : null}
              {performanceResult ? <PerformancePanel performance={performanceResult} /> : <EmptyPanel text="录入真实数据，或选择模拟数据体验复盘；模拟结果不代表真实账号表现。" />}
              {performanceResult ? (
                <button
                  type="button"
                  onClick={handleAnalyzeDiagnosis}
                  disabled={diagnosisLoading}
                  className="gm-primary"
                >
                  {diagnosisLoading ? "复盘分析中..." : "生成下一轮优化建议"}
                </button>
              ) : null}
              {diagnosisError ? <p className="text-sm text-rose-600">{diagnosisError}</p> : null}
            </section>
            <section className="gm-review-report">
              {diagnosisResult ? (
                <DiagnosisPanel diagnosis={diagnosisResult} onNextRound={handleNextRoundTopics} loading={topicLoading} />
              ) : (
                <EmptyPanel text="完成复盘后，这里会输出问题、亮点、优化建议和下一轮选题方向。" />
              )}
              {topicError ? <p role="alert" className="mt-4 text-sm text-rose-600">{topicError}</p> : null}
            </section>
          </div>
        </FullScreenShell>
      ) : null}
    </main>
  );
}

function stageName(stage: Stage) {
  const names: Record<Stage, string> = {
    landing: "首页",
    profile: "画像测试",
    positioning: "账号定位",
    topics: "选题推荐",
    script: "脚本生成",
    operate: "运营策略",
    review: "数据复盘",
  };
  return names[stage];
}

function LandingScreen({ customGoalText, onCustomGoalChange, onStart }: {
  customGoalText: string; onCustomGoalChange: (value: string) => void; onStart: () => void;
}) {
  return <section className="gm-home">
    <div className="gm-home-hero">
      <div className="gm-home-story">
        <p className="gm-kicker">A LITTLE DIRECTION. A LOT OF POSSIBILITY.</p>
        <h1>陪你从 0 到 1，<br />让每一步成长都有迹可循。</h1>
        <p className="gm-home-description">不止生成一条文案。GrowMate 从你的创作偏好出发，陪你完成定位、选题、脚本与复盘，把每一轮反馈变成下一次行动。</p>
        <a href="#demo-flow">了解创作流程 <span>↓</span></a>
        <MinimalAgentLine />
      </div>
      <div className="gm-home-plan">
        <p className="gm-kicker">START WITH YOUR GOAL</p>
        <h2>这一轮，你想实现什么？</h2>
        <GoalSelector customGoalText={customGoalText} onCustomGoalChange={onCustomGoalChange} />
        <button type="button" onClick={onStart} className="gm-primary">开始体验 <span>→</span></button>
        <p className="gm-note">无需登录即可体验 · 注册后可保存创作任务</p>
      </div>
    </div>
    <div id="demo-flow" className="gm-home-flow">
      <div className="gm-home-flow-heading"><p className="gm-kicker">CREATE. PUBLISH. LEARN. REPEAT.</p><h2>每一次复盘，<br />都让下一次创作更有把握。</h2></div>
      <div className="gm-flow-grid">{FLOW_STEPS.slice(1).map((step, index) => <div key={step}><span>{String(index + 1).padStart(2, "0")}</span><h3>{step}</h3><p>{flowDescription(step)}</p></div>)}</div>
    </div>
  </section>;
}

function GoalSelector({ customGoalText, onCustomGoalChange }: {
  customGoalText: string; onCustomGoalChange: (value: string) => void;
}) {
  return <label className="gm-home-goal">增长目标
    <textarea value={customGoalText} onChange={event => onCustomGoalChange(event.target.value)} rows={3} maxLength={300}
      placeholder="例如：一个月内建立稳定更新节奏，提高关注转化" />
    <span>可直接修改。后续建议会围绕你的目标展开。</span>
  </label>;
}
function GoalOverview({ goal, customGoalText = "", compact = false }: { goal: GrowthGoal; customGoalText?: string; compact?: boolean }) {
  const config = getGoalConfig(goal, customGoalText);
  return <div className={compact ? "gm-goal-line" : "gm-goal-line gm-goal-wide"}>
    <span>本轮增长目标</span><strong>{config.title}</strong>
    <p>定位、选题与复盘均围绕这一目标展开。</p>
  </div>;
}

function flowDescription(step: string) {
  const descriptions: Record<string, string> = {
    画像测试: "识别创作者的表达方式、内容偏好与增长倾向。",
    账号定位: "结合创作人格与内容目标，生成账号定位与受众策略。",
    选题推荐: "围绕人格与平台机会生成候选内容方向。",
    脚本生成: "按目标时长拆解脚本结构、镜头节奏与互动表达。",
    运营策略: "生成发布时间建议、更新节奏与评论区话术。",
    数据复盘: "结合真实或模拟数据，输出下一轮增长建议。",
  };

  return descriptions[step] || "完成当前增长步骤。";
}

function MinimalAgentLine() {
  return (
    <div className="mx-auto mt-14 grid max-w-4xl gap-4 text-left md:grid-cols-4">
      {["识别创作人格", "发现内容机会", "生成内容方案", "迭代增长策略"].map((item, index) => (
        <div key={item} className="group border-t border-black/10 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-[0.18em] text-slate-400">{String(index + 1).padStart(2, "0")}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#00a870] opacity-40 transition group-hover:opacity-100" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">{item}</p>
        </div>
      ))}
    </div>
  );
}

function TopProgress({
  stage, user, completed, notificationsOpen, onHome, onOpenPanel, onNavigate, onToggleNotifications,
}: {
  stage: Stage; progressIndex: number; searchQuery: string; user: Account | null; completed: boolean[];
  notificationsOpen: boolean; onHome: () => void; onSearch: (value: string) => void;
  onOpenPanel: (panel: UtilityPanel) => void; onNavigate: (stage: Stage) => void; onToggleNotifications: () => void;
}) {
  return <Navigation stage={stage} user={user} completed={completed} notificationsOpen={notificationsOpen}
    onHome={onHome} onPanel={onOpenPanel} onNavigate={(next) => onNavigate(next as Stage)} onNotifications={onToggleNotifications} />;
}

function UtilityOverlay({
  panel,
  user, storageKey, stage, onAccountChange, onOpenPanel,
  searchQuery,
  filteredKnowledge,
  themeMode,
  highContrast,
  onClose,
  onSearch,
  onThemeChange,
  onContrastChange,
}: {
  panel: UtilityPanel;
  user: Account | null; storageKey: string; stage: Stage;
  onAccountChange: (user: Account | null) => void;
  onOpenPanel: (panel: UtilityPanel) => void;
  searchQuery: string;
  filteredKnowledge: string[];
  themeMode: ThemeMode;
  highContrast: boolean;
  onClose: () => void;
  onSearch: (value: string) => void;
  onThemeChange: (value: ThemeMode) => void;
  onContrastChange: (value: boolean) => void;
}) {
  const title =
    panel === "workspace"
      ? "增长工作台"
      : panel === "profile"
        ? "个人资料"
        : panel === "settings"
          ? "设置与偏好"
          : panel === "help"
            ? "帮助与支持"
            : "登录 / 注册";

  const modalRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    return () => { document.body.style.overflow = oldOverflow; previousFocus?.focus(); };
  }, [panel]);

  return (
    <div className="gm-modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onKeyDown={event => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const controls = Array.from(modalRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, summary, a[href]") || []).filter(item => item.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <section ref={modalRef} className="gm-modal">
        <header className="gm-modal-header">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-emerald-700">GrowMate</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭面板" className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white text-slate-500 transition hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="p-6">
          {panel === "workspace" ? <Projects user={user} storageKey={storageKey} stage={stage} onLogin={() => onOpenPanel("auth")} /> : null}
          {panel === "profile" ? <AccountProfile user={user} onChange={onAccountChange} onLogin={() => onOpenPanel("auth")} /> : null}
          {panel === "settings" ? <SettingsPanel themeMode={themeMode} highContrast={highContrast} onThemeChange={onThemeChange} onContrastChange={onContrastChange} /> : null}
          {panel === "help" ? <HelpPanel searchQuery={searchQuery} filteredKnowledge={filteredKnowledge} onSearch={onSearch} /> : null}
          {panel === "auth" ? <AuthForm onAuthenticated={account => { onAccountChange(account); onClose(); }} /> : null}
        </div>
      </section>
    </div>
  );
}


function SettingsPanel({
  themeMode,
  highContrast,
  onThemeChange,
  onContrastChange,
}: {
  themeMode: ThemeMode;
  highContrast: boolean;
  onThemeChange: (value: ThemeMode) => void;
  onContrastChange: (value: boolean) => void;
}) {
  return (
    <div className="grid gap-5">
      <section className="rounded-[2rem] border border-black/10 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold text-slate-950">显示模式</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(["system", "light", "dark"] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onThemeChange(mode)}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                themeMode === mode ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-black/10 bg-white text-slate-600"
              }`}
            >
              {mode === "dark" ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
              {mode === "system" ? "跟随系统" : mode === "light" ? "浅色" : "深色"}
            </button>
          ))}
        </div>
      </section>
      <label className="flex items-center justify-between rounded-[2rem] border border-black/10 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
        <span>
          <span className="block text-sm font-semibold text-slate-950">高对比度模式</span>
          <span className="mt-1 block text-sm text-slate-500">提高文字和边框对比度，兼顾无障碍阅读。</span>
        </span>
        <input type="checkbox" checked={highContrast} onChange={(event) => onContrastChange(event.target.checked)} className="h-5 w-5 accent-emerald-700" />
      </label>
    </div>
  );
}

function HelpPanel({ searchQuery, onSearch }: { searchQuery: string; filteredKnowledge: string[]; onSearch: (value: string) => void }) {
  return <HelpArticles query={searchQuery} onSearch={onSearch} />;
}

function FullScreenShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="gm-page">
      <div className="gm-page-inner">
        <div className="gm-page-heading">
          <p className="gm-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="gm-page-description">{subtitle}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

// Legacy component retained temporarily for rollback safety.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AgentThinking({ stage, trace = [] }: { stage: Stage; trace?: string[] }) {
  const mission = buildAgentMission(stage);
  return (
    <div className="grid gap-4 rounded-[1.5rem] border border-emerald-100 bg-white/75 px-5 py-5 shadow-[0_14px_35px_rgba(15,23,42,0.05)] backdrop-blur">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-xs font-black text-white">
          AI
        </span>
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-emerald-700">GrowMate 智能体正在执行</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{AGENT_TIPS[stage]}</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MissionCard label="当前目标" value={mission.goal} />
        <MissionCard label="已读取信息" value={mission.inputs} />
        <MissionCard label="下一步动作" value={mission.next} />
      </div>
      <GraphRail stage={stage} trace={trace} />
    </div>
  );
}

function GraphRail({ stage, trace }: { stage: Stage; trace: string[] }) {
  const nodes = graphNodesForStage(stage);
  return (
    <div className="grid gap-3 rounded-[1.25rem] border border-black/8 bg-[#f8faf9] px-4 py-4">
      <p className="text-[11px] font-bold tracking-[0.16em] text-emerald-700">LANGGRAPH WORKFLOW</p>
      <div className="flex flex-wrap gap-2">
        {nodes.map((node, index) => (
          <span
            key={node}
            className={`rounded-full px-3 py-2 text-xs font-semibold ${
              index === nodes.length - 1 ? "bg-emerald-600 text-white" : "bg-white text-slate-600"
            }`}
          >
            {node}
          </span>
        ))}
      </div>
      {trace.length ? (
        <div className="grid gap-2">
          {trace.slice(-3).map((item) => (
            <div key={item} className="rounded-2xl bg-white px-3 py-3 text-sm leading-6 text-slate-600">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MissionCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-black/8 bg-[#f8faf9] px-4 py-4">
      <p className="text-[11px] font-bold tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

// Legacy component retained temporarily for rollback safety.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AgentConsole({ stage, trace = [] }: { stage: Stage; trace?: string[] }) {
  const mission = buildAgentMission(stage);
  const nodes = graphNodesForStage(stage);

  return (
    <section className="grid gap-3 rounded-[1.75rem] border border-emerald-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,252,250,0.88))] px-4 py-4 shadow-[0_14px_35px_rgba(15,23,42,0.05)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#0f766e] text-xs font-black text-white shadow-[0_10px_24px_rgba(15,118,110,0.22)]">
            AI
          </span>
          <div>
            <p className="text-[11px] font-black tracking-[0.18em] text-emerald-700">GROWMATE AGENT</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{AGENT_TIPS[stage]}</p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-[11px] font-bold tracking-[0.14em] text-emerald-700">
          LIVE
        </span>
      </div>

      <div className="grid gap-2 lg:grid-cols-[1.1fr_1.1fr_1fr]">
        <div className="rounded-[1.15rem] border border-black/6 bg-white/76 px-4 py-3">
          <p className="text-[11px] font-bold tracking-[0.16em] text-slate-400">当前目标</p>
          <p className="mt-1.5 text-sm leading-6 text-slate-700">{mission.goal}</p>
        </div>
        <div className="rounded-[1.15rem] border border-black/6 bg-white/76 px-4 py-3">
          <p className="text-[11px] font-bold tracking-[0.16em] text-slate-400">已读取信息</p>
          <p className="mt-1.5 text-sm leading-6 text-slate-700">{mission.inputs}</p>
        </div>
        <div className="rounded-[1.15rem] border border-black/6 bg-white/76 px-4 py-3">
          <p className="text-[11px] font-bold tracking-[0.16em] text-slate-400">下一步动作</p>
          <p className="mt-1.5 text-sm leading-6 text-slate-700">{mission.next}</p>
        </div>
      </div>

      <div className="grid gap-2 rounded-[1.35rem] border border-black/6 bg-white/72 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-black tracking-[0.16em] text-emerald-700">AGENT WORKFLOW</p>
          <p className="text-[11px] font-medium text-slate-400">{`${Math.min(trace.length || nodes.length, nodes.length)}/${nodes.length} nodes`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {nodes.map((node, index) => (
            <span
              key={node}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                index === nodes.length - 1 ? "bg-emerald-600 text-white shadow-[0_8px_18px_rgba(16,185,129,0.2)]" : "border border-black/8 bg-[#f8faf9] text-slate-600"
              }`}
            >
              {node}
            </span>
          ))}
        </div>
        {trace.length ? (
          <div className="grid gap-2 lg:grid-cols-3">
            {trace.slice(-3).map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-2xl border border-black/6 bg-[#f8faf9] px-3 py-2.5 text-sm leading-6 text-slate-600">
                {item}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/8 bg-[#fafcfb] px-3 py-3 text-sm text-slate-400">
            智能体正在等待你的输入，完成测试后将开始生成执行轨迹。
          </div>
        )}
      </div>
    </section>
  );
}

function AgentLogPanel({ logs }: { logs: string[] }) {
  return (
    <div className="rounded-[2rem] border border-black/10 bg-white/70 p-5 shadow-[0_14px_35px_rgba(15,23,42,0.05)] backdrop-blur">
      <p className="text-xs font-bold tracking-[0.16em] text-emerald-700">智能体执行日志</p>
      <div className="mt-4 grid gap-3">
        {logs.map((log, index) => (
          <div key={log} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
            <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-black text-emerald-700">{index + 1}</span>
            <span>{log}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopicCard({
  topic,
  profile,
  active,
  generatingScript,
  loading,
  onSelect,
}: {
  topic: TopicItem;
  profile: Profile | null;
  active: boolean;
  generatingScript: boolean;
  loading: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={`gm-topic-row ${active ? "active" : ""}`}>
      <div>
        <h3 className="text-xl font-semibold leading-relaxed">{topic.title}</h3>
        <p className="mt-4 text-sm leading-7 text-slate-600">{topic.hook}</p>
      </div>
      <div className="gm-topic-scores grid grid-cols-3 gap-2 text-center text-xs">
        <Metric label="热度" value={topic.heat} />
        <Metric label="匹配" value={topic.fit} />
        <Metric label="潜力" value={topic.growth_potential} />
      </div>
      <div className="gm-topic-detail grid gap-2 text-sm leading-7 text-slate-700">
        <p>
          <span className="font-semibold">切入角度：</span>
          {topic.angle}
        </p>
        <p>
          <span className="font-semibold">推荐理由：</span>
          {topic.reason}
        </p>
        <p className="text-emerald-900">
          <span className="font-semibold">适配原因：</span>
          {topic.persona_fit || buildPersonaFitReason(profile)}
        </p>
      </div>
      <button type="button" onClick={onSelect} disabled={loading} className="gm-primary gm-topic-action">
        {loading ? generatingScript && active ? "脚本生成中..." : "正在处理，请稍候" : "选择这个选题"}
      </button>
    </article>
  );
}

function TopicStrategySummary({
  goal,
  customGoalText,
  profile,
  selectedTopic,
}: {
  goal: GrowthGoal;
  customGoalText: string;
  profile: Profile | null;
  selectedTopic: TopicItem | null;
}) {
  return (
    <details className="gm-recommendation"><summary>本轮选题依据 · {customGoalText}</summary><div className="grid gap-4 md:grid-cols-3">
      <InfoBlock
        title="推荐逻辑"
        value={deriveTopicRecommendation(profile, goal, customGoalText)}
        caption="这批选题不是单纯追热点，而是围绕人格、人设和当前增长目标做筛选。"
      />
      <InfoBlock
        title="当前优先级"
        value={deriveGoalPriority(goal, customGoalText)}
        caption="先把最影响增长结果的环节做强，再去扩展更多内容方向。"
      />
      <InfoBlock
        title="当前状态"
        value={selectedTopic ? `已锁定选题：${selectedTopic.title}` : "等待从 3 个候选选题里选出最适合当前阶段的一条。"}
        caption="你也可以继续换一批，GrowMate 会记住你拒绝过的方向。"
      />
    </div></details>
  );
}

function ScriptExport({ script }: { script: ScriptResult }) {
  const [message, setMessage] = useState("");
  const text = [script.title, `目标时长：${script.target_duration} 秒`, `封面：${script.cover_text}`, ...script.timeline.map(item => `${item.stage}（${item.duration}）\n画面：${item.visual}\n旁白：${item.voiceover}\n动作：${item.action_tip}`), `互动引导：${script.comment_cta}`].join("\n\n");
  async function copy() {
    try { await navigator.clipboard.writeText(text); setMessage("脚本已复制。"); }
    catch { setMessage("浏览器不允许复制，请下载脚本。"); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "GrowMate-脚本.txt"; link.click(); URL.revokeObjectURL(url);
    setMessage("脚本已下载。");
  }
  return <><button type="button" onClick={copy}>复制完整脚本</button><button type="button" onClick={download}>下载脚本</button><span role="status">{message}</span></>;
}

function TimelineCard({ item, index }: { item: ScriptResult["timeline"][number]; index: number }) {
  return (
    <article className="gm-script-segment">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-bold">{`${index + 1}. ${item.stage}`}</h3>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{item.duration}</span>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-700">
        <span className="font-semibold">画面：</span>
        {item.visual}
      </p>
      <p className="mt-3 text-sm leading-7 text-slate-700">
        <span className="font-semibold">台词/旁白：</span>
        {item.voiceover}
      </p>
      <p className="mt-3 text-sm leading-7 text-slate-700">
        <span className="font-semibold">动作提示：</span>
        {item.action_tip}
      </p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3">
      <p className="text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function ReportCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/8 px-5 py-5">
      <p className="text-xs font-bold tracking-[0.16em] text-white/40">{title}</p>
      <p className="mt-3 text-sm leading-7 text-white/80">{value}</p>
    </div>
  );
}

function personaOneLiner(type: string) {
  const lines: Record<string, string> = {
    life: "你不是在拍生活，而是在帮大家确认：普通日子也值得被看见。",
    emotion: "你像评论区的情绪嘴替，适合把大家说不出口的感受讲出来。",
    knowledge: "你擅长把复杂问题讲清楚，越清晰越容易获得收藏和关注。",
    growth: "你的内容像一个行动按钮，观众看完会想：那我也试试看。",
  };

  return lines[type] || "你有鲜明的表达气质，适合围绕稳定人设持续迭代内容。";
}

function personaRisk(type: string) {
  const risks: Record<string, string> = {
    life: "容易太日常而缺少记忆点，建议每条都加一个明确观察或反差。",
    emotion: "容易情绪很准但结构松散，建议用一个强开头带住节奏。",
    knowledge: "容易太像上课，建议多加真实场景和个人经验。",
    growth: "容易只展示结果，建议拍出失败、调整和复盘过程。",
  };

  return risks[type] || "避免内容方向频繁摇摆，先让粉丝记住一个稳定标签。";
}

function buildPersonaFitReason(profile: Profile | null) {
  if (!profile) {
    return "这个选题能承接你的内容目标，并且适合用短视频方式快速验证受众反馈。";
  }

  const reasons: Record<string, string> = {
    life: "它能从真实生活切片切入，适合你的低距离感表达，也更容易让用户产生“这就是我”的共鸣。",
    emotion: "它有明确情绪钩子，适合你的共鸣表达优势，也容易带动评论区讨论。",
    knowledge: "它能被拆成清晰步骤和实用建议，适合你的结构化表达，更容易获得收藏和关注。",
    growth: "它天然带有行动目标和变化过程，适合你的成长型人设，更容易把观看转化成关注。",
  };

  return reasons[profile.type] || `它和你的“${profile.label}”定位一致，适合继续验证账号的人设记忆点。`;
}

function buildAgentLogs(
  stage: Stage,
  result: AnalyzeResponse | null,
  topics: TopicItem[],
  selectedTopic: TopicItem | null,
  scriptResult: ScriptResult | null,
  operatorResult: OperatorResult | null,
  performanceResult: PerformanceResult | null,
  diagnosisResult: DiagnosisResult | null,
) {
  if (stage === "profile") {
    return ["读取 16 题人格答案", "识别表达偏好、热点反应和内容动机", "等待生成账号画像"];
  }
  if (stage === "positioning") {
    return [`识别出 ${result?.profile.label || "KOC 增长人格"}`, "生成账号定位、目标受众和内容风格", "准备进入选题推荐"];
  }
  if (stage === "topics") {
    return [`已生成 ${topics.length || 3} 个候选选题`, "结合人格类型评估匹配度", "等待 KOC 选择或换一批"];
  }
  if (stage === "script") {
    return [`已选择选题：${selectedTopic?.title || "候选选题"}`, `按 ${scriptResult?.target_duration || "目标"} 秒拆解脚本`, "生成封面文案和评论区引导"];
  }
  if (stage === "operate") {
    return [`围绕选题：${selectedTopic?.title || "当前选题"}`, operatorResult ? "已生成发布时间和互动话术" : "等待生成发布策略", "准备进入数据复盘"];
  }
  if (stage === "review") {
    return [
      performanceResult ? `已读取 ${performanceResult.source === "manual" ? "手动真实数据" : "模拟表现数据"}` : "等待读取表现数据",
      diagnosisResult ? "已识别内容亮点和薄弱环节" : "等待生成 AI 复盘报告",
      "可基于复盘继续生成下一轮选题",
    ];
  }

  return ["等待 KOC 输入任务", "准备启动增长工作流", "输出可执行增长路径"];
}

function buildAgentMission(stage: Stage) {
  const missions: Record<Stage, { goal: string; inputs: string; next: string }> = {
    landing: {
      goal: "明确这一轮增长目标",
      inputs: "产品介绍、目标场景、体验入口",
      next: "进入人格测试和创作目标设置",
    },
    profile: {
      goal: "理解 KOC 的表达风格和创作意图",
      inputs: "16 题测试答案、想做的内容、目标时长",
      next: "生成账号画像和起号建议",
    },
    positioning: {
      goal: "把人格翻译成可执行的人设策略",
      inputs: "人格类型、内容目标、账号阶段",
      next: "输出 3 个候选选题",
    },
    topics: {
      goal: "筛选更适合当前阶段的内容机会",
      inputs: "创作人格、增长目标、已拒绝方向",
      next: "锁定主题并拆解脚本",
    },
    script: {
      goal: "把内容方向变成可以直接拍的脚本",
      inputs: "选题、目标时长、内容风格",
      next: "生成发布与互动策略",
    },
    operate: {
      goal: "提高首发效果和互动承接能力",
      inputs: "脚本结构、选题类型、增长目标",
      next: "进入表现数据分析",
    },
    review: {
      goal: "识别增长瓶颈并推进下一轮优化",
      inputs: "真实/模拟数据、历史策略、当前内容",
      next: "沉淀成长档案并生成下一轮选题",
    },
  };

  return missions[stage];
}

function graphNodesForStage(stage: Stage) {
  const nodes: Record<Stage, string[]> = {
    landing: ["goal_select", "profile_intake"],
    profile: ["profile_score", "profile_positioning"],
    positioning: ["profile_score", "profile_positioning"],
    topics: ["topic_generation", "topic_routing"],
    script: ["script_generation", "script_finalize"],
    operate: ["operator_generation", "strategy_explain"],
    review: ["performance_route", "diagnosis_analysis", "strategy_memory_update", "next_round_topic_generation"],
  };
  return nodes[stage];
}

function deriveAccountStage(personaType: string, goal: GrowthGoal, customGoalText = "") {
  if (goal === "custom") {
    const normalizedCustomGoal = customGoalText.trim();
    return normalizedCustomGoal
      ? `自定义目标阶段：当前所有定位和策略建议都会优先围绕“${normalizedCustomGoal}”展开，再逐步收敛到更稳定的账号路径。`
      : "自定义目标阶段：你可以先明确这一轮最想完成的增长结果，GrowMate 会据此调整后续定位与策略建议。";
  }
  return personaType === "knowledge"
    ? "信任建立期：知识型账号更适合通过系列化内容沉淀信任，再承接关注和后续转化。"
    : "转粉优化期：当前重点不是扩量，而是把已有流量更稳定地转成关注和长期留存。";
}

function derivePlatformOpportunity(personaType: string, goal: GrowthGoal, customGoalText = "") {
  const personaHint =
    personaType === "knowledge"
      ? "当前更适合做结构清晰、收藏价值高的内容。"
      : personaType === "growth"
        ? "当前更适合做能看到变化过程的挑战与复盘内容。"
        : personaType === "emotion"
          ? "当前更适合做有明确情绪钩子的共鸣型表达。"
          : "当前更适合做真实日常里的轻观察和生活切片。";

  const goalHint =
    goal === "custom"
      ? customGoalText.trim()
        ? `当前会优先围绕“${customGoalText.trim()}”筛选更贴近目标的内容机会。`
        : "当前会优先围绕你自定义的增长结果去判断更适合的内容机会。"
      : "当前会先建立清晰标签，比频繁换赛道更重要。";

  return `${personaHint}${goalHint}`;
}

function deriveTopicRecommendation(profile: Profile | null, goal: GrowthGoal, customGoalText = "") {
  const profileHint = profile?.label ? `系统会围绕 ${profile.label} 的表达优势筛选内容切口。` : "系统会先根据创作人格筛选更适配的内容切口。";
  const goalHint =
    goal === "custom"
      ? customGoalText.trim()
        ? `这一轮会优先选择更能服务“${customGoalText.trim()}”的内容方向。`
        : "这一轮会优先选择更能服务你自定义增长目标的内容方向。"
      : "这一轮会优先选择更稳妥、更容易持续输出的内容方向。";
  return `${profileHint}${goalHint}`;
}

function deriveGoalPriority(goal: GrowthGoal, customGoalText = "") {
  if (goal === "custom") {
    return customGoalText.trim()
      ? `这一轮先围绕“${customGoalText.trim()}”集中资源，不把定位、选题和运营动作分散到过多方向。`
      : "这一轮先聚焦你最想实现的增长结果，再决定选题和运营动作的优先级。";
  }
  return "先把最影响增长结果的环节做强，再逐步扩展选题和运营动作。";
}

function explainPublishTime(goal: GrowthGoal, publishTime: string, customGoalText = "") {
  const prefix =
    goal === "custom"
      ? customGoalText.trim()
        ? `当前目标会优先围绕“${customGoalText.trim()}”去选择更容易承接结果的发布时间窗口。`
        : "当前建议会优先考虑你自定义目标更容易被承接的发布时间窗口。"
      : "当前建议优先考虑普通 KOC 可持续执行的发布窗口。";
  return `${prefix} 本轮建议发布时间为 ${publishTime}。`;
}

function explainSchedule(goal: GrowthGoal, customGoalText = "") {
  if (goal === "custom") {
    return customGoalText.trim()
      ? `当前更新节奏会优先服务“${customGoalText.trim()}”，在保证执行稳定性的前提下逐步验证最有效的内容频率。`
      : "当前更新节奏会优先服务你的自定义增长目标，同时保留足够的测试和复盘空间。";
  }
  return "当前节奏以稳定执行和可持续复盘为优先，不追求盲目高频。";
}

function explainStrategyFit(profile: Profile | null, topic: TopicItem | null, goal: GrowthGoal, customGoalText = "") {
  const persona = profile?.label || "当前创作人格";
  const topicTitle = topic?.title || "这条内容";
  const target =
    goal === "custom"
      ? customGoalText.trim() || "你自定义的增长结果"
      : "当前最重要的增长目标";
  return `${topicTitle} 会沿着 ${persona} 的表达优势展开，并优先服务于“${target}”这件事。`;
}

function MetricInput({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold text-slate-400">{label}</span>
      <input
        type="number"
        min={0}
        value={value ?? ""}
        placeholder="请填写真实数据"
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        className="h-11 rounded-2xl border border-black/10 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white"
      />
    </label>
  );
}

function DashboardMetric({ label, value, tone = "light" }: { label: string; value: string; tone?: "light" | "dark" | "green" }) {
  const className =
    tone === "dark"
      ? "bg-slate-950 text-white"
      : tone === "green"
        ? "bg-emerald-50 text-emerald-900"
        : "bg-slate-50 text-slate-950";

  return (
    <div className={`rounded-3xl px-4 py-4 ${className}`}>
      <p className={`text-xs font-bold ${tone === "dark" ? "text-white/45" : "text-slate-400"}`}>{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function InsightBar({ label, value }: { label: string; value: number }) {
  const normalized = Math.min(Math.max(value, 0), 20);
  const width = `${Math.max((normalized / 20) * 100, 6)}%`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
        <span>{label}</span>
        <span>{formatPercent(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-[#0f766e]" style={{ width }} />
      </div>
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100) / 100}%`;
}

function PerformancePanel({ performance }: { performance: PerformanceResult }) {
  const likeRate = performance.views ? (performance.likes / performance.views) * 100 : 0;
  const followRate = performance.views ? (performance.follows / performance.views) * 100 : 0;
  const shareRate = performance.views ? (performance.shares / performance.views) * 100 : 0;
  const sourceText = performance.source === "manual" ? "手动真实数据" : performance.source === "mock" ? "模拟演示数据" : "平台接口数据";

  return (
    <div className="grid gap-4 rounded-[2rem] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-400">表现数据看板</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">{sourceText}</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          互动率 {formatPercent(performance.engagement_rate * 100)}
        </span>
      </div>
      <div className="gm-metric-grid grid grid-cols-3 gap-3">
        <DashboardMetric label="播放" value={performance.views.toLocaleString()} tone="dark" />
        <DashboardMetric label="涨粉" value={performance.follows.toLocaleString()} tone="green" />
        <DashboardMetric label="点赞" value={performance.likes.toLocaleString()} />
        <DashboardMetric label="评论" value={performance.comments.toLocaleString()} />
        <DashboardMetric label="转发" value={performance.shares.toLocaleString()} />
        <DashboardMetric label="转粉率" value={formatPercent(followRate)} tone="green" />
      </div>
      <div className="grid gap-3 rounded-3xl bg-slate-50 p-4">
        <p className="text-xs font-bold tracking-[0.16em] text-slate-400">数据比率（以播放量为分母）</p>
        <div className="grid gap-3">
          <InsightBar label="点赞吸引力" value={likeRate} />
          <InsightBar label="转发传播力" value={shareRate} />
          <InsightBar label="关注转化力" value={followRate} />
        </div>
      </div>
    </div>
  );
}

function StrategyExplanationPanel({
  goal,
  customGoalText,
  profile,
  topic,
  publishTime,
}: {
  goal: GrowthGoal;
  customGoalText: string;
  profile: Profile | null;
  topic: TopicItem | null;
  publishTime: string;
}) {
  return (
    <div className="grid gap-4 rounded-[2rem] border border-black/10 bg-[#f7fbf9] p-5 shadow-[0_14px_35px_rgba(15,23,42,0.05)] md:grid-cols-3">
      <InfoBlock
        title="为什么是这个时间"
        value={explainPublishTime(goal, publishTime, customGoalText)}
        caption="发布时间建议会优先匹配普通 KOC 的可执行性，而不是理想化的全天候运营。"
      />
      <InfoBlock
        title="为什么是这个节奏"
        value={explainSchedule(goal, customGoalText)}
        caption="GrowMate 更强调可持续更新，避免一开始追求高频导致断更。"
      />
      <InfoBlock
        title="为什么适合这条内容"
        value={explainStrategyFit(profile, topic, goal, customGoalText)}
        caption="策略会同时考虑你的人格气质、内容主题和当前增长目标。"
      />
    </div>
  );
}

function DiagnosisPanel({ diagnosis, onNextRound, loading }: { diagnosis: DiagnosisResult; onNextRound: () => void; loading: boolean }) {
  return (
    <div className="gm-diagnosis-document">
      <div className="relative grid gap-4">
        <div>
          <p className="gm-kicker">REVIEW REPORT</p>
          <h3 className="mt-3 text-2xl font-semibold">下一轮增长复盘</h3>
        </div>
        <InfoBlock title="核心问题" value={diagnosis.diagnosis.problem} />
        {diagnosis.diagnosis.evidence?.length ? <SimpleList title="数据依据" items={diagnosis.diagnosis.evidence} /> : null}
        {diagnosis.diagnosis.limitations?.length ? <SimpleList title="分析边界" items={diagnosis.diagnosis.limitations} /> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <SimpleList title="表现亮点" items={diagnosis.diagnosis.strengths} />
          <SimpleList title="优化建议" items={diagnosis.diagnosis.suggestions} />
        </div>
        <InfoBlock title="下一轮重点" value={diagnosis.strategy.next_focus} />
        <InfoBlock title="钩子策略" value={diagnosis.strategy.hook_strategy} />
        <SimpleList title="下一轮选题方向" items={diagnosis.diagnosis.next_topics} />
        <SimpleList title="下次避免" items={diagnosis.strategy.avoid} />
        <button
          type="button"
          onClick={onNextRound}
          disabled={loading}
          className="gm-primary"
        >
          {loading ? "正在生成下一轮选题..." : "基于复盘继续生成选题"}
        </button>
      </div>
    </div>
  );
}


function InfoBlock({ title, value, caption, dark = false }: { title: string; value: string; caption?: string; dark?: boolean }) {
  return (
    <div className={`gm-info grid gap-2 ${dark ? "gm-info-dark" : ""}`}>
      <p className={`text-xs font-bold tracking-[0.16em] ${dark ? "text-white/45" : "text-slate-400"}`}>{title}</p>
      <p className={`text-sm leading-7 ${dark ? "text-white" : "text-slate-700"}`}>{value}</p>
      {caption ? <p className={`text-sm leading-6 ${dark ? "text-white/60" : "text-slate-500"}`}>{caption}</p> : null}
    </div>
  );
}

function ChipList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="gm-info grid gap-3">
      <p className="text-xs font-bold tracking-[0.16em] text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function SimpleList({ title, items, dark = false }: { title: string; items: string[]; dark?: boolean }) {
  return (
    <div className={`gm-info grid gap-3 ${dark ? "gm-info-dark" : ""}`}>
      <p className={`text-xs font-bold tracking-[0.16em] ${dark ? "text-white/45" : "text-slate-400"}`}>{title}</p>
      <ul className={`grid gap-2 text-sm leading-7 ${dark ? "text-white/80" : "text-slate-700"}`}>
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="gm-empty grid min-h-56 place-items-center p-8 text-center text-sm leading-7 text-slate-500">
      {text}
    </div>
  );
}


