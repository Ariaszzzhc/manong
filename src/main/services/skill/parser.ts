import type { Skill } from '../../../shared/types';

interface SkillFrontmatter {
  description?: string
  agent?: string
}

const VARIABLE_PATTERN = /\$(ARGUMENTS|[0-9]+)/g

export function parseSkillMarkdown(content: string, name: string, source: Skill['source']): Skill | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

  if (!frontmatterMatch) {
    return null
  }

  const [, frontmatterStr, template] = frontmatterMatch
  const frontmatter = parseFrontmatter(frontmatterStr)

  if (!frontmatter.description) {
    return null
  }

  const hints = extractHints(template)

  return {
    name,
    description: frontmatter.description,
    template: template.trim(),
    source,
    agent: frontmatter.agent,
    hints,
  }
}

function parseFrontmatter(content: string): SkillFrontmatter {
  const result: SkillFrontmatter = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    const value = line.slice(colonIndex + 1).trim()

    if (key === 'description') {
      result.description = value
    } else if (key === 'agent') {
      result.agent = value
    }
  }

  return result
}

function extractHints(template: string): string[] {
  const hints: string[] = []
  const matches = template.matchAll(VARIABLE_PATTERN)

  for (const match of matches) {
    if (!hints.includes(match[0])) {
      hints.push(match[0])
    }
  }

  return hints
}

export function processTemplate(template: string, args: string): string {
  const parts = args.split(/\s+/).filter(Boolean)

  let result = template.replace(/\$ARGUMENTS/g, args)

  parts.forEach((part, index) => {
    result = result.replace(new RegExp(`\\$${index + 1}`, 'g'), part)
  })

  return result
}
