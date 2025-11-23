export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { imageUrls } = req.body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({ error: "imageUrls array missing" });
    }

    // 1. 모든 이미지 → fetch → buffer → base64 변환
    const imagesBase64 = [];

    for (const url of imageUrls) {
      const cleanUrl = url.startsWith("http") ? url : `https:${url}`;
      const img = await fetch(cleanUrl);

      if (!img.ok) {
        return res.status(400).json({
          error: "Image fetch failed",
          url: cleanUrl,
          status: img.status
        });
      }

      const buffer = await img.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      imagesBase64.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64
        }
      });
    }

    // 2. Gemini Vision API 호출
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            ...imagesBase64,
            {
              text:
                "이 이미지는 중고 명품 사진 목록입니다. 브랜드, 종류, 컨디션, 결함, 종합 코멘트를 아래 JSON 형식으로만 출력하세요.\n```json\n{\n\"brand\":\"\",\n\"product_type\":\"\",\n\"condition\":\"\",\n\"defects\":\"\",\n\"comment\":\"\"\n}\n```"
            }
          ]
        })
      }
    );

    const data = await geminiRes.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "SERVER", detail: e.message });
  }
}
