import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const { imageUrl, imageUrls } = req.body;

    // 1) 단일 이미지
    if (imageUrl) {
      const result = await model.generateContent([
        {
          inlineData: await fetchImageAsBase64(imageUrl)
        },
        "이미지 분석해줘. 브랜드, 제품종류, 상태, 흠결, 코멘트를 JSON으로만 반환해."
      ]);

      return res.status(200).json(result.response.text());
    }

    // 2) 다중 이미지
    if (imageUrls && Array.isArray(imageUrls)) {
      const parts = [];

      for (const url of imageUrls) {
        const base64 = await fetchImageAsBase64(url);
        parts.push({ inlineData: base64 });
      }

      // 프롬프트 추가
      parts.push(
        "여러 장의 이미지를 종합 분석하여 하나의 결과를 JSON으로만 반환해. " +
          "브랜드, 제품종류, 상태, 흠결, 코멘트 포함."
      );

      const result = await model.generateContent(parts);

      return res.status(200).json(result.response.text());
    }

    return res.status(400).json({ error: "imageUrl or imageUrls missing" });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: "Server error", detail: error.message });
  }
}

async function fetchImageAsBase64(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  // Vercel 용 inlineData 구조
  return {
    data: base64,
    mimeType: "image/jpeg",
  };
}
