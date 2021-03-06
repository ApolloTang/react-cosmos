// @flow

import { join, relative } from 'path';
import { createServer as createHttpServer } from 'http';
import promisify from 'util.promisify';
import express from 'express';
import launchEditor from 'react-dev-utils/launchEditor';
import { getPlaygroundHtml, getPlaygroundHtmlNext } from './playground-html';
import { setupHttpProxy } from './http-proxy';

import type { Config } from 'react-cosmos-flow/config';
import type { PlaygroundOpts } from 'react-cosmos-flow/playground';

export function createServerApp({
  cosmosConfig,
  playgroundOpts
}: {
  cosmosConfig: Config,
  playgroundOpts: PlaygroundOpts
}) {
  const { next, httpProxy } = cosmosConfig;
  const app = express();

  if (httpProxy) {
    setupHttpProxy(app, httpProxy);
  }

  const playgroundHtml = next
    ? getPlaygroundHtmlNext({
        rendererPreviewUrl:
          playgroundOpts.platform === 'web' ? playgroundOpts.loaderUri : null,
        enableRemoteRenderers: true
      })
    : getPlaygroundHtml(playgroundOpts);
  app.get('/', (req: express$Request, res: express$Response) => {
    res.send(playgroundHtml);
  });

  app.get('/_playground.js', (req: express$Request, res: express$Response) => {
    res.sendFile(
      require.resolve(
        next ? 'react-cosmos-playground2' : 'react-cosmos-playground'
      )
    );
  });

  app.get('/_cosmos.ico', (req: express$Request, res: express$Response) => {
    res.sendFile(join(__dirname, 'static/favicon.ico'));
  });

  return app;
}

export function createServer(cosmosConfig: Config, app: express$Application) {
  const { port, hostname } = cosmosConfig;
  const server = createHttpServer(app);

  async function startServer() {
    const listen = promisify(server.listen.bind(server));
    await listen(port, hostname);

    const hostnameDisplay = hostname || 'localhost';
    console.log(`[Cosmos] See you at http://${hostnameDisplay}:${port}`);
  }

  async function stopServer() {
    await promisify(server.close.bind(server))();
  }

  return { server, startServer, stopServer };
}

export function serveStaticDir(
  app: express$Application,
  publicUrl: string,
  publicPath: string
) {
  const relPublicPath = relative(process.cwd(), publicPath);
  console.log(`[Cosmos] Serving static files from ${relPublicPath}`);

  app.use(
    getRootUrl(publicUrl),
    express.static(publicPath, {
      // Ensure loader index (generated by html-webpack-plugin) loads instead
      // of the index.html from publicPath
      index: false
    })
  );
}

export function attachStackFrameEditorLauncher(app: express$Application) {
  app.get(
    '/__open-stack-frame-in-editor',
    (req: express$Request, res: express$Response) => {
      launchEditor(req.query.fileName, req.query.lineNumber);
      res.end();
    }
  );
}

export function getRootUrl(publicUrl: string) {
  // To enable deploying static exports running from inside a nested path,
  // publicUrl can be set to `./`.
  // (See https://github.com/react-cosmos/react-cosmos/issues/777)
  // But publicUrl is used in for some paths which must begin with `/`:
  // - As publicPath in webpack-dev-middleware
  // - As the Express path for serving static assets
  // These are server-side modules (running in dev server mode) that only
  // respond to incoming paths which begin with the root URL we specify.
  return publicUrl === './' ? '/' : publicUrl;
}
