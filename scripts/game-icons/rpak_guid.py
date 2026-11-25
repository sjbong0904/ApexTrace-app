"""Port of RSX Pak_StringToGuidAligned (respawn asset path -> 64-bit GUID)."""
import struct
M32 = 0xFFFFFFFF
M64 = 0xFFFFFFFFFFFFFFFF


def guid(s: str) -> int:
    b = s.encode() + b"\0"
    b += b"\0" * (-len(b) % 4)
    v1 = 0
    i = 0
    off = 0
    while True:
        w = struct.unpack_from("<I", b, off)[0]
        v4 = (~w & (w - 0x01010101) & 0x80808080) & M32
        v5 = (v4 ^ (v4 - 1)) & M32
        v6 = ((v5 & w) ^ 0x5C5C5C5C) & M32
        v7 = (~v6 & (v6 - 0x01010101) & 0x80808080) & M32
        v8 = v7 & (-v7 & M32)
        if v7 != v8:
            v9 = 0xFF000000
            while True:
                v10 = v9
                if (v9 & v6) == 0:
                    v8 |= v9 & 0x80808080
                v9 >>= 8
                if v10 < 0x100:
                    break
        v11 = (0x633D5F1 * v1) & M64
        inner = (((v5 & w) - 45 * (v8 >> 7)) & M32) & 0xDFDFDFDF
        v12 = ((0xFB8C4D96501 * inner) & M64) >> 24
        if v4:
            break
        off += 4
        i += 4
        t = (v11 + v12) & M64
        v1 = (t >> 61) ^ t
    v13 = v5.bit_length() - 1 if v5 else -1
    return (v12 + v11 - 0xAE502812AA7333 * ((i + int(v13 / 8)) & M32)) & M64


if __name__ == "__main__":
    import sys
    for a in sys.argv[1:]:
        print(f"{guid(a):016x}  {a}")
