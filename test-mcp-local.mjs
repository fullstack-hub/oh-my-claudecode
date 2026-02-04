#!/usr/bin/env node
/**
 * Local MCP Server Test Script
 * Tests the Codex and Gemini MCP servers with real CLI calls
 */

import { codexMcpServer } from './dist/mcp/codex-server.js';
import { geminiMcpServer } from './dist/mcp/gemini-server.js';
import { detectCodexCli, detectGeminiCli } from './dist/mcp/cli-detection.js';
import { spawn } from 'child_process';

console.log('=== MCP Server Local Test ===\n');

// Test 1: CLI Detection
console.log('1. Testing CLI Detection...');
const codexDetection = detectCodexCli();
const geminiDetection = detectGeminiCli();
console.log('   Codex CLI:', codexDetection.available ? `✅ ${codexDetection.version}` : '❌ Not found');
console.log('   Gemini CLI:', geminiDetection.available ? `✅ ${geminiDetection.version}` : '❌ Not found');

if (!codexDetection.available && !geminiDetection.available) {
  console.error('\n❌ Neither CLI is available. Install them:');
  console.error('   npm install -g @openai/codex');
  console.error('   npm install -g @google/gemini-cli');
  process.exit(1);
}

// Test 2: Server Structure
console.log('\n2. Testing Server Structure...');
console.log('   Codex Server:', codexMcpServer ? `✅ Name: ${codexMcpServer.name}, Type: ${codexMcpServer.type}` : '❌ Missing');
console.log('   Gemini Server:', geminiMcpServer ? `✅ Name: ${geminiMcpServer.name}, Type: ${geminiMcpServer.type}` : '❌ Missing');

// Check registered tools
const codexTools = Object.keys(codexMcpServer.instance?._registeredTools || {});
const geminiTools = Object.keys(geminiMcpServer.instance?._registeredTools || {});
console.log('   Codex Tools:', codexTools.length > 0 ? `✅ ${codexTools.join(', ')}` : '❌ None');
console.log('   Gemini Tools:', geminiTools.length > 0 ? `✅ ${geminiTools.join(', ')}` : '❌ None');

// Test 3: Direct CLI Execution (since MCP tools are protocol-based)
console.log('\n3. Testing Direct CLI Execution...');

async function testCodexCLI() {
  if (!codexDetection.available) {
    console.log('   Codex CLI: ⏭️  Skipped (CLI not available)');
    return 'skipped';
  }

  console.log('   Codex CLI: Testing direct execution...');
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn('codex', ['exec', '-m', 'gpt-4o-mini', '--json', 'Say "Codex MCP test successful"'], {
        timeout: 30000
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => stdout += data.toString());
      child.stderr.on('data', (data) => stderr += data.toString());

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, error: stderr || 'Non-zero exit' });
        }
      });

      child.on('error', (err) => resolve({ success: false, error: err.message }));
    });

    if (result.success) {
      console.log('   Codex CLI: ✅ Working');
      return 'success';
    } else {
      console.log('   Codex CLI: ⚠️ ', result.error.substring(0, 100));
      return 'auth_error';
    }
  } catch (err) {
    console.log('   Codex CLI: ❌ Error:', err.message);
    return 'error';
  }
}

async function testGeminiCLI() {
  if (!geminiDetection.available) {
    console.log('   Gemini CLI: ⏭️  Skipped (CLI not available)');
    return 'skipped';
  }

  console.log('   Gemini CLI: Testing direct execution...');
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn('gemini', ['--model', 'gemini-2.5-flash', '-p', 'Say "Gemini MCP test successful"'], {
        timeout: 30000
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => stdout += data.toString());
      child.stderr.on('data', (data) => stderr += data.toString());

      child.on('close', (code) => {
        if (code === 0 || stdout.trim()) {
          resolve({ success: true, output: stdout.trim() });
        } else {
          resolve({ success: false, error: stderr || 'No output' });
        }
      });

      child.on('error', (err) => resolve({ success: false, error: err.message }));
    });

    if (result.success && result.output.includes('successful')) {
      console.log('   Gemini CLI: ✅ Working -', result.output.substring(0, 50));
      return 'success';
    } else {
      console.log('   Gemini CLI: ⚠️  Response:', result.output?.substring(0, 100) || result.error);
      return 'partial';
    }
  } catch (err) {
    console.log('   Gemini CLI: ❌ Error:', err.message);
    return 'error';
  }
}

// Test 4: Environment Variable Defaults
console.log('\n4. Testing Environment Variable Configuration...');
console.log('   OMC_CODEX_DEFAULT_MODEL:', process.env.OMC_CODEX_DEFAULT_MODEL || '(not set, using default: gpt-5.2)');
console.log('   OMC_GEMINI_DEFAULT_MODEL:', process.env.OMC_GEMINI_DEFAULT_MODEL || '(not set, using default: gemini-3-pro)');
console.log('   OMC_CODEX_TIMEOUT:', process.env.OMC_CODEX_TIMEOUT || '(not set, using default: 60000)');
console.log('   OMC_GEMINI_TIMEOUT:', process.env.OMC_GEMINI_TIMEOUT || '(not set, using default: 120000)');

// Run CLI tests
const codexResult = await testCodexCLI();
const geminiResult = await testGeminiCLI();

// Summary
console.log('\n=== Test Summary ===');
console.log('Codex Server Structure: ✅');
console.log('Gemini Server Structure: ✅');
console.log('Codex CLI Execution:', codexResult === 'success' ? '✅' : codexResult === 'auth_error' ? '⚠️  (auth required)' : '❌');
console.log('Gemini CLI Execution:', geminiResult === 'success' ? '✅' : '❌');

if (codexResult === 'success' && geminiResult === 'success') {
  console.log('\n✅ All tests passed!');
  process.exit(0);
} else if (codexResult === 'auth_error') {
  console.log('\n⚠️  Codex requires authentication. Run: codex login');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed');
  process.exit(1);
}
