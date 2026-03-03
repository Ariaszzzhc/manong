import React from 'react';
import { User, Bot } from 'lucide-react';
import { useTranslation } from '../i18n';

// TeamPanel component - currently disabled
// This component is preserved for future team/subagent functionality
export const TeamPanel: React.FC = () => {
  const t = useTranslation();
  return (
    <div className="p-2 space-y-2">
      <div className="space-y-1">
        {/* Team Lead placeholder */}
        <button
          className="w-full p-2 rounded text-left text-xs bg-primary/20 border border-primary/50 text-text-primary"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <User size={12} className="text-primary" />
              <span className="font-medium">{t['team.teamLead']}</span>
            </div>
          </div>
          <p className="text-[10px] text-text-secondary truncate pl-4">
            {t['team.mainAgent']}
          </p>
        </button>

        {/* Empty state */}
        <div className="py-2 text-center text-text-secondary/50 text-[10px]">
          {t['team.disabled']}
        </div>
      </div>
    </div>
  );
};
