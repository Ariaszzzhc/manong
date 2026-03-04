import type { Skill } from '../../../../shared/types';

export const compactSkill: Skill = {
  name: 'compact',
  description: 'Compress conversation history — saves transcript to disk and replaces messages with an AI summary',
  template: '$ARGUMENTS',
  source: 'builtin',
  hints: ['$ARGUMENTS'],
}
