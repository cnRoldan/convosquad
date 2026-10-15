import { spawnSync } from 'node:child_process';
import process from 'node:process';
const build = spawnSync(process.execPath, ['node_modules/expo/bin/cli', 'export', '--clear', '--platform', 'web', '--output-dir', 'dist-ui'], {
  stdio: 'inherit', env: { ...process.env, EXPO_OFFLINE: '1', EXPO_NO_TELEMETRY: '1',
    EXPO_PUBLIC_SUPABASE_URL: 'https://auth.example.test', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser_fixture',
    EXPO_PUBLIC_AUTH_REDIRECT_URL: '', EXPO_PUBLIC_INVITE_BASE_URL: '',
  },
});
if (build.status !== 0) process.exit(build.status ?? 1);
const tests = spawnSync(process.execPath, ['--test', 'tests/ui/compact-call-up.test.mjs', 'tests/ui/ea-id-auth.test.mjs'], { stdio: 'inherit', env: process.env });
process.exit(tests.status ?? 1);
