export type DirectorStep = "brief" | "brand" | "mood" | "script" | "assets" | "qc" | "revise";

export type DirectorState = {
  step: DirectorStep;
  notes?: string;
};

const CAP_USD = 40;

export function enforceSpendCap(currentUsd: number, nextUsd: number): boolean {
  return currentUsd + nextUsd <= CAP_USD;
}

export async function runDirectorPipeline(_input: {
  brief: string;
  projectId?: string;
}): Promise<DirectorState> {
  void _input;
  return { step: "brief", notes: "Director graph scaffold — wire LLM steps per lib/director/*" };
}
