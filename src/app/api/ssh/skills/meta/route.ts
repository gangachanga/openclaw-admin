import { NextResponse } from 'next/server';
import { sshExec, isSSHConfigured } from '@/lib/ssh-client';

export async function GET(req: Request) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');
    
    if (!path) {
      return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    // Read SKILL.md to extract metadata
    const skillMd = await sshExec(`cat ${path}/SKILL.md 2>/dev/null || echo ''`);
    const content = skillMd.stdout;
    
    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let metadata: Record<string, string> = {};
    
    if (frontmatterMatch) {
      const fm = frontmatterMatch[1];
      // Extract name, version, description
      const nameMatch = fm.match(/^name:\s*(.+)$/m);
      const versionMatch = fm.match(/^version:\s*(.+)$/m);
      const descMatch = fm.match(/^description:\s*(.+)$/m);
      
      if (nameMatch) metadata.name = nameMatch[1].trim();
      if (versionMatch) metadata.version = versionMatch[1].trim();
      if (descMatch) metadata.description = descMatch[1].trim();
    }
    
    // Fallback: try to get description from first paragraph after frontmatter
    if (!metadata.description && content) {
      const descMatch = content.replace(/^---\n[\s\S]*?\n---/, '').match(/^#\s+.+\n+(.+?)(?:\n\n|$)/);
      if (descMatch) metadata.description = descMatch[1].trim();
    }

    return NextResponse.json(metadata);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
