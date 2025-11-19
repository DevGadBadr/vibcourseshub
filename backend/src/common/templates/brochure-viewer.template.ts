/**
 * HTML template for course brochure viewer
 */
export function generateBrochureViewerHtml(slug: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Course Brochure</title>
  <style>
    html,body{height:100%;margin:0;padding:0;overflow:hidden}
    #pdf-container,#pdf-fallback{width:100%;height:100%;border:none;display:block}
  </style>
</head>
<body>
  <object id="pdf-container" data="/courses/${slug}/brochure/file" type="application/pdf" width="100%" height="100%">
    <iframe id="pdf-fallback" src="/courses/${slug}/brochure/file" width="100%" height="100%"></iframe>
  </object>
</body>
</html>`;
}

