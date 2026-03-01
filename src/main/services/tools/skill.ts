import { z } from 'zod';
import { defineTool } from '../../../shared/tool';
import { toolRegistry } from './registry';
import { skillService } from '../skill';

const SkillSchema = z.object({
  name: z.string().describe('The name of the skill to load'),
  args: z.string().optional().describe('Optional arguments to pass to the skill'),
});

export const skillTool = defineTool({
  name: 'skill',
  description: skillService.getToolDescription(),
  parameters: SkillSchema,
  execute: async (params, context) => {
    const result = await skillService.executeSkill(
      params.name,
      params.args || '',
      context.workingDir
    );

    if (!result.success) {
      return {
        success: false,
        output: result.error || 'Failed to load skill',
      };
    }

    return {
      success: true,
      output: `Skill "${params.name}" loaded. Follow the instructions below:\n\n${result.prompt}`,
    };
  },
});

toolRegistry.register(skillTool);
