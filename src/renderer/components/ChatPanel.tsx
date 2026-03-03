import React, { useRef, useEffect, useState } from 'react';
import { PlusCircle, Image, Terminal, ArrowUp, Square } from 'lucide-react';
import { useAppStore } from '../stores/app';
import { MessageItem } from './MessageItem';
import { QuestionCard } from './QuestionCard';
import type { Message, Part, ImagePart, QuestionAnswer } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { compressImage } from '../utils/imageCompressor';

const SLASH_COMMAND_PATTERN = /^\/(\w+)(?:\s+(.*))?$/;

export const ChatPanel: React.FC = () => {
  const {
    currentSession,
    currentWorkspace,
    isStreaming,
    pendingMessageId,
    pendingParts,
    pendingQuestion,
    config,
    skills,
    updateSession,
    startStreaming,
    handleStreamEvent,
    loadSkills,
    setPendingQuestion,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ImagePart[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const rafRef = useRef<number | undefined>(undefined);

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

  useEffect(() => {
    loadSkills();
  }, [loadSkills, currentWorkspace]);

  useEffect(() => {
    const unsubscribe = window.manong.question.onAsk((request) => {
      setPendingQuestion(request);
    });
    return unsubscribe;
  }, [setPendingQuestion]);

  const handleQuestionSubmit = async (answers: QuestionAnswer[]) => {
    if (!pendingQuestion) return;

    await window.manong.question.answer(pendingQuestion.id, answers);

    // Add user's answer as a message
    if (currentSession) {
      const answerText = pendingQuestion.questions.map((q, idx) => {
        return `**${q.header}**: ${answers[idx].join(', ')}`;
      }).join('\n');

      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        parts: [{ type: 'text', text: answerText }],
        createdAt: Date.now(),
      };

      const updatedSession = {
        ...currentSession,
        messages: [...currentSession.messages, userMessage],
        updatedAt: Date.now(),
      };
      updateSession(updatedSession);
    }

    setPendingQuestion(null);
  };

  const handleQuestionSkip = async () => {
    if (!pendingQuestion) return;

    await window.manong.question.skip(pendingQuestion.id);
    setPendingQuestion(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      const compressed = await compressImage(file);
      setAttachments(prev => [...prev, { type: 'image', ...compressed }]);
    }
    e.target.value = '';
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const imageItems = Array.from(e.clipboardData.items)
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    e.preventDefault();
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (file) {
        const compressed = await compressImage(file);
        setAttachments(prev => [...prev, { type: 'image', ...compressed }]);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files)
      .filter(f => f.type.startsWith('image/'));
    for (const file of files) {
      const compressed = await compressImage(file);
      setAttachments(prev => [...prev, { type: 'image', ...compressed }]);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming || !currentSession || !currentWorkspace) return;

    const trimmedInput = input.trim();
    const slashMatch = trimmedInput.match(SLASH_COMMAND_PATTERN);

    if (slashMatch && attachments.length === 0) {
      const [, skillName, args = ''] = slashMatch;
      const skill = skills.find(s => s.name === skillName);

      if (skill) {
        const result = await window.manong.skill.execute(skillName, args);

        if (result.success && result.prompt) {
          const userMessage: Message = {
            id: uuidv4(),
            role: 'user',
            parts: [{ type: 'text', text: `/${skillName}${args ? ' ' + args : ''}` }],
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
            result.prompt,
            providerConfig,
            currentWorkspace.path
          );

          setInput('');
          return;
        }
      }
    }

    const parts: Part[] = [
      ...attachments,
      ...(trimmedInput ? [{ type: 'text' as const, text: trimmedInput }] : []),
    ];

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      parts,
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
      trimmedInput,
      providerConfig,
      currentWorkspace.path,
      attachments,
    );

    setInput('');
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    window.manong.agent.stop();
    useAppStore.getState().stopStreaming();
  };

  if (!currentSession) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-text-secondary">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text-primary mb-4">No Session</h2>
          <p className="mb-4 text-sm">Select a session or create a new one</p>
          <button
            onClick={async () => {
              const session = await window.manong.session.create();
              useAppStore.getState().addSession(session);
            }}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded transition-colors text-sm"
          >
            New Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-background relative" onPaste={handlePaste} onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <div className="max-w-4xl mx-auto pt-8">
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

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Input area - Floating Pill */}
      <div className="absolute bottom-6 left-0 right-0 px-4 pointer-events-none z-10 flex justify-center">
        <div className="w-full max-w-3xl pointer-events-auto">
          {pendingQuestion ? (
            <div className="shadow-2xl rounded-2xl overflow-hidden border border-border backdrop-blur-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 80%, transparent)' }}>
              <QuestionCard
                questions={pendingQuestion.questions}
                onSubmit={handleQuestionSubmit}
                onSkip={handleQuestionSkip}
              />
            </div>
          ) : (
            <div className="shadow-2xl rounded-2xl overflow-hidden border border-border backdrop-blur-2xl flex flex-col transition-all focus-within:border-borderFocus" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 85%, transparent)' }}>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 pt-3">
                  {attachments.map((img, idx) => (
                    <div key={idx} className="relative group/thumb">
                      <img
                        src={`data:${img.mediaType};base64,${img.thumbnailData}`}
                        className="w-14 h-14 object-cover rounded-lg border border-border"
                      />
                      <button
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-surface border border-border rounded-full text-text-secondary hover:text-error flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Manong..."
                className="w-full bg-transparent text-text-primary px-4 pt-4 pb-2 resize-none focus:outline-none disabled:opacity-50 text-[14px] leading-relaxed max-h-60"
                rows={Math.min(10, input.split('\n').length || 1)}
                style={{ minHeight: '56px' }}
                disabled={isStreaming}
              />

              {/* Bottom toolbar */}
              <div className="flex items-center justify-between px-3 pb-3 pt-1">
                {/* Left buttons */}
                <div className="flex items-center gap-1">
                  <button
                    className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover rounded-md transition-colors flex items-center justify-center group"
                    title="Add Context"
                  >
                    <PlusCircle size={16} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover rounded-md transition-colors flex items-center justify-center group"
                    title="Upload Image"
                  >
                    <Image size={16} strokeWidth={1.5} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <button
                    className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover rounded-md transition-colors flex items-center justify-center group"
                    title="Terminal Command"
                  >
                    <Terminal size={16} strokeWidth={1.5} />
                  </button>
                </div>

                {/* Right buttons */}
                <div className="flex items-center gap-2">
                  {isStreaming ? (
                    <>
                      <span className="text-[10px] text-text-secondary font-mono mr-1 hidden sm:inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary streaming-indicator" />
                        Processing...
                      </span>
                      <button
                        onClick={handleStop}
                        className="p-1.5 bg-error text-white rounded-lg hover:bg-error/90 transition-all"
                        title="Stop generation"
                      >
                        <Square size={14} fill="currentColor" strokeWidth={0} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] text-text-secondary font-mono mr-1 hidden sm:inline-block">
                        CTRL + ENTER
                      </span>
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() && attachments.length === 0}
                        className="p-1.5 bg-text-primary text-background rounded-lg hover:opacity-90 disabled:opacity-30 disabled:bg-surface-elevated disabled:text-text-secondary transition-all"
                        title="Send message"
                      >
                        <ArrowUp size={16} strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
