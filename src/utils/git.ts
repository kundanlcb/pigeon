import { invoke } from '@tauri-apps/api/core';

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await gitCommand(['rev-parse', '--is-inside-work-tree'], cwd);
    return true;
  } catch {
    return false;
  }
}

export async function gitInit(cwd: string) {
  return await gitCommand(['init'], cwd);
}

export async function gitRemoteAdd(cwd: string, url: string) {
  return await gitCommand(['remote', 'add', 'origin', url], cwd);
}

export async function gitCommand(args: string[], cwd: string): Promise<string> {
  return await invoke('git_command', { args, cwd });
}

export async function getGitStatus(cwd: string) {
  try {
    const output = await gitCommand(['status', '--porcelain'], cwd);
    const lines = output.split('\n').filter(Boolean);
    return lines.map(line => {
      const status = line.substring(0, 2);
      const file = line.substring(3);
      return { status, file };
    });
  } catch (e) {
    console.error("Git status error", e);
    return [];
  }
}

export async function gitAdd(cwd: string, files: string[]) {
  return await gitCommand(['add', ...files], cwd);
}

export async function gitCommit(cwd: string, message: string) {
  return await gitCommand(['commit', '-m', message], cwd);
}

export async function gitPush(cwd: string) {
  return await gitCommand(['push'], cwd);
}

export async function gitPull(cwd: string) {
  return await gitCommand(['pull'], cwd);
}

export async function gitBranch(cwd: string) {
  const output = await gitCommand(['branch', '--show-current'], cwd);
  return output.trim();
}

export async function gitBranches(cwd: string) {
  const output = await gitCommand(['branch'], cwd);
  return output.split('\n').filter(Boolean).map(b => b.replace('*', '').trim());
}

export async function gitCheckout(cwd: string, branch: string) {
  return await gitCommand(['checkout', branch], cwd);
}

export async function gitCheckoutNew(cwd: string, branch: string) {
  return await gitCommand(['checkout', '-b', branch], cwd);
}
