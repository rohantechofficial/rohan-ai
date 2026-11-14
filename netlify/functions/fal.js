// ROHAN AI - fal.ai backend proxy (Netlify Function)
const FAL_QUEUE = "https://queue.fal.run";
const MODELS = {
  image: "fal-ai/flux/schnell",
  video: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
};
function json(statusCode, obj) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
exports.handler = async (event) => {
  const key = process.env.FAL_KEY;
  if (!key) return json(500, { error: "FAL_KEY not configured" });
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Invalid JSON" }); }
  const headers = { Authorization: "Key " + key, "Content-Type": "application/json" };
  try {
    if (body.action === "image") {
      const prompt = String(body.prompt || "").slice(0, 1000);
      if (!prompt) return json(400, { error: "Prompt required" });
      const sizes = { "16:9": "landscape_16_9", "9:16": "portrait_16_9", "1:1": "square_hd" };
      const r = await fetch(FAL_QUEUE + "/" + MODELS.image, { method: "POST", headers, body: JSON.stringify({ prompt, image_size: sizes[body.size] || "landscape_16_9", num_images: 1 }) });
      const data = await r.json();
      if (!r.ok) return json(r.status, { error: "fal submit failed", detail: data });
      return json(200, { request_id: data.request_id, status_url: data.status_url, response_url: data.response_url });
    }
    if (body.action === "video") {
      const image_url = String(body.image_url || "");
      if (!image_url.startsWith("http")) return json(400, { error: "image_url required" });
      const duration = body.duration === 10 ? "10" : "5";
      const r = await fetch(FAL_QUEUE + "/" + MODELS.video, { method: "POST", headers, body: JSON.stringify({ prompt: String(body.prompt || "").slice(0, 1000), image_url, duration, aspect_ratio: body.size || "16:9" }) });
      const data = await r.json();
      if (!r.ok) return json(r.status, { error: "fal submit failed", detail: data });
      return json(200, { request_id: data.request_id, status_url: data.status_url, response_url: data.response_url });
    }
    if (body.action === "status") {
      const url = String(body.status_url || "");
      if (!url.startsWith(FAL_QUEUE)) return json(400, { error: "bad status_url" });
      const r = await fetch(url, { headers });
      return json(200, await r.json());
    }
    if (body.action === "result") {
      const url = String(body.response_url || "");
      if (!url.startsWith(FAL_QUEUE)) return json(400, { error: "bad response_url" });
      const r = await fetch(url, { headers });
      const data = await r.json();
      return json(200, { image: (data && data.images && data.images[0] && data.images[0].url) || null, video: (data && data.video && data.video.url) || null, raw: data });
    }
    return json(400, { error: "Unknown action" });
  } catch (e) {
    return json(502, { error: "Backend error", detail: String(e).slice(0, 300) });
  }
};
