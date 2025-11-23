export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { imageUrl } = req.body;

    if (!imageUrl || typeof imageUrl !== "string") {
      return res.status(400).json({ error: "imageUrl missing or invalid" });
    }

    // ------------------------------------------
    // (1) 이미지 URL 자동 정정 (핵심 해결 코드)
    // ------------------------------------------
    let finalUrl = imageUrl.trim();

    // //i.imgur.com/xxx → https://i.imgur.com/xxx 변환
    if (finalUrl.startsWith("//")) {
      finalUrl = "https:" + finalUrl;
    }

    // https: 빠진 경우 자동 보정
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = "https://" + finalUrl;
    }

    // ------------------------------------------
    // (2) 이미지 다운로드 → Buffer 변환
    // ------------------------------------------
    const img = await fetch(finalUrl);

    if (!img.ok) {
      return res.status(400).json({
        error: "Image fetch failed",
        status: img.status,
        url: finalUrl
      });
    }

    const arrayBuffer = await img.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // ------------------------------------------
    // (3) Gemini Vision API 호출
    // ------------------------------------------
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API}`,
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
                    `이 이미지는 중고 명품 사진입니다.\n` +
                    `브랜드, 제품 종류, 컨디션을 분석해서 아래 JSON 형식으로만 출력하세요:\n\n` +
                    `{
                      "brand": "",
                      "product_type": "",
                      "condition": "",
                      "defects": "",
                      "comment": ""
                    }`
                }
              ]
            }
          ]
        })
      }
    );

    const result = await geminiRes.json();
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      detail: err.message
    });
  }
}
