import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import type { Skill } from '../../../shared/types'
import { builtinSkills } from './builtins'
import { parseSkillMarkdown, processTemplate } from './parser'

class SkillService {
  private globalSkillsPath: string
  private skillsCache: Map<string, Skill> = new Map()
  private lastWorkspacePath: string | null = null

  constructor() {
    const userDataPath = app.getPath('userData')
    this.globalSkillsPath = path.join(userDataPath, 'skills')
    this.ensureGlobalSkillsDir()
  }

  private async ensureGlobalSkillsDir(): Promise<void> {
    try {
      await fs.mkdir(this.globalSkillsPath, { recursive: true })
    } catch {
      // Directory might already exist
    }
  }

  async loadSkills(workspacePath?: string): Promise<Skill[]> {
    const skills = new Map<string, Skill>()

    for (const skill of builtinSkills) {
      skills.set(skill.name, skill)
    }

    const globalSkills = await this.loadSkillsFromDir(this.globalSkillsPath, 'global')
    for (const skill of globalSkills) {
      skills.set(skill.name, skill)
    }

    if (workspacePath) {
      this.lastWorkspacePath = workspacePath
      const projectSkillsPath = path.join(workspacePath, '.manong', 'skills')
      const projectSkills = await this.loadSkillsFromDir(projectSkillsPath, 'project')
      for (const skill of projectSkills) {
        skills.set(skill.name, skill)
      }
    }

    this.skillsCache = skills
    return Array.from(skills.values())
  }

  private async loadSkillsFromDir(dirPath: string, source: Skill['source']): Promise<Skill[]> {
    const skills: Skill[] = []

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name)

        // Pattern 1: Top-level .md files (backward compatibility)
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const content = await fs.readFile(entryPath, 'utf-8')
          const name = entry.name.replace(/\.md$/, '')
          const skill = parseSkillMarkdown(content, name, source)
          if (skill) skills.push(skill)
        }

        // Pattern 2: Subdirectory with SKILL.md (supports symbolic links)
        if (entry.isDirectory() || entry.isSymbolicLink()) {
          const skillFile = path.join(entryPath, 'SKILL.md')
          try {
            const content = await fs.readFile(skillFile, 'utf-8')
            const skill = parseSkillMarkdown(content, entry.name, source)
            if (skill) skills.push(skill)
          } catch {
            // SKILL.md doesn't exist, skip
          }
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return skills
  }

  async getSkill(name: string, workspacePath?: string): Promise<Skill | undefined> {
    if (workspacePath && workspacePath !== this.lastWorkspacePath) {
      await this.loadSkills(workspacePath)
    }

    return this.skillsCache.get(name)
  }

  async executeSkill(name: string, args: string, workspacePath?: string): Promise<{ success: boolean; prompt?: string; error?: string }> {
    const skill = await this.getSkill(name, workspacePath)

    if (!skill) {
      return {
        success: false,
        error: `Skill "${name}" not found`,
      }
    }

    const prompt = processTemplate(skill.template, args)

    return {
      success: true,
      prompt,
    }
  }

  getSkillDescriptions(): Array<{ name: string; description: string }> {
    return Array.from(this.skillsCache.values()).map(s => ({
      name: s.name,
      description: s.description,
    }))
  }

  getToolDescription(): string {
    const skills = Array.from(this.skillsCache.values())
    const skillList = skills.map(s =>
      `    <skill>
      <name>${s.name}</name>
      <description>${s.description}</description>
    </skill>`
    ).join('\n')

    return `Load a specialized skill that provides domain-specific instructions and workflows.

When you recognize that a task matches one of the available skills listed below,
use this tool to load the full skill instructions.

<available_skills>
${skillList}
</available_skills>

Usage:
- name: The name of the skill to load (e.g., "init", "compact")`
  }
}

export const skillService = new SkillService()
