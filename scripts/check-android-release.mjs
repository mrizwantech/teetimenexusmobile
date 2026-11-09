import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function checkOptimization(metadata) {
  const categories = {
    optimization: ['isOptimizationsEnabled', 'noOptimizationPercentage'],
    shrinking: ['isShrinkingEnabled', 'noShrinkingPercentage'],
    obfuscation: ['isObfuscationEnabled', 'noObfuscationPercentage'],
  };
  if (metadata?.options?.isDebugModeEnabled !== false) {
    throw new Error('Expected release-mode R8 metadata.');
  }
  const scores = {};
  for (const [category, [enabled, excluded]] of Object.entries(categories)) {
    if (metadata.options[enabled] !== true) {
      throw new Error(`R8 ${category} is disabled.`);
    }
    const value = metadata.stats?.[excluded];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`Missing or invalid R8 ${category} percentage.`);
    }
    // R8 records the percentage excluded from each optimization, not the score.
    const score = 100 - value;
    if (score < 25) {
      throw new Error(`R8 ${category}: ${score.toFixed(2)}% is below the 25% minimum.`);
    }
    scores[category] = score;
  }
  return scores;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3 || !process.argv[2].endsWith('.aab')) {
      throw new Error('Usage: npm run android:verify-release -- /path/to/release.aab');
    }
    const json = execFileSync('unzip', [
      '-p', resolve(process.argv[2]), 'BUNDLE-METADATA/com.android.tools/r8.json',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const scores = checkOptimization(JSON.parse(json));
    for (const [category, score] of Object.entries(scores)) {
      console.log(`${category}: ${score.toFixed(2)}% (minimum 25%)`);
    }
  } catch (error) {
    console.error(`Android release verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
