import type { AgentType } from '../../../shared/types';

const EXPLORE_PROMPT = `You are an exploration agent specialized in quickly navigating and understanding codebases.

Your mission is to search, analyze, and report findings efficiently. You should:

1. Use glob to find files by pattern (e.g., "**/*.ts", "src/components/**")
2. Use grep to search for code patterns (e.g., "class Foo", "function bar")
3. Read relevant files to understand their structure
4. Provide concise summaries of what you find

IMPORTANT: You are READ-ONLY. You must NOT modify any files. Only search and report.

When reporting:
- Be specific about file locations and line numbers
- Quote relevant code snippets
- Summarize patterns you discover
- Note any interesting findings or potential issues

Always end with a clear summary of your findings.`;

const PLAN_PROMPT = `You are a planning agent specialized in analyzing codebases and creating implementation strategies.

Your mission is to understand requirements and produce actionable plans. You should:

1. Explore the relevant parts of the codebase
2. Understand the current architecture and patterns
3. Identify what changes are needed
4. Create a numbered, step-by-step implementation plan

IMPORTANT: You are READ-ONLY. You must NOT modify any files. Only analyze and plan.

Your plan should:
- Be specific about which files need changes
- Follow existing code patterns and conventions
- Consider edge cases and error handling
- Estimate complexity where possible

Format your output as:
1. Analysis: Brief summary of current state
2. Plan: Numbered steps for implementation
3. Considerations: Edge cases, dependencies, risks`;

const GENERAL_PROMPT = `You are a general-purpose subagent that can handle various tasks independently.

You have access to most tools and can:
- Read and analyze code
- Modify files when appropriate
- Run shell commands
- Search the codebase

Work autonomously to complete the assigned task. When done:
1. Summarize what you did
2. List any files you modified
3. Note any follow-up actions needed

Be efficient and thorough. Report your findings clearly.`;

const BUILTIN_AGENTS: Record<string, AgentType> = {
  primary: {
    name: 'primary',
    description: 'The default agent with full capabilities. Use this for general tasks.',
    mode: 'primary',
  },
  explore: {
    name: 'explore',
    description: 'Fast agent for exploring codebases. Use for finding files, searching code, or answering questions about the codebase. Read-only access.',
    mode: 'subagent',
    prompt: EXPLORE_PROMPT,
    allowedTools: ['read_file', 'glob', 'grep', 'list_dir', 'bash', 'lsp'],
    deniedTools: ['write_file', 'edit_file', 'task'],
    color: '#4CAF50',
  },
  plan: {
    name: 'plan',
    description: 'Planning agent for designing implementation strategies. Analyzes codebase and produces numbered plans. Read-only access.',
    mode: 'subagent',
    prompt: PLAN_PROMPT,
    allowedTools: ['read_file', 'glob', 'grep', 'list_dir', 'bash', 'lsp'],
    deniedTools: ['write_file', 'edit_file', 'task'],
    color: '#2196F3',
  },
  general: {
    name: 'general',
    description: 'General-purpose subagent for executing multi-step tasks independently. Has full tool access except task tool.',
    mode: 'subagent',
    prompt: GENERAL_PROMPT,
    deniedTools: ['task'],
    color: '#FF9800',
  },
};

class AgentTypeRegistry {
  private agents: Map<string, AgentType> = new Map();

  constructor() {
    Object.entries(BUILTIN_AGENTS).forEach(([name, agent]) => {
      this.agents.set(name, agent);
    });
  }

  get(name: string): AgentType | undefined {
    return this.agents.get(name);
  }

  list(): AgentType[] {
    return Array.from(this.agents.values());
  }

  listSubagents(): AgentType[] {
    return this.list().filter(a => a.mode === 'subagent');
  }

  listPrimary(): AgentType[] {
    return this.list().filter(a => a.mode === 'primary');
  }

  register(agent: AgentType): void {
    this.agents.set(agent.name, agent);
  }

  unregister(name: string): boolean {
    if (BUILTIN_AGENTS[name]) {
      return false;
    }
    return this.agents.delete(name);
  }

  getToolFilter(agentType: string): { allowed: string[] | null; denied: string[] } {
    const agent = this.agents.get(agentType);
    if (!agent) {
      return { allowed: null, denied: ['task'] };
    }

    if (agent.mode === 'primary') {
      return { allowed: null, denied: [] };
    }

    return {
      allowed: agent.allowedTools ?? null,
      denied: [...(agent.deniedTools ?? []), 'task'],
    };
  }

  getDescriptionForTool(): string {
    const subagents = this.listSubagents();
    return subagents
      .map(a => `- ${a.name}: ${a.description}`)
      .join('\n');
  }
}

export const agentTypeRegistry = new AgentTypeRegistry();
