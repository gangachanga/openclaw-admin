import { NextRequest, NextResponse } from 'next/server';
import { sshReadFile } from '@/lib/ssh-client';

const CONFIG_PATH = '~/.openclaw/openclaw.json';

// Map agent IDs to their Telegram account keys
const AGENT_ACCOUNT_MAP: Record<string, string> = {
  main: 'personal',
  work: 'work',
  languages: 'languages',
  prophet: 'prophet',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const account = AGENT_ACCOUNT_MAP[agentId] || agentId;

  try {
    // Read config to get bot token
    const content = await sshReadFile(CONFIG_PATH);
    const config = JSON.parse(content);
    const botToken =
      config?.channels?.telegram?.accounts?.[account]?.botToken ||
      config?.channels?.telegram?.botToken;

    if (!botToken) {
      return NextResponse.json({ error: 'No bot token found' }, { status: 404 });
    }

    // Get bot info
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const me = await meRes.json();
    if (!me.ok) {
      return NextResponse.json({ error: 'Failed to get bot info' }, { status: 500 });
    }

    // Get profile photo
    const photosRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${me.result.id}&limit=1`
    );
    const photos = await photosRes.json();

    if (!photos.ok || photos.result.total_count === 0) {
      return NextResponse.json({ error: 'No profile photo' }, { status: 404 });
    }

    // Get largest size (last in array)
    const fileId = photos.result.photos[0].slice(-1)[0].file_id;
    const fileRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    const file = await fileRes.json();

    if (!file.ok) {
      return NextResponse.json({ error: 'Failed to get file' }, { status: 500 });
    }

    // Download the image
    const imageRes = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${file.result.file_path}`
    );
    const imageBuffer = await imageRes.arrayBuffer();

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 min cache
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
