# Manong UI Redesign Design Document

## Overview

This document describes the UI redesign for Manong based on the "Modern Coding Agent Dashboard V2" Stitch design. The redesign focuses on a cleaner, more professional appearance with improved visual hierarchy.

## Design Decisions

### Scope
- **Full redesign** - Update all components to match the Stitch design
- **Icons** - Use Lucide React icon library
- **InfoPanel** - Integrate into sidebar, remove standalone panel

## Architecture

### New Layout Structure

```
┌─────────────────────────────────────────────────────┐
│ TitleBar (status + folder name + settings)          │
├────┬─────────────┬───────────────────────────────────┤
│    │  Sessions   │                                   │
│ Nav│  Panel      │         Chat Panel                │
│ Bar│  (w-64)     │         (flex-1)                  │
│    │             │                                   │
│    │  Context    │                                   │
│    │  Usage Bar  │                                   │
└────┴─────────────┴───────────────────────────────────┘
```

### Component Changes

#### 1. App.tsx
- Add NavigationBar between TitleBar and main content
- Remove InfoPanel from layout

#### 2. Tailwind Config
Add custom colors:
- Primary: `#EA580C` (orange)
- Background: `#0D0D0D`, `#161616`, `#0A0A0A`
- Border: `#262626`
- Text: `#E5E5E5`, Muted: `#A3A3A3`

Add custom fonts:
- Display: Inter
- Mono: JetBrains Mono

#### 3. New: NavigationBar Component
- Width: `w-12` (48px)
- Icons: MessageSquare, Folder, Link, Bug, Settings
- Active state: Orange left border indicator
- Position: Bottom settings icon

#### 4. Sidebar Refactor
- Header: "SESSIONS" label with small plus button
- Session groups: "Current" (with orange border) / "History"
- Bottom: Context usage progress bar
- Remove full-width "New Session" button

#### 5. ChatPanel Redesign
- Messages: Left role label + vertical line + content
- Input area: Context/Image/Terminal buttons on left
- Right side: CTRL+ENTER hint + Send button

#### 6. MessageItem New Style
- User: "YOU" label (right-aligned, min-w-[3rem])
- Agent: "AGENT" label (orange, smaller text)
- Agent messages: Orange vertical line on left
- Code blocks: Filename header + Copy button

#### 7. TitleBar Update
- Left: Traffic lights space + "AGENT" label + folder name
- Right: Status text (Idle) + green dot indicator

## Dependencies

### Add
- `lucide-react` - Icon library
- `@fontsource/inter` - Inter font
- `@fontsource/jetbrains-mono` - JetBrains Mono font

### CSS Updates
- Update index.css with font imports
- Update scrollbar colors to match new palette
- Add prose styling for markdown

## Implementation Order

1. Update dependencies and Tailwind config
2. Update index.css with fonts and base styles
3. Create NavigationBar component
4. Refactor Sidebar component
5. Update TitleBar component
6. Refactor MessageItem component
7. Update ChatPanel component
8. Update App.tsx layout

## Visual Reference

See: `stitch_screen_screenshot.png` and `stitch_screen_code.html`
