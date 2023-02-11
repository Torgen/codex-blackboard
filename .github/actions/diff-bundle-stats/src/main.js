import * as core from '@actions/core';
import * as glob from '@actions/glob';
import { promises as fs } from 'fs';

async function getStatsFile(name) {
  const globber = await glob.create(`${name}/*.stats.json`);
  const files = await globber.glob();
  if (files.length != 1) {
    throw new Error(`Need exactly one ${name} stats file`);
  }
  const contents = await fs.readFile(files[0]);
  return JSON.parse(contents);
}

async function getCssSize(name) {
  const globber = await glob.create(`${name}/*.css`);
  const files = await globber.glob();
  if (files.length != 1) {
    throw new Error(`Need exactly one ${name} css file`);
  }
  const stat = await fs.stat(files[0]);
  return stat.size;
}

function recursiveSum(tree) {
  let sum = 0;
  for (const key in tree) {
    const value = tree[key];
    if (typeof value === 'number') {
      sum += value;
    } else {
      sum += recursiveSum(value);
    }
  }
  return sum;
}

function updateMap(map, mapKey, objKey, value) {
  let stats = map.get(mapKey);
  if (!stats) {
    stats = {};
    map.set(mapKey, stats);
  }
  stats[objKey] = value;
}

async function main() {
  try {
    const [base_stats, head_stats, base_css, head_css] = await Promise.all([getStatsFile('base'), getStatsFile('head'), getCssSize('base'), getCssSize('head')]);
    const minifiedDiff = head_stats.totalMinifiedBytes - base_stats.totalMinifiedBytes;
    const minifiedGzipDiff = head_stats.totalMinifiedGzipBytes - base_stats.totalMinifiedGzipBytes;
    const cssDiff = head_css - base_css;
    const meteorPackageStats = new Map();
    const nodeModuleStats = new Map();
    function updateStats(name, byPackage) {
      for (const pkg in byPackage) {
        const value = byPackage[pkg];
        if (pkg === "packages/modules.js") {
          if (!(value instanceof Array)) {
            continue;
          }
          const modules = value[1].node_modules;
          if (!modules) {
            continue;
          }
          for (const module in modules) {
            const moduleTree = modules[module];
            if (module.startsWith('@')) {
              for (const submodule in moduleTree) {
                updateMap(nodeModuleStats, `${module}/${submodule}`, name, recursiveSum(moduleTree[submodule]));
              }
            } else {
              updateMap(nodeModuleStats, module, name, recursiveSum(moduleTree));
            }
          }
        } else if (pkg !== 'packages/bundle-visualizer.js') {
          const match = pkg.match(/packages\/(.*)\.js/);
          const legible = match ? match[1] : pkg;
          let size;
          if (typeof value === 'number') {
            size = value;
          } else if (value instanceof Array) {
            size = value[0]
          }
          updateMap(meteorPackageStats, legible, name, size);
        }
      }
    }
    updateStats('base', base_stats.minifiedBytesByPackage);
    updateStats('head', head_stats.minifiedBytesByPackage);
    const bundleDiff = minifiedDiff !== 0 || minifiedGzipDiff !== 0 | cssDiff !== 0;
    function clearSame({base, head}, key, map) {
      if (base === head) {
        map.delete(key);
      }
    }
    meteorPackageStats.forEach(clearSame);
    const packageDiff = meteorPackageStats.size > 0;
    nodeModuleStats.forEach(clearSame);
    const moduleDiff = nodeModuleStats.size > 0;
    if (!bundleDiff && !packageDiff && !moduleDiff) {
      core.setOutput('diff', 'No difference in output size');
      return;
    }
    const outputLines = [];
    function printDiffLine(label, base, head) {
      base ||= 0;
      head ||= 0;
      const diff = head - base;
      if (diff === 0) { return; }
      outputLines.push(`| ${label} | ${base} | ${head} | ${diff>0 ? '+' : ''}${diff}`)
    }
    function printEntryStats({base, head}, key) {
      printDiffLine(key, base, head);
    }
    if (bundleDiff) {
      outputLines.push(
        'Bundle size diff:', '',
        '| Format | Base | Head | Diff |',
        '| --- | --- | --- | --- |'
      );
      printDiffLine('Minified', base_stats.totalMinifiedBytes, head_stats.totalMinifiedBytes);
      printDiffLine('Gzipped', base_stats.totalMinifiedGzipBytes, head_stats.totalMinifiedGzipBytes);
      printDiffLine('CSS', base_css, head_css);
    } else {
      outputLines.push('No change in bundle size.');
    }
    outputLines.push('');
    if (packageDiff) {
      outputLines.push(
        'Meteor Package size diff:', '',
        '| Package | Base | Head | Diff |',
        '| --- | --- | --- | --- |'
      );
      meteorPackageStats.forEach(printEntryStats);
    } else {
      outputLines.push('No change in Meteor package sizes.');
    }
    outputLines.push('');
    if (moduleDiff) {
      outputLines.push(
        'Top-level Node Module size diff:', '',
        '| Module | Base | Head | Diff |',
        '| --- | --- | --- | --- |'
      );
      nodeModuleStats.forEach(printEntryStats);
    } else {
      outputLines.push('No change in top-level node module sizes.');
    }
    outputLines.push('');
    core.setOutput('diff', outputLines.join('\n'));
  } catch (error) {
    core.setFailed(error);
    core.error(error.stack);
  }
}

await main();
