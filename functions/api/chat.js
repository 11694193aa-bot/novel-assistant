export async function onRequest({ request, env }) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers });

  try {
    const { messages, chapterContent } = await request.json();

    let apiKey = await env.SYNC.get('api_key');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: '请先在 AI 对话页面配置 API Key' }), { status: 400, headers });
    }

    const systemPrompt = chapterContent
      ? `你是一位资深网文编辑。以下是你正在审阅的作品章节：\n---\n${chapterContent.substring(0, 80000)}\n---\n规则：只提问，不修改原文，不批评，不建议。`
      : '你是一位资深网文编辑。规则：只提问，不修改原文，不批评，不建议。';

    if (!messages || messages.length === 0) {
      const userMsg = chapterContent
        ? '请基于以上章节，提出3个值得作者思考的问题。每个问题以"Q: "开头独占一行。'
        : '请提出3个通用网文写作思考问题。每个问题以"Q: "开头独占一行。';

      const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({
          model: 'deepseek-v4-pro',
          max_tokens: 1024,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
        }),
      });
      const data = await resp.json();
      if (data.error || !data.choices) throw new Error(data.error?.message || 'API 错误');
      const text = data.choices[0].message.content;
      const questions = text.split('\n').filter(l => l.trim().startsWith('Q:') || l.trim().startsWith('Q：')).map(l => l.replace(/^Q[：:]\s*/, '').trim());
      return new Response(JSON.stringify({ role: 'assistant', content: text, questions }), { headers });
    }

    // 常规对话
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ];
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        max_tokens: 4096,
        messages: apiMessages,
      }),
    });
    const data = await resp.json();
    if (data.error || !data.choices) throw new Error(data.error?.message || 'API 错误');
    return new Response(JSON.stringify({ role: 'assistant', content: data.choices[0].message.content, questions: [] }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'AI 调用失败: ' + e.message }), { status: 500, headers });
  }
}
