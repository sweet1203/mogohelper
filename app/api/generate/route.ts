import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt, buildUserPrompt, buildImageUserPrompt } from '@/lib/claude-prompt';
import type { Subject, EnglishMode } from '@/lib/types';
import type { AIProvider } from '@/lib/ai-provider';

/* ── 이미지 타입 ── */
const IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];
function normalizeMediaType(t: string): ImageMediaType {
  if (t === 'image/heic' || t === 'image/heif') return 'image/jpeg';
  if ((IMAGE_MEDIA_TYPES as readonly string[]).includes(t)) return t as ImageMediaType;
  return 'image/jpeg';
}

/* ── 오류 메시지 정규화 ── */
function friendlyError(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (m.includes('401') || m.toLowerCase().includes('authentication') || m.toLowerCase().includes('invalid api key'))
    return 'API 키가 올바르지 않습니다. 설정에서 확인해주세요.';
  if (m.includes('402') || m.toLowerCase().includes('credit') || m.toLowerCase().includes('quota'))
    return 'API 크레딧이 부족하거나 한도를 초과했습니다.';
  if (m.includes('429') || m.toLowerCase().includes('rate'))
    return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  if (m.includes('529') || m.toLowerCase().includes('overload'))
    return '서버 과부하 상태입니다. 잠시 후 다시 시도해주세요.';
  return m;
}

/* ── JSON 추출 ── */
function extractJson(text: string): unknown | null {
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch { /* noop */ } }
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) { try { return JSON.parse(arr[0]); } catch { /* noop */ } }
  return null;
}

/* ═══════════════════════════════════════════════════════
   프로바이더별 스트리밍 구현
═══════════════════════════════════════════════════════ */

async function* streamClaude(
  systemPrompt: string,
  messages: { role: 'user'; content: string | unknown[] }[],
  apiKey: string,
): AsyncGenerator<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    system: systemPrompt,
    messages: messages as Parameters<typeof client.messages.stream>[0]['messages'],
    stream: true,
  });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

async function* streamOpenAI(
  systemPrompt: string,
  messages: { role: 'user'; content: string | unknown[] }[],
  apiKey: string,
): AsyncGenerator<string> {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey });

  // OpenAI 메시지 포맷 변환 (이미지 포함)
  const oaiMessages: Parameters<typeof client.chat.completions.create>[0]['messages'] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => {
      if (typeof m.content === 'string') return { role: 'user' as const, content: m.content };
      // 이미지 포함 메시지 변환
      const parts = (m.content as Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }>)
        .map(p => {
          if (p.type === 'image' && p.source?.type === 'base64') {
            return {
              type: 'image_url' as const,
              image_url: { url: `data:${p.source.media_type};base64,${p.source.data}` },
            };
          }
          return { type: 'text' as const, text: p.text ?? '' };
        });
      return { role: 'user' as const, content: parts };
    }),
  ];

  const stream = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    messages: oaiMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

async function* streamGemini(
  systemPrompt: string,
  messages: { role: 'user'; content: string | unknown[] }[],
  apiKey: string,
): AsyncGenerator<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: 'gemini-1.5-pro',
    systemInstruction: systemPrompt,
  });

  // Gemini 메시지 포맷 변환
  const parts: GeminiPart[] = [];
  for (const m of messages) {
    if (typeof m.content === 'string') {
      parts.push({ text: m.content });
    } else {
      for (const p of m.content as Array<{ type: string; source?: { media_type: string; data: string }; text?: string }>) {
        if (p.type === 'image' && p.source) {
          parts.push({ inlineData: { mimeType: p.source.media_type, data: p.source.data } });
        } else if (p.text) {
          parts.push({ text: p.text });
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await model.generateContentStream(parts as any);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

/* ═══════════════════════════════════════════════════════
   공통 SSE 스트림 빌더
═══════════════════════════════════════════════════════ */
type MsgContent = string | unknown[];

function buildStreamResponse(
  provider: AIProvider,
  apiKey: string,
  systemPrompt: string,
  messages: { role: 'user'; content: MsgContent }[],
  subject: Subject,
  englishMode: EnglishMode,
  fileName: string,
) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        let fullText = '';
        const send = (data: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        let gen: AsyncGenerator<string>;
        if (provider === 'openai') {
          gen = streamOpenAI(systemPrompt, messages, apiKey);
        } else if (provider === 'gemini') {
          gen = streamGemini(systemPrompt, messages, apiKey);
        } else {
          gen = streamClaude(systemPrompt, messages, apiKey);
        }

        for await (const chunk of gen) {
          fullText += chunk;
          send({ chunk });
        }

        const parsed = extractJson(fullText);
        if (!parsed) { send({ error: 'AI 응답 형식 오류입니다. 다시 시도해주세요.' }); return; }

        if (subject === '수학') {
          send({ done: true, mode: 'math', math: parsed, fileName });
          return;
        }

        if (englishMode === 'variant') {
          const eng = parsed as { variants?: unknown[] };
          const variants = eng.variants ?? (Array.isArray(parsed) ? parsed : []);
          send({ done: true, mode: 'english', englishMode: 'variant', questions: variants, analysis: null, pdfFileName: fileName });
        } else {
          const eng = parsed as { grammar?: unknown[]; vocabulary?: unknown[]; idioms?: unknown[]; passage_summary?: string };
          send({
            done: true, mode: 'english', englishMode: 'analysis', questions: [],
            analysis: {
              grammar: eng.grammar ?? [],
              vocabulary: eng.vocabulary ?? [],
              idioms: eng.idioms ?? [],
              passage_summary: eng.passage_summary ?? '',
            },
            pdfFileName: fileName,
          });
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: friendlyError(err) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
}

/* ═══════════════════════════════════════════════════════
   메인 POST 핸들러
═══════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key') || '';
    const provider = (req.headers.get('x-provider') as AIProvider) || 'claude';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API 키가 없습니다. 설정 페이지에서 API 키를 입력해주세요.' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const subject = formData.get('subject') as Subject;
    const englishMode = (formData.get('englishMode') as EnglishMode | null) ?? 'variant';
    const variantTypes: string[] = JSON.parse((formData.get('variantTypes') as string) || '[]');
    const count = parseInt((formData.get('count') as string) || '3', 10);
    const inputMode = formData.get('inputMode') as 'pdf' | 'image';

    if (!subject) return NextResponse.json({ error: '과목을 선택해주세요.' }, { status: 400 });

    const systemPrompt = buildSystemPrompt(subject, englishMode);
    const SSE_HEADERS = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' };

    /* 이미지 모드 */
    if (inputMode === 'image') {
      const imageFiles: File[] = [];
      for (let i = 0; i < 5; i++) {
        const img = formData.get(`image_${i}`) as File | null;
        if (img) imageFiles.push(img);
      }
      if (!imageFiles.length) return NextResponse.json({ error: '이미지를 업로드해주세요.' }, { status: 400 });

      const imageContents = await Promise.all(
        imageFiles.map(async (file) => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: normalizeMediaType(file.type),
            data: Buffer.from(await file.arrayBuffer()).toString('base64'),
          },
        }))
      );

      const userText = buildImageUserPrompt(variantTypes, count, subject, englishMode);
      const fileName = imageFiles.map(f => f.name).join(', ');
      const messages = [{ role: 'user' as const, content: [...imageContents, { type: 'text', text: userText }] }];

      return new Response(
        buildStreamResponse(provider, apiKey, systemPrompt, messages, subject, englishMode, fileName),
        { headers: SSE_HEADERS }
      );
    }

    /* PDF 모드 */
    const pdfFile = formData.get('pdf') as File | null;
    if (!pdfFile) return NextResponse.json({ error: 'PDF 파일을 업로드해주세요.' }, { status: 400 });

    if (pdfFile.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: `PDF가 ${(pdfFile.size / 1024 / 1024).toFixed(1)}MB로 너무 큽니다. 4MB 이하 또는 이미지 모드를 사용해주세요.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await pdfFile.arrayBuffer());
    let pdfText = '';
    try {
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = (pdfParseModule as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default ?? pdfParseModule;
      pdfText = (await (pdfParse as (b: Buffer) => Promise<{ text: string }>)(buffer)).text;
    } catch {
      return NextResponse.json({ error: 'PDF를 읽을 수 없습니다. 텍스트 PDF인지 확인해주세요.' }, { status: 400 });
    }

    if (!pdfText.trim()) {
      return NextResponse.json(
        { error: 'PDF에서 텍스트를 추출하지 못했습니다. 스캔 이미지 PDF라면 이미지 모드를 사용해주세요.' },
        { status: 400 }
      );
    }

    const userPrompt = buildUserPrompt(pdfText, variantTypes, count, englishMode);
    const messages = [{ role: 'user' as const, content: userPrompt }];

    return new Response(
      buildStreamResponse(provider, apiKey, systemPrompt, messages, subject, englishMode, pdfFile.name),
      { headers: SSE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}
