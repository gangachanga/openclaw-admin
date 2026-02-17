import { NextResponse } from 'next/server';
import { sshExec, isSSHConfigured } from '@/lib/ssh-client';

// Convert ClawHub URL to GitHub repo info
function parseClawHubUrl(url: string): { repo: string; path?: string; isClawHub: boolean } | null {
  // Check if it's a ClawHub URL
  const clawhubMatch = url.match(/^https?:\/\/clawhub\.ai\/([^\/]+)\/([^\/]+)\/?$/);
  if (clawhubMatch) {
    const [, author, skillName] = clawhubMatch;
    return {
      repo: 'https://github.com/openclaw/skills.git',
      path: `skills/${author}/${skillName}`,
      isClawHub: true,
    };
  }
  
  // Regular GitHub/Git URL
  const gitMatch = url.match(/^(https?:\/\/|git@).+\.git$/);
  if (gitMatch) {
    return { repo: url, isClawHub: false };
  }
  
  return null;
}

export async function POST(req: Request) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const { url, name } = await req.json();
    
    if (!url || !name) {
      return NextResponse.json({ error: 'URL and name required' }, { status: 400 });
    }

    // Parse URL (ClawHub or GitHub)
    const parsed = parseClawHubUrl(url.trim());
    if (!parsed) {
      return NextResponse.json({ 
        error: 'Invalid URL. Use ClawHub (https://clawhub.ai/author/skill) or GitHub (https://github.com/user/repo.git)' 
      }, { status: 400 });
    }

    const targetPath = `~/.openclaw/workspace/skills/${name}`;
    
    // Check if already exists
    const exists = await sshExec(`test -d ${targetPath} && echo 'exists' || echo ''`);
    if (exists.stdout.trim()) {
      return NextResponse.json({ 
        error: `Skill "${name}" already exists` 
      }, { status: 409 });
    }

    if (parsed.isClawHub && parsed.path) {
      // ClawHub skill: clone the monorepo and extract specific skill
      const tempDir = `~/.openclaw/.tmp/skill-install-${Date.now()}`;
      
      // Clone with sparse checkout for efficiency
      await sshExec(`mkdir -p ${tempDir} && cd ${tempDir} && git init && git remote add origin ${parsed.repo} && git config core.sparseCheckout true`);
      await sshExec(`echo "${parsed.path}/" > ${tempDir}/.git/info/sparse-checkout`);
      const cloneResult = await sshExec(`cd ${tempDir} && git pull --depth=1 origin main 2>&1`);
      
      if (cloneResult.code !== 0) {
        // Try with master branch
        const masterResult = await sshExec(`cd ${tempDir} && git pull --depth=1 origin master 2>&1`);
        if (masterResult.code !== 0) {
          await sshExec(`rm -rf ${tempDir}`);
          throw new Error(cloneResult.stderr || 'Failed to clone repository');
        }
      }
      
      // Move the skill to target location
      await sshExec(`mkdir -p ~/.openclaw/workspace/skills && mv ${tempDir}/${parsed.path} ${targetPath} && rm -rf ${tempDir}`);
    } else {
      // Regular GitHub repo
      const result = await sshExec(`mkdir -p ~/.openclaw/workspace/skills && git clone "${parsed.repo}" ${targetPath} 2>&1`);
      
      if (result.stderr && result.code !== 0) {
        throw new Error(result.stderr);
      }
    }

    // Verify SKILL.md exists
    const skillCheck = await sshExec(`test -f ${targetPath}/SKILL.md && echo 'ok' || echo 'missing'`);
    
    if (skillCheck.stdout.trim() !== 'ok') {
      // Rollback - remove the cloned directory
      await sshExec(`rm -rf ${targetPath}`);
      return NextResponse.json({ 
        error: 'Invalid skill: SKILL.md not found in repository' 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Skill "${name}" installed successfully`,
      path: targetPath 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
