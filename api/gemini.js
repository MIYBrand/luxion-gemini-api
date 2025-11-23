export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { imageUrls } = req.body;

    // 1) 파라미터 검증
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({ error: "imageUrls array missing" });
    }

    // 2) 이미지들을 base64로 변환
    const converted = [];
    for (const url of imageUrls) {
      const img = await fetch(url);
      if (!img.ok) {
        return res.status(400).json({
          error: "Image fetch failed",
          url,
          status: img.status,
        });
      }
      const buffer = Buffer.from(await img.arrayBuffer());
      const base64 = buffer.toString("base64");

      converted.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64,
        },
      });
    }

    // 3) Gemini Vision 2.5 API 호출 (multi-image 방식)
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                ...converted,

                {
                  text:
                    "이 이미지들을 종합 분석해주세요. 브랜드, 종류, 컨디션, 불량, 전반 평가를 JSON 형식으로만 출력해주세요.",
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await geminiRes.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({
      error: String(e),
      message: "Server Error",
    });
  }
}
