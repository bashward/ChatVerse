
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase-browser";

export function Sidebar({verseId}:{verseId:string}){
  const [channels, setChannels] = useState<any[]>([]);

  useEffect(()=>{
    const supabase = sb();
    supabase.from("channels").select("*").eq("verse_id", verseId).order("created_at", { ascending: true })
      .then(({data})=>setChannels(data||[]));
    const ch = supabase.channel("db-channels")
      .on("postgres_changes", { event: "*", schema: "public", table: "channels", filter: `verse_id=eq.${verseId}` }, (payload)=>{
        supabase.from("channels").select("*").eq("verse_id", verseId).order("created_at", { ascending: true })
          .then(({data})=>setChannels(data||[]));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [verseId]);

  return (
    <aside className="w-64 border-r border-neutral-800 p-3 space-y-2">
      <div className="text-sm text-neutral-400 uppercase">Channels</div>
      {channels.map(c=>(
        <Link key={c.id} href={`/v/${verseId}/c/${c.id}`} className="block px-2 py-1 rounded hover:bg-neutral-900">
          {c.kind === "room" ? `🕒 ${c.name}` : `# ${c.name}`}
        </Link>
      ))}
      <div className="mt-3">
        <a className="text-indigo-400 underline text-sm" href={`/v/${verseId}/new-channel`}>+ New Channel</a>
      </div>
    </aside>
  );
}
