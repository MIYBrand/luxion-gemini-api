export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "POST only" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Body 파싱
    let body;
    try {
      body = await req.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON", detail: err.message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let { imageUrl } = body;

    // 2. 이상한 타입/리스트/빈 값 방어
    if (Array.isArray(imageUrl)) {
      imageUrl = imageUrl[0];
    }

    if (typeof imageUrl !== "string") {
      return new Response(
        JSON.stringify({ error: "imageUrl must be a string", receivedType: typeof imageUrl }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    imageUrl = imageUrl.trim();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl missing" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. 프로토콜 없는 URL 보정 (//cdn... 또는 s3.amazonaws.com/... 같은 케이스)
    if (imageUrl.startsWith("//")) {
      imageUrl = "https:" + imageUrl;
    } else if (!/^https?:\/\//i.test(imageUrl)) {
      // http/https 둘 다 없으면 https로 강제
      imageUrl = "https://" + imageUrl.replace(/^\/+/, "");
    }

    // 4. 이미지 다운로드
    let img;
    try {
      img = await fetch(imageUrl);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Image fetch failed", detail: err.message, fixedUrl: imageUrl }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!img.ok) {
      return new Response(
        JSON.stringify({ error: "Image fetch failed", status: img.status, fixedUrl: imageUrl }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const arrayBuffer = await img.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // 5. Gemini 2.5 Pro 호출
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
                    "이 이미지는 중고 명품 가방입니다. " +
                    "브랜드, 제품명, 제품 종류, 상태(스크래치, 오염, 눌림, 늘어남 등)를 자세히 분석해서 " +
                    "아래 형식의 JSON 한 덩어리로만 반환해 주세요.\n\n" +
                    `{
  "brand": "...",
  "product_type": "...",
  "model_name": "...",
  "condition": "...",
  "defects": ["..."],
  "summary": "..."
}`,
                },
              ],
            },
          ],
        }),
      }
    );

    const geminiJson = await geminiRes.json();

    return new Response(JSON.stringify(geminiJson), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
