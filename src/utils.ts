export class RC4 {
  private box: number[] = new Array<number>(256);

  public KSA(key: Buffer) {
    const len = key.length;
    for (let i = 0; i < 256; i++) {
      this.box[i] = i;
    }

    for (let i = 0, j = 0; i < 256; i++) {
      j = (j + this.box[i] + key[i % len]) & 0xff;
      const swap = this.box[i];
      this.box[i] = this.box[j];
      this.box[j] = swap;
    }
  }

  public PRGA(data: Buffer, length: number) {
    for (let k = 0, i, j; k < length; k++) {
      i = (k + 1) & 0xff;
      j = (this.box[i] + i) & 0xff;
      data[k] ^= this.box[(this.box[i] + this.box[j]) & 0xff];
    }
  }
};

export function sanitizeFilename(name: string) {
  if (typeof name !== 'string') return '';

  const forbiddenRegex = /[\x00-\x1F<>:"/\\|?*]/g;
  const reservedRegex = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

  let filename = name.replace(forbiddenRegex, '');
  filename = filename.replace(/[. ]+$/g, '');

  if (filename.length === 0) filename = '_';

  if (reservedRegex.test(filename)) {
    filename = filename + '_';
  }

  return filename;
}