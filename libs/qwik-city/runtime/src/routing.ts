import { MODULE_CACHE } from './constants';
import type {
  ContentMenu,
  LoadedRoute,
  MenuData,
  MenuModule,
  ModuleLoader,
  RouteData,
  RouteModule,
  PathParams,
} from './types';

export const CACHE = new Map<RouteData, Promise<any>>();
/**
 * loadRoute() runs in both client and server.
 */
export const loadRoute = async (
  routes: RouteData[] | undefined,
  menus: MenuData[] | undefined,
  cacheModules: boolean | undefined,
  pathname: string
): Promise<LoadedRoute | null> => {
  if (Array.isArray(routes)) {
    for (const route of routes) {
      const match = route[0].exec(pathname);
      if (match) {
        const loaders = route[1];
        const params = getPathParams(route[2], match);
        const routeBundleNames = route[4];
        const mods: RouteModule[] = new Array(loaders.length);
        const pendingLoads: Promise<any>[] = [];
        const menuLoader = getMenuLoader(menus, pathname);
        let menu: ContentMenu | undefined = undefined;

        loaders.forEach((moduleLoader, i) => {
          loadModule<RouteModule>(
            moduleLoader,
            pendingLoads,
            (routeModule) => (mods[i] = routeModule),
            cacheModules
          );
        });

        loadModule<MenuModule>(
          menuLoader,
          pendingLoads,
          (menuModule) => (menu = menuModule?.default),
          cacheModules
        );

        if (pendingLoads.length > 0) {
          await Promise.all(pendingLoads);
        }

        return [params, mods, menu, routeBundleNames];
      }
    }
  }
  return null;
};

const loadModule = <T>(
  moduleLoader: ModuleLoader | undefined,
  pendingLoads: Promise<any>[],
  moduleSetter: (loadedModule: T) => void,
  cacheModules: boolean | undefined
) => {
  if (typeof moduleLoader === 'function') {
    const loadedModule = MODULE_CACHE.get(moduleLoader);
    if (loadedModule) {
      moduleSetter(loadedModule);
    } else {
      const l: any = moduleLoader();
      if (typeof l.then === 'function') {
        pendingLoads.push(
          l.then((loadedModule: any) => {
            if (cacheModules !== false) {
              MODULE_CACHE.set(moduleLoader, loadedModule);
            }
            moduleSetter(loadedModule);
          })
        );
      } else if (l) {
        moduleSetter(l);
      }
    }
  }
};

export const getMenuLoader = (menus: MenuData[] | undefined, pathname: string) => {
  if (menus) {
    pathname = pathname.endsWith('/') ? pathname : pathname + '/';
    const menu = menus.find(
      (m) => m[0] === pathname || pathname.startsWith(m[0] + (pathname.endsWith('/') ? '' : '/'))
    );
    if (menu) {
      return menu[1];
    }
  }
};

export const getPathParams = (paramNames: string[] | undefined, match: RegExpExecArray | null) => {
  const params: PathParams = {};
  let i: number;
  let param: string;

  if (paramNames) {
    for (i = 0; i < paramNames.length; i++) {
      param = match ? match[i + 1] : '';
      params[paramNames[i]] = param.endsWith('/') ? param.slice(0, -1) : param;
    }
  }

  return params;
};
