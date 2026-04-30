import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeTool, tools } from './tools.js';

export function createDomainMcpServer(): McpServer {
  const server = new McpServer({
    name: 'complete-tech-domain-suite',
    version: '0.1.0',
    title: 'Complete Tech Domain Suite',
  });

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await executeTool(tool.name, args);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}
