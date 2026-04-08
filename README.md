# CommentsMarkup for Obsidian

Obsidian plugin for [CommentsMarkup](https://github.com/vgracian/comments-markup), a Markdown extension for threaded commenting.

## Install via BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) if you haven't already
2. Open BRAT settings > **Add Beta Plugin**
3. Paste: `vgracian/obsidian-comments-markup`

## What it does

- Renders `{^id}` anchors as subtle markers in the editor
- Shows comment threads in a sidebar panel with authorship, dates, and resolution state
- Filters: show only open comments, collapse resolved threads
- Click any comment to navigate to its anchor in the document

## Commands

| Command | What it does |
|---------|-------------|
| **Insert comment** | Places `{^id}` anchor at cursor, creates comment definition in the Comments section, positions cursor to type |
| **Reply to comment** | Adds a reply to the comment/anchor under the cursor |
| **Toggle comment resolved** | Switches `[ ]` ↔ `[x]` on the root comment under the cursor |
| **Show comments panel** | Opens the sidebar panel |

All commands are accessible via the command palette. The plugin also adds a message icon to the ribbon that opens the comments panel. On first use, the plugin prompts for your `@author` name.

## Syntax at a glance

```markdown
The migration should be completed by Q3{^q1}.

## Comments

{^q1 [x]} @alice 2026-03-15: Are we sure Q3 is realistic?
  {^q1.1} @bob 2026-03-15: Yes, assumes two new hires by May.
```

Full specification: [CommentsMarkup v0.2.0](https://github.com/vgracian/comments-markup/blob/main/spec/CommentsMarkup.md)

## Source

Plugin source code lives in the main CommentsMarkup repo: [plugins/obsidian/](https://github.com/vgracian/comments-markup/tree/main/plugins/obsidian)

This repo contains only the built artifacts needed for BRAT distribution.

## License

Copyright 2026 V. Gracia. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
