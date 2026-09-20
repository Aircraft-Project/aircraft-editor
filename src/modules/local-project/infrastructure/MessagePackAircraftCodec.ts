import { decode, encode } from "@msgpack/msgpack";
import type { AircraftCodec } from "../application";

export class MessagePackAircraftCodec<T> implements AircraftCodec<T> {
  async encode(value: T): Promise<Uint8Array> {
    return encode(value);
  }

  async decode(bytes: Uint8Array): Promise<T> {
    return decode(bytes) as T;
  }
}
