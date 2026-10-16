export async function onRequestPost({ request, env }) {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  try {
    if (!env.GEMINI_API_KEY) return new Response(JSON.stringify({error:"सर्वर पर GEMINI_API_KEY सेट नहीं है।"}),{status:503,headers});
    const body = await request.json();
    const message = String(body.message || "").trim();
    if (!message && !body.fileData) return new Response(JSON.stringify({error:"सवाल लिखें या फाइल चुनें।"}),{status:400,headers});
    if (message.length > 8000) return new Response(JSON.stringify({error:"सवाल बहुत लंबा है।"}),{status:413,headers});
    if (body.fileData) {
      if (!["application/pdf","image/jpeg","image/png","image/webp","image/gif"].includes(body.mimeType)) return new Response(JSON.stringify({error:"इस डेमो में PDF, JPEG, PNG, WEBP या GIF फाइल चुनें।"}),{status:415,headers});
      if (body.fileData.length > 14_000_000) return new Response(JSON.stringify({error:"फाइल बहुत बड़ी है। कृपया 10 MB से छोटी फाइल चुनें।"}),{status:413,headers});
    }
    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    const parts = [{text: message || "इस फाइल का हिंदी में वर्णन और सारांश दीजिए।"}];
    if (body.fileData) parts.push({inlineData:{mimeType:body.mimeType,data:body.fileData}});
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method:"POST", headers:{"Content-Type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
      body:JSON.stringify({
        systemInstruction:{parts:[{text:"आप DAKSH AI नाम के सहायक हैं। सामान्यतः साफ, विनम्र हिंदी में जवाब दें। फोटो/PDF को ध्यान से देखकर या पढ़कर जवाब दें। जो स्पष्ट न हो उसे अनुमान लगाकर तथ्य न बताएं। उपयोगकर्ता की निजी जानकारी अनावश्यक रूप से न दोहराएं।"}]},
        contents:[{role:"user",parts}],
        generationConfig:{temperature:0.6,maxOutputTokens:1400}
      })
    });
    const data=await upstream.json();
    if(!upstream.ok) return new Response(JSON.stringify({error:data.error?.message||"AI सेवा से जवाब नहीं मिला। API key, मॉडल और उपयोग सीमा जाँचें।"}),{status:502,headers});
    const reply=(data.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.text||"").join("\n").trim();
    return new Response(JSON.stringify({reply:reply||"जवाब नहीं मिला; दोबारा कोशिश करें।"}),{status:200,headers});
  } catch { return new Response(JSON.stringify({error:"अनुरोध में समस्या हुई। कृपया दोबारा कोशिश करें।"}),{status:400,headers}); }
}
