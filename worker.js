export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleChat(request, env) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8"
  };

  try {
    if (!env.GEMINI_API_KEY) {
      return Response.json(
        { error: "सर्वर पर GEMINI_API_KEY सेट नहीं है।" },
        { status: 503, headers }
      );
    }

    const body = await request.json();
    const message = String(body.message || "").trim();

    if (!message && !body.fileData) {
      return Response.json(
        { error: "सवाल लिखें या फाइल चुनें।" },
        { status: 400, headers }
      );
    }

    if (message.length > 8000) {
      return Response.json(
        { error: "सवाल बहुत लंबा है।" },
        { status: 413, headers }
      );
    }

    const parts = [{
      text: message || "इस फाइल का हिंदी में वर्णन और सारांश दीजिए।"
    }];

    if (body.fileData) {
      const allowed = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
      ];

      if (!allowed.includes(body.mimeType)) {
        return Response.json(
          { error: "PDF या समर्थित image फाइल चुनें।" },
          { status: 415, headers }
        );
      }

      if (body.fileData.length > 14000000) {
        return Response.json(
          { error: "फाइल बहुत बड़ी है। छोटी फाइल चुनें।" },
          { status: 413, headers }
        );
      }

      parts.push({
        inlineData: {
          mimeType: body.mimeType,
          data: body.fileData
        }
      });
    }

    const model = env.GEMINI_MODEL || "gemini-2.5-flash";

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "आप DakshGPT AI हैं। साफ और विनम्र हिंदी में जवाब दें। सही जानकारी दें और अनिश्चित होने पर स्पष्ट बताएं।"
            }]
          },
          contents: [{
            role: "user",
            parts
          }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 1400
          }
        })
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      return Response.json(
        {
          error: data.error?.message ||
            "AI सेवा से जवाब नहीं मिला। API key और मॉडल जाँचें।"
        },
        { status: 502, headers }
      );
    }

    const reply = (data.candidates || [])
      .flatMap(c => c.content?.parts || [])
      .map(p => p.text || "")
      .join("\n")
      .trim();

    return Response.json(
      { reply: reply || "जवाब नहीं मिला। दोबारा कोशिश करें।" },
      { headers }
    );
  } catch {
    return Response.json(
      { error: "अनुरोध में समस्या हुई। कृपया दोबारा कोशिश करें।" },
      { status: 400, headers }
    );
  }
}
