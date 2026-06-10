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
      ? `你是一个有洞察力的写作伙伴。以下是用户正在写作的章节内容：\n---\n${chapterContent.substring(0, 80000)}\n---\n请基于以上内容进行深度对话，讨论情节发展、人设塑造、文笔技巧等。使用中文回复，语气温暖友善。`
      : '你是一个有洞察力的写作伙伴。帮助作者激发灵感，讨论情节、人设、文笔等。使用中文回复，语气温暖友善。';

    // 无消息历史 → 生成初始问题
    if (!messages || messages.length === 0) {
      const userMsg = chapterContent
        ? '请基于以上章节内容，生成3-5个有深度的问题来激发作者的思考和创作灵感。每个问题单独一行，以"Q: "开头。'
        : '请生成3-5个通用写作思考问题，帮助作者激发灵感。每个问题单独一行，以"Q: "开头。';

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
