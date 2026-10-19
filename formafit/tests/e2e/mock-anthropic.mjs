// Minimal stand-in for the Claude Messages API used by the E2E suite when no real
// ANTHROPIC_API_KEY is configured. It speaks the same streaming (SSE) protocol, builds
// replies only from the candidate references the app sends, and records every request
// at GET /__requests so tests can assert the integration contract.
import http from "node:http";

const port = Number(process.env.MOCK_ANTHROPIC_PORT ?? 4010);
const requests = [];

function refsFrom(prompt, letter) {
  const re = new RegExp(`^(${letter}\\d+) \\| ([^|]+)\\|`, "gm");
  return [...prompt.matchAll(re)].map((m) => ({ ref: m[1], name: m[2].trim() }));
}

function mealPlan(prompt) {
  const days = Number(/Antal dagar: (\d+)/.exec(prompt)?.[1] ?? 1);
  const perDay = Number(/Måltider per dag: (\d+)/.exec(prompt)?.[1] ?? 3);
  const refs = refsFrom(prompt, "F");
  const slots = ["breakfast", "lunch", "dinner", "snack", "snack", "snack"];
  const times = ["07:30", "12:00", "18:00", "15:00", "20:30", "10:00"];
  let k = 0;
  return {
    notes: "Simulerat förslag för automatiska tester.",
    days: Array.from({ length: days }, (_, d) => ({
      day_index: d,
      meals: Array.from({ length: perDay }, (_, m) => ({
        name: `Testmåltid ${d + 1}.${m + 1}`,
        meal_slot: slots[m],
        meal_time: times[m],
        prep_minutes: 15,
        instructions: "Tillaga och servera.",
        ingredients: [0, 1, 2].map(() => ({ ref: refs[k++ % refs.length].ref, grams: 120 })),
      })),
    })),
  };
}

function singleMeal(prompt) {
  const refs = refsFrom(prompt, "F");
  return {
    name: "Ny testmåltid",
    meal_slot: "lunch",
    meal_time: "12:30",
    prep_minutes: 10,
    instructions: "Blanda och servera.",
    ingredients: refs.slice(3, 5).map((r) => ({ ref: r.ref, grams: 150 })),
  };
}

function workout(prompt) {
  const daysPerWeek = Number(/Träningsdagar per vecka: (\d+)/.exec(prompt)?.[1] ?? 3);
  const refs = refsFrom(prompt, "E");
  const days = [];
  let k = 0;
  for (let wd = 1; wd <= 7; wd++) {
    const training = days.filter((d) => !d.is_rest_day).length < daysPerWeek && wd % 2 === 1;
    days.push({
      name: training ? `Pass ${String.fromCharCode(65 + days.filter((d) => !d.is_rest_day).length)}` : "Vila",
      weekday: wd,
      is_rest_day: !training,
      notes: "",
      exercises: training
        ? [0, 1, 2, 3].map((i) => ({
            ref: refs[k++ % refs.length].ref,
            sets: 3,
            rep_min: 8,
            rep_max: 12,
            rest_seconds: i === 0 ? 120 : 90,
            tempo: "",
            superset_group: 0,
            notes: "",
          }))
        : [],
    });
  }
  return {
    name: "Testprogram",
    split_type: "full_body",
    description: "Simulerat program för automatiska tester.",
    progression: "Öka vikten med minsta steget när alla set når övre repgränsen.",
    days,
  };
}

function reply(body) {
  const system = Array.isArray(body.system) ? body.system.map((b) => b.text).join("\n") : String(body.system ?? "");
  const last = body.messages[body.messages.length - 1];
  const prompt = typeof last.content === "string" ? last.content : last.content.map((c) => c.text ?? "").join("");
  if (system.includes("kostplanerare")) {
    return JSON.stringify(prompt.includes("Föreslå EN ny måltid") ? singleMeal(prompt) : mealPlan(prompt));
  }
  if (system.includes("träningsplanerare")) return JSON.stringify(workout(prompt));
  if (system.includes("byta ingredienser")) {
    const refs = [...prompt.matchAll(/^(S\d+) \|/gm)].map((m) => m[1]);
    return JSON.stringify({ choices: refs.slice(0, 2).reverse().map((ref) => ({ ref, reason: "Passar bra i samma typ av rätt." })), note: "Simulerad rangordning." });
  }
  return "Hej! Det här är ett **simulerat** svar från coachen.\n\n- Ät protein till varje måltid\n- Sov gott";
}

function sse(res, text) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "request-id": "req_mock" });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send("message_start", {
    type: "message_start",
    message: { id: "msg_mock", type: "message", role: "assistant", model: "mock", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } },
  });
  send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
  for (let i = 0; i < text.length; i += 40) {
    send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: text.slice(i, i + 40) } });
  }
  send("content_block_stop", { type: "content_block_stop", index: 0 });
  send("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 50 } });
  send("message_stop", { type: "message_stop" });
  res.end();
}

http
  .createServer((req, res) => {
    if (req.method === "GET" && req.url === "/__requests") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(requests));
      return;
    }
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200);
      res.end("ok");
      return;
    }
    if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
      res.writeHead(404);
      res.end();
      return;
    }
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      requests.push({ url: req.url, beta: req.headers["anthropic-beta"] ?? null, body });
      const text = reply(body);
      if (body.stream) return sse(res, text);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: "msg_mock",
          type: "message",
          role: "assistant",
          model: "mock",
          content: [{ type: "text", text }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 50 },
        }),
      );
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`mock anthropic listening on ${port}`));
