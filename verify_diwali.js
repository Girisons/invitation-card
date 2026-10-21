async function check() {
  const res = await fetch('https://khandelwalinvite.vercel.app/i/FAEV7?type=main_diwali');
  const html = await res.text();
  const ogTitle = html.match(/property="og:title" content="([^"]+)"/);
  const ogDesc = html.match(/property="og:description" content="([^"]+)"/);
  console.log('og:title:', ogTitle ? ogTitle[1] : null);
  console.log('og:description:', ogDesc ? ogDesc[1] : null);
}
check();
