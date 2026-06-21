type ThemedBrochureStyleTheme = {
  primaryColor: string
  accentColor: string
  backgroundColor: string
  surfaceColor: string
  textColor: string
  mutedTextColor: string
  borderColor: string
  fontFamily: string
}

export function renderThemedBrochureStyles(theme: ThemedBrochureStyleTheme) {
  return `
    :root {
      --brand-primary: ${theme.primaryColor};
      --brand-accent: ${theme.accentColor};
      --page-bg: ${theme.backgroundColor};
      --surface: ${theme.surfaceColor};
      --text: ${theme.textColor};
      --muted: ${theme.mutedTextColor};
      --border: ${theme.borderColor};
      --font: ${theme.fontFamily};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      background: var(--page-bg);
      font-family: var(--font);
      line-height: 1.5;
    }
    .brochure-cover {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.85fr);
      min-height: 82vh;
      background: var(--surface);
      page-break-after: always;
    }
    .cover-image {
      width: 100%;
      height: 100%;
      min-height: 32rem;
      object-fit: cover;
    }
    .cover-copy {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1.5rem;
      padding: 4rem;
      border-left: 0.5rem solid var(--brand-accent);
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: var(--brand-primary);
      font-size: 0.875rem;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .brand-logo {
      width: 2.5rem;
      height: 2.5rem;
      object-fit: contain;
    }
    h1, h2, h3, p { margin-top: 0; }
    h1 {
      margin-bottom: 0;
      color: var(--brand-primary);
      font-size: 3.25rem;
      line-height: 1.05;
    }
    h2 {
      color: var(--brand-primary);
      font-size: 1.75rem;
      line-height: 1.2;
    }
    h3 {
      color: var(--brand-primary);
      font-size: 1.1rem;
      margin-bottom: 0.35rem;
    }
    .dek {
      color: var(--muted);
      font-size: 1.05rem;
    }
    .cover-facts {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      margin: 0;
    }
    .cover-facts div {
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 0.5rem;
    }
    dt {
      color: var(--muted);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    dd {
      margin: 0.25rem 0 0;
      font-weight: 700;
    }
    .brochure-section {
      max-width: 64rem;
      margin: 0 auto;
      padding: 3rem 2rem;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    .rich-body :is(h1, h2, h3) {
      color: var(--brand-primary);
    }
    .rich-body img {
      max-width: 100%;
    }
    .media-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }
    figure {
      margin: 0;
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      overflow: hidden;
    }
    figure img {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
    }
    figcaption {
      padding: 0.75rem;
      color: var(--muted);
      font-size: 0.85rem;
    }
    .day {
      display: grid;
      grid-template-columns: 6rem minmax(0, 1fr);
      gap: 1.5rem;
      padding: 1.25rem 0;
      border-top: 1px solid var(--border);
    }
    .day-number {
      color: var(--brand-accent);
      font-weight: 800;
    }
    .muted,
    .day li span {
      color: var(--muted);
    }
    .day ul {
      margin: 1rem 0 0;
      padding-left: 1.25rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 0.75rem;
      border-bottom: 1px solid var(--border);
      text-align: left;
    }
    th {
      color: var(--muted);
      font-size: 0.75rem;
      text-transform: uppercase;
    }
    .brochure-footer {
      max-width: 64rem;
      margin: 0 auto;
      padding: 2rem;
      color: var(--muted);
      font-size: 0.85rem;
    }
    @media (max-width: 760px) {
      .brochure-cover,
      .day {
        grid-template-columns: 1fr;
      }
      .cover-copy {
        padding: 2rem;
        border-left: 0;
        border-top: 0.5rem solid var(--brand-accent);
      }
      h1 {
        font-size: 2.25rem;
      }
      .cover-facts,
      .media-grid {
        grid-template-columns: 1fr;
      }
    }
    @page {
      margin: 18mm;
    }
  `
}
