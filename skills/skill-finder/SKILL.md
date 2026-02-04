---
name: skill-finder
description: Discover, search, and manage OpenClaw skills. Use when users need to (1) find skills for specific tasks, (2) search the skill directory, (3) get skill recommendations, (4) check what skills are available/installed, or (5) learn about skill capabilities. Keywords: find skill, search skill, what skills, skill discovery, available skills, skill list, skill search, skill recommendation.
---

# Skill Finder

Helps users discover, search, and understand OpenClaw skills.

## Quick Start

Search for skills by keyword:

```bash
# Search local skills
python scripts/search_skills.py --keyword "pdf"

# Search by category
python scripts/search_skills.py --category "medical"

# List all available skills
python scripts/search_skills.py --list-all
```

## When to Use This Skill

**Use this skill when users ask:**

- "有没有处理PDF的技能？"
- "搜索一下医疗相关的skill"
- "列出所有可用的技能"
- "推荐一个适合处理数据的skill"
- "skill-finder是什么？"
- "如何发现新的技能？"

## Capabilities

### 1. Local Skill Discovery

Search skills installed in the local workspace:

```bash
# Search by keyword in skill names and descriptions
python scripts/search_skills.py --keyword "search"

# Search by description content
python scripts/search_skills.py --description "data"
```

### 2. Skill Details

View detailed information about a specific skill:

```bash
# Show skill details
python scripts/search_skills.py --info "medical-data-search"

# Show skill's SKILL.md content
python scripts/search_skills.py --readme "skill-creator"
```

### 3. Recommendations

Get skill recommendations based on task description:

```bash
# Recommend skills for a task
python scripts/search_skills.py --recommend "处理医疗文献数据"
```

## Skill Directory Structure

Skills are located at:

- **Local skills**: `/Users/yangshengpeng/Desktop/openAI/moltbot/skills/`
- **Community skills**: `https://github.com/openclaw/skills/tree/main/skills`

Each skill contains:

- `SKILL.md` - Skill definition and instructions
- `scripts/` - Executable scripts (optional)
- `references/` - Documentation (optional)
- `assets/` - Templates and resources (optional)

## Usage Examples

### Example 1: Find skills for a specific task

**User**: "我想处理PDF文件，有什么技能可以用？"

**Action**:

```bash
python scripts/search_skills.py --keyword "pdf"
```

**Result**: Returns matching skills like `nano-pdf`

### Example 2: Get skill details

**User**: "medical-data-search 技能是做什么的？"

**Action**:

```bash
python scripts/search_skills.py --info "medical-data-search"
```

### Example 3: Browse all skills

**User**: "列出所有可用的技能"

**Action**:

```bash
python scripts/search_skills.py --list-all
```

### Example 4: Smart recommendation

**User**: "我要做医疗数据搜索，推荐一个技能"

**Action**:

```bash
python scripts/search_skills.py --recommend "医疗数据搜索"
```

## Best Practices

1. **Use specific keywords** - Instead of "data", try "medical data" or "pdf processing"
2. **Check skill descriptions** - Each skill has a description explaining when to use it
3. **Read SKILL.md before use** - Understanding the skill helps get better results
4. **Combine skills** - Multiple skills can work together for complex tasks

## Common Skill Categories

| Category            | Example Skills               |
| ------------------- | ---------------------------- |
| Document Processing | nano-pdf, medical-doc-upload |
| Data Search         | medical-data-search          |
| Development         | coding-agent, skill-creator  |
| Media               | video-frames                 |
| Utilities           | weather, session-logs        |

## Troubleshooting

**No skills found?**

- Try broader keywords
- Check if the skill directory path is correct
- Some skills may not be installed locally

**Want to install a new skill?**

- Skills from GitHub can be cloned to the skills directory
- Or create custom skills using `skill-creator`

**Skill not working?**

- Check the skill's SKILL.md for prerequisites
- Verify scripts have executable permissions
- Check for missing dependencies
