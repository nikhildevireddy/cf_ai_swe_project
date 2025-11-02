/// <reference types="@cloudflare/workers-types" />
import type { DurableObjectNamespace, DurableObjectState, KVNamespace, ExecutionContext } from "@cloudflare/workers-types";
// src/worker.ts
export interface Env {
    AI: any;                 // Workers AI binding
    SESSION_DO: DurableObjectNamespace;
    CHAT_KV: KVNamespace;
  }
  
  const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  
  export default {
    async fetch(req: Request, env: Env, ctx: ExecutionContext) {
      const url = new URL(req.url);
  
      if (req.method === "GET" && url.pathname === "/") {
        // Serve the simple chat UI
        return new Response(await env.CHAT_KV.get("index.html", "text"), {
          headers: { "content-type": "text/html; charset=utf-8" }
        });
      }
  
      if (req.method === "POST" && url.pathname === "/api/chat") {
        const { sessionId, message } = await req.json<{sessionId:string; message:string}>();
        if (!sessionId || !message) {
          return new Response(JSON.stringify({ error: "sessionId and message are required" }), { status: 400 });
        }
  
        const id = env.SESSION_DO.idFromName(sessionId);
        const stub = env.SESSION_DO.get(id);
        return stub.fetch("https://do/session/chat", {
          method: "POST",
          body: JSON.stringify({ message }),
          headers: { "content-type": "application/json" }
        });
      }
  
      return new Response("Not found", { status: 404 });
    }
  }
  
  // ---------------- Durable Object ----------------
  
  export class SessionDO {
    state: DurableObjectState;
    env: Env;
  
    constructor(state: DurableObjectState, env: Env) {
      this.state = state;
      this.env = env;
    }
  
    // Persist chat history in DO storage (durable) and mirror to KV as backup.
    private async appendMessage(role: "user" | "assistant", content: string) {
      const history: any[] = (await this.state.storage.get("history")) ?? [];
      history.push({ role, content, ts: Date.now() });
      await this.state.storage.put("history", history);
      // Lightweight backup snapshot in KV (optional)
      await this.env.CHAT_KV.put(`session:${this.state.id.toString()}:history`, JSON.stringify(history));
      return history;
    }
  
    private async getHistory() {
      return (await this.state.storage.get<any[]>("history")) ?? [];
    }
  
    async fetch(req: Request) {
      const url = new URL(req.url);
      if (req.method === "POST" && url.pathname.endsWith("/chat")) {
        const { message } = await req.json<{message:string}>();
        if (!message) return new Response(JSON.stringify({ error: "message required" }), { status: 400 });
  
        // 1) Memory: load conversation history
        const history = await this.getHistory();
  
        // 2) Coordination: create a short system prompt & call Workers AI
        const system = `You are a concise, helpful assistant. Use prior turns if relevant.`;
  
        const messages = [
          { role: "system", content: system },
          ...history.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: message }
        ];
  
        // 3) Call the LLM (Workers AI)
        const result = await this.env.AI.run(MODEL, {
          messages,  // supports function-calling; kept simple here
          stream: false
        });
  
        const reply = result?.response ?? String(result);
  
        // 4) Persist new turns
        await this.appendMessage("user", message);
        await this.appendMessage("assistant", reply);
  
        return new Response(JSON.stringify({ reply }), {
          headers: { "content-type": "application/json" }
        });
      }
  
      if (req.method === "GET" && url.pathname.endsWith("/history")) {
        const history = await this.getHistory();
        return new Response(JSON.stringify({ history }), {
          headers: { "content-type": "application/json" }
        });
      }
  
      return new Response("Not found", { status: 404 });
    }
  }