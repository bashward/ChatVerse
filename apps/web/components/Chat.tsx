
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sb } from "@/lib/supabase-browser";
import { Button, Input, Textarea } from "@ui/index";
import { toast } from "sonner";

type Message = {
  id:string; channel_id:string; author_id:string;
  parent_message_id:string|null; body:string|null;
  attachments:any[]|null; edited_at:string|null; created_at:string; deleted_at:string|null;
  system_kind: "summary" | "system" | null;
  author?: any;
};

export function Chat({verseId, channelId}:{verseId:string; channelId:string}){
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [typing, setTyping] = useState<string[]>([]);
  const supabase = useMemo(()=>sb(), []);

  useEffect(()=>{
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*, author:profiles(id, display_name, avatar_url)")
        .eq("channel_id", channelId)
        .is("parent_message_id", threadParent ? null : null) // load all, threads filtered client-side
        .order("created_at", { ascending: true });
      setMessages(data as any || []);
      bottomRef.current?.scrollIntoView({ behavior: "instant" as any });
    };
    load();
    const ch = supabase.channel(`msgs-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, (payload:any)=>{
        setMessages(prev=>{
          // naive refresh: merge/replace
          const idx = prev.findIndex(m=>m.id===payload.new?.id);
          if (payload.eventType==="DELETE") return prev.filter(m=>m.id!==payload.old.id);
          if (idx>=0) {
            const copy = [...prev]; copy[idx] = {...copy[idx], ...(payload.new||{})}; return copy;
          }
          return [...prev, payload.new];
        });
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      })
      // presence channel for typing
      .on("presence", { event: "sync" }, () => {})
      .subscribe();

    return ()=>{ supabase.removeChannel(ch); };
  }, [channelId, supabase, threadParent]);

  const send = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Not authenticated");
    const bodyTrim = body.trim();
    if (!bodyTrim) return;
    const local:Message = {
      id: `local-${Math.random()}`, channel_id: channelId, author_id: user.id,
      parent_message_id: threadParent?.id || null, body: bodyTrim, attachments: null,
      edited_at: null, created_at: new Date().toISOString(), deleted_at: null, system_kind: null,
      author: { id: user.id, display_name: user.email }
    };
    setMessages(prev=>[...prev, local]);
    setBody("");
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    const { error } = await supabase.from("messages").insert({
      channel_id: channelId, author_id: user.id, parent_message_id: threadParent?.id || null, body: bodyTrim
    });
    if (error) toast.error(error.message);
  };

  const summarize = async () => {
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: {"content-type":"application/json"},
        body: JSON.stringify({ channelId, threadId: threadParent?.id || null })
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Summary posted");
    } catch (e:any) {
      toast.error(e.message);
    }
  };

  const createRoom = async () => {
    const ttl = 24;
    const name = `room-${new Date().toLocaleTimeString()}`;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Not authenticated");
    const { data, error } = await supabase.from("channels").insert({
      verse_id: verseId, name, kind: "room", ttl_hours: ttl, created_by: user.id
    }).select("*").single();
    if (error) return toast.error(error.message);
    window.location.href = `/v/${verseId}/c/${data.id}`;
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10*1024*1024) return toast.error("Max 10MB");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Not authenticated");
    const path = `${user.id}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from("attachments").upload(path, file);
    if (error) return toast.error(error.message);
    const { data: pub } = await supabase.storage.from("attachments").getPublicUrl(path);
    await supabase.from("messages").insert({ channel_id: channelId, author_id: user.id, attachments: [{ url: pub.publicUrl, name: file.name, size: file.size }] });
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <button className="text-sm text-neutral-400 underline" onClick={()=>setThreadParent(null)}>All</button>
          {threadParent && <div className="text-sm">→ Thread of “{threadParent.body?.slice(0,40)}”</div>}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={createRoom}>/room</Button>
          <Button onClick={summarize}>/summary</Button>
          <label className="px-3 py-2 border border-neutral-700 rounded-md cursor-pointer">
            Upload<input type="file" className="hidden" onChange={upload} />
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages
          .filter(m => (threadParent ? m.parent_message_id === threadParent.id : !m.parent_message_id))
          .map(m => (
          <div key={m.id} className="group">
            <div className="text-sm text-neutral-400">{m.author?.display_name || m.author_id} · {new Date(m.created_at).toLocaleTimeString()}</div>
            <div className="whitespace-pre-wrap">
              {m.system_kind === "summary" ? <div className="bg-indigo-900/20 border border-indigo-800 rounded p-2">{m.body}</div> : (m.body || "")}
              {m.attachments?.map((a:any, idx:number)=>(
                <div key={idx} className="mt-2 text-sm">
                  <a className="underline text-indigo-400" href={a.url} target="_blank">{a.name}</a> ({Math.round((a.size||0)/1024)} KB)
                </div>
              ))}
            </div>
            {!threadParent && (
              <button onClick={()=>setThreadParent(m)} className="opacity-0 group-hover:opacity-100 text-xs text-neutral-400 underline">Open thread</button>
            )}
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>

      <div className="border-t border-neutral-800 p-3 flex items-center gap-2">
        <Textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Message #channel" className="flex-1 h-20" />
        <Button onClick={send}>Send</Button>
      </div>
    </div>
  );
}
