// Fixed scenes for screenshots: ?shot=editor shows the page with the sample
// photos loaded; ?shot=cover shows the finished cover alone at the requested
// size (?size=square|portrait|wide, ?photo=boulevard|pier,
// ?caption=..., ?subtitle=...). window.__shotReady is set once painted.
export async function runShot(shot, query, applyScene) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await applyScene({
    mode: shot === 'cover' ? 'cover' : 'editor',
    size: query.get('size') || 'square',
    photo: query.get('photo') || 'boulevard',
    caption: query.get('caption') || 'Sunset Heist',
    subtitle: query.get('subtitle') || 'Vice City',
  });
  // ?scroll=panels brings the panel controls into view for editor shots: the
  // controls column is taller than a screenshot, and the crop sliders are the
  // part of the editor the shot should show.
  if (query.get('scroll') === 'panels') {
    document.querySelector('.panels')?.scrollIntoView();
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
