// Allowed project file types. The extension decides the content type we send, and the Supabase bucket enforces the same list.
export const MAX_BYTES = 50 * 1024 * 1024; // 50 MB (Supabase free-plan ceiling)
export const EXT_TYPES = {
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', ogg: 'audio/ogg', mid: 'audio/midi', midi: 'audio/midi',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  pdf: 'application/pdf', zip: 'application/zip', txt: 'text/plain',
};
export const ACCEPT = Object.keys(EXT_TYPES).map((e) => `.${e}`).join(',');
export const extOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
export const safeName = (name) => name.replace(/[^\w.\-]+/g, '_').slice(-100);
export const kindOf = (mime = '') => (mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('image/') ? 'image' : 'file');

export function checkFile(file) {
  const type = EXT_TYPES[extOf(file.name)];
  if (!type) return { error: `“${file.name}”: this file type isn’t supported.` };
  if (file.size === 0) return { error: `“${file.name}” is empty.` };
  if (file.size > MAX_BYTES) return { error: `“${file.name}” is larger than 50 MB.` };
  return { type };
}
