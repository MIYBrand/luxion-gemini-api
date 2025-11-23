export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  // 🟩 1) Bubble → Vercel 로 들어온 실제 값 완전 로그
  console.log("🔥 Received body from Bubble:", req.body);

  try {
    // imageUrl은 단일 문자열 또는 배열일 수 있음
    let { imageUrl } = req.body;

    // 값이 완전히 없는 경우
    if (!imageUrl) {
      return res.status(400).json({ error: "imageUrl missing" });
    }

    // 하나만 올렸어도 Bubble은 list 형태일 수 있음
    if (Array.isArray(imageUrl)) {
      imageUrl = imageUrl[0]; // 첫 번째 이미지만 사용
    }

    console.log("🔥 Final image URL used:", imageUrl);

    // 🟩 2) 이미지 다운로드 → Buffer 변환
    const img = await fetch(imageUrl);
    if (!img.ok) {
      return res.status(400).json({
        error: "Image fetch failed",
        status: img.status,
      });
    }

    const arrayBuffer = await img.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // 🟩 3) Gemini Vision (2.5 Pro) 요청
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
                    data: base64,
                  },
                },
                {
                  text:
                    "이 이미지를 종합 분석해주세요.\n" +
                    "brand, model_name, product_type, condition, defects 등을 구분해서 " +
                    "JSON 형식으로만 출력하세요.\n",
                },
              ],
            },
          ],
        }),
      }
    );

    const result = await geminiRes.json();

    console.log("🔥 Gemini API Response:", result);

    return res.status(200).json(result);
  } catch (e) {
    console.error("🔥 Server Error:", e);
    return res.status(500).json({ error: "Server error", detail: e.message });
  }
}
