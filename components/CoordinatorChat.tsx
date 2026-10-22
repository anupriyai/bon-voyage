"use client";

import { useEffect, useRef, useState } from "react";
import { COORDINATOR } from "@/lib/data";
import { firstName } from "@/lib/engine";
import { fmtDay, fmtTime } from "@/lib/format";
import { coordinatorGreeting, useCase } from "@/lib/store";
import { CloseIcon } from "./Icons";

export default function CoordinatorChat() {
  const { state, chatOpen, chatDraft, closeChat, sendChat } = useCase();
  const [text, setText] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatOpen) {
      setText(chatDraft);
      window.setTimeout(() => area.current?.focus(), 30);
    }
  }, [chatOpen, chatDraft]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [state.chat.length, chatOpen]);

  useEffect(() => {
    if (!chatOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeChat();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, closeChat]);

  if (!chatOpen) return null;

  const greeting = coordinatorGreeting(firstName(state.intake.managerName));
  const messages = state.chat.length ? state.chat : [{ from: "coordinator" as const, text: greeting, at: new Date().toISOString() }];

  const submit = () => {
    sendChat(text);
    setText("");
  };

  return (
    <div className="chat-wrap">
      <button type="button" className="chat-scrim" aria-label="Close chat" onClick={closeChat} />
      <aside className="chat" role="dialog" aria-label={`Chat with ${COORDINATOR.name}`}>
        <header className="chat-head">
          <span className="avatar">{COORDINATOR.initials}</span>
          <div>
            <strong>{COORDINATOR.name}</strong>
            <small>{COORDINATOR.blurb}</small>
          </div>
          <button type="button" className="icon-btn" onClick={closeChat} aria-label="Close chat">
            <CloseIcon width={18} height={18} />
          </button>
        </header>
        <div className="chat-log" ref={log} aria-live="polite">
          {messages.map((m, i) => {
            const d = new Date(m.at);
            return (
              <div key={i} className={`msg msg-${m.from}`}>
                <p>{m.text}</p>
                <small>
                  {fmtDay(d)} · {fmtTime(d)}
                </small>
              </div>
            );
          })}
        </div>
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="sr-only" htmlFor="chat-text">
            Message to {COORDINATOR.name}
          </label>
          <textarea
            id="chat-text"
            ref={area}
            rows={2}
            value={text}
            placeholder="Write a message…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={!text.trim()}>
            Send
          </button>
        </form>
        <p className="chat-note">Prototype — replies are automatic and nothing is sent to a real coordinator.</p>
      </aside>
    </div>
  );
}
