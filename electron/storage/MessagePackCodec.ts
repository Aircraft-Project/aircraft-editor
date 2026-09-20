import { decode, encode } from "@msgpack/msgpack";

export class MessagePackCodec {
  encode(value: unknown): Uint8Array {
    return encode(value);
  }

  decode(bytes: Uint8Array): unknown {
    return decode(bytes);
  }
}
