import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../stores/app';
import { MessageItem } from './MessageItem';
import type { Message } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export const ChatPanel: React.FC = () => {
  const {
    currentSession,
    currentWorkspace,
    isStreaming,
    pendingMessageId,
    pendingParts,
    config,
    updateSession,
    startStreaming,
    handleStreamEvent,
  } = useAppStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const rafRef = useRef<number>();

  useEffect(() => {
    // Use requestAnimationFrame to throttle scroll calls
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      if (shouldAutoScrollRef.current && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
      }
    });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [currentSession?.messages, pendingParts]);

  useEffect(() => {
    const unsubscribe = window.manong.agent.onStream((event) => {
      handleStreamEvent(event);
    });
    return unsubscribe;
  }, [handleStreamEvent]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming || !currentSession || !currentWorkspace) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      parts: [{ type: 'text', text: input.trim() }],
      createdAt: Date.now(),
    };

    const updatedSession = {
      ...currentSession,
      messages: [...currentSession.messages, userMessage],
      updatedAt: Date.now(),
    };
    updateSession(updatedSession);

    const providerConfig = config?.providers.find(
      (p) => p.name === config.defaultProvider
    );

    const messageId = uuidv4();
    startStreaming(messageId);

    window.manong.agent.start(
      currentSession.id,
      input.trim(),
      providerConfig,
      currentWorkspace.path
    );

    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!currentSession) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-500">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-zinc-300 mb-4">No Session</h2>
          <p className="mb-4">Select a session or create a new one</p>
          <button
            onClick={async () => {
              const session = await window.manong.session.create();
              useAppStore.getState().addSession(session);
            }}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            New Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-zinc-950">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {currentSession.messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {/* Streaming message */}
        {isStreaming && pendingMessageId && (
          <MessageItem
            message={{
              id: pendingMessageId,
              role: 'assistant',
              parts: pendingParts,
              createdAt: Date.now(),
            }}
            isStreaming
            pendingParts={pendingParts}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-600 disabled:opacity-50"
              rows={1}
              disabled={isStreaming}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="absolute right-2 bottom-2 p-2 text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
};
