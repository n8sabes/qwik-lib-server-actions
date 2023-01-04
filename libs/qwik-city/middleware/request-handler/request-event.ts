import type { PathParams } from '@builder.io/qwik-city';
import type {
  RequestEvent,
  RequestEventLoader,
  ServerRequestEvent,
  ServerRequestMode,
  RequestHandler,
  RequestEventCommon,
} from './types';
import type {
  ServerAction,
  ServerActionInternal,
  ServerLoader,
  ServerLoaderInternal,
} from '../../runtime/src/server-functions';
import { Cookie } from './cookie';
import { createHeaders } from './headers';
import { ErrorResponse } from './error-handler';
import { AbortMessage, RedirectMessage } from './redirect-handler';
import { encoder } from './resolve-request-handlers';
import { createCacheControl } from './cache-control';

const RequestEvLoaders = Symbol('RequestEvLoaders');
const RequestEvLocale = Symbol('RequestEvLocale');
const RequestEvMode = Symbol('RequestEvMode');
const RequestEvStatus = Symbol('RequestEvStatus');
export const RequestEvAction = Symbol('RequestEvAction');

export function createRequestEvent(
  serverRequestEv: ServerRequestEvent,
  params: PathParams,
  requestHandlers: RequestHandler<unknown>[],
  resolved: (response: any) => void
) {
  const { request, platform } = serverRequestEv;

  const cookie = new Cookie(request.headers.get('cookie'));
  const headers = createHeaders();
  const url = new URL(request.url);

  let routeModuleIndex = -1;
  let writableStream: WritableStream<Uint8Array> | null = null;

  const next = async () => {
    routeModuleIndex++;

    while (routeModuleIndex < requestHandlers.length) {
      const moduleRequestHandler = requestHandlers[routeModuleIndex];
      const result = moduleRequestHandler(requestEv);
      if (result instanceof Promise) {
        await result;
      }
      routeModuleIndex++;
    }
  };

  const check = () => {
    if (writableStream !== null) {
      throw new Error('Response already sent');
    }
  };

  const send = (statusCode: number, body: string | Uint8Array) => {
    check();

    requestEv[RequestEvStatus] = statusCode;
    const writableStream = requestEv.getWritableStream();
    const writer = writableStream.getWriter();
    writer.write(typeof body === 'string' ? encoder.encode(body) : body);
    writer.close();
    return new AbortMessage();
  };

  const loaders: Record<string, Promise<any>> = {};

  const requestEv: RequestEventInternal = {
    [RequestEvLoaders]: loaders,
    [RequestEvLocale]: serverRequestEv.locale,
    [RequestEvMode]: serverRequestEv.mode,
    [RequestEvStatus]: 200,
    [RequestEvAction]: undefined,
    cookie,
    headers,
    method: request.method,
    params,
    pathname: url.pathname,
    platform,
    query: url.searchParams,
    request,
    url,
    sharedMap: new Map(),
    get headersSent() {
      return writableStream !== null;
    },
    get exited() {
      return routeModuleIndex >= ABORT_INDEX;
    },

    next,

    exit: () => {
      routeModuleIndex = ABORT_INDEX;
      return new AbortMessage();
    },

    cacheControl: (cacheControl) => {
      check();
      headers.set('Cache-Control', createCacheControl(cacheControl));
    },

    getData: (loaderOrAction: ServerAction<any> | ServerLoader<any>) => {
      // create user request event, which is a narrowed down request context
      const id = (loaderOrAction as ServerLoaderInternal | ServerActionInternal).__qrl.getHash();

      if (
        (loaderOrAction as ServerLoaderInternal | ServerActionInternal).__brand === 'server_loader'
      ) {
        if (id in loaders) {
          throw new Error('Loader data does not exist');
        }
      }

      return loaders[id];
    },

    status: (statusCode?: number) => {
      if (typeof statusCode === 'number') {
        check();
        requestEv[RequestEvStatus] = statusCode;
        return statusCode;
      }
      return requestEv[RequestEvStatus];
    },

    locale: (locale?: string) => {
      if (typeof locale === 'string') {
        requestEv[RequestEvLocale] = locale;
      }
      return requestEv[RequestEvLocale] || '';
    },

    error: (statusCode: number, message: string) => {
      requestEv[RequestEvStatus] = statusCode;
      headers.delete('Cache-Control');
      return new ErrorResponse(statusCode, message);
    },

    redirect: (statusCode: number, url: string) => {
      check();
      requestEv[RequestEvStatus] = statusCode;
      headers.set('Location', url);
      headers.delete('Cache-Control');
      if (statusCode > 301) {
        headers.set('Cache-Control', 'no-store');
      }
      return new RedirectMessage();
    },

    fail: (statusCode: number, data: any) => {
      check();
      requestEv[RequestEvStatus] = statusCode;
      headers.delete('Cache-Control');
      return data;
    },

    text: (statusCode: number, text: string) => {
      headers.set('Content-Type', 'text/plain; charset=utf-8');
      return send(statusCode, text);
    },

    html: (statusCode: number, html: string) => {
      headers.set('Content-Type', 'text/html; charset=utf-8');
      return send(statusCode, html);
    },

    json: (statusCode: number, data: any) => {
      headers.set('Content-Type', 'application/json; charset=utf-8');
      return send(statusCode, JSON.stringify(data));
    },

    send,

    getWritableStream: () => {
      if (writableStream === null) {
        writableStream = serverRequestEv.getWritableStream(
          requestEv[RequestEvStatus],
          headers,
          cookie,
          resolved,
          requestEv
        );
      }
      return writableStream;
    },
  };

  return requestEv;
}

export interface RequestEventInternal extends RequestEvent, RequestEventLoader {
  [RequestEvLoaders]: Record<string, Promise<any>>;
  [RequestEvLocale]: string | undefined;
  [RequestEvMode]: ServerRequestMode;
  [RequestEvStatus]: number;
  [RequestEvAction]: string | undefined;
}

export function getRequestLoaders(requestEv: RequestEventCommon) {
  return (requestEv as RequestEventInternal)[RequestEvLoaders];
}

export function getRequestAction(requestEv: RequestEventCommon) {
  return (requestEv as RequestEventInternal)[RequestEvAction];
}

export function setRequestAction(requestEv: RequestEventCommon, id: string) {
  (requestEv as RequestEventInternal)[RequestEvAction] = id;
}

export function getRequestMode(requestEv: RequestEventCommon) {
  return (requestEv as RequestEventInternal)[RequestEvMode];
}

const ABORT_INDEX = 999999999;
