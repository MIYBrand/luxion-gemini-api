export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 🔥 Bubble JSON 파싱 오류 방지용
    let body;
    try {
      body = await req.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON", detail: err.message }),
        { status: 500 }
      );
    }

    const { imageUrl } = body;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl missing" }),
        { status: 400 }
      );
    }

    // 이미지 다운로드 → base64 변환
    const img = await fetch(imageUrl);
    if (!img.ok) {
      return new Response(
        JSON.stringify({ error: "Image fetch failed", status: img.status }),
        { status: 400 }
      );
    }

    const arrayBuffer = await img.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Gemini Vision 요청
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
                  text: "이 이미지는 중고 명품 제품입니다. 브랜드, 제품 종류, 컨디션을 분석해 아래 JSON 형식으로만 출력해줘."
                }
              ]
            }
          ]
        })
      }
    );

    const geminiText = await geminiRes.json();

    return new Response(JSON.stringify(geminiText), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

