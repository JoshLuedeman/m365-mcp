import { createInterface } from 'readline';
import { createReadStream } from 'fs';

function createRl(): ReturnType<typeof createInterface> {
  // Read from /dev/tty directly so stdin is not consumed when running as MCP server.
  // Fall back to process.stdin if /dev/tty is unavailable (CI, Windows, etc.).
  let input: NodeJS.ReadableStream;
  try {
    input = createReadStream('/dev/tty');
  } catch {
    input = process.stdin;
  }

  return createInterface({
    input,
    output: process.stderr,
    terminal: true,
  });
}

export async function question(prompt: string): Promise<string> {
  const rl = createRl();
  return new Promise<string>((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function confirm(prompt: string, defaultYes = false): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await question(`${prompt} ${hint}: `);
  if (answer === '') {
    return defaultYes;
  }
  return answer.toLowerCase().startsWith('y');
}
