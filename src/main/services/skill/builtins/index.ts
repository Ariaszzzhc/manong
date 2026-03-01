import type { Skill } from '../../../../shared/types';
import { initSkill } from './init';
import { compressSkill } from './compress';

export const builtinSkills: Skill[] = [
  initSkill,
  compressSkill,
];

export function getBuiltinSkill(name: string): Skill | undefined {
  return builtinSkills.find(s => s.name === name);
}
