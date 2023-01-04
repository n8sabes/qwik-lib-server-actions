import { component$, Slot } from '@builder.io/qwik';
import { loader$ } from '@builder.io/qwik-city';
import Header from '../components/header/header';

export const rootLoader = loader$(() => {
  return {
    serverTime: new Date(). toISOString(),
    nodeVersion: process.version
  }
});

export default component$(() => {
  const root = rootLoader.use();

  return (
    <>
      <main>
        <Header />
        {root.value.serverTime}
        <section>
          <Slot />
        </section>
      </main>
      <footer>
        <a href="https://www.builder.io/" target="_blank">
          Made with ♡ by Builder.io
        </a>
      </footer>
    </>
  );
});
