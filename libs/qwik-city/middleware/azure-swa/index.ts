import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import type { RenderOptions } from '@builder.io/qwik';
import type { Render } from '@builder.io/qwik/server';
import qwikCityPlan from '@qwik-city-plan';
import { createHeaders, requestHandler } from '@builder.io/qwik-city/middleware/request-handler';
import type {
  RequestContext,
  ServerRenderOptions,
  ServerRequestEvent,
} from '@builder.io/qwik-city/middleware/request-handler';

// @builder.io/qwik-city/middleware/azure-swa

function createQwikRequest(req: HttpRequest): RequestContext {
  const url = req.headers['x-ms-original-url']!;

  const headers = createHeaders();
  for (const header in req.headers) {
    headers.set(header, req.headers[header]);
  }

  return {
    method: req.method || 'GET',
    url: url,
    headers,
    formData: () => Promise.resolve(new URLSearchParams(req.params)),
    json: req.body,
    text: req.rawBody,
  };
}

interface AzureResponse {
  status: number;
  headers: { [key: string]: any };
  body?: string;
}

/**
 * @alpha
 */
export function createQwikCity(opts: QwikCityAzureOptions): AzureFunction {
  async function onAzureSwaRequest(context: Context, req: HttpRequest): Promise<AzureResponse> {
    const res: AzureResponse = (context.res = {
      status: 200,
      headers: {},
    });
    const decoder = new TextDecoder();
    try {
      const qwikRequest = createQwikRequest(req);
      const serverRequestEv: ServerRequestEvent<AzureResponse> = {
        mode: 'server',
        locale: undefined,
        url: new URL(qwikRequest.url),
        platform: context,
        request: qwikRequest,
        getWritableStream: (status, headers, _cookies) => {
          res.status = status;
          headers.forEach((value, key) => (res.headers[key] = value));
          const writable = new WritableStream<Uint8Array>({
            write(chunk) {
              if (res.body) {
                res.body += decoder.decode(chunk);
              } else {
                res.body = decoder.decode(chunk);
              }
            },
            close() {},
          });
          return writable;
        },
      };

      // send request to qwik city request handler
      const handledResponse = await requestHandler(serverRequestEv, opts);
      if (handledResponse !== null) {
        const response = await handledResponse.response;
        if (response) {
          return response;
        }
        await handledResponse.requestEv;
      }

      // qwik city did not have a route for this request
      // respond with qwik city's 404 handler
      // const notFoundResponse = await notFoundHandler<void>(serverRequestEv);
      // return notFoundResponse;
      return res;
    } catch (e: any) {
      console.error(e);
      context.res = {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      };
      return res;
    }
  }

  return onAzureSwaRequest;
}

/**
 * @alpha
 */
export interface QwikCityAzureOptions extends ServerRenderOptions {}

/**
 * @alpha
 */
export interface EventPluginContext extends Context {}

/**
 * @alpha
 * @deprecated Please use `createQwikCity()` instead.
 *
 * Example:
 *
 * ```ts
 * import { createQwikCity } from '@builder.io/qwik-city/middleware/azure-swa';
 * import qwikCityPlan from '@qwik-city-plan';
 * import render from './entry.ssr';
 *
 * export default createQwikCity({ render, qwikCityPlan });
 * ```
 */
export function qwikCity(render: Render, opts?: RenderOptions) {
  return createQwikCity({ render, qwikCityPlan, ...opts });
}
