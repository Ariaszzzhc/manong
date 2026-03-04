import type { Skill } from '../../../../shared/types';
import { initSkill } from './init';
import { compactSkill } from './compact';

export const builtinSkills: Skill[] = [
  initSkill,
  compactSkill,
];

export function getBuiltinSkill(name: string): Skill | undefined {
  return builtinSkills.find(s => s.name === name);
}
