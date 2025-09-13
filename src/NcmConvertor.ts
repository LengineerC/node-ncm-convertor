import FsTools from "./FsTool";
import { Image, Optional } from "./types";
import CryptoJS from "crypto-js";
import { RC4, sanitizeFilename } from "./utils";
import { createWriteStream, PathLike, statSync, writeFileSync } from "fs";
import path from "path";
import NodeID3, { Tags } from "node-id3";

export default class NcmConvertor {
  private static readonly CORE_KEY = CryptoJS.enc.Hex.parse(
    "687a4852416d736f356b496e62617857"
  )
  private static readonly MODIFY_KEY = CryptoJS.enc.Hex.parse(
    "2331346c6a6b5f215c5d2630553c2728"
  );

  private outputDir: PathLike = process.cwd();
  private buffer: Optional<Buffer>;
  private isNcmFile: boolean;
  private offset: number;
  private mataData: Record<string, any> = {};
  private image: Optional<Image>;
  private rc4: RC4 = new RC4();

  constructor(ncmPath: PathLike, outputDir: PathLike) {
    this.outputDir = outputDir;
    const outputState = statSync(outputDir);
    if (!outputState.isDirectory()) {
      throw new Error("Output path is not a directory");
    }

    this.buffer = FsTools.readNcm(ncmPath);
    this.isNcmFile = this.isValidNcmFile();
    if (!this.isNcmFile) throw new Error("Invalid ncm file");

    // Magic Header: 10B
    this.offset = 10;
  }

  public isValidNcmFile(): boolean {
    if (!this.buffer) return false;

    const firstMagic = this.buffer.readUInt32LE(0);
    if (firstMagic !== 0x4e455443) return false;

    const secondMagic = this.buffer.readUInt32LE(4);
    if (secondMagic !== 0x4d414446) return false;

    return true;
  }

  public async dump(): Promise<boolean> {
    try {
      // init offset
      this.offset = 10;
      if (!this.isNcmFile) {
        throw new Error("Dump error: invalid ncm file");
      }

      const keyBuffer = this.getRC4Key();
      const mataDataBuffer = this.getMataData();

      this.mataData = JSON.parse(mataDataBuffer.toString('utf8'));

      this.offset += 4 // CRC
      this.offset += 5 //Gap

      this.image = this.getImage();

      this.rc4.KSA(keyBuffer);

      const filePath = await this.getAndSaveMusicData();

      if (!this.writeMetaData(filePath)) {
        return false;
      }

      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  private getRC4Key(): Buffer {
    if (!this.buffer) throw new Error("Buffer is empty");

    const keyLength = this.buffer.readUInt32LE(this.offset);
    this.offset += 4; // KEY Length: 4B
    if (keyLength <= 0) throw new Error("Invalid key length");

    const encryptedKey = this.buffer.subarray(
      this.offset,
      this.offset + keyLength
    );
    this.offset += keyLength; // KEY From AES128 Decode: keyLength

    const xorKey = encryptedKey.map(byte => byte ^ 0x64);

    const ciphertext = CryptoJS.lib.WordArray.create(xorKey);
    const decrypted = CryptoJS.AES.decrypt(
      CryptoJS.lib.CipherParams.create({
        ciphertext: ciphertext
      }),
      NcmConvertor.CORE_KEY,
      {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    const decryptedBuffer = Buffer.from(decrypted.toString(CryptoJS.enc.Utf8), 'utf8');

    return decryptedBuffer.subarray(17);
  }

  private getMataData(): Buffer {
    if (!this.buffer) throw new Error("Buffer is empty");

    const mataLength = this.buffer.readUInt32LE(this.offset);
    // Mata Length: 4B
    this.offset += 4;

    const encryptedMata = this.buffer.subarray(
      this.offset,
      this.offset + mataLength
    );
    // Mata Data(JSON): mataLength
    this.offset += mataLength;

    const xorMata = encryptedMata.map(byte => byte ^ 0x63);
    const afterPrefixMata = xorMata.subarray(22);

    const base64Str = String.fromCharCode(...afterPrefixMata);

    let decodedBase64;
    try {
      decodedBase64 = atob(base64Str);
    } catch (err) {
      throw new Error("Base64 decoding failed: " + err);
    }

    const decodedBytes = Uint8Array.from(decodedBase64, c => c.charCodeAt(0));
    const ciphertext = CryptoJS.lib.WordArray.create(decodedBytes);

    const decrypted = CryptoJS.AES.decrypt(
      CryptoJS.lib.CipherParams.create({
        ciphertext,
      }),
      NcmConvertor.MODIFY_KEY,
      {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    const decryptedBuffer = Buffer.from(decrypted.toString(CryptoJS.enc.Utf8), 'utf8');

    return decryptedBuffer.subarray(6);
  }

  private getImage(): Image {
    if (!this.buffer) throw new Error("Buffer is empty");

    const imgSize = this.buffer.readUInt32LE(this.offset);
    this.offset += 4 //img size data: 4B

    const imgData = this.buffer.subarray(
      this.offset,
      this.offset + imgSize
    );
    this.offset += imgSize; // img data: imgSize

    const { albumPic } = this.mataData;
    const imgName = albumPic?.split('/').filter(Boolean).pop();

    return {
      imgName,
      size: imgSize,
      data: imgData,
    };
  }

  private getAndSaveMusicData(): Promise<PathLike> {
    const { musicName, format, artist = [] } = this.mataData;

    const filename = sanitizeFilename((artist as string[][])
      .reduce((acc: string, cur: string[], i) => acc + (i > 0 ? ', ' : '') + cur[0], '')
      + ` - ${musicName}.${format}`);
    const filepath = path.resolve((this.outputDir as string), filename);
    
    const writeStream = createWriteStream(filepath);
    const CHUNK_SIZE = 0x8000;

    return new Promise((res, rej) => {
      if (!this.buffer) {
        writeStream.end();
        throw new Error("Buffer is empty");
      }

      writeStream.on("finish", () => res(filepath));
      writeStream.on("error", rej);

      let remaining = this.buffer.length - this.offset;
      let currentOffset = this.offset;

      while (remaining > 0) {
        const chuckLength = Math.min(CHUNK_SIZE, remaining);
        const encryptedChunk = this.buffer.subarray(currentOffset, currentOffset + chuckLength);
        const decryptedChunk = Buffer.from(encryptedChunk);

        this.rc4.PRGA(decryptedChunk, chuckLength);

        writeStream.write(decryptedChunk);
        
        currentOffset += chuckLength;
        remaining -= chuckLength;
      }

      writeStream.end();
    });
  }

  private writeMetaData(filePath: PathLike): boolean {
    const ext = path.extname(filePath.toString()).toLowerCase();
    let res = false;

    if (ext === '.mp3') {
      res = this.writeMp3MetaData(filePath);
    } else if (ext === '.flac') {
      res = this.writeFlacMetaData();
    }

    return res;
  }

  private writeMp3MetaData(filePath: PathLike): boolean {
    try {
      const {
        artist: artists,
        musicName,
        album,
      } = this.mataData;
      const artist = (artists as string[][])
        .reduce((acc: string, cur: string[], i) => acc + (i > 0 ? ', ' : '') + cur[0], '');

      const tags: Tags = {
        title: musicName,
        artist,
        album,
        // @ts-ignore
        image: this.image ? {
          mime: this.image.imgName?.endsWith(".png") ? "image/png" : "image/jpeg",
          type: { id: 3 },
          imageBuffer: this.image.data,
        } : undefined
      };
      const success = NodeID3.write(tags, filePath.toString());

      return success instanceof Error ? false : true;
    } catch (err) {
      console.error("mp3 metadata write error:", err);
      return false;
    }
  }

  private writeFlacMetaData(): boolean {
    if (!this.image) return true;

    try {
      const imgPath = path.resolve(this.outputDir.toString(), this.image.imgName);
      writeFileSync(imgPath, this.image.data);

      return true;
    } catch (err) {
      console.log("flac metadata write error:", err);
      return false;
    }
  }
};
