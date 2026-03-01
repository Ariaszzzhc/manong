import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useAppStore } from '../stores/app';
import type { Skill } from '../../shared/types';

interface CommandPaletteProps {
  onSelectSkill: (skill: Skill) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onSelectSkill }) => {
  const { skills, commandPaletteOpen, closeCommandPalette } = useAppStore();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(search.toLowerCase()) ||
    skill.description.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (commandPaletteOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCommandPalette();
        return;
      }

      if (!commandPaletteOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredSkills.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter' && filteredSkills[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredSkills[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, filteredSkills, selectedIndex]);

  const handleSelect = (skill: Skill) => {
    onSelectSkill(skill);
    closeCommandPalette();
  };

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeCommandPalette}
      />

      <div className="relative w-full max-w-xl bg-surface border border-border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-text-secondary shrink-0" strokeWidth={1.5} />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="flex-1 bg-transparent text-text-primary outline-none text-sm"
          />
          <button
            onClick={closeCommandPalette}
            className="p-1 text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="max-h-[40vh] overflow-y-auto">
          {filteredSkills.length === 0 ? (
            <div className="px-4 py-8 text-center text-text-secondary text-sm">
              No skills found
            </div>
          ) : (
            <ul>
              {filteredSkills.map((skill, index) => (
                <li key={skill.name}>
                  <button
                    onClick={() => handleSelect(skill)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      index === selectedIndex
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-sm">/{skill.name}</span>
                        <span className="ml-2 text-xs text-text-secondary">
                          {skill.source}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                      {skill.description}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border bg-background/50">
          <div className="flex items-center gap-4 text-[10px] text-text-secondary font-mono">
            <span>
              <kbd className="px-1 py-0.5 bg-surface border border-border rounded">↑↓</kbd>
              {' '}navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-surface border border-border rounded">↵</kbd>
              {' '}select
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-surface border border-border rounded">esc</kbd>
              {' '}close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
