(function (root, factory) {
  const media = factory();
  if (typeof module === 'object' && module.exports) module.exports = media;
  else root.WEYOMedia = media;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const base = 'https://rmtfmegufylujrzuvczi.supabase.co/storage/v1/object/public/project-media/';
  function mediaUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    if (/^https?:\/\//i.test(value)) return value;
    return base + value.replace(/^\/+/, '');
  }
  function mediaUrls(values) {
    return Array.isArray(values) ? values.map(mediaUrl).filter(Boolean) : [];
  }
  return { mediaUrl, mediaUrls };
});
