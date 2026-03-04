import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Image, ArrowUp, Square, Shield, ShieldCheck, ShieldOff } from 'lucide-react';
import { useAppStore } from '../stores/app';
import { TimelineBlockView } from './TimelineBlockView';
import { QuestionCard } from './QuestionCard';
import { PermissionCard } from './PermissionCard';
import { SlashCommandMenu } from './SlashCommandMenu';
import type { Message, Part, ImagePart, QuestionAnswer, Skill } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { compressImage } from '../utils/imageCompressor';
import { messagesToTimeline } from '../utils/messageGrouping';
import { useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n';

const isMac = window.manong.platform === 'darwin';
const SLASH_COMMAND_PATTERN = /^\/(\w+)(?:\s+(.*))?$/;

export const ChatPanel: React.FC = () => {
  const {
    currentSession,
    currentWorkspace,
    isStreaming,
    pendingMessages,
    streamingMessage,
    pendingQuestion,
    pendingPermission,
    permissionMode,
    config,
    skills,
    updateSession,
    startStreaming,
    handleStreamEvent,
    loadSkills,
    setPendingQuestion,
    setPendingPermission,
    respondPermission,
    setPermissionMode,
  } = useAppStore();

  const [input, setInput] = useState('');
  const t = useTranslation();
  const [attachments, setAttachments] = useState<ImagePart[]>([]);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [showEscHint, setShowEscHint] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const rafRef = useRef<number | undefined>(undefined);

  // Slash command autocomplete: show menu when input starts with `/` and has no space yet
  const slashFilter = useMemo(() => {
    if (!input.startsWith('/')) return null;
    const spaceIdx = input.indexOf(' ');
    if (spaceIdx !== -1) return null; // user already typed a space — done picking
    return input.slice(1); // everything after `/`
  }, [input]);

  const showSlashMenu = slashFilter !== null && skills.length > 0;

  const filteredSlashSkills = useMemo(() => {
    if (slashFilter === null) return [];
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(slashFilter.toLowerCase()) ||
        s.description.toLowerCase().includes(slashFilter.toLowerCase())
    );
  }, [skills, slashFilter]);

  // Reset selected index when filter changes
  useEffect(() => {
    setSlashSelectedIndex(0);
  }, [slashFilter]);

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
  }, [currentSession?.messages, pendingMessages, streamingMessage, pendingPermission, pendingQuestion]);

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

  useEffect(() => {
    const unsubscribe = window.manong.permission.onAsk((request) => {
      setPendingPermission(request);
    });
    return unsubscribe;
  }, [setPendingPermission]);

  // CustomEvent listeners for keyboard shortcuts
  useEffect(() => {
    const handleFocusInput = () => {
      inputRef.current?.focus();
    };

    const handleCopyLastResponse = () => {
      const session = useAppStore.getState().currentSession;
      if (!session) return;
      const lastAssistant = [...session.messages].reverse().find((m) => m.role === 'assistant');
      if (!lastAssistant) return;
      const text = lastAssistant.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('\n');
      if (text) navigator.clipboard.writeText(text);
    };

    const handleScrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleShowEscHint = () => {
      setShowEscHint(true);
      setTimeout(() => setShowEscHint(false), 500);
    };

    window.addEventListener('manong:focus-input', handleFocusInput);
    window.addEventListener('manong:copy-last-response', handleCopyLastResponse);
    window.addEventListener('manong:scroll-to-bottom', handleScrollToBottom);
    window.addEventListener('manong:show-esc-hint', handleShowEscHint);

    return () => {
      window.removeEventListener('manong:focus-input', handleFocusInput);
      window.removeEventListener('manong:copy-last-response', handleCopyLastResponse);
      window.removeEventListener('manong:scroll-to-bottom', handleScrollToBottom);
      window.removeEventListener('manong:show-esc-hint', handleShowEscHint);
    };
  }, []);

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
    if ((!input.trim() && attachments.length === 0) || isStreaming || !currentWorkspace) return;

    // Implicitly create session if none exists
    let session = currentSession;
    if (!session) {
      session = await useAppStore.getState().ensureSession();
    }

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
            ...session,
            messages: [...session.messages, userMessage],
            updatedAt: Date.now(),
          };
          updateSession(updatedSession);

          const providerConfig = config?.providers.find(
            (p) => p.name === config.defaultProvider
          );

          startStreaming();

          window.manong.agent.start(
            session.id,
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
      ...session,
      messages: [...session.messages, userMessage],
      updatedAt: Date.now(),
    };
    updateSession(updatedSession);

    const providerConfig = config?.providers.find(
      (p) => p.name === config.defaultProvider
    );

    startStreaming();

    window.manong.agent.start(
      session.id,
      trimmedInput,
      providerConfig,
      currentWorkspace.path,
      attachments,
    );

    setInput('');
    setAttachments([]);
  };

  const handleSlashSelect = (skill: Skill) => {
    setInput(`/${skill.name} `);
    setSlashSelectedIndex(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlashMenu && filteredSlashSkills.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex((prev) =>
          prev < filteredSlashSkills.length - 1 ? prev + 1 : prev
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredSlashSkills[slashSelectedIndex];
        if (selected) handleSlashSelect(selected);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setInput('');
        return;
      }
    }

    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }

    // Escape to clear input when not in slash menu
    if (e.key === 'Escape' && input.trim()) {
      e.preventDefault();
      setInput('');
    }
  };

  const handleStop = () => {
    window.manong.agent.stop();
    useAppStore.getState().stopStreaming();
  };

  const timelineBlocks = useMemo(() => {
    if (!currentSession) return [];
    const allMessages = [...currentSession.messages, ...pendingMessages];
    return messagesToTimeline(allMessages, isStreaming ? streamingMessage : null);
  }, [currentSession?.messages, pendingMessages, streamingMessage, isStreaming]);

  const hasMessages = currentSession && (
    currentSession.messages.length > 0 ||
    pendingMessages.length > 0 ||
    isStreaming
  );

  // Shared input box JSX
  const inputBox = (
    <div className="w-full max-w-3xl pointer-events-auto relative">
      {showSlashMenu && filteredSlashSkills.length > 0 && (
        <SlashCommandMenu
          skills={skills}
          filter={slashFilter ?? ''}
          selectedIndex={slashSelectedIndex}
          onSelect={handleSlashSelect}
        />
      )}
      {pendingPermission ? (
        <div className="shadow-2xl rounded-2xl overflow-hidden border border-border backdrop-blur-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 80%, transparent)' }}>
          <PermissionCard
            request={pendingPermission}
            onRespond={(decision) => respondPermission(pendingPermission.id, decision)}
          />
        </div>
      ) : pendingQuestion ? (
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
            placeholder={t['chat.placeholder']}
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
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover rounded-md transition-colors flex items-center justify-center group"
                title={t['chat.uploadImage']}
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
                onClick={() => {
                  const modes = ['default', 'acceptEdits', 'bypassPermissions'] as const;
                  const idx = modes.indexOf(permissionMode);
                  setPermissionMode(modes[(idx + 1) % modes.length]);
                }}
                className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  permissionMode === 'bypassPermissions'
                    ? 'text-warning bg-warning/10 hover:bg-warning/20'
                    : permissionMode === 'acceptEdits'
                      ? 'text-primary bg-primary/10 hover:bg-primary/20'
                      : 'text-text-secondary hover:text-text-primary hover:bg-hover'
                }`}
                title={`${t['shortcuts.cyclePermissionMode']} (Shift+Tab)`}
              >
                {permissionMode === 'bypassPermissions' ? (
                  <ShieldOff size={13} strokeWidth={1.5} />
                ) : permissionMode === 'acceptEdits' ? (
                  <ShieldCheck size={13} strokeWidth={1.5} />
                ) : (
                  <Shield size={13} strokeWidth={1.5} />
                )}
                <span>{t[`permission.mode.${permissionMode}` as TranslationKey]}</span>
              </button>
            </div>

            {/* Right buttons */}
            <div className="flex items-center gap-2 relative">
              {isStreaming ? (
                <>
                  <span className="text-[10px] text-text-secondary font-mono mr-1 hidden sm:inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary streaming-indicator" />
                    {t['chat.processing']}
                  </span>
                  <button
                    onClick={handleStop}
                    className="p-1.5 bg-error text-on-error rounded-lg hover:bg-error/90 transition-all"
                    title={t['chat.stopGeneration']}
                  >
                    <Square size={14} fill="currentColor" strokeWidth={0} />
                  </button>
                  {showEscHint && (
                    <span className="absolute -top-7 right-0 text-[10px] text-text-secondary bg-surface border border-border rounded px-2 py-0.5 whitespace-nowrap shadow-sm animate-fade-in">
                      {t['chat.escToStop']}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-[10px] text-text-secondary font-mono mr-1 hidden sm:inline-block">
                    {isMac ? t['chat.shortcutSend.mac'] : t['chat.shortcutSend.other']}
                  </span>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() && attachments.length === 0}
                    className="p-1.5 bg-primary text-on-primary rounded-lg hover:bg-primary-hover disabled:opacity-30 disabled:bg-surface-elevated disabled:text-text-secondary transition-all"
                    title={t['chat.sendMessage']}
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
  );

  // Hero Prompt mode — no messages yet
  if (!hasMessages) {
    return (
      <main className="flex-1 flex flex-col bg-background relative" onPaste={handlePaste} onDragOver={handleDragOver} onDrop={handleDrop}>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-3xl flex flex-col items-center gap-6">
            {/* Workspace name + subtitle */}
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-text-primary mb-2">
                {currentWorkspace?.name || 'Manong'}
              </h1>
              <p className="text-sm text-text-secondary">
                {t['chat.heroSubtitle']}
              </p>
            </div>
            {/* Input box */}
            {inputBox}
          </div>
        </div>
      </main>
    );
  }

  // Conversation mode — has messages
  return (
    <main className="flex-1 flex flex-col bg-background relative" onPaste={handlePaste} onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Messages */}
      <div className={`flex-1 overflow-y-auto px-4 ${pendingPermission || pendingQuestion ? 'pb-56' : 'pb-32'}`}>
        <div className="max-w-4xl mx-auto pt-8">
          {timelineBlocks.map((block) => (
            <TimelineBlockView key={block.id} block={block} />
          ))}

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Input area - Floating Pill */}
      <div className="absolute bottom-6 left-0 right-0 px-4 pointer-events-none z-10 flex justify-center">
        {inputBox}
      </div>
    </main>
  );
};
