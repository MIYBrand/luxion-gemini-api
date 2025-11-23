export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl missing' });
    }

    // 1. 이미지 다운로드 → Buffer 변환
    const img = await fetch(imageUrl);
    if (!img.ok) {
      return res.status(400).json({ error: 'Image fetch failed', status: img.status });
    }
    const arrayBuffer = await img.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // 2. Gemini Vision API 호출
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: base64
                  }
                },
                {
                  text:
                    "이 이미지는 중고 명품 제품입니다. " +
                    "브랜드, 제품 종류, 컨디션을 분석해서 아래 JSON 형식으로만 출력하세요:\n" +
                    `{
                      "brand": "",
                      "category": "",
                      "condition_summary": "",
                      "defects": []
                    }`
                }
              ]
            }
          ]
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(500).json({ error: "Gemini failed", detail: errText });
    }

    const gjson = await geminiRes.json();

    // 3. Gemini 응답에서 텍스트 추출
    let rawText = gjson?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    rawText = rawText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let finalJson = null;
    try {
      finalJson = JSON.parse(rawText);
    } catch (e) {
      return res.status(200).json({
        rawText,
        parsed: null,
        warning: "JSON parse 실패. rawText 확인 필요"
      });
    }

    return res.status(200).json(finalJson);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
