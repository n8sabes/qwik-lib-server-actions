import { withLocale } from '@builder.io/qwik';
import type { ServerLoaderInternal } from './server-functions';
import type {
  ContentModule,
  GetData,
  RouteLocation,
  EndpointResponse,
  ResolvedDocumentHead,
  DocumentHeadProps,
  DocumentHeadValue,
  ClientPageData,
} from './types';

export const resolveHead = async (
  endpoint: EndpointResponse | ClientPageData | undefined | null,
  routeLocation: RouteLocation,
  contentModules: ContentModule[],
  locale: string
) => {
  const head = createDocumentHead();
  const getData = ((loader: ServerLoaderInternal) =>
    endpoint?.loaders[loader.__qrl.getHash()]) as any as GetData;
  const headProps: DocumentHeadProps = {
    head,
    withLocale: (fn) => withLocale(locale, fn),
    getData,
    ...routeLocation,
  };

  for (let i = contentModules.length - 1; i >= 0; i--) {
    const contentModuleHead = contentModules[i] && contentModules[i].head;
    if (contentModuleHead) {
      if (typeof contentModuleHead === 'function') {
        resolveDocumentHead(
          head,
          withLocale(locale, () => contentModuleHead(headProps))
        );
      } else if (typeof contentModuleHead === 'object') {
        resolveDocumentHead(head, contentModuleHead);
      }
    }
  }

  return headProps.head;
};

const resolveDocumentHead = (
  resolvedHead: ResolvedDocumentHead,
  updatedHead: DocumentHeadValue
) => {
  if (typeof updatedHead.title === 'string') {
    resolvedHead.title = updatedHead.title;
  }
  mergeArray(resolvedHead.meta, updatedHead.meta);
  mergeArray(resolvedHead.links, updatedHead.links);
  mergeArray(resolvedHead.styles, updatedHead.styles);
  Object.assign(resolvedHead.frontmatter, updatedHead.frontmatter);
};

const mergeArray = (existingArr: { key?: string }[], newArr: { key?: string }[] | undefined) => {
  if (Array.isArray(newArr)) {
    for (const newItem of newArr) {
      if (typeof newItem.key === 'string') {
        const existingIndex = existingArr.findIndex((i) => i.key === newItem.key);
        if (existingIndex > -1) {
          existingArr[existingIndex] = newItem;
          continue;
        }
      }
      existingArr.push(newItem);
    }
  }
};

export const createDocumentHead = (): ResolvedDocumentHead => ({
  title: '',
  meta: [],
  links: [],
  styles: [],
  frontmatter: {},
});
