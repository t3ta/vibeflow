// VibeFlowで使用するClaude Codeツールの定義

export const BOUNDARY_EXTRACTION_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'mcp__typescript',
  'mcp__ast-grep',
];

export const ARCHITECTURE_DESIGN_TOOLS = [
  'Read',
  'Write',
];

export const REFACTORING_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'Grep',
  'Glob',
  'mcp__typescript',
  'mcp__ast-grep',
];

export const TEST_SYNTHESIS_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'Grep',
  'Glob',
];

export const MIGRATION_TOOLS = [
  'Bash',
  'Read',
  'mcp__git',
];

export const REVIEW_TOOLS = [
  'Read',
  'Grep',
  'mcp__git',
];

// MCP設定の型定義
export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

// VibeFlow用のMCP設定
export const VIBEFLOW_MCP_CONFIG: MCPConfig = {
  mcpServers: {
    typescript: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-typescript'],
    },
    'ast-grep': {
      command: 'npx',
      args: ['-y', '@ast-grep/mcp'],
    },
    git: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-git'],
    },
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '--read-only'],
    },
  },
};