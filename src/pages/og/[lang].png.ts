import type { APIRoute, GetStaticPaths } from 'astro';

export const prerender = true;
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

async function loadFont(): Promise<ArrayBuffer> {
  // Google Fonts API returns TTF when user agent is not a browser
  const css = await (await fetch(
    'https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap',
    { headers: { 'User-Agent': 'Mozilla/4.0' } }
  )).text();
  const match = css.match(/url\(([^)]+)\)/);
  if (!match) throw new Error('Font URL not found in CSS');
  return await (await fetch(match[1])).arrayBuffer();
}

export function getStaticPaths() {
  return [{ params: { lang: 'de' } }, { params: { lang: 'en' } }];
}

export const GET: APIRoute = async ({ params }) => {
  const lang = params.lang as 'de' | 'en';
  const isDE = lang === 'de';

  const fontData = await loadFont();

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 70px',
          background: '#ffffff',
          fontFamily: 'Inter',
          color: '#000000',
        },
        children: [
          // Top bar
          {
            type: 'div',
            props: {
              style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
              children: [
                {
                  type: 'span',
                  props: {
                    style: { fontSize: 22, color: '#c53350', letterSpacing: '0.15em', fontWeight: 700 },
                    children: 'AI FOR ACCESS',
                  },
                },
                {
                  type: 'span',
                  props: {
                    style: { fontSize: 18, color: '#555555' },
                    children: 'Powercoders × Tech & Beyond',
                  },
                },
              ],
            },
          },
          // Main content
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', gap: '16px' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 72,
                      fontWeight: 700,
                      lineHeight: 1.05,
                      color: '#000000',
                    },
                    children: isDE
                      ? '10 Jahre.\n10 Stunden.\n10× Output.'
                      : '10 Years.\n10 Hours.\n10× Output.',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { fontSize: 24, color: '#555555', maxWidth: '600px', lineHeight: 1.4 },
                    children: isDE
                      ? 'Du musst nicht coden können. Du musst ein Problem verstehen.'
                      : 'You don\'t need to code. You need to understand a problem.',
                  },
                },
              ],
            },
          },
          // Bottom bar
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid rgba(0,0,0,0.1)',
                paddingTop: '24px',
              },
              children: [
                {
                  type: 'span',
                  props: {
                    style: { fontSize: 20, color: '#c53350', fontWeight: 700 },
                    children: isDE ? '20.–21. November 2026' : 'November 20–21, 2026',
                  },
                },
                {
                  type: 'span',
                  props: {
                    style: { fontSize: 18, color: '#555555' },
                    children: 'Stadtkloster Frieden · Bern',
                  },
                },
                {
                  type: 'span',
                  props: {
                    style: {
                      fontSize: 16,
                      color: '#ffffff',
                      background: '#c53350',
                      padding: '6px 16px',
                      borderRadius: '4px',
                      fontWeight: 700,
                    },
                    children: isDE ? 'Nur 100 Plätze' : 'Only 100 spots',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Inter',
          data: fontData,
          weight: 700,
          style: 'normal',
        },
      ],
    }
  );

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  });

  return new Response(resvg.render().asPng(), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000' },
  });
};
