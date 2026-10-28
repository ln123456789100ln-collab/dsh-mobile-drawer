import {Transform} from 'node:stream';

export function isLightweightRequest(method: string, path: string, flag: unknown) {
  const url = new URL(path, 'http://localhost');
  return method === 'GET' && flag === '1' && url.pathname === '/plugins/' &&
    /^[A-Za-z0-9_-]{8,128}$/.test(url.searchParams.get('rev') || '');
}

export function lightweightClientScript(source: string) {
  // Only shipped decorative illustrations, never arbitrary image data or attachments.
  const transparent = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  return source.replace(
    /(\bvar (?:onboarding_(?:welcome|recharge)(?:_zh)?(?:_dark)?|badge_skill_preview(?:_zh)?|voice_input_preview(?:_zh)?)_default\s*=\s*")data:image\/[A-Za-z0-9+.-]+;base64,[A-Za-z0-9+/=]+(";)/g,
    (_, before, after) => before + transparent + after,
  ).replace(
    /(window\.__ModuleLoader__\.load\(\{\s*id:\s*"open-sea-skin",\s*factory:\s*\(require\)\s*=>\s*\{)/g,
    '$1 return {apply() {}};',
  );
}

export function lightweightAssetStream(maxBytes = 32 * 1024 * 1024) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  return new Transform({
    transform(chunk, _encoding, done) {
      bytes += chunk.length;
      if (bytes > maxBytes) return done(new Error('Lightweight asset too large'));
      chunks.push(Buffer.from(chunk));
      done();
    },
    flush(done) {
      this.push(lightweightClientScript(Buffer.concat(chunks).toString('utf8')));
      done();
    },
  });
}
