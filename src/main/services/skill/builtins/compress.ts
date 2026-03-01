import type { Skill } from '../../../../shared/types';

export const compressSkill: Skill = {
  name: 'compress',
  description: 'Compress conversation history with AI summary to reduce context usage',
  template: `Please analyze the conversation history and create a concise summary that captures all essential information needed to continue the conversation effectively.

The summary should include:

## Goal
What the user is trying to accomplish (the main objective)

## Instructions
Important instructions or preferences the user has given that should be followed in future work

## Accomplished
What has been done so far - list completed tasks, files modified, features implemented

## In Progress
Current work that was being done when compression was triggered

## Relevant Files
List of files that have been read, modified, or are relevant to the task

## Key Decisions
Important architectural or implementation decisions made

## Next Steps
What was about to be done next

Please be comprehensive but concise. Include specific file paths, function names, and code snippets that are essential context.

$ARGUMENTS`,
  source: 'builtin',
  hints: ['$ARGUMENTS'],
}
