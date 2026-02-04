#!/usr/bin/env python3
"""
Skill Finder - Search and discover OpenClaw skills
"""
import os
import sys
import argparse
import re
from pathlib import Path
from typing import List, Dict, Optional

# Default skills directory
SKILLS_DIR = Path("/Users/yangshengpeng/Desktop/openAI/moltbot/skills")

def extract_skill_info(skill_path: Path) -> Optional[Dict]:
    """Extract skill name and description from SKILL.md"""
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return None
    
    try:
        content = skill_md.read_text(encoding='utf-8')
        
        # Extract frontmatter
        name = None
        description = None
        
        # Parse YAML frontmatter
        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 3:
                frontmatter = parts[1]
                # Extract name
                name_match = re.search(r'^name:\s*(.+)$', frontmatter, re.MULTILINE)
                if name_match:
                    name = name_match.group(1).strip()
                
                # Extract description
                desc_match = re.search(r'^description:\s*(.+)$', frontmatter, re.MULTILINE | re.DOTALL)
                if desc_match:
                    description = desc_match.group(1).strip()
        
        # If no name in frontmatter, use directory name
        if not name:
            name = skill_path.name
            
        return {
            'name': name,
            'description': description or "No description available",
            'path': str(skill_path),
            'has_scripts': (skill_path / 'scripts').exists(),
            'has_references': (skill_path / 'references').exists(),
            'has_assets': (skill_path / 'assets').exists()
        }
    except Exception as e:
        return {
            'name': skill_path.name,
            'description': f"Error reading skill: {e}",
            'path': str(skill_path),
            'has_scripts': False,
            'has_references': False,
            'has_assets': False
        }

def get_all_skills(skills_dir: Path = SKILLS_DIR) -> List[Dict]:
    """Get all skills in the skills directory"""
    skills = []
    
    if not skills_dir.exists():
        print(f"Error: Skills directory not found: {skills_dir}")
        return skills
    
    for item in skills_dir.iterdir():
        if item.is_dir() and not item.name.startswith('.'):
            # Check if it's a skill (has SKILL.md)
            if (item / 'SKILL.md').exists():
                skill_info = extract_skill_info(item)
                if skill_info:
                    skills.append(skill_info)
    
    return sorted(skills, key=lambda x: x['name'])

def search_skills(keyword: str, skills_dir: Path = SKILLS_DIR) -> List[Dict]:
    """Search skills by keyword"""
    all_skills = get_all_skills(skills_dir)
    keyword_lower = keyword.lower()
    
    results = []
    for skill in all_skills:
        # Search in name and description
        if (keyword_lower in skill['name'].lower() or 
            keyword_lower in skill['description'].lower()):
            results.append(skill)
    
    return results

def search_by_description(keyword: str, skills_dir: Path = SKILLS_DIR) -> List[Dict]:
    """Search skills by description content only"""
    all_skills = get_all_skills(skills_dir)
    keyword_lower = keyword.lower()
    
    results = []
    for skill in all_skills:
        if keyword_lower in skill['description'].lower():
            results.append(skill)
    
    return results

def get_skill_info(skill_name: str, skills_dir: Path = SKILLS_DIR) -> Optional[Dict]:
    """Get detailed info about a specific skill"""
    skill_path = skills_dir / skill_name
    
    if not skill_path.exists():
        # Try searching by name
        skills = get_all_skills(skills_dir)
        for skill in skills:
            if skill['name'].lower() == skill_name.lower():
                skill_path = Path(skill['path'])
                break
    
    if skill_path.exists() and (skill_path / 'SKILL.md').exists():
        return extract_skill_info(skill_path)
    
    return None

def show_skill_readme(skill_name: str, skills_dir: Path = SKILLS_DIR):
    """Display the SKILL.md content of a skill"""
    skill_path = skills_dir / skill_name
    
    if not skill_path.exists():
        # Try searching by name
        skills = get_all_skills(skills_dir)
        for skill in skills:
            if skill['name'].lower() == skill_name.lower():
                skill_path = Path(skill['path'])
                break
    
    readme_path = skill_path / 'SKILL.md'
    if readme_path.exists():
        try:
            content = readme_path.read_text(encoding='utf-8')
            print(f"\n{'='*60}")
            print(f"SKILL.md for: {skill_name}")
            print(f"{'='*60}\n")
            print(content)
            print(f"\n{'='*60}")
        except Exception as e:
            print(f"Error reading SKILL.md: {e}")
    else:
        print(f"SKILL.md not found for skill: {skill_name}")

def recommend_skills(task_description: str, skills_dir: Path = SKILLS_DIR) -> List[Dict]:
    """Recommend skills based on task description"""
    task_lower = task_description.lower()
    all_skills = get_all_skills(skills_dir)
    
    # Keywords mapping
    keyword_mappings = {
        'pdf': ['pdf', 'document', 'file'],
        'medical': ['medical', 'health', 'clinical', 'hospital', 'patient'],
        'search': ['search', 'find', 'query', 'lookup'],
        'data': ['data', 'database', 'sql', 'query'],
        'code': ['code', 'programming', 'development', 'debug', 'script'],
        'image': ['image', 'picture', 'photo', 'video', 'media'],
        'web': ['web', 'http', 'api', 'url', 'browser'],
        'text': ['text', 'document', 'word', 'content', 'nlp']
    }
    
    scores = {}
    for skill in all_skills:
        score = 0
        skill_text = (skill['name'] + ' ' + skill['description']).lower()
        
        # Check for direct matches
        for word in task_lower.split():
            if word in skill_text:
                score += 2
        
        # Check keyword mappings
        for category, keywords in keyword_mappings.items():
            if any(kw in task_lower for kw in keywords):
                if any(kw in skill_text for kw in keywords):
                    score += 3
        
        if score > 0:
            scores[skill['name']] = (score, skill)
    
    # Sort by score
    sorted_skills = sorted(scores.values(), key=lambda x: x[0], reverse=True)
    return [skill for _, skill in sorted_skills[:5]]  # Top 5

def print_skill(skill: Dict, show_details: bool = False):
    """Print skill information"""
    print(f"\n📦 {skill['name']}")
    print(f"   Description: {skill['description'][:100]}{'...' if len(skill['description']) > 100 else ''}")
    
    if show_details:
        print(f"   Path: {skill['path']}")
        resources = []
        if skill['has_scripts']:
            resources.append('scripts')
        if skill['has_references']:
            resources.append('references')
        if skill['has_assets']:
            resources.append('assets')
        if resources:
            print(f"   Resources: {', '.join(resources)}")

def main():
    parser = argparse.ArgumentParser(
        description='Find and discover OpenClaw skills',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --keyword pdf              # Search skills related to PDF
  %(prog)s --list-all                 # List all available skills
  %(prog)s --info skill-creator       # Show skill details
  %(prog)s --readme skill-finder      # Show skill's SKILL.md
  %(prog)s --recommend "medical data" # Recommend skills for task
        """
    )
    
    parser.add_argument('--keyword', '-k', type=str, help='Search skills by keyword')
    parser.add_argument('--description', '-d', type=str, help='Search in descriptions only')
    parser.add_argument('--list-all', '-l', action='store_true', help='List all skills')
    parser.add_argument('--info', '-i', type=str, help='Get info about specific skill')
    parser.add_argument('--readme', '-r', type=str, help='Show SKILL.md content')
    parser.add_argument('--recommend', type=str, help='Recommend skills for a task')
    parser.add_argument('--skills-dir', type=str, default=str(SKILLS_DIR), 
                        help=f'Path to skills directory (default: {SKILLS_DIR})')
    
    args = parser.parse_args()
    
    skills_dir = Path(args.skills_dir)
    
    if args.keyword:
        results = search_skills(args.keyword, skills_dir)
        print(f"\n🔍 Search results for '{args.keyword}':")
        print(f"   Found {len(results)} skill(s)\n")
        for skill in results:
            print_skill(skill, show_details=True)
    
    elif args.description:
        results = search_by_description(args.description, skills_dir)
        print(f"\n🔍 Description search for '{args.description}':")
        print(f"   Found {len(results)} skill(s)\n")
        for skill in results:
            print_skill(skill)
    
    elif args.list_all:
        skills = get_all_skills(skills_dir)
        print(f"\n📚 All available skills ({len(skills)} total):\n")
        for skill in skills:
            print_skill(skill)
    
    elif args.info:
        skill = get_skill_info(args.info, skills_dir)
        if skill:
            print(f"\n📦 Skill Information: {skill['name']}")
            print(f"{'='*60}")
            print(f"Description:\n{skill['description']}\n")
            print(f"Path: {skill['path']}")
            resources = []
            if skill['has_scripts']:
                resources.append('✓ scripts')
            if skill['has_references']:
                resources.append('✓ references')
            if skill['has_assets']:
                resources.append('✓ assets')
            if resources:
                print(f"Resources: {', '.join(resources)}")
        else:
            print(f"❌ Skill not found: {args.info}")
    
    elif args.readme:
        show_skill_readme(args.readme, skills_dir)
    
    elif args.recommend:
        results = recommend_skills(args.recommend, skills_dir)
        print(f"\n💡 Recommended skills for '{args.recommend}':")
        print(f"   Top {len(results)} matches:\n")
        for skill in results:
            print_skill(skill, show_details=True)
    
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
