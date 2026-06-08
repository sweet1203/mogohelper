'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Eye, EyeOff, Key, Trash2,
  CheckCircle2, ShieldCheck, Globe, Copy, ClipboardCheck, Bot,
} from 'lucide-react';
import {
  type AIProvider, PROVIDER_INFO,
  getProviderConfig, saveProviderConfig,
  getApiKeyForProvider, clearProviderKey,
} from '@/lib/ai-provider';
import { getAppsScriptUrl, setAppsScriptUrl } from '@/lib/apps-script';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────
   Apps Script 소스 코드 (설정 페이지에 표시용)
────────────────────────────────────────────── */
const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var doc = DocumentApp.create(d.title || '모고헬퍼_문서');
    var body = doc.getBody();

    if (d.subject === '수학' && d.mathAnalysis) {
      writeMath(body, d);
    } else if (d.englishMode === 'analysis' && d.analysis) {
      writeAnalysis(body, d);
    } else {
      writeVariants(body, d);
    }

    doc.saveAndClose();
    return ContentService
      .createTextOutput(JSON.stringify({url: doc.getUrl()}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function writeVariants(body, d) {
  var H1 = DocumentApp.ParagraphHeading.HEADING1;
  var H2 = DocumentApp.ParagraphHeading.HEADING2;
  body.appendParagraph('영어 변형문제').setHeading(H1);
  body.appendParagraph('원본: ' + d.pdfFileName + '  |  ' + d.title);
  body.appendHorizontalRule();

  body.appendParagraph('[ 문  제 ]').setHeading(H1);
  d.questions.forEach(function(q, i) {
    body.appendParagraph((i+1) + '.  [' + q.variant_type + ']').setHeading(H2);
    body.appendParagraph(q.question);
    body.appendParagraph('');
    q.choices.forEach(function(c) { body.appendParagraph('   ' + c); });
    body.appendParagraph('');
    body.appendParagraph('');
  });

  body.appendPageBreak();
  body.appendParagraph('[ 정답 및 해설 ]').setHeading(H1);
  var labels = ['①','②','③','④','⑤'];
  d.questions.forEach(function(q, i) {
    var ans = labels[q.answer - 1] || (q.answer + '번');
    body.appendParagraph((i+1) + '. 정답: ' + ans + '  (' + q.variant_type + ')').setHeading(H2);
    body.appendParagraph('해설: ' + q.explanation);
    if (q.change_summary) body.appendParagraph('변경 포인트: ' + q.change_summary);
    body.appendParagraph('─────────────────────────');
    body.appendParagraph('');
  });
}

function writeAnalysis(body, d) {
  var H1 = DocumentApp.ParagraphHeading.HEADING1;
  var H2 = DocumentApp.ParagraphHeading.HEADING2;
  body.appendParagraph('영어 지문 해설').setHeading(H1);
  body.appendParagraph('원본: ' + d.pdfFileName + '  |  ' + d.title);
  body.appendHorizontalRule();
  var a = d.analysis;
  if (a.grammar && a.grammar.length) {
    body.appendParagraph('📌 중요 문법').setHeading(H2);
    a.grammar.forEach(function(g) {
      body.appendParagraph('▶ ' + g.element);
      body.appendParagraph(g.explanation);
      if (g.example) body.appendParagraph('예: ' + g.example);
      body.appendParagraph('');
    });
  }
  if (a.vocabulary && a.vocabulary.length) {
    body.appendParagraph('📖 핵심 어휘').setHeading(H2);
    a.vocabulary.forEach(function(v) {
      body.appendParagraph(v.word + '  —  ' + v.meaning);
      if (v.example) body.appendParagraph('   ' + v.example);
    });
    body.appendParagraph('');
  }
  if (a.idioms && a.idioms.length) {
    body.appendParagraph('🔖 숙어 & 표현').setHeading(H2);
    a.idioms.forEach(function(id) {
      body.appendParagraph(id.phrase + '  —  ' + id.meaning);
      if (id.usage) body.appendParagraph('   활용: ' + id.usage);
      body.appendParagraph('');
    });
  }
  if (a.passage_summary) {
    body.appendParagraph('📝 지문 해설').setHeading(H2);
    body.appendParagraph(a.passage_summary);
  }
}

function writeMath(body, d) {
  var H1 = DocumentApp.ParagraphHeading.HEADING1;
  var H2 = DocumentApp.ParagraphHeading.HEADING2;
  body.appendParagraph('수학 문제 해설').setHeading(H1);
  body.appendParagraph('원본: ' + d.pdfFileName + '  |  ' + d.title);
  body.appendHorizontalRule();
  var m = d.mathAnalysis;
  if (m.explanation) {
    body.appendParagraph('📐 단계별 풀이').setHeading(H2);
    body.appendParagraph(m.explanation);
    body.appendParagraph('');
  }
  if (m.concepts && m.concepts.length) {
    body.appendParagraph('💡 핵심 개념').setHeading(H2);
    m.concepts.forEach(function(c) {
      body.appendParagraph('▶ ' + c.name);
      body.appendParagraph(c.description);
      body.appendParagraph('');
    });
  }
  if (m.points && m.points.length) {
    body.appendParagraph('🎯 문제 포인트').setHeading(H2);
    m.points.forEach(function(p) {
      body.appendParagraph('▶ ' + p.title);
      body.appendParagraph(p.description);
      body.appendParagraph('');
    });
  }
}`;

const PROVIDERS: AIProvider[] = ['claude', 'openai', 'gemini'];

const PROVIDER_COLORS: Record<AIProvider, string> = {
  claude:  'border-orange-300 bg-orange-50  text-orange-700  data-[active=true]:bg-orange-500  data-[active=true]:text-white data-[active=true]:border-orange-500',
  openai:  'border-green-300  bg-green-50   text-green-700   data-[active=true]:bg-green-500   data-[active=true]:text-white data-[active=true]:border-green-500',
  gemini:  'border-blue-300   bg-blue-50    text-blue-700    data-[active=true]:bg-blue-500    data-[active=true]:text-white data-[active=true]:border-blue-500',
};

export default function SettingsPage() {
  const router = useRouter();

  const [provider, setProvider] = useState<AIProvider>('claude');
  const [keyInputs, setKeyInputs] = useState<Record<AIProvider, string>>({ claude: '', openai: '', gemini: '' });
  const [savedKeys, setSavedKeys] = useState<Record<AIProvider, string>>({ claude: '', openai: '', gemini: '' });
  const [showKey, setShowKey] = useState<Record<AIProvider, boolean>>({ claude: false, openai: false, gemini: false });

  const [scriptInput, setScriptInput] = useState('');
  const [scriptSaved, setScriptSaved] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    const cfg = getProviderConfig();
    setProvider(cfg.provider);
    const loaded = { claude: '', openai: '', gemini: '' } as Record<AIProvider, string>;
    PROVIDERS.forEach(p => { loaded[p] = getApiKeyForProvider(p); });
    setKeyInputs(loaded);
    setSavedKeys({ ...loaded });
    const s = getAppsScriptUrl();
    setScriptInput(s); setScriptSaved(s);
  }, []);

  const handleSaveKey = (p: AIProvider) => {
    const key = keyInputs[p].trim();
    if (!key) { toast.error('API 키를 입력해주세요.'); return; }
    saveProviderConfig(p, key);
    setSavedKeys(prev => ({ ...prev, [p]: key }));
    toast.success(`${PROVIDER_INFO[p].label} API 키가 저장되었습니다.`);
  };

  const handleClearKey = (p: AIProvider) => {
    clearProviderKey(p);
    setKeyInputs(prev => ({ ...prev, [p]: '' }));
    setSavedKeys(prev => ({ ...prev, [p]: '' }));
    // 삭제한 게 현재 provider면 다른 것으로
    if (provider === p) {
      const next = PROVIDERS.find(x => x !== p) ?? 'claude';
      setProvider(next);
      saveProviderConfig(next, savedKeys[next]);
    }
    toast.success('삭제되었습니다.');
  };

  const handleSelectProvider = (p: AIProvider) => {
    setProvider(p);
    saveProviderConfig(p, savedKeys[p]);
    toast.success(`${PROVIDER_INFO[p].label} 로 전환되었습니다.`);
  };

  const handleSaveScript = () => {
    if (!scriptInput.trim()) { toast.error('Apps Script URL을 입력해주세요.'); return; }
    if (!scriptInput.startsWith('https://script.google.com/macros/s/')) {
      toast.error('올바른 Apps Script URL이 아닙니다.'); return;
    }
    setAppsScriptUrl(scriptInput.trim());
    setScriptSaved(scriptInput.trim());
    toast.success('Apps Script URL이 저장되었습니다.');
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2500);
  };

  const maskKey = (k: string) => k ? k.slice(0, 10) + '••••••••' + k.slice(-4) : '';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        {/* 헤더 */}
        <div className="mb-8 flex items-center gap-3">
          <button onClick={() => router.push('/')}
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/80">
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        </div>

        {/* 보안 안내 */}
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-green-50 p-4 text-sm text-green-800">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
          <div>
            <p className="font-semibold">모든 키는 이 기기에만 저장됩니다</p>
            <p className="mt-0.5 text-green-700">API 키는 서버에 저장되지 않으며, 각 요청 시 브라우저에서 직접 전송됩니다.</p>
          </div>
        </div>

        <div className="flex flex-col gap-5">

          {/* ── AI 프로바이더 선택 ── */}
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Bot className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-gray-800">AI 선택</h2>
            </div>
            <p className="mb-4 text-sm text-gray-500">사용할 AI를 선택하고 해당 API 키를 입력하세요.</p>

            {/* 프로바이더 탭 */}
            <div className="mb-5 flex gap-2">
              {PROVIDERS.map(p => (
                <button
                  key={p}
                  data-active={provider === p}
                  onClick={() => handleSelectProvider(p)}
                  className={cn(
                    'flex-1 rounded-xl border-2 py-2.5 text-sm font-semibold transition',
                    PROVIDER_COLORS[p]
                  )}
                >
                  {p === 'claude' ? '🟠 Claude' : p === 'openai' ? '🟢 ChatGPT' : '🔵 Gemini'}
                </button>
              ))}
            </div>

            {/* 선택된 프로바이더의 키 입력 */}
            {PROVIDERS.map(p => (
              <div key={p} className={cn('flex flex-col gap-3', provider !== p && 'hidden')}>
                <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
                  <p className="font-semibold text-gray-700">{PROVIDER_INFO[p].label}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    모델: <code className="rounded bg-gray-200 px-1">{PROVIDER_INFO[p].model}</code>
                  </p>
                </div>

                {savedKeys[p] && (
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3">
                    <Key className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="flex-1 font-mono text-sm text-gray-700 truncate">
                      {showKey[p] ? savedKeys[p] : maskKey(savedKeys[p])}
                    </span>
                    <button onClick={() => setShowKey(prev => ({ ...prev, [p]: !prev[p] }))}
                      className="p-1 text-gray-400 hover:text-gray-600">
                      {showKey[p] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keyInputs[p]}
                    onChange={e => setKeyInputs(prev => ({ ...prev, [p]: e.target.value }))}
                    placeholder={PROVIDER_INFO[p].placeholder}
                    className="h-12 flex-1 rounded-xl border-2 border-gray-200 px-4 font-mono text-sm outline-none focus:border-indigo-400"
                    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  />
                  <button onClick={() => handleSaveKey(p)}
                    className="h-12 rounded-xl bg-indigo-500 px-5 font-bold text-white hover:bg-indigo-600">
                    저장
                  </button>
                  {savedKeys[p] && (
                    <button onClick={() => handleClearKey(p)}
                      className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-red-200 text-red-400 hover:bg-red-50">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>

                {/* API 키 발급 안내 */}
                <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-800">
                  {p === 'claude' && (
                    <ol className="list-decimal pl-4 space-y-0.5">
                      <li><a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="underline">console.anthropic.com</a> 로그인</li>
                      <li>API Keys → Create Key → 복사</li>
                    </ol>
                  )}
                  {p === 'openai' && (
                    <ol className="list-decimal pl-4 space-y-0.5">
                      <li><a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com/api-keys</a> 로그인</li>
                      <li>Create new secret key → 복사</li>
                    </ol>
                  )}
                  {p === 'gemini' && (
                    <ol className="list-decimal pl-4 space-y-0.5">
                      <li><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">aistudio.google.com/app/apikey</a> 로그인</li>
                      <li>Create API key → 복사</li>
                    </ol>
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* ── Apps Script 연동 ── */}
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <Globe className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-bold text-gray-800">구글 문서 자동 저장</h2>
              {scriptSaved && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            </div>
            <p className="mb-4 text-sm text-gray-500">
              설정하면 생성 완료 시 <strong>구글 문서에 자동 저장</strong>됩니다. (로그인 불필요)
            </p>

            <div className="flex flex-col gap-3">
              <input
                type="url"
                value={scriptInput}
                onChange={e => setScriptInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/..."
                className="h-12 w-full rounded-xl border-2 border-gray-200 px-4 font-mono text-sm outline-none focus:border-green-400"
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
              />
              <div className="flex gap-2">
                <button onClick={handleSaveScript}
                  className="flex h-12 flex-1 items-center justify-center rounded-xl bg-green-600 font-bold text-white hover:bg-green-700">
                  저장
                </button>
                {scriptSaved && (
                  <button onClick={() => { setAppsScriptUrl(''); setScriptInput(''); setScriptSaved(''); toast.success('삭제되었습니다.'); }}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-red-200 text-red-400 hover:bg-red-50">
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-900">
              <p className="font-semibold">Apps Script 웹앱 만들기</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-green-800">
                <li><a href="https://script.google.com" target="_blank" rel="noopener noreferrer" className="underline">script.google.com</a> → 새 프로젝트</li>
                <li>아래 코드 전체 복사 후 붙여넣기:</li>
              </ol>
              <div className="relative mt-2">
                <pre className="overflow-x-auto rounded-lg bg-green-100 p-3 pb-10 font-mono text-xs leading-relaxed text-green-900 whitespace-pre max-h-48">{APPS_SCRIPT_CODE}</pre>
                <button
                  onClick={handleCopyCode}
                  className={cn(
                    'absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    codeCopied
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-green-700 hover:bg-green-50 border border-green-300'
                  )}
                >
                  {codeCopied
                    ? <><ClipboardCheck className="h-3.5 w-3.5" />복사됨!</>
                    : <><Copy className="h-3.5 w-3.5" />코드 복사</>}
                </button>
              </div>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-green-800" start={3}>
                <li>배포 → 새 배포 → 웹 앱 선택</li>
                <li>실행 주체: <strong>나</strong>, 액세스: <strong>모든 사용자</strong></li>
                <li>배포 후 생성된 URL을 위 입력란에 붙여넣기</li>
              </ol>
            </div>
          </section>

          {/* 저장 데이터 안내 */}
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-800">저장 데이터</h2>
            <div className="flex flex-col gap-2 text-sm text-gray-600">
              {[
                ['AI API 키', '이 브라우저 localStorage'],
                ['오답노트', '이 브라우저 localStorage'],
                ['문제 보관함', '이 브라우저 localStorage'],
                ['Apps Script URL', '이 브라우저 localStorage'],
              ].map(([label, where]) => (
                <div key={label} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span>{label}</span>
                  <span className="text-xs text-gray-400">{where}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">브라우저 캐시 삭제 시 모든 데이터가 삭제됩니다.</p>
          </section>

        </div>
      </div>
    </main>
  );
}
