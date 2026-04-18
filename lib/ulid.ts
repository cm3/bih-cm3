const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function ulid(): string {
  const now = Date.now();
  let time = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t & 31] + time;
    t = Math.floor(t / 32);
  }
  let rand = '';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 16; i++) {
    const bitOffset = i * 5;
    const byteIndex = Math.floor(bitOffset / 8);
    const bitShift = bitOffset % 8;
    let value = (bytes[byteIndex] >>> bitShift) & 31;
    if (bitShift > 3 && byteIndex + 1 < bytes.length) {
      value |= (bytes[byteIndex + 1] << (8 - bitShift)) & 31;
    }
    rand += CROCKFORD[value];
  }
  return time + rand;
}
