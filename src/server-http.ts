#!/usr/bin/env node
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createDomainMcpServer } from './server.js';

const host = process.env.MCP_HOST || '127.0.0.1';
const port = Number(process.env.MCP_PORT || 3015);

const app = express();
app.use(cors({ origin: '*', exposedHeaders: ['Mcp-Session-Id'] }));
app.use(express.json());

const transports = new Map<string, StreamableHTTPServerTransport>();

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'complete-tech-domain-suite',
    transport: 'streamable_http',
    timestamp: new Date().toISOString(),
  });
});

async function handleMcpPost(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport | undefined;

    if (sessionId) {
      transport = transports.get(sessionId);
      if (!transport) {
        res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Unknown MCP session',
          },
          id: null,
        });
        return;
      }
    } else if (isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (initializedSessionId) => {
          transports.set(initializedSessionId, transport!);
        },
      });

      transport.onclose = () => {
        if (transport?.sessionId) {
          transports.delete(transport.sessionId);
        }
      };

      const server = createDomainMcpServer();
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Missing session ID or initialize request',
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal server error',
        },
        id: null,
      });
    }
  }
}

async function handleMcpGet(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId) {
    res.status(400).send('Missing Mcp-Session-Id header');
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).send('Unknown MCP session');
    return;
  }

  await transport.handleRequest(req, res);
}

async function handleMcpDelete(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId) {
    res.status(400).send('Missing Mcp-Session-Id header');
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).send('Unknown MCP session');
    return;
  }

  await transport.handleRequest(req, res);
}

app.post('/mcp', (req, res) => {
  void handleMcpPost(req, res);
});

app.get('/mcp', (req, res) => {
  void handleMcpGet(req, res);
});

app.delete('/mcp', (req, res) => {
  void handleMcpDelete(req, res);
});

const listener = app.listen(port, host, () => {
  console.log(`Complete Tech Domain Suite HTTP MCP listening on http://${host}:${port}/mcp`);
});

process.on('SIGINT', async () => {
  listener.close();
  for (const transport of transports.values()) {
    await transport.close();
  }
  process.exit(0);
});
