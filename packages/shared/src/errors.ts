export const ERROR_CODES = ['INVALID_INPUT', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT', 'INTERNAL'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Business/validation error. MCP layer maps it to a tool execution error (isError: true). */
export class ToolError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}
