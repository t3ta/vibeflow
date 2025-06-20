import { Mastra } from '@mastra/core';
// import { planWorkflowConfig, refactorWorkflowConfig } from './workflow/simple-workflows';

export const mastra: Mastra = new Mastra({
  // Note: ワークフローAPIが変更されたため、一時的にワークフローを無効化
  // TODO: 最新のMastra APIに合わせてワークフローを再実装
  // workflows: { planWorkflowConfig, refactorWorkflowConfig }
});

export type VibeFlowMastra = Mastra;